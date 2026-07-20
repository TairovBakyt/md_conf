import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';
import { ProtectedRoute } from './components/routes/ProtectedRoute';
import { AdminRoute } from './components/routes/AdminRoute';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuizGame = lazy(() => import('./pages/QuizGame'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const About = lazy(() => import('./pages/About'));
const Prizes = lazy(() => import('./pages/Prizes'));
const FilwordGame = lazy(() => import('./pages/FilwordGame'));
const ScanAdmin = lazy(() => import('./pages/ScanAdmin'));
const QuickRegister = lazy(() => import('./pages/QuickRegister'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <span className="text-slate-400">Загружаем...</span>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/about" element={<About />} />
        <Route path="/register" element={<QuickRegister />} />
        <Route path="/scan-admin" element={<ScanAdmin />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/quiz" element={<QuizGame />} />
          <Route path="/prizes" element={<Prizes />} />
          <Route path="/filword" element={<FilwordGame />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;