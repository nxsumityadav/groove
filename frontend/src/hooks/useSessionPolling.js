import { useEffect, useRef, useState } from 'react';
import { getSessionStatus } from '../api/client.js';

const POLL_INTERVAL_MS = 1500;

export function useSessionPolling(active) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;

    async function poll() {
      try {
        const data = await getSessionStatus();
        if (cancelled) return;
        setStatus(data);
        if (data.aggregate.allDone && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  return { status, error };
}
