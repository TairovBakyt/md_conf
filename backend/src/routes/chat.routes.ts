import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.post('/send', async (req: Request, res: Response) => {
  const { userId, sender, message, attachmentType, attachmentData } = req.body;

  if (!userId || !sender) {
    return res.status(400).json({ error: 'Некорректный запрос' });
  }
  if (sender !== 'participant' && sender !== 'admin') {
    return res.status(400).json({ error: 'Некорректный отправитель' });
  }
  if ((!message || !message.trim()) && !attachmentData) {
    return res.status(400).json({ error: 'Пустое сообщение' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO chat_messages (user_id, sender, message, attachment_type, attachment_data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, sender, message?.trim() || null, attachmentType || null, attachmentData || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

// ----------------------------------------------------
// ШАГ 2.1: Новый эндпоинт получения сообщений для админа.
// Отдаем только те сообщения, которые админ НЕ скрыл.
// ----------------------------------------------------
router.get('/admin-thread/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE user_id = $1 AND (hidden_from_admin = false OR hidden_from_admin IS NULL)
       ORDER BY created_at ASC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения сообщений админом' });
  }
});

// Старый роут оставляем для обратной совместимости, если где-то используется
router.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения сообщений' });
  }
});

// ----------------------------------------------------
// ШАГ 2.2: Обновляем список чатов для админа (inbox).
// В подзапросах учитываем hidden_from_admin = false, 
// чтобы скрытые сообщения не висели в превью диалогов.
// ----------------------------------------------------
router.get('/admin/inbox', async (req: Request, res: Response) => {
  try {
    // Один проход вместо трёх подзапросов на каждого пользователя: LATERAL
    // джойнит последнее непустое сообщение и unread_count разом за один
    // скан индекса idx_chat_messages_user_created на пользователя, вместо
    // трёх отдельных запросов на строку (было: 1 + N×3 запросов).
    const result = await pool.query(`
      SELECT
        u.id AS user_id,
        u.username,
        COALESCE(last_msg.message, '📎 вложение') AS last_message,
        last_msg.created_at AS last_at,
        COALESCE(unread.count, 0) AS unread_count
      FROM users u
      JOIN LATERAL (
        SELECT message, created_at
        FROM chat_messages
        WHERE user_id = u.id AND (hidden_from_admin = false OR hidden_from_admin IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      ) last_msg ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM chat_messages
        WHERE user_id = u.id AND sender = 'participant' AND is_read = false
          AND (hidden_from_admin = false OR hidden_from_admin IS NULL)
      ) unread ON true
      ORDER BY last_msg.created_at DESC
    `);
    return res.json(result.rows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      lastMessage: r.last_message || 'Нет доступных сообщений',
      lastAt: r.last_at,
      unreadCount: Number(r.unread_count),
    })));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения чатов' });
  }
});

router.post('/mark-read', async (req: Request, res: Response) => {
  const { userId } = req.body;

  try {
    await pool.query(
      `UPDATE chat_messages SET is_read = true WHERE user_id = $1 AND sender = 'participant'`,
      [userId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

// Непрочитанные сообщения ОТ АДМИНА для конкретного участника — используется
// для бейджа-уведомления на кнопке "Написать администратору" в HelpBot,
// когда сам чат ещё свёрнут. Зеркально симметрично /admin/inbox, только
// в обратную сторону (sender = 'admin' вместо 'participant').
router.get('/unread-count/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS unread_count
       FROM chat_messages
       WHERE user_id = $1 AND sender = 'admin' AND is_read = false
         AND (hidden_from_participant = false OR hidden_from_participant IS NULL)`,
      [userId]
    );
    return res.json({ unreadCount: Number(result.rows[0].unread_count) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения количества непрочитанных' });
  }
});

// Отмечает сообщения АДМИНА как прочитанные участником — вызывается при
// открытии чата в HelpBot, зеркально /mark-read (который админ вызывает
// при открытии треда участника).
router.post('/mark-read-participant', async (req: Request, res: Response) => {
  const { userId } = req.body;

  try {
    await pool.query(
      `UPDATE chat_messages SET is_read = true WHERE user_id = $1 AND sender = 'admin'`,
      [userId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

router.delete('/message/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM chat_messages WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка удаления сообщения' });
  }
});

router.put('/message/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  try {
    const result = await pool.query(
      'UPDATE chat_messages SET message = $1 WHERE id = $2 RETURNING *',
      [message.trim(), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка редактирования сообщения' });
  }
});

router.delete('/thread/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    await pool.query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка удаления переписки' });
  }
});

router.get('/participant/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE user_id = $1 AND (hidden_from_participant = false OR hidden_from_participant IS NULL)
       ORDER BY created_at ASC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения сообщений' });
  }
});

router.post('/hide/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE chat_messages SET hidden_from_participant = true WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка скрытия сообщения' });
  }
});

// ----------------------------------------------------
// ШАГ 2.3: Новый эндпоинт скрытия сообщения у админа.
// Меняет флаг hidden_from_admin на true.
// ----------------------------------------------------
router.post('/hide-admin/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE chat_messages SET hidden_from_admin = true WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка скрытия сообщения админом' });
  }
});

export default router;