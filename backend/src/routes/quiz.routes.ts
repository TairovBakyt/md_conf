import { Router, Request, Response } from 'express';
import { pool } from '../db';
import questions from '../questions.json';

const router = Router();

const ANSWER_SECONDS = 10;
const REVEAL_SECONDS = 7;
const CYCLE_SECONDS = ANSWER_SECONDS + REVEAL_SECONDS;

function computeLiveState(
  quizStartTime: Date | null,
  quizPausedAt: Date | null,
  quizPausedSeconds: number
) {
  if (!quizStartTime) {
    return { phase: 'waiting' as const, questionIndex: -1 };
  }

  if (quizPausedAt) {
    return { phase: 'paused' as const, questionIndex: -1 };
  }

  const elapsedSeconds =
    (Date.now() - new Date(quizStartTime).getTime()) / 1000 - quizPausedSeconds;
  const questionIndex = Math.floor(elapsedSeconds / CYCLE_SECONDS);

  if (questionIndex >= questions.length) {
    return { phase: 'finished' as const, questionIndex: questions.length };
  }

  const withinCycle = elapsedSeconds - questionIndex * CYCLE_SECONDS;

  if (withinCycle < ANSWER_SECONDS) {
    return {
      phase: 'question' as const,
      questionIndex,
      timeLeft: Math.max(0, ANSWER_SECONDS - withinCycle),
    };
  }

  return {
    phase: 'reveal' as const,
    questionIndex,
    timeLeft: Math.max(0, CYCLE_SECONDS - withinCycle),
  };
}

// НОВОЕ: детерминированный "случайный" порядок вариантов для конкретного
// пользователя и вопроса — стабильный при повторных запросах (поллинг),
// но разный у разных людей.
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

async function getLeaderboard(upToQuestionIndex: number) {
  const result = await pool.query(
    `
    SELECT u.id, u.username, COUNT(qa.id) FILTER (WHERE qa.is_correct = true) AS correct_count
    FROM users u
    JOIN quiz_answers qa ON qa.user_id = u.id
    WHERE qa.question_index <= $1
    GROUP BY u.id, u.username
    ORDER BY correct_count DESC
    LIMIT 10
    `,
    [upToQuestionIndex]
  );
  return result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    correctCount: Number(row.correct_count),
  }));
}

async function hasParticipated(userId: string): Promise<boolean> {
  const lobbyCheck = await pool.query('SELECT 1 FROM quiz_lobby WHERE user_id = $1', [userId]);
  if (lobbyCheck.rows.length > 0) return true;

  const answersCheck = await pool.query(
    'SELECT 1 FROM quiz_answers WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return answersCheck.rows.length > 0;
}

async function finalizeIfNeeded(userId: string) {
  const alreadyAwarded = await pool.query('SELECT 1 FROM quiz_final_results WHERE user_id = $1', [userId]);
  if (alreadyAwarded.rows.length > 0) return;

  const answersResult = await pool.query(
    'SELECT COUNT(*) FILTER (WHERE is_correct = true) AS correct_count FROM quiz_answers WHERE user_id = $1',
    [userId]
  );
  const score = Number(answersResult.rows[0].correct_count);
  const bonus = score === questions.length ? 5 : 0;
  const total = score + bonus;

  const inserted = await pool.query(
    'INSERT INTO quiz_final_results (user_id, score, bonus) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING RETURNING *',
    [userId, score, bonus]
  );

  if (inserted.rows.length > 0) {
    await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [total, userId]);
    if (bonus > 0) {
      await pool.query(
        'INSERT INTO achievements (user_id, title, points) VALUES ($1, $2, $3)',
        [userId, 'Senior Developer', bonus]
      );
    }
  }
}

router.get('/live-state/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const settingsResult = await pool.query(
      'SELECT quiz_unlocked, quiz_start_time, quiz_paused_at, quiz_paused_seconds FROM event_settings WHERE id = 1'
    );
    const row = settingsResult.rows[0] ?? {};

    if (!row.quiz_unlocked) {
      return res.json({ phase: 'ended' });
    }

    const quizStartTime = row.quiz_start_time ?? null;
    const quizPausedAt = row.quiz_paused_at ?? null;
    const quizPausedSeconds = row.quiz_paused_seconds ?? 0;

    const state = computeLiveState(quizStartTime, quizPausedAt, quizPausedSeconds);

    if (state.phase === 'waiting') {
      await pool.query(
        `INSERT INTO quiz_lobby (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET joined_at = NOW()`,
        [userId]
      );
      return res.json({ phase: 'waiting' });
    }

    if (state.phase === 'paused') {
      return res.json({ phase: 'paused' });
    }

    if (state.phase === 'finished') {
      const participated = await hasParticipated(String(userId));

      if (!participated) {
        const leaderboard = await getLeaderboard(questions.length - 1);
        return res.json({
          phase: 'finished',
          participated: false,
          score: 0,
          bonus: 0,
          leaderboard,
        });
      }

      await finalizeIfNeeded(String(userId));

      const finalResult = await pool.query('SELECT score, bonus FROM quiz_final_results WHERE user_id = $1', [userId]);
      const leaderboard = await getLeaderboard(questions.length - 1);

      return res.json({
        phase: 'finished',
        participated: true,
        score: finalResult.rows[0]?.score ?? 0,
        bonus: finalResult.rows[0]?.bonus ?? 0,
        leaderboard,
      });
    }

    const alreadyAnsweredResult = await pool.query(
      'SELECT selected_option, is_correct FROM quiz_answers WHERE user_id = $1 AND question_index = $2',
      [userId, state.questionIndex]
    );
    const alreadyAnswered = alreadyAnsweredResult.rows[0] ?? null;

    if (state.phase === 'question') {
      const fullQuestion = questions[state.questionIndex];

      // НОВОЕ: перемешиваем варианты для этого userId+questionIndex
      const shuffledIndices = getShuffledIndices(String(userId), state.questionIndex, fullQuestion.options.length);
      const shuffledOptions = shuffledIndices.map((origIdx) => fullQuestion.options[origIdx]);

      // Если пользователь уже отвечал — переводим сохранённый оригинальный
      // индекс обратно в позицию внутри его перемешанного списка
      let shuffledSelectedOption: number | null = null;
      if (alreadyAnswered) {
        shuffledSelectedOption = shuffledIndices.indexOf(alreadyAnswered.selected_option);
      }

      return res.json({
        phase: 'question',
        questionIndex: state.questionIndex,
        totalQuestions: questions.length,
        timeLeft: state.timeLeft,
        questionText: fullQuestion.question,
        options: shuffledOptions,
        alreadyAnswered: alreadyAnswered !== null,
        selectedOption: shuffledSelectedOption,
      });
    }

    const fullQuestion = questions[state.questionIndex];
    const leaderboard = await getLeaderboard(state.questionIndex);

    return res.json({
  phase: 'reveal',
  questionIndex: state.questionIndex,
  totalQuestions: questions.length,
  timeLeft: state.timeLeft,
  correctOptionIndex: fullQuestion.correct,
  correctOptionText: fullQuestion.options[fullQuestion.correct],
  wasCorrect: alreadyAnswered?.is_correct ?? false,
  didAnswer: alreadyAnswered !== null,
  leaderboard,
});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения состояния викторины' });
  }
});

router.post('/answer', async (req: Request, res: Response) => {
  const { userId, selectedOption, questionIndex } = req.body;

  try {
    const settingsResult = await pool.query(
      'SELECT quiz_unlocked, quiz_start_time, quiz_paused_at, quiz_paused_seconds FROM event_settings WHERE id = 1'
    );
    const row = settingsResult.rows[0] ?? {};

    if (!row.quiz_unlocked) {
      return res.status(400).json({ error: 'Викторина завершена' });
    }

    const state = computeLiveState(
      row.quiz_start_time ?? null,
      row.quiz_paused_at ?? null,
      row.quiz_paused_seconds ?? 0
    );

    if (state.phase !== 'question') {
      return res.status(400).json({ error: 'Сейчас нельзя отвечать' });
    }

    // Защита от гонки — проверяем, что ответ пришёл именно на тот вопрос,
    // который сейчас актуален на сервере, а не на предыдущий
    if (typeof questionIndex !== 'number' || questionIndex !== state.questionIndex) {
      return res.status(400).json({ error: 'Время на этот вопрос истекло, ответ не принят' });
    }

    const fullQuestion = questions[state.questionIndex];

    // НОВОЕ: selectedOption пришёл как позиция в перемешанном списке этого
    // пользователя — переводим обратно в оригинальный индекс варианта
    const shuffledIndices = getShuffledIndices(userId, state.questionIndex, fullQuestion.options.length);
    const originalSelectedIndex = shuffledIndices[Number(selectedOption)];

    const correctAnswerIndex = fullQuestion.correct;
    const isCorrect = originalSelectedIndex === correctAnswerIndex;

    const inserted = await pool.query(
      `INSERT INTO quiz_answers (user_id, question_index, selected_option, is_correct)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, question_index) DO NOTHING
       RETURNING *`,
      [userId, state.questionIndex, originalSelectedIndex, isCorrect]
    );

    if (inserted.rows.length === 0) {
      return res.status(400).json({ error: 'Вы уже отвечали на этот вопрос' });
    }

    return res.json({ success: true, isCorrect });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обработки ответа' });
  }
});

router.get('/lobby', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, ql.joined_at
      FROM quiz_lobby ql
      JOIN users u ON u.id = ql.user_id
      ORDER BY ql.joined_at ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка' });
  }
});

router.get('/lobby-count', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT COUNT(*) AS count FROM quiz_lobby');
    return res.json({ count: Number(result.rows[0].count) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения количества' });
  }
});

export default router;