import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../authorization/UserContext';
import { ActivityFeed } from '../components/admin/ActivityFeed';
import { ScanView } from '../components/admin/ScanView';
import { RedemptionsView } from '../components/admin/RedemptionsView';
import { AchievementsView } from '../components/admin/AchievementsView';
import { GamesView } from '../components/admin/GamesView';
import { AdminsView } from '../components/admin/AdminsView';
import { DocsView } from '../components/admin/DocsView';
import { StatsPanel } from '../components/admin/StatsPanel';
import { PrizeDonut } from '../components/admin/PrizeDonut';

type AdminTab = 'scan' | 'redemptions' | 'achievements' | 'games' | 'admins' | 'docs';

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'scan', label: 'Сканирование', icon: '📷' },
  { id: 'redemptions', label: 'Выдача призов', icon: '🎁' },
  { id: 'achievements', label: 'Достижения', icon: '🏆' },
  { id: 'games', label: 'Игры', icon: '🎮' },
  { id: 'admins', label: 'Администраторы', icon: '👥' },
  { id: 'docs', label: 'Документация', icon: '📖' },
];

export const AdminPanel: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>('scan');

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

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl xl:max-w-[1400px] flex justify-between items-center mb-6"
      >
        <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          MDCONF ADMIN
        </span>
        <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
          Выйти
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-full max-w-2xl xl:max-w-[1400px] grid grid-cols-3 xl:grid-cols-6 gap-2 mb-5"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-1 text-xs font-medium rounded-xl py-3 transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              tab === t.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-[1.02]'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </motion.div>

      <div className="w-full max-w-2xl xl:max-w-[1400px] flex flex-col xl:flex-row gap-6 xl:items-start">
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
            >
              {tab === 'scan' && <ScanView />}
              {tab === 'redemptions' && <RedemptionsView />}
              {tab === 'achievements' && <AchievementsView />}
              {tab === 'games' && <GamesView />}
              {tab === 'admins' && <AdminsView />}
              {tab === 'docs' && <DocsView />}
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