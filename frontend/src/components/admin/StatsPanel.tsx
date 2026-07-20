import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { useSmartPolling } from '../../hooks/useSmartPolling';

interface Stats {
  totalParticipants: number;
  totalPointsIssued: number;
  totalRedemptions: number;
  totalAchievements: number;
}

interface LeaderboardEntry {
  username: string;
  score: number;
}

export const StatsPanel: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sosCount, setSosCount] = useState(0);
  const [clearingSos, setClearingSos] = useState(false);

  const fetchStatsAndLeaderboard = async () => {
    try {
      const [statsRes, leaderboardRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`),
        fetch(`${API_URL}/api/admin/leaderboard`),
      ]);
      const statsData = await statsRes.json();
      const leaderboardData = await leaderboardRes.json();
      if (statsRes.ok) setStats(statsData);
      if (leaderboardRes.ok) setLeaderboard(leaderboardData);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/sos-count`);
      const data = await res.json();
      if (res.ok) setSosCount(data.count ?? 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatsAndLeaderboard();
    fetchSos();
  }, []);

  // SOS проверяем чаще остального (5 сек), чтобы админ увидел сигнал
  // о помощи максимально быстро, не дожидаясь общего 12-секундного цикла.
  useSmartPolling(fetchSos, 5000);
  useSmartPolling(fetchStatsAndLeaderboard, 12000);

  const handleClearSos = async () => {
    setClearingSos(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/sos-clear`, { method: 'POST' });
      if (res.ok) setSosCount(0);
    } catch (err) {
      console.error(err);
    } finally {
      setClearingSos(false);
    }
  };

  const maxScore = Math.max(...leaderboard.map((e) => e.score), 1);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Быстрая статистика + Топ-5
      </p>

      {sosCount > 0 && (
        <div className="bg-red-950/60 border border-red-500/40 rounded-lg p-3 mb-4 animate-pulse">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-red-300 text-sm font-semibold">
              📢 SOS: {sosCount} {sosCount === 1 ? 'сигнал' : 'сигнала(ов)'}
            </span>
          </div>
          <p className="text-red-300/80 text-xs mb-2">
            Кто-то у стойки регистрации не может войти — подойдите помочь со сбросом PIN.
          </p>
          <button
            onClick={handleClearSos}
            disabled={clearingSos}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg py-2 transition-colors"
          >
            {clearingSos ? 'Сбрасываем...' : 'Отметить как решено'}
          </button>
        </div>
      )}

      <div className="bg-slate-900 rounded-lg p-3 mb-4">
        <p className="text-slate-100 text-lg font-semibold">
          {stats?.totalParticipants ?? '—'} участников
        </p>
        <div className="flex gap-4 mt-1">
          <span className="text-slate-500 text-xs">⭐ {stats?.totalPointsIssued ?? '—'} баллов</span>
          <span className="text-slate-500 text-xs">🎁 {stats?.totalRedemptions ?? '—'} призов</span>
          <span className="text-slate-500 text-xs">🏆 {stats?.totalAchievements ?? '—'}</span>
        </div>
      </div>

      <p className="text-slate-400 text-xs mb-2">Топ-5 участников</p>
      <div className="flex flex-col gap-2.5">
        {leaderboard.map((entry, i) => (
          <div key={entry.username}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-300 text-xs truncate">
                {i + 1}. {entry.username}
              </span>
              <span className="text-amber-400 text-xs font-medium shrink-0 ml-2">{entry.score}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
                style={{ width: `${(entry.score / maxScore) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsPanel;