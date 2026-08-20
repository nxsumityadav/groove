import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Hover/focus tooltip rendered in a portal, so scrolling containers (the
// Inputs sheet) can't clip it. Positioned above the trigger, flipped below
// when there isn't room.
export default function Tooltip({ content, children, className = '' }) {
  const triggerRef = useRef(null);
  const [pos, setPos] = useState(null);

  if (!content) return children;

  const show = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = r.top < 120;
    setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  const hide = () => setPos(null);

  return (
    <>
      <span
        ref={triggerRef}
        className={className}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <span
            role="tooltip"
            className={`tooltip${pos.below ? ' tooltip--below' : ''}`}
            style={{ left: pos.x, top: pos.y }}
          >
            {content}
          </span>,
          document.body
        )}
    </>
  );
}
