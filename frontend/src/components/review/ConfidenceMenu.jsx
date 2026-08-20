import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';

// "Confidence: Default ⌄" pill with a popup menu. A custom menu rather than a
// native <select> so the trigger and options can be styled to match the form.
const OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'all', label: 'Default' },
];

export default function ConfidenceMenu({ value, onChange, counts }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[3];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="conf-menu" ref={rootRef}>
      <button
        type="button"
        className="conf-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="conf-menu__label">Confidence:</span>
        <span className="conf-menu__value">{current.label}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={2} />
      </button>

      {open && (
        <ul className="conf-menu__list" role="listbox" aria-label="Filter by confidence">
          {OPTIONS.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`conf-menu__item${o.value === value ? ' conf-menu__item--on' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                <span className="conf-menu__count">{counts[o.value]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
