import React, { useEffect, useState } from 'react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

interface GameSettings {
  quiz_unlocked: boolean;
  filword_unlocked: boolean;
  quiz_start_time: string | null;
}

export const GamesView: React.FC = () => {
  const { user } = useUser();
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    quiz_unlocked: false,
    filword_unlocked: false,
    quiz_start_time: null,
  });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchGameSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const data = await res.json();
      if (res.ok) {
        setGameSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameSettings();
    const interval = setInterval(fetchGameSettings, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleGame = async (game: 'filword', unlocked: boolean) => {
    if (!user) return;

    setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: unlocked }));

    try {
      const res = await fetch(`${API_URL}/api/admin/toggle-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, game, unlocked }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error(data.error);
        setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: !unlocked }));
      }
    } catch (err) {
      console.error(err);
      setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: !unlocked }));
    }
  };

  const openQuiz = async () => {
    if (!user) return;
    if (!confirm('Открыть викторину — у всех участников появится экран ожидания?')) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/open-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id }),
      });
      if (res.ok) {
        fetchGameSettings();
      } else {
        const data = await res.json();
        alert(data.error || 'Не удалось открыть викторину');
      }
    } catch (err) {
      console.error(err);
      alert('Сервер недоступен');
    } finally {
      setBusy(false);
    }
  };

  const startQuizLive = async () => {
    if (!user) return;
    if (!confirm('Начать отсчёт — у всех одновременно затикает первый вопрос?')) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/start-quiz-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id }),
      });
      if (res.ok) {
        fetchGameSettings();
      } else {
        const data = await res.json();
        alert(data.error || 'Не удалось запустить викторину');
      }
    } catch (err) {
      console.error(err);
      alert('Сервер недоступен');
    } finally {
      setBusy(false);
    }
  };

  const quizIsRunning = gameSettings.quiz_unlocked && gameSettings.quiz_start_time !== null;
  const quizIsWaitingRoom = gameSettings.quiz_unlocked && gameSettings.quiz_start_time === null;

  return (
    <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">Доступ к играм</span>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-6">Загружаем...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-100 text-sm font-medium mb-1">Викторина «Hardcore QA»</p>
            <p className="text-slate-500 text-xs mb-3">
              {quizIsRunning
                ? '🟢 Идёт прямо сейчас'
                : quizIsWaitingRoom
                ? '🟡 Открыта — участники в комнате ожидания'
                : '🔒 Закрыта'}
            </p>

            {!gameSettings.quiz_unlocked && (
              <button
                onClick={openQuiz}
                disabled={busy}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                Открыть викторину для всех
              </button>
            )}

            {quizIsWaitingRoom && (
              <button
                onClick={startQuizLive}
                disabled={busy}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                🚀 Начать отсчёт для всех
              </button>
            )}

            {quizIsRunning && (
              <button
                onClick={startQuizLive}
                disabled={busy}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                Перезапустить с начала
              </button>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-100 text-sm font-medium">Филворд «Word Researcher»</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {gameSettings.filword_unlocked ? 'Открыт для всех участников' : 'Закрыт'}
              </p>
            </div>
            <button
              onClick={() => toggleGame('filword', !gameSettings.filword_unlocked)}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                gameSettings.filword_unlocked ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  gameSettings.filword_unlocked ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamesView;