import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../authorization/UserContext';
import { ActivityFeed } from '../components/admin/ActivityFeed';
import { ScanView } from '../components/admin/ScanView';
import { RedemptionsView } from '../components/admin/RedemptionsView';
import { PrizeBoothView } from '../components/admin/PrizeBoothView';
import { AchievementsView } from '../components/admin/AchievementsView';
import { GamesView } from '../components/admin/GamesView';
import { AdminsView } from '../components/admin/AdminsView';
import { DocsView } from '../components/admin/DocsView';
import { StatsPanel } from '../components/admin/StatsPanel';
import { PrizeDonut } from '../components/admin/PrizeDonut';
import { ChatInbox } from '../components/admin/ChatInbox';
import { AdminChatView } from '../components/admin/AdminChatView';
import { AdminRecoveryView } from '../components/admin/AdminRecoveryView';
import { API_URL } from '../config';

type AdminTab =
  | 'scan'
  | 'prizeBooth'
  | 'redemptions'
  | 'achievements'
  | 'games'
  | 'admins'
  | 'docs'
  | 'chat'
  | 'adminChat'
  | 'recovery';

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'scan', label: 'Сканирование', icon: '📷' },
  { id: 'prizeBooth', label: 'Стойка призов', icon: '🎟️' },
  { id: 'redemptions', label: 'История выдач', icon: '🎁' },
  { id: 'achievements', label: 'Достижения', icon: '🏆' },
  { id: 'games', label: 'Игры', icon: '🎮' },
  { id: 'admins', label: 'Администраторы', icon: '👥' },
  { id: 'docs', label: 'Документация', icon: '📖' },
  { id: 'chat', label: 'Сообщения', icon: '💬' },
  { id: 'adminChat', label: 'Чат админов', icon: '🗨️' },
  { id: 'recovery', label: 'Восстановление доступа', icon: '🔑' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export const AdminPanel: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>('scan');
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

  // Тихий фоновый поллинг непрочитанных — считает сумму unreadCount
  // по обоим чатам и показывает цифрой на кнопках вкладок.
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCounts = async () => {
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

    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const unreadForTab = (tabId: AdminTab): number => {
    if (tabId === 'chat') return chatUnread;
    if (tabId === 'adminChat') return adminChatUnread;
    return 0;
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
        {TABS.map((t) => {
          const unread = unreadForTab(t.id);
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex flex-col items-center gap-1 text-xs font-medium rounded-xl py-3 transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </motion.div>

      <div className="w-full max-w-md xl:max-w-6xl flex flex-col xl:flex-row gap-6 xl:items-start">
        <div className="flex xl:hidden flex-col gap-4 w-full">
          <StatsPanel />
        </div>

        <div className="hidden xl:flex flex-col gap-6 w-[300px] shrink-0">
          <StatsPanel />
        </div>

        <div className="flex-1 flex flex-col items-center gap-6 min-w-0">
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

          <PrizeDonut />
        </div>

        <div className="flex xl:hidden flex-col gap-4 w-full">
          <ActivityFeed />
        </div>

        <div className="hidden xl:flex flex-col gap-6 w-[300px] shrink-0">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;


