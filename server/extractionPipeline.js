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

module.exports = { extractDocumentDataFull };
