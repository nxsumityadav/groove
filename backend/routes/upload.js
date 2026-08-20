import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { sessionUploadDir } from '../storage/fileStorage.js';
import { createFileRecord, updateFileRecord, countFiles } from '../pipeline/sessionStore.js';
import { queueExtraction } from '../pipeline/extractPipeline.js';
import { MAX_FILES_PER_SESSION, MAX_FILE_SIZE_BYTES } from '../config/index.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, sessionUploadDir(req.sessionID));
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const okTypes = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]);
    const okExt = /\.(pdf|docx|txt)$/i.test(file.originalname);
    if (!okTypes.has(file.mimetype) && !okExt) {
      cb(new Error('Only PDF, Word (.docx) and plain-text files are supported'));
      return;
    }
    cb(null, true);
  },
});

router.post('/', upload.array('files', MAX_FILES_PER_SESSION), (req, res) => {
  const sessionId = req.sessionID;

  if (countFiles(sessionId) + req.files.length > MAX_FILES_PER_SESSION) {
    res.status(400).json({ error: `Maximum ${MAX_FILES_PER_SESSION} files per session` });
    return;
  }

  // The browser may send its own extraction result per file (same order as
  // `files`) as JSON strings in a `clientExtraction` field; the pipeline
  // then skips the parsing/OCR/positional steps it already did.
  const clientExtractions = parseClientExtractions(req.body?.clientExtraction, req.files.length);

  const created = req.files.map((file, i) =>
    createFileRecord(sessionId, {
      originalName: file.originalname,
      storedPath: file.path,
      clientExtraction: clientExtractions[i] ?? null,
    })
  );

  created.forEach((record) => {
    updateFileRecord(sessionId, record.id, { status: 'processing' });
    queueExtraction(sessionId, record);
  });

  res.status(201).json({
    files: created.map((r) => ({ id: r.id, name: r.originalName, status: 'processing', stage: r.stage })),
  });
});

function parseClientExtractions(raw, count) {
  const list = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  return Array.from({ length: count }, (_, i) => {
    const s = list[i];
    if (typeof s !== 'string' || s === '') return null;
    try {
      const obj = JSON.parse(s);
      return obj && typeof obj === 'object' ? obj : null;
    } catch {
      return null;
    }
  });
}

// Surfaces multer errors (bad file type, file too large) as JSON instead of
// the default HTML error page.
router.use((err, req, res, next) => {
  if (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  next();
});

export default router;
