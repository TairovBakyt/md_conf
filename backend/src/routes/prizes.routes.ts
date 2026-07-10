import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const prizesResult = await pool.query('SELECT * FROM prizes ORDER BY cost ASC');
    return res.json(prizesResult.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка призов' });
  }
});

router.post('/redeem', async (req: Request, res: Response) => {
  const { userId, prizeId } = req.body;

  if (!userId || !prizeId) {
    return res.status(400).json({ error: 'userId и prizeId обязательны' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const user = userResult.rows[0];

    const prizeResult = await pool.query('SELECT * FROM prizes WHERE id = $1', [prizeId]);
    if (prizeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Приз не найден' });
    }
    const prize = prizeResult.rows[0];

    if (user.total_score < prize.cost) {
      return res.status(400).json({ error: 'Недостаточно баллов' });
    }

    if (prize.stock !== null) {
      const redeemedCountResult = await pool.query(
        'SELECT COUNT(*) FROM prize_redemptions WHERE prize_id = $1',
        [prizeId]
      );
      const redeemedCount = parseInt(redeemedCountResult.rows[0].count, 10);

      if (redeemedCount >= prize.stock) {
        return res.status(400).json({ error: 'Приз закончился' });
      }
    }

    await pool.query('UPDATE users SET total_score = total_score - $1 WHERE id = $2', [prize.cost, userId]);
    await pool.query('INSERT INTO prize_redemptions (user_id, prize_id) VALUES ($1, $2)', [userId, prizeId]);

    return res.json({ success: true, prizeTitle: prize.title, newBalance: user.total_score - prize.cost });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обмена приза' });
  }
});

export default router;