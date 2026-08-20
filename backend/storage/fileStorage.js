import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_ROOT } from '../config/index.js';

export function sessionUploadDir(sessionId) {
  const dir = path.join(UPLOAD_ROOT, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
