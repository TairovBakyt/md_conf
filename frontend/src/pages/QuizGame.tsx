import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';

interface LeaderboardEntry {
  id: string;
  username: string;
  correctCount: number;
}

type LiveState =
  | { phase: 'loading' }
  | { phase: 'waiting' }
  | {
      phase: 'question';
      questionIndex: number;
      totalQuestions: number;
      timeLeft: number;
      questionText: string;
      options: string[];
      alreadyAnswered: boolean;
      selectedOption: number | null;
    }
  | {
      phase: 'reveal';
      questionIndex: number;
      totalQuestions: number;
      timeLeft: number;
      correctOptionIndex: number;
      wasCorrect: boolean;
      leaderboard: LeaderboardEntry[];
    }
  | { phase: 'finished'; score: number; bonus: number; leaderboard: LeaderboardEntry[] }
  | { phase: 'error'; message: string };

export const QuizGame: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [state, setState] = useState<LiveState>({ phase: 'loading' });
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQuestionIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    fetchState();
    pollRef.current = setInterval(fetchState, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchState = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/quiz/live-state/${user.id}`);
      const data = await res.json();

      if (!res.ok) {
        setState({ phase: 'error', message: data.error || 'Ошибка загрузки' });
        return;
      }

      if (data.phase === 'question' && data.questionIndex !== lastQuestionIndexRef.current) {
        lastQuestionIndexRef.current = data.questionIndex;
        setSelected(data.alreadyAnswered ? data.selectedOption : null);
      }

      setState(data);

      if (data.phase === 'finished' && pollRef.current) {
        clearInterval(pollRef.current);
      }
    } catch (err) {
      console.error(err);
      setState({ phase: 'error', message: 'Сервер недоступен' });
    }
  };

  const handleAnswer = async (optionIndex: number) => {
    if (!user || selected !== null || submitting) return;
    setSelected(optionIndex);
    setSubmitting(true);

    try {
      await fetch(`${API_URL}/api/quiz/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, selectedOption: optionIndex }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Загружаем викторину...</span>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-red-400">{state.message}</span>
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 underline text-sm">
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (state.phase === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-4xl">⏳</span>
        <h1 className="text-slate-100 text-xl font-semibold">Ожидайте старта</h1>
        <p className="text-slate-400 text-sm">Организатор ещё не запустил викторину для всех участников</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
        >
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (state.phase === 'finished') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <span className="text-3xl">🏁</span>
        <h1 className="text-slate-100 text-xl font-semibold">Викторина завершена</h1>
        <div className="text-slate-300 text-sm space-y-1">
          <p>Правильных ответов: {state.score} / 20</p>
          {state.bonus > 0 && (
            <p className="text-amber-400 font-medium">Senior Developer! +5 экстра-баллов!</p>
          )}
          <p className="text-slate-100 font-semibold mt-2">
            Начислено баллов: {state.score + state.bonus}
          </p>
        </div>

        {state.leaderboard.length > 0 && (
          <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-4 mt-2">
            <p className="text-xs text-slate-500 mb-3">Топ-10 участников</p>
            <div className="flex flex-col gap-1.5">
              {state.leaderboard.map((entry, i) => (
                <div key={entry.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <span className="text-slate-300 text-sm">
                    {i + 1}. {entry.username}
                  </span>
                  <span className="text-emerald-400 text-sm font-medium">{entry.correctCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
        >
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (state.phase === 'reveal') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5 text-center">
          <span className="text-xs font-medium tracking-wider text-indigo-400">
            ВОПРОС {state.questionIndex + 1} ИЗ {state.totalQuestions}
          </span>

          <div className="mt-4 mb-4">
            {state.wasCorrect ? (
              <p className="text-emerald-400 text-lg font-semibold">✅ Верно!</p>
            ) : (
              <p className="text-red-400 text-lg font-semibold">❌ Неверно</p>
            )}
          </div>

          <div className="w-full max-w-sm bg-slate-950 rounded-2xl mt-2">
            <p className="text-xs text-slate-500 mb-3">Топ-10 прямо сейчас</p>
            <div className="flex flex-col gap-1.5">
              {state.leaderboard.map((entry, i) => (
                <div key={entry.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                  <span className="text-slate-300 text-sm">
                    {i + 1}. {entry.username}
                  </span>
                  <span className="text-emerald-400 text-sm font-medium">{entry.correctCount}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-500 text-xs mt-4">Следующий вопрос через {Math.ceil(state.timeLeft)} сек</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-medium tracking-wider text-indigo-400">
            ВОПРОС {state.questionIndex + 1} ИЗ {state.totalQuestions}
          </span>
          <span className="text-xs text-slate-500">Hardcore QA</span>
        </div>

        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${((state.questionIndex + 1) / state.totalQuestions) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-2 mb-5">
          <span className={`text-2xl font-medium ${state.timeLeft <= 2 ? 'text-red-400' : 'text-amber-400'}`}>
            {Math.ceil(state.timeLeft)}
          </span>
          <span className="text-xs text-slate-500">сек</span>
        </div>

        <p className="text-slate-100 text-base font-medium leading-relaxed mb-5">{state.questionText}</p>

        <div className="flex flex-col gap-2.5">
          {state.options.map((option, index) => {
            let stateClasses = 'border-slate-700 bg-slate-800 text-slate-200';
            if (selected !== null) {
              stateClasses =
                index === selected
                  ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300'
                  : 'border-slate-800 bg-slate-800/40 text-slate-500';
            }
            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={selected !== null}
                className={`text-left px-3.5 py-3 rounded-xl border text-sm transition-colors ${stateClasses}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <p className="text-xs text-slate-500 text-center mt-3">Ответ принят, ждите остальных участников...</p>
        )}
      </div>
    </div>
  );
};

export default QuizGame;