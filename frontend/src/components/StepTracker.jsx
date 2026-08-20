import { useEffect, useMemo, useState } from 'react';

// The pipeline's progress as a single shimmering line. Each step holds for a
// beat, then rises out of view as the next one rises in behind it.
//
// The display only ever walks forward one step at a time, even when the
// server jumps several stages between polls, so no message is skipped — but
// it never runs ahead of what the pipeline has actually reached.
const MIN_DWELL_MS = 1100;
const TRANSITION_MS = 460;

export default function StepTracker({ steps }) {
  const target = useMemo(() => {
    const error = steps.findIndex((s) => s.state === 'error');
    if (error !== -1) return error;
    const active = steps.findIndex((s) => s.state === 'active');
    if (active !== -1) return active;
    return steps.length - 1;
  }, [steps]);

  const [shown, setShown] = useState(0);
  const [outgoing, setOutgoing] = useState(null);

  useEffect(() => {
    if (shown >= target) return undefined;
    const timer = setTimeout(() => {
      setOutgoing(shown);
      setShown((s) => s + 1);
    }, MIN_DWELL_MS);
    return () => clearTimeout(timer);
  }, [shown, target]);

  useEffect(() => {
    if (outgoing === null) return undefined;
    const timer = setTimeout(() => setOutgoing(null), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [outgoing]);

  const current = steps[Math.min(shown, steps.length - 1)];
  if (!current) return null;

  return (
    <p className="step-rotator" role="status" aria-live="polite">
      {outgoing !== null && steps[outgoing] && (
        <span key={`out-${outgoing}`} className="step-rotator__line step-rotator__line--out" aria-hidden="true">
          {steps[outgoing].label}
        </span>
      )}
      <span
        key={`in-${shown}`}
        className={`step-rotator__line step-rotator__line--in${current.state === 'error' ? ' step-rotator__line--error' : ''}`}
      >
        {current.label}
      </span>
    </p>
  );
}
