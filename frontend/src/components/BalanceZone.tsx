import React from 'react';

interface BalanceZoneProps {
  username: string;
  totalScore: number;
}

export const BalanceZone: React.FC<BalanceZoneProps> = ({ username, totalScore }) => {
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-2xl text-center shadow-xl">
      <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider">
        Личный кабинет участника
      </h2>
      <h1 className="text-white text-2xl font-bold mt-1">
        Привет, <span className="text-indigo-400">{username}</span>! 👋
      </h1>
      
      {/* Большой круг с баллами */}
      <div className="mt-6 inline-flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-indigo-500 bg-slate-900 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
        <span className="text-white text-4xl font-extrabold">{totalScore}</span>
        <span className="text-slate-400 text-xs font-semibold mt-1">БАЛЛОВ</span>
      </div>
    </div>
  );
};