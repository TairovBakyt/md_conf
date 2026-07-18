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

// История уже полученных призов конкретного участника — используется
// на стойке выдачи призов (PrizeBoothView), чтобы админ видел не только
// доступные для обмена призы, но и то, что участник уже получил ранее.
router.get('/history/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT pr.id, pr.redeemed_at, p.title, p.tier, p.cost
       FROM prize_redemptions pr
       JOIN prizes p ON pr.prize_id = p.id
       WHERE pr.user_id = $1
       ORDER BY pr.redeemed_at DESC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения истории призов' });
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

// Возврат выданного приза — на случай, если участник хочет обменять на
// другой приз или выдача была ошибкой. Баллы возвращаются на баланс,
// запись о выдаче удаляется (это автоматически освобождает место в
// ограниченном stock, так как остаток считается по количеству строк
// в prize_redemptions).
router.delete('/redemption/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const redemptionResult = await pool.query(
      `SELECT pr.user_id, pr.prize_id, p.cost, p.title
       FROM prize_redemptions pr
       JOIN prizes p ON pr.prize_id = p.id
       WHERE pr.id = $1`,
      [id]
    );

    if (redemptionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Запись о выдаче не найдена' });
    }

    const { user_id, cost, title } = redemptionResult.rows[0];

    await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [cost, user_id]);
    await pool.query('DELETE FROM prize_redemptions WHERE id = $1', [id]);

    const newBalanceResult = await pool.query('SELECT total_score FROM users WHERE id = $1', [user_id]);

    return res.json({
      success: true,
      prizeTitle: title,
      refundedPoints: cost,
      newBalance: newBalanceResult.rows[0]?.total_score ?? null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка возврата приза' });
  }
});

export default router;