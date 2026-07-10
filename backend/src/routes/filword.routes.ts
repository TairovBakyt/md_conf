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

router.post('/start', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'ID пользователя обязателен' });

  try {
    const settingsCheck = await pool.query('SELECT filword_unlocked FROM event_settings WHERE id = 1');
    if (!settingsCheck.rows[0]?.filword_unlocked) {
      return res.status(403).json({ error: 'Филворд ещё не открыт организатором' });
    }
    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length > 0) {
      const session = sessionCheck.rows[0];

      if (session.is_finished) {
        return res.status(400).json({ error: 'Вы уже прошли эту игру!' });
      }

      const secondsPassed = (new Date().getTime() - new Date(session.start_time).getTime()) / 1000;

      if (secondsPassed > FILWORD_TIME_LIMIT) {
        await finalizeFilword(userId, session.score);
        return res.status(400).json({ error: 'Время вышло, игра завершена' });
      }

      return res.json({
        message: 'Продолжаем игру',
        foundWords: session.found_words,
        secondsLeft: Math.max(0, FILWORD_TIME_LIMIT - secondsPassed)
      });
    }

    await pool.query(
      'INSERT INTO filword_sessions (user_id, found_words, start_time, score, is_finished) VALUES ($1, $2, $3, $4, $5)',
      [userId, [], new Date(), 0, false]
    );

    return res.status(201).json({ message: 'Игра началась', secondsLeft: FILWORD_TIME_LIMIT });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка при старте игры' });
  }
});

router.get('/board/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия игры не найдена. Сначала начните игру.' });
    }

    const session = sessionCheck.rows[0];

    if (session.is_finished) {
      return res.json({ isFinished: true, wordPositions: filwordData.wordPositions });
    }

    const secondsPassed = (new Date().getTime() - new Date(session.start_time).getTime()) / 1000;

    if (secondsPassed > FILWORD_TIME_LIMIT) {
      await finalizeFilword(userId as string, session.score);
      return res.json({ isFinished: true, wordPositions: filwordData.wordPositions });
    }

    return res.json({
      grid: filwordData.grid,
      words: filwordData.words,
      foundWords: session.found_words,
      secondsLeft: Math.max(0, FILWORD_TIME_LIMIT - secondsPassed)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения доски' });
  }
});

router.post('/submit', async (req: Request, res: Response) => {
  const { userId, word } = req.body;

  try {
    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }

    const session = sessionCheck.rows[0];

    if (session.is_finished) {
      return res.status(400).json({ error: 'Игра уже завершена' });
    }

    const secondsPassed = (new Date().getTime() - new Date(session.start_time).getTime()) / 1000;

    if (secondsPassed > FILWORD_TIME_LIMIT) {
      await finalizeFilword(userId, session.score);
      return res.json({ isFinished: true, isTimeOut: true, totalEarned: session.score, wordPositions: filwordData.wordPositions });
    }

    const normalizedWord = String(word || '').toUpperCase().trim();
    const alreadyFound = session.found_words.includes(normalizedWord);
    const isRealWord = filwordData.words.includes(normalizedWord);

    if (!isRealWord || alreadyFound) {
      return res.json({
        isValid: false,
        isFinished: false,
        foundWords: session.found_words,
        scoreSoFar: session.score
      });
    }

    const newFoundWords = [...session.found_words, normalizedWord];
    const newScore = session.score + POINTS_PER_WORD;
    const isAllFound = newFoundWords.length >= filwordData.words.length;

    await pool.query(
      'UPDATE filword_sessions SET found_words = $1, score = $2 WHERE user_id = $3',
      [newFoundWords, newScore, userId]
    );

    if (isAllFound) {
      await finalizeFilword(userId, newScore);
      return res.json({
        isValid: true,
        isFinished: true,
        foundWords: newFoundWords,
        scoreSoFar: newScore,
        totalEarned: newScore,
        message: 'Все слова найдены!',
        wordPositions: filwordData.wordPositions
      });
    }

    return res.json({
      isValid: true,
      isFinished: false,
      foundWords: newFoundWords,
      scoreSoFar: newScore
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обработки слова' });
  }
});

export default router;