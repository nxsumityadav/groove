import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import Tooltip from '../Tooltip.jsx';
import FieldControl from './FieldControl.jsx';

// One field in the Inputs sheet: form line number, label, a flag explaining
// anything worth checking, and the editable control.
export default function FieldRow({ field, entry, selected, onSelect, onSave, rowRef }) {
  const [saving, setSaving] = useState(false);

  const confidence = entry?.confidence ?? 'low';
  const warnings = entry?.warnings ?? [];
  const cls = [
    'field-row',
    `field-row--${confidence}`,
    selected ? 'field-row--selected' : '',
    entry?.edited ? 'field-row--edited' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} ref={rowRef} onClick={() => onSelect(field.key)}>
      <div className="field-row__meta">
        {field.line && <span className="field-row__line">{field.line}</span>}
        <span className="field-row__label">{field.label}</span>
        {warnings.length > 0 && <WarningFlag warnings={warnings} />}
        {saving && <span className="field-row__saving spinner" aria-label="Saving" />}
      </div>

      <FieldControl field={field} entry={entry} onSave={onSave} onSelect={onSelect} saving={saving} setSaving={setSaving} />
    </div>
  );
}

export function WarningFlag({ warnings }) {
  return (
    <Tooltip
      className="field-row__warn"
      content={
        <>
          <strong>Worth a second look</strong>
          {warnings.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </>
      }
    >
      <HugeiconsIcon icon={Alert02Icon} size={12} strokeWidth={2.5} aria-label="Needs review" />
    </Tooltip>
  );
}
