import { Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import QuizGame from './pages/QuizGame';
import AdminPanel from './pages/AdminPanel';
import About from './pages/About';
import Prizes from './pages/Prizes';
import FilwordGame from './pages/FilwordGame';

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/about" element={<About />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/quiz" element={<QuizGame />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/prizes" element={<Prizes />} />
      <Route path="/filword" element={<FilwordGame />} />
      <Route path="/" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

export default App;