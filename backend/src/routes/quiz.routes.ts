import { Router, Request, Response } from 'express';
import { pool } from '../db';
import questions from '../questions.json';

const router = Router();

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

function getShuffledIndices(userId: string, questionIndex: number, length: number): number[] {
  const seed = hashStringToSeed(`${userId}-${questionIndex}`);
  const rand = seededRandom(seed);
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

const QUESTIONS_PER_USER = 20;

function getUserQuestionPool(userId: string): number[] {
  const seed = hashStringToSeed(`pool-${userId}`);
  const rand = seededRandom(seed);
  const indices = Array.from({ length: questions.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, QUESTIONS_PER_USER);
}

async function getAnsweredCount(userId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM quiz_answers WHERE user_id = $1',
    [userId]
  );
  return Number(result.rows[0].count);
}

async function finalizeIfNeeded(userId: string) {
  const alreadyAwarded = await pool.query('SELECT 1 FROM quiz_final_results WHERE user_id = $1', [userId]);
  if (alreadyAwarded.rows.length > 0) {
    return null;
  }

  const answersResult = await pool.query(
    'SELECT COUNT(*) FILTER (WHERE is_correct = true) AS correct_count FROM quiz_answers WHERE user_id = $1',
    [userId]
  );
  const score = Number(answersResult.rows[0].correct_count);
  const bonus = score === QUESTIONS_PER_USER ? 5 : 0;
  const total = score + bonus;

  const inserted = await pool.query(
    'INSERT INTO quiz_final_results (user_id, score, bonus) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING RETURNING *',
    [userId, score, bonus]
  );

  if (inserted.rows.length === 0) {
    return null;
  }

  await pool.query('UPDATE users SET total_score = total_score + $1, is_quiz_passed = true WHERE id = $2', [total, userId]);

  let message = '';
  if (bonus > 0) {
    await pool.query(
      'INSERT INTO achievements (user_id, title, points) VALUES ($1, $2, $3)',
      [userId, 'Senior Developer', bonus]
    );
    message = 'Все ответы верны! Достижение «Senior Developer» разблокировано';
  }

  return { scoreEarned: score, bonusEarned: bonus, totalEarned: total, message };
}

router.post('/start', async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Не указан пользователь' });
  }

  try {
    const settingsResult = await pool.query('SELECT quiz_unlocked FROM event_settings WHERE id = 1');
    if (!settingsResult.rows[0]?.quiz_unlocked) {
      return res.status(400).json({ error: 'Викторина сейчас недоступна' });
    }

    const finalResult = await pool.query('SELECT score, bonus FROM quiz_final_results WHERE user_id = $1', [userId]);
    if (finalResult.rows.length > 0) {
      const { score, bonus } = finalResult.rows[0];
      const total = Number(score) + Number(bonus);
      return res.status(400).json({ error: `Вы уже прошли викторину — начислено ${total} баллов` });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка запуска викторины' });
  }
});

router.get('/question/:userId', async (req: Request, res: Response) => {
  const userId = String(req.params.userId);

  try {
    const currentIndex = await getAnsweredCount(userId);

    if (currentIndex >= QUESTIONS_PER_USER) {
      return res.json({ isFinished: true });
    }

    const userPool = getUserQuestionPool(userId);
    const fullQuestion = questions[userPool[currentIndex]];
    const shuffledIndices = getShuffledIndices(userId, currentIndex, fullQuestion.options.length);
    const shuffledOptions = shuffledIndices.map((origIdx) => fullQuestion.options[origIdx]);

    return res.json({
      id: currentIndex,
      questionText: fullQuestion.question,
      options: shuffledOptions,
      currentIndex,
      totalQuestions: QUESTIONS_PER_USER,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения вопроса' });
  }
});

router.post('/answer', async (req: Request, res: Response) => {
  const { userId, selectedOption } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Не указан пользователь' });
  }

  try {
    const settingsResult = await pool.query('SELECT quiz_unlocked FROM event_settings WHERE id = 1');
    if (!settingsResult.rows[0]?.quiz_unlocked) {
      return res.status(400).json({ error: 'Викторина сейчас недоступна' });
    }

    const questionIndex = await getAnsweredCount(userId);
    if (questionIndex >= QUESTIONS_PER_USER) {
      return res.status(400).json({ error: 'Викторина уже завершена' });
    }

    const userPool = getUserQuestionPool(userId);
    const fullQuestion = questions[userPool[questionIndex]];
    const shuffledIndices = getShuffledIndices(userId, questionIndex, fullQuestion.options.length);

    const originalSelectedIndex =
      typeof selectedOption === 'number' ? shuffledIndices[selectedOption] : null;

    const isCorrect = originalSelectedIndex === fullQuestion.correct;

    const inserted = await pool.query(
      `INSERT INTO quiz_answers (user_id, question_index, selected_option, is_correct)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, question_index) DO NOTHING
       RETURNING *`,
      [userId, questionIndex, originalSelectedIndex, isCorrect]
    );

    if (inserted.rows.length === 0) {
      return res.status(400).json({ error: 'Вы уже отвечали на этот вопрос' });
    }

    const correctOptionIndex = shuffledIndices.indexOf(fullQuestion.correct);
    const correctOptionText = fullQuestion.options[fullQuestion.correct];

    const isFinished = questionIndex + 1 >= QUESTIONS_PER_USER;

    if (!isFinished) {
      return res.json({
        success: true,
        wasCorrect: isCorrect,
        isFinished: false,
        correctOptionIndex,
        correctOptionText,
      });
    }

    const finalized = await finalizeIfNeeded(userId);
    return res.json({
      success: true,
      wasCorrect: isCorrect,
      isFinished: true,
      correctOptionIndex,
      correctOptionText,
      scoreEarned: finalized?.scoreEarned ?? 0,
      bonusEarned: finalized?.bonusEarned ?? 0,
      totalEarned: finalized?.totalEarned ?? 0,
      message: finalized?.message ?? '',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обработки ответа' });
  }
});

export default router;