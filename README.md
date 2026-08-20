# groove: tax document extraction

Upload tax documents, check what was pulled out of them against the original
page, correct anything wrong, and export the result for downstream tax
software.

Built for a tax preparer, so the priority is **trust**. Every value says where
it came from and how sure we are, and nothing is presented as certain when it
isn't. Confidence is *measured*, never a model's self-report.

No login. An anonymous session cookie scopes uploaded files and results.

---

## Quick start

```bash
npm install
cp .env.example backend/.env    # optional, only needed for the AI fallback
npm run dev
```

- App: <http://localhost:5173>
- API: <http://localhost:3001> (Vite proxies `/api` to it)

Requires Node 18+ (developed on 22.14). **Known forms work end to end with no
API key and no cloud calls, including scanned ones.** A key is only needed for
documents we have no schema for.

### Environment

`backend/.env`, all optional except where noted.

| Variable | Default | Purpose |
|---|---|---|
| `SERVER_PORT` | `3001` | API port. Named `SERVER_PORT` rather than `PORT` so dev tooling that injects `PORT` for the frontend can't collide with it. |
| `SESSION_SECRET` | dev-only fallback | Signs the session cookie. **Set this in production.** |
| `SARVAM_API_KEY` | none | Enables the AI fallback (unknown forms, Word/text files, cloud OCR). Without it those paths fail honestly rather than silently degrading. |
| `SARVAM_CHAT_BASE_URL` | `https://api.sarvam.ai/v1` | OpenAI-compatible chat endpoint. |
| `SARVAM_CHAT_MODEL` | `sarvam-105b` | `sarvam-m` is deprecated. |
| `SARVAM_DOC_AI_BASE_URL` | `https://api.sarvam.ai/doc-ai/v1` | Cloud OCR job API. |

---

## How extraction works

Free and deterministic first, AI only where it's the only option. Analysis
starts **in the browser** the moment a file is picked, so most documents never
send anything anywhere for extraction.

| # | Where | Step | Tool | Runs when |
|---|-------|------|------|-----------|
| 1 | browser | Read the PDF's text layer, with positions | pdf.js | PDFs, always |
| 2 | browser | OCR the pages (words to PDF coordinates) | Tesseract.js, 2 parallel workers, engine preloaded while the user picks files | PDFs with no text layer (scans) |
| 3 | backend | Read Word / plain-text files as text | mammoth / `fs` | `.docx` and `.txt`. These can't be scans, so they **never** touch OCR |
| 4 | either | Identify the form | signature phrases + layout anchors | always |
| 5 | either | Read the fields, **no model** | fixed-box or label-anchored (below) | form recognised *and* we have positions |
| 6 | backend | Fill a known form's schema from text | Sarvam chat, input trimmed to the form's own pages | recognised form we can't read positionally (incl. `.docx`/`.txt`) |
| 7 | backend | Classify + free-form label/value pairs | Sarvam chat | unrecognised document |
| 8 | backend | Cloud OCR | Sarvam Document AI | PDFs only, and only if 1 and 2 produced nothing readable |

Measured on the bundled fixtures:

| Document | Time | Path | AI calls |
|---|---|---|---|
| Clean digital 1040 (PDF) | **~0.2s** | text layer, positional | 0 |
| Two-page scanned 1040 | **~6s** | Tesseract, positional | 0 |
| W-2 (PDF, vendor layout) | **~0.3s** | text layer, label-anchored | 0 |
| W-2 as a Word file | ~20 to 30s | mammoth, LLM schema fill | 1 (batched) |

### Two ways of reading a page

**Fixed-box**, used for Form 1040. IRS-issued artwork is identical on every
copy, so each field is a coordinate box measured off the blank form. A box that
reads empty at its known location is a confident *"blank"*, not *"unknown"*.
That's the difference between a form that's genuinely empty and one we failed
on.

**Label-anchored**, used for W-2 and 1099-INT. These come from hundreds of
payroll and brokerage vendors whose layouts all differ, so fixed coordinates
would be wrong on the second vendor. But the IRS prescribes the *box labels*,
so we anchor on the printed label (`"1 Wages, tips, other compensation"`) and
infer its box from its neighbours: the value sits **below** the label,
**above** whatever label comes next down the page, and **left of** the next
label across. Extraction reports the coordinates where it actually found each
value, so the UI can still point at it on the page.

The W-2 fixture is generated with deliberately non-IRS geometry
(`backend/scripts/make-w2-fixture.mjs`) specifically to prove the label
anchoring isn't secretly coordinate-fitted.

### Confidence is measured, not self-reported

| Confidence | Means |
|---|---|
| **high** | Read directly off the page, at a fixed box or beside its printed label. Also any value a human edited. |
| **medium** | Read from a scan (OCR), or matched by AI *and* found verbatim in the source text |
| **low** | Failed its type check, OCR was unsure of the characters, or an AI value that **isn't** in the source text |

No model is ever asked how confident it is. A model-supplied value is checked
against the document's own text on a **token boundary**, so `1750` doesn't
count as found just because `15750` appears. Values failing that check are
marked low and flagged, which is the main defence against a plausible-looking
hallucination reaching an export.

Per-value `source` in the export is one of `positional`, `label`,
`positional-ocr`, `label-ocr`, `llm`, `user`, or `none`.

---

## Review screen

- **Left**: the document as uploaded, opened at the page the form starts on
  (cover pages skipped). Read-only.
- **Right**: the extracted data, grouped by the form's own sections, editable
  inline, filterable by confidence.
- **Click a field on either side** and it's highlighted on both and scrolled
  into view, so any value can be traced to the exact spot it was read from.
- Controls match the paper: `$`-prefixed amounts, Yes/No for tick boxes, 3-2-4
  comb boxes for SSNs, and the Dependents block rendered as the grid it
  actually is (with row select and batch clear).
- Anything worth checking carries a hover/focus **tooltip** in plain language.
  No OCR or model jargon anywhere in the UI.
- **Approve** opens the export dialog: JSON for an integration, CSV for a
  spreadsheet.
- Word/text uploads show "no page preview" on the left. The data carries it.
- Header toggles collapse either panel.
- Responsive. Below ~1100px the panes stack, below ~900px the Documents panel
  slides over the content, and phones get touch-sized controls and 16px inputs
  so iOS doesn't zoom on focus.

---

## API

All routes are scoped to the caller's session. A `fileId` from another session
simply 404s.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness. |
| `POST` | `/api/upload` | Multipart. Field `files` (max 10). Optional parallel field `clientExtraction`, the browser's analysis as a JSON string per file. When present the backend skips parsing entirely. |
| `GET` | `/api/session/status` | Per-file status/stage plus the aggregate 1 to 5 tracker. Polled by the UI. |
| `GET` | `/api/session/results` | Every processed document's result. |
| `GET` | `/api/session/export.json` · `.csv` | Every processed document. |
| `GET` | `/api/files/:id/result` | Fields plus the schema needed to render them. |
| `GET` | `/api/files/:id/raw` | The original upload's bytes. |
| `PATCH` | `/api/files/:id/fields` | `{ key, value }`. Marks the field `source: user`, confidence high. |
| `POST` | `/api/files/:id/approve` | Marks the document approved. |
| `GET` | `/api/files/:id/export.json` · `.csv` | One document. |

**Limits:** 10 files per session, 20MB per file, `.pdf` `.docx` `.txt` only, 3
documents processed concurrently.

### Export shape

JSON is `{ document: {...}, fields: [...] }`. The session export wraps those in
`{ exportedAt, documentCount, documents }`. Each field carries:

```json
{
  "key": "line1a",
  "line": "1a",
  "section": "Income",
  "label": "Total amount from Form(s) W-2, box 1",
  "type": "money",
  "value": "85,000",
  "confidence": "high",
  "source": "positional",
  "edited": false,
  "warnings": [],
  "page": 0,
  "box": { "x1": 496, "y1": 328, "x2": 578, "y2": 341 }
}
```

CSV columns: `fileName, formType, line, section, fieldKey, label, value,
confidence, source, editedByUser, needsReview, notes`. Cells are quote-escaped
and guarded against spreadsheet formula injection (a leading `=`, `+`, `-` or
`@` gets prefixed with `'`).

---

## Project layout

```
frontend/                      Vite + React
  src/extraction/              on-device pipeline: pdf.js + Tesseract + upload queue
  src/components/review/       the review screen
  src/pages/                   Upload, Processing, Review

backend/                       Express (plain JS, ESM)
  routes/                      upload, files, session
  pipeline/                    extractPipeline (the cascade), sessionStore, populate
  services/                    documentText, pdfTextExtractor, sarvamClient, exporter
  forms/                       server view of the schema registry
  scripts/                     fixture generators
  packages/extraction/         SHARED with the frontend, see below

test-fixtures/                 1040 (blank/filled/scanned), W-2 (PDF + docx)
```

**`backend/packages/extraction/` is the important one.** It's an npm workspace
package (`@groove/extraction`) imported by *both* sides, so the browser and the
server read a document identically: same schemas, same detection, same
extractors, same confidence rules. It has no Node-specific or DOM-specific
dependencies, and the caller supplies the pdf.js document.

It exports `getFormSchemas`, `getFormSchema`, `publicSchema`, `detectForm`,
`detectFormByText`, `extractFieldsPositional`, `extractFieldsByLabel`,
`scoreField`, `validateType`, `verifyInSource`, `readPdfPages`, `ocrToPage`,
`isTextUsable` and `normalizeValue`.

### Supported forms

| Schema | Strategy | Fields |
|---|---|---|
| `f1040-2025`, Form 1040 (2025) | fixed-box | 90 |
| `w2`, Form W-2 | label-anchored | 23 |
| `f1099int`, Form 1099-INT | label-anchored | 13 |

**Adding a form.** Label-anchored is much cheaper, roughly 20 lines of box
labels for a new 1099 variant. Fixed-box requires measuring coordinates off the
blank PDF (`pdfjs` `getTextContent()` gives you label positions to work from).
Drop the schema in `backend/packages/extraction/forms/` and register it in that
folder's `index.js`. Both sides pick it up.

### Fixtures

```bash
node backend/scripts/make-w2-fixture.mjs        # W-2 PDF, non-IRS geometry
node backend/scripts/make-w2-docx-fixture.mjs   # W-2 as a Word file
python3 backend/scripts/make-scanned-fixture.py # 200-DPI RGB "scan" of the 1040
```

In dev, `window.__groove.addFiles([File])` drives the whole on-device pipeline
from the browser console.

### Stack

**Frontend:** React 18, Vite 5, react-router, react-pdf with pdfjs-dist,
tesseract.js, Hugeicons. Plain CSS, no framework.

**Backend:** Express 4, multer, express-session, mammoth, the openai SDK
pointed at Sarvam, fflate, p-limit, and pdf-lib for fixture generation only.

---

## Writeup

### What I built

A tool that takes a tax document, pulls the fields out of it, and shows you
what it found next to the original page so you can check it before it goes
anywhere. Three forms are supported today: Form 1040, W-2, and 1099-INT. You
can upload PDFs (digital or scanned), Word files, or plain text. Everything
lands in a review screen where each value is editable, each one tells you how
it was obtained, and anything questionable is flagged with a plain-English
reason. When you approve a document you get JSON or CSV out.

The part I care most about is that the extraction is mostly not AI. For a form
we have a schema for, values are read straight off the page at known
coordinates or beside their printed labels. That's deterministic, instant, free,
and it can't hallucinate. AI only comes in when that isn't possible.

### What I chose not to build

- **More form schemas.** Three is enough to prove both reading strategies work.
  Adding a fourth is mechanical, not interesting.
- **Per-year 1040 maps.** Upload a 2024 return and it gets recognised as a 1040
  but doesn't match the 2025 coordinates, so it falls back to AI and gets
  marked medium or low confidence. That's honest behaviour but a real product
  needs the map per year.
- **A database.** Everything is in memory and dies when the process restarts.
  Fine for upload, review, export in one sitting. Wrong for anything you'd want
  to come back to.
- **Auth, multi-tenancy, audit logging, encryption at rest.** Out of scope for
  this, but tax documents are about as sensitive as data gets, so none of it is
  optional in production.
- **Legacy `.doc`.** Only `.docx`. The old binary format needs a messier library
  and hasn't been the default since 2007.
- **Automated tests.** I verified by driving the actual app and asserting on API
  responses. The extractors are pure functions with fixed inputs, so they're the
  obvious first thing to unit test, and I'd write those before adding form four.

### Key decisions and tradeoffs

**Extraction runs in the browser, not the server.** The user's machine already
has the file. Doing pdf.js and Tesseract there means no upload-then-wait round
trip, no server CPU per document, and the file's contents don't need to travel
anywhere for a form we understand. The tradeoff is that speed depends on the
user's hardware, and the same extraction code has to run in two environments.
That's why the schemas and extractors live in a shared workspace package with
no Node or DOM dependencies.

**Two reading strategies instead of one.** I could have used AI for everything
and shipped faster. Fixed coordinates work for IRS-printed forms because every
copy is identical, but they'd be wrong for W-2s, which hundreds of payroll
vendors lay out differently. Anchoring on the printed box labels covers those
without giving up determinism. It's more code than "send it to a model" but the
result is verifiable.

**Confidence is computed, not asked for.** Models will happily tell you they're
95% sure of something they invented. Instead, a model-supplied value is checked
against the document's own text on a token boundary. If the string isn't
actually in the document, it's marked low and flagged. Values read positionally
are high because we know exactly where they came from. This was the single most
important design decision for a tool a preparer is supposed to trust.

**A blank box is an answer.** When a field reads empty at a known location on a
matched layout, that's recorded as a confident blank rather than a gap for AI to
fill. Otherwise the model invents plausible numbers for boxes the taxpayer
deliberately left empty.

**I deleted the first version of the review screen.** More on that below.

### AI stack

Two separate stacks here: the AI inside the product, and the AI I used to build
it.

**In the product:**

- **Sarvam `sarvam-105b`** (chat completions, JSON mode) for two jobs: filling a
  known form's schema when we can't read it positionally, and classifying plus
  extracting from documents we have no schema for. Requests are batched at 16
  field keys with split-on-truncation retry, because it's a reasoning model that
  will happily spend its entire token budget thinking and return nothing.
- **Sarvam Document AI** for cloud OCR. This is the genuine last resort, only
  for PDFs where both the text layer and on-device OCR came back empty.
- **Tesseract.js** for on-device OCR of scanned PDFs. Free, runs in the browser,
  two workers in parallel.

Roughly speaking, in normal use none of these fire. A clean PDF or a readable
scan of a form we know goes through with zero AI calls.

**Building it:** Claude Code did most of the implementation work, with me
directing.

**Where AI helped a lot:** scaffolding the Express and Vite setup, wiring
components together, CSS work, writing the coordinate-measurement scripts that
turned a blank IRS PDF into a field map, and mechanical refactors like splitting
the shared extraction package out of the server. It also caught a `pdfjs-dist`
version mismatch (react-pdf pins one exact version, a caret range let npm hoist
a newer one and the PDF worker died) that I would have spent a while staring at.

**Where I overrode it:**

- The first review screen rebuilt the tax return: it drew extracted values onto
  a blank 1040 template next to the upload. It looked impressive and it was
  wrong. A preparer wants the data, not a re-rendered form, and it fell apart
  the moment someone uploaded a 2024 return and the values landed on 2025
  artwork. I had it deleted, along with the renderer and its templates, rather
  than leaving a second half-true view of the data in the codebase.
- It reached for shadcn/ui, which drags in Tailwind. I didn't want Tailwind, so
  the drawers use Vaul directly with plain CSS. Later the drawers went too.
- It initially had extraction running server-side. I pushed it into the browser
  with free libraries, which is where most of the speed came from.
- On performance, it assumed OCR was the bottleneck for scanned PDFs. It wasn't,
  and I made it profile instead of guess. See below.

**Where I deliberately didn't use AI:**

- Reading fields from a recognised form. Coordinates and printed labels are
  exact, and a model can only make that worse.
- Deciding which form a document is. Signature phrases plus label positions.
- Scoring confidence. Measured against the source text.
- Reading Word files. That's a zip full of XML, so `mammoth` gets the text
  directly. Running OCR on a Word file would be absurd, and the pipeline refuses
  to.

### What I'd do differently with more time

1. **Cross-document reconciliation.** A preparer uploads a 1040 and the W-2s
   behind it. Flagging "1040 line 1a doesn't match the sum of your W-2 box 1
   values" catches genuine filing errors. This is the highest-value thing I
   didn't build and I'd start here.
2. **More 1099 variants and per-year 1040 maps**, prioritised by what preparers
   actually receive most.
3. **Show provenance for AI-derived values too.** Page and box coordinates
   already ship in the export. Surfacing "read from here" for every value, not
   just positional ones, would close the trust loop completely.
4. **An export shaped like what tax software actually ingests** rather than
   generic JSON and CSV.
5. **Persistence and encryption at rest**, plus a retention policy. Right now
   uploads sit unencrypted on local disk and vanish on restart, which is the
   worst of both.
6. **Unit tests on the extractors**, with fixtures from several real vendors
   rather than my generated one.

One process thing I'd change: I built the review screen before I fully
understood who it was for. Rebuilding the return was a reasonable-looking guess
that cost real time. Getting clear on "the deliverable is data for downstream
software" first would have saved that detour.

### Assumptions I made

- The user is a tax preparer or someone comfortable with tax forms, not a
  first-time filer. The UI shows raw field labels and line numbers rather than
  friendly explanations.
- Reviewing is a desktop task. It works on mobile now, but comparing a document
  against extracted data wants width.
- One session, one sitting. Upload, review, export, done. Nothing is meant to
  survive a restart.
- English-language US federal forms.
- Documents are a handful of pages, not hundred-page filings. On-device OCR is
  capped at 10 pages.
- A preparer would rather see a field flagged as uncertain than have it quietly
  filled with a confident guess. Everything about the confidence model follows
  from that.

### A measurement worth recording

Scanned PDFs took about 13 seconds and I assumed OCR was the cost. Profiling
said otherwise. OCR was around 6 seconds, and pdf.js was spending another 5
seconds per page just decoding the scan image, because my test fixture used
grayscale JPEGs. Those fall off the browser's native decode path onto a slow
JavaScript decoder. Real scanners emit RGB. Fixing the fixture to be
representative, preloading the OCR engine while the user is still picking files,
and running two OCR workers in parallel brought it to about 6 seconds. The
obvious suspect was wrong and only measuring found it.

### Known limitations

- Low-quality scans fall back to cloud OCR, which needs the API key.
- On-device OCR is around 6 seconds for a two-page scan on an 8-core machine.
  Slower hardware takes longer, and the first visit downloads about 5MB of OCR
  engine. It's preloaded during file selection and cached afterwards.
- `sarvam-105b` can spend its whole token budget reasoning before answering.
  Schema extraction is batched at 16 keys with split-on-truncation retry to
  survive that.
- `npm audit` reports dev-only advisories in `vite` and `react-router` that need
  major version bumps. Left alone deliberately.
- `pdfjs-dist` is pinned to exactly `4.8.69` because `react-pdf` requires that
  exact version. A caret range lets npm hoist a newer copy and the PDF worker
  breaks with a version mismatch.
