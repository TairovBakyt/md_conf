import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

interface AverageComparisonProps {
  myScore: number;
}

export const AverageComparison: React.FC<AverageComparisonProps> = ({ myScore }) => {
  const [average, setAverage] = useState<number | null>(null);

  useEffect(() => {
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
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  if (average === null) return null;

  const maxValue = Math.max(myScore, average, 1);
  const diff = myScore - average;

  return (
    <div className="pixel-panel p-4">
      <p className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-3">
        Вы против среднего
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-mc-cream/80 text-[10px]">Вы</span>
            <span className="text-mc-gold text-[10px] font-medium">{myScore}</span>
          </div>
          <div className="pixel-track h-2.5 overflow-hidden">
            <div
              className="pixel-fill-gold h-full transition-all duration-500"
              style={{ width: `${(myScore / maxValue) * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-mc-cream/80 text-[10px]">Среднее по всем</span>
            <span className="text-mc-cream/50 text-[10px] font-medium">{average}</span>
          </div>
          <div className="pixel-track h-2.5 overflow-hidden">
            <div
              className="pixel-fill h-full transition-all duration-500"
              style={{ width: `${(average / maxValue) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <p className={`text-[10px] mt-3 ${diff >= 0 ? 'text-mc-emerald' : 'text-mc-cream/50'}`}>
        {diff > 0 && `Вы выше среднего на ${diff} баллов`}
        {diff === 0 && 'Вы точно на среднем уровне'}
        {diff < 0 && `До среднего не хватает ${Math.abs(diff)} баллов`}
      </p>
    </div>
  );
};

export default AverageComparison;