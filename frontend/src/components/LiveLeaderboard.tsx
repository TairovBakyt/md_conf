import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

interface LeaderboardEntry {
  username: string;
  score: number;
}

export const LiveLeaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/leaderboard`);
        const data = await res.json();
        if (res.ok) setEntries(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const maxScore = Math.max(...entries.map((e) => e.score), 1);

  return (
    <div className="pixel-panel p-4">
      <p className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-3">
        Топ участников
      </p>
      {entries.length === 0 && <p className="text-mc-cream/40 text-xs">Пока нет данных</p>}
      <div className="flex flex-col gap-2.5">
        {entries.map((entry, i) => (
          <div key={entry.username}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-mc-cream/80 text-[10px] truncate">
                {i + 1}. {entry.username}
              </span>
              <span className="text-mc-gold text-[10px] font-medium shrink-0 ml-2">{entry.score}</span>
            </div>
            <div className="pixel-track h-2 overflow-hidden">
              <div
                className="pixel-fill h-full transition-all duration-500"
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