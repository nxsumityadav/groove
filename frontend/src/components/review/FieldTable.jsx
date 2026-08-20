import { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import FieldControl from './FieldControl.jsx';
import { WarningFlag } from './FieldRow.jsx';

// Sections that are a grid on the printed form (the Dependents block) are
// shown as the same grid here, so the Inputs sheet reads like the paper.
// Rows are the form's fixed slots — they can be selected and cleared, but
// not added or removed, because the form itself has a fixed number of them.
export default function FieldTable({ table, fields, entries, selectedKey, onSelect, onSave }) {
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [clearing, setClearing] = useState(false);

  const byKey = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);
  const rowHasValue = (row) => table.columns.some((c) => (entries[row.fields[c.key]]?.value ?? '') !== '');

  const toggleRow = (id) =>
    setSelectedRows((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filledRows = table.rows.filter(rowHasValue);
  const allSelected = filledRows.length > 0 && filledRows.every((r) => selectedRows.has(r.id));

  async function clearRows(rows) {
    setClearing(true);
    try {
      for (const row of rows) {
        for (const c of table.columns) {
          const key = row.fields[c.key];
          if ((entries[key]?.value ?? '') !== '') await onSave(key, '');
        }
      }
      setSelectedRows(new Set());
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="field-table">
      <div className="field-table__bar">
        <label className="field-table__select-all">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={filledRows.length === 0}
            onChange={() => setSelectedRows(allSelected ? new Set() : new Set(filledRows.map((r) => r.id)))}
          />
          <span>{selectedRows.size > 0 ? `${selectedRows.size} selected` : 'Select all'}</span>
        </label>
        {selectedRows.size > 0 && (
          <button
            type="button"
            className="btn-ghost btn-ghost--danger"
            disabled={clearing}
            onClick={() => clearRows(table.rows.filter((r) => selectedRows.has(r.id)))}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.75} />
            {clearing ? 'Clearing…' : `Clear ${selectedRows.size === 1 ? 'entry' : 'entries'}`}
          </button>
        )}
      </div>

      <div className="field-table__scroll">
        <table>
          <thead>
            <tr>
              <th className="field-table__pick" scope="col">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col">Slot</th>
              {table.columns.map((c) => (
                <th key={c.key} scope="col">
                  {c.label}
                </th>
              ))}
              <th className="field-table__actions" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const picked = selectedRows.has(row.id);
              const filled = rowHasValue(row);
              return (
                <tr key={row.id} className={picked ? 'is-picked' : ''}>
                  <td className="field-table__pick">
                    <button
                      type="button"
                      className={`row-check${picked ? ' row-check--on' : ''}`}
                      onClick={() => toggleRow(row.id)}
                      disabled={!filled}
                      aria-label={`Select ${row.label}`}
                      aria-pressed={picked}
                    >
                      {picked && <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={3} />}
                    </button>
                  </td>
                  <th scope="row" className="field-table__slot">
                    {row.label}
                  </th>
                  {table.columns.map((c) => {
                    const key = row.fields[c.key];
                    const field = byKey[key];
                    const entry = entries[key];
                    if (!field) return <td key={c.key} />;
                    const warnings = entry?.warnings ?? [];
                    return (
                      <td
                        key={c.key}
                        className={`field-table__cell field-table__cell--${entry?.confidence ?? 'low'}${key === selectedKey ? ' is-selected' : ''}`}
                        onClick={() => onSelect(key)}
                      >
                        <div className="field-table__cell-inner">
                          <FieldControl field={field} entry={entry} onSave={onSave} onSelect={onSelect} />
                          {warnings.length > 0 && <WarningFlag warnings={warnings} />}
                        </div>
                      </td>
                    );
                  })}
                  <td className="field-table__actions">
                    <button
                      type="button"
                      className="icon-button"
                      disabled={!filled || clearing}
                      onClick={() => clearRows([row])}
                      aria-label={`Clear ${row.label}`}
                      title="Clear this entry"
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
