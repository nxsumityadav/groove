import { useEffect, useMemo, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { FileValidationIcon } from '@hugeicons/core-free-icons';
import FieldRow from './FieldRow.jsx';
import FieldTable from './FieldTable.jsx';
import ConfidenceMenu from './ConfidenceMenu.jsx';
import LoadingState from '../LoadingState.jsx';

// What we pulled out of the document, which is the thing a preparer is here
// to check and hand downstream. Sits beside the original so every value can
// be traced back to where it came from on the page.
const METHOD_LABEL = {
  positional: 'Read from the document’s own text',
  label: 'Read from the form’s printed labels',
  'positional-ocr': 'Read from a scan',
  'label-ocr': 'Read from a scan, by label',
  llm: 'Matched by AI from the text',
  none: 'Not extracted',
};

export default function ExtractedDataPanel({
  schema,
  result,
  entries,
  fields,
  tables = [],
  selectedKey,
  onSelect,
  onSave,
  confidenceFilter,
  onConfidenceFilter,
  loading,
  loadError,
  approved,
  approving,
  onApprove,
}) {
  const rowRefs = useRef({});

  const counts = useMemo(() => {
    const c = { all: fields.length, low: 0, medium: 0, high: 0 };
    for (const f of fields) c[entries[f.key]?.confidence ?? 'low']++;
    return c;
  }, [fields, entries]);

  const visible = useMemo(
    () => (confidenceFilter === 'all' ? fields : fields.filter((f) => (entries[f.key]?.confidence ?? 'low') === confidenceFilter)),
    [fields, entries, confidenceFilter]
  );

  const sections = useMemo(() => {
    const map = new Map();
    for (const f of visible) {
      if (!map.has(f.section)) map.set(f.section, []);
      map.get(f.section).push(f);
    }
    return Array.from(map.entries());
  }, [visible]);

  // Picking a field on the page brings its row into view here.
  useEffect(() => {
    if (!selectedKey) return undefined;
    let tries = 0;
    let timer;
    const attempt = () => {
      const el = rowRefs.current[selectedKey];
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      if (tries++ < 20) timer = setTimeout(attempt, 50);
    };
    attempt();
    return () => clearTimeout(timer);
  }, [selectedKey]);

  const method = result?.extractionMethod ?? 'none';
  const methodLabel = METHOD_LABEL[method] ?? METHOD_LABEL[method.replace(/^.*\+/, '')] ?? method;

  return (
    <section className="data-pane">
      <header className="pdf-pane__toolbar">
        <div className="pdf-pane__title">
          <span className="pdf-pane__icon" aria-hidden="true">
            <HugeiconsIcon icon={FileValidationIcon} size={18} strokeWidth={1.75} />
          </span>
          <span className="pdf-pane__title-text">{result?.formType ? `${result.formType} — extracted data` : 'Extracted data'}</span>
        </div>
        {fields.length > 0 && <ConfidenceMenu value={confidenceFilter} onChange={onConfidenceFilter} counts={counts} />}
      </header>

      <div className="data-pane__scroll">
        {loadError ? (
          <div className="pdf-pane__empty">{loadError}</div>
        ) : loading ? (
          <LoadingState label="Retrieving fields…" />
        ) : (
          <>
            <div className="data-pane__meta">
              <span className={`chip chip--${method.includes('llm') ? 'medium' : method.includes('ocr') ? 'medium' : 'high'}`}>{methodLabel}</span>
              {counts.low > 0 && <span className="chip chip--low">{counts.low} to check</span>}
            </div>

            {(result?.warnings ?? []).length > 0 && (
              <ul className="data-pane__warnings">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {sections.length === 0 && <p className="data-pane__none">No fields match this filter.</p>}

            {sections.map(([section, list]) => {
              // A section printed as a grid on the form stays a grid here —
              // but only unfiltered, so narrowing by confidence still works.
              const table = confidenceFilter === 'all' ? tables.find((t) => t.section === section) : null;
              return (
                <section key={section} className="inputs-section">
                  <h3>{section}</h3>
                  {table ? (
                    <FieldTable table={table} fields={list} entries={entries} selectedKey={selectedKey} onSelect={onSelect} onSave={onSave} />
                  ) : (
                    list.map((f) => (
                      <FieldRow
                        key={f.key}
                        field={f}
                        entry={entries[f.key]}
                        selected={f.key === selectedKey}
                        onSelect={onSelect}
                        onSave={onSave}
                        rowRef={(el) => {
                          rowRefs.current[f.key] = el;
                        }}
                      />
                    ))
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>

      <footer className="data-pane__footer">
        <button type="button" className={`btn-approve${approved ? ' btn-approve--done' : ''}`} onClick={onApprove} disabled={!result || approving}>
          {approved ? 'Approved' : approving ? 'Approving…' : 'Approve'}
        </button>
      </footer>
    </section>
  );
}
