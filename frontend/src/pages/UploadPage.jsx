import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import UploadDropzone from '../components/UploadDropzone.jsx';
import SampleDocsModal from '../components/SampleDocsModal.jsx';
import { addFiles } from '../extraction/uploadManager.js';
import { filterSupportedFiles } from '../utils/files.js';
import { preloadOcr } from '../extraction/clientExtractor.js';

const CHECKLIST = [
  'Add your federal return, plus state and city ones if you have them',
  'PDF, Word (.docx) and text files all work. Just remove any password first',
  'The newer the return, the better the results',
];

export default function UploadPage() {
  const navigate = useNavigate();
  // Offer the samples once per browser session to anyone landing empty-handed;
  // after that the link under the drop zone reopens it.
  const [samplesOpen, setSamplesOpen] = useState(() => !sessionStorage.getItem('groove-samples-offered'));

  // Fetch the OCR engine while the user is still picking files, so a scanned
  // upload starts reading instantly instead of downloading ~5MB first.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 800));
    const id = idle(() => preloadOcr());
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, []);

  function handleFilesSelected(files) {
    // Analysis (text layer → on-device OCR → field extraction) starts in the
    // browser immediately; the processing page shows its progress.
    addFiles(files);
    navigate('/pipeline');
  }

  function closeSamples() {
    sessionStorage.setItem('groove-samples-offered', '1');
    setSamplesOpen(false);
  }

  function handlePageDrop(e) {
    e.preventDefault();
    const files = filterSupportedFiles(e.dataTransfer.files);
    if (files.length > 0) handleFilesSelected(files);
  }

  return (
    <div className="page upload-page" onDragOver={(e) => e.preventDefault()} onDrop={handlePageDrop}>
      <h1>Upload your prior year tax return</h1>

      <UploadDropzone onFilesSelected={handleFilesSelected} />

      <p className="upload-page__samples">
        No documents handy?{' '}
        <button type="button" className="link-button" onClick={() => setSamplesOpen(true)}>
          Try a sample
        </button>
      </p>

      <div className="upload-page__checklist">
        <h2>Before you upload</h2>
        <ul>
          {CHECKLIST.map((item) => (
            <li key={item}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={2} className="upload-page__check" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <SampleDocsModal
        open={samplesOpen}
        onClose={closeSamples}
        onPick={(file) => {
          closeSamples();
          handleFilesSelected([file]);
        }}
      />
    </div>
  );
}
