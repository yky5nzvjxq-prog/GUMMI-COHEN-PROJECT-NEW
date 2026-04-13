/**
 * Dimension Extractor Module
 *
 * Returns an empty array — the user must enter dimensions manually
 * or confirm any extracted data.
 *
 * Integration point for future OCR / AI extraction:
 * - Anthropic Claude Vision API for drawing analysis
 * - Tesseract OCR for text extraction from scanned drawings
 *
 * When integrated, extracted dimensions should be returned with
 * flaggedForReview: true so the user can verify before use.
 */

function extractDimensions(fileName) {
  // No mock data — return empty array
  // User must enter dimensions manually per the data integrity rules
  return [];
}

module.exports = { extractDimensions };
