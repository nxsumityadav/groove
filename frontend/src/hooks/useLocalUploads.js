import { useEffect, useState } from 'react';
import { subscribe } from '../extraction/uploadManager.js';

// Pending (on-device analysis / uploading) files, shaped like server file
// entries so the same FileList can render both.
export function useLocalUploads() {
  const [pending, setPending] = useState([]);
  useEffect(() => subscribe(setPending), []);
  return pending.map((p) => ({
    id: p.localId,
    name: p.name,
    status: p.phase === 'error' ? 'error' : 'processing',
    stage: p.phase,
    statusLabel: p.label,
    progress: p.progress,
    error: p.error ? { message: p.error } : null,
    local: true,
  }));
}
