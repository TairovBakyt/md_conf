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
    <div className="pixel-panel p-4">
      <p className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-3">
        Спикеры
      </p>
      <div className="flex flex-col gap-3">
        {SPEAKERS.map((speaker, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="pixel-avatar w-9 h-9 bg-mc-lapis flex items-center justify-center text-[10px] font-medium text-white shrink-0">
              {speaker.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-mc-cream text-xs font-medium">{speaker.name}</p>
              <p className="text-mc-cream/50 text-[10px]">{speaker.role}</p>
              <p className="text-mc-cream/70 text-[10px] mt-0.5">{speaker.topic}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpeakersList;