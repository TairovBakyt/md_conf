import { Router, Request, Response } from 'express';
import { pool } from '../db';
import questions from '../questions.json';

const router = Router();

router.post('/start', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'ID пользователя обязателен' });

  try {
    const settingsCheck = await pool.query('SELECT quiz_unlocked FROM event_settings WHERE id = 1');
    if (!settingsCheck.rows[0]?.quiz_unlocked) {
      return res.status(403).json({ error: 'Викторина ещё не открыта организатором' });
    }

    const sessionCheck = await pool.query('SELECT * FROM quiz_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length > 0) {
      if (sessionCheck.rows[0].current_question_index >= questions.length) {
        return res.status(400).json({ error: 'Вы уже прошли эту викторину!' });
      }
      return res.json({ message: 'Продолжаем игру', currentIndex: sessionCheck.rows[0].current_question_index });
    }

    await pool.query(
      'INSERT INTO quiz_sessions (user_id, current_question_index, current_quiz_score, question_start_time) VALUES ($1, $2, $3, $4)',
      [userId, 0, 0, new Date()]
    );

    return res.status(201).json({ message: 'Игра началась', currentIndex: 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка при старте игры' });
  }
});

router.get('/question/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const sessionResult = await pool.query('SELECT current_question_index FROM quiz_sessions WHERE user_id = $1', [userId]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия игры не найдена. Сначала начните игру.' });
    }

    const currentIndex = sessionResult.rows[0].current_question_index;

    if (currentIndex >= questions.length) {
      return res.json({ isFinished: true });
    }

    const fullQuestion = questions[currentIndex];

    const safeQuestion = {
      id: fullQuestion.id,
      questionText: fullQuestion.question,
      options: fullQuestion.options,
      currentIndex: currentIndex,
      totalQuestions: questions.length
    };

    await pool.query('UPDATE quiz_sessions SET question_start_time = $1 WHERE user_id = $2', [new Date(), userId]);

    return res.json(safeQuestion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения вопроса' });
  }
});

router.post('/answer', async (req: Request, res: Response) => {
  const { userId, selectedOption } = req.body;

  try {
    const sessionResult = await pool.query('SELECT * FROM quiz_sessions WHERE user_id = $1', [userId]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Сессия не найдена' });

    const session = sessionResult.rows[0];
    const currentIndex = session.current_question_index;

    if (currentIndex >= questions.length) {
      return res.status(400).json({ error: 'Игра уже завершена' });
    }

    const correctAnswerIndex = questions[currentIndex].correct;

    const now = new Date().getTime();
    const startTime = new Date(session.question_start_time).getTime();
    const secondsPassed = (now - startTime) / 1000;

    let pointsToAdd = 0;
    let isTimeOut = false;

    if (secondsPassed > 22) {
      isTimeOut = true;
    }
    if (!isTimeOut && selectedOption !== null) {
      if (Number(selectedOption) === correctAnswerIndex) {
        pointsToAdd = 1;
      }
    }

    const nextIndex = currentIndex + 1;
    let finalQuizScore = session.current_quiz_score + pointsToAdd;

    await pool.query(
      'UPDATE quiz_sessions SET current_question_index = $1, current_quiz_score = $2 WHERE user_id = $3',
      [nextIndex, finalQuizScore, userId]
    );

    if (nextIndex >= questions.length) {
      let bonusPoints = 0;
      if (finalQuizScore === questions.length) {
        bonusPoints = 5;
      }

      const totalEarned = finalQuizScore + bonusPoints;

      await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [totalEarned, userId]);

      if (bonusPoints > 0) {
        await pool.query(
          'INSERT INTO achievements (user_id, title, points) VALUES ($1, $2, $3)',
          [userId, 'Senior Developer', bonusPoints]
        );
      }

      return res.json({
        isFinished: true,
        scoreEarned: finalQuizScore,
        bonusEarned: bonusPoints,
        totalEarned: totalEarned,
        wasCorrect: pointsToAdd > 0,
        correctOptionIndex: correctAnswerIndex,
        message: bonusPoints > 0 ? 'Senior Developer! +5 экстра-баллов!' : 'Игра окончена'
      });
    }

    return res.json({
      isFinished: false,
      isTimeOut: isTimeOut,
      wasCorrect: pointsToAdd > 0,
      correctOptionIndex: correctAnswerIndex
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обработки ответа' });
  }
});

export default router;