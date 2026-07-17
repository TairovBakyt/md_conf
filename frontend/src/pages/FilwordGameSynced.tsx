import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';

interface WordPosition {
  start: [number, number];
  end: [number, number];
}

interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
}

type ScreenState =
  | { phase: 'loading' }
  | { phase: 'ended' }
  | { phase: 'waiting' }
  | {
      phase: 'playing';
      grid: string[];
      words: string[];
      foundWords: string[];
    }
  | {
      phase: 'finished';
      participated: boolean;
      totalEarned: number;
      grid: string[];
      wordPositions: Record<string, WordPosition>;
      leaderboard: LeaderboardEntry[];
    }
  | { phase: 'error'; message: string };

interface Cell {
  row: number;
  col: number;
}

const LeaderboardTicker: React.FC<{ entries: LeaderboardEntry[] }> = ({ entries }) => {
  if (entries.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {entries.map((entry, i) => (
        <motion.div
          key={entry.id}
          layout
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.15 }}
          className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"
        >
          <span className="text-slate-300 text-sm font-medium">
            {i + 1}. {entry.username}
          </span>
          <span className="text-emerald-400 text-sm font-semibold">{entry.score}</span>
        </motion.div>
      ))}
    </div>
  );
};

export const FilwordGameSynced: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [state, setState] = useState<ScreenState>({ phase: 'loading' });
  const [secondsLeft, setSecondsLeft] = useState(90);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [wordInput, setWordInput] = useState('');
  const [pendingCells, setPendingCells] = useState<Cell[] | null>(null);
  const [resultFlash, setResultFlash] = useState<{ cells: Cell[]; isValid: boolean } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'bad'; text: string } | null>(null);

  const [selectionStart, setSelectionStart] = useState<Cell | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Cell | null>(null);
  const isDraggingRef = useRef(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (state.phase !== 'waiting') return;

    const fetchLobbyCount = async () => {
      try {
        const res = await fetch(`${API_URL}/api/filword/lobby-count`);
        const data = await res.json();
        if (res.ok) setLobbyCount(data.count);
      } catch (err) {
        console.error(err);
      }
    };

    fetchLobbyCount();
    const interval = setInterval(fetchLobbyCount, 3000);
    return () => clearInterval(interval);
  }, [state.phase]);

  const fetchState = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/filword/live-state/${user.id}`);
      const data = await res.json();

      if (!res.ok) {
        setState({ phase: 'error', message: data.error || 'Ошибка загрузки' });
        return;
      }

      if (data.phase === 'ended') {
        if (pollRef.current) clearInterval(pollRef.current);
        navigate('/dashboard');
        return;
      }

      if (data.phase === 'finished' && pollRef.current) {
        clearInterval(pollRef.current);
      }

      if (data.phase === 'playing') {
        setSecondsLeft(Math.ceil(data.secondsLeft));
      }

      setState(data);
    } catch (err) {
      console.error(err);
      setState({ phase: 'error', message: 'Сервер недоступен' });
    }
  };

  const handleSubmitWord = async (wordOverride?: string, cellsOverride?: Cell[]) => {
    const trimmed = (wordOverride ?? wordInput).trim();
    if (!trimmed || !user || state.phase !== 'playing') return;

    try {
      const res = await fetch(`${API_URL}/api/filword/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, word: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: 'bad', text: data.error || 'Ошибка' });
        setPendingCells(null);
        return;
      }

      if (cellsOverride) {
        setPendingCells(null);
        setResultFlash({ cells: cellsOverride, isValid: data.isValid });
        setTimeout(() => setResultFlash(null), 600);
      }

      if (data.isValid) {
        setState((prev) => (prev.phase === 'playing' ? { ...prev, foundWords: data.foundWords } : prev));
        setFeedback({ type: 'ok', text: 'Верно! +2 балла' });
        setWordInput('');
      } else {
        setFeedback({ type: 'bad', text: 'Такого слова нет или оно уже найдено' });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'bad', text: 'Сервер недоступен' });
      setPendingCells(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmitWord();
  };

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
    return getSelectedCells(selectionStart, selectionEnd).some((c) => c.row === row && c.col === col);
  };

  const isCellPending = (row: number, col: number): boolean => {
    if (!pendingCells) return false;
    return pendingCells.some((c) => c.row === row && c.col === col);
  };

  const isCellInFlash = (row: number, col: number): boolean => {
    if (!resultFlash) return false;
    return resultFlash.cells.some((c) => c.row === row && c.col === col);
  };

  const getWordCells = (start: [number, number], end: [number, number]): Cell[] => {
    const [r1, c1] = start;
    const [r2, c2] = end;
    const cells: Cell[] = [];
    const steps = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
    const dr = steps === 0 ? 0 : (r2 - r1) / steps;
    const dc = steps === 0 ? 0 : (c2 - c1) / steps;
    for (let i = 0; i <= steps; i++) {
      cells.push({ row: r1 + dr * i, col: c1 + dc * i });
    }
    return cells;
  };

  const isCellInAnyWord = (row: number, col: number, wordPositions: Record<string, WordPosition>): boolean => {
    return Object.values(wordPositions).some(({ start, end }) =>
      getWordCells(start, end).some((c) => c.row === row && c.col === col)
    );
  };

  const finalizeSelection = (grid: string[]) => {
    if (selectionStart && selectionEnd) {
      const cells = getSelectedCells(selectionStart, selectionEnd);
      const word = cells.map((c) => grid[c.row][c.col]).join('');
      if (word.length > 1) {
        setWordInput(word);
        setPendingCells(cells);
        handleSubmitWord(word, cells);
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

  const handleMouseUp = (grid: string[]) => {
    if (isDraggingRef.current) finalizeSelection(grid);
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

  const handleTouchEnd = (grid: string[]) => {
    if (isDraggingRef.current) finalizeSelection(grid);
  };

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Загружаем филворд...</span>
      </div>
    );
  }

  if (state.phase === 'ended') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Перенаправляем...</span>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-red-400 text-center">{state.message}</span>
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 underline text-sm">
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (state.phase === 'waiting') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <span className="text-4xl">⏳</span>
        <h1 className="text-slate-100 text-xl font-semibold">Ожидайте старта</h1>
        <p className="text-slate-400 text-sm">Организатор скоро запустит филворд для всех участников</p>

        <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-4 mt-2">
          <p className="text-slate-300 text-sm">
            В комнате ожидания: <span className="text-indigo-400 font-semibold">{lobbyCount}</span>
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === 'finished') {
    if (!state.participated) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
          <span className="text-3xl">🚪</span>
          <h1 className="text-slate-100 text-xl font-semibold">Филворд уже завершён</h1>
          <p className="text-slate-400 text-sm max-w-sm">
            Вы не успели присоединиться до старта, поэтому не участвовали. Баллы не начислялись.
          </p>

          {state.leaderboard.length > 0 && (
            <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-4 mt-2">
              <p className="text-xs text-slate-500 mb-3">Топ-10 участников</p>
              <LeaderboardTicker entries={state.leaderboard} />
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

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <span className="text-3xl">🧩</span>
        <h1 className="text-slate-100 text-xl font-semibold">Филворд завершён</h1>
        <p className="text-slate-100 font-semibold">Начислено баллов: {state.totalEarned}</p>

        <div className="bg-slate-950 rounded-2xl p-4 mt-2">
          <p className="text-xs text-slate-500 mb-3">Все слова были здесь:</p>
          <div className="bg-slate-900 rounded-xl p-2 overflow-x-auto">
            <div
              className="grid gap-[2px] mx-auto"
              style={{ gridTemplateColumns: `repeat(${state.grid.length}, 1fr)`, width: 'fit-content' }}
            >
              {state.grid.map((row, rowIndex) =>
                row.split('').map((letter, colIndex) => {
                  const inWord = isCellInAnyWord(rowIndex, colIndex, state.wordPositions);
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex items-center justify-center text-[10px] sm:text-[11px] lg:text-xs font-mono rounded-sm ${
                        inWord ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {letter}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {state.leaderboard.length > 0 && (
          <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-4 mt-2">
            <p className="text-xs text-slate-500 mb-3">Топ-10 участников</p>
            <LeaderboardTicker entries={state.leaderboard} />
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

  // phase === 'playing'
  const allWordsFound = state.foundWords.length >= state.words.length;

  return (
    <div
      className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8"
      onMouseUp={() => handleMouseUp(state.grid)}
      onMouseLeave={() => handleMouseUp(state.grid)}
    >
      <div className="w-full max-w-sm sm:max-w-xl bg-slate-950 rounded-2xl p-3 sm:p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-medium tracking-wider text-indigo-400">WORD RESEARCHER</span>
          <span className={`text-sm font-medium ${secondsLeft <= 15 ? 'text-red-400' : 'text-amber-400'}`}>
            {secondsLeft} сек
          </span>
        </div>

        <div className="flex justify-between items-center mb-3">
          <span className="text-xs text-slate-500">
            Найдено: {state.foundWords.length} из {state.words.length}
          </span>
        </div>

        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(state.foundWords.length / state.words.length) * 100}%` }}
          />
        </div>

        <div className="bg-slate-900 rounded-xl p-1.5 mb-4 select-none" style={{ touchAction: 'none' }}>
          <div
            className="grid gap-[1px] mx-auto"
            style={{ gridTemplateColumns: `repeat(${state.grid.length}, 1fr)`, width: 'fit-content' }}
          >
            {state.grid.map((row, rowIndex) =>
              row.split('').map((letter, colIndex) => {
                const selected = isCellSelected(rowIndex, colIndex);
                const pending = isCellPending(rowIndex, colIndex);
                const inFlash = isCellInFlash(rowIndex, colIndex);

                let cellClasses = 'bg-slate-800 text-slate-300';
                if (inFlash) {
                  cellClasses = resultFlash?.isValid ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white';
                } else if (pending || selected) {
                  cellClasses = 'bg-indigo-600 text-white';
                }

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    data-row={rowIndex}
                    data-col={colIndex}
                    onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                    onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                    onTouchStart={(e) => handleTouchStart(rowIndex, colIndex, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={() => handleTouchEnd(state.grid)}
                    className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 flex items-center justify-center text-[10px] sm:text-[11px] lg:text-xs font-mono rounded-sm cursor-pointer transition-colors ${cellClasses}`}
                  >
                    {letter}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {allWordsFound ? (
          <p className="text-emerald-400 text-sm text-center py-2.5">
            Все слова найдены! Ждём окончания общего времени...
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default FilwordGameSynced;