import React from 'react';

interface Station {
  number: number;
  title: string;
  description: string;
  points: string;
}

const STATIONS: Station[] = [
  {
    number: 1,
    title: 'Подписка на соцсети',
    description: 'Подпишись на Instagram и LinkedIn MDigital, покажи администратору.',
    points: '5 + 5 баллов · до 10',
  },
  {
    number: 2,
    title: 'IT Quiz',
    description: 'Индивидуальная викторина — запускаешь сам, когда удобно. Вопросы, варианты ответов, таймер.',
    points: '1 балл за ответ · до 20 + бонус 5',
  },
  {
    number: 3,
    title: 'Stories',
    description: 'Опубликуй Stories с отметкой MDigital, покажи администратору.',
    points: '15 баллов',
  },
  {
    number: 4,
    title: 'Word Search',
    description: 'Найди слова в сетке 15×15 — проходишь самостоятельно, в любое время.',
    points: '2 балла за слово · до 20',
  },
  {
    number: 5,
    title: 'Поиск объектов',
    description: 'Найди и сфотографируй спрятанные по площадке объекты. Все объекты разные.',
    points: 'Баллы по количеству найденного',
  },
  {
    number: 6,
    title: 'Игра Азамата',
    description: 'Мини-игра с администратором рядом. Пройди — администратор подтвердит.',
    points: 'Начисляет администратор',
  },
];

export const StationsInfo: React.FC = () => {
  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <h2 className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-2">
        Станции квеста
      </h2>
      <div className="flex flex-col gap-2">
        {STATIONS.map((station) => (
          <div
            key={station.number}
            className="pixel-tile p-3 flex items-start gap-3"
          >
            <div className="pixel-avatar w-7 h-7 bg-mc-emerald flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-0.5">
              {station.number}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-mc-cream text-xs font-medium">{station.title}</p>
              <p className="text-mc-cream/50 text-[10px] mt-0.5 leading-relaxed">{station.description}</p>
              <p className="text-mc-gold text-[10px] font-medium mt-1">{station.points}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StationsInfo;