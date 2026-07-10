import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';

interface AchievementRecord {
  id: number;
  username: string;
  user_id: string;
  title: string;
  points: number;
  created_at: string;
}

export const AchievementsView: React.FC = () => {
  const [records, setRecords] = useState<AchievementRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/achievements`);
      const data = await res.json();
      if (res.ok) {
        setRecords(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, []);

  return (
    <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">Достижения участников</span>
        <button onClick={fetchAchievements} className="text-xs text-slate-500 hover:text-slate-300">
          Обновить
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-6">Загружаем...</p>
      ) : records.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">Пока ни у кого нет достижений</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((a) => (
            <div key={a.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
              <span className="text-lg shrink-0">🏆</span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-100 text-sm font-medium truncate">{a.title}</p>
                <p className="text-slate-500 text-xs font-mono truncate">
                  {a.username} · {a.user_id}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-amber-400 text-xs">+{a.points} б.</p>
                <p className="text-slate-600 text-[10px]">
                  {new Date(a.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AchievementsView;