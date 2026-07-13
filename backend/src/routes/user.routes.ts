import { Router, Request, Response } from 'express';
import { pool } from '../db';


const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  const userId = req.params.id;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    const quizResultCheck = await pool.query('SELECT 1 FROM quiz_final_results WHERE user_id = $1', [userId]);
    const isQuizPassed = quizResultCheck.rows.length > 0;

    const filwordSessionCheck = await pool.query('SELECT is_finished FROM filword_sessions WHERE user_id = $1', [userId]);
    const isFilwordPassed = filwordSessionCheck.rows.length > 0 && filwordSessionCheck.rows[0].is_finished;

    const achievementsResult = await pool.query('SELECT * FROM achievements WHERE user_id = $1', [userId]);

    const redeemedPrizesResult = await pool.query(`
      SELECT pr.id, pr.redeemed_at, p.title, p.cost
      FROM prize_redemptions pr
      JOIN prizes p ON pr.prize_id = p.id
      WHERE pr.user_id = $1
      ORDER BY pr.redeemed_at DESC
    `, [userId]);

    return res.json({
      id: user.id,
      username: user.username,
      total_score: user.total_score,
      is_quiz_passed: isQuizPassed,
      is_filword_passed: isFilwordPassed,
      is_admin: user.is_admin,
      achievements: achievementsResult.rows,
      redeemed_prizes: redeemedPrizesResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения данных дашборда' });
  }
});

export default router;