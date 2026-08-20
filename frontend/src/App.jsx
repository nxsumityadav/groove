import { Routes, Route } from 'react-router-dom';
import UploadPage from './pages/UploadPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/pipeline" element={<WorkspacePage />} />
      <Route path="/review" element={<ReviewPage />} />
    </Routes>
  );
}
