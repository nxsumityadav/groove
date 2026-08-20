import { Router } from 'express';
import { getFileRecords } from '../pipeline/sessionStore.js';
import { computeAggregate, buildStepList, mergeResults } from '../pipeline/aggregateResults.js';
import { getFormSchema } from '../forms/index.js';
import { buildDocumentExport, buildSessionExport, toCsv } from '../services/exporter.js';

const router = Router();

// Every processed document in this session, ready for downstream software.
function sessionExports(sessionId) {
  return getFileRecords(sessionId)
    .filter((f) => f.status === 'ready' && f.result)
    .map((f) => buildDocumentExport(f, f.result.formSchemaId ? getFormSchema(f.result.formSchemaId) : null));
}

router.get('/status', (req, res) => {
  const files = getFileRecords(req.sessionID);
  const aggregate = computeAggregate(files);

  res.json({
    files: files.map((f) => ({
      id: f.id,
      name: f.originalName,
      status: f.status,
      stage: f.stage,
      error: f.error,
    })),
    aggregate: {
      step: aggregate.step,
      steps: buildStepList(aggregate.step, aggregate.allDone, aggregate.stalled),
      allDone: aggregate.allDone,
      resultsReady: aggregate.resultsReady,
      hasError: aggregate.hasError,
      stalled: aggregate.stalled,
    },
  });
});

router.get('/results', (req, res) => {
  const files = getFileRecords(req.sessionID);
  res.json({ results: mergeResults(files) });
});

router.get('/export.json', (req, res) => {
  const docs = sessionExports(req.sessionID);
  res.setHeader('Content-Disposition', 'attachment; filename="groove-extraction.json"');
  res.type('application/json').send(JSON.stringify(buildSessionExport(docs), null, 2));
});

router.get('/export.csv', (req, res) => {
  const docs = sessionExports(req.sessionID);
  res.setHeader('Content-Disposition', 'attachment; filename="groove-extraction.csv"');
  res.type('text/csv').send(toCsv(docs));
});

export default router;
