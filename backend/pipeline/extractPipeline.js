import pLimit from 'p-limit';
import { PIPELINE_CONCURRENCY, hasSarvamKey } from '../config/index.js';
import { detectForm, detectFormByText, extractFieldsPositional, extractFieldsByLabel, isTextUsable } from '@groove/extraction';
import { getFormSchema } from '../forms/index.js';
import { getDocumentText } from '../services/documentText.js';
import { structureWithSchema, structureGeneric, ocrDocument } from '../services/sarvamClient.js';
import { updateFileRecord } from './sessionStore.js';
import { buildSchemaFields, buildGenericFields } from './populate.js';

const limit = pLimit(PIPELINE_CONCURRENCY);
// User-facing copy. These appear at the top of the Inputs sheet, so they say
// what it means for the person reviewing — not how the pipeline works.
const NO_KEY_WARNING = 'Automatic matching is unavailable right now, so some fields may be blank. You can fill them in below.';
const UNREADABLE = 'We couldn’t read any text from this file. It may be a photo or a damaged PDF — try uploading a clearer copy.';

// Per-file cascade. Cheapest, most deterministic step first; each later
// step only runs when the earlier one couldn't finish the job. The browser
// normally does steps 1–3 before uploading (pdf.js text layer → Tesseract
// OCR → form detection → positional extraction) and sends the result along;
// the server then only renders. Server-side steps are the fallback for
// uploads without a client result, and Sarvam is the fallback behind that.
//
//   1. text     browser pdf.js text layer  → none? → browser Tesseract OCR → still none? → Sarvam OCR
//   2. detect   form signatures + layout anchors (shared code, runs wherever step 1 ran)
//   3. fields   positional (no AI)          → layout unknown? → Sarvam LLM (schema-keyed / generic)
async function runExtraction(sessionId, fileRecord) {
  const { id: fileId, storedPath, clientExtraction: ce } = fileRecord;
  const stage = (s, extra = {}) => updateFileRecord(sessionId, fileId, { stage: s, ...extra });
  const warnings = [];

  try {
    stage('identifying_forms', { status: 'processing' });

    // --- 1. Text ---------------------------------------------------------
    let sourceText = '';
    let textSource = 'none';
    let pages = null; // positioned items, if we have them
    let detected = null;
    let clientValues = null;
    let clientMeta = {};

    if (ce) {
      if (ce.encrypted) return fail(sessionId, fileId, 'This PDF is password-protected. Remove the password and upload it again.');
      sourceText = String(ce.sourceText ?? '');
      textSource = ce.textSource ?? 'none';
      if (ce.detected?.schemaId) {
        const schema = getFormSchema(ce.detected.schemaId);
        if (schema) {
          detected = { schema, formStartPage: ce.detected.formStartPage ?? 0, layoutMatch: Boolean(ce.detected.layoutMatch), anchorsHit: ce.detected.anchorsHit ?? 0 };
          clientValues = ce.values ?? null;
          clientMeta = ce.meta ?? {};
        }
      }
      if (ce.notes?.length) warnings.push(...ce.notes);
    } else {
      // No browser result (Word/text upload, or a plain API upload): pull the
      // text with the right library for the file type.
      const { kind, encrypted, pages: read, text } = await getDocumentText(storedPath);
      if (encrypted) return fail(sessionId, fileId, 'This PDF is password-protected. Remove the password and upload it again.');
      if (isTextUsable(text)) {
        pages = read;
        sourceText = text;
        textSource = `${kind}-text`;
      } else if (kind !== 'pdf') {
        // Word/plain-text files can't be scans — if the library found no
        // text, OCR has nothing more to offer. Fail honestly instead.
        throw new Error(UNREADABLE);
      }
    }

    if (!isTextUsable(sourceText)) {
      // Genuine last resort, PDFs only: no text layer and on-device OCR
      // produced nothing.
      if (!hasSarvamKey()) throw new Error(UNREADABLE);
      warnings.push('This file had no readable text, so we read it from the page images. Please check the values carefully.');
      sourceText = await ocrDocument(storedPath);
      textSource = 'ocr-sarvam';
      pages = null;
      detected = null;
      clientValues = null;
      if (!isTextUsable(sourceText)) throw new Error(UNREADABLE);
    }

    // --- 2. Detect form --------------------------------------------------
    if (!detected) detected = pages ? detectForm(pages) : detectFormByText(sourceText);
    stage('extracting_fields');

    let result;
    if (detected) {
      const { schema, formStartPage, layoutMatch } = detected;
      let values = {};
      let meta = {};
      const sourceByKey = {};
      // Name how each value was obtained, so the export says whether it was
      // read at a fixed box, found by its printed label, or read off a scan.
      const scanned = textSource === 'ocr-tesseract';
      const readSource =
        schema.strategy === 'label' ? (scanned ? 'label-ocr' : 'label') : scanned ? 'positional-ocr' : 'positional';

      if (layoutMatch && (clientValues || pages)) {
        // --- 3a. Read straight off the page (no AI). Either by fixed box on
        // IRS-issued artwork, or by the printed box label on vendor-issued
        // forms like W-2s. A box read as blank at its known place is a real
        // answer ("empty"), so we don't ask a model to second-guess it.
        if (clientValues) {
          values = clientValues;
          meta = clientMeta;
        } else if (schema.strategy === 'label') {
          ({ values, meta } = extractFieldsByLabel(schema, pages, formStartPage));
        } else {
          ({ values, meta } = extractFieldsPositional(schema, pages, formStartPage));
        }
        for (const k of Object.keys(values)) sourceByKey[k] = readSource;
        if (scanned) {
          warnings.push('This looks like a scan, so a few values may not be exact. We’ve highlighted the ones worth checking.');
        }
      } else {
        // --- 3b. Known form but no trustworthy boxes: OCR text without a
        // layout match, or a different year's layout. The LLM fills the schema.
        warnings.push(
          pages || clientValues
            ? `This is a ${schema.name} laid out differently from the ${schema.year ?? 'standard'} version we know, so we matched the values by reading the text. Please check them before approving.`
            : `We matched this to a ${schema.name} and read the values from the page. Please check them before approving.`
        );
        if (hasSarvamKey()) {
          // Send the model only the pages the form actually occupies — cover
          // pages and attachments just burn tokens and time per batch.
          const llmText = pages
            ? pages
                .slice(formStartPage, formStartPage + (schema.pageCount ?? pages.length))
                .map((pg) => pg.text)
                .join('\n\n')
            : sourceText;
          const { values: llmValues, errors } = await structureWithSchema(llmText, schema);
          values = llmValues;
          for (const k of Object.keys(values)) sourceByKey[k] = 'llm';
          warnings.push(...errors);
        } else {
          warnings.push(NO_KEY_WARNING);
        }
      }

      result = {
        formType: schema.name,
        formSchemaId: schema.id,
        layoutMatch,
        formStartPage,
        fields: buildSchemaFields(schema, values, sourceByKey, sourceText, meta),
        extractionMethod: layoutMatch ? readSource : Object.keys(values).length ? 'llm' : 'none',
      };
    } else if (hasSarvamKey()) {
      // --- Unknown form: LLM classify + free-form fields ------------------
      const { formType, fields } = await structureGeneric(sourceText);
      result = { formType, formSchemaId: null, layoutMatch: false, formStartPage: 0, fields: buildGenericFields(fields, sourceText), extractionMethod: 'llm' };
    } else {
      warnings.push(NO_KEY_WARNING);
      result = { formType: 'Unknown', formSchemaId: null, layoutMatch: false, formStartPage: 0, fields: {}, extractionMethod: 'none' };
    }

    // --- 4. Ready for review ---------------------------------------------
    stage('populating', {
      result: {
        ...result,
        textSource,
        extractionMethod: textSource.startsWith('ocr') && !result.extractionMethod.includes('ocr') ? `${textSource}+${result.extractionMethod}` : result.extractionMethod,
        warnings,
        approved: false,
        sourceFileId: fileId,
        extractedAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    stage('done', { status: 'ready' });
  } catch (err) {
    fail(sessionId, fileId, err.message || 'Extraction failed');
  }
}

function fail(sessionId, fileId, message) {
  updateFileRecord(sessionId, fileId, { status: 'error', error: { message } });
}

export function queueExtraction(sessionId, fileRecord) {
  limit(() => runExtraction(sessionId, fileRecord)).catch((err) => {
    console.error('extraction queue error', err);
  });
}
