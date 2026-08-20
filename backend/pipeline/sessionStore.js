// In-memory session state: sessionId -> Map<fileId, FileRecord>.
// Anonymous + ephemeral by design — does not survive a server restart.
const sessions = new Map();

function getOrCreateSession(sessionId) {
  let files = sessions.get(sessionId);
  if (!files) {
    files = new Map();
    sessions.set(sessionId, files);
  }
  return files;
}

let nextFileId = 1;

export function createFileRecord(sessionId, { originalName, storedPath, clientExtraction = null }) {
  const files = getOrCreateSession(sessionId);
  const id = String(nextFileId++);
  const now = Date.now();
  const record = {
    id,
    originalName,
    storedPath,
    clientExtraction,
    status: 'uploading', // uploading | processing | ready | error
    stage: 'uploaded', // uploaded | identifying_forms | extracting_fields | structuring | done
    error: null,
    result: null,
    createdAt: now,
    updatedAt: now,
  };
  files.set(id, record);
  return record;
}

export function updateFileRecord(sessionId, fileId, patch) {
  const files = sessions.get(sessionId);
  const record = files?.get(fileId);
  if (!record) return null;
  Object.assign(record, patch, { updatedAt: Date.now() });
  return record;
}

export function getFileRecords(sessionId) {
  const files = sessions.get(sessionId);
  return files ? Array.from(files.values()) : [];
}

export function getFileRecord(sessionId, fileId) {
  return sessions.get(sessionId)?.get(fileId) ?? null;
}

export function countFiles(sessionId) {
  return sessions.get(sessionId)?.size ?? 0;
}
