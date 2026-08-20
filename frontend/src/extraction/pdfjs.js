import { pdfjs } from 'react-pdf';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// One pdf.js instance/worker for both the viewer (react-pdf) and the
// on-device extractor.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export { pdfjs };
