import { createScheduler, createWorker } from 'tesseract.js';
import {
  readPdfPages,
  pagesToText,
  isTextUsable,
  detectForm,
  extractFieldsPositional,
  extractFieldsByLabel,
  ocrToPage,
} from '@groove/extraction';
import { pdfjs } from './pdfjs.js';

// On-device document analysis, run in the browser BEFORE upload. Free and
// deterministic first; OCR only if the PDF has no text layer:
//
//   1. pdf.js text layer with positions
//   2. (no text) Tesseract.js OCR per page — words + boxes mapped into PDF points
//   3. form detection + positional field extraction (shared with the server)
//
// The result travels with the upload; the server only renders (and reaches
// for Sarvam solely when this produced nothing usable).

const OCR_SCALE = 3; // 216 DPI — Tesseract wants ~200+ DPI for 9pt form text
const OCR_MAX_PAGES = 10;
const OCR_LANG = 'eng';

// Two workers OCR pages side by side (a two-page scan takes ~half the time);
// one worker on low-core devices. The scheduler is shared by every file.
const OCR_WORKERS = Math.min(2, (navigator.hardwareConcurrency ?? 2) >= 4 ? 2 : 1);
const progressByJob = new Map(); // per-page progress feeding one overall %
let notifyProgress = null;

let schedulerPromise = null;
function getOcrScheduler() {
  if (!schedulerPromise) {
    schedulerPromise = (async () => {
      const scheduler = createScheduler();
      const logger = (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number' && m.jobId) {
          progressByJob.set(m.jobId, m.progress);
          notifyProgress?.();
        }
      };
      const workers = await Promise.all(Array.from({ length: OCR_WORKERS }, () => createWorker(OCR_LANG, 1, { logger })));
      workers.forEach((w) => scheduler.addWorker(w));
      return scheduler;
    })().catch((err) => {
      schedulerPromise = null;
      throw err;
    });
  }
  return schedulerPromise;
}

// Fetch the OCR engine (wasm + language data, ~5MB, cached after the first
// visit) while the user is still choosing files, so a scanned upload starts
// reading immediately instead of downloading first.
export function preloadOcr() {
  getOcrScheduler().catch(() => {});
}

async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

async function ocrPages(doc, onProgress) {
  const pageCount = Math.min(doc.numPages, OCR_MAX_PAGES);
  const scheduler = await getOcrScheduler();

  let done = 0;
  const report = () => {
    let inFlight = 0;
    for (const p of progressByJob.values()) inFlight += p;
    const overall = Math.min(1, (done + inFlight) / pageCount);
    onProgress?.({ phase: 'ocr', page: Math.min(done + 1, pageCount), pageCount, progress: overall });
  };
  notifyProgress = report;
  report();

  const ocrOnePage = async (i) => {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const canvas = await renderPageToCanvas(page, OCR_SCALE);
    const { data } = await scheduler.addJob('recognize', canvas, {}, { blocks: true });
    canvas.width = 0; // release memory
    canvas.height = 0;
    const words = [];
    const lines = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          lines.push({ text: line.text, confidence: line.confidence, bbox: line.bbox });
          for (const w of line.words) words.push({ text: w.text, confidence: w.confidence, bbox: w.bbox });
        }
      }
    }
    done += 1;
    report();
    return ocrToPage({
      index: i - 1,
      words,
      lines,
      imageWidth: Math.ceil(base.width * OCR_SCALE),
      imageHeight: Math.ceil(base.height * OCR_SCALE),
      pageWidth: base.width,
      pageHeight: base.height,
    });
  };

  try {
    // All pages queue at once; the scheduler spreads them over the workers.
    return await Promise.all(Array.from({ length: pageCount }, (_, idx) => ocrOnePage(idx + 1)));
  } finally {
    notifyProgress = null;
    progressByJob.clear();
  }
}

export async function analyzeFile(file, onProgress) {
  const started = Date.now();
  onProgress?.({ phase: 'reading' });
  const data = new Uint8Array(await file.arrayBuffer());

  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') return { version: 1, encrypted: true, textSource: 'none', sourceText: '', detected: null, values: null, meta: {}, notes: [] };
    throw err;
  }

  try {
    let pages = await readPdfPages(doc);
    let textSource = 'pdf-text';
    const notes = [];

    if (!isTextUsable(pagesToText(pages))) {
      // No text layer: OCR on this device before anything leaves the browser.
      onProgress?.({ phase: 'ocr', page: 1, pageCount: Math.min(doc.numPages, OCR_MAX_PAGES), progress: 0 });
      try {
        pages = await ocrPages(doc, onProgress);
        textSource = 'ocr-tesseract';
        if (doc.numPages > OCR_MAX_PAGES) notes.push(`Only the first ${OCR_MAX_PAGES} pages were OCR'd on-device`);
      } catch (err) {
        return { version: 1, encrypted: false, textSource: 'none', sourceText: '', detected: null, values: null, meta: {}, notes: [`On-device OCR failed: ${err.message}`] };
      }
    }

    const sourceText = pagesToText(pages);
    if (!isTextUsable(sourceText)) {
      return { version: 1, encrypted: false, textSource: 'none', sourceText: '', detected: null, values: null, meta: {}, notes: ['On-device OCR found no readable text'] };
    }

    onProgress?.({ phase: 'extracting' });
    const detected = detectForm(pages);
    let values = null;
    let meta = {};
    if (detected?.layoutMatch) {
      const read = detected.schema.strategy === 'label' ? extractFieldsByLabel : extractFieldsPositional;
      ({ values, meta } = read(detected.schema, pages, detected.formStartPage));
    }

    return {
      version: 1,
      encrypted: false,
      textSource,
      sourceText,
      pageCount: doc.numPages,
      detected: detected
        ? { schemaId: detected.schema.id, formStartPage: detected.formStartPage, layoutMatch: detected.layoutMatch, anchorsHit: detected.anchorsHit }
        : null,
      values,
      meta,
      notes,
      durationMs: Date.now() - started,
    };
  } finally {
    await doc.destroy();
  }
}
