// Turns a processed document into something a tax preparer can hand to
// downstream software: JSON for an integration, CSV for a spreadsheet.
//
// Every row carries where the value came from and how much we trust it, so
// the receiving side can triage rather than importing blind.

export function buildRows(record, schema) {
  const fields = record.result?.fields ?? {};

  if (schema) {
    return schema.fields.map((f) => {
      const e = fields[f.key] ?? {};
      return {
        key: f.key,
        line: f.line ?? '',
        section: f.section,
        label: f.label,
        type: f.type,
        value: e.value ?? '',
        confidence: e.confidence ?? 'low',
        source: e.source ?? 'none',
        edited: Boolean(e.edited),
        warnings: e.warnings ?? [],
        page: f.page,
        box: f.box,
      };
    });
  }

  // Unknown form: free-form label/value pairs, no field map to anchor to.
  return Object.entries(fields).map(([key, e]) => ({
    key,
    line: '',
    section: 'Extracted fields',
    label: e.label ?? key,
    type: 'text',
    value: e.value ?? '',
    confidence: e.confidence ?? 'low',
    source: e.source ?? 'none',
    edited: Boolean(e.edited),
    warnings: e.warnings ?? [],
    page: null,
    box: null,
  }));
}

export function buildDocumentExport(record, schema) {
  const r = record.result ?? {};
  return {
    document: {
      id: record.id,
      fileName: record.originalName,
      formType: r.formType ?? 'Unknown',
      formSchemaId: r.formSchemaId ?? null,
      formYear: schema?.year ?? null,
      extractionMethod: r.extractionMethod ?? null,
      textSource: r.textSource ?? null,
      layoutMatch: Boolean(r.layoutMatch),
      approved: Boolean(r.approved),
      extractedAt: r.extractedAt ?? null,
      updatedAt: r.updatedAt ?? null,
      notes: r.warnings ?? [],
    },
    fields: buildRows(record, schema),
  };
}

export function buildSessionExport(documents) {
  return {
    exportedAt: Date.now(),
    documentCount: documents.length,
    documents,
  };
}

const CSV_COLUMNS = [
  ['fileName', (r, doc) => doc.fileName],
  ['formType', (r, doc) => doc.formType],
  ['line', (r) => r.line],
  ['section', (r) => r.section],
  ['fieldKey', (r) => r.key],
  ['label', (r) => r.label],
  ['value', (r) => r.value],
  ['confidence', (r) => r.confidence],
  ['source', (r) => r.source],
  ['editedByUser', (r) => (r.edited ? 'yes' : 'no')],
  ['needsReview', (r) => (r.warnings.length ? 'yes' : 'no')],
  ['notes', (r) => r.warnings.join('; ')],
];

function csvCell(value) {
  const s = value == null ? '' : String(value);
  // Quote when the value could otherwise break the row, and guard against
  // spreadsheet formula injection from document content.
  const needsQuote = /[",\n\r]/.test(s);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return needsQuote || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(documentExports) {
  const lines = [CSV_COLUMNS.map(([name]) => name).join(',')];
  for (const dx of documentExports) {
    for (const row of dx.fields) {
      lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(row, dx.document))).join(','));
    }
  }
  return lines.join('\r\n');
}

// A filename that survives a Content-Disposition header intact.
export function safeFilename(name, ext) {
  const base = String(name ?? 'export')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'export'}.${ext}`;
}
