import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { useSmartPolling } from '../hooks/useSmartPolling';

interface AverageComparisonProps {
  myScore: number;
}

const AverageComparisonComponent: React.FC<AverageComparisonProps> = ({ myScore }) => {
  const [average, setAverage] = useState<number | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`);
      const data = await res.json();
      if (res.ok && data.totalParticipants > 0) {
        setAverage(Math.round(data.totalPointsIssued / data.totalParticipants));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useSmartPolling(fetchStats, 15000);

  if (average === null) return null;

  const maxValue = Math.max(myScore, average, 1);
  const diff = myScore - average;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Вы против среднего
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300 text-xs">Вы</span>
            <span className="text-indigo-400 text-xs font-medium">{myScore}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${(myScore / maxValue) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300 text-xs">Среднее по всем</span>
            <span className="text-slate-400 text-xs font-medium">{average}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-600 rounded-full transition-all duration-500"
              style={{ width: `${(average / maxValue) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <p className={`text-xs mt-3 ${diff >= 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
        {diff > 0 && `Вы выше среднего на ${diff} баллов`}
        {diff === 0 && 'Вы точно на среднем уровне'}
        {diff < 0 && `До среднего не хватает ${Math.abs(diff)} баллов`}
      </p>
    </div>
  );
};

export const AverageComparison = React.memo(AverageComparisonComponent);

export default AverageComparison;