import { Router } from 'express';
import fs from 'node:fs';

// Sample documents for people who arrive without any of their own. Served
// straight from the test fixtures (one source of truth), whitelisted by id,
// and cached hard so trying one feels instant.
const FIXTURE_DIR = new URL('../../test-fixtures/', import.meta.url).pathname;

const SAMPLES = {
  '1040': { file: 'f1040-filled-sample.pdf', type: 'application/pdf', name: 'Sample 1040 (digital).pdf' },
  '1040-scanned': { file: 'f1040-scanned-sample.pdf', type: 'application/pdf', name: 'Sample 1040 (scanned).pdf' },
  w2: { file: 'w2-sample.pdf', type: 'application/pdf', name: 'Sample W-2.pdf' },
  'w2-docx': {
    file: 'w2-sample.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    name: 'Sample W-2.docx',
  },
  '1099int': { file: 'f1099int-sample.pdf', type: 'application/pdf', name: 'Sample 1099-INT.pdf' },
};

const router = Router();

router.get('/:id', (req, res) => {
  const sample = SAMPLES[req.params.id];
  if (!sample) {
    res.status(404).json({ error: 'Unknown sample' });
    return;
  }
  const path = `${FIXTURE_DIR}${sample.file}`;
  if (!fs.existsSync(path)) {
    res.status(404).json({ error: 'Sample file missing on this server' });
    return;
  }
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Disposition', `inline; filename="${sample.name}"`);
  res.type(sample.type);
  res.sendFile(path);
});

export default router;
