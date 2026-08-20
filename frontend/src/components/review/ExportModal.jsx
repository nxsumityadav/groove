import { useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

// Shown once a document is approved: the hand-off to whatever tax software
// the preparer works in. JSON for an integration, CSV for a spreadsheet.
export default function ExportModal({ open, onClose, onExport, fileName }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="icon-button modal__close" onClick={onClose} aria-label="Close">
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
        </button>

        <span className="modal__badge" aria-hidden="true">
          <HugeiconsIcon icon={Tick02Icon} size={18} strokeWidth={2.5} />
        </span>
        <h2 id="export-title">Approved</h2>
        <p className="modal__text">
          {fileName ? <strong>{fileName}</strong> : 'This document'} is ready to hand off. Every field carries its value,
          confidence and where it was read from.
        </p>

        <div className="modal__actions">
          <button type="button" className="btn-primary" onClick={() => onExport('json')}>
            Export as JSON
          </button>
          <button type="button" className="btn-ghost btn-ghost--lg" onClick={() => onExport('csv')}>
            Export as CSV
          </button>
        </div>
      </div>
    </div>
  );
}
