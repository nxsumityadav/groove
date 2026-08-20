import fs from 'node:fs';
import { getFormSchema } from '../forms/index.js';
import { scoreField, normalizeValue } from '@groove/extraction';
import { getFileRecord, updateFileRecord } from './sessionStore.js';

// Turns raw {key: value} maps (from positional/LLM extraction) into scored
// field entries: { value, source, confidence, warnings, edited }.
// `meta[key]` may carry extras such as { ocrConfidence }.
export function buildSchemaFields(schema, values, sourceByKey, sourceText, meta = {}) {
  const fields = {};
  for (const f of schema.fields) {
    const has = Object.prototype.hasOwnProperty.call(values, f.key);
    const value = has ? normalizeValue(values[f.key], f.type) : '';
    const source = has ? sourceByKey[f.key] : 'none';
    const { confidence, warnings } = has
      ? scoreField({ value, type: f.type, source, sourceText, ocrConfidence: meta[f.key]?.ocrConfidence })
      : { confidence: 'low', warnings: [] };
    fields[f.key] = { value, source, confidence, warnings, edited: false };
    // On label-anchored forms, a key with no reading means the printed box
    // wasn't found on this copy at all (many vendors omit the state/local
    // block). That's not an extraction failure, so mark it for the UI to
    // set aside rather than flag.
    if (!has && schema.strategy === 'label') fields[f.key].notOnForm = true;
    // Label-anchored forms have no fixed coordinates, so extraction reports
    // where it actually found the value.
    if (meta[f.key]?.box) {
      fields[f.key].box = meta[f.key].box;
      fields[f.key].page = meta[f.key].page ?? 0;
    }
  }
  return fields;
}

export function buildGenericFields(labelValues, sourceText) {
  const fields = {};
  for (const [label, raw] of Object.entries(labelValues)) {
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
    const value = String(raw ?? '').trim();
    const { confidence, warnings } = scoreField({ value, type: 'text', source: 'llm', sourceText });
    fields[key] = { label, value, source: 'llm', confidence, warnings, edited: false };
  }
  return fields;
}

export async function applyFieldEdit(sessionId, fileId, key, rawValue) {
  const record = getFileRecord(sessionId, fileId);
  if (!record?.result) return null;
  const schema = record.result.formSchemaId ? getFormSchema(record.result.formSchemaId) : null;
  const def = schema?.fields.find((f) => f.key === key);
  const existing = record.result.fields[key];
  if (schema && !def) return null;
  if (!schema && !existing) return null;

  const type = def?.type ?? 'text';
  const value = normalizeValue(rawValue ?? '', type);
  const { confidence, warnings } = scoreField({ value, type, source: 'user', sourceText: '' });
  const fields = {
    ...record.result.fields,
    [key]: { ...(existing ?? {}), value, source: 'user', confidence, warnings, edited: true },
  };
  updateFileRecord(sessionId, fileId, { result: { ...record.result, fields, updatedAt: Date.now() } });
  return getFileRecord(sessionId, fileId);
}

export function approveRecord(sessionId, fileId) {
  const record = getFileRecord(sessionId, fileId);
  if (!record?.result) return null;
  updateFileRecord(sessionId, fileId, { result: { ...record.result, approved: true, updatedAt: Date.now() } });
  return getFileRecord(sessionId, fileId);
}
