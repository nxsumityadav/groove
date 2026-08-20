import { useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload03Icon } from '@hugeicons/core-free-icons';
import { ACCEPT_ATTR, filterSupportedFiles } from '../utils/files.js';
import { preloadOcr } from '../extraction/clientExtractor.js';

// One drop target, used at page size on the upload screen and compact in the
// Documents panel. Clicking anywhere in it opens the file picker.
export default function UploadDropzone({ onFilesSelected, compact = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const open = () => inputRef.current?.click();

  function handleChange(e) {
    const files = filterSupportedFiles(e.target.files);
    if (files.length > 0) onFilesSelected(files);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const files = filterSupportedFiles(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  }

  return (
    <div
      className={`dropzone${compact ? ' dropzone--compact' : ''}${dragging ? ' dropzone--dragging' : ''}`}
      onClick={open}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
        preloadOcr(); // a drag means files are coming — warm the OCR engine
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={handleChange} />
      <HugeiconsIcon icon={Upload03Icon} size={compact ? 26 : 34} strokeWidth={1.5} className="dropzone__glyph" />
      <p className="dropzone__hint">
        Drag files here or{' '}
        <button
          type="button"
          className="link-button"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          upload from computer
        </button>
      </p>
    </div>
  );
}
