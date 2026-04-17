/**
 * Document Extraction Pipeline
 *
 * Central orchestrator that:
 * 1. Detects file type
 * 2. Extracts text (native or via OCR)
 * 3. Parses structured data (dimensions + raw material)
 * 4. Returns unified result with confidence scores
 *
 * Supports: PDF, PNG, JPG, JPEG, TIFF, XLSX, XLS, DOCX
 */

const path = require('path');
const fs = require('fs');
const { preprocessImage, pdfToImage } = require('./imagePreprocessor');
const { recognizeImage } = require('./ocrEngine');
const { extractTextFromPDF, extractTextFromExcel, extractTextFromDocx } = require('./orderExtractor');
const { extractDimensions } = require('./dimensionExtractor');
const { extractRawMaterial } = require('./rawMaterialExtractor');

// File type groups
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xls']);
const WORD_EXTENSIONS = new Set(['.docx']);

// Minimum text length to consider a PDF as having extractable text
const MIN_TEXT_LENGTH = 20;

/**
 * Main extraction function.
 * @param {string} filePath - Server-relative path (e.g., /uploads/file.pdf)
 * @returns {Promise<ExtractionResult>}
 */
async function extractDocumentDataFull(filePath) {
  const startTime = Date.now();
  const warnings = [];

  // Resolve absolute path
  const fullPath = filePath.startsWith('/')
    ? path.join(__dirname, filePath.replace(/^\//, ''))
    : filePath;

  if (!fs.existsSync(fullPath)) {
    return makeResult({ error: 'קובץ לא נמצא', startTime });
  }

  const ext = path.extname(fullPath).toLowerCase();
  let text = '';
  let ocrUsed = false;
  let ocrConfidence = null;

  try {
    // ─── IMAGE FILES: preprocess → OCR ────────────────────────────
    if (IMAGE_EXTENSIONS.has(ext)) {
      const ocrResult = await processImageFile(fullPath);
      text = ocrResult.text;
      ocrUsed = true;
      ocrConfidence = ocrResult.confidence;

      if (!text.trim()) {
        return makeResult({
          error: 'OCR לא הצליח לחלץ טקסט מהתמונה. נסה להעלות תמונה ברזולוציה גבוהה יותר.',
          ocrUsed: true,
          ocrConfidence: 0,
          startTime,
        });
      }
    }

    // ─── PDF FILES: try text first, fallback to OCR ───────────────
    else if (PDF_EXTENSIONS.has(ext)) {
      // Step 1: Try native text extraction
      try {
        text = await extractTextFromPDF(fullPath);
      } catch (err) {
        console.warn('[Pipeline] PDF text extraction failed:', err.message);
        text = '';
      }

      // Step 2: If no meaningful text, try OCR via PDF-to-image
      if (countNonWhitespace(text) < MIN_TEXT_LENGTH) {
        warnings.push('לא נמצא טקסט מובנה ב-PDF — מנסה חילוץ באמצעות OCR');

        const pdfImageBuffer = await pdfToImage(fullPath);

        if (pdfImageBuffer) {
          try {
            const processed = await preprocessImage(pdfImageBuffer);
            const ocrResult = await recognizeImage(processed);
            text = ocrResult.text;
            ocrUsed = true;
            ocrConfidence = ocrResult.confidence;
            warnings.push('רק העמוד הראשון של ה-PDF נסרק');
          } catch (err) {
            console.warn('[Pipeline] OCR on PDF image failed:', err.message);
          }
        }

        // If still no text after OCR attempt
        if (countNonWhitespace(text) < MIN_TEXT_LENGTH) {
          const hint = pdfImageBuffer
            ? 'OCR לא הצליח לחלץ טקסט מספיק מה-PDF'
            : 'PDF סרוק — לא ניתן לחלץ תמונה. נסה לשמור כתמונה (PNG/JPG) ולהעלות שוב';
          return makeResult({ error: hint, ocrUsed, ocrConfidence, startTime, warnings });
        }
      }
    }

    // ─── EXCEL FILES ──────────────────────────────────────────────
    else if (EXCEL_EXTENSIONS.has(ext)) {
      try {
        text = await extractTextFromExcel(fullPath);
      } catch (err) {
        return makeResult({ error: 'שגיאה בקריאת קובץ Excel: ' + err.message, startTime });
      }
    }

    // ─── WORD FILES ───────────────────────────────────────────────
    else if (WORD_EXTENSIONS.has(ext)) {
      try {
        text = await extractTextFromDocx(fullPath);
      } catch (err) {
        return makeResult({ error: 'שגיאה בקריאת קובץ Word: ' + err.message, startTime });
      }
    }

    // ─── UNSUPPORTED ──────────────────────────────────────────────
    else {
      return makeResult({
        error: `סוג קובץ ${ext} אינו נתמך לחילוץ. נתמכים: PDF, PNG, JPG, TIFF, Excel, Word`,
        startTime,
      });
    }

    // ─── EMPTY TEXT CHECK ─────────────────────────────────────────
    if (!text.trim()) {
      return makeResult({ error: 'לא נמצא טקסט בקובץ', ocrUsed, ocrConfidence, startTime, warnings });
    }

    // ─── PARSE STRUCTURED DATA ────────────────────────────────────
    const dimensions = extractDimensions(text, { ocrUsed });
    const rawMaterial = extractRawMaterial(text);

    return makeResult({
      dimensions,
      rawMaterial,
      rawText: text.slice(0, 3000),
      ocrUsed,
      ocrConfidence,
      startTime,
      warnings,
    });

  } catch (err) {
    console.error('[Pipeline] Unexpected error:', err);
    return makeResult({
      error: 'שגיאה בלתי צפויה בחילוץ נתונים: ' + err.message,
      ocrUsed,
      ocrConfidence,
      startTime,
      warnings,
    });
  }
}

/**
 * Process an image file through preprocessing and OCR.
 * @param {string} imagePath - Absolute path to image
 * @returns {Promise<{text: string, confidence: number}>}
 */
async function processImageFile(imagePath) {
  const processed = await preprocessImage(imagePath);
  return recognizeImage(processed);
}

/**
 * Count non-whitespace characters in a string.
 */
function countNonWhitespace(str) {
  return (str || '').replace(/\s/g, '').length;
}

/**
 * Build a standardized result object.
 */
function makeResult({
  dimensions = [],
  rawMaterial = { extracted: {}, confidence: {} },
  rawText = '',
  ocrUsed = false,
  ocrConfidence = null,
  startTime = Date.now(),
  error = null,
  warnings = [],
} = {}) {
  return {
    dimensions,
    rawMaterial,
    rawText,
    ocrUsed,
    ocrConfidence,
    processingTimeMs: Date.now() - startTime,
    error,
    warnings,
  };
}

/**
 * Extract data from every file attached to an order and merge intelligently.
 *
 * Inputs: an order object with { files: { drawing, customerOrder, qualityDocs[] } }.
 * Output: { dimensions, rawMaterial, conflicts, perFile, warnings }.
 *
 * Merge rules:
 *  - Dimensions: dedup by (symbol, nominal). Drawings are authoritative;
 *    same dimension from multiple files merges `sources`. Conflicting tolerances
 *    on the same (symbol, nominal) are marked uncertain.
 *  - Raw material: each field takes the first confident value seen in source
 *    priority order (drawing → customerOrder → qualityDocs). If a later file
 *    reports a *different* value for a field, a conflict entry is added.
 */
async function extractAllForOrder(order) {
  const files = collectOrderFiles(order);
  const perFile = [];
  const warnings = [];

  for (const f of files) {
    const result = await extractDocumentDataFull(f.serverPath);
    perFile.push({ ...f, result });
    if (result.warnings) warnings.push(...result.warnings.map(w => `[${f.source}] ${w}`));
    if (result.error) warnings.push(`[${f.source}] ${result.error}`);
  }

  const mergedDimensions = mergeDimensions(perFile);
  const { merged: mergedMaterial, conflicts } = mergeRawMaterial(perFile);

  return {
    dimensions: mergedDimensions,
    rawMaterial: mergedMaterial,
    conflicts,
    perFile: perFile.map(f => ({
      source: f.source,
      fileName: f.fileName,
      dimensionsFound: f.result.dimensions?.length || 0,
      materialFields: Object.keys(f.result.rawMaterial?.extracted || {}),
      ocrUsed: f.result.ocrUsed,
      error: f.result.error || null,
    })),
    warnings,
  };
}

// Build a prioritized list of files to scan.
// Drawings are listed first so their dimensions take precedence in dedup.
function collectOrderFiles(order) {
  const out = [];
  const files = order.files || {};
  if (files.drawing?.serverPath) {
    out.push({ source: 'drawing', fileName: files.drawing.originalName, serverPath: files.drawing.serverPath });
  }
  if (files.customerOrder?.serverPath) {
    out.push({ source: 'customerOrder', fileName: files.customerOrder.originalName, serverPath: files.customerOrder.serverPath });
  }
  for (const [i, qd] of (files.qualityDocs || []).entries()) {
    if (qd?.serverPath) {
      out.push({ source: `qualityDoc#${i + 1}`, fileName: qd.originalName, serverPath: qd.serverPath });
    }
  }
  return out;
}

function mergeDimensions(perFile) {
  const byKey = new Map();
  for (const f of perFile) {
    const dims = f.result.dimensions || [];
    for (const d of dims) {
      const key = `${(d.symbol || '').trim().toUpperCase()}|${String(d.nominal || '').trim()}`;
      if (!byKey.has(key)) {
        byKey.set(key, { ...d, sources: [f.source] });
        continue;
      }
      const existing = byKey.get(key);
      if (!existing.sources.includes(f.source)) existing.sources.push(f.source);
      // If tolerances differ, flag uncertain.
      if (d.tolerance && existing.tolerance && d.tolerance !== existing.tolerance) {
        existing.uncertain = true;
        existing.remarks = (existing.remarks ? existing.remarks + ' · ' : '') +
          `טולרנס שונה ב${f.source}: ${d.tolerance}`;
      }
      // Promote critical if any source says so.
      if (d.critical) existing.critical = true;
      // Prefer a non-empty unit if existing was blank.
      if (!existing.unit && d.unit) existing.unit = d.unit;
    }
  }
  return Array.from(byKey.values());
}

function mergeRawMaterial(perFile) {
  // Source priority: drawing > customerOrder > qualityDoc#N
  const priority = { drawing: 3, customerOrder: 2 };
  const priorityOf = src => priority[src] ?? 1;

  const accepted = {}; // field → { value, confidence, source }
  const conflicts = {}; // field → [{ value, confidence, source }]

  for (const f of perFile) {
    const rm = f.result.rawMaterial || { extracted: {}, confidence: {} };
    for (const [field, value] of Object.entries(rm.extracted)) {
      if (!value) continue;
      const conf = rm.confidence?.[field] || 'low';
      const entry = { value: String(value).trim(), confidence: conf, source: f.source };
      const prev = accepted[field];

      if (!prev) {
        accepted[field] = entry;
        continue;
      }
      if (prev.value === entry.value) continue; // agreement — skip

      // Conflict. Keep the higher-priority/confidence one as accepted,
      // record the loser in conflicts.
      const prevScore = priorityOf(prev.source) + (prev.confidence === 'high' ? 0.5 : 0);
      const newScore = priorityOf(entry.source) + (entry.confidence === 'high' ? 0.5 : 0);
      let winner = prev, loser = entry;
      if (newScore > prevScore) { winner = entry; loser = prev; }
      accepted[field] = winner;
      if (!conflicts[field]) conflicts[field] = [];
      if (!conflicts[field].some(c => c.value === loser.value && c.source === loser.source)) {
        conflicts[field].push(loser);
      }
      if (!conflicts[field].some(c => c.value === winner.value && c.source === winner.source)) {
        conflicts[field].push(winner);
      }
    }
  }

  const merged = { extracted: {}, confidence: {}, sources: {} };
  for (const [field, entry] of Object.entries(accepted)) {
    merged.extracted[field] = entry.value;
    merged.confidence[field] = conflicts[field] ? 'uncertain' : entry.confidence;
    merged.sources[field] = entry.source;
  }
  return { merged, conflicts };
}

module.exports = { extractDocumentDataFull, extractAllForOrder };
