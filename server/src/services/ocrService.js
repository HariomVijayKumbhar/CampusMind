// OCR Service - Extract text from PNG, JPG, JPEG, WEBP and scanned files using Tesseract.js

const Tesseract = require('tesseract.js');

/**
 * Perform OCR on an image buffer (PNG, JPG, JPEG, WEBP)
 * @param {Buffer} imageBuffer
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromImage(imageBuffer) {
  try {
    console.log('[OCR] Processing image with Tesseract.js OCR engine...');
    const result = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    const text = result?.data?.text?.trim() || '';
    console.log(`[OCR] Successfully extracted ${text.length} characters.`);
    return text;
  } catch (error) {
    console.error('[OCR] Image recognition error:', error);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

module.exports = {
  extractTextFromImage,
};
