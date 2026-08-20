import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Pdf01Icon } from "@hugeicons/core-free-icons";
import ReviewHeader from "../components/review/ReviewHeader.jsx";
import PdfPane from "../components/review/PdfPane.jsx";
import ExtractedDataPanel from "../components/review/ExtractedDataPanel.jsx";
import DocsSidebar from "../components/review/DocsSidebar.jsx";
import ExportModal from "../components/review/ExportModal.jsx";
import { useSessionPolling } from "../hooks/useSessionPolling.js";
import { useLocalUploads } from "../hooks/useLocalUploads.js";
import {
  getFileResult,
  patchField,
  approveFile,
  rawPdfUrl,
  downloadExport,
} from "../api/client.js";
import { addFiles } from "../extraction/uploadManager.js";

export default function ReviewPage() {
  const navigate = useNavigate();
  const { status } = useSessionPolling(true);
  const localFiles = useLocalUploads();

  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null); // { file, result, schema }
  const [loadError, setLoadError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  // Docked beside the content when there's room; on narrow screens it
  // overlays, so it starts closed rather than covering the document.
  const [docsOpen, setDocsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  const [showData, setShowData] = useState(true);
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [approving, setApproving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const sourcePane = useRef(null);
  const syncing = useRef(false);

  const serverFiles = status?.files ?? [];
  const files = useMemo(
    () => [...serverFiles, ...localFiles],
    [serverFiles, localFiles],
  );
  const readyFiles = useMemo(
    () => serverFiles.filter((f) => f.status === "ready"),
    [serverFiles],
  );

  // Right after an upload there's a beat where the local entry is gone but
  // the polled status hasn't caught up yet, so an empty list must persist
  // across two polls before it means "genuinely nothing here".
  const emptyPolls = useRef(0);
  useEffect(() => {
    if (status && files.length === 0) {
      emptyPolls.current += 1;
      if (emptyPolls.current >= 2) navigate("/", { replace: true });
    } else {
      emptyPolls.current = 0;
    }
  }, [status, files.length, navigate]);

  useEffect(() => {
    if (!selectedId && readyFiles.length > 0) setSelectedId(readyFiles[0].id);
  }, [selectedId, readyFiles]);

  const load = useCallback(async (fileId) => {
    try {
      const d = await getFileResult(fileId);
      setData(d);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setData(null);
    setSelectedKey(null);
    load(selectedId);
  }, [selectedId, load]);

  const schema = data?.schema ?? null;
  const result = data?.result ?? null;
  const entries = result?.fields ?? {};
  const formStartPage = result?.formStartPage ?? 0;

  // Field list for the drawer: schema order for known forms, otherwise the
  // free-form label/value pairs the model produced.
  const fieldList = useMemo(() => {
    // Boxes that aren't printed on this copy of the form (vendors often omit
    // the state/local block) would only show up as false alarms.
    if (schema) return schema.fields.filter((f) => !entries[f.key]?.notOnForm);
    return Object.entries(entries).map(([key, e]) => ({
      key,
      label: e.label ?? key,
      section: "Extracted fields",
      line: null,
      type: "text",
    }));
  }, [schema, entries]);

  // Where each field sits on the uploaded document, so picking a value can
  // point back at the exact box it was read from. Only meaningful when the
  // layout matched a template we know — otherwise the boxes would be wrong.
  const sourceOverlays = useMemo(() => {
    if (!schema || !result?.layoutMatch) return [];
    return schema.fields
      .map((f) => {
        const e = entries[f.key];
        const value = e?.value ?? "";
        // Fixed-box forms carry coordinates in the schema; label-anchored
        // ones report where the value actually turned up.
        const box = e?.box ?? f.box;
        const page = e?.box ? (e.page ?? 0) : f.page;
        if (!box) return null;
        return {
          ...f,
          box,
          docPage: formStartPage + page,
          confidence: e?.confidence ?? "low",
          empty: value === "" || value === "false",
        };
      })
      .filter(Boolean);
  }, [schema, entries, result?.layoutMatch, formStartPage]);

  // Selecting a field anywhere highlights it and scrolls the document to it.
  const focusField = useCallback(
    (key) => {
      setSelectedKey(key);
      const f = schema?.fields.find((x) => x.key === key);
      if (!f || !result?.layoutMatch) return;
      const e = entries[key];
      const box = e?.box ?? f.box;
      if (!box) return;
      const page = e?.box ? (e.page ?? 0) : f.page;
      syncing.current = true;
      sourcePane.current?.scrollToBox({ docPage: formStartPage + page, box });
      setTimeout(() => {
        syncing.current = false;
      }, 700);
    },
    [schema, entries, result?.layoutMatch, formStartPage],
  );

  const onSourceScroll = useCallback(() => {}, []);

  async function saveField(key, value) {
    if (!selectedId) return;
    const res = await patchField(selectedId, key, value);
    setData((d) =>
      d
        ? {
            ...d,
            result: {
              ...d.result,
              fields: res.fields,
              updatedAt: res.updatedAt,
            },
          }
        : d,
    );
  }

  async function approve() {
    if (!selectedId) return;
    setApproving(true);
    try {
      await approveFile(selectedId);
      setData((d) =>
        d ? { ...d, result: { ...d.result, approved: true } } : d,
      );
      setExportOpen(true);
    } finally {
      setApproving(false);
    }
  }

  function handleFilesSelected(newFiles) {
    addFiles(newFiles);
    navigate("/pipeline");
  }

  // Only PDFs can render in the viewer; Word/text uploads show a note and
  // the extracted data carries the weight.
  const selectedIsPdf = /\.pdf$/i.test(files.find((f) => f.id === selectedId)?.name ?? '');
  const sourceUrl = selectedId && selectedIsPdf ? rawPdfUrl(selectedId) : null;

  return (
    <div className={`review${docsOpen ? " review--docs-open" : ""}`}>
      <DocsSidebar
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        files={files}
        selectedId={selectedId}
        onSelectFile={setSelectedId}
        onFilesSelected={handleFilesSelected}
      />

      <div className="review-main">
        <ReviewHeader
          schema={schema}
          formType={result?.formType}
          showData={showData}
          onToggleData={() => setShowData((v) => !v)}
          docsOpen={docsOpen}
          onToggleDocs={() => setDocsOpen((v) => !v)}
        />

        {/* The document they uploaded on the left, what we read out of it on
            the right — the preparer checks one against the other. */}
        <div
          className={`review__panes${showData ? " review__panes--split" : ""}`}
        >
          <PdfPane
            ref={sourcePane}
            icon={
              <HugeiconsIcon
                icon={Pdf01Icon}
                size={18}
                strokeWidth={1.75}
                className="pdf-pane__icon--pdf"
              />
            }
            title={
              <select
                className="pdf-pane__file-select"
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Source document"
              >
                {readyFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            }
            fileUrl={sourceUrl}
            pageSize={schema?.pageSize}
            overlays={sourceOverlays}
            selectedKey={selectedKey}
            onOverlayClick={(key) => focusField(key)}
            onScrollPosition={onSourceScroll}
            loadingLabel="Opening your document…"
            onLoaded={() => {
              // Open on the page where the form starts, not a cover page.
              if (formStartPage > 0)
                sourcePane.current?.scrollToPosition({
                  docPage: formStartPage,
                  frac: 0,
                });
            }}
            emptyMessage={
              selectedId && !selectedIsPdf
                ? 'No page preview for Word or text files — the extracted fields are on the right.'
                : 'Select a document'
            }
          />
          {showData && (
            <ExtractedDataPanel
              schema={schema}
              result={result}
              entries={entries}
              fields={fieldList}
              tables={schema?.tables ?? []}
              selectedKey={selectedKey}
              onSelect={(key) => focusField(key)}
              onSave={saveField}
              confidenceFilter={confidenceFilter}
              onConfidenceFilter={setConfidenceFilter}
              loading={!result}
              loadError={loadError}
              approved={Boolean(result?.approved)}
              approving={approving}
              onApprove={approve}
            />
          )}
        </div>
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        fileName={files.find((f) => f.id === selectedId)?.name}
        onExport={(format) => {
          downloadExport({ fileId: selectedId, format });
          setExportOpen(false);
        }}
      />
    </div>
  );
}
