// Reads positioned text items from an already-opened pdf.js document. Works
// with both the browser build (client) and the legacy build (Node server) —
// the caller does getDocument(), we do the rest.
export async function readPdfPages(doc) {
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: it.height,
      }));
    pages.push({
      index: i - 1,
      source: 'text-layer',
      width: viewport.width,
      height: viewport.height,
      items,
      text: itemsToText(items),
    });
  }
  return pages;
}

// Reconstructs reading-order text from positioned items: group into rows by
// baseline, top-to-bottom, left-to-right.
export function itemsToText(items) {
  const rows = new Map();
  for (const it of items) {
    const key = Math.round(it.y / 3) * 3;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(it);
  }
  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim())
    .join('\n');
}

export const DEFAULT_MIN_USABLE_TEXT = 50;

export function isTextUsable(text, min = DEFAULT_MIN_USABLE_TEXT) {
  return String(text ?? '').trim().length >= min;
}

export function pagesToText(pages) {
  return pages.map((p) => p.text).join('\n\n');
}

// Converts an OCR result for one page (Tesseract.js style: words and lines
// with pixel bboxes, origin top-left) into a page of items in PDF points
// (origin bottom-left) so the same detector/extractor can run on it.
//   words: [{ text, confidence, bbox: {x0,y0,x1,y1} }]
//   lines: [{ text, confidence, bbox }]
export function ocrToPage({ index, words, lines, imageWidth, imageHeight, pageWidth, pageHeight }) {
  const sx = pageWidth / imageWidth;
  const sy = pageHeight / imageHeight;
  const toItem = (w) => ({
    str: w.text,
    // x = left edge, y = vertical centre (robust to baseline/descender noise)
    x: w.bbox.x0 * sx,
    y: pageHeight - ((w.bbox.y0 + w.bbox.y1) / 2) * sy,
    w: (w.bbox.x1 - w.bbox.x0) * sx,
    h: (w.bbox.y1 - w.bbox.y0) * sy,
    confidence: w.confidence,
  });
  const items = words.filter((w) => w.text && w.text.trim() !== '').map(toItem);
  const lineItems = lines.filter((l) => l.text && l.text.trim() !== '').map(toItem);
  return {
    index,
    source: 'ocr',
    width: pageWidth,
    height: pageHeight,
    items,
    lines: lineItems,
    text: lineItems.map((l) => l.str.trim()).join('\n'),
  };
}
