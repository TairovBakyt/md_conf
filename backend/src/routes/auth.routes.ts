import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { username, pin } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }

  const trimmedUsername = username.trim();

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN-код должен состоять из 4 цифр' });
  }

  try {
    // Сравниваем без учёта регистра — чтобы "Askar" и "askar" не считались
    // разными людьми и не плодили случайных дублей с похожими именами.
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [trimmedUsername]
    );

    if (userCheck.rows.length > 0) {
      const existingUser = userCheck.rows[0];

      if (existingUser.pin_code !== pin) {
        return res.status(401).json({
          error: 'Такое имя уже зарегистрировано, но PIN не совпадает. Если это не ваш аккаунт — выберите другое имя, если ваш — обратитесь к администратору для сброса PIN.',
        });
      }

      return res.json(existingUser);
    } else {
      let newId = '';
      let isUnique = false;

      // Генерируем 4-значный ID и проверяем его уникальность в базе данных
      while (!isUnique) {
        newId = Math.floor(1000 + Math.random() * 9000).toString(); // Случайное число от 1000 до 9999

        const idCheck = await pool.query('SELECT id FROM users WHERE id = $1', [newId]);
        if (idCheck.rows.length === 0) {
          isUnique = true;
        }
      }

      const newUser = await pool.query(
        'INSERT INTO users (id, username, total_score, pin_code) VALUES ($1, $2, $3, $4) RETURNING *',
        [newId, trimmedUsername, 0, pin]
      );

      return res.status(201).json(newUser.rows[0]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

// НОВОЕ: Анонимный сигнал SOS для сброса данных (без отправки ника/кода)
router.post('/sos-signal', async (req: Request, res: Response) => {
  try {
    await pool.query("INSERT INTO sos_signals (status) VALUES ('pending')");
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка отправки сигнала SOS' });
  }
});

export default router;

// import { Router, Request, Response } from 'express';
// import { pool } from '../db';

// const router = Router();

// router.post('/login', async (req: Request, res: Response) => {
//   const { username, pin } = req.body;

//   if (!username || username.trim() === '') {
//     return res.status(400).json({ error: 'Имя пользователя обязательно' });
//   }

//   if (!pin || pin.length !== 4) {
//     return res.status(400).json({ error: 'PIN-код должен состоять из 4 цифр' });
//   }

//   try {
//     const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

//     if (userCheck.rows.length > 0) {
//       const existingUser = userCheck.rows[0];

//       if (existingUser.pin_code !== pin) {
//         return res.status(401).json({ error: 'Неверный PIN-код' });
//       }

//       return res.json(existingUser);
//     } else {
//       const newId = `user_${Math.floor(Math.random() * 100000000)}`;

//       const newUser = await pool.query(
//         'INSERT INTO users (id, username, total_score, pin_code) VALUES ($1, $2, $3, $4) RETURNING *',
//         [newId, username, 0, pin]
//       );

//       return res.status(201).json(newUser.rows[0]);
//     }
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: 'Ошибка сервера при авторизации' });
//   }
// });

// export default router;