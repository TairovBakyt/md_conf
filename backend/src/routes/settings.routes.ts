import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT quiz_unlocked, filword_unlocked, quiz_mode, filword_mode,
              (quiz_paused_at IS NOT NULL) AS quiz_paused,
              station1_unlocked, station3_unlocked, station5_unlocked, station6_unlocked
       FROM event_settings WHERE id = 1`
    );
    const row = result.rows[0] || {
      quiz_unlocked: false,
      filword_unlocked: false,
      quiz_mode: 'individual',
      filword_mode: 'individual',
      quiz_paused: false,
      station1_unlocked: false,
      station3_unlocked: false,
      station5_unlocked: false,
      station6_unlocked: false,
    };
    return res.json(row);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения настроек' });
  }
});

export default router;