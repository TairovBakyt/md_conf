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
    title: 'Hardcore QA',
    description: 'Викторина на 20 вопросов по ИТ-эрудиции. 20 секунд на ответ.',
    points: '1 балл за ответ · до 20 + бонус 5',
  },
  {
    number: 2,
    title: 'Word Researcher',
    description: 'Филворд 15×15 — найди 10 спрятанных ИТ-терминов за 1.5 минуты.',
    points: '2 балла за слово · до 20',
  },
  {
    number: 3,
    title: 'Digital Subscriptions',
    description: 'Подпишись на Instagram и LinkedIn компании.',
    points: '5 + 5 баллов · до 10',
  },
  {
    number: 4,
    title: 'Сториз-шеринг «Я на MDConf»',
    description: 'Выложи Stories с отметкой аккаунта компании и тегом #MDConf2026.',
    points: '15 баллов',
  },
  {
    number: 5,
    title: 'Keep Alive / Ping Game',
    description: 'Командный тимбилдинг — пройди задание вместе с командой.',
    points: '15 баллов · участие 5',
  },
];

export const StationsInfo: React.FC = () => {
  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
        Станции квеста
      </h2>
      <div className="flex flex-col gap-2">
        {STATIONS.map((station) => (
          <div
            key={station.number}
            className="bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-xl p-3 flex items-start gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold text-white shrink-0 mt-0.5">
              {station.number}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-100 text-sm font-medium">{station.title}</p>
              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{station.description}</p>
              <p className="text-amber-400 text-xs font-medium mt-1">{station.points}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StationsInfo;