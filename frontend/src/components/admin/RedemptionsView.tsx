import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';

interface Redemption {
  id: number;
  username: string;
  user_id: string;
  prize_title: string;
  cost: number;
  redeemed_at: string;
}

export const RedemptionsView: React.FC = () => {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRedemptions = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/redemptions`);
      const data = await res.json();
      if (res.ok) {
        setRedemptions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions(true);
    const interval = setInterval(() => fetchRedemptions(false), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">Выкупленные призы</span>
        <button onClick={() => fetchRedemptions(true)} className="text-xs text-slate-500 hover:text-slate-300">
          Обновить
        </button>
      </div>
    
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-6">Загружаем...</p>
      ) : redemptions.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">Пока никто ничего не выкупил</p>
      ) : (
        <div className="flex flex-col gap-2">
          {redemptions.map((r) => (
            <div key={r.id} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-slate-100 text-sm font-medium truncate">{r.prize_title}</p>
                <p className="text-slate-500 text-xs font-mono truncate">
                  {r.username} · {r.user_id}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-300 text-xs">{r.cost} б.</p>
                <p className="text-slate-600 text-[10px]">
                  {new Date(r.redeemed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RedemptionsView;