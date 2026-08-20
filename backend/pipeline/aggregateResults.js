const STEPS = [
  { step: 1, label: 'document uploaded successfully' },
  { step: 2, label: 'identifying forms in your return' },
  { step: 3, label: 'extracting field data' },
  { step: 4, label: 'populating the 2024 return for review' },
  { step: 5, label: 'preparing comparison view' },
];

// File-level stage -> tracker step. Step 5 (comparison view) is session-level
// and only lights up once every non-error file is ready.
const FILE_STAGE_TO_STEP = {
  uploaded: 1,
  identifying_forms: 2,
  extracting_fields: 3,
  populating: 4,
  done: 4,
};

export function computeAggregate(files) {
  if (files.length === 0) {
    return { step: 1, allDone: false, resultsReady: false, hasError: false, stalled: false };
  }

  const hasError = files.some((f) => f.status === 'error');
  const nonErrorFiles = files.filter((f) => f.status !== 'error');

  if (nonErrorFiles.length === 0) {
    // Every file failed — processing has stopped, but nothing actually
    // completed, so the tracker must not claim steps beyond that are done.
    const minStep = Math.min(...files.map((f) => FILE_STAGE_TO_STEP[f.stage] ?? 1));
    return { step: minStep, allDone: true, resultsReady: false, hasError, stalled: true };
  }

  const allNonErrorReady = nonErrorFiles.every((f) => f.status === 'ready');

  if (!allNonErrorReady) {
    const minStep = Math.min(...nonErrorFiles.map((f) => FILE_STAGE_TO_STEP[f.stage] ?? 1));
    return { step: minStep, allDone: false, resultsReady: false, hasError, stalled: false };
  }

  return { step: 5, allDone: true, resultsReady: true, hasError, stalled: false };
}

export function buildStepList(currentStep, allDone, stalled = false) {
  return STEPS.map(({ step, label }) => {
    let state;
    if (stalled) {
      if (step < currentStep) state = 'done';
      else if (step === currentStep) state = 'error';
      else state = 'pending';
    } else if (allDone) {
      state = 'done';
    } else if (step < currentStep) {
      state = 'done';
    } else if (step === currentStep) {
      state = 'active';
    } else {
      state = 'pending';
    }
    return { step, label, state };
  });
}

// Session-level summary of every processed document (server paths omitted).
export function mergeResults(files) {
  return files
    .filter((f) => f.status === 'ready' && f.result)
    .map((f) => ({ fileId: f.id, fileName: f.originalName, ...f.result }));
}
