// Pulls field values straight out of positioned text items by location,
// using the boxes in the form schema. Deterministic and free — no model
// calls. Works on text-layer items (pdf.js) and on OCR word items that have
// been mapped into PDF coordinates.
export function extractFieldsPositional(schema, pages, formStartPage) {
  const values = {};
  const meta = {}; // per-key extras, e.g. OCR confidence
  for (const f of schema.fields) {
    const page = pages[formStartPage + f.page];
    if (!page) continue;
    const ocr = page.source === 'ocr';
    const hits = page.items.filter((it) => inBox(it, f.box, ocr)).sort((a, b) => a.x - b.x);

    if (f.type === 'checkbox') {
      // Layout matched, so an empty box is a genuine "unchecked".
      values[f.key] = hits.some((h) => isTickGlyph(h.str, ocr)) ? 'true' : 'false';
      continue;
    }

    // Layout matched, so an empty box is a confident "blank" — record it as
    // '' rather than omitting the key (which would read as "unknown").
    let raw = hits.map((h) => h.str).join(' ').replace(/\s+/g, ' ').trim();
    if (ocr && looksLikeOcrJunk(raw)) raw = '';
    values[f.key] = raw ? normalizeValue(raw, f.type) : '';
    if (hits.length && hits.some((h) => typeof h.confidence === 'number')) {
      const confs = hits.map((h) => h.confidence).filter((c) => typeof c === 'number');
      meta[f.key] = { ocrConfidence: Math.min(...confs) };
    }
  }
  return { values, meta };
}

// Text-layer items are anchored at their baseline; OCR items at their
// vertical centre. The printed label of the *next* row sits ~4pt below a
// value box, so for OCR we pull the bottom edge up a little rather than
// adding slack — a value's centre is ~6pt above the bottom, a label's ~1.5.
function inBox(item, box, ocr) {
  if (ocr) {
    return item.x >= box.x1 - 1 && item.x <= box.x2 + 3 && item.y >= box.y1 + 2 && item.y <= box.y2 && item.h <= (box.y2 - box.y1) * 1.6;
  }
  return item.x >= box.x1 - 1 && item.x <= box.x2 && item.y >= box.y1 && item.y <= box.y2;
}

// A text layer places a real "X" (or a ZapfDingbats check) in a ticked box.
// OCR renders a ticked box as "(X|", "[X]", "x"… and an EMPTY box as "[]",
// "[C]", "[J", "O" — so strip the box furniture and require a tick glyph.
function isTickGlyph(s, ocr) {
  const t = s.trim();
  if (!ocr) return t !== '' && (/^[xX✓✔■●•4]$/.test(t) || t.length <= 2);
  // The box's right edge is often read as "|", "I", "l" or "1" glued to the tick.
  const core = t.replace(/[[\]()|{}<>_\-.,'"`\s]/g, '');
  return /^[xX✓✔■●•][iIl1]?$/.test(core);
}

// OCR of empty comb boxes and rules produces box furniture, not data:
// "| | | i i i | |", "[ ]", "0 0]". Two signatures, both safe against real
// values (which mix characters and rarely carry brackets/pipes):
//   a) fewer than 60% of the non-space characters are letters/digits
//   b) furniture punctuation present AND every letter/digit is the same one
const FURNITURE = /[[\]|{}()_]/;

function looksLikeOcrJunk(s) {
  const chars = s.replace(/\s/g, '');
  if (chars.length === 0) return true;
  const alnum = chars.match(/[a-z0-9]/gi) || [];
  if (alnum.length / chars.length < 0.6) return true;
  return FURNITURE.test(chars) && alnum.every((c) => c.toLowerCase() === alnum[0].toLowerCase());
}

export function normalizeValue(raw, type) {
  const s = String(raw).trim();
  if (type === 'money') {
    // OCR sometimes reads "85,000" as "85.000" or "85 000"; digits with a
    // period followed by exactly three digits are thousands, not cents.
    return s
      .replace(/[$\s]/g, '')
      .replace(/^(\d{1,3})\.(\d{3})(?!\d)/, '$1,$2')
      .replace(/[^\d.,()-]/g, '');
  }
  if (type === 'ssn') {
    const digits = s.replace(/[^\d]/g, '');
    if (digits.length === 9) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    return s;
  }
  if (type === 'checkbox') {
    return /^(true|yes|x|✓|✔|1)$/i.test(s) ? 'true' : /^(false|no|0|)$/i.test(s) ? 'false' : s;
  }
  return s;
}
