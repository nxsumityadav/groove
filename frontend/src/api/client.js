const BASE = '/api';

async function handle(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

const json = (method, body) => ({
  method,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// `clientExtractions[i]` (optional) is the browser's analysis of files[i];
// the server skips parsing/OCR/positional steps it already did.
export function uploadFiles(files, clientExtractions = []) {
  const formData = new FormData();
  files.forEach((file, i) => {
    formData.append('files', file);
    formData.append('clientExtraction', clientExtractions[i] ? JSON.stringify(clientExtractions[i]) : '');
  });
  return fetch(`${BASE}/upload`, { method: 'POST', credentials: 'include', body: formData }).then(handle);
}

export function getSessionStatus() {
  return fetch(`${BASE}/session/status`, { credentials: 'include' }).then(handle);
}

export function getSessionResults() {
  return fetch(`${BASE}/session/results`, { credentials: 'include' }).then(handle);
}

export function getFileResult(fileId) {
  return fetch(`${BASE}/files/${fileId}/result`, { credentials: 'include' }).then(handle);
}

export function patchField(fileId, key, value) {
  return fetch(`${BASE}/files/${fileId}/fields`, json('PATCH', { key, value })).then(handle);
}

export function approveFile(fileId) {
  return fetch(`${BASE}/files/${fileId}/approve`, { method: 'POST', credentials: 'include' }).then(handle);
}

export const rawPdfUrl = (fileId) => `${BASE}/files/${fileId}/raw`;

// Downloads are plain GETs that come back as attachments; a temporary anchor
// keeps the session cookie attached and lets the browser name the file.
export function downloadExport({ fileId, format }) {
  const url = fileId ? `${BASE}/files/${fileId}/export.${format}` : `${BASE}/session/export.${format}`;
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
