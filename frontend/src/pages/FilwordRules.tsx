import React from 'react';
import { useNavigate } from 'react-router-dom';

export const FilwordRules: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔤</span>
          <h1 className="text-slate-100 text-lg font-semibold">
            Филворд «Word Researcher»
          </h1>
        </div>

        <ul className="text-slate-300 text-sm leading-relaxed space-y-3 mb-6">
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">•</span>
            Сетка 15×15 — найди в ней 10 спрятанных ИТ-терминов.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">•</span>
            Выделяй слово пальцем (или мышкой) — по горизонтали, вертикали
            или диагонали.
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            За каждое найденное слово начисляются баллы сразу.
          </li>
          <li className="flex gap-2">
            <span className="text-slate-500 shrink-0">•</span>
            Пройти филворд можно только один раз.
          </li>
        </ul>

        <button
          onClick={() => navigate('/filword')}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-2xl py-3 transition-colors"
        >
          Начать
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full mt-2 text-slate-500 hover:text-slate-300 text-xs transition-colors py-2"
        >
          Вернуться в профиль
        </button>
      </div>
    </div>
  );
};

export default FilwordRules;