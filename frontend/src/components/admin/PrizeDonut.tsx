import React, { useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { useSmartPolling } from '../../hooks/useSmartPolling';

interface TierStats {
  low: number;
  middle: number;
  high: number;
}

const PrizeDonutComponent: React.FC = () => {
  const [stats, setStats] = useState<TierStats>({ low: 0, middle: 0, high: 0 });

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/prize-tier-stats`);
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useSmartPolling(fetchData, 15000);

  const total = stats.low + stats.middle + stats.high;
  const circumference = 2 * Math.PI * 70;

  const segments = [
    { key: 'low', value: stats.low, color: '#a78bfa', label: 'Low' },
    { key: 'middle', value: stats.middle, color: '#fb923c', label: 'Middle' },
    { key: 'high', value: stats.high, color: '#34d399', label: 'High' },
  ];

  let offset = 0;
  const arcs = segments.map((seg) => {
    const fraction = total > 0 ? seg.value / total : 0;
    const length = fraction * circumference;
    const arc = { ...seg, length, offset };
    offset += length;
    return arc;
  });

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-full max-w-sm">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3 text-center">
        Призы по уровням
      </p>
      <div className="flex justify-center">
        <svg viewBox="0 0 160 160" className="w-40 h-40">
          <circle cx="80" cy="80" r="70" fill="none" stroke="#1e293b" strokeWidth="18" />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke={arc.color}
              strokeWidth="18"
              strokeDasharray={`${arc.length} ${circumference}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="round"
              transform="rotate(-90 80 80)"
            />
          ))}
          <text x="80" y="76" textAnchor="middle" fontSize="24" fontWeight="500" fill="#f1f5f9">
            {total}
          </text>
          <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#64748b">
            выдано
          </text>
        </svg>
      </div>
      <div className="flex justify-center gap-4 mt-3">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-400 text-xs">{seg.label} · {seg.value}</span>
          </div>
            ))}
        </div>
    </div>
  );
};

export const PrizeDonut = React.memo(PrizeDonutComponent);

export default PrizeDonut;