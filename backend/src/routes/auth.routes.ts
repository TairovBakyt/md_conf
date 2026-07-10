import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { username, pin } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }

  if (!pin || pin.length !== 4) {
    return res.status(400).json({ error: 'PIN-код должен состоять из 4 цифр' });
  }

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userCheck.rows.length > 0) {
      const existingUser = userCheck.rows[0];

      if (existingUser.pin_code !== pin) {
        return res.status(401).json({ error: 'Неверный PIN-код' });
      }

      return res.json(existingUser);
    } else {
      const newId = `user_${Math.floor(Math.random() * 100000000)}`;

      const newUser = await pool.query(
        'INSERT INTO users (id, username, total_score, pin_code) VALUES ($1, $2, $3, $4) RETURNING *',
        [newId, username, 0, pin]
      );

      return res.status(201).json(newUser.rows[0]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

export default router;