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
import { IconGift, IconCamera, IconInfo, IconQuiz, IconWord, IconLock, IconHourglass, IconTrophy, IconCheck } from '../components/icons';

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
      <div className="min-h-screen flex items-center justify-center">
        <span className="pixel-panel px-4 py-3 text-mc-cream text-xs">Загружаем профиль...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <span className="pixel-panel px-4 py-3 text-mc-redstone text-xs text-center">{error || 'Профиль не найден'}</span>
        <button onClick={handleLogout} className="text-mc-cream/70 hover:text-mc-gold underline text-xs">
          Выйти и войти заново
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center relative overflow-hidden">
      <div className="w-full max-w-md xl:max-w-6xl flex justify-between items-center mb-6">
        <span className="pixel-title text-base sm:text-xl font-black tracking-widest text-mc-gold">
          MDCONF 2026
        </span>
        <button onClick={handleLogout} className="text-mc-cream/60 hover:text-mc-gold text-[10px] transition-colors">
          Выйти
        </button>
      </div>

      <div className="w-full max-w-md xl:max-w-6xl flex flex-col xl:flex-row gap-6 xl:items-start">
        {/*
          Мобильный блок "Топ участников" отсюда убран — на телефоне он
          теперь рендерится ниже, сразу после кнопки "Филворд" (см. внутри
          средней колонки). Десктопная левая колонка (ниже) не менялась —
          там LiveLeaderboard остаётся в прежнем месте, наверху.
        */}

        <div className="hidden xl:flex flex-col gap-6 w-[280px] shrink-0">
        <LiveLeaderboard />
        <ScheduleWidget />
      </div>

        <div className="flex-1 flex flex-col items-center min-w-0">
  <div className="w-full max-w-md">
    <div className="pixel-panel bg-gradient-to-r from-mc-lapis to-mc-purple p-4 mb-4 text-center">
      <p className="text-mc-cream text-xs leading-relaxed flex items-start gap-2">
        <IconGift className="w-5 h-5 shrink-0" />
        <span>Сегодня вы можете получить призы за прохождение игровых станций. Чем больше баллов наберёте — тем лучше подарок сможете получить.</span>
      </p>
    </div>

    <BalanceZone username={profile.username} totalScore={profile.total_score} userId={profile.id} />
            

            <div className="w-full mt-3 grid grid-cols-2 gap-2">
              <QrZone userId={profile.id} />
              <Link
                to="/scan-admin"
                className="pixel-btn w-full bg-mc-wood text-mc-cream font-medium py-3 flex items-center justify-center gap-2"
              >
                <IconCamera className="w-5 h-5 shrink-0" /> Сканировать
              </Link>
            </div>

            <Link
              to="/prizes"
              className="pixel-btn w-full mt-3 flex items-center justify-center gap-2 text-center bg-mc-wood text-mc-cream font-medium py-3"
            >
              <IconGift className="w-5 h-5 shrink-0" /> Магазин призов
            </Link>

            <Link
              to="/about"
              className="pixel-btn w-full mt-3 block text-center bg-mc-panel-light text-mc-cream/80 font-medium py-3 flex items-center justify-center gap-2"
            >
              <IconInfo className="w-5 h-5 shrink-0" /> О мероприятии
            </Link>

            {/* ВИКТОРИНА */}
            {profile.is_quiz_passed ? (
              <div className="pixel-panel w-full mt-3 p-4 border-mc-emerald-dark flex items-center justify-center gap-3 text-mc-emerald font-semibold text-xs">
                <IconCheck className="h-5 w-5 shrink-0" />
                Викторина «Hardcore QA» пройдена
              </div>
            ) : gameSettings.quiz_unlocked && gameSettings.quiz_mode === 'synced' ? (
              <div className="pixel-panel w-full mt-3 p-4 flex items-center justify-center gap-2 text-xs" style={{ color: '#8fb3ff' }}>
                <IconHourglass className="h-5 w-5 shrink-0" />
                Викторина сейчас начнётся у всех одновременно — держите приложение открытым
              </div>
            ) : gameSettings.quiz_unlocked ? (
              <button
                onClick={handleStartQuiz}
                className="pixel-btn w-full mt-3 flex items-center justify-center gap-2 text-center bg-mc-emerald text-white font-medium py-3"
              >
                <IconQuiz className="h-5 w-5 shrink-0" /> Викторина «Hardcore QA»
              </button>
            ) : (
              <div className="pixel-panel w-full mt-3 p-4 flex items-center justify-center gap-2 text-mc-cream/50 text-xs">
                <IconLock className="h-5 w-5 shrink-0" /> Викторина «Hardcore QA» — скоро откроется
              </div>
            )}

            {/* ФИЛВОРД */}
            {profile.is_filword_passed ? (
              <div className="pixel-panel w-full mt-3 p-4 border-mc-emerald-dark flex items-center justify-center gap-3 text-mc-emerald font-semibold text-xs">
                <IconCheck className="h-5 w-5 shrink-0" />
                Филворд «Word Researcher» пройден
              </div>
            ) : gameSettings.filword_unlocked && gameSettings.filword_mode === 'synced' ? (
              <div className="pixel-panel w-full mt-3 p-4 flex items-center justify-center gap-2 text-xs" style={{ color: '#8fb3ff' }}>
                <IconHourglass className="h-5 w-5 shrink-0" />
                Филворд сейчас начнётся у всех одновременно — держите приложение открытым
              </div>
            ) : gameSettings.filword_unlocked ? (
              <button
                onClick={handleStartFilword}
                className="pixel-btn w-full mt-3 flex items-center justify-center gap-2 text-center bg-mc-emerald text-white font-medium py-3"
              >
                <IconWord className="h-5 w-5 shrink-0" /> Филворд «Word Researcher»
              </button>
            ) : (
              <div className="pixel-panel w-full mt-3 p-4 flex items-center justify-center gap-2 text-mc-cream/50 text-xs">
                <IconLock className="h-5 w-5 shrink-0" /> Филворд «Word Researcher» — скоро откроется
              </div>
            )}

            {/* Топ участников — только на телефоне, сразу после кнопки Филворд.
                На десктопе этот блок не дублируется: там LiveLeaderboard уже
                стоит в левой боковой колонке. */}
            <div className="xl:hidden w-full mt-3">
              <LiveLeaderboard />
            </div>

            {profile.achievements && profile.achievements.length > 0 && (
              <div className="w-full mt-6">
                <h2 className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-2">
                  Мои достижения
                </h2>
                <div className="flex flex-col gap-2">
                  {profile.achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className="pixel-tile p-3 flex items-center gap-3"
                    >
                      <IconTrophy className="w-6 h-6 shrink-0 text-mc-gold" />
                      <div className="min-w-0">
                        <p className="text-mc-cream text-xs font-medium truncate">{achievement.title}</p>
                        <p className="text-mc-gold text-[10px]">+{achievement.points} баллов</p>
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