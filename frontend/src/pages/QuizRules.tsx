import React from 'react';
import { useNavigate } from 'react-router-dom';

export const QuizRules: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🧠</span>
          <h1 className="text-slate-100 text-lg font-semibold">
            Викторина «Hardcore QA»
          </h1>
        </div>

        <ul className="text-slate-300 text-sm leading-relaxed space-y-3 mb-6">
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">•</span>
            20 вопросов на знание тестирования. На каждый — 20 секунд.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400 shrink-0">•</span>
            Если ответишь неправильно, увидишь правильный вариант и пойдёшь
            дальше — вернуться назад нельзя.
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            Пройдёшь все 20 без единой ошибки — получишь бонус +5 баллов и
            достижение «Senior Developer».
          </li>
          <li className="flex gap-2">
            <span className="text-slate-500 shrink-0">•</span>
            Викторину можно пройти только один раз.
          </li>
        </ul>

        <button
          onClick={() => navigate('/quiz')}
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

export default QuizRules;