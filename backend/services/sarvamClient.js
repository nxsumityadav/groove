import fs from 'node:fs';
import OpenAI from 'openai';
import { unzipSync, strFromU8 } from 'fflate';
import {
  SARVAM_API_KEY,
  SARVAM_CHAT_BASE_URL,
  SARVAM_CHAT_MODEL,
  SARVAM_DOC_AI_BASE_URL,
  SARVAM_OCR_POLL_INTERVAL_MS,
  SARVAM_OCR_TIMEOUT_MS,
} from '../config/index.js';

// Sarvam's chat endpoint is OpenAI-compatible; reuse the official SDK for
// retries/error handling. Both auth headers per Sarvam's docs.
const client = new OpenAI({
  apiKey: SARVAM_API_KEY || 'missing',
  baseURL: SARVAM_CHAT_BASE_URL,
  defaultHeaders: { 'api-subscription-key': SARVAM_API_KEY },
  // Bound every call: the reasoning model can otherwise generate for minutes.
  timeout: 90_000,
  maxRetries: 1,
});

// ---------------------------------------------------------------------------
// LLM structuring
// ---------------------------------------------------------------------------

function schemaPrompt(schema, onlyKeys) {
  const keys = onlyKeys ? schema.fields.filter((f) => onlyKeys.includes(f.key)) : schema.fields;
  const lines = keys.map((f) => `- ${f.key}: ${f.label}${f.line ? ` (line ${f.line})` : ''} [${f.type}]`);
  return `You are extracting values from the text of an IRS ${schema.name} (${schema.year}).
Return ONLY a JSON object of the shape {"fields": {"<key>": "<value>"}} using exactly these keys:
${lines.join('\n')}

Rules:
- money: digits with optional commas/decimal, no "$" (e.g. "85,000"). Empty string if blank on the form.
- ssn: ###-##-####.
- checkbox: "true" or "false".
- text: the value as written. Empty string if not present.
- Never invent values. If unsure, use "".
- Do not explain or reason at length — output the JSON immediately.`;
}

const GENERIC_PROMPT = `You are a tax document parser. Given the raw text of a tax document,
identify its form type (e.g. "W-2", "1099-INT", "K-1", "1040", or "Unknown") and extract every
label/value pair you can find. Respond with ONLY a JSON object of the shape:
{"formType": string, "fields": {"<label>": "<value>"}}. Never invent values.`;

async function chatJson(system, user) {
  const request = {
    model: SARVAM_CHAT_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user.slice(0, 40000) },
    ],
    temperature: 0,
    // sarvam-105b is a reasoning model; it spends a variable amount of the
    // budget on reasoning_content before the JSON answer, so give it room.
    reasoning_effort: 'low',
    max_tokens: 8000,
    response_format: { type: 'json_object' },
  };
  let completion;
  try {
    completion = await client.chat.completions.create(request);
  } catch (err) {
    // Some deployments reject response_format; retry once without it.
    if (err?.status === 400) {
      delete request.response_format;
      completion = await client.chat.completions.create(request);
    } else {
      throw err;
    }
  }
  const choice = completion.choices?.[0];
  const content = choice?.message?.content ?? '';
  return parseJsonLoose(content, choice?.finish_reason === 'length');
}

function parseJsonLoose(text, truncated = false) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through to salvage */
      }
    }
    if (truncated) {
      const salvaged = salvageTruncatedJson(trimmed);
      if (salvaged) return salvaged;
      const err = new Error('Sarvam output was truncated (max_tokens) and could not be recovered');
      err.code = 'TRUNCATED';
      throw err;
    }
    throw new Error('Sarvam returned non-JSON output');
  }
}

// Keeps every complete `"key": "value"` pair of a cut-off {"fields": {...}}
// object and closes it, so a truncated answer still yields its good half.
function salvageTruncatedJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  const lastPair = text.lastIndexOf('",');
  const lastFull = text.lastIndexOf('"}');
  const cut = Math.max(lastPair, lastFull);
  if (cut <= start) return null;
  let candidate = text.slice(start, cut + 1);
  const opens = (candidate.match(/{/g) || []).length;
  const closes = (candidate.match(/}/g) || []).length;
  candidate += '}'.repeat(Math.max(0, opens - closes));
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// Schema-aware: fill the given keys (or all keys) of a known form.
//
// Keys go out in parallel batches because sarvam-105b reasons (at a
// non-deterministic length) before answering, and a big request can burn
// the whole token budget inside the reasoning. If a batch still truncates,
// it is split in half and retried; a batch that fails even at minimum size
// is reported in `errors` rather than failing the whole document.
const SCHEMA_BATCH_SIZE = 16;
const MIN_BATCH_SIZE = 4;

const isRetryableBySplitting = (err) =>
  err?.code === 'TRUNCATED' || err?.name === 'APIConnectionTimeoutError' || /timed out/i.test(err?.message ?? '');

async function fillBatch(rawText, schema, keys) {
  try {
    const out = await chatJson(schemaPrompt(schema, keys), rawText);
    const fields = out?.fields && typeof out.fields === 'object' ? out.fields : {};
    const values = {};
    for (const k of keys) if (k in fields) values[k] = fields[k] == null ? '' : String(fields[k]);
    return { values, errors: [] };
  } catch (err) {
    if (isRetryableBySplitting(err) && keys.length > MIN_BATCH_SIZE) {
      const mid = Math.ceil(keys.length / 2);
      const [a, b] = await Promise.all([fillBatch(rawText, schema, keys.slice(0, mid)), fillBatch(rawText, schema, keys.slice(mid))]);
      return { values: { ...a.values, ...b.values }, errors: [...a.errors, ...b.errors] };
    }
    return {
      values: {},
      errors: [`We couldn’t fill in ${keys.length} field${keys.length === 1 ? '' : 's'} automatically — please add ${keys.length === 1 ? 'it' : 'them'} below.`],
    };
  }
}

export async function structureWithSchema(rawText, schema, onlyKeys = null) {
  const keys = (onlyKeys ?? schema.fields.map((f) => f.key)).filter((k) => schema.fields.some((f) => f.key === k));
  const batches = [];
  for (let i = 0; i < keys.length; i += SCHEMA_BATCH_SIZE) batches.push(keys.slice(i, i + SCHEMA_BATCH_SIZE));

  const results = await Promise.all(batches.map((batch) => fillBatch(rawText, schema, batch)));
  const values = Object.assign({}, ...results.map((r) => r.values));
  const errors = results.flatMap((r) => r.errors);
  if (Object.keys(values).length === 0 && errors.length) {
    throw new Error(errors[0]);
  }
  return { values, errors };
}

// Unknown form: classify + free-form label/value pairs.
export async function structureGeneric(rawText) {
  const out = await chatJson(GENERIC_PROMPT, rawText);
  const fields = {};
  for (const [k, v] of Object.entries(out?.fields ?? {})) fields[String(k)] = v == null ? '' : String(v);
  return { formType: out?.formType ? String(out.formType) : 'Unknown', fields };
}

// ---------------------------------------------------------------------------
// OCR via Sarvam Document AI "digitise" (async job). Last resort only.
// ---------------------------------------------------------------------------

async function docAi(path, init = {}) {
  const res = await fetch(`${SARVAM_DOC_AI_BASE_URL}${path}`, {
    ...init,
    headers: { 'api-subscription-key': SARVAM_API_KEY, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sarvam Document AI ${init.method ?? 'GET'} ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function ocrDocument(filePath) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/pdf' }), 'document.pdf');
  form.append('language', 'en-IN');
  form.append('output_format', 'md');

  const job = await docAi('/job/digitise', { method: 'POST', body: form });
  const jobId = job.job_id;
  if (!jobId) throw new Error('Sarvam Document AI did not return a job_id');

  const deadline = Date.now() + SARVAM_OCR_TIMEOUT_MS;
  let status = job.status;
  while (!['completed', 'partially_completed', 'failed', 'rejected'].includes(status)) {
    if (Date.now() > deadline) throw new Error('Sarvam OCR job timed out');
    await sleep(SARVAM_OCR_POLL_INTERVAL_MS);
    status = (await docAi(`/job/${jobId}/status`)).status;
  }
  if (status === 'failed' || status === 'rejected') throw new Error(`Sarvam OCR job ${status}`);

  const { url } = await docAi(`/job/${jobId}/download-url`);
  const zipRes = await fetch(url);
  if (!zipRes.ok) throw new Error(`Sarvam OCR download failed: ${zipRes.status}`);
  const files = unzipSync(new Uint8Array(await zipRes.arrayBuffer()));

  // Primary output is the .md at the archive root; metadata/ holds per-page json.
  const mdName = Object.keys(files).find((n) => n.endsWith('.md') && !n.startsWith('metadata/'));
  const raw = mdName
    ? strFromU8(files[mdName])
    : Object.entries(files)
        .filter(([n]) => /\.(md|txt|html)$/i.test(n))
        .map(([, u8]) => strFromU8(u8))
        .join('\n\n');
  return htmlToText(raw);
}

// Sarvam's markdown output embeds tables as raw HTML. The tag soup roughly
// doubles the token count and sends the reasoning model down long detours,
// so flatten it: cells become " | "-separated, rows become lines.
export function htmlToText(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<\/(tr|p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\|[ \t]+(?=\n)/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
