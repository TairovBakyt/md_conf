import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';

interface TierStats {
  low: number;
  middle: number;
  high: number;
}

export const PrizeTierChart: React.FC = () => {
  const [stats, setStats] = useState<TierStats>({ low: 0, middle: 0, high: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/prize-tier-stats`);
        const data = await res.json();
        if (res.ok) setStats(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const tiers = [
    { key: 'low', label: 'Low', color: 'from-emerald-500 to-emerald-400', value: stats.low },
    { key: 'middle', label: 'Middle', color: 'from-amber-500 to-amber-400', value: stats.middle },
    { key: 'high', label: 'High', color: 'from-fuchsia-500 to-fuchsia-400', value: stats.high },
  ];

  const maxValue = Math.max(stats.low, stats.middle, stats.high, 1);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Призы по уровням
      </p>
      <div className="flex items-end justify-around gap-3 h-28">
        {tiers.map((tier) => (
          <div key={tier.key} className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-slate-200 text-sm font-semibold">{tier.value}</span>
            <div className="w-full flex items-end h-20 bg-slate-900 rounded-lg overflow-hidden">
              <div
                className={`w-full bg-gradient-to-t ${tier.color} rounded-t-lg transition-all duration-500`}
                style={{ height: `${(tier.value / maxValue) * 100}%` }}
              />
            </div>
            <span className="text-slate-500 text-[10px]">{tier.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrizeTierChart;