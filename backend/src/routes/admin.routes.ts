import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

router.post('/toggle-game', async (req: Request, res: Response) => {
  const { adminId, game, unlocked } = req.body;

  if (game !== 'quiz' && game !== 'filword') {
    return res.status(400).json({ error: 'Неизвестная игра' });
  }

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const column = game === 'quiz' ? 'quiz_unlocked' : 'filword_unlocked';
    await pool.query(`UPDATE event_settings SET ${column} = $1 WHERE id = 1`, [unlocked]);

    return res.json({ success: true, game, unlocked });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения настроек' });
  }
});

router.get('/redemptions', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.redeemed_at, u.username, u.id AS user_id, p.title AS prize_title, p.cost
      FROM prize_redemptions pr
      JOIN users u ON pr.user_id = u.id
      JOIN prizes p ON pr.prize_id = p.id
      ORDER BY pr.redeemed_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка выдач' });
  }
});

router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.title, a.points, a.created_at, u.username, u.id AS user_id
      FROM achievements a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка достижений' });
  }
});

router.post('/scan', async (req: Request, res: Response) => {
  const { adminId, targetUserId, points } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);

    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query(
      'UPDATE users SET total_score = total_score + $1 WHERE id = $2',
      [points, targetUserId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка начисления баллов' });
  }
});

router.post('/toggle-admin', async (req: Request, res: Response) => {
  const { adminId, targetUserId, isAdmin } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const targetCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [targetUserId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, targetUserId]);

    return res.json({ success: true, username: targetCheck.rows[0].username, isAdmin });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения прав администратора' });
  }
});

router.post('/open-quiz', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query('UPDATE event_settings SET quiz_unlocked = true, quiz_start_time = NULL WHERE id = 1');
    await pool.query('DELETE FROM quiz_lobby');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка открытия викторины' });
  }
});

router.post('/start-quiz-live', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query('DELETE FROM quiz_answers');
    await pool.query('DELETE FROM quiz_final_results');
    await pool.query('UPDATE event_settings SET quiz_start_time = NOW(), quiz_paused_at = NULL, quiz_paused_seconds = 0 WHERE id = 1');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка запуска викторины' });
  }
});

router.post('/pause-quiz', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query(
      'UPDATE event_settings SET quiz_paused_at = NOW() WHERE id = 1 AND quiz_paused_at IS NULL'
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка постановки на паузу' });
  }
});

router.post('/resume-quiz', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query(`
      UPDATE event_settings
      SET quiz_paused_seconds = quiz_paused_seconds + EXTRACT(EPOCH FROM (NOW() - quiz_paused_at))::INT,
          quiz_paused_at = NULL
      WHERE id = 1 AND quiz_paused_at IS NOT NULL
    `);

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка снятия с паузы' });
  }
});

router.post('/end-quiz', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query(`
      UPDATE event_settings
      SET quiz_unlocked = false, quiz_start_time = NULL, quiz_paused_at = NULL, quiz_paused_seconds = 0
      WHERE id = 1
    `);
    await pool.query('DELETE FROM quiz_lobby');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка завершения викторины' });
  }
});

// НОВОЕ: аналоги для филворда

router.post('/open-filword', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query('UPDATE event_settings SET filword_unlocked = true, filword_start_time = NULL WHERE id = 1');
    await pool.query('DELETE FROM filword_lobby');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка открытия филворда' });
  }
});

router.post('/start-filword-live', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query('DELETE FROM filword_sessions');
    await pool.query('UPDATE event_settings SET filword_start_time = NOW() WHERE id = 1');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка запуска филворда' });
  }
});

router.post('/end-filword', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query('UPDATE event_settings SET filword_unlocked = false, filword_start_time = NULL WHERE id = 1');
    await pool.query('DELETE FROM filword_lobby');

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка завершения филворда' });
  }
});

// Участник сканирует QR админа — создаём запрос
router.post('/request-scan', async (req: Request, res: Response) => {
  const { adminId, participantId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(400).json({ error: 'Это не QR организатора' });
    }

    const participantCheck = await pool.query('SELECT id FROM users WHERE id = $1', [participantId]);
    if (participantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Участник не найден' });
    }

    await pool.query(
      'INSERT INTO scan_requests (admin_id, participant_id) VALUES ($1, $2)',
      [adminId, participantId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка отправки запроса' });
  }
});

// Админ опрашивает — не отсканировал ли его кто-то из участников
router.get('/scan-requests/:adminId', async (req: Request, res: Response) => {
  const { adminId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, participant_id FROM scan_requests
       WHERE admin_id = $1 AND consumed = false
       ORDER BY created_at ASC
       LIMIT 1`,
      [adminId]
    );

    if (result.rows.length === 0) {
      return res.json({ participantId: null });
    }

    await pool.query('UPDATE scan_requests SET consumed = true WHERE id = $1', [result.rows[0].id]);

    return res.json({ participantId: result.rows[0].participant_id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения запроса' });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const participantsResult = await pool.query('SELECT COUNT(*) AS count FROM users WHERE is_admin = false');
    const pointsResult = await pool.query('SELECT COALESCE(SUM(total_score), 0) AS total FROM users');
    const redemptionsResult = await pool.query('SELECT COUNT(*) AS count FROM prize_redemptions');
    const achievementsResult = await pool.query('SELECT COUNT(*) AS count FROM achievements');

    return res.json({
      totalParticipants: Number(participantsResult.rows[0].count),
      totalPointsIssued: Number(pointsResult.rows[0].total),
      totalRedemptions: Number(redemptionsResult.rows[0].count),
      totalAchievements: Number(achievementsResult.rows[0].count),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

router.get('/recent-activity', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      (
        SELECT 'redemption' AS type, pr.redeemed_at AS created_at, u.username, p.title AS detail, NULL::int AS points
        FROM prize_redemptions pr
        JOIN users u ON pr.user_id = u.id
        JOIN prizes p ON pr.prize_id = p.id
      )
      UNION ALL
      (
        SELECT 'achievement' AS type, a.created_at, u.username, a.title AS detail, a.points
        FROM achievements a
        JOIN users u ON a.user_id = u.id
      )
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения активности' });
  }
});

router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT username, total_score
      FROM users
      WHERE is_admin = false
      ORDER BY total_score DESC
      LIMIT 5
    `);
    return res.json(result.rows.map((r) => ({ username: r.username, score: Number(r.total_score) })));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения рейтинга' });
  }
});

router.get('/prize-tier-stats', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.tier, COUNT(*) AS count
      FROM prize_redemptions pr
      JOIN prizes p ON pr.prize_id = p.id
      GROUP BY p.tier
    `);
    const counts: Record<string, number> = { low: 0, middle: 0, high: 0 };
    result.rows.forEach((r) => {
      counts[r.tier] = Number(r.count);
    });
    return res.json(counts);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения статистики призов' });
  }
});

export default router;