/**
 * Image Preprocessor Module
 *
 * Enhances images for better OCR accuracy using sharp:
 * - Grayscale conversion
 * - Contrast normalization
 * - Sharpening
 * - Resolution normalization
 *
 * Also handles PDF-to-image conversion for scanned PDFs
 * using sharp's libvips PDF rendering (if available).
 */

const sharp = require('sharp');

const TARGET_WIDTH = 2400; // ~300 DPI for A4-sized drawings

/**
 * Preprocess an image for OCR.
 * @param {string|Buffer} input - File path or Buffer
 * @returns {Promise<Buffer>} - Processed PNG buffer
 */
async function preprocessImage(input) {
  return sharp(input)
    .greyscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * Try to convert the first page of a PDF to an image buffer.
 * Uses sharp's libvips backend which supports PDF if built with pdfium/poppler.
 * Returns null if the PDF cannot be rendered (unsupported on this platform).
 *
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {Promise<Buffer|null>} - Raw image buffer or null
 */
async function pdfToImage(pdfPath) {
  try {
    const buffer = await sharp(pdfPath, {
      page: 0,
      density: 300, // render at 300 DPI for good OCR quality
    })
      .png()
      .toBuffer();
    return buffer;
  } catch (err) {
    // sharp/libvips may not support PDF rendering on all platforms
    console.warn('PDF-to-image conversion not available:', err.message);
    return null;
  }
}

/**
 * Get basic metadata about an image file.
 * @param {string|Buffer} input - File path or Buffer
 * @returns {Promise<{width: number, height: number, format: string}|null>}
 */
async function getImageInfo(input) {
  try {
    const meta = await sharp(input).metadata();
    return { width: meta.width, height: meta.height, format: meta.format };
  } catch {
    return null;
  }
}

module.exports = { preprocessImage, pdfToImage, getImageInfo };
