import React from 'react';

interface BalanceZoneProps {
  username: string;
  totalScore: number;
  userId: string;
}

export const BalanceZone: React.FC<BalanceZoneProps> = ({ username, totalScore, userId }) => {
  return (
    <div className="pixel-panel w-full max-w-md mx-auto p-6 text-center">
      <h2 className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider">
        Личный кабинет участника
      </h2>
      <h1 className="text-mc-cream text-lg font-bold mt-2 pixel-title">
        Привет, <span className="text-mc-gold">{username}</span>! 👋
      </h1>

      {/* ID участника — крупно и заметно */}
      <div className="mt-4 inline-flex flex-col items-center gap-1">
        <div className="pixel-badge inline-flex items-center gap-2 bg-gradient-to-r from-mc-emerald-dark to-mc-emerald px-4 py-2">
          <span className="text-white/70 text-[9px] font-medium uppercase tracking-wider">ID</span>
          <span className="text-white text-base font-black tracking-widest">{userId}</span>
        </div>
        <p className="text-mc-cream/50 text-[9px] mt-2 max-w-[240px] leading-relaxed">
          Ваш личный номер — назовите его администратору на стойке призов или для восстановления доступа
        </p>
      </div>

      {/* Большой круг с баллами */}
      <div className="mt-6 inline-flex flex-col items-center justify-center w-32 h-32 rounded-full border-4 border-mc-gold bg-mc-panel-light shadow-[0_0_15px_rgba(255,213,79,0.35)]">
        <span className="text-mc-gold text-3xl font-extrabold pixel-title">{totalScore}</span>
        <span className="text-mc-cream/60 text-[9px] font-semibold mt-1">БАЛЛОВ</span>
      </div>
    </div>
  );
};
