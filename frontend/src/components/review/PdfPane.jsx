import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { HugeiconsIcon } from '@hugeicons/react';
import { ZoomInAreaIcon, ZoomOutAreaIcon, ArrowLeft01Icon, ArrowRight01Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '../../extraction/pdfjs.js'; // configures the shared pdf.js worker
import { useElementWidth } from '../../hooks/useElementWidth.js';
import LoadingState from '../LoadingState.jsx';

const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2];
const SUPPRESS_MS = 180;

// A continuous (all pages stacked) PDF viewer pane with its own toolbar and
// a layer of clickable field overlays positioned in PDF coordinates.
//
// Two panes are kept in step by the parent: this pane reports where it is
// as { docPage, frac } (page index + fraction down that page) via
// onScrollPosition, and can be told to go somewhere with scrollToPosition /
// scrollToBox. `pageOffset` is the doc page index where form page 0 lives
// (uploads can have cover pages), so parents can convert between the two.
const PdfPane = forwardRef(function PdfPane(
  {
    title,
    icon,
    fileUrl,
    pageSize,
    overlays = [], // [{ key, docPage, box, confidence, empty, label, line }]
    selectedKey,
    onOverlayClick,
    onScrollPosition,
    onLoaded,
    tint = false,
    // Only the generated return is editable; the uploaded original is a
    // read-only reference, so it highlights fields but shows no edit affordance.
    editable = false,
    emptyMessage = 'Nothing to show',
    loadingLabel = 'Loading…',
    toolbarExtra,
  },
  ref
) {
  const [containerRef, containerWidth] = useElementWidth();
  const scrollRef = useRef(null);
  const pageEls = useRef([]);
  const suppressUntil = useRef(0);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(2);

  const zoom = ZOOM_STEPS[zoomIdx];
  const baseWidth = Math.max(280, Math.min(containerWidth - 48, 720));
  const renderWidth = Math.round(baseWidth * zoom);
  const size = pageSize ?? { width: 612, height: 792 };
  const scale = renderWidth / size.width;

  useEffect(() => {
    setNumPages(0);
    setCurrentPage(1);
    pageEls.current = [];
  }, [fileUrl]);

  // Page wrappers get an explicit height from the page aspect ratio, so the
  // scroll geometry is known as soon as the page count is — before canvases
  // paint. Tell the parent then, so it can position us.
  const pageHeightPx = Math.round(renderWidth * (size.height / size.width));
  useEffect(() => {
    if (numPages > 0) {
      const id = requestAnimationFrame(() => onLoaded?.(numPages));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, fileUrl]);

  const scrollEl = () => scrollRef.current;

  // Programmatic scrolls should not echo back out as user scroll events.
  const scrollTo = useCallback((top, smooth) => {
    const el = scrollEl();
    if (!el) return;
    suppressUntil.current = Date.now() + SUPPRESS_MS + (smooth ? 400 : 0);
    el.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Page top in scroll-container coordinates (what scrollTop is measured in).
  const pageGeometry = (docPage) => {
    const el = pageEls.current[docPage];
    const sc = scrollEl();
    if (!el || !sc) return null;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    return { top, height: el.offsetHeight };
  };

  useImperativeHandle(
    ref,
    () => ({
      scrollToPosition({ docPage, frac }, smooth = false) {
        const g = pageGeometry(docPage);
        if (!g) return;
        scrollTo(g.top + frac * g.height, smooth);
      },
      // Bring a PDF-coordinate box on a page into view, ~30% from the top.
      scrollToBox({ docPage, box }, smooth = true) {
        const g = pageGeometry(docPage);
        const el = scrollEl();
        if (!g || !el) return;
        const boxTop = g.top + ((size.height - box.y2) / size.height) * g.height;
        scrollTo(boxTop - el.clientHeight * 0.3, smooth);
      },
      getPosition() {
        return readPosition();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollTo, size.height]
  );

  const readPosition = () => {
    const el = scrollEl();
    if (!el || numPages === 0) return null;
    const y = el.scrollTop;
    for (let i = 0; i < numPages; i++) {
      const g = pageGeometry(i);
      if (!g) continue;
      if (y < g.top + g.height || i === numPages - 1) {
        return { docPage: i, frac: Math.min(1, Math.max(0, (y - g.top) / g.height)) };
      }
    }
    return null;
  };

  const handleScroll = () => {
    const pos = readPosition();
    if (!pos) return;
    // The page shown in the indicator is the one under the top third.
    const el = scrollEl();
    const probe = el.scrollTop + el.clientHeight / 3;
    let shown = 1;
    for (let i = 0; i < numPages; i++) {
      const g = pageGeometry(i);
      if (g && probe >= g.top) shown = i + 1;
    }
    setCurrentPage(shown);
    if (Date.now() < suppressUntil.current) return;
    onScrollPosition?.(pos);
  };

  const goToPage = (n) => {
    const g = pageGeometry(n - 1);
    if (g) {
      scrollTo(g.top, true);
      onScrollPosition?.({ docPage: n - 1, frac: 0 });
    }
  };

  const overlaysByPage = useMemo(() => {
    const map = new Map();
    for (const o of overlays) {
      if (!map.has(o.docPage)) map.set(o.docPage, []);
      map.get(o.docPage).push(o);
    }
    return map;
  }, [overlays]);

  return (
    <section className="pdf-pane">
      <header className="pdf-pane__toolbar">
        <div className="pdf-pane__title">
          {icon && <span className="pdf-pane__icon" aria-hidden="true">{icon}</span>}
          <span className="pdf-pane__title-text">{title}</span>
        </div>
        <div className="pdf-pane__controls">
          <button type="button" onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} aria-label="Zoom out">
            <HugeiconsIcon icon={ZoomOutAreaIcon} size={18} strokeWidth={1.75} />
          </button>
          <span className="pdf-pane__zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))} disabled={zoomIdx === ZOOM_STEPS.length - 1} aria-label="Zoom in">
            <HugeiconsIcon icon={ZoomInAreaIcon} size={18} strokeWidth={1.75} />
          </button>
          <span className="pdf-pane__sep" />
          <button type="button" onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} aria-label="Previous page">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} strokeWidth={1.75} />
          </button>
          <span className="pdf-pane__pages">{numPages ? `${currentPage} / ${numPages}` : '–'}</span>
          <button type="button" onClick={() => goToPage(Math.min(numPages || 1, currentPage + 1))} disabled={!numPages || currentPage >= numPages} aria-label="Next page">
            <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={1.75} />
          </button>
          {toolbarExtra}
        </div>
      </header>

      <div className="pdf-pane__scroll" ref={(el) => { containerRef.current = el; scrollRef.current = el; }} onScroll={handleScroll}>
        {!fileUrl ? (
          typeof emptyMessage === 'string' ? (
            <div className="pdf-pane__empty">{emptyMessage}</div>
          ) : (
            emptyMessage
          )
        ) : (
          <Document
            key={fileUrl}
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<LoadingState label={loadingLabel} />}
            error={<div className="pdf-pane__empty">Couldn't load this PDF.</div>}
          >
            <div className="pdf-pages" style={{ width: renderWidth }}>
              {Array.from({ length: numPages }, (_, i) => (
                <div
                  key={i}
                  className={`pdf-page-wrap${tint ? ' pdf-page-wrap--tint' : ''}`}
                  style={{ width: renderWidth, minHeight: pageHeightPx }}
                  ref={(el) => {
                    pageEls.current[i] = el;
                  }}
                >
                  <Page pageNumber={i + 1} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                  {(overlaysByPage.get(i) ?? []).length > 0 && (
                    <div className="pdf-overlays">
                      {overlaysByPage.get(i).map((o) => {
                        const { x1, y1, x2, y2 } = o.box;
                        const style = {
                          left: x1 * scale,
                          top: (size.height - y2) * scale,
                          width: (x2 - x1) * scale,
                          height: (y2 - y1) * scale,
                        };
                        const cls = [
                          'field-overlay',
                          `field-overlay--${o.confidence}`,
                          o.key === selectedKey ? 'field-overlay--selected' : '',
                          o.empty ? 'field-overlay--empty' : '',
                          editable ? '' : 'field-overlay--readonly',
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <button
                            type="button"
                            key={o.key}
                            className={cls}
                            style={style}
                            title={`${o.line ? o.line + ' · ' : ''}${o.label}`}
                            onClick={() => onOverlayClick?.(o.key)}
                          >
                            {editable && o.key === selectedKey && (
                              <span className="field-overlay__pencil" aria-hidden="true">
                                <HugeiconsIcon icon={PencilEdit02Icon} size={12} strokeWidth={2} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Document>
        )}
      </div>
    </section>
  );
});

export default PdfPane;
