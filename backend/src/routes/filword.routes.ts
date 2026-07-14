import { Router, Request, Response } from 'express';
import { pool } from '../db';
import filwordData from '../filword.json';

const router = Router();

const FILWORD_TIME_LIMIT = 90;
const POINTS_PER_WORD = 2;

async function finalizeFilword(userId: string, score: number) {
  await pool.query('UPDATE filword_sessions SET is_finished = true WHERE user_id = $1', [userId]);
  await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [score, userId]);
}

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
  const { userId } = req.params;

  try {
    const settingsResult = await pool.query(
      'SELECT filword_unlocked, filword_start_time FROM event_settings WHERE id = 1'
    );
    const row = settingsResult.rows[0] ?? {};

    if (!row.filword_unlocked) {
      return res.json({ phase: 'ended' });
    }

    const startTime = row.filword_start_time ?? null;

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
      const participated = session !== null || (await wasInLobby(String(userId)));

      if (session && !session.is_finished) {
        await finalizeFilword(userId, session.score);
      }

      const leaderboard = await getFilwordLeaderboard();

      return res.json({
        phase: 'finished',
        participated,
        totalEarned: session?.score ?? 0,
        grid: filwordData.grid,
        wordPositions: filwordData.wordPositions,
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
      grid: filwordData.grid,
      words: filwordData.words,
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
    const settingsResult = await pool.query('SELECT filword_start_time FROM event_settings WHERE id = 1');
    const startTime = settingsResult.rows[0]?.filword_start_time;

    if (!startTime) {
      return res.status(400).json({ error: 'Игра ещё не началась' });
    }

    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }

    const session = sessionCheck.rows[0];

    if (session.is_finished) {
      return res.status(400).json({ error: 'Игра уже завершена' });
    }

    const secondsPassed = (Date.now() - new Date(startTime).getTime()) / 1000;

    if (secondsPassed > FILWORD_TIME_LIMIT) {
      return res.status(400).json({ error: 'Время вышло, ожидайте подведения итогов' });
    }

    const normalizedWord = String(word || '').toUpperCase().trim();
    const alreadyFound = session.found_words.includes(normalizedWord);
    const isRealWord = filwordData.words.includes(normalizedWord);

    if (!isRealWord || alreadyFound) {
      return res.json({
        isValid: false,
        foundWords: session.found_words,
        scoreSoFar: session.score,
        allWordsFound: session.found_words.length >= filwordData.words.length,
      });
    }

    const newFoundWords = [...session.found_words, normalizedWord];
    const newScore = session.score + POINTS_PER_WORD;
    const isAllFound = newFoundWords.length >= filwordData.words.length;

    await pool.query(
      'UPDATE filword_sessions SET found_words = $1, score = $2 WHERE user_id = $3',
      [newFoundWords, newScore, userId]
    );

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

router.get('/lobby-count', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT COUNT(*) AS count FROM filword_lobby');
    return res.json({ count: Number(result.rows[0].count) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения количества' });
  }
});

export default router;