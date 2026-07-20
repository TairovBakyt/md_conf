import React from 'react';

interface ScheduleItem {
  time: string;
  title: string;
}

// Замени на реальное расписание конференции
const SCHEDULE: ScheduleItem[] = [
  { time: '09:00', title: 'Регистрация и завтрак' },
  { time: '10:00', title: 'Открытие конференции' },
  { time: '11:00', title: 'Доклады: трек 1' },
  { time: '13:00', title: 'Обед' },
  { time: '14:00', title: 'Доклады: трек 2' },
  { time: '16:00', title: 'Квест: викторина и филворд' },
  { time: '18:00', title: 'Награждение и afterparty' },
];

export const ScheduleWidget: React.FC = () => {
  return (
    <div className="pixel-panel p-4">
      <p className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-3">
        Программа конференции
      </p>
      <div className="flex flex-col gap-2.5">
        {SCHEDULE.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-mc-gold text-[10px] shrink-0 mt-0.5">{item.time}</span>
            <span className="text-mc-cream/80 text-[10px]">{item.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleWidget;