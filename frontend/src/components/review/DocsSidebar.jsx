import UploadDropzone from '../UploadDropzone.jsx';
import FileList from '../FileList.jsx';

// Docked "Documents" panel: the list of uploads takes the space, and the
// drop target sits at the bottom, out of the way of the thing you came here
// to do. On narrow screens it slides over the content instead of docking.
export default function DocsSidebar({ open, onClose, files, selectedId, onSelectFile, onFilesSelected }) {
  return (
    <>
      {open && <div className="docs-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className={`docs-sidebar${open ? ' docs-sidebar--open' : ''}`} aria-hidden={!open}>
        <div className="docs-sidebar__inner">
          <div className="docs-sidebar__header">
            <h2>Documents</h2>
          </div>
          <div className="docs-sidebar__list">
            <FileList files={files} selectedId={selectedId} onSelect={onSelectFile} />
          </div>
          <UploadDropzone compact onFilesSelected={onFilesSelected} />
        </div>
      </aside>
    </>
  );
}
