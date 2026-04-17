/**
 * Raw Material Extractor Module
 *
 * Extracts raw material details from document text:
 *   - materialType (NBR, EPDM, Silicone, etc.)
 *   - description
 *   - supplier
 *   - batchNumber
 *   - certNumber
 *   - hardness
 *   - color
 *   - notes
 *
 * Each extracted field includes a confidence level ('high' or 'low').
 */

const RAW_MATERIAL_EXTRACTORS = [
  {
    field: 'materialType',
    extract(text) {
      // Common rubber type codes (exact match)
      const codeMatch = text.match(/\b(NBR|EPDM|FKM|Viton|CR|NR|SBR|HNBR|FFKM|VMQ|Silicone|Neoprene|Buna[\-\s]?N|Hypalon|Polyurethane|PU|PTFE)\b/i);
      if (codeMatch) return { value: codeMatch[1].trim(), confidence: 'high' };

      // OCR fuzzy matches for common misreads
      const fuzzyMap = [
        { re: /\b(N[8B]R|NER)\b/i, corrected: 'NBR' },
        { re: /\b(EPD\s*M|EROM|EPO\s*M)\b/i, corrected: 'EPDM' },
        { re: /\b(F[KX]M)\b/i, corrected: 'FKM' },
        { re: /\b(V[il1]ton)\b/i, corrected: 'Viton' },
        { re: /\b(S[il1]l[il1]cone)\b/i, corrected: 'Silicone' },
      ];
      for (const { re, corrected } of fuzzyMap) {
        if (re.test(text)) return { value: corrected, confidence: 'low' };
      }

      // Full rubber type names
      const fullNames = [
        /(?:POLY\s*-?\s*)?(?:CHLOROPRENE|NITRILE|BUTADIENE|SILICONE|FLUOROCARBON|ETHYLENE\s*PROPYLENE)\s*(?:RUBBER)?/i,
        /(?:גומי\s+(?:ניטריל|סיליקון|EPDM|פלואור))/i,
      ];
      for (const p of fullNames) {
        const m = text.match(p);
        if (m) return { value: m[0].trim(), confidence: 'high' };
      }

      // Hebrew material labels
      const hebrewMat = text.match(/(?:סוג\s*חומר\s*[:\-]\s*)([^\n]{2,40})/i);
      if (hebrewMat) return { value: hebrewMat[1].trim(), confidence: 'high' };

      // Material type from labeled field
      const labeledMat = text.match(/(?:Material\s*Type\s*[:\-]\s*)([^\n]{2,40})/i);
      if (labeledMat) return { value: labeledMat[1].trim(), confidence: 'high' };

      return null;
    },
  },
  {
    field: 'description',
    extract(text) {
      const patterns = [
        /(?:תיאור\s*(?:ה)?חומר\s*[:\-]\s*)([^\n]{3,80})/i,
        /(?:Material\s*Description\s*[:\-]\s*)([^\n]{3,80})/i,
        /(?:Compound\s*(?:Description|Name)\s*[:\-]\s*)([^\n]{3,60})/i,
        /(?:Specification\s*[:\-]\s*)([^\n]{3,60})/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').trim();
          if (val.length >= 3) return { value: val, confidence: 'high' };
        }
      }

      // ASTM / spec references as description
      const astm = text.match(/(ASTM\s*D[\-\s]?\d+[^\n]{0,40})/i);
      if (astm) return { value: astm[1].trim(), confidence: 'low' };

      return null;
    },
  },
  {
    field: 'supplier',
    extract(text) {
      const patterns = [
        /(?:ספק\s*[:\-]\s*)([^\n]{2,60})/i,
        /(?:Supplier\s*(?:Name)?\s*[:\-]\s*)([^\n]{2,60})/i,
        /(?:Vendor\s*(?:Name)?\s*[:\-]\s*)([^\n]{2,60})/i,
        /(?:Manufacturer\s*[:\-]\s*)([^\n]{2,60})/i,
        /(?:יצרן\s*[:\-]\s*)([^\n]{2,60})/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').trim();
          if (val.length >= 2) return { value: val, confidence: 'high' };
        }
      }
      return null;
    },
  },
  {
    field: 'batchNumber',
    extract(text) {
      const patterns = [
        /(?:אצווה\s*(?:מס['׳]?\s*)?[:\-#]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:Batch\s*(?:No\.?|Number|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:Lot\s*(?:No\.?|Number|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1] && m[1].length >= 2) return { value: m[1].trim(), confidence: 'high' };
      }
      return null;
    },
  },
  {
    field: 'certNumber',
    extract(text) {
      const patterns = [
        /(?:תעודה\s*(?:מס['׳]?\s*)?[:\-#]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:Cert(?:ificate)?\s*(?:No\.?|Number|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:COC\s*(?:No\.?|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
        /(?:COA\s*(?:No\.?|#)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]+)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1] && m[1].length >= 2) return { value: m[1].trim(), confidence: 'low' };
      }
      return null;
    },
  },
  {
    field: 'hardness',
    extract(text) {
      const patterns = [
        /(?:קשיות\s*[:\-]\s*)([^\n]{2,30})/i,
        /(?:Hardness\s*[:\-]\s*)(\d+\s*[\-–]\s*\d+\s*Shore\s*[A-D])/i,
        /(?:Hardness\s*[:\-]\s*)(\d+\s*Shore\s*[A-D])/i,
        /(\d+\s*[\-–]\s*\d+\s*Shore\s*[A-D])/i,
        /(\d+\s*Shore\s*[A-D])/i,
        /(?:IRHD|Durometer)\s*[:\-]?\s*(\d+\s*[\-–]?\s*\d*)/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].trim();
          if (val.length >= 2) return { value: val, confidence: 'high' };
        }
      }
      return null;
    },
  },
  {
    field: 'specification',
    extract(text) {
      const patterns = [
        /(?:מפרט\s*(?:מס['׳]?)?\s*[:\-]\s*)([A-Za-z0-9][\w\-\/\.\s]{1,40})/i,
        /(?:Spec(?:ification)?\s*(?:No\.?|#|Number)?\s*[:\-]\s*)([A-Za-z0-9][\w\-\/\.\s]{1,40})/i,
        /(?:Compound\s*(?:No\.?|#|Number|Code)\s*[:\-]?\s*)([A-Za-z0-9][\w\-\/\.]{1,30})/i,
        /\b(MIL-[A-Z]-\d{3,6}[A-Z]?)\b/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').trim();
          if (val.length >= 2) return { value: val, confidence: 'high' };
        }
      }
      return null;
    },
  },
  {
    field: 'standard',
    extract(text) {
      const patterns = [
        /\b(ISO\s*\d{3,5}(?:[\-:]\d+)?(?:\s*[A-Z])?)\b/i,
        /\b(ASTM\s*[A-Z]\s*\d{2,4}[A-Z]?(?:\s*\-\s*\d+)?)\b/i,
        /\b(DIN\s*(?:EN\s*)?(?:ISO\s*)?\d{2,5}(?:\-\d+)?)\b/i,
        /\b(EN\s*\d{3,5}(?:[\-:]\d+)?)\b/i,
        /\b(JIS\s*[A-Z]\s*\d{3,5})\b/i,
        /(?:תקן\s*[:\-]\s*)([A-Za-z0-9][\w\-\/\.\s]{1,40})/i,
        /(?:Standard\s*[:\-]\s*)([A-Za-z0-9][\w\-\/\.\s]{1,40})/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').trim();
          if (val.length >= 2) return { value: val, confidence: 'high' };
        }
      }
      return null;
    },
  },
  {
    field: 'color',
    extract(text) {
      const patterns = [
        /(?:צבע\s*[:\-]\s*)([^\n]{2,30})/i,
        /(?:Colo(?:u)?r\s*[:\-]\s*)([^\n]{2,30})/i,
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
          const val = m[1].replace(/[\r\n].*/s, '').trim();
          if (val.length >= 2) return { value: val, confidence: 'high' };
        }
      }

      // Common color keywords in context
      const colorKeywords = /\b(Black|White|Red|Blue|Green|Brown|Gray|Grey|Orange|Yellow|Transparent|שחור|לבן|אדום|כחול|ירוק|חום|אפור|שקוף)\b/i;
      const colorMatch = text.match(new RegExp('(?:colo(?:u)?r|צבע)[^\\n]{0,20}' + colorKeywords.source, 'i'));
      if (colorMatch) return { value: colorMatch[1].trim(), confidence: 'low' };

      return null;
    },
  },
];

/**
 * Extract raw material fields from document text.
 * @param {string} text - Extracted document text
 * @returns {{ extracted: Object, confidence: Object }}
 */
function extractRawMaterial(text) {
  if (!text || !text.trim()) return { extracted: {}, confidence: {} };

  const extracted = {};
  const confidence = {};

  for (const extractor of RAW_MATERIAL_EXTRACTORS) {
    const result = extractor.extract(text);
    if (result && result.value) {
      extracted[extractor.field] = result.value;
      confidence[extractor.field] = result.confidence;
    }
  }

  return { extracted, confidence };
}

module.exports = { extractRawMaterial };
