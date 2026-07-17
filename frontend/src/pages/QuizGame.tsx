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
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [wrongCount, setWrongCount] = useState(0);
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
      setCorrectOptionIndex(null);
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
      setCorrectOptionIndex(typeof data.correctOptionIndex === 'number' ? data.correctOptionIndex : null);
      if (data.wasCorrect) {
        setCorrectCount((prev) => prev + 1);
      } else {
        setWrongCount((prev) => prev + 1);
      }

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
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400 font-medium">✗ {wrongCount}</span>
            <span className="text-xs text-emerald-400 font-medium">✓ {correctCount}</span>
            <span className="text-xs text-slate-500">Hardcore QA</span>
          </div>  
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
              } else if (feedback === 'wrong' && index === correctOptionIndex) {
                stateClasses = 'border-emerald-500 bg-emerald-950/50 text-emerald-300';
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


// import React, { useEffect, useRef, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { motion } from 'framer-motion';
// import { useUser } from '../authorization/UserContext';
// import { API_URL } from '../config';

// interface LeaderboardEntry {
//   id: string;
//   username: string;
//   correctCount: number;
// }

// type LiveState =
//   | { phase: 'loading' }
//   | { phase: 'waiting' }  
//   | { phase: 'paused' }
//   | { phase: 'ended' }
//   | {
//       phase: 'question';
//       questionIndex: number;
//       totalQuestions: number;
//       timeLeft: number;
//       questionText: string;
//       options: string[];
//       alreadyAnswered: boolean;
//       selectedOption: number | null;
//     }
//   | {
//       phase: 'reveal';
//       questionIndex: number;
//       totalQuestions: number;
//       timeLeft: number;
//       correctOptionIndex: number;
//       correctOptionText: string;
//       wasCorrect: boolean;
//       didAnswer: boolean;
//       leaderboard: LeaderboardEntry[];
//     }
//   | { phase: 'finished'; participated: boolean; score: number; bonus: number; leaderboard: LeaderboardEntry[] }
//   | { phase: 'error'; message: string };

// // Kahoot-style: строки рейтинга поочерёдно "впрыгивают" одна за другой с отскоком
// const LeaderboardTicker: React.FC<{ entries: LeaderboardEntry[] }> = ({ entries }) => {
//   if (entries.length === 0) return null;

//   return (
//     <div className="w-full flex flex-col gap-1.5">
//       {entries.map((entry, i) => (
//         <motion.div
//           key={entry.id}
//           layout
//           initial={{ opacity: 0, y: 40, scale: 0.9 }}
//           animate={{ opacity: 1, y: 0, scale: 1 }}
//           transition={{
//             type: 'spring',
//             stiffness: 260,
//             damping: 20,
//             delay: i * 0.15,
//           }}
//           className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"
//         >
//           <span className="text-slate-300 text-sm font-medium">
//             {i + 1}. {entry.username}
//           </span>
//           <span className="text-emerald-400 text-sm font-semibold">{entry.correctCount}</span>
//         </motion.div>
//       ))}
//     </div>
//   );
// };

// export const QuizGame: React.FC = () => {
//   const { user } = useUser();
//   const navigate = useNavigate();

//   const [state, setState] = useState<LiveState>({ phase: 'loading' });
//   const [selected, setSelected] = useState<number | null>(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [lobbyCount, setLobbyCount] = useState(0);

//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const lastQuestionIndexRef = useRef<number>(-1);

//   useEffect(() => {
//     if (!user) {
//       navigate('/auth');
//       return;
//     }

//     fetchState();
//     pollRef.current = setInterval(fetchState, 1000);

//     return () => {
//       if (pollRef.current) clearInterval(pollRef.current);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     if (state.phase !== 'waiting') return;

//     const fetchLobbyCount = async () => {
//       try {
//         const res = await fetch(`${API_URL}/api/quiz/lobby-count`);
//         const data = await res.json();
//         if (res.ok) setLobbyCount(data.count);
//       } catch (err) {
//         console.error(err);
//       }
//     };

//     fetchLobbyCount();
//     const interval = setInterval(fetchLobbyCount, 3000);
//     return () => clearInterval(interval);
//   }, [state.phase]);

//   const fetchState = async () => {
//     if (!user) return;
//     try {
//       const res = await fetch(`${API_URL}/api/quiz/live-state/${user.id}`);
//       const data = await res.json();

//       if (!res.ok) {
//         setState({ phase: 'error', message: data.error || 'Ошибка загрузки' });
//         return;
//       }

//       if (data.phase === 'ended') {
//         if (pollRef.current) clearInterval(pollRef.current);
//         navigate('/dashboard');
//         return;
//       }

//       if (data.phase === 'question' && data.questionIndex !== lastQuestionIndexRef.current) {
//         lastQuestionIndexRef.current = data.questionIndex;
//         setSelected(data.alreadyAnswered ? data.selectedOption : null);
//       }

//       setState(data);

//       if (data.phase === 'finished' && pollRef.current) {
//         clearInterval(pollRef.current);
//       }
//     } catch (err) {
//       console.error(err);
//       setState({ phase: 'error', message: 'Сервер недоступен' });
//     }
//   };

// const handleAnswer = async (optionIndex: number) => {
//   if (!user || selected !== null || submitting || state.phase !== 'question') return;
//   setSelected(optionIndex);
//   setSubmitting(true);

//   try {
//     await fetch(`${API_URL}/api/quiz/answer`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         userId: user.id,
//         selectedOption: optionIndex,
//         questionIndex: state.questionIndex,
//       }),
//     });
//   } catch (err) {
//     console.error(err);
//   } finally {
//     setSubmitting(false);
//   }
// };

//   if (state.phase === 'loading') {
//     return (
//       <div className="min-h-screen bg-slate-900 flex items-center justify-center">
//         <span className="text-slate-400">Загружаем викторину...</span>
//       </div>
//     );
//   }

//   if (state.phase === 'ended') {
//     return (
//       <div className="min-h-screen bg-slate-900 flex items-center justify-center">
//         <span className="text-slate-400">Перенаправляем...</span>
//       </div>
//     );
//   }

//   if (state.phase === 'error') {
//     return (
//       <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
//         <span className="text-red-400">{state.message}</span>
//         <button onClick={() => navigate('/dashboard')} className="text-slate-400 underline text-sm">
//           Вернуться в профиль
//         </button>
//       </div>
//     );
//   }

//   if (state.phase === 'waiting') {
//     return (
//       <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
//         <span className="text-4xl">⏳</span>
//         <h1 className="text-slate-100 text-xl font-semibold">Ожидайте старта</h1>
//         <p className="text-slate-400 text-sm">Организатор скоро запустит викторину для всех участников</p>

//         <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-4 mt-2">
//           <p className="text-slate-300 text-sm">
//             В комнате ожидания: <span className="text-indigo-400 font-semibold">{lobbyCount}</span>
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (state.phase === 'paused') {
//     return (
//       <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
//         <span className="text-4xl">⏸️</span>
//         <h1 className="text-slate-100 text-xl font-semibold">Пауза</h1>
//         <p className="text-slate-400 text-sm">Организатор поставил викторину на паузу, ожидайте</p>
//       </div>
//     );
//   }

//   if (state.phase === 'finished') {
//     if (!state.participated) {
//       return (
//         <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
//           <span className="text-3xl">🚪</span>
//           <h1 className="text-slate-100 text-xl font-semibold">Викторина уже завершена</h1>
//           <p className="text-slate-400 text-sm max-w-sm">
//             Вы не успели присоединиться до старта, поэтому не участвовали в этой викторине. Баллы не начислялись.
//           </p>

//           {state.leaderboard.length > 0 && (
//             <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-4 mt-2">
//               <p className="text-xs text-slate-500 mb-3">Топ-10 участников</p>
//               <LeaderboardTicker entries={state.leaderboard} />
//             </div>
//           )}

//           <button
//             onClick={() => navigate('/dashboard')}
//             className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
//           >
//             Вернуться в профиль
//           </button>
//         </div>
//       );
//     }

//     return (
//       <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
//         <span className="text-3xl">🏁</span>
//         <h1 className="text-slate-100 text-xl font-semibold">Викторина завершена</h1>
//         <div className="text-slate-300 text-sm space-y-1">
//           <p>Правильных ответов: {state.score} / 20</p>
//           {state.bonus > 0 && (
//             <p className="text-amber-400 font-medium">Senior Developer! +5 экстра-баллов!</p>
//           )}
//           <p className="text-slate-100 font-semibold mt-2">
//             Начислено баллов: {state.score + state.bonus}
//           </p>
//         </div>

//         {state.leaderboard.length > 0 && (
//           <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-4 mt-2">
//             <p className="text-xs text-slate-500 mb-3">Топ-10 участников</p>
//             <LeaderboardTicker entries={state.leaderboard} />
//           </div>
//         )}

//         <button
//           onClick={() => navigate('/dashboard')}
//           className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
//         >
//           Вернуться в профиль
//         </button>
//       </div>
//     );
//   }

//   if (state.phase === 'reveal') {
//     return (
//       <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
//         <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5 text-center">
//           <span className="text-xs font-medium tracking-wider text-indigo-400">
//             ВОПРОС {state.questionIndex + 1} ИЗ {state.totalQuestions}
//           </span>

//           <div className="mt-4 mb-4">
//   {state.wasCorrect ? (
//     <p className="text-emerald-400 text-lg font-semibold">✅ Верно!</p>
//   ) : !state.didAnswer ? (
//     <>
//       <p className="text-amber-400 text-lg font-semibold">⏱️ Время вышло</p>
//       <p className="text-slate-300 text-sm mt-2">
//         Правильный ответ: <span className="text-emerald-400 font-medium">{state.correctOptionText}</span>
//       </p>
//     </>
//   ) : (
//     <>
//       <p className="text-red-400 text-lg font-semibold">❌ Неверно</p>
//       <p className="text-slate-300 text-sm mt-2">
//         Правильный ответ: <span className="text-emerald-400 font-medium">{state.correctOptionText}</span>
//       </p>
//     </>
//   )}
// </div>

//           <div className="w-full bg-slate-950 rounded-2xl mt-2">
//             <p className="text-xs text-slate-500 mb-3">Топ-10 прямо сейчас</p>
//             <LeaderboardTicker entries={state.leaderboard} />
//           </div>

//           <p className="text-slate-500 text-xs mt-4">
//             {state.questionIndex + 1 < state.totalQuestions
//               ? `Следующий вопрос через ${Math.ceil(state.timeLeft)} сек`
//               : `Подсчёт результатов через ${Math.ceil(state.timeLeft)} сек`}
//           </p> 
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
//       <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
//         <div className="flex justify-between items-center mb-3">
//           <span className="text-xs font-medium tracking-wider text-indigo-400">
//             ВОПРОС {state.questionIndex + 1} ИЗ {state.totalQuestions}
//           </span>
//           <span className="text-xs text-slate-500">Hardcore QA</span>
//         </div>

//         <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
//           <div
//             className="h-full bg-indigo-500 rounded-full transition-all duration-300"
//             style={{ width: `${((state.questionIndex + 1) / state.totalQuestions) * 100}%` }}
//           />
//         </div>

//         <div className="flex items-center justify-center gap-2 mb-5">
//           <span className={`text-2xl font-medium ${state.timeLeft <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
//             {Math.ceil(state.timeLeft)}
//           </span>
//           <span className="text-xs text-slate-500">сек</span>
//         </div>

//         <p className="text-slate-100 text-base font-medium leading-relaxed mb-5">{state.questionText}</p>

//         <div className="flex flex-col gap-2.5">
//           {state.options.map((option, index) => {
//             let stateClasses = 'border-slate-700 bg-slate-800 text-slate-200';
//             if (selected !== null) {
//               stateClasses =
//                 index === selected
//                   ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300'
//                   : 'border-slate-800 bg-slate-800/40 text-slate-500';
//             }
//             return (
//               <button
//                 key={index}
//                 onClick={() => handleAnswer(index)}
//                 disabled={selected !== null}
//                 className={`text-left px-3.5 py-3 rounded-xl border text-sm transition-colors ${stateClasses}`}
//               >
//                 {option}
//               </button>
//             );
//           })}
//         </div>

//         {selected !== null && (
//           <p className="text-xs text-slate-500 text-center mt-3">Ответ принят, ждите остальных участников...</p>
//         )}
//       </div>
//     </div>
//   );
// };

// export default QuizGame;