import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';

import { API_URL } from '../config';

interface BoardData {
  grid: string[];
  words: string[]; // используем только для подсчёта общего количества, не отображаем сами слова
  foundWords: string[];
  secondsLeft: number;
}

type ScreenState = 'loading' | 'playing' | 'finished' | 'already-passed' | 'error';

interface Cell {
  row: number;
  col: number;
}

export const FilwordGame: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<ScreenState>('loading');
  const [board, setBoard] = useState<BoardData | null>(null);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(90);
  const [wordInput, setWordInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<{ totalEarned: number; message: string } | null>(null);

  const [selectionStart, setSelectionStart] = useState<Cell | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Cell | null>(null);
  const isDraggingRef = useRef(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

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
      const res = await fetch(`${API_URL}/api/filword/start`, {
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

      fetchBoard();
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const fetchBoard = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/filword/board/${user.id}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось загрузить доску');
        setScreen('error');
        return;
      }

      if (data.isFinished) {
        setScreen('finished');
        return;
      }

      setBoard(data);
      setFoundWords(data.foundWords || []);
      setTimeLeft(Math.floor(data.secondsLeft));
      finishedRef.current = false;
      setScreen('playing');
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
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeout = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (!user) return;

    try {
      const res = await fetch(`${API_URL}/api/filword/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, word: '' }),
      });
      const data = await res.json();

      if (data.isFinished) {
        setResult({
          totalEarned: data.totalEarned ?? 0,
          message: 'Время вышло',
        });
        setScreen('finished');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const handleSubmitWord = async (wordOverride?: string) => {
    const trimmed = (wordOverride ?? wordInput).trim();
    if (!trimmed || !user) return;

    try {
      const res = await fetch(`${API_URL}/api/filword/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, word: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: 'bad', text: data.error || 'Ошибка' });
        return;
      }

      if (data.isValid) {
        setFoundWords(data.foundWords);
        setFeedback({ type: 'ok', text: 'Верно! +2 балла' });
        setWordInput('');
      } else {
        setFeedback({ type: 'bad', text: 'Такого слова нет или оно уже найдено' });
      }

      if (data.isFinished) {
        finishedRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        setResult({
          totalEarned: data.totalEarned ?? 0,
          message: data.message || 'Все слова найдены!',
        });
        setTimeout(() => setScreen('finished'), 800);
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'bad', text: 'Сервер недоступен' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmitWord();
    }
  };

  // ==========================================
  // ВЫДЕЛЕНИЕ МЫШКОЙ / ПАЛЬЦЕМ ПО СЕТКЕ
  // ==========================================

  const getSelectedCells = (start: Cell, end: Cell): Cell[] => {
    if (start.row === end.row) {
      const [from, to] = start.col <= end.col ? [start.col, end.col] : [end.col, start.col];
      const cells: Cell[] = [];
      for (let c = from; c <= to; c++) cells.push({ row: start.row, col: c });
      return cells;
    }
    if (start.col === end.col) {
      const [from, to] = start.row <= end.row ? [start.row, end.row] : [end.row, start.row];
      const cells: Cell[] = [];
      for (let r = from; r <= to; r++) cells.push({ row: r, col: start.col });
      return cells;
    }
    return [start];
  };

  const isCellSelected = (row: number, col: number): boolean => {
    if (!selectionStart || !selectionEnd) return false;
    const cells = getSelectedCells(selectionStart, selectionEnd);
    return cells.some((c) => c.row === row && c.col === col);
  };

  const finalizeSelection = () => {
    if (selectionStart && selectionEnd && board) {
      const cells = getSelectedCells(selectionStart, selectionEnd);
      const word = cells.map((c) => board.grid[c.row][c.col]).join('');
      if (word.length > 1) {
        setWordInput(word);
      }
    }
    isDraggingRef.current = false;
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const handleCellMouseDown = (row: number, col: number) => {
    isDraggingRef.current = true;
    setSelectionStart({ row, col });
    setSelectionEnd({ row, col });
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!isDraggingRef.current || !selectionStart) return;
    if (row === selectionStart.row || col === selectionStart.col) {
      setSelectionEnd({ row, col });
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      finalizeSelection();
    }
  };

  const getCellFromTouch = (touch: React.Touch): Cell | null => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    if (!el || !el.dataset.row || !el.dataset.col) return null;
    return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
  };

  const handleTouchStart = (row: number, col: number, e: React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setSelectionStart({ row, col });
    setSelectionEnd({ row, col });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !selectionStart) return;
    e.preventDefault();
    const touch = e.touches[0];
    const cell = getCellFromTouch(touch);
    if (cell && (cell.row === selectionStart.row || cell.col === selectionStart.col)) {
      setSelectionEnd(cell);
    }
  };

  const handleTouchEnd = () => {
    if (isDraggingRef.current) {
      finalizeSelection();
    }
  };

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Загружаем филворд...</span>
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
        <span className="text-3xl">🧩</span>
        <h1 className="text-slate-100 text-xl font-semibold">Филворд завершён</h1>
        {result && (
          <div className="text-slate-300 text-sm space-y-1">
            <p>{result.message}</p>
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

  if (!board) return null;

  return (
    <div
      className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-medium tracking-wider text-indigo-400">
            WORD RESEARCHER
          </span>
          <span className={`text-sm font-medium ${timeLeft <= 15 ? 'text-red-400' : 'text-amber-400'}`}>
            {timeLeft} сек
          </span>
        </div>

        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-slate-500">
            Найдено: {foundWords.length} из {board.words.length}
          </span>
        </div>

        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(foundWords.length / board.words.length) * 100}%` }}
          />
        </div>

        <div className="bg-slate-900 rounded-xl p-2 mb-4 overflow-x-auto select-none" style={{ touchAction: 'none' }}>
          <div
            className="grid gap-[2px] mx-auto"
            style={{ gridTemplateColumns: `repeat(${board.grid.length}, 1fr)`, width: 'fit-content' }}
          >
            {board.grid.map((row, rowIndex) =>
              row.split('').map((letter, colIndex) => {
                const selected = isCellSelected(rowIndex, colIndex);
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    data-row={rowIndex}
                    data-col={colIndex}
                    onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                    onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                    onTouchStart={(e) => handleTouchStart(rowIndex, colIndex, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`w-5 h-5 flex items-center justify-center text-[10px] font-mono rounded-sm cursor-pointer transition-colors ${
                      selected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {letter}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="Выдели слово в сетке или введи вручную"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm font-mono outline-none focus:border-indigo-500"
            autoComplete="off"
          />
          <button
            onClick={() => handleSubmitWord()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            OK
          </button>
        </div>

        {feedback && (
          <p className={`text-xs mt-2 ${feedback.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  );
};

export default FilwordGame;