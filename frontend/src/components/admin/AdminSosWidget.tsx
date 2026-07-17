import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';

export const AdminSosWidget: React.FC = () => {
  const [sosCount, setSosCount] = useState(0);

  const fetchCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/sos-count`);
      if (res.ok) {
        const data = await res.json();
        setSosCount(data.count);
      }
    } catch (err) {
      console.error('Ошибка при получении SOS-сигналов:', err);
    }
  };

  useEffect(() => {
    fetchCount();
    // Опрашиваем бэк каждые 5 секунд, чтобы админ видел новые сигналы без перезагрузки
    const interval = setInterval(fetchCount, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleClearSos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/sos-clear`, { method: 'POST' });
      if (res.ok) {
        setSosCount(0);
      }
    } catch (err) {
      console.error('Ошибка при очистке сигналов:', err);
    }
  };

  // Если активных запросов нет — виджет полностью скрывается
  if (sosCount === 0) return null;

  return (
    <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 mb-6 animate-pulse w-full">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🚨</span>
        <div>
          <h4 className="text-rose-400 font-bold text-sm">У стойки нужна помощь!</h4>
          <p className="text-slate-400 text-xs">Активных запросов на сброс данных: {sosCount}</p>
        </div>
      </div>
      <button
        onClick={handleClearSos}
        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors shrink-0"
      >
        Очистить сигналы
      </button>
    </div>
  );
};