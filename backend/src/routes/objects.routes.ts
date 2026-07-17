import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.post('/submit', async (req: Request, res: Response) => {
  const { userId, photoData } = req.body;

  if (!userId || !photoData) {
    return res.status(400).json({ error: 'Нужно фото' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO object_submissions (user_id, photo_data) VALUES ($1, $2) RETURNING id, submitted_at, status',
      [userId, photoData]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка отправки фото' });
  }
});

router.get('/mine/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, submitted_at, status, points_awarded FROM object_submissions WHERE user_id = $1 ORDER BY submitted_at DESC',
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка' });
  }
});

router.get('/pending', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT os.id, os.user_id, u.username, os.photo_data, os.submitted_at
      FROM object_submissions os
      JOIN users u ON u.id = os.user_id
      WHERE os.status = 'pending'
      ORDER BY os.submitted_at ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения очереди' });
  }
});

router.post('/review', async (req: Request, res: Response) => {
  const { submissionId, approve, points } = req.body;

  try {
    const submission = await pool.query('SELECT * FROM object_submissions WHERE id = $1', [submissionId]);
    if (submission.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }
    if (submission.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Уже проверено' });
    }

    const status = approve ? 'approved' : 'rejected';
    const awardedPoints = approve ? Number(points) || 0 : 0;

    await pool.query(
      'UPDATE object_submissions SET status = $1, points_awarded = $2, reviewed_at = NOW() WHERE id = $3',
      [status, awardedPoints, submissionId]
    );

    if (approve && awardedPoints > 0) {
      await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [
        awardedPoints,
        submission.rows[0].user_id,
      ]);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка проверки' });
  }
});

export default router;