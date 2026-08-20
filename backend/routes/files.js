import { Router } from 'express';
import { getFileRecord } from '../pipeline/sessionStore.js';
import { applyFieldEdit, approveRecord } from '../pipeline/populate.js';
import { getFormSchema, publicSchema } from '../forms/index.js';
import { buildDocumentExport, toCsv, safeFilename } from '../services/exporter.js';

const router = Router();

// All routes are scoped to the requesting session: a fileId from another
// session is simply not found.
function loadRecord(req, res) {
  const record = getFileRecord(req.sessionID, req.params.fileId);
  if (!record) res.status(404).json({ error: 'File not found' });
  return record;
}

function publicFile(record) {
  return { id: record.id, name: record.originalName, status: record.status, stage: record.stage, error: record.error };
}

// Original upload — for the "source" pane.
router.get('/:fileId/raw', (req, res) => {
  const record = loadRecord(req, res);
  if (!record) return;
  const ext = record.storedPath.split('.').pop().toLowerCase();
  res.type(ext === 'pdf' ? 'application/pdf' : ext === 'txt' ? 'text/plain' : 'application/octet-stream');
  res.sendFile(record.storedPath);
});

// Structured result + the schema needed to render/edit it.
router.get('/:fileId/result', (req, res) => {
  const record = loadRecord(req, res);
  if (!record) return;
  const schema = record.result?.formSchemaId ? getFormSchema(record.result.formSchemaId) : null;
  res.json({
    file: publicFile(record),
    result: record.result ?? null,
    schema: publicSchema(schema),
  });
});

// Hand-off to downstream tax software: one document, machine-readable.
router.get('/:fileId/export.json', (req, res) => {
  const record = loadRecord(req, res);
  if (!record) return;
  if (!record.result) {
    res.status(409).json({ error: 'This document is still being processed' });
    return;
  }
  const schema = record.result.formSchemaId ? getFormSchema(record.result.formSchemaId) : null;
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(record.originalName, 'json')}"`);
  res.type('application/json').send(JSON.stringify(buildDocumentExport(record, schema), null, 2));
});

router.get('/:fileId/export.csv', (req, res) => {
  const record = loadRecord(req, res);
  if (!record) return;
  if (!record.result) {
    res.status(409).json({ error: 'This document is still being processed' });
    return;
  }
  const schema = record.result.formSchemaId ? getFormSchema(record.result.formSchemaId) : null;
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(record.originalName, 'csv')}"`);
  res.type('text/csv').send(toCsv([buildDocumentExport(record, schema)]));
});

router.patch('/:fileId/fields', async (req, res) => {
  const record = loadRecord(req, res);
  if (!record) return;
  const { key, value } = req.body ?? {};
  if (typeof key !== 'string' || key === '') {
    res.status(400).json({ error: 'key is required' });
    return;
  }
  const updated = await applyFieldEdit(req.sessionID, record.id, key, value);
  if (!updated) {
    res.status(400).json({ error: `Unknown field "${key}"` });
    return;
  }
  res.json({ fields: updated.result.fields, updatedAt: updated.result.updatedAt });
});

router.post('/:fileId/approve', (req, res) => {
  const record = loadRecord(req, res);
  if (!record) return;
  const updated = approveRecord(req.sessionID, record.id);
  if (!updated) {
    res.status(400).json({ error: 'Nothing to approve yet' });
    return;
  }
  res.json({ approved: true });
});

export default router;
