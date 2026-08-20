import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { addFiles } from './extraction/uploadManager.js';

// Dev hook so the on-device pipeline can be driven from the console/tests.
if (import.meta.env.DEV) window.__groove = { addFiles };

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
