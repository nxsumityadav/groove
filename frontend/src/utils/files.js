// What the app accepts. PDFs get full on-device analysis (text layer → OCR
// → field extraction); Word and text files are read on the backend with the
// matching library — they can't be scans, so they never involve OCR.
export const ACCEPT_ATTR = '.pdf,.docx,.txt';

const OK_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export function filterSupportedFiles(fileList) {
  return Array.from(fileList).filter((file) => OK_TYPES.has(file.type) || /\.(pdf|docx|txt)$/i.test(file.name));
}

export function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
