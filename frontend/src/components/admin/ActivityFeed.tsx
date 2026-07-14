import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';

interface ActivityItem {
  type: 'redemption' | 'achievement';
  created_at: string;
  username: string;
  detail: string;
  points: number | null;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'только что';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч назад`;
}

export const ActivityFeed: React.FC = () => {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/recent-activity`);
        const data = await res.json();
        if (res.ok) setItems(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 8000);
    return () => clearInterval(interval);
  }, []);

  const chartPoints = items
    .slice()
    .reverse()
    .map((_, i, arr) => {
      const x = arr.length <= 1 ? 0 : (i / (arr.length - 1)) * 100;
      const y = 100 - ((i + 1) / arr.length) * 80;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Последние действия
      </p>

      {items.length === 0 && (
        <p className="text-slate-600 text-xs">Пока ничего не произошло</p>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {items.slice(0, 4).map((item, i) => (
          <div key={i} className="bg-slate-900 rounded-lg p-2.5">
            <div className="flex items-start gap-2">
              <span className="text-sm shrink-0">{item.type === 'redemption' ? '🎁' : '🏆'}</span>
              <div className="min-w-0">
                <p className="text-slate-200 text-xs font-medium truncate">{item.username}</p>
                <p className="text-slate-400 text-xs truncate">
                  {item.type === 'redemption' ? `получил(а) ${item.detail}` : item.detail}
                  {item.points != null && <span className="text-amber-400"> +{item.points}</span>}
                </p>
                <p className="text-slate-600 text-[10px] mt-0.5">{timeAgo(item.created_at)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div>
          <p className="text-slate-400 text-xs mb-2">Активность за день</p>
          <svg viewBox="0 0 100 40" className="w-full h-10" preserveAspectRatio="none">
            <polyline
              points={chartPoints}
              fill="none"
              stroke="#fb923c"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;