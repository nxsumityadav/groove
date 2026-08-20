import { getFormSchemas } from './forms/index.js';

// Identifies which known form (if any) a document is, and on which PDF page
// the form starts (uploads may have cover pages ahead of the form itself).
//
// Two-level result:
//   - text match: one of the form's signature phrase sets appears -> we know
//     the form type
//   - layout match: enough label anchors sit at their expected coordinates ->
//     we can trust the field boxes for positional extraction
//
// `pages` come from readPdfPages() (text layer) or from OCR (word items +
// line items in PDF coordinates). Pages flagged `source: 'ocr'` are matched
// with a looser tolerance and by "line contains label" instead of "starts with".
export function detectForm(pages) {
  for (const schema of getFormSchemas()) {
    const formStartPage = pages.findIndex((p) => matchesSignature(p.text, schema));
    if (formStartPage === -1) continue;

    // Label-anchored forms have no fixed artwork to match against — knowing
    // the form and having positioned text is enough to read them.
    if (schema.strategy === 'label') {
      return { schema, formStartPage, anchorsHit: 0, layoutMatch: true };
    }

    const anchorsHit = countAnchors(pages, formStartPage, schema);
    return {
      schema,
      formStartPage,
      anchorsHit,
      layoutMatch: anchorsHit >= schema.detect.minAnchors,
    };
  }
  return null;
}

// Text-only detection for content without positions: we can name the form,
// but not trust any field boxes.
export function detectFormByText(text) {
  const schema = getFormSchemas().find((s) => matchesSignature(text, s));
  return schema ? { schema, formStartPage: 0, anchorsHit: 0, layoutMatch: false } : null;
}

function matchesSignature(text, schema) {
  const hay = text.toLowerCase();
  return schema.detect.signatures.some((phrases) => phrases.every((p) => hay.includes(p.toLowerCase())));
}

function countAnchors(pages, formStartPage, schema) {
  let hits = 0;
  for (const anchor of schema.detect.anchors ?? []) {
    const page = pages[formStartPage + anchor.page];
    if (!page) continue;
    const ocr = page.source === 'ocr';
    const tol = ocr ? schema.detect.ocrTolerance ?? schema.detect.tolerance * 2 : schema.detect.tolerance;
    const candidates = page.lines ?? page.items;
    const needle = anchor.text.toLowerCase();
    const found = candidates.some((it) => {
      const s = it.str.toLowerCase();
      if (ocr ? !s.includes(needle) : !s.startsWith(needle)) return false;
      // OCR lines can carry a leading line number ("1a Total amount…"), so
      // allow the line to start somewhat left of the label.
      const dx = it.x - anchor.x;
      const xOk = ocr ? dx <= tol && dx >= -70 : Math.abs(dx) <= tol;
      return xOk && Math.abs(it.y - anchor.y) <= tol;
    });
    if (found) hits++;
  }
  return hits;
}
