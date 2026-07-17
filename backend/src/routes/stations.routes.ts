import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

const MANUAL_STATION_NUMBERS = [1, 3, 5, 6];

router.get('/:userId', async (req: Request, res: Response) => {
  const userId = String(req.params.userId);

  try {
    const settingsResult = await pool.query(
      'SELECT station1_unlocked, station3_unlocked, station5_unlocked, station6_unlocked FROM event_settings WHERE id = 1'
    );
    const settingsRow = settingsResult.rows[0] ?? {};

    const completionsResult = await pool.query(
      `SELECT station_number, COUNT(*) AS count, COALESCE(SUM(points), 0) AS total_points
       FROM station_completions
       WHERE user_id = $1
       GROUP BY station_number`,
      [userId]
    );

    const completionsByStation: Record<number, { count: number; totalPoints: number }> = {};
    completionsResult.rows.forEach((row) => {
      completionsByStation[row.station_number] = {
        count: Number(row.count),
        totalPoints: Number(row.total_points),
      };
    });

    const stations = MANUAL_STATION_NUMBERS.map((stationNumber) => {
      const completion = completionsByStation[stationNumber];
      return {
        stationNumber,
        completed: !!completion,
        points: completion?.totalPoints ?? 0,
        count: completion?.count ?? 0,
        unlocked: !!settingsRow[`station${stationNumber}_unlocked`],
      };
    });

    const quizResult = await pool.query(
      'SELECT score, bonus FROM quiz_final_results WHERE user_id = $1',
      [userId]
    );
    const quizPoints = quizResult.rows[0]
      ? Number(quizResult.rows[0].score) + Number(quizResult.rows[0].bonus)
      : 0;

    const filwordResult = await pool.query(
      'SELECT score FROM filword_sessions WHERE user_id = $1 AND is_finished = true',
      [userId]
    );
    const filwordPoints = filwordResult.rows[0] ? Number(filwordResult.rows[0].score) : 0;

    return res.json({ stations, quizPoints, filwordPoints });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения статуса станций' });
  }
});

export default router;