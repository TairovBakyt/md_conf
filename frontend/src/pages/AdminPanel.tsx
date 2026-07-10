
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../authorization/UserContext';

import { ScanView } from '../components/admin/ScanView';
import { RedemptionsView } from '../components/admin/RedemptionsView';
import { AchievementsView } from '../components/admin/AchievementsView';
import { GamesView } from '../components/admin/GamesView';
import { AdminsView } from '../components/admin/AdminsView';

type AdminTab = 'scan' | 'redemptions' | 'achievements' | 'games' | 'admins';

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
      <div className="w-full max-w-sm flex justify-between items-center mb-6">
        <span className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          MDCONF ADMIN
        </span>
        <button onClick={handleLogout} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
          Выйти
        </button>
      </div>

      <div className="w-full max-w-sm grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setTab('scan')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            tab === 'scan' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
          }`}
        >
          Сканирование
        </button>
        <button
          onClick={() => setTab('redemptions')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            tab === 'redemptions' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
          }`}
        >
          Выдача призов
        </button>
        <button
          onClick={() => setTab('achievements')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            tab === 'achievements' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
          }`}
        >
          Достижения
        </button>
        <button
          onClick={() => setTab('games')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            tab === 'games' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
          }`}
        >
          Игры
        </button>
        <button
          onClick={() => setTab('admins')}
          className={`col-span-2 text-xs font-medium rounded-lg py-2 transition-colors ${
            tab === 'admins' ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-300'
          }`}
        >
          Администраторы
        </button>
      </div>

      {tab === 'scan' && <ScanView />}
      {tab === 'redemptions' && <RedemptionsView />}
      {tab === 'achievements' && <AchievementsView />}
      {tab === 'games' && <GamesView />}
      {tab === 'admins' && <AdminsView />}
    </div>
  );
};

export default AdminPanel;

