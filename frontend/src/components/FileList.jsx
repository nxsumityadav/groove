import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Alert02Icon } from '@hugeicons/core-free-icons';

const STATUS_LABEL = {
  uploading: 'Uploading',
  processing: 'Analyzing',
  ready: 'Ready',
  error: 'Error',
};

export default function FileList({ files, selectedId, onSelect }) {
  if (files.length === 0) return null;

  return (
    <ul className="file-list">
      {files.map((file) => {
        const clickable = typeof onSelect === 'function' && file.status === 'ready';
        const label = file.statusLabel ?? STATUS_LABEL[file.status] ?? file.status;
        return (
          <li
            key={file.id}
            className={[
              'file-list__item',
              `file-list__item--${file.status}`,
              file.id === selectedId ? 'file-list__item--selected' : '',
              clickable ? 'file-list__item--clickable' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={clickable ? () => onSelect(file.id) : undefined}
            title={file.error?.message ?? file.name}
          >
            <span className="file-list__status-icon" aria-hidden="true">
              {file.status === 'ready' ? (
                <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={2.5} />
              ) : file.status === 'error' ? (
                <HugeiconsIcon icon={Alert02Icon} size={12} strokeWidth={2.5} />
              ) : (
                <span className="spinner" />
              )}
            </span>
            <span className="file-list__name">{file.name}</span>
            <span className="file-list__status">
              {label}
              {typeof file.progress === 'number' && file.progress > 0 && file.progress < 1 ? ` ${Math.round(file.progress * 100)}%` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
