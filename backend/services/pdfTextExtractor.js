import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readPdfPages, pagesToText } from '@groove/extraction';

// Server-side fallback reader (the browser normally does this before
// uploading). Reads the PDF's own text layer with pdf.js — no AI, no OCR.
export async function extractPdfPages(buffer) {
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let doc;
  try {
    doc = await pdfjsLib.getDocument({
      data,
      verbosity: 0,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      return { encrypted: true, pages: [], text: '' };
    }
    throw err;
  }
  try {
    const pages = await readPdfPages(doc);
    return { encrypted: false, pages, text: pagesToText(pages) };
  } finally {
    await doc.destroy();
  }
}

export { isTextUsable } from '@groove/extraction';
