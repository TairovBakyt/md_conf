import React, { useEffect, useState } from 'react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

interface GameSettings {
  quiz_unlocked: boolean;
  filword_unlocked: boolean;
}

export const GamesView: React.FC = () => {
  const { user } = useUser();
  const [gameSettings, setGameSettings] = useState<GameSettings>({ quiz_unlocked: false, filword_unlocked: false });
  const [loading, setLoading] = useState(false);

  const fetchGameSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const data = await res.json();
      if (res.ok) {
        setGameSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameSettings();
  }, []);

  const toggleGame = async (game: 'quiz' | 'filword', unlocked: boolean) => {
    if (!user) return;

    setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: unlocked }));

    try {
      const res = await fetch(`${API_URL}/api/admin/toggle-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, game, unlocked }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error(data.error);
        setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: !unlocked }));
      }
    } catch (err) {
      console.error(err);
      setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: !unlocked }));
    }
  };

  return (
    <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">Доступ к играм</span>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-6">Загружаем...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-100 text-sm font-medium">Викторина «Hardcore QA»</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {gameSettings.quiz_unlocked ? 'Открыта для всех участников' : 'Закрыта'}
              </p>
            </div>
            <button
              onClick={() => toggleGame('quiz', !gameSettings.quiz_unlocked)}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                gameSettings.quiz_unlocked ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  gameSettings.quiz_unlocked ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-slate-100 text-sm font-medium">Филворд «Word Researcher»</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {gameSettings.filword_unlocked ? 'Открыт для всех участников' : 'Закрыт'}
              </p>
            </div>
            <button
              onClick={() => toggleGame('filword', !gameSettings.filword_unlocked)}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                gameSettings.filword_unlocked ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  gameSettings.filword_unlocked ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamesView;