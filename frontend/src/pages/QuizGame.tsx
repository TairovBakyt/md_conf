import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';
import { QuizGameIndividual } from './QuizGameIndividual';
import { QuizGameSynced } from './QuizGameSynced';

// Обёртка: спрашивает у сервера текущий режим викторины (индивидуальный
// или синхронизированный) и рендерит соответствующий компонент. Игровая
// логика самих режимов не меняется — только выбор между ними.
export const QuizGame: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'individual' | 'synced' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchMode = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        const data = await res.json();
        if (res.ok) {
          setMode(data.quiz_mode === 'synced' ? 'synced' : 'individual');
        } else {
          setError('Не удалось загрузить настройки викторины');
        }
      } catch (err) {
        console.error(err);
        setError('Сервер недоступен');
      }
    };

    fetchMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-red-400 text-center">{error}</span>
        <button onClick={() => navigate('/dashboard')} className="text-slate-400 underline text-sm">
          Вернуться в профиль
        </button>
      </div>
    );
  }

  if (mode === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Загружаем викторину...</span>
      </div>
    );
  }

  return mode === 'synced' ? <QuizGameSynced /> : <QuizGameIndividual />;
};

export default QuizGame;