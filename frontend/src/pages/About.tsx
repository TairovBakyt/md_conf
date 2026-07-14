import React from 'react';
import { useNavigate } from 'react-router-dom';

export const About: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-10 flex flex-col items-center">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            MDCONF 2026
          </span>
        </div>

        <div className="bg-slate-950 rounded-2xl p-6 space-y-5">
          <div>
            <h1 className="text-slate-100 text-lg font-semibold mb-2">О конференции</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              MDCONF — ежегодная техническая конференция для разработчиков, где участники не только слушают доклады, но и проходят интерактивный квест: викторину, поиск слов и станции с заданиями, зарабатывая баллы на «паспорт» участника.
            </p>
          </div>

          <div>
            <h2 className="text-slate-100 text-sm font-semibold mb-2">Как это работает</h2>
            <ul className="text-slate-400 text-sm leading-relaxed space-y-1.5 list-disc list-inside">
              <li>Зарегистрируйся и получи персональный QR-код</li>
              <li>Проходи станции, викторину и филворд — получай баллы</li>
              <li>Трать баллы в магазине призов в течение дня</li>
            </ul>
          </div>

          <div>
            <h2 className="text-slate-100 text-sm font-semibold mb-2">Организатор</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              [сюда впишешь реальную информацию об организаторе — компания, контакты, соцсети]
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="block w-full text-center mt-6 text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Назад
        </button>
      </div>
    </div>
  );
};

export default About;