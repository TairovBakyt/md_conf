import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.post('/toggle-game', async (req: Request, res: Response) => {
  const { adminId, game, unlocked } = req.body;

  if (game !== 'quiz' && game !== 'filword') {
    return res.status(400).json({ error: 'Неизвестная игра' });
  }

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const column = game === 'quiz' ? 'quiz_unlocked' : 'filword_unlocked';
    await pool.query(`UPDATE event_settings SET ${column} = $1 WHERE id = 1`, [unlocked]);

    return res.json({ success: true, game, unlocked });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения настроек' });
  }
});

router.get('/redemptions', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.redeemed_at, u.username, u.id AS user_id, p.title AS prize_title, p.cost
      FROM prize_redemptions pr
      JOIN users u ON pr.user_id = u.id
      JOIN prizes p ON pr.prize_id = p.id
      ORDER BY pr.redeemed_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка выдач' });
  }
});

router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.title, a.points, a.created_at, u.username, u.id AS user_id
      FROM achievements a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка достижений' });
  }
});

router.post('/scan', async (req: Request, res: Response) => {
  const { adminId, targetUserId, points } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);

    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query(
      'UPDATE users SET total_score = total_score + $1 WHERE id = $2',
      [points, targetUserId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка начисления баллов' });
  }
});

router.post('/toggle-admin', async (req: Request, res: Response) => {
  const { adminId, targetUserId, isAdmin } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const targetCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [targetUserId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, targetUserId]);

    return res.json({ success: true, username: targetCheck.rows[0].username, isAdmin });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения прав администратора' });
  }
});

// Шаг 1: открыть комнату ожидания у всех участников (редиректит их на /quiz)
router.post('/open-quiz', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query('UPDATE event_settings SET quiz_unlocked = true, quiz_start_time = NULL WHERE id = 1');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка открытия викторины' });
  }
});

// Шаг 2: запустить отсчёт — у всех одновременно начинает тикать первый вопрос
router.post('/start-quiz-live', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query('DELETE FROM quiz_answers');
    await pool.query('DELETE FROM quiz_final_results');
    await pool.query('UPDATE event_settings SET quiz_start_time = NOW() WHERE id = 1');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка запуска викторины' });
  }
});

export default router;