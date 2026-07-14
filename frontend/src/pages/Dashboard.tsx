import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BalanceZone } from '../components/BalanceZone';
import { QrZone } from '../components/QrZone';
import { useUser } from '../authorization/UserContext';
import type { User } from '../types';
import { StationsInfo } from '../components/Stationinfo';
import { API_URL } from '../config';

export const Dashboard: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const profileRef = useRef<User | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const checkFilwordAndRedirect = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/filword/live-state/${userId}`);
      const data = await res.json();
      if (res.ok && (data.phase === 'waiting' || data.phase === 'playing')) {
        navigate('/filword');
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (user.is_admin) {
      navigate('/admin');
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
          if (settingsData.quiz_unlocked && !data.is_quiz_passed) {
            navigate('/quiz');
            return;
          }
          if (settingsData.filword_unlocked) {
            const redirected = await checkFilwordAndRedirect(user.id);
            if (redirected) return;
          }
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
          const currentProfile = profileRef.current;
          if (settingsData.quiz_unlocked && currentProfile && !currentProfile.is_quiz_passed) {
            navigate('/quiz');
            return;
          }
          if (settingsData.filword_unlocked) {
            await checkFilwordAndRedirect(user.id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, navigate]);

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
        <button onClick={handleLogout} className="text-slate-400 underline text-sm">
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
        <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
          Выйти
        </button>
      </div>

      <BalanceZone username={profile.username} totalScore={profile.total_score} />

<div className="w-full max-w-md mx-auto mt-3 grid grid-cols-2 gap-2">
  <QrZone userId={profile.id} />
  <Link
    to="/scan-admin"
    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-2xl py-3 transition-colors flex items-center justify-center"
  >
    📷 Сканировать
  </Link>
</div>

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

<StationsInfo />

    </div>
  );
};

export default Dashboard;