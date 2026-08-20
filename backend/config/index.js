import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';

// Named SERVER_PORT (not PORT) so it doesn't collide with a generic PORT env
// var that dev tooling may inject for the primary dev server (Vite).
export const PORT = process.env.SERVER_PORT || 3001;
export const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret';

// Sarvam AI — sole AI provider. Only reached as a fallback:
//   - chat completions: structure text into fields when positional
//     extraction can't (unknown form / layout mismatch / OCR'd text)
//   - Document AI "digitise": OCR, only when the PDF has no text layer
// Endpoints/models verified against docs.sarvam.ai (Aug 2026):
//   chat  POST https://api.sarvam.ai/v1/chat/completions   model sarvam-105b
//   ocr   POST https://api.sarvam.ai/doc-ai/v1/job/digitise -> poll status -> download zip
export const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
export const SARVAM_CHAT_BASE_URL = process.env.SARVAM_CHAT_BASE_URL || 'https://api.sarvam.ai/v1';
export const SARVAM_CHAT_MODEL = process.env.SARVAM_CHAT_MODEL || 'sarvam-105b';
export const SARVAM_DOC_AI_BASE_URL = process.env.SARVAM_DOC_AI_BASE_URL || 'https://api.sarvam.ai/doc-ai/v1';
export const SARVAM_OCR_POLL_INTERVAL_MS = 5000;
export const SARVAM_OCR_TIMEOUT_MS = 3 * 60 * 1000;

export const hasSarvamKey = () => SARVAM_API_KEY.trim() !== '';

// Upload / pipeline limits — not specified by product requirements, tunable.
export const MAX_FILES_PER_SESSION = 10;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const PIPELINE_CONCURRENCY = 3;

// Below this many characters of text-layer content, treat the PDF as
// scanned/image-only and fall back to OCR.
export const MIN_USABLE_TEXT_LENGTH = 50;

// Uploads live in the OS temp dir so they work both in local dev and on
// Vercel's serverless functions (where only /tmp is writable). Ephemeral by
// design — file and extraction state is in-memory per session anyway.
export const UPLOAD_ROOT = path.join(os.tmpdir(), 'groove-uploads');
