/**
 * Order Data Extractor
 *
 * Extracts customer/order fields from uploaded documents:
 *   - PDF  → text extraction via pdf-parse
 *   - XLSX → cell/table reading via exceljs
 *   - DOCX → paragraph/table extraction via mammoth
 *
 * Rules:
 * - Never invents data — only returns what is clearly found in the text
 * - Returns confidence level for each extracted field
 * - If a field is not found, it is omitted from the result
 * - If content is unclear → field is flagged as 'low' confidence
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');
const mammoth = require('mammoth');

// ─── Field extractors ────────────────────────────────────────────────
// Each extractor: { field, extract: (text) => { value, confidence } | null }

const EXTRACTORS = [
  {
    field: 'drawingNumber',
    extract(text) {
      // DWG NO. 12600-1367 or DWG.NO: XXX or שרטוט מס' XXX
      const patterns = [
        /(?:DWG\.?\s*(?:NO\.?|NUMBER|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:שרטוט\s*(?:מס['׳]?\s*)?[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:Drawing\s*(?:No\.?|Number|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:Part\s*(?:No\.?|Number|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:P\/N\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1] && m[1].length >= 3) return { value: m[1].trim(), confidence: 'high' };
      }
      return null;
    },
  },
  {
    field: 'revision',
    extract(text) {
      const patterns = [
        /REV\.?\s*[:\-]?\s*([A-Z0-9][\w\.]{0,5})(?:\s|$|\n)/i,
        /(?:מהדורה|Issue)\s*[:\-]?\s*([A-Za-z0-9][\w\.]{0,8})/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].trim();
          // Filter out false positives
          if (/^(DWG|NO|NUM|ENG|MAN|DEV)/i.test(val)) continue;
          if (val.length > 6) continue; // Revision codes are short
          return { value: val, confidence: 'high' };
        }
      }
      // Try "REV" followed by a short alphanumeric on same or next line
      const revLine = text.match(/\bREV[.\s]*\n\s*([A-Z0-9][\w\-\.]{0,5})\b/i);
      if (revLine) return { value: revLine[1].trim(), confidence: 'low' };
      return null;
    },
  },
  {
    field: 'orderNumber',
    extract(text) {
      const patterns = [
        /(?:הזמנה\s*(?:מס['׳]?\s*)?[:\-#]?\s*)([A-Za-z0-9][\w\-\/]+)/i,
        /(?:Order\s*(?:No\.?|Number|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/]+)/i,
        /(?:P\.?O\.?\s*(?:No\.?|Number|#)?\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/]+)/i,
        /(?:Purchase\s*Order\s*[:\-#]?\s*)([A-Za-z0-9][\w\-\/]+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1] && m[1].length >= 3) {
          const val = m[1].trim();
          // Filter out very short or common false positive words
          if (/^(IN|OR|ON|OF|NO|IS|IT|LY|AS|AT)$/i.test(val)) continue;
          return { value: val, confidence: 'high' };
        }
      }
      return null;
    },
  },
  {
    field: 'customerName',
    extract(text) {
      const patterns = [
        /(?:לקוח\s*[:\-]\s*)(.{3,60})/i,
        /(?:Customer\s*(?:Name)?\s*[:\-]\s*)(.{3,60})/i,
        /(?:Bill\s*To\s*[:\-]\s*)(.{3,60})/i,
        /(?:Sold\s*To\s*[:\-]\s*)(.{3,60})/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').replace(/\s{2,}/g, ' ').trim();
          if (val.length >= 2) return { value: val, confidence: 'high' };
        }
      }
      // Try to find a company name from "PROPERTY OF" or Hebrew company patterns
      const propMatch = text.match(/PROPERTY\s+OF\s+([A-Z][A-Z\s\-&]{2,}?(?:\s*-\s*[A-Z\s]+)?(?:LTD|INC|CORP|LLC|CO)[\.\s]*(?:\([^)]*\))?)/i);
      if (propMatch) return { value: propMatch[1].trim(), confidence: 'low' };

      const hebrewCo = text.match(/([\u0590-\u05FF]+\s+[\u0590-\u05FF]+\s+(?:בע"מ|בע״מ))/);
      if (hebrewCo) return { value: hebrewCo[1].trim(), confidence: 'low' };
      return null;
    },
  },
  {
    field: 'partName',
    extract(text) {
      // Look for Hebrew part descriptions with explicit label
      const hebrewDesc = text.match(/(?:תיאור\s*(?:החלק)?\s*[:\-]\s*)([^\n]{3,80})/i);
      if (hebrewDesc) {
        const val = hebrewDesc[1].trim();
        if (val.length >= 2 && !/^(ההוראה|הפעולה)/.test(val)) return { value: val, confidence: 'high' };
      }

      // Look for description fields
      const descPatterns = [
        /(?:Item\s*Description\s*[:\-]\s*)([^\n]{3,60})/i,
        /(?:Part\s*(?:Name|Description)\s*[:\-]\s*)([^\n]{3,60})/i,
        /(?:Description\s*[:\-]\s*)([^\n]{3,60})/i,
        /(?:Product\s*[:\-]\s*)([^\n]{3,60})/i,
      ];
      for (const p of descPatterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/\s{2,}/g, ' ').trim();
          if (val.length >= 3 && !/^[\/\-\s]*$/.test(val) && !/^MATERIAL/i.test(val)) {
            return { value: val, confidence: 'high' };
          }
        }
      }

      // Try to find Hebrew rubber part names (common patterns in Israeli drawings)
      const hebrewPartPatterns = [
        /(טבעת\s+[\u0590-\u05FF\s\-]{2,})/,
        /(אטם\s+[\u0590-\u05FF\s\-]{2,})/,
        /(פרופיל\s+[\u0590-\u05FF\s\-]{2,})/,
        /(ממברנה\s+[\u0590-\u05FF\s\-]{2,})/,
      ];
      for (const p of hebrewPartPatterns) {
        const m = text.match(p);
        if (m && m[1]) {
          // Clean up: remove duplicates/newlines
          const val = m[1].replace(/\n.*/s, '').trim();
          return { value: val, confidence: 'low' };
        }
      }
      return null;
    },
  },
  {
    field: 'quantity',
    extract(text) {
      const patterns = [
        /(?:כמות\s*(?:בהזמנה)?\s*[:\-]?\s*)([\d,]+)/i,
        /(?:QTY\.?\s*[:\-]?\s*)([\d,]+)/i,
        /(?:Quantity\s*[:\-]?\s*)([\d,]+)/i,
        /(?:Amount\s*[:\-]?\s*)([\d,]+)/i,
        /(?:PCS\.?\s*[:\-]?\s*)([\d,]+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const num = m[1].replace(/,/g, '');
          if (parseInt(num) > 0) return { value: num, confidence: 'high' };
        }
      }
      return null;
    },
  },
  {
    field: 'material',
    extract(text) {
      // Look for specific rubber/material specs
      const materialPatterns = [
        /(?:חומר\s*[:\-]\s*)([^\n]{3,80})/i,
        /(?:Material\s*[:\-]\s*)([^\n]{3,60})/i,
        /(?:Compound\s*[:\-]\s*)([^\n]{3,60})/i,
      ];
      for (const p of materialPatterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').trim();
          // Filter out headers and section labels
          if (val.length >= 3 && !/^[\/\-\s]*$/.test(val) && !/^MATERIAL/i.test(val) && !/^גלם/.test(val)) {
            return { value: val, confidence: 'high' };
          }
        }
      }

      // Look for rubber type keywords directly
      const rubberMatch = text.match(/((?:POLY\s*-?\s*)?(?:CHLOROPRENE|CHELOROPRENE|NITRILE|BUTADIENE|SILICONE|FLUOROCARBON|ETHYLENE\s*PROPYLENE)\s*RUBBER)/i);
      if (rubberMatch) return { value: rubberMatch[1].trim(), confidence: 'high' };

      // Look for material code patterns
      const codeMatch = text.match(/\b((?:NBR|EPDM|FKM|Viton|CR|NR|SBR|HNBR|FFKM|VMQ)\s*\d*\s*(?:Shore\s*[A-D]\s*\d+(?:\s*-\s*\d+)?)?)/i);
      if (codeMatch) return { value: codeMatch[1].trim(), confidence: 'high' };

      // ASTM spec
      const astmMatch = text.match(/(ASTM\s*D\d+\s*[^\n]{0,60})/i);
      if (astmMatch) return { value: astmMatch[1].trim(), confidence: 'low' };

      // Hardness as material hint
      const hardnessMatch = text.match(/(?:HARDNESS\s*[:\-]?\s*)(\d+\s*-?\s*\d*\s*Shore\s*[A-D])/i);
      if (hardnessMatch) return { value: hardnessMatch[1].trim(), confidence: 'low' };

      return null;
    },
  },
  {
    field: 'sku',
    extract(text) {
      const patterns = [
        /(?:מק"ט|מק['׳]ט)\s*[:\-]?\s*([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:PART\s*(?:OR\s*)?I\.?D\.?\s*(?:NO\.?)?\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:SKU\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:Item\s*(?:No\.?|Code|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:Catalog\s*(?:No\.?|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1] && m[1].length >= 2) {
          const val = m[1].trim();
          // Filter false positives from drawing title blocks
          if (/^(DESCRIPTION|MATERIAL|PROJECT|SIZE|DATE|NAME|NOTE|SHEET|DESIGNED|TOLERANCE|DIMENSION|REVISION|SURFACE|SECTION)/i.test(val)) continue;
          return { value: val, confidence: 'low' };
        }
      }
      return null;
    },
  },
  {
    field: 'samplingPlan',
    extract(text) {
      const patterns = [
        /(?:תוכנית\s*דגימה\s*[:\-]?\s*)(.{3,40})/i,
        /(?:Sampling\s*Plan\s*[:\-]?\s*)(.{3,40})/i,
        /(MIL[\-\s]*STD[\-\s]*\d+[A-Za-z\s]*(?:Level\s*[IV]+)?)/i,
        /(ISO\s*2859[A-Za-z0-9\s\-]*(?:Level\s*[IV]+)?)/i,
        /(C\s*=\s*0\s*(?:Plan)?)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').trim();
          if (val.length >= 3) return { value: val, confidence: 'low' };
        }
      }
      return null;
    },
  },
  {
    field: 'sampleQuantity',
    extract(text) {
      const patterns = [
        /(?:כמות\s*(?:ב)?מדגם\s*[:\-]?\s*)(\d+)/i,
        /(?:Sample\s*(?:Qty|Quantity|Size)\s*[:\-]?\s*)(\d+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1] && parseInt(m[1]) > 0) return { value: m[1], confidence: 'low' };
      }
      return null;
    },
  },
  {
    field: 'date',
    extract(text) {
      // Look for labeled dates first
      const labeled = [
        /(?:תאריך\s*[:\-]?\s*)(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4})/i,
        /(?:Date\s*[:\-]?\s*)(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4})/i,
        /(?:Date\s*[:\-]?\s*)(\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})/i,
        /(?:PRINTED\s*[:\-]?\s*)(\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4})/i,
      ];
      for (const p of labeled) {
        const m = text.match(p);
        if (m && m[1]) return { value: normalizeDate(m[1]), confidence: 'high' };
      }
      // Unlabeled dates
      const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) return { value: normalizeDate(dateMatch[1]), confidence: 'low' };
      return null;
    },
  },
];

// ─── Date normalization ──────────────────────────────────────────────
function normalizeDate(dateStr) {
  let m = dateStr.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = dateStr.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2})$/);
  if (m) {
    const [, d, mo, y] = m;
    const fullYear = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${fullYear}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = dateStr.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr;
}

// ─── Text extraction by file type ────────────────────────────────────

async function extractTextFromPDF(fullPath) {
  const buffer = fs.readFileSync(fullPath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractTextFromExcel(fullPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(fullPath);

  const lines = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const val = cell.text || (cell.value != null ? String(cell.value) : '');
        if (val.trim()) cells.push(val.trim());
      });
      if (cells.length > 0) {
        // For 2-cell rows: format as "Label: Value" for regex matching
        // Strip trailing colon/dash from label to avoid "Label:: Value"
        if (cells.length === 2) {
          const label = cells[0].replace(/[:\-\s]+$/, '');
          lines.push(`${label}: ${cells[1]}`);
        } else {
          lines.push(cells.join(' '));
        }
      }
    });
  });
  return lines.join('\n');
}

async function extractTextFromDocx(fullPath) {
  const buffer = fs.readFileSync(fullPath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

// ─── Main extraction function ────────────────────────────────────────

const SUPPORTED_EXTENSIONS = {
  '.pdf': { parser: extractTextFromPDF, label: 'PDF' },
  '.xlsx': { parser: extractTextFromExcel, label: 'Excel' },
  '.xls': { parser: extractTextFromExcel, label: 'Excel' },
  '.docx': { parser: extractTextFromDocx, label: 'Word' },
};

async function extractOrderData(filePath) {
  const fullPath = filePath.startsWith('/')
    ? path.join(__dirname, filePath.replace(/^\//, ''))
    : filePath;

  if (!fs.existsSync(fullPath)) {
    return { extracted: {}, confidence: {}, rawText: '', error: 'קובץ לא נמצא' };
  }

  const ext = path.extname(fullPath).toLowerCase();
  const handler = SUPPORTED_EXTENSIONS[ext];

  if (!handler) {
    return {
      extracted: {}, confidence: {}, rawText: '',
      error: `סוג קובץ ${ext} אינו נתמך לחילוץ. נתמכים: PDF, Excel (.xlsx), Word (.docx)`
    };
  }

  let text = '';
  try {
    text = await handler.parser(fullPath);
  } catch (err) {
    console.error(`${handler.label} parse error:`, err.message);
    return { extracted: {}, confidence: {}, rawText: '', error: `שגיאה בקריאת קובץ ${handler.label}` };
  }

  if (!text.trim()) {
    const hint = ext === '.pdf' ? ' — ייתכן שזהו PDF סרוק (תמונה)' : '';
    return { extracted: {}, confidence: {}, rawText: '', error: `לא נמצא טקסט בקובץ${hint}` };
  }

  const extracted = {};
  const confidence = {};

  for (const extractor of EXTRACTORS) {
    const result = extractor.extract(text);
    if (result && result.value) {
      extracted[extractor.field] = result.value;
      confidence[extractor.field] = result.confidence;
    }
  }

  return {
    extracted,
    confidence,
    rawText: text.slice(0, 2000),
    sourceType: handler.label,
  };
}

module.exports = { extractOrderData };
