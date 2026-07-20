import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartPolling } from '../hooks/useSmartPolling';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../authorization/UserContext';
import { StatsPanel } from '../components/admin/StatsPanel';
import { PrizeDonut } from '../components/admin/PrizeDonut';
import { API_URL } from '../config';
import { ADMIN_TAB_DEFS, isTabAllowed, getAccessLabel, type AdminTabId } from '../adminTabs';

// Ленивая загрузка вкладок — админ скачивает код только той вкладки,
// которую реально открыл, а не все 10 сразу (ScanView, ChatInbox,
// AdminChatView и т.д. — самые тяжёлые из-за html5-qrcode/framer-motion).
const ActivityFeed = lazy(() => import('../components/admin/ActivityFeed').then((m) => ({ default: m.ActivityFeed })));
const ScanView = lazy(() => import('../components/admin/ScanView').then((m) => ({ default: m.ScanView })));
const RedemptionsView = lazy(() => import('../components/admin/RedemptionsView').then((m) => ({ default: m.RedemptionsView })));
const PrizeBoothView = lazy(() => import('../components/admin/PrizeBoothView').then((m) => ({ default: m.PrizeBoothView })));
const AchievementsView = lazy(() => import('../components/admin/AchievementsView').then((m) => ({ default: m.AchievementsView })));
const GamesView = lazy(() => import('../components/admin/GamesView').then((m) => ({ default: m.GamesView })));
const AdminsView = lazy(() => import('../components/admin/AdminsView').then((m) => ({ default: m.AdminsView })));
const DocsView = lazy(() => import('../components/admin/DocsView').then((m) => ({ default: m.DocsView })));
const ChatInbox = lazy(() => import('../components/admin/ChatInbox').then((m) => ({ default: m.ChatInbox })));
const AdminChatView = lazy(() => import('../components/admin/AdminChatView').then((m) => ({ default: m.AdminChatView })));
const AdminRecoveryView = lazy(() => import('../components/admin/AdminRecoveryView').then((m) => ({ default: m.AdminRecoveryView })));

const TAB_STORAGE_KEY = 'admin_active_tab';

function loadPersistedTab(): AdminTabId | null {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw && ADMIN_TAB_DEFS.some((t) => t.id === raw)) return raw as AdminTabId;
  } catch {
    // sessionStorage может быть недоступен (приватный режим и т.п.) — не критично
  }
  return null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function permissionsEqual(a: AdminTabId[] | null | undefined, b: AdminTabId[] | null | undefined): boolean {
  const normA = a ?? null;
  const normB = b ?? null;
  if (normA === null && normB === null) return true;
  if (normA === null || normB === null) return false;
  if (normA.length !== normB.length) return false;
  const setB = new Set(normB);
  return normA.every((id) => setB.has(id));
}

// Небольшой инлайн-лоадер, показывается только на время подгрузки кода
// самой вкладки (обычно доли секунды на нормальной сети) — не путать с
// загрузкой данных внутри самих вкладок, у них свои спиннеры.
function TabLoader() {
  return (
    <div className="w-full flex items-center justify-center py-12">
      <span className="text-slate-500 text-sm">Загружаем вкладку...</span>
    </div>
  );
}

export const AdminPanel: React.FC = () => {
  const { user, setUser, logout } = useUser();
  const navigate = useNavigate();

  const permissions = user?.admin_permissions ?? null;

  const [tab, setTab] = useState<AdminTabId>(() => {
    const persisted = loadPersistedTab();
    if (persisted && isTabAllowed(permissions, persisted)) return persisted;
    const firstAllowed = ADMIN_TAB_DEFS.find((t) => isTabAllowed(permissions, t.id));
    return firstAllowed?.id ?? 'scan';
  });
  const [chatUnread, setChatUnread] = useState(0);
  const [adminChatUnread, setAdminChatUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!user.is_admin) {
      navigate('/dashboard');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // не критично, просто не сохранится между обновлениями
    }
  }, [tab]);

  // Тихий фоновый поллинг собственного статуса — ловит три случая
  // изменения прав "вживую", пока админ сидит в панели, без ручной
  // перезагрузки: (1) права полностью забрали — выгоняем на /dashboard,
  // (2) полный доступ сузили до частичного или (3) наоборот расширили —
  // обновляем локальные permissions; если текущая открытая вкладка
  // перестала быть разрешена, переключаемся на первую доступную.
  const checkOwnStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/user/${user.id}`);
      const data = await res.json();
      if (!res.ok) return;

      if (!data.is_admin) {
        setUser({ ...user, is_admin: false, admin_permissions: null });
        navigate('/dashboard');
        return;
      }

      const newPermissions: AdminTabId[] | null = data.admin_permissions ?? null;
      if (!permissionsEqual(user.admin_permissions ?? null, newPermissions)) {
        setUser({ ...user, admin_permissions: newPermissions });
        if (!isTabAllowed(newPermissions, tab)) {
          const firstAllowed = ADMIN_TAB_DEFS.find((t) => isTabAllowed(newPermissions, t.id));
          setTab(firstAllowed?.id ?? 'scan');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useSmartPolling(checkOwnStatus, 5000, !!user);

  // Тихий фоновый поллинг непрочитанных — считает сумму unreadCount
  // по обоим чатам и показывает цифрой на кнопках вкладок.
  const fetchUnreadCounts = async () => {
    if (!user) return;
    try {
      const [chatRes, adminChatRes] = await Promise.all([
        fetch(`${API_URL}/api/chat/admin/inbox`),
        fetch(`${API_URL}/api/admin-chat/inbox/${user.id}`),
      ]);

      if (chatRes.ok) {
        const chatData: { unreadCount: number }[] = await chatRes.json();
        setChatUnread(chatData.reduce((sum, item) => sum + (item.unreadCount || 0), 0));
      }

      if (adminChatRes.ok) {
        const adminChatData: { unreadCount: number }[] = await adminChatRes.json();
        setAdminChatUnread(adminChatData.reduce((sum, item) => sum + (item.unreadCount || 0), 0));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUnreadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useSmartPolling(fetchUnreadCounts, 8000, !!user);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const unreadForTab = (tabId: AdminTabId): number => {
    if (tabId === 'chat') return chatUnread;
    if (tabId === 'adminChat') return adminChatUnread;
    return 0;
  };

  const handleTabClick = (tabId: AdminTabId) => {
    if (!isTabAllowed(permissions, tabId)) return;
    setTab(tabId);
  };

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md xl:max-w-6xl flex justify-between items-center mb-6 gap-3 flex-wrap"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            MDCONF ADMIN
          </span>
          {user && (
            <span className="text-base font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-fuchsia-400 flex items-center gap-1.5">
              {getGreeting()}, {user.username}! <span className="text-lg">👋</span>
            </span>
          )}
          {user && (
            <span
              className={`text-[10px] font-medium w-fit px-2 py-0.5 rounded-full ${
                user.is_main_admin
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30'
                  : permissions === null
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
              }`}
            >
              {user.is_main_admin ? '👑 Главный администратор' : getAccessLabel(permissions)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <div className="flex flex-col items-start gap-0.5">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-lg px-3 py-1.5 shadow-lg shadow-indigo-500/20 w-fit">
                <span className="text-white/70 text-[10px] font-medium uppercase tracking-wider">ID</span>
                <span className="text-white text-sm font-black font-mono tracking-widest">{user.id}</span>
              </div>
              <p className="text-slate-500 text-[10px]">
                Ваш ID администратора
              </p>
            </div>
          )}

          <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
            Выйти
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-full max-w-md xl:max-w-6xl grid grid-cols-3 xl:grid-cols-5 gap-2 mb-5"
      >
        {ADMIN_TAB_DEFS.map((t, i) => {
          const unread = unreadForTab(t.id);
          const locked = !isTabAllowed(permissions, t.id);
          // На телефоне (grid-cols-3) последняя вкладка при нечётном остатке
          // (10 вкладок ÷ 3 = 1 в остатке) виснет одна в своём ряду на треть
          // ширины — растягиваем её на всю строку только в этом случае.
          // На десктопе (xl:grid-cols-5, остаток 0) это правило не действует.
          const isDanglingLast = i === ADMIN_TAB_DEFS.length - 1 && ADMIN_TAB_DEFS.length % 3 === 1;
          return (
            <button
              key={t.id}
              onClick={() => handleTabClick(t.id)}
              disabled={locked}
              title={locked ? 'Нет доступа к этой вкладке' : undefined}
              className={`relative flex flex-col items-center gap-1 text-xs font-medium rounded-xl py-3 transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isDanglingLast ? 'col-span-3 xl:col-span-1' : ''
              } ${
                locked
                  ? 'bg-slate-900/60 text-slate-600 cursor-not-allowed opacity-50'
                  : tab === t.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {!locked && unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
              <span className="text-base">{locked ? '🔒' : t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </motion.div>

      <div className="w-full max-w-md xl:max-w-6xl flex flex-col xl:flex-row gap-6 xl:items-start">
        {/*
          Мобильный порядок задаётся через order-*, десктопная раскладка
          (xl:flex-row, три колонки: StatsPanel / контент+PrizeDonut / ActivityFeed)
          не трогается — там order-* сброшен через xl:order-none.
          Мобильный порядок (flex-col): контент вкладки → быстрая статистика →
          призы по уровням → лента активности.
        */}
        <div className="flex xl:hidden flex-col gap-4 w-full order-2">
          <StatsPanel />
        </div>

        <div className="hidden xl:flex flex-col gap-6 w-[300px] shrink-0">
          <StatsPanel />
        </div>

        <div className="flex-1 flex flex-col items-center gap-6 min-w-0 order-1 xl:order-none">
          <Suspense fallback={<TabLoader />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full"
              >
                {tab === 'scan' && <ScanView />}
                {tab === 'prizeBooth' && <PrizeBoothView />}
                {tab === 'redemptions' && <RedemptionsView />}
                {tab === 'achievements' && <AchievementsView />}
                {tab === 'games' && <GamesView />}
                {tab === 'admins' && <AdminsView />}
                {tab === 'docs' && <DocsView />}
                {tab === 'chat' && <ChatInbox />}
                {tab === 'adminChat' && <AdminChatView />}
                {tab === 'recovery' && <AdminRecoveryView />}
              </motion.div>
            </AnimatePresence>
          </Suspense>

          {/* Только десктоп — здесь PrizeDonut идёт сразу под контентом в средней колонке */}
          <div className="hidden xl:block w-full">
            <PrizeDonut />
          </div>
        </div>

        {/* Только мобильный — отдельный блок между StatsPanel и ActivityFeed */}
        <div className="flex xl:hidden flex-col gap-4 w-full order-3">
          <PrizeDonut />
        </div>

        <div className="flex xl:hidden flex-col gap-4 w-full order-4">
          <Suspense fallback={<TabLoader />}>
            <ActivityFeed />
          </Suspense>
        </div>

        <div className="hidden xl:flex flex-col gap-6 w-[300px] shrink-0">
          <Suspense fallback={<TabLoader />}>
            <ActivityFeed />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;