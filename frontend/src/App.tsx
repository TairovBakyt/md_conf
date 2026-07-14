import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import QuizGame from './pages/QuizGame';
import AdminPanel from './pages/AdminPanel';
import About from './pages/About';
import Prizes from './pages/Prizes';
import FilwordGame from './pages/FilwordGame';
import ScanAdmin from './pages/ScanAdmin';
import NotFound from './pages/NotFound';
import { ProtectedRoute } from './components/routes/ProtectedRoute';
import { AdminRoute } from './components/routes/AdminRoute';

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/about" element={<About />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/quiz" element={<QuizGame />} />
        <Route path="/prizes" element={<Prizes />} />
        <Route path="/filword" element={<FilwordGame />} />
        <Route path="/scan-admin" element={<ScanAdmin />} />
      </Route>

      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminPanel />} />
      </Route>

      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;