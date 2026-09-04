import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "../authorization/UserContext";

import { API_URL } from "../config";

export default function Auth() {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Новые стейты для обработки SOS-сигнала
  const [showSosModal, setShowSosModal] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);

  // Бэкенд ответил 409: такие 4 цифры уже кем-то заняты. Возможно, человек
  // забыл букву от своего PIN — переспрашиваем, прежде чем создавать дубль.
  // Бэкенд ответил 409: PIN занят другим человеком — просим дописать символ.
  const [needsExtraChar, setNeedsExtraChar] = useState(false);

  const { setUser } = useUser();
  const navigate = useNavigate();

  const submitAuth = async () => {
    setError("");

    const trimmedPin = pin.trim().toLowerCase();

    if (!trimmedPin) {
      setError("Введите PIN");
      return;
    }

    if (!/^\d{4}[a-z0-9]*$/.test(trimmedPin)) {
      setError("PIN начинается с 4 цифр");
      return;
    }

    if (!username.trim()) {
      setError("Введите имя пользователя");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin: trimmedPin }),
      });

      const data = await response.json();

      if (response.status === 409 && data.needsExtraChar) {
        setNeedsExtraChar(true);
        setError(data.error);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(data.error || "Не удалось войти");
        setLoading(false);
        return;
      }

      setUser(data);

      // Система дописала символ, потому что выбранный PIN уже был занят —
      // человек об этом не знает, надо показать ему итоговый PIN.
      if (data.pinWasModified) {
        sessionStorage.setItem("mdconf_new_pin", data.pin_code);
      }

      if (data.is_admin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError("Сервер недоступен. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitAuth();
  };

  // Новая функция отправки сигнала SOS
  const handleSendSos = async () => {
    setSendingSos(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/sos-signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setShowSosModal(true);
      } else {
        alert("Не удалось отправить сигнал.");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка соединения с сервером.");
    } finally {
      setSendingSos(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-100">MDCONF 2026</h1>
          <p className="text-slate-400 text-sm mt-1">
            Войдите, чтобы начать квест
          </p>
        </div>

        <Link
          to="/scan-admin"
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-3 transition-colors mb-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 shrink-0"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Сканировать QR организатора
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-500">или вручную</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <p className="text-xs text-slate-500 text-center mb-4">
                    Впервые? Введите имя и придумайте 4 цифры — это будет ваш PIN. Если
          уже регистрировались, введите то же имя и тот же PIN.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">
              Имя пользователя
            </label>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-slate-300">PIN-код</label>
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="text-white hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPin ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.9 18.9 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.9 18.9 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>
            <input
              type={showPin ? "text" : "password"}
              inputMode="text"
              maxLength={needsExtraChar ? 6 : 4}
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/[^0-9a-zA-Z]/g, ""))
              }
                            placeholder="••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors tracking-[0.3em]"
              autoComplete="off"
            />
            <p className="text-xs text-slate-500 mt-1.5">
                            Запомните свой PIN — он понадобится для повторного входа. Всегда
              можно посмотреть в разделе «Мой QR».
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
            {loading ? "Входим..." : "Войти"}
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
            {sendingSos
              ? "Отправка сигнала..."
              : "Забыли PIN-код или имя пользователя?"}
          </button>
        </div>
      </div>

      {/* {confirmCreate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-100 mb-2">
              Вы здесь впервые?
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              Профиль с цифрами {pin} уже существует. Если вы регистрировались
              раньше, ваш PIN выглядит как {pin} + буква — вернитесь и введите
              его целиком. Если вы новый участник, создадим отдельный профиль.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setConfirmCreate(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Я уже регистрировался — ввести букву
              </button>
              <button
                onClick={() => {
                  setConfirmCreate(false);
                  submitAuth(true);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Я новый участник — создать профиль
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Модальное окно подтверждения отправки SOS */}
      {showSosModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="text-3xl mb-3">📢</div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">
              Сигнал отправлен!
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Пожалуйста, подойдите к стойке организатора. Назовите свое имя или
              никнейм, и вам прямо сейчас сбросят PIN-код!
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
