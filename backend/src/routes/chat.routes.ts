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
    const result = await pool.query(`
      SELECT
        u.id AS user_id,
        u.username,
        (SELECT COALESCE(message, '📎 вложение') 
         FROM chat_messages 
         WHERE user_id = u.id AND (hidden_from_admin = false OR hidden_from_admin IS NULL)
         ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at 
         FROM chat_messages 
         WHERE user_id = u.id AND (hidden_from_admin = false OR hidden_from_admin IS NULL)
         ORDER BY created_at DESC LIMIT 1) AS last_at,
        (SELECT COUNT(*) 
         FROM chat_messages 
         WHERE user_id = u.id AND sender = 'participant' AND is_read = false AND (hidden_from_admin = false OR hidden_from_admin IS NULL)) AS unread_count
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM chat_messages 
        WHERE user_id = u.id AND (hidden_from_admin = false OR hidden_from_admin IS NULL)
      )
      ORDER BY last_at DESC
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