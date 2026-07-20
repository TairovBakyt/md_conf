import { Router, Request, Response } from 'express';
import { pool } from '../db';


const router = Router();

// Поиск участников по ID или имени — частичное совпадение, до 20 результатов.
// Используется в ChatInbox.tsx, чтобы админ мог найти участника и написать
// ему первым, даже если переписки ещё не было. Админы (is_admin) исключены
// из результатов — чат предназначен для admin↔participant.
router.get('/search', async (req: Request, res: Response) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.json([]);
  }

  try {
    const result = await pool.query(
      `SELECT id, username FROM users
       WHERE (id ILIKE $1 OR username ILIKE $1)
         AND (is_admin = false OR is_admin IS NULL)
       ORDER BY username ASC
       LIMIT 20`,
      [`%${query}%`]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка поиска участников' });
  }
});

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
      is_main_admin: user.is_main_admin,
      session_version: user.session_version,
      admin_permissions: user.admin_permissions,
      achievements: achievementsResult.rows,
      redeemed_prizes: redeemedPrizesResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения данных дашборда' });
  }
});

export default router;