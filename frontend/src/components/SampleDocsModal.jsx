import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Pdf01Icon, File01Icon } from '@hugeicons/core-free-icons';

const SAMPLES = [
  { id: '1040', name: 'Form 1040', size: 182621, icon: Pdf01Icon },
  { id: '1040-scanned', name: 'Form 1040', size: 1151883, icon: Pdf01Icon },
  { id: 'w2', name: 'Form W-2', size: 2552, icon: Pdf01Icon },
  { id: '1099int', name: 'Form 1099-INT', size: 2151, icon: Pdf01Icon },
  { id: 'w2-docx', name: 'Form W-2', size: 1299, icon: File01Icon },
];

function formatSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function SampleDocsModal({ open, onClose, onPick }) {
  const [busyId, setBusyId] = useState(null);
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

  async function pick(sample) {
    setBusyId(sample.id);
    try {
      const res = await fetch(`/api/samples/${sample.id}`);
      if (!res.ok) throw new Error('Sample unavailable');
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${sample.id}.pdf`;
      onPick(new File([blob], name, { type: blob.type }));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--samples"
        role="dialog"
        aria-modal="true"
        aria-labelledby="samples-title"
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="icon-button modal__close" onClick={onClose} aria-label="Close">
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
        </button>

        <h2 id="samples-title">No documents handy?</h2>
        <p className="modal__text">Try a sample. It runs through the exact same pipeline as a real upload.</p>

        <ul className="sample-list">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <button type="button" className="sample-item" disabled={busyId !== null} onClick={() => pick(s)}>
                <span className="sample-item__icon" aria-hidden="true">
                  <HugeiconsIcon icon={s.icon} size={20} strokeWidth={1.75} />
                </span>
                <span className="sample-item__text">
                  <strong>{s.name}</strong>
                  <span>{formatSize(s.size)}</span>
                </span>
                {busyId === s.id && <span className="spinner" aria-label="Loading" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
