// Confidence is not the model's self-report. It combines how the value was
// obtained with checks we can actually run:
//   - positional (read from the text layer at the field's location): high,
//     unless the value fails its type check
//   - positional-ocr (read by location from on-device OCR): medium; low if
//     the OCR engine's own word confidence was poor or the type check fails
//   - llm: medium if the value can be found verbatim in the source text
//     (i.e. it wasn't hallucinated), otherwise low
//   - user edits: high

const MONEY_RE = /^-?\(?\$?[\d,]*(\.\d{1,2})?\)?$/;
const SSN_RE = /^\d{3}-?\d{2}-?\d{4}$/;
const OCR_MIN_WORD_CONFIDENCE = 70;

export function validateType(value, type) {
  const v = String(value ?? '').trim();
  if (v === '') return true;
  if (type === 'money') return MONEY_RE.test(v) && /\d/.test(v);
  if (type === 'ssn') return SSN_RE.test(v);
  if (type === 'checkbox') return v === 'true' || v === 'false';
  return true;
}

// Light normalisation that keeps token boundaries: "$15,750" -> "15750",
// "123-45-6789" -> "123456789", runs of whitespace -> one space.
function normalizeForMatch(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[,$–—-]/g, '')
    .replace(/\.(?=\D|$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// True if the value appears in the source as a whole token (so "1750" does
// not count as present just because "15750" is).
export function verifyInSource(value, sourceText) {
  const needle = normalizeForMatch(value);
  if (needle.length < 2) return false;
  const hay = normalizeForMatch(sourceText);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(hay);
}

// Plain-language names for the field types, for messages people read.
const TYPE_LABEL = {
  money: 'a dollar amount',
  ssn: 'a Social Security number',
  checkbox: 'a yes or no answer',
  text: 'valid text',
};

export function scoreField({ value, type, source, sourceText, ocrConfidence }) {
  const warnings = [];
  const value_ = String(value ?? '').trim();

  if (!validateType(value_, type)) {
    warnings.push(`This doesn’t look like ${TYPE_LABEL[type] ?? 'the right kind of value'}.`);
  }

  let confidence;
  if (source === 'user') {
    confidence = 'high';
  } else if (source === 'positional' || source === 'label') {
    // Read directly off the page — either at a fixed box or beside its
    // printed label. Both are the document's own text, not a guess.
    confidence = warnings.length ? 'low' : 'high';
  } else if (source === 'positional-ocr' || source === 'label-ocr') {
    if (typeof ocrConfidence === 'number' && ocrConfidence < OCR_MIN_WORD_CONFIDENCE && value_ !== '') {
      warnings.push('This was faint or blurry in your document, so we may have misread it.');
    }
    confidence = warnings.length ? 'low' : 'medium';
  } else if (source === 'llm') {
    if (type === 'checkbox') {
      // A model's guess about a tick box can't be checked against the text.
      warnings.push('We inferred this answer rather than reading it directly — please confirm it.');
      confidence = 'low';
    } else {
      const verified = value_ === '' || verifyInSource(value_, sourceText);
      if (!verified) warnings.push('We couldn’t find this exact value in your document.');
      confidence = warnings.length ? 'low' : 'medium';
    }
  } else {
    confidence = 'low';
  }

  return { confidence, warnings };
}
