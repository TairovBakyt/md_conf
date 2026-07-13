import { Router, Request, Response } from 'express';
import { pool } from '../db';
import questions from '../questions.json';

const router = Router();

const ANSWER_SECONDS = 5;
const REVEAL_SECONDS = 3;
const CYCLE_SECONDS = ANSWER_SECONDS + REVEAL_SECONDS;

function computeLiveState(quizStartTime: Date | null) {
  if (!quizStartTime) {
    return { phase: 'waiting' as const, questionIndex: -1 };
  }

  const elapsedSeconds = (Date.now() - new Date(quizStartTime).getTime()) / 1000;
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
    const settingsResult = await pool.query('SELECT quiz_start_time FROM event_settings WHERE id = 1');
    const quizStartTime = settingsResult.rows[0]?.quiz_start_time ?? null;

    const state = computeLiveState(quizStartTime);

    if (state.phase === 'waiting') {
      return res.json({ phase: 'waiting' });
    }

    if (state.phase === 'finished') {
      await finalizeIfNeeded(userId);

      const finalResult = await pool.query('SELECT score, bonus FROM quiz_final_results WHERE user_id = $1', [userId]);
      const leaderboard = await getLeaderboard(questions.length - 1);

      return res.json({
        phase: 'finished',
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
      return res.json({
        phase: 'question',
        questionIndex: state.questionIndex,
        totalQuestions: questions.length,
        timeLeft: state.timeLeft,
        questionText: fullQuestion.question,
        options: fullQuestion.options,
        alreadyAnswered: alreadyAnswered !== null,
        selectedOption: alreadyAnswered?.selected_option ?? null,
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
      wasCorrect: alreadyAnswered?.is_correct ?? false,
      leaderboard,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения состояния викторины' });
  }
});

router.post('/answer', async (req: Request, res: Response) => {
  const { userId, selectedOption } = req.body;

  try {
    const settingsResult = await pool.query('SELECT quiz_start_time FROM event_settings WHERE id = 1');
    const quizStartTime = settingsResult.rows[0]?.quiz_start_time ?? null;
    const state = computeLiveState(quizStartTime);

    if (state.phase !== 'question') {
      return res.status(400).json({ error: 'Сейчас нельзя отвечать' });
    }

    const correctAnswerIndex = questions[state.questionIndex].correct;
    const isCorrect = Number(selectedOption) === correctAnswerIndex;

    const inserted = await pool.query(
      `INSERT INTO quiz_answers (user_id, question_index, selected_option, is_correct)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, question_index) DO NOTHING
       RETURNING *`,
      [userId, state.questionIndex, selectedOption, isCorrect]
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

export default router;

// import { Router, Request, Response } from 'express';
// import { pool } from '../db';
// import questions from '../questions.json';

// const router = Router();

// router.post('/start', async (req: Request, res: Response) => {
//   const { userId } = req.body;

//   if (!userId) return res.status(400).json({ error: 'ID пользователя обязателен' });

//   try {
//     const settingsCheck = await pool.query('SELECT quiz_unlocked FROM event_settings WHERE id = 1');
//     if (!settingsCheck.rows[0]?.quiz_unlocked) {
//       return res.status(403).json({ error: 'Викторина ещё не открыта организатором' });
//     }

//     const sessionCheck = await pool.query('SELECT * FROM quiz_sessions WHERE user_id = $1', [userId]);

//     if (sessionCheck.rows.length > 0) {
//       if (sessionCheck.rows[0].current_question_index >= questions.length) {
//         return res.status(400).json({ error: 'Вы уже прошли эту викторину!' });
//       }
//       return res.json({ message: 'Продолжаем игру', currentIndex: sessionCheck.rows[0].current_question_index });
//     }

//     await pool.query(
//       'INSERT INTO quiz_sessions (user_id, current_question_index, current_quiz_score, question_start_time) VALUES ($1, $2, $3, $4)',
//       [userId, 0, 0, new Date()]
//     );

//     return res.status(201).json({ message: 'Игра началась', currentIndex: 0 });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: 'Ошибка при старте игры' });
//   }
// });

// router.get('/question/:userId', async (req: Request, res: Response) => {
//   const { userId } = req.params;

//   try {
//     const sessionResult = await pool.query('SELECT current_question_index FROM quiz_sessions WHERE user_id = $1', [userId]);

//     if (sessionResult.rows.length === 0) {
//       return res.status(404).json({ error: 'Сессия игры не найдена. Сначала начните игру.' });
//     }

//     const currentIndex = sessionResult.rows[0].current_question_index;

//     if (currentIndex >= questions.length) {
//       return res.json({ isFinished: true });
//     }

//     const fullQuestion = questions[currentIndex];

//     const safeQuestion = {
//       id: fullQuestion.id,
//       questionText: fullQuestion.question,
//       options: fullQuestion.options,
//       currentIndex: currentIndex,
//       totalQuestions: questions.length
//     };

//     await pool.query('UPDATE quiz_sessions SET question_start_time = $1 WHERE user_id = $2', [new Date(), userId]);

//     return res.json(safeQuestion);
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: 'Ошибка получения вопроса' });
//   }
// });

// router.post('/answer', async (req: Request, res: Response) => {
//   const { userId, selectedOption } = req.body;

//   try {
//     const sessionResult = await pool.query('SELECT * FROM quiz_sessions WHERE user_id = $1', [userId]);
//     if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Сессия не найдена' });

//     const session = sessionResult.rows[0];
//     const currentIndex = session.current_question_index;

//     if (currentIndex >= questions.length) {
//       return res.status(400).json({ error: 'Игра уже завершена' });
//     }

//     const correctAnswerIndex = questions[currentIndex].correct;

//     const now = new Date().getTime();
//     const startTime = new Date(session.question_start_time).getTime();
//     const secondsPassed = (now - startTime) / 1000;

//     let pointsToAdd = 0;
//     let isTimeOut = false;

//     if (secondsPassed > 22) {
//       isTimeOut = true;
//     }
//     if (!isTimeOut && selectedOption !== null) {
//       if (Number(selectedOption) === correctAnswerIndex) {
//         pointsToAdd = 1;
//       }
//     }

//     const nextIndex = currentIndex + 1;
//     let finalQuizScore = session.current_quiz_score + pointsToAdd;

//     await pool.query(
//       'UPDATE quiz_sessions SET current_question_index = $1, current_quiz_score = $2 WHERE user_id = $3',
//       [nextIndex, finalQuizScore, userId]
//     );

//     if (nextIndex >= questions.length) {
//       let bonusPoints = 0;
//       if (finalQuizScore === questions.length) {
//         bonusPoints = 5;
//       }

//       const totalEarned = finalQuizScore + bonusPoints;

//       await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [totalEarned, userId]);

//       if (bonusPoints > 0) {
//         await pool.query(
//           'INSERT INTO achievements (user_id, title, points) VALUES ($1, $2, $3)',
//           [userId, 'Senior Developer', bonusPoints]
//         );
//       }

//       return res.json({
//         isFinished: true,
//         scoreEarned: finalQuizScore,
//         bonusEarned: bonusPoints,
//         totalEarned: totalEarned,
//         wasCorrect: pointsToAdd > 0,
//         correctOptionIndex: correctAnswerIndex,
//         message: bonusPoints > 0 ? 'Senior Developer! +5 экстра-баллов!' : 'Игра окончена'
//       });
//     }

//     return res.json({
//       isFinished: false,
//       isTimeOut: isTimeOut,
//       wasCorrect: pointsToAdd > 0,
//       correctOptionIndex: correctAnswerIndex
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: 'Ошибка обработки ответа' });
//   }
// });

// export default router;