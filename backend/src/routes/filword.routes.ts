import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

const FILWORD_TIME_LIMIT = 90;
const POINTS_PER_WORD = 2;
const GRID_SIZE = 12;
const WORDS_PER_USER = 10;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Общий банк слов — каждому участнику достаётся свой случайный набор из
// WORDS_PER_USER штук, так что у всех разные слова на доске, не только
// разное расположение.
const WORD_POOL = [
  'AGILE', 'BRANCH', 'CACHE', 'DEPLOY', 'DOCKER', 'GITHUB', 'LEGACY', 'MERGE', 'PYTHON', 'SCRUM',
  'REACT', 'SPRINT', 'BACKUP', 'GATEWAY', 'LATENCY', 'STAGING', 'BROWSER', 'CLUSTER', 'TOKEN', 'BUFFER',
  'THREAD', 'KERNEL', 'SERVER', 'CLIENT', 'SOCKET', 'ROUTER', 'MODULE', 'CONFIG', 'SYNTAX', 'BINAR'
];

// Same deterministic-"random" approach used for the quiz: stable per user
// (so refreshing the page doesn't reshuffle mid-game), but different from
// person to person.
function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function seededRandom(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface WordPosition {
  start: [number, number];
  end: [number, number];
}

// Персональный набор из WORDS_PER_USER слов для конкретного участника,
// выбранный из общего банка — тот же принцип, что и с квизом.
function getUserWordList(userId: string): string[] {
  const seed = hashStringToSeed(`words-${userId}`);
  const rand = seededRandom(seed);
  const indices = Array.from({ length: WORD_POOL.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, WORDS_PER_USER).map((i) => WORD_POOL[i]);
}

function generateFilwordGrid(userId: string, words: string[]): {
  grid: string[];
  wordPositions: Record<string, WordPosition>;
} {
  const rand = seededRandom(hashStringToSeed(`grid-${userId}`));
  const cells: (string | null)[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  const wordPositions: Record<string, WordPosition> = {};

  const sortedWords = [...words].sort((a, b) => b.length - a.length);

  for (const word of sortedWords) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const horizontal = rand() < 0.5;
      const row = Math.floor(rand() * GRID_SIZE);
      const col = Math.floor(rand() * GRID_SIZE);

      if (horizontal) {
        if (col + word.length > GRID_SIZE) continue;
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const existing = cells[row][col + i];
          if (existing !== null && existing !== word[i]) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        for (let i = 0; i < word.length; i++) {
          cells[row][col + i] = word[i];
        }
        wordPositions[word] = { start: [row, col], end: [row, col + word.length - 1] };
        placed = true;
      } else {
        if (row + word.length > GRID_SIZE) continue;
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const existing = cells[row + i][col];
          if (existing !== null && existing !== word[i]) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        for (let i = 0; i < word.length; i++) {
          cells[row + i][col] = word[i];
        }
        wordPositions[word] = { start: [row, col], end: [row + word.length - 1, col] };
        placed = true;
      }
    }
  }

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (cells[r][c] === null) {
        cells[r][c] = ALPHABET[Math.floor(rand() * ALPHABET.length)];
      }
    }
  }

  const grid = cells.map((row) => row.join(''));
  return { grid, wordPositions };
}

async function finalizeFilword(userId: string, score: number) {
  await pool.query('UPDATE filword_sessions SET is_finished = true WHERE user_id = $1', [userId]);
  await pool.query('UPDATE users SET total_score = total_score + $1, is_filword_passed = true WHERE id = $2', [score, userId]);
}

// Individual start: begins this participant's own 90-second session,
// independent of everyone else. If they already have a session
// (finished or in progress), reuse it instead of resetting the clock.
router.post('/start', async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Не указан пользователь' });
  }

  try {
    const settingsResult = await pool.query('SELECT filword_unlocked FROM event_settings WHERE id = 1');
    if (!settingsResult.rows[0]?.filword_unlocked) {
      return res.status(400).json({ error: 'Филворд сейчас недоступен' });
    }

    const existing = await pool.query('SELECT is_finished, score FROM filword_sessions WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0 && existing.rows[0].is_finished) {
      return res.status(400).json({ error: `Вы уже прошли филворд — начислено ${existing.rows[0].score} баллов` });
    }

    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO filword_sessions (user_id, found_words, start_time, score, is_finished) VALUES ($1, $2, NOW(), $3, $4)',
        [userId, [], 0, false]
      );
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка запуска филворда' });
  }
});

// Individual live state — computed purely from this user's own session
// start_time, no shared clock and no lobby. Both the word list and the
// grid are generated deterministically from the userId, so they're
// identical across requests for this user without needing to store them.
router.get('/state/:userId', async (req: Request, res: Response) => {
  const userId = String(req.params.userId);

  try {
    const settingsResult = await pool.query('SELECT filword_unlocked FROM event_settings WHERE id = 1');
    if (!settingsResult.rows[0]?.filword_unlocked) {
      return res.json({ phase: 'ended' });
    }

    const sessionResult = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);
    const session = sessionResult.rows[0] ?? null;

    if (!session) {
      return res.status(400).json({ error: 'Сессия не найдена — начните игру заново' });
    }

    const userWords = getUserWordList(userId);
    const { grid, wordPositions } = generateFilwordGrid(userId, userWords);

    if (session.is_finished) {
      return res.json({
        phase: 'finished',
        totalEarned: session.score,
        grid,
        wordPositions,
      });
    }

    const secondsPassed = (Date.now() - new Date(session.start_time).getTime()) / 1000;
    const secondsLeft = Math.max(0, FILWORD_TIME_LIMIT - secondsPassed);

    if (secondsLeft <= 0) {
      await finalizeFilword(userId, session.score);
      return res.json({
        phase: 'finished',
        totalEarned: session.score,
        grid,
        wordPositions,
      });
    }

    return res.json({
      phase: 'playing',
      grid,
      words: userWords,
      foundWords: session.found_words,
      secondsLeft,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения состояния филворда' });
  }
});

router.post('/submit', async (req: Request, res: Response) => {
  const { userId, word } = req.body;

  try {
    const settingsResult = await pool.query('SELECT filword_unlocked FROM event_settings WHERE id = 1');
    if (!settingsResult.rows[0]?.filword_unlocked) {
      return res.status(400).json({ error: 'Филворд сейчас недоступен' });
    }

    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }

    const session = sessionCheck.rows[0];

    if (session.is_finished) {
      return res.status(400).json({ error: 'Игра уже завершена' });
    }

    const secondsPassed = (Date.now() - new Date(session.start_time).getTime()) / 1000;

    if (secondsPassed > FILWORD_TIME_LIMIT) {
      return res.status(400).json({ error: 'Время вышло' });
    }

    const userWords = getUserWordList(userId);
    const normalizedWord = String(word || '').toUpperCase().trim();
    const alreadyFound = session.found_words.includes(normalizedWord);
    const isRealWord = userWords.includes(normalizedWord);

    if (!isRealWord || alreadyFound) {
      return res.json({
        isValid: false,
        foundWords: session.found_words,
        scoreSoFar: session.score,
        allWordsFound: session.found_words.length >= userWords.length,
      });
    }

    const newFoundWords = [...session.found_words, normalizedWord];
    const newScore = session.score + POINTS_PER_WORD;
    const isAllFound = newFoundWords.length >= userWords.length;

    await pool.query(
      'UPDATE filword_sessions SET found_words = $1, score = $2 WHERE user_id = $3',
      [newFoundWords, newScore, userId]
    );

    if (isAllFound) {
      await finalizeFilword(userId, newScore);
    }

    return res.json({
      isValid: true,
      foundWords: newFoundWords,
      scoreSoFar: newScore,
      allWordsFound: isAllFound,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обработки слова' });
  }
});

router.get('/status/:userId', async (req: Request, res: Response) => {
  const userId = String(req.params.userId);
  try {
    const result = await pool.query('SELECT is_finished FROM filword_sessions WHERE user_id = $1', [userId]);
    const passed = result.rows[0]?.is_finished ?? false;
    return res.json({ passed });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения статуса' });
  }
});

export default router;