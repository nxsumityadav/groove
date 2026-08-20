import f1040 from './f1040-2025.js';
import w2 from './w2.js';
import f1099int from './f1099int.js';

// Registry of forms we can detect, extract positionally, and re-render.
// Adding a form = adding a schema file with field boxes (+ a template PDF on
// the server for rendering).
const SCHEMAS = [f1040, w2, f1099int];

export function getFormSchemas() {
  return SCHEMAS;
}

export function getFormSchema(id) {
  return SCHEMAS.find((s) => s.id === id) ?? null;
}

// The subset of a schema the client UI needs.
export function publicSchema(schema) {
  if (!schema) return null;
  return {
    id: schema.id,
    name: schema.name,
    title: schema.title,
    jurisdiction: schema.jurisdiction,
    year: schema.year,
    pageSize: schema.pageSize,
    pageCount: schema.pageCount,
    sections: schema.sections,
    strategy: schema.strategy ?? 'positional',
    tables: schema.tables ?? [],
    fields: schema.fields.map(({ key, label, section, line, type, page, box }) => ({ key, label, section, line, type, page: page ?? null, box: box ?? null })),
  };
}
