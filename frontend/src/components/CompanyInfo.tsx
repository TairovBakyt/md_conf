import React from 'react';

export const CompanyInfo: React.FC = () => {
  return (
    <div className="pixel-panel p-4">
      <p className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-3">
        О компании
      </p>
      <h3 className="text-mc-gold text-xs font-semibold mb-2">MDigital</h3>
      <p className="text-mc-cream/70 text-[10px] leading-relaxed">
        {/* Замени на реальный текст о компании */}
        MDigital — IT-компания из Бишкека, специализирующаяся на заказной разработке программного обеспечения и
        цифровой трансформации бизнеса. Мы создаём мобильные и веб-платформы для финтеха, e-commerce,
        HR Tech и других отраслей, помогая клиентам — от стартапов до крупных корпораций — воплощать
        технологичные решения и достигать своих целей.
      </p>
    </div>
  );
};

export default CompanyInfo;