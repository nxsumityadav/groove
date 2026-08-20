import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StepTracker from '../components/StepTracker.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import FileList from '../components/FileList.jsx';
import { useSessionPolling } from '../hooks/useSessionPolling.js';
import { useLocalUploads } from '../hooks/useLocalUploads.js';
import { addFiles } from '../extraction/uploadManager.js';

const DEFAULT_STEPS = [
  { step: 1, label: 'document uploaded successfully', state: 'active' },
  { step: 2, label: 'identifying forms in your return', state: 'pending' },
  { step: 3, label: 'extracting field data', state: 'pending' },
  { step: 4, label: 'populating the 2024 return for review', state: 'pending' },
  { step: 5, label: 'preparing comparison view', state: 'pending' },
];

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { status, error } = useSessionPolling(true);
  const localFiles = useLocalUploads();

  const serverFiles = status?.files ?? [];
  const files = useMemo(() => [...serverFiles, ...localFiles], [serverFiles, localFiles]);
  const localBusy = localFiles.some((f) => f.status !== 'error');

  // While files are still being read/OCR'd on this device, the aggregate
  // tracker can't be past step 1 for them — hold it there.
  const steps = useMemo(() => {
    const serverSteps = status?.aggregate?.steps ?? DEFAULT_STEPS;
    if (!localBusy) return serverSteps;
    return DEFAULT_STEPS.map((s, i) => (i === 0 ? { ...s, state: 'active' } : { ...s, state: 'pending' }));
  }, [status, localBusy]);

  const resultsReady = Boolean(status?.aggregate?.resultsReady) && !localBusy;
  const stalled = Boolean(status?.aggregate?.stalled) && !localBusy;

  // Right after an upload there's a beat where the local entry is gone but
  // the polled status hasn't caught up yet, so an empty list must persist
  // across two polls before it means "genuinely nothing here".
  const emptyPolls = useRef(0);
  useEffect(() => {
    if (status && files.length === 0) {
      emptyPolls.current += 1;
      if (emptyPolls.current >= 2) navigate('/', { replace: true });
    } else {
      emptyPolls.current = 0;
    }
  }, [status, files.length, navigate]);

  useEffect(() => {
    if (resultsReady) navigate('/review', { replace: true });
  }, [resultsReady, navigate]);

  return (
    <div className="page workspace-page">
      <div className="workspace-page__processing">
        <h1>Processing your tax return</h1>
        <p className="workspace-page__subtext">
          {stalled
            ? 'We ran into a problem processing your documents'
            : localBusy && localFiles.some((f) => f.stage === 'ocr')
              ? 'Reading your scanned pages — this one takes a little longer'
              : 'This may take a while, sit back and relax :)'}
        </p>
        <StepTracker steps={steps} />
        {error && <p className="workspace-page__error">{error}</p>}
      </div>

      {/* Per-file progress sits out of the way in the corner — the headline
          tracker is the thing to watch, this is the detail behind it. */}
      <aside className="upload-tray">
        <h2 className="upload-tray__title">Upload</h2>
        <div className="upload-tray__list">
          <FileList files={files} />
        </div>
        <UploadDropzone compact onFilesSelected={addFiles} />
      </aside>
    </div>
  );
}
