import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';

export default function QuickRegister() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setUser } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Введите ваше имя');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/quick-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Не удалось зарегистрироваться');
        setLoading(false);
        return;
      }

      setUser(data);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Сервер недоступен. Попробуйте позже.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-100">MDCONF 2026</h1>
          <p className="text-slate-400 text-sm mt-1">Добро пожаловать! Как вас зовут?</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Например, Бакыт"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-slate-100 text-base placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-3 transition-colors"
          >
            {loading ? 'Регистрируем...' : 'Начать'}
          </button>
        </form>

        <Link
          to="/auth"
          className="block text-center mt-4 text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          Уже участвовали? Войти по имени и PIN
        </Link>
      </div>
    </div>
  );
}