import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { useSmartPolling } from '../hooks/useSmartPolling';

interface LeaderboardEntry {
  username: string;
  score: number;
}

export const LiveLeaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/leaderboard`);
      const data = await res.json();
      if (res.ok) setEntries(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useSmartPolling(fetchData, 15000);

  const maxScore = Math.max(...entries.map((e) => e.score), 1);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Топ участников
      </p>
      {entries.length === 0 && <p className="text-slate-600 text-xs">Пока нет данных</p>}
      <div className="flex flex-col gap-2.5">
        {entries.map((entry, i) => (
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

export default LiveLeaderboard;