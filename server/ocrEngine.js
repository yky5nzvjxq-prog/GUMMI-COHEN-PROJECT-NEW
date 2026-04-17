/**
 * OCR Engine Module
 *
 * Manages a persistent tesseract.js worker for text recognition.
 * Uses a lazy singleton pattern to avoid the 3-5s cold-start on every request.
 *
 * Requirements:
 * - tesseract.js v5+
 * - eng.traineddata (auto-downloaded on first use)
 */

const { createWorker } = require('tesseract.js');

let worker = null;
let initializing = false;
let initPromise = null;

const OCR_TIMEOUT_MS = 60000; // 60 seconds max per recognition

/**
 * Initialize the OCR worker (lazy singleton).
 * Safe to call multiple times — only creates one worker.
 * @returns {Promise<void>}
 */
async function initOCR() {
  if (worker) return;
  if (initPromise) return initPromise;

  initializing = true;
  initPromise = (async () => {
    try {
      console.log('[OCR] Initializing tesseract.js worker...');
      worker = await createWorker('eng', 1, {
        // PSM 6 = Assume a single uniform block of text
        // Good default for engineering drawings with mixed content
      });
      console.log('[OCR] Worker ready.');
    } catch (err) {
      console.error('[OCR] Failed to initialize worker:', err.message);
      worker = null;
      throw err;
    } finally {
      initializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Recognize text from an image buffer.
 * @param {Buffer} imageBuffer - Preprocessed image as PNG buffer
 * @returns {Promise<{text: string, confidence: number}>}
 *   confidence is 0-1 scale (tesseract returns 0-100, we normalize)
 */
async function recognizeImage(imageBuffer) {
  await initOCR();

  if (!worker) {
    throw new Error('OCR worker not available');
  }

  // Race between recognition and timeout
  const result = await Promise.race([
    worker.recognize(imageBuffer),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR timeout — processing took too long')), OCR_TIMEOUT_MS)
    ),
  ]);

  const text = result.data.text || '';
  const confidence = (result.data.confidence || 0) / 100; // normalize to 0-1

  return { text, confidence };
}

/**
 * Terminate the OCR worker for graceful shutdown.
 * @returns {Promise<void>}
 */
async function terminateOCR() {
  if (worker) {
    try {
      await worker.terminate();
      console.log('[OCR] Worker terminated.');
    } catch (err) {
      console.warn('[OCR] Error terminating worker:', err.message);
    }
    worker = null;
  }
}

module.exports = { initOCR, recognizeImage, terminateOCR };
