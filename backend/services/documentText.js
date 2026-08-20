import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { extractPdfPages } from './pdfTextExtractor.js';

// One place that turns any accepted upload into text.
//
//   .pdf   pdf.js text layer, WITH positions (enables positional/label reads)
//   .docx  mammoth — a .docx is zipped XML, the text is just sitting there;
//          OCR would be absurd for it. No positions, so extraction goes
//          text → detect-by-signature → LLM schema fill.
//   .txt   read as-is.
//
// Only PDFs can be scans, so only PDFs ever continue to the OCR fallback.
export async function getDocumentText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return { kind: 'docx', pages: null, text: value ?? '', encrypted: false };
  }

  if (ext === '.txt') {
    return { kind: 'txt', pages: null, text: fs.readFileSync(filePath, 'utf8'), encrypted: false };
  }

  const { encrypted, pages, text } = await extractPdfPages(fs.readFileSync(filePath));
  return { kind: 'pdf', pages, text, encrypted };
}
