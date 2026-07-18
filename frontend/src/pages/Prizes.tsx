import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';

import { API_URL } from '../config';

interface Prize {
  id: number;
  title: string;
  tier: 'low' | 'middle' | 'high';
  cost: number;
  stock: number | null;
  description: string | null;
}

interface RedeemedPrize {
  id: number;
  title: string;
  cost: number;
  redeemed_at: string;
}

const TIER_LABELS: Record<string, string> = {
  low: 'Low-уровень',
  middle: 'Middle-уровень',
  high: 'High-уровень',
};

const TIER_ORDER = ['low', 'middle', 'high'];

export const Prizes: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [redeemedPrizes, setRedeemedPrizes] = useState<RedeemedPrize[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Тихий фоновый поллинг — держит баланс, список полученных призов и
  // остатки в магазине актуальными, если админ что-то поменял в другом
  // месте (например, вернул приз через "Возврат" на стойке призов) пока
  // участник смотрит этот экран. Ошибка/loading при этом не трогаются —
  // только первая загрузка (isInitial=true) имеет право показать заглушку.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => loadData(false), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async (isInitial: boolean) => {
    if (!user) return;
    if (isInitial) setLoading(true);
    try {
      const [prizesRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/prizes`),
        fetch(`${API_URL}/api/user/${user.id}`),
      ]);
      const prizesData = await prizesRes.json();
      const userData = await userRes.json();

      if (!prizesRes.ok || !userRes.ok) {
        if (isInitial) setErrorMsg('Не удалось загрузить магазин');
        return;
      }

      setPrizes(prizesData);
      setBalance(userData.total_score);
      setRedeemedPrizes(userData.redeemed_prizes || []);
      if (isInitial) setErrorMsg('');
    } catch (err) {
      console.error(err);
      if (isInitial) setErrorMsg('Сервер недоступен');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const handleRedeem = async (prize: Prize) => {
    if (!user) return;
    setRedeemingId(prize.id);
    setToast('');

    try {
      const res = await fetch(`${API_URL}/api/prizes/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, prizeId: prize.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setToast(data.error || 'Не удалось обменять баллы');
        setRedeemingId(null);
        return;
      }

      setBalance(data.newBalance);
      setRedeemedPrizes((prev) => [
        { id: Date.now(), title: data.prizeTitle, cost: prize.cost, redeemed_at: new Date().toISOString() },
        ...prev,
      ]);
      setToast(`Получено: ${data.prizeTitle}! Покажи этот экран волонтёру, чтобы забрать приз.`);
    } catch (err) {
      console.error(err);
      setToast('Сервер недоступен');
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Загружаем магазин...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-red-400 text-center">{errorMsg}</span>
        <Link to="/dashboard" className="text-slate-400 underline text-sm">
          Вернуться в профиль
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-center mb-6">
          <span className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            MDCONF STORE
          </span>
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
            Назад
          </Link>
        </div>

        <div className="bg-slate-950 rounded-2xl p-4 flex items-center justify-between mb-6">
          <span className="text-slate-400 text-sm">Твой баланс</span>
          <span className="text-slate-100 text-xl font-bold">{balance} баллов</span>
        </div>

        {toast && (
          <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-3 mb-6 text-emerald-300 text-sm">
            {toast}
          </div>
        )}

         {redeemedPrizes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
              Мои призы
            </h2>
            <div className="flex flex-col gap-2">
              {redeemedPrizes.map((rp) => (
                <div
                  key={rp.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <span className="text-slate-200 text-sm">{rp.title}</span>
                  <span className="text-slate-500 text-xs">{rp.cost} б.</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {TIER_ORDER.map((tier) => {
          const tierPrizes = prizes.filter((p) => p.tier === tier);
          if (tierPrizes.length === 0) return null;

          return (
            <div key={tier} className="mb-6">
              <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
                {TIER_LABELS[tier] || tier}
              </h2>
              <div className="flex flex-col gap-2.5">
                {tierPrizes.map((prize) => {
                  const canAfford = balance !== null && balance >= prize.cost;
                  const isRedeeming = redeemingId === prize.id;

                  return (
                    <div
                      key={prize.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-slate-100 text-sm font-medium">{prize.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{prize.cost} баллов</p>
                      </div>
                      <button
                        onClick={() => handleRedeem(prize)}
                        disabled={!canAfford || isRedeeming}
                        className={`shrink-0 text-xs font-medium rounded-lg px-3.5 py-2 transition-colors ${
                          canAfford
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isRedeeming ? '...' : canAfford ? 'Обменять' : 'Не хватает'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Prizes;