import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-4xl">🔍</span>
      <h1 className="text-slate-100 text-xl font-semibold">Страница не найдена</h1>
      <p className="text-slate-400 text-sm">Похоже, такой страницы не существует</p>
      <Link
        to="/dashboard"
        className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
      >
        На главную
      </Link>
    </div>
  );
};

export default NotFound;