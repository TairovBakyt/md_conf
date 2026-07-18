import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/admins/:selfId', async (req: Request, res: Response) => {
  const { selfId } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE is_admin = true AND id != $1 ORDER BY username ASC',
      [selfId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка администраторов' });
  }
});

router.get('/inbox/:selfId', async (req: Request, res: Response) => {
  const { selfId } = req.params;
  try {
    const result = await pool.query(
      `
      SELECT
        u.id AS other_id,
        u.username,
        (
          SELECT COALESCE(message, '📎 вложение')
          FROM admin_messages
          WHERE ((sender_id = $1 AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = $1))
            AND NOT (
              (sender_id = $1 AND hidden_from_sender) OR (recipient_id = $1 AND hidden_from_recipient)
            )
          ORDER BY created_at DESC LIMIT 1
        ) AS last_message,
        (
          SELECT created_at
          FROM admin_messages
          WHERE ((sender_id = $1 AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = $1))
            AND NOT (
              (sender_id = $1 AND hidden_from_sender) OR (recipient_id = $1 AND hidden_from_recipient)
            )
          ORDER BY created_at DESC LIMIT 1
        ) AS last_at,
        (
          SELECT COUNT(*) FROM admin_messages
          WHERE sender_id = u.id AND recipient_id = $1 AND is_read = false AND hidden_from_recipient = false
        ) AS unread_count
      FROM users u
      WHERE u.is_admin = true AND u.id != $1
        AND EXISTS (
          SELECT 1 FROM admin_messages
          WHERE ((sender_id = $1 AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = $1))
            AND NOT (
              (sender_id = $1 AND hidden_from_sender) OR (recipient_id = $1 AND hidden_from_recipient)
            )
        )
      ORDER BY last_at DESC
      `,
      [selfId]
    );

    return res.json(result.rows.map((r) => ({
      otherId: r.other_id,
      username: r.username,
      lastMessage: r.last_message,
      lastAt: r.last_at,
      unreadCount: Number(r.unread_count),
    })));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка переписок' });
  }
});

router.get('/thread/:selfId/:otherId', async (req: Request, res: Response) => {
  const { selfId, otherId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM admin_messages
       WHERE ((sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1))
         AND NOT (
           (sender_id = $1 AND hidden_from_sender) OR (recipient_id = $1 AND hidden_from_recipient)
         )
       ORDER BY created_at ASC`,
      [selfId, otherId]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения переписки' });
  }
});

router.post('/send', async (req: Request, res: Response) => {
  const { senderId, recipientId, message, attachmentType, attachmentData } = req.body;

  if (!senderId || !recipientId) {
    return res.status(400).json({ error: 'Некорректный запрос' });
  }
  if ((!message || !message.trim()) && !attachmentData) {
    return res.status(400).json({ error: 'Пустое сообщение' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO admin_messages (sender_id, recipient_id, message, attachment_type, attachment_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [senderId, recipientId, message?.trim() || null, attachmentType || null, attachmentData || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка отправки сообщения' });
  }
});

router.post('/mark-read', async (req: Request, res: Response) => {
  const { selfId, otherId } = req.body;
  try {
    await pool.query(
      'UPDATE admin_messages SET is_read = true WHERE sender_id = $1 AND recipient_id = $2',
      [otherId, selfId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});

router.delete('/message/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const check = await pool.query('SELECT sender_id FROM admin_messages WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    if (check.rows[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Можно удалять только свои сообщения' });
    }

    await pool.query('DELETE FROM admin_messages WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка удаления сообщения' });
  }
});

router.put('/message/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Сообщение не может быть пустым' });
  }

  try {
    const check = await pool.query('SELECT sender_id FROM admin_messages WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    if (check.rows[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Можно редактировать только свои сообщения' });
    }

    const result = await pool.query(
      'UPDATE admin_messages SET message = $1 WHERE id = $2 RETURNING *',
      [message.trim(), id]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка редактирования сообщения' });
  }
});

router.post('/hide/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { viewerId } = req.body;

  try {
    const check = await pool.query('SELECT sender_id, recipient_id FROM admin_messages WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    const { sender_id, recipient_id } = check.rows[0];

    if (viewerId === sender_id) {
      await pool.query('UPDATE admin_messages SET hidden_from_sender = true WHERE id = $1', [id]);
    } else if (viewerId === recipient_id) {
      await pool.query('UPDATE admin_messages SET hidden_from_recipient = true WHERE id = $1', [id]);
    } else {
      return res.status(403).json({ error: 'Это сообщение не в вашей переписке' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка скрытия сообщения' });
  }
});


router.delete('/thread/:selfId/:otherId', async (req: Request, res: Response) => {
  const { selfId, otherId } = req.params;

  try {
    await pool.query(
      `UPDATE admin_messages
       SET hidden_from_sender = CASE WHEN sender_id = $1 THEN true ELSE hidden_from_sender END,
           hidden_from_recipient = CASE WHEN recipient_id = $1 THEN true ELSE hidden_from_recipient END
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)`,
      [selfId, otherId]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка удаления переписки' });
  }
});



export default router;