import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT quiz_unlocked, filword_unlocked, quiz_start_time, quiz_paused_at, filword_start_time FROM event_settings WHERE id = 1');
    const row = result.rows[0] || { quiz_unlocked: false, filword_unlocked: false, quiz_start_time: null, quiz_paused_at: null, filword_start_time: null };
    return res.json(row);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения настроек' });
  }
});

export default router;  