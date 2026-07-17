import React from 'react';

interface Speaker {
  name: string;
  role: string;
  topic: string;
}

// Замени на реальный список спикеров
const SPEAKERS: Speaker[] = [
  { name: 'Имя Фамилия', role: 'Должность, Компания', topic: 'Тема доклада' },
  { name: 'Имя Фамилия', role: 'Должность, Компания', topic: 'Тема доклада' },
  { name: 'Имя Фамилия', role: 'Должность, Компания', topic: 'Тема доклада' },
];

export const SpeakersList: React.FC = () => {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Спикеры
      </p>
      <div className="flex flex-col gap-3">
        {SPEAKERS.map((speaker, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-medium text-white shrink-0">
              {speaker.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-slate-100 text-sm font-medium">{speaker.name}</p>
              <p className="text-slate-500 text-xs">{speaker.role}</p>
              <p className="text-slate-400 text-xs mt-0.5">{speaker.topic}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpeakersList;