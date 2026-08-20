import { HugeiconsIcon } from '@hugeicons/react';
import { SidebarLeft01Icon, SidebarRight01Icon } from '@hugeicons/core-free-icons';

// Top bar: what we're looking at, and the two panel toggles.
export default function ReviewHeader({ schema, formType, showData, onToggleData, docsOpen, onToggleDocs }) {
  return (
    <header className="review-header">
      <button
        type="button"
        className={`icon-button${docsOpen ? ' icon-button--on' : ''}`}
        onClick={onToggleDocs}
        aria-label={docsOpen ? 'Hide documents' : 'Show documents'}
        aria-pressed={docsOpen}
        title="Documents"
      >
        <HugeiconsIcon icon={SidebarLeft01Icon} size={20} strokeWidth={1.75} />
      </button>

      <span className="review-header__flag" aria-hidden="true">🇺🇸</span>
      <div className="review-header__titles">
        <h1>{schema?.jurisdiction ?? 'Document'}</h1>
        <p>{schema?.title ?? formType ?? 'Uploaded document'}</p>
      </div>

      <div className="review-header__actions">
        <button
          type="button"
          className={`icon-button${showData ? ' icon-button--on' : ''}`}
          onClick={onToggleData}
          aria-label={showData ? 'Hide extracted data' : 'Show extracted data'}
          aria-pressed={showData}
          title="Extracted data"
        >
          <HugeiconsIcon icon={SidebarRight01Icon} size={20} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
