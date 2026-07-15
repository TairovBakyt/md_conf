import React, { useEffect, useState } from 'react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

interface GameSettings {
  quiz_unlocked: boolean;
  filword_unlocked: boolean;
  quiz_start_time: string | null;
  quiz_paused_at: string | null;
  filword_start_time: string | null;
}

export const GamesView: React.FC = () => {
  const { user } = useUser();
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    quiz_unlocked: false,
    filword_unlocked: false,
    quiz_start_time: null,
    quiz_paused_at: null,
    filword_start_time: null,
  });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quizLobbyCount, setQuizLobbyCount] = useState(0);
  const [filwordLobbyCount, setFilwordLobbyCount] = useState(0);

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

  const fetchQuizLobbyCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quiz/lobby-count`);
      const data = await res.json();
      if (res.ok) setQuizLobbyCount(data.count);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFilwordLobbyCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/filword/lobby-count`);
      const data = await res.json();
      if (res.ok) setFilwordLobbyCount(data.count);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGameSettings();
    const interval = setInterval(fetchGameSettings, 5000);
    return () => clearInterval(interval);
  }, []);

  const quizIsRunning = gameSettings.quiz_unlocked && gameSettings.quiz_start_time !== null;
  const quizIsWaitingRoom = gameSettings.quiz_unlocked && gameSettings.quiz_start_time === null;
  const quizIsPaused = gameSettings.quiz_paused_at !== null;

  const filwordIsRunning = gameSettings.filword_unlocked && gameSettings.filword_start_time !== null;
  const filwordIsWaitingRoom = gameSettings.filword_unlocked && gameSettings.filword_start_time === null;

  useEffect(() => {
    if (!quizIsWaitingRoom) return;
    fetchQuizLobbyCount();
    const interval = setInterval(fetchQuizLobbyCount, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizIsWaitingRoom]);

  useEffect(() => {
    if (!filwordIsWaitingRoom) return;
    fetchFilwordLobbyCount();
    const interval = setInterval(fetchFilwordLobbyCount, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filwordIsWaitingRoom]);

  const callAdminAction = async (endpoint: string, confirmText?: string) => {
    if (!user) return;
    if (confirmText && !confirm(confirmText)) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id }),
      });
      if (res.ok) {
        fetchGameSettings();
      } else {
        const data = await res.json();
        alert(data.error || 'Не удалось выполнить действие');
      }
    } catch (err) {
      console.error(err);
      alert('Сервер недоступен');
    } finally {
      setBusy(false);
    }
  };

  const openQuiz = () => callAdminAction('open-quiz', 'Открыть викторину — у всех участников появится комната ожидания?');
  const startQuizLive = () => callAdminAction('start-quiz-live', 'Начать отсчёт — у всех одновременно затикает первый вопрос?');
  const pauseQuiz = () => callAdminAction('pause-quiz');
  const resumeQuiz = () => callAdminAction('resume-quiz');
  const endQuiz = () => callAdminAction('end-quiz', 'Завершить викторину и вернуть всех участников в личный кабинет?');

  const openFilword = () => callAdminAction('open-filword', 'Открыть филворд — у всех участников появится комната ожидания?');
  const startFilwordLive = () => callAdminAction('start-filword-live', 'Начать отсчёт 90 секунд для всех одновременно?');
  const endFilword = () => callAdminAction('end-filword', 'Завершить филворд и вернуть всех участников в личный кабинет?');

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
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
                ? quizIsPaused
                  ? '⏸️ На паузе'
                  : '🟢 Идёт прямо сейчас'
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
              <>
                <div className="bg-slate-900 rounded-xl p-3 mb-2">
                  <p className="text-sm text-slate-300">
                    В комнате ожидания: <span className="text-indigo-400 font-semibold">{quizLobbyCount}</span>
                  </p>
                </div>
                <button
                  onClick={startQuizLive}
                  disabled={busy}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
                >
                  🚀 Начать отсчёт для всех
                </button>
              </>
            )}

            {quizIsRunning && (
              <div className="flex flex-col gap-2">
                {quizIsPaused ? (
                  <button
                    onClick={resumeQuiz}
                    disabled={busy}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
                  >
                    ▶️ Продолжить
                  </button>
                ) : (
                  <button
                    onClick={pauseQuiz}
                    disabled={busy}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
                  >
                    ⏸️ Пауза
                  </button>
                )}
                <button
                  onClick={startQuizLive}
                  disabled={busy}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
                >
                  Перезапустить с начала
                </button>
              </div>
            )}

            {gameSettings.quiz_unlocked && (
              <button
                onClick={endQuiz}
                disabled={busy}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2"
              >
                🔚 Завершить и вернуть всех
              </button>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-slate-100 text-sm font-medium mb-1">Филворд «Word Researcher»</p>
            <p className="text-slate-500 text-xs mb-3">
              {filwordIsRunning
                ? '🟢 Идёт прямо сейчас (90 сек)'
                : filwordIsWaitingRoom
                ? '🟡 Открыт — участники в комнате ожидания'
                : '🔒 Закрыт'}
            </p>

            {!gameSettings.filword_unlocked && (
              <button
                onClick={openFilword}
                disabled={busy}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                Открыть филворд для всех
              </button>
            )}

            {filwordIsWaitingRoom && (
              <>
                <div className="bg-slate-900 rounded-xl p-3 mb-2">
                  <p className="text-sm text-slate-300">
                    В комнате ожидания: <span className="text-indigo-400 font-semibold">{filwordLobbyCount}</span>
                  </p>
                </div>
                <button
                  onClick={startFilwordLive}
                  disabled={busy}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
                >
                  🚀 Начать отсчёт для всех
                </button>
              </>
            )}

            {gameSettings.filword_unlocked && (
              <button
                onClick={endFilword}
                disabled={busy}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50 mt-2"
              >
                🔚 Завершить и вернуть всех
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GamesView;