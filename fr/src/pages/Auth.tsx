import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';
import { Link } from 'react-router-dom';

import { API_URL } from '../config';

export default function Auth() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Введите имя пользователя');
      return;
    }
    if (pin.length !== 4) {
      setError('PIN должен состоять из 4 цифр');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Не удалось войти');
        setLoading(false);
        return;
      }

      setUser(data);

      if (data.is_admin) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('Сервер недоступен. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-100">MDCONF 2026</h1>
          <p className="text-slate-400 text-sm mt-1">Войдите, чтобы начать квест</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Имя пользователя</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Например, Bakhyt"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">PIN-код (4 цифры)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors tracking-[0.3em]"
              autoComplete="off"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Первый вход — придумайте PIN сами, он закрепится за вами
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
          <Link to="/about" className="block text-center mt-4 text-slate-500 hover:text-slate-300 text-xs transition-colors">
  О конференции
</Link>
      </div>
    </div>
  );
}