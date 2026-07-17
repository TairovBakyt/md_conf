import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

const FILWORD_TIME_LIMIT = 90;
const POINTS_PER_WORD = 2;
const GRID_SIZE = 12;
const WORDS_PER_USER = 10;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Синхронизированный режим использует один и тот же набор слов/сетку для
// всех участников — иначе общий таймер и общий лидерборд не имели бы
// смысла. Ключ ниже — фиксированная "псевдо-личность" для генератора.
const SYNCED_KEY = 'synced-event';

const WORD_POOL = [
  'AGILE', 'BRANCH', 'CACHE', 'DEPLOY', 'DOCKER', 'GITHUB', 'LEGACY', 'MERGE', 'PYTHON', 'SCRUM',
  'REACT', 'SPRINT', 'BACKUP', 'GATEWAY', 'LATENCY', 'STAGING', 'BROWSER', 'CLUSTER', 'TOKEN', 'BUFFER',
  'THREAD', 'KERNEL', 'SERVER', 'CLIENT', 'SOCKET', 'ROUTER', 'MODULE', 'CONFIG', 'SYNTAX', 'BINARY',
];

interface WordPosition {
  start: [number, number];
  end: [number, number];
}

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

function getWordListForKey(key: string): string[] {
  const seed = hashStringToSeed(`words-${key}`);
  const rand = seededRandom(seed);
  const indices = Array.from({ length: WORD_POOL.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, WORDS_PER_USER).map((i) => WORD_POOL[i]);
}

function generateFilwordGrid(key: string, words: string[]): {
  grid: string[];
  wordPositions: Record<string, WordPosition>;
} {
  const rand = seededRandom(hashStringToSeed(`grid-${key}`));
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

async function getFilwordSettings() {
  const result = await pool.query(
    'SELECT filword_unlocked, filword_mode, filword_start_time FROM event_settings WHERE id = 1'
  );
  return result.rows[0] ?? {};
}

async function finalizeFilword(userId: string, score: number) {
  await pool.query('UPDATE filword_sessions SET is_finished = true WHERE user_id = $1', [userId]);
  await pool.query('UPDATE users SET total_score = total_score + $1, is_filword_passed = true WHERE id = $2', [score, userId]);
}

router.post('/start', async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Не указан пользователь' });
  }

  try {
    const settings = await getFilwordSettings();
    if (!settings.filword_unlocked) {
      return res.status(400).json({ error: 'Филворд сейчас недоступен' });
    }

    if (settings.filword_mode === 'synced') {
      return res.json({ success: true, mode: 'synced' });
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

    return res.json({ success: true, mode: 'individual' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка запуска филворда' });
  }
});

router.get('/state/:userId', async (req: Request, res: Response) => {
  const userId = String(req.params.userId);

  try {
    const settings = await getFilwordSettings();
    if (!settings.filword_unlocked || settings.filword_mode === 'synced') {
      return res.json({ phase: 'ended' });
    }

    const sessionResult = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);
    const session = sessionResult.rows[0] ?? null;

    if (!session) {
      return res.status(400).json({ error: 'Сессия не найдена — начните игру заново' });
    }

    const words = getWordListForKey(userId);
    const { grid, wordPositions } = generateFilwordGrid(userId, words);

    if (session.is_finished) {
      return res.json({ phase: 'finished', totalEarned: session.score, grid, wordPositions });
    }

    const secondsPassed = (Date.now() - new Date(session.start_time).getTime()) / 1000;
    const secondsLeft = Math.max(0, FILWORD_TIME_LIMIT - secondsPassed);

    if (secondsLeft <= 0) {
      await finalizeFilword(userId, session.score);
      return res.json({ phase: 'finished', totalEarned: session.score, grid, wordPositions });
    }

    return res.json({
      phase: 'playing',
      grid,
      words,
      foundWords: session.found_words,
      secondsLeft,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения состояния филворда' });
  }
});

async function wasInLobby(userId: string): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM filword_lobby WHERE user_id = $1', [userId]);
  return result.rows.length > 0;
}

async function getFilwordLeaderboard() {
  const result = await pool.query(`
    SELECT u.id, u.username, fs.score
    FROM filword_sessions fs
    JOIN users u ON u.id = fs.user_id
    ORDER BY fs.score DESC
    LIMIT 10
  `);
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    score: Number(row.score),
  }));
}

router.get('/live-state/:userId', async (req: Request, res: Response) => {
  const userId = String(req.params.userId);

  try {
    const settings = await getFilwordSettings();
    if (!settings.filword_unlocked || settings.filword_mode !== 'synced') {
      return res.json({ phase: 'ended' });
    }

    const startTime = settings.filword_start_time ?? null;
    const words = getWordListForKey(SYNCED_KEY);
    const { grid, wordPositions } = generateFilwordGrid(SYNCED_KEY, words);

    if (!startTime) {
      await pool.query(
        `INSERT INTO filword_lobby (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET joined_at = NOW()`,
        [userId]
      );
      return res.json({ phase: 'waiting' });
    }

    const secondsPassed = (Date.now() - new Date(startTime).getTime()) / 1000;
    const secondsLeft = Math.max(0, FILWORD_TIME_LIMIT - secondsPassed);

    const sessionResult = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);
    let session = sessionResult.rows[0] ?? null;

    if (secondsLeft <= 0) {
      const participated = session !== null || (await wasInLobby(userId));

      if (session && !session.is_finished) {
        await finalizeFilword(userId, session.score);
      }

      const leaderboard = await getFilwordLeaderboard();

      return res.json({
        phase: 'finished',
        participated,
        totalEarned: session?.score ?? 0,
        grid,
        wordPositions,
        leaderboard,
      });
    }

    if (!session) {
      const inserted = await pool.query(
        'INSERT INTO filword_sessions (user_id, found_words, start_time, score, is_finished) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, [], startTime, 0, false]
      );
      session = inserted.rows[0];
    }

    return res.json({
      phase: 'playing',
      grid,
      words,
      foundWords: session.found_words,
      secondsLeft,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения состояния филворда' });
  }
});

router.get('/lobby-count', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT COUNT(*) AS count FROM filword_lobby');
    return res.json({ count: Number(result.rows[0].count) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения количества' });
  }
});

router.post('/submit', async (req: Request, res: Response) => {
  const { userId, word } = req.body;

  try {
    const settings = await getFilwordSettings();
    if (!settings.filword_unlocked) {
      return res.status(400).json({ error: 'Филворд сейчас недоступен' });
    }

    const isSynced = settings.filword_mode === 'synced';
    const wordKey = isSynced ? SYNCED_KEY : userId;
    const words = getWordListForKey(wordKey);

    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }
    const session = sessionCheck.rows[0];

    if (session.is_finished) {
      return res.status(400).json({ error: 'Игра уже завершена' });
    }

    const startTime = isSynced ? settings.filword_start_time : session.start_time;
    if (!startTime) {
      return res.status(400).json({ error: 'Игра ещё не началась' });
    }

    const secondsPassed = (Date.now() - new Date(startTime).getTime()) / 1000;
    if (secondsPassed > FILWORD_TIME_LIMIT) {
      return res.status(400).json({ error: 'Время вышло' });
    }

    const normalizedWord = String(word || '').toUpperCase().trim();
    const alreadyFound = session.found_words.includes(normalizedWord);
    const isRealWord = words.includes(normalizedWord);

    if (!isRealWord || alreadyFound) {
      return res.json({
        isValid: false,
        foundWords: session.found_words,
        scoreSoFar: session.score,
        allWordsFound: session.found_words.length >= words.length,
      });
    }

    const newFoundWords = [...session.found_words, normalizedWord];
    const newScore = session.score + POINTS_PER_WORD;
    const isAllFound = newFoundWords.length >= words.length;

    await pool.query(
      'UPDATE filword_sessions SET found_words = $1, score = $2 WHERE user_id = $3',
      [newFoundWords, newScore, userId]
    );

    if (isAllFound && !isSynced) {
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