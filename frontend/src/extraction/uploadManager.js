import { uploadFiles } from '../api/client.js';
import { analyzeFile } from './clientExtractor.js';
import { isPdf } from '../utils/files.js';

// Module-level queue so on-device analysis + upload keep running across
// route changes (Upload page -> Processing page). Components subscribe to
// render the pending entries alongside the server's file list.
const listeners = new Set();
let pending = []; // { localId, name, phase, label, progress, error }
let nextId = 1;

function emit() {
  for (const fn of listeners) fn(pending);
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(pending);
  return () => listeners.delete(fn);
}

export function getPending() {
  return pending;
}

function patch(localId, changes) {
  pending = pending.map((p) => (p.localId === localId ? { ...p, ...changes } : p));
  emit();
}

function remove(localId) {
  pending = pending.filter((p) => p.localId !== localId);
  emit();
}

function labelFor(progress) {
  switch (progress?.phase) {
    case 'reading':
      return 'Reading';
    case 'ocr':
      return `Reading page ${progress.page} of ${progress.pageCount}`;
    case 'extracting':
      return 'Finding fields';
    case 'uploading':
      return 'Uploading';
    default:
      return 'Preparing';
  }
}

async function processOne(entry, file) {
  try {
    // Only PDFs are analyzed on-device; Word/text files upload as-is and the
    // backend extracts their text with the matching library (never OCR).
    const clientExtraction = isPdf(file)
      ? await analyzeFile(file, (progress) => {
          patch(entry.localId, { phase: progress.phase, label: labelFor(progress), progress: progress.progress ?? null });
        })
      : null;
    patch(entry.localId, { phase: 'uploading', label: 'Uploading', progress: null });
    await uploadFiles([file], [clientExtraction]);
    // The server list (polled) now owns this file.
    remove(entry.localId);
  } catch (err) {
    patch(entry.localId, { phase: 'error', label: 'Error', error: err.message || 'Failed' });
  }
}

export function addFiles(files) {
  const entries = Array.from(files).map((file) => ({
    localId: `local-${nextId++}`,
    name: file.name,
    phase: 'reading',
    label: 'Reading',
    progress: null,
    error: null,
  }));
  pending = [...pending, ...entries];
  emit();
  entries.forEach((entry, i) => {
    processOne(entry, files[i]);
  });
  return entries.map((e) => e.localId);
}

export function dismiss(localId) {
  remove(localId);
}
