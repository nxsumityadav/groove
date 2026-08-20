import { useEffect, useRef, useState } from 'react';

// Character-box input that mirrors the comb boxes printed on the form
// (SSNs are 3-2-4). Typing auto-advances, backspace steps back, and a paste
// of the whole value fills every group.
export default function SegmentedInput({ groups = [3, 2, 4], value, onCommit, ariaLabel, disabled }) {
  const digitsOf = (v) => String(v ?? '').replace(/\D/g, '');
  const split = (digits) => {
    const out = [];
    let i = 0;
    for (const len of groups) {
      out.push(digits.slice(i, i + len));
      i += len;
    }
    return out;
  };

  const [parts, setParts] = useState(() => split(digitsOf(value)));
  const refs = useRef([]);

  useEffect(() => {
    setParts(split(digitsOf(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next) => {
    const digits = next.join('');
    if (digits === digitsOf(value)) return;
    // Only a complete value is meaningful; a partial one is still saved so
    // the person doesn't silently lose what they typed.
    const total = groups.reduce((a, b) => a + b, 0);
    onCommit(digits.length === total ? next.join('-') : digits);
  };

  const setPart = (i, raw) => {
    const len = groups[i];
    const digits = raw.replace(/\D/g, '');
    // A full-value paste spills across the remaining groups.
    if (digits.length > len) {
      const all = (parts.slice(0, i).join('') + digits).slice(0, groups.reduce((a, b) => a + b, 0));
      const next = split(all);
      setParts(next);
      commit(next);
      const lastFilled = next.findIndex((p, idx) => p.length < groups[idx]);
      refs.current[lastFilled === -1 ? groups.length - 1 : lastFilled]?.focus();
      return;
    }
    const next = [...parts];
    next[i] = digits;
    setParts(next);
    if (digits.length === len && i < groups.length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {groups.map((len, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="segmented__box"
          // Each character needs its own cell plus the tracking between them.
          style={{ width: `calc(${len}ch + ${len * 0.22}em + 20px)` }}
          value={parts[i] ?? ''}
          inputMode="numeric"
          maxLength={len}
          disabled={disabled}
          aria-label={`${ariaLabel} part ${i + 1}`}
          onChange={(e) => setPart(i, e.target.value)}
          onBlur={() => commit(parts)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !parts[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      ))}
    </div>
  );
}
