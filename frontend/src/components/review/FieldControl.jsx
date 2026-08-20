import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import SegmentedInput from './SegmentedInput.jsx';

// The editable control for one field, shared by the Inputs list and the
// table view so both behave identically: local draft, save on blur/Enter,
// Escape to revert, spinner while saving. Rendering follows the field type
// so the input reads like the box printed on the form.
export default function FieldControl({ field, entry, onSave, onSelect, saving, setSaving }) {
  const [draft, setDraft] = useState(entry?.value ?? '');

  useEffect(() => {
    setDraft(entry?.value ?? '');
  }, [entry?.value]);

  async function commit(value) {
    if (value === (entry?.value ?? '')) return;
    setSaving?.(true);
    try {
      await onSave(field.key, value);
    } finally {
      setSaving?.(false);
    }
  }

  if (field.type === 'checkbox') {
    return (
      <div className="field-toggle" role="group" aria-label={field.label}>
        {[
          ['true', 'Yes'],
          ['false', 'No'],
        ].map(([v, label]) => (
          <button
            type="button"
            key={v}
            className={`toggle${draft === v ? ' toggle--on' : ''}`}
            disabled={saving}
            onClick={(e) => {
              e.stopPropagation();
              setDraft(v);
              commit(v);
            }}
          >
            <span className="toggle__box" aria-hidden="true">
              {draft === v ? <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={3} /> : null}
            </span>
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === 'ssn') {
    return (
      <SegmentedInput
        groups={[3, 2, 4]}
        value={draft}
        disabled={saving}
        ariaLabel={field.label}
        onCommit={(v) => {
          setDraft(v);
          commit(v);
        }}
      />
    );
  }

  const money = field.type === 'money';
  return (
    <div className={`field-input${money ? ' field-input--money' : ''}`}>
      {money && <span className="field-input__affix">$</span>}
      <input
        value={draft}
        placeholder={money ? '0' : 'N/A'}
        disabled={saving}
        aria-label={field.label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft.trim())}
        onFocus={() => onSelect?.(field.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(entry?.value ?? '');
        }}
      />
    </div>
  );
}
