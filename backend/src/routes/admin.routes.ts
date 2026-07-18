import { Router, Request, Response } from 'express';
import { pool } from '../db';
import questions from '../questions.json';

const router = Router();

const QUESTIONS_PER_USER = 20;

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

router.post('/toggle-station', async (req: Request, res: Response) => {
  const { adminId, stationNumber, unlocked } = req.body;

  const allowedStations = [1, 3, 5, 6];
  if (!allowedStations.includes(stationNumber)) {
    return res.status(400).json({ error: 'Неизвестная станция' });
  }

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const column = `station${stationNumber}_unlocked`;
    await pool.query(`UPDATE event_settings SET ${column} = $1 WHERE id = 1`, [unlocked]);

    return res.json({ success: true, stationNumber, unlocked });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения настроек станции' });
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
  const { adminId, targetUserId, points, stationNumber, objectNumber } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);

    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    // Если баллы начисляются за конкретную ручную станцию (1, 3, 5 или 6) —
    // сначала проверяем, что она сейчас открыта. Свободный ввод баллов без
    // stationNumber (например, разовый бонус вне списка станций) эту
    // проверку не проходит — там привязки к тумблеру нет.
    const manualStations = [1, 3, 5, 6];
    if (typeof stationNumber === 'number' && manualStations.includes(stationNumber)) {
      const settingsCheck = await pool.query(
        `SELECT station${stationNumber}_unlocked AS unlocked FROM event_settings WHERE id = 1`
      );
      if (!settingsCheck.rows[0]?.unlocked) {
        return res.status(400).json({ error: `Станция ${stationNumber} сейчас закрыта — откройте её во вкладке "Игры"` });
      }
    }

    // Для станции 5 (поиск объектов) сначала пытаемся зафиксировать
    // именно этот объект за этим участником — уникальный индекс
    // (user_id, station_number, object_number) не даст засчитать один
    // и тот же объект дважды.
    if (typeof stationNumber === 'number') {
      try {
        await pool.query(
          'INSERT INTO station_completions (user_id, station_number, points, object_number) VALUES ($1, $2, $3, $4)',
          [targetUserId, stationNumber, points, typeof objectNumber === 'number' ? objectNumber : null]
        );
      } catch (insertError: any) {
        if (insertError.code === '23505') {
          return res.status(400).json({ error: 'Этот объект уже засчитан этому участнику' });
        }
        throw insertError;
      }
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

// permissions: null/не передано = полный доступ; массив id вкладок = частичный.
// При снятии прав (isAdmin=false) admin_permissions всегда сбрасывается в NULL,
// чтобы при повторном назначении не осталась ошибочная старая настройка.
router.post('/toggle-admin', async (req: Request, res: Response) => {
  const { adminId, targetUserId, isAdmin, permissions } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const targetCheck = await pool.query('SELECT id, username, is_main_admin FROM users WHERE id = $1', [targetUserId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Права главного администратора неприкосновенны — их не может изменить
    // никто, включая других полных админов.
    if (targetCheck.rows[0].is_main_admin) {
      return res.status(403).json({ error: 'Нельзя изменить права главного администратора' });
    }

    const permissionsValue = isAdmin && Array.isArray(permissions) ? JSON.stringify(permissions) : null;

    await pool.query(
      'UPDATE users SET is_admin = $1, admin_permissions = $2::jsonb WHERE id = $3',
      [isAdmin, permissionsValue, targetUserId]
    );

    return res.json({
      success: true,
      username: targetCheck.rows[0].username,
      isAdmin,
      permissions: isAdmin ? (Array.isArray(permissions) ? permissions : null) : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения прав администратора' });
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

// Поиск по нику или ID — для быстрого сброса PIN, если забыт только он.
router.get('/search-users', async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.json([]);
  }

  const trimmed = query.trim();

  try {
    const result = await pool.query(
      `SELECT id, username FROM users 
       WHERE is_admin = false AND (username ILIKE $1 OR id ILIKE $1)
       ORDER BY username ASC LIMIT 20`,
      [`%${trimmed}%`]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка поиска участников' });
  }
});

// Сброс PIN — только если админ лично убедился в личности участника.
router.post('/reset-pin', async (req: Request, res: Response) => {
  const { adminId, targetUserId, newPin } = req.body;

  if (!newPin || !/^\d{4}$/.test(newPin)) {
    return res.status(400).json({ error: 'PIN должен состоять из 4 цифр' });
  }

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const targetCheck = await pool.query('SELECT id, username FROM users WHERE id = $1', [targetUserId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Участник не найден' });
    }

    await pool.query(
      'UPDATE users SET pin_code = $1, session_version = COALESCE(session_version, 1) + 1 WHERE id = $2',
      [newPin, targetUserId]
    );

    return res.json({ success: true, username: targetCheck.rows[0].username });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка сброса PIN' });
  }
});

// Полный список участников с видимым PIN — для случаев, когда забыто
// и имя тоже (например, регистрировался через QR с автосгенерированным
// скрытым PIN).
router.get('/all-participants', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, username, pin_code, total_score FROM users WHERE is_admin = false ORDER BY username ASC'
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка участников' });
  }
});

// ==========================================
// НОВОЕ: СИГНАЛЫ О ПОМОЩИ (SOS) У СТОЙКИ АДМИНА
// ==========================================

// 1. Получить количество активных SOS-запросов (анонимных)
router.get('/sos-count', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) as count FROM sos_signals WHERE status = 'pending'"
    );
    return res.json({ count: Number(result.rows[0].count) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения счетчика SOS' });
  }
});

// 2. Сбросить (очистить) все активные сигналы
router.post('/sos-clear', async (req: Request, res: Response) => {
  try {
    await pool.query("UPDATE sos_signals SET status = 'resolved' WHERE status = 'pending'");
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка сброса сигналов' });
  }
});

router.post('/set-game-mode', async (req: Request, res: Response) => {
  const { adminId, game, mode } = req.body;

  if (game !== 'quiz' && game !== 'filword') {
    return res.status(400).json({ error: 'Неизвестная игра' });
  }
  if (mode !== 'individual' && mode !== 'synced') {
    return res.status(400).json({ error: 'Неизвестный режим' });
  }

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const column = game === 'quiz' ? 'quiz_mode' : 'filword_mode';
    await pool.query(`UPDATE event_settings SET ${column} = $1 WHERE id = 1`, [mode]);

    return res.json({ success: true, game, mode });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения режима' });
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

// Генерирует случайный набор из QUESTIONS_PER_USER индексов вопросов
// (без повторов) из полного банка — используется только synced-режимом,
// один раз за запуск, одинаковый для всех участников сессии.
function generateRandomQuestionPool(): number[] {
  const indices = Array.from({ length: questions.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, QUESTIONS_PER_USER);
}

router.post('/start-quiz-live', async (req: Request, res: Response) => {
  const { adminId } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const questionPool = generateRandomQuestionPool();

    await pool.query('DELETE FROM quiz_answers');
    await pool.query('DELETE FROM quiz_final_results');
    await pool.query(
      `UPDATE event_settings
       SET quiz_start_time = NOW(), quiz_paused_at = NULL, quiz_paused_seconds = 0, quiz_question_pool = $1::jsonb
       WHERE id = 1`,
      [JSON.stringify(questionPool)]
    );

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

export default router;
