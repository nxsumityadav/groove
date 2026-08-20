import { normalizeValue } from './positionalExtractor.js';

// Reads values by finding the label printed on the form and taking the text
// inside that label's box.
//
// Fixed coordinates work for IRS-issued forms like the 1040, where every copy
// is the same artwork. W-2s and 1099s are produced by hundreds of payroll
// vendors with different geometry, but the *box labels* are prescribed
// ("1 Wages, tips, other compensation"). So we anchor on the label text and
// infer the box from its neighbours: the value lies below the label, above
// whatever label comes next down the page, and left of the next label across.

// Name and address boxes are tall, so the gap allowance is generous; the
// "next label below" boundary is what actually stops one box bleeding into
// the next.
const MAX_VALUE_GAP = 60;
const DEFAULT_BOX_WIDTH = 210;
const SAME_ROW_TOLERANCE = 6;

export function normalizeLabel(s) {
  return String(s ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function anchorsOf(field) {
  return (field.anchors ?? [field.label]).map(normalizeLabel);
}

// Every item that reads as one of the form's printed labels. These double as
// the boundaries of each box.
function findLabelItems(page, schema) {
  const all = schema.fields.flatMap(anchorsOf);
  return page.items.filter((it) => {
    const t = normalizeLabel(it.str);
    return t.length > 2 && all.some((a) => t.includes(a));
  });
}

function findAnchor(page, field) {
  const wanted = anchorsOf(field);
  // The printed box label usually starts with its box number ("1 Interest
  // income"). Prefer that over incidental matches like the form's title
  // ("Interest Income"), which would otherwise anchor box 1 to the header.
  const lined = field.line ? wanted.map((a) => `${String(field.line).toLowerCase()} ${a}`) : [];
  let best = null;
  let bestScore = -1;
  for (const it of page.items) {
    const t = normalizeLabel(it.str);
    let score = -1;
    if (lined.some((a) => t.startsWith(a))) score = 3;
    else if (wanted.some((a) => t.startsWith(a))) score = 2;
    else if (wanted.some((a) => t.includes(a))) score = 1;
    if (score < 0) continue;
    // Same score: prefer the tighter text, so "state wages" doesn't win over "wages".
    if (score > bestScore || (score === bestScore && t.length < normalizeLabel(best.str).length)) {
      best = it;
      bestScore = score;
    }
  }
  return best;
}

export function extractFieldsByLabel(schema, pages, formStartPage = 0) {
  const values = {};
  const meta = {};
  const searchPages = pages.slice(formStartPage);

  for (const field of schema.fields) {
    let found = null;

    for (const page of searchPages) {
      const anchor = findAnchor(page, field);
      if (!anchor) continue;

      const labels = findLabelItems(page, schema);
      const anchorLabel = normalizeLabel(anchor.str);

      // Right edge: the next label starting on the same line.
      const rightNeighbour = labels
        .filter((l) => l.x > anchor.x + 4 && Math.abs(l.y - anchor.y) <= SAME_ROW_TOLERANCE)
        .sort((a, b) => a.x - b.x)[0];
      const right = rightNeighbour ? rightNeighbour.x - 2 : anchor.x + (field.boxWidth ?? DEFAULT_BOX_WIDTH);

      // Bottom edge: the next label below that starts within this box.
      const below = labels
        .filter((l) => l.y < anchor.y - 2 && l.x >= anchor.x - 8 && l.x < right && normalizeLabel(l.str) !== anchorLabel)
        .sort((a, b) => b.y - a.y)[0];
      const bottom = Math.max(anchor.y - MAX_VALUE_GAP, below ? below.y + 4 : -Infinity);

      const hits = page.items
        .filter((it) => {
          if (it === anchor) return false;
          if (it.y >= anchor.y - 2 || it.y < bottom) return false;
          if (it.x < anchor.x - 8 || it.x >= right) return false;
          // Never let one label be read as another's value.
          return !labels.includes(it);
        })
        .sort((a, b) => b.y - a.y || a.x - b.x);

      if (hits.length === 0) {
        found = { value: '', confidence: null };
        break;
      }

      // By default only the first printed line: in most boxes anything below
      // it is overflow belonging to another field. Fields whose box really
      // holds several lines (a combined name-and-address box) set
      // `multiline: true` in the schema and get every line, joined with ", ".
      const topY = hits[0].y;
      const take = field.multiline ? hits : hits.filter((h) => Math.abs(h.y - topY) <= 3);

      const rows = [];
      for (const h of take) {
        const row = rows.find((r) => Math.abs(r.y - h.y) <= 3);
        if (row) row.items.push(h);
        else rows.push({ y: h.y, items: [h] });
      }
      rows.sort((a, b) => b.y - a.y);
      const raw = rows
        .map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(field.multiline ? ', ' : ' ');
      const confs = take.map((h) => h.confidence).filter((c) => typeof c === 'number');

      // Remember where the value was found so the UI can point at it on the
      // page — these forms have no fixed coordinates to fall back on.
      const heights = take.map((h) => h.h || 10);
      const box = {
        x1: Math.min(...take.map((h) => h.x)) - 2,
        y1: Math.min(...take.map((h) => h.y)) - 3,
        x2: Math.max(...take.map((h) => h.x + (h.w || 0))) + 2,
        y2: topY + Math.max(...heights) + 1,
      };
      found = {
        value: raw,
        confidence: confs.length ? Math.min(...confs) : null,
        box,
        page: page.index - formStartPage,
      };
      break;
    }

    if (found) {
      values[field.key] = found.value ? normalizeValue(found.value, field.type) : '';
      const m = {};
      if (found.confidence !== null) m.ocrConfidence = found.confidence;
      if (found.box) {
        m.box = found.box;
        m.page = found.page;
      }
      if (Object.keys(m).length) meta[field.key] = m;
    }
  }

  return { values, meta };
}
