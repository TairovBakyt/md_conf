import React, { useState } from 'react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';
import { ADMIN_TAB_DEFS, getAccessLabel, type AdminTabId } from '../../adminTabs';

interface AdminSearchResult {
  id: string;
  username: string;
  is_admin: boolean;
  is_main_admin: boolean;
  admin_permissions: AdminTabId[] | null;
}

// Поиск и найденный результат — переживает F5.
const ADMINSVIEW_STORAGE_KEY = 'admin_adminsview_state';

interface PersistedAdminsViewState {
  searchId: string;
  result: AdminSearchResult | null;
}

function loadPersistedAdminsViewState(): PersistedAdminsViewState {
  try {
    const raw = sessionStorage.getItem(ADMINSVIEW_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedAdminsViewState;
  } catch {
    // не критично
  }
  return { searchId: '', result: null };
}

export const AdminsView: React.FC = () => {
  const { user } = useUser();
  const [persisted] = useState(loadPersistedAdminsViewState);
  const [searchId, setSearchId] = useState(persisted.searchId);
  const [result, setResult] = useState<AdminSearchResult | null>(persisted.result);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(false);
  const [selectedTabs, setSelectedTabs] = useState<Set<AdminTabId>>(new Set());

  React.useEffect(() => {
    try {
      sessionStorage.setItem(ADMINSVIEW_STORAGE_KEY, JSON.stringify({ searchId, result }));
    } catch {
      // не критично
    }
  }, [searchId, result]);

  const handleSearch = async () => {
    const trimmedId = searchId.trim();
    if (!trimmedId) return;

    setSearchLoading(true);
    setError('');
    setResult(null);
    setEditingPermissions(false);

    try {
      const res = await fetch(`${API_URL}/api/user/${trimmedId}`);
      const data = await res.json();

      if (!res.ok) {
        setError('Участник не найден');
        return;
      }

      setResult({
        id: data.id,
        username: data.username,
        is_admin: data.is_admin,
        is_main_admin: !!data.is_main_admin,
        admin_permissions: data.admin_permissions ?? null,
      });
    } catch (err) {
      console.error(err);
      setError('Сервер недоступен');
    } finally {
      setSearchLoading(false);
    }
  };

  // isAdmin=true + permissions=null → полный доступ.
  // isAdmin=true + permissions=[...] → частичный доступ.
  // isAdmin=false → права полностью снимаются (бэкенд сам сбросит permissions в NULL).
  const applyAdminChange = async (isAdmin: boolean, permissions: AdminTabId[] | null) => {
    if (!user || !result) return;
    setActionLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/admin/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, targetUserId: result.id, isAdmin, permissions }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Не удалось изменить права');
        return;
      }

      setResult({ ...result, is_admin: isAdmin, admin_permissions: isAdmin ? permissions : null });
      setEditingPermissions(false);
    } catch (err) {
      console.error(err);
      setError('Сервер недоступен');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantFull = () => applyAdminChange(true, null);

  const openPermissionEditor = () => {
    setSelectedTabs(new Set(result?.admin_permissions ?? []));
    setEditingPermissions(true);
  };

  const toggleTabSelection = (tabId: AdminTabId) => {
    setSelectedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  };

  const handleConfirmPermissions = () => applyAdminChange(true, Array.from(selectedTabs));

  const handleRevoke = () => applyAdminChange(false, null);

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">Управление администраторами</span>
      </div>

      <label className="text-xs text-slate-400 block mb-1.5">ID участника (4 цифры)</label>
      <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-2 focus-within:border-indigo-500">
        <input
          type="text"
          value={searchId}
          onChange={(e) => {
            const raw = e.target.value;
            // Единственное жёсткое исключение из формата "4 цифры" — ID
            // главного администратора, у которого исторически буквенный ID.
            const MAIN_ADMIN_ID = 'admin_Bakyt';
            if (MAIN_ADMIN_ID.toLowerCase().startsWith(raw.toLowerCase()) && raw.length > 0) {
              setSearchId(raw);
              return;
            }
            setSearchId(raw.replace(/\D/g, '').slice(0, 4));
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="4231"
          className="flex-1 bg-transparent px-3 py-2.5 text-slate-100 text-sm font-mono outline-none"
        />
      </div>
      <button
        onClick={handleSearch}
        disabled={searchLoading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors mb-3 disabled:opacity-50"
      >
        {searchLoading ? 'Ищем...' : 'Найти'}
      </button>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {result && (
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-medium text-white">
              {result.username.slice(0, 2).toLowerCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">{result.username}</p>
              <p className="text-xs text-slate-500 font-mono">{result.id}</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Статус:{' '}
            <span className={result.is_admin ? 'text-emerald-400' : 'text-slate-500'}>
              {result.is_main_admin ? '👑 Главный администратор' : result.is_admin ? getAccessLabel(result.admin_permissions) : 'Обычный участник'}
            </span>
          </p>

          {result.is_main_admin ? (
            <p className="text-slate-500 text-xs bg-slate-900 rounded-lg p-3">
              Права главного администратора защищены — их нельзя изменить ни через эту панель, ни другим админам.
            </p>
          ) : editingPermissions ? (
            <div className="mb-3">
              <p className="text-xs text-slate-400 mb-2">Выберите доступные вкладки:</p>
              <div className="flex flex-col gap-1.5 mb-3">
                {ADMIN_TAB_DEFS.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2.5 bg-slate-900 rounded-lg px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTabs.has(t.id)}
                      onChange={() => toggleTabSelection(t.id)}
                      className="accent-indigo-500 w-4 h-4"
                    />
                    <span className="text-base">{t.icon}</span>
                    <span className="text-slate-200 text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleGrantFull}
                disabled={actionLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors mb-2"
              >
                {actionLoading ? 'Сохраняем...' : 'Сделать полный доступ'}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPermissions(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirmPermissions}
                  disabled={actionLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  {actionLoading ? 'Сохраняем...' : 'Подтвердить с выбранными'}
                </button>
              </div>
            </div>
          ) : result.is_admin ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={openPermissionEditor}
                disabled={actionLoading}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                Изменить права
              </button>
              <button
                onClick={handleRevoke}
                disabled={actionLoading}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Изменяем...' : 'Забрать права администратора'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleGrantFull}
                disabled={actionLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Изменяем...' : 'Полный доступ'}
              </button>
              <button
                onClick={openPermissionEditor}
                disabled={actionLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                Частичный доступ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminsView;