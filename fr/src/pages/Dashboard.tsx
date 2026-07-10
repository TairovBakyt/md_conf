import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BalanceZone } from '../components/BalanceZone';
import { ActionZone } from '../components/ActionZone';
import { QrZone } from '../components/QrZone';
import { useUser } from '../authorization/UserContext';
import type { User } from '../types';


import { API_URL } from '../config';

export const Dashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<User | null>(null);
  const [gameSettings, setGameSettings] = useState({ quiz_unlocked: false, filword_unlocked: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Если юзера нет в контексте (не залогинен) — сразу на форму входа
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/api/user/${user.id}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Не удалось загрузить профиль');
          setLoading(false);
          return;
        }

        setProfile(data);

        const settingsRes = await fetch(`${API_URL}/api/settings`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setGameSettings(settingsData);
        }

      } catch (err) {
        console.error(err);
        setError('Сервер недоступен');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const settingsRes = await fetch(`${API_URL}/api/settings`);
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setGameSettings(settingsData);
        }
      } catch (err) {
        console.error(err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  const handleStartQuiz = () => {
    navigate('/quiz');
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400">Загружаем профиль...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <span className="text-red-400">{error || 'Профиль не найден'}</span>
        <button
          onClick={handleLogout}
          className="text-slate-400 underline text-sm"
        >
          Выйти и войти заново
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8 flex flex-col justify-start items-center font-sans">
      <div className="w-full flex justify-between items-center max-w-md mx-auto mb-6">
        <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          MDCONF 2026
        </span>
        <button
          onClick={handleLogout}
          className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          Выйти
        </button>
      </div>

      <BalanceZone username={profile.username} totalScore={profile.total_score} />
      <QrZone userId={profile.id} />
      
      
      {/* ВИКТОРИНА */}
      {profile.is_quiz_passed ? (
        <ActionZone isQuizPassed={true} onStartQuiz={handleStartQuiz} />
      ) : gameSettings.quiz_unlocked ? (
        <ActionZone isQuizPassed={false} onStartQuiz={handleStartQuiz} />
      ) : (
        <div className="w-full max-w-md mx-auto mt-6 p-4 bg-slate-800/40 border border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 text-sm">
          🔒 Викторина «Hardcore QA» — скоро откроется
        </div>
      )}

      {profile.is_filword_passed ? (
  <div className="w-full max-w-md mx-auto mt-3 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 text-emerald-400 font-semibold">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
    Филворд «Word Researcher» пройден
  </div>
) : gameSettings.filword_unlocked ? (
  <Link
    to="/filword"
    className="w-full max-w-md mx-auto mt-3 block text-center bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-2xl py-3 transition-colors"
  >
    🔤 Филворд «Word Researcher»
  </Link>
  ) : (
        <div className="w-full max-w-md mx-auto mt-3 p-4 bg-slate-800/40 border border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 text-sm">
          🔒 Филворд «Word Researcher» — скоро откроется
        </div>
      )}

      <Link
        to="/prizes"
        className="w-full max-w-md mx-auto mt-3 block text-center bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-2xl py-3 transition-colors"
      >
        🎁 Магазин призов
      </Link>

      {profile.achievements && profile.achievements.length > 0 && (
        <div className="w-full max-w-md mx-auto mt-6">
          <h2 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            Мои достижения
          </h2>
          <div className="flex flex-col gap-2">
            {profile.achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-xl p-3 flex items-center gap-3"
              >
                <span className="text-xl shrink-0">🏆</span>
                <div className="min-w-0">
                  <p className="text-slate-100 text-sm font-medium truncate">{achievement.title}</p>
                  <p className="text-amber-400 text-xs">+{achievement.points} баллов</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;