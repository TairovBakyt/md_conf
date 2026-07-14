import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

interface StationProgressProps {
  userId: string;
  isQuizPassed: boolean;
}

const MANUAL_STATIONS = [
  { number: 3, title: 'Digital Subscriptions' },
  { number: 4, title: 'Сториз-шеринг' },
  { number: 5, title: 'Keep Alive / Ping Game' },
];

export const StationProgress: React.FC<StationProgressProps> = ({ userId, isQuizPassed }) => {
  const [filwordPassed, setFilwordPassed] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/filword/status/${userId}`);
        const data = await res.json();
        if (res.ok) setFilwordPassed(data.passed);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Прогресс по станциям
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 bg-slate-900 rounded-lg p-2.5">
          <span className={`text-sm ${isQuizPassed ? 'text-emerald-400' : 'text-slate-600'}`}>
            {isQuizPassed ? '✅' : '⬜'}
          </span>
          <span className={`text-xs ${isQuizPassed ? 'text-slate-200' : 'text-slate-500'}`}>
            1. Hardcore QA
          </span>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-900 rounded-lg p-2.5">
          <span className={`text-sm ${filwordPassed ? 'text-emerald-400' : 'text-slate-600'}`}>
            {filwordPassed ? '✅' : '⬜'}
          </span>
          <span className={`text-xs ${filwordPassed ? 'text-slate-200' : 'text-slate-500'}`}>
            2. Word Researcher
          </span>
        </div>

        {MANUAL_STATIONS.map((station) => (
          <div key={station.number} className="flex items-center gap-2.5 bg-slate-900 rounded-lg p-2.5">
            <span className="text-sm text-slate-600">🔲</span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">
                {station.number}. {station.title}
              </p>
              <p className="text-slate-600 text-[10px]">Отмечает организатор</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StationProgress;