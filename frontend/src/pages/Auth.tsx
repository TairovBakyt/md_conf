import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';

import { API_URL } from '../config';

export default function Auth() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Новые стейты для обработки SOS-сигнала
  const [showSosModal, setShowSosModal] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);

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

    loading && setLoading(true);
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

  // Новая функция отправки сигнала SOS
  const handleSendSos = async () => {
    setSendingSos(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/sos-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setShowSosModal(true);
      } else {
        alert('Не удалось отправить сигнал.');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка соединения с сервером.');
    } finally {
      setSendingSos(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-100">MDCONF 2026</h1>
          <p className="text-slate-400 text-sm mt-1">Войдите, чтобы начать квест</p>
        </div>

        <Link
          to="/scan-admin"
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-3 transition-colors mb-4"
        >
          📷 Сканировать QR организатора
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-500">или вручную</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <p className="text-xs text-slate-500 text-center mb-4">
          Регистрация и вход происходят в одной форме: если вы здесь впервые — просто введите имя и придумайте PIN, профиль создастся автоматически.
        </p>

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
              Первый вход — придумайте PIN сами, он закрепится за вами.Запомните имя пользователя и PIN!
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

        {/* Кнопка SOS-помощи под формой */}
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={sendingSos}
            onClick={handleSendSos}
            className="text-slate-500 hover:text-slate-300 text-xs underline transition-colors disabled:opacity-50"
          >
            {sendingSos ? 'Отправка сигнала...' : 'Забыли PIN-код или имя пользователя?'}
          </button>
        </div>
      </div>

      {/* Модальное окно подтверждения отправки SOS */}
      {showSosModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="text-3xl mb-3">📢</div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">Сигнал отправлен!</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Пожалуйста, подойдите к стойке организатора. Назовите свое имя или никнейм, и вам прямо сейчас сбросят PIN-код!
            </p>
            <button
              onClick={() => setShowSosModal(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              Понятно, иду!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}