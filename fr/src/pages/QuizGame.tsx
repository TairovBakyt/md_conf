import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';

import { API_URL } from '../config';
const TIMER_SECONDS = 20; // визуально показываем 20, у бэка запас до 22 сек

interface QuestionData {
  id: number;
  questionText: string;
  options: string[];
  currentIndex: number;
  totalQuestions: number;
}

type ScreenState = 'loading' | 'question' | 'finished' | 'already-passed' | 'error';

export const QuizGame: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<ScreenState>('loading');
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<{
    scoreEarned: number;
    bonusEarned: number;
    totalEarned: number;
    message: string;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false); // защита от гонки: клик + истечение таймера одновременно

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    startGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/quiz/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось начать игру');
        setScreen('already-passed');
        return;
      }

      fetchQuestion();
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const fetchQuestion = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/quiz/question/${user.id}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось получить вопрос');
        setScreen('error');
        return;
      }

      if (data.isFinished) {
        setScreen('finished');
        return;
      }

      setQuestion(data);
      setSelected(null);
      setFeedback(null);
      setTimeLeft(TIMER_SECONDS);
      setScreen('question');
      answeredRef.current = false; // новый вопрос — снимаем блокировку
      startTimer();
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitAnswer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const submitAnswer = async (optionIndex: number | null) => {
    if (!user) return;

    if (answeredRef.current) return; // уже отвечали на этот вопрос — игнорируем повторный вызов
    answeredRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(optionIndex);

    try {
      const res = await fetch(`${API_URL}/api/quiz/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, selectedOption: optionIndex }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Ошибка отправки ответа');
        setScreen('error');
        return;
      }

      setFeedback(data.wasCorrect ? 'correct' : 'wrong');

      if (data.isFinished) {
        setResult({
          scoreEarned: data.scoreEarned,
          bonusEarned: data.bonusEarned,
          totalEarned: data.totalEarned,
          message: data.message,
        });
        setTimeout(() => setScreen('finished'), 1200);
      } else {
        setTimeout(() => fetchQuestion(), 1200);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const handleSelect = (index: number) => {
    if (selected !== null) return;
    submitAnswer(index);
  };

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Загружаем викторину...</span>
      </div>
    );
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-red-400 text-center">{errorMsg}</span>
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 underline text-sm">
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (screen === 'already-passed') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-emerald-400 text-lg font-semibold">{errorMsg}</span>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
        >
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (screen === 'finished') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-3xl">🏁</span>
        <h1 className="text-slate-100 text-xl font-semibold">Викторина завершена</h1>
        {result && (
          <div className="text-slate-300 text-sm space-y-1">
            <p>Правильных ответов: {result.scoreEarned} / 20</p>
            {result.bonusEarned > 0 && (
              <p className="text-amber-400 font-medium">{result.message}</p>
            )}
            <p className="text-slate-100 font-semibold mt-2">
              Начислено баллов: {result.totalEarned}
            </p>
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

  if (!question) return null;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-medium tracking-wider text-indigo-400">
            ВОПРОС {question.currentIndex + 1} ИЗ {question.totalQuestions}
          </span>
          <span className="text-xs text-slate-500">Hardcore QA</span>
        </div>

        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${((question.currentIndex + 1) / question.totalQuestions) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-2 mb-5">
          <span className={`text-2xl font-medium ${timeLeft <= 5 ? 'text-red-400' : 'text-amber-400'}`}>
            {timeLeft}
          </span>
          <span className="text-xs text-slate-500">сек</span>
        </div>

        <p className="text-slate-100 text-base font-medium leading-relaxed mb-5">
          {question.questionText}
        </p>

        <div className="flex flex-col gap-2.5">
          {question.options.map((option, index) => {
            let stateClasses = 'border-slate-700 bg-slate-800 text-slate-200';
            if (selected !== null) {
              if (index === selected && feedback === 'correct') {
                stateClasses = 'border-emerald-500 bg-emerald-950/50 text-emerald-300';
              } else if (index === selected && feedback === 'wrong') {
                stateClasses = 'border-red-500 bg-red-950/50 text-red-300';
              } else {
                stateClasses = 'border-slate-800 bg-slate-800/40 text-slate-500';
              }
            }
            return (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                disabled={selected !== null}
                className={`text-left px-3.5 py-3 rounded-xl border text-sm transition-colors ${stateClasses}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuizGame;