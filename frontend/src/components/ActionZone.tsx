
import React from 'react';

interface ActionZoneProps {
  isQuizPassed: boolean;
  onStartQuiz: () => void;
}

export const ActionZone: React.FC<ActionZoneProps> = ({ isQuizPassed, onStartQuiz }) => {
  return (
    <div className="w-full max-w-md mx-auto mt-6">
      {isQuizPassed ? (
        // Состояние: Доступ заблокирован (игра уже пройдена)
        <div className="w-full p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 text-emerald-400 font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Викторина «Hardcore QA» пройдена
        </div>
      ) : (
        // Состояние: Активно, можно играть
        <button
          onClick={onStartQuiz}
          className="w-full p-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-lg rounded-2xl transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 shadow-[0_4px_20px_rgba(99,102,241,0.4)]"
        >
          🎮 Запустить викторину «Hardcore QA»
        </button>
      )}
    </div>
  );
}