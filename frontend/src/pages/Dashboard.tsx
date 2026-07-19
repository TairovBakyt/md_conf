import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BalanceZone } from '../components/BalanceZone';
import { QrZone } from '../components/QrZone';
import { StationsInfo } from '../components/StationsInfo';
import { LiveLeaderboard } from '../components/LiveLeaderboard';
import { StationProgress } from '../components/StationProgress';
import { useUser } from '../authorization/UserContext';
import type { User } from '../types';
import { ScheduleWidget } from '../components/ScheduleWidget';
import { API_URL } from '../config';
import { AverageComparison } from '../components/AverageComparison';
import { CompanyInfo } from '../components/CompanyInfo';
import { SpeakersList } from '../components/SpeakersList';
import { HelpBot } from '../components/HelpBot';

export const Dashboard: React.FC = () => {
  const { user, setUser, logout } = useUser();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<User | null>(null);
  const [gameSettings, setGameSettings] = useState({
    quiz_unlocked: false,
    filword_unlocked: false,
    quiz_mode: 'individual' as 'individual' | 'synced',
    filword_mode: 'individual' as 'individual' | 'synced',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // isInitial=true — единственный случай, когда сбой запроса имеет право
  // заменить весь экран на полноэкранную ошибку (профиля ещё нет, показать
  // нечего). Фоновый поллинг (isInitial=false) при сбое просто оставляет
  // текущий profile как есть и тихо повторит попытку на следующем тике —
  // иначе один прерванный запрос (например, пока вкладка была в фоне из-за
  // открытой камеры) сносил бы уже отрисованный дашборд с открытым чатом.
  const fetchProfile = async (isInitial = false) => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/api/user/${user.id}`);
      const data = await response.json();

      if (!response.ok) {
  // НОВОЕ: Если сервер ответил, что профиль не найден (участник удален),
  // принудительно разлогиниваем его и отправляем на страницу авторизации
  if (response.status === 404 || data.error === 'Участник не найден') {
    logout();
    navigate('/auth');
    return;
  }

  if (isInitial) {
    setError(data.error || 'Не удалось загрузить профиль');
    setLoading(false);
  }
  return;
}

      // Если админ сбросил PIN — session_version на сервере увеличился.
      // Значит эта сессия больше не актуальна, разлогиниваем принудительно.
      if (
        typeof user.session_version === 'number' &&
        typeof data.session_version === 'number' &&
        data.session_version !== user.session_version
      ) {
        logout();
        navigate('/auth');
        return;
      }

      // Если участнику только что выдали права администратора (пока он сидит
      // на дашборде) — сразу обновляем локального user и переносим на /admin,
      // без нужды вручную перезагружать страницу или перелогиниваться.
      if (data.is_admin && !user.is_admin) {
        setUser({ ...user, is_admin: true, admin_permissions: data.admin_permissions ?? null });
        navigate('/admin');
        return;
      }

      setProfile(data);
      setError('');

      const settingsRes = await fetch(`${API_URL}/api/settings`);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setGameSettings(settingsData);

        // Автоматически затягиваем участника на /quiz или /filword только
        // если админ выбрал синхронизированный режим — в индивидуальном
        // режиме редиректа нет, вход строго по клику.
        if (settingsData.quiz_unlocked && settingsData.quiz_mode === 'synced' && !data.is_quiz_passed) {
          navigate('/quiz');
          return;
        }
        if (settingsData.filword_unlocked && settingsData.filword_mode === 'synced' && !data.is_filword_passed) {
          navigate('/filword');
          return;
        }
      }
    } catch (err) {
      console.error(err);
      if (isInitial) {
        setError('Сервер недоступен');
      }
      // Фоновый сбой — не трогаем error/profile, следующий тик поллинга
      // повторит попытку сам, как только сеть/вкладка восстановятся.
    } finally {
      if (isInitial) setLoading(false);
    }
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

    fetchProfile(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  // Держим баланс, достижения, статус станций и доступность игр в
  // актуальном состоянии без обновления страницы — без принудительного
  // редиректа, вход в игру только по клику.
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchProfile(false);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleStartQuiz = () => navigate('/quiz');
  const handleStartFilword = () => navigate('/filword');

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
    <div
  className="min-h-screen bg-slate-900 px-4 py-8 flex flex-col items-center font-sans relative overflow-hidden"
  style={{
    backgroundImage:
      'radial-gradient(circle at 15% 15%, rgba(99,102,241,0.10), transparent 35%), radial-gradient(circle at 85% 80%, rgba(56,189,248,0.08), transparent 35%), radial-gradient(circle, rgba(148,163,184,0.06) 1px, transparent 1px)',
    backgroundSize: 'auto, auto, 28px 28px',
  }}
>
      <div className="w-full max-w-md xl:max-w-6xl flex justify-between items-center mb-6">
        <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          MDCONF 2026
        </span>
        <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
          Выйти
        </button>
      </div>

      <div className="w-full max-w-md xl:max-w-6xl flex flex-col xl:flex-row gap-6 xl:items-start">
        <div className="flex xl:hidden flex-col gap-4 w-full">
          <LiveLeaderboard />
        </div>

        <div className="hidden xl:flex flex-col gap-6 w-[280px] shrink-0">
        <LiveLeaderboard />
        <ScheduleWidget />
      </div>

        <div className="flex-1 flex flex-col items-center min-w-0">
  <div className="w-full max-w-md">
    <div className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 rounded-2xl p-4 mb-4 text-center">
      <p className="text-white text-sm font-medium leading-relaxed">
        🎁 Сегодня вы можете получить призы за прохождение игровых станций. Чем больше баллов наберёте — тем лучше подарок сможете получить.
      </p>
    </div>

    <BalanceZone username={profile.username} totalScore={profile.total_score} userId={profile.id} />
            

            <div className="w-full mt-3 grid grid-cols-2 gap-2">
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
              className="w-full mt-3 block text-center bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-2xl py-3 transition-colors"
            >
              🎁 Магазин призов
            </Link>

            <Link
              to="/about"
              className="w-full mt-3 block text-center bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-medium rounded-2xl py-3 transition-colors flex items-center justify-center gap-2"
            >
              ℹ️ О мероприятии
            </Link>

            {/* ВИКТОРИНА */}
            {profile.is_quiz_passed ? (
              <div className="w-full mt-3 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 text-emerald-400 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Викторина «Hardcore QA» пройдена
              </div>
            ) : gameSettings.quiz_unlocked && gameSettings.quiz_mode === 'synced' ? (
              <div className="w-full mt-3 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center justify-center gap-2 text-indigo-300 text-sm">
                ⏳ Викторина сейчас начнётся у всех одновременно — держите приложение открытым
              </div>
            ) : gameSettings.quiz_unlocked ? (
              <button
                onClick={handleStartQuiz}
                className="w-full mt-3 block text-center bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-2xl py-3 transition-colors"
              >
                🧠 Викторина «Hardcore QA»
              </button>
            ) : (
              <div className="w-full mt-3 p-4 bg-slate-800/40 border border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 text-sm">
                🔒 Викторина «Hardcore QA» — скоро откроется
              </div>
            )}

            {/* ФИЛВОРД */}
            {profile.is_filword_passed ? (
              <div className="w-full mt-3 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 text-emerald-400 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Филворд «Word Researcher» пройден
              </div>
            ) : gameSettings.filword_unlocked && gameSettings.filword_mode === 'synced' ? (
              <div className="w-full mt-3 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center justify-center gap-2 text-indigo-300 text-sm">
                ⏳ Филворд сейчас начнётся у всех одновременно — держите приложение открытым
              </div>
            ) : gameSettings.filword_unlocked ? (
              <button
                onClick={handleStartFilword}
                className="w-full mt-3 block text-center bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-2xl py-3 transition-colors"
              >
                🔤 Филворд «Word Researcher»
              </button>
            ) : (
              <div className="w-full mt-3 p-4 bg-slate-800/40 border border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-500 text-sm">
                🔒 Филворд «Word Researcher» — скоро откроется
              </div>
            )}

            {profile.achievements && profile.achievements.length > 0 && (
              <div className="w-full mt-6">
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
            <CompanyInfo />
            <SpeakersList />
            <HelpBot />
          </div>
        </div>

        <div className="flex xl:hidden flex-col gap-4 w-full">
          <ScheduleWidget />
          <StationProgress userId={profile.id} isQuizPassed={profile.is_quiz_passed} />
          <AverageComparison myScore={profile.total_score} />
        </div>

        <div className="hidden xl:flex flex-col gap-6 w-[280px] shrink-0">
  <StationProgress userId={profile.id} isQuizPassed={profile.is_quiz_passed} />
  <AverageComparison myScore={profile.total_score} />
</div>
      </div>
    </div>
  );
};

export default Dashboard;