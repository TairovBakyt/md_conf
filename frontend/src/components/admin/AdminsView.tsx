import React, { useState } from 'react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

interface AdminSearchResult {
  id: string;
  username: string;
  is_admin: boolean;
}

export const AdminsView: React.FC = () => {
  const { user } = useUser();
  const [searchId, setSearchId] = useState('');
  const [result, setResult] = useState<AdminSearchResult | null>(null);
  const [error, setError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const handleSearch = async () => {
    const trimmedId = searchId.trim();
    if (!trimmedId) return;

    setSearchLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/user/${trimmedId}`);
      const data = await res.json();

      if (!res.ok) {
        setError('Участник не найден');
        return;
      }

      setResult({ id: data.id, username: data.username, is_admin: data.is_admin });
    } catch (err) {
      console.error(err);
      setError('Сервер недоступен');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleToggleAdmin = async (makeAdmin: boolean) => {
    if (!user || !result) return;

    setToggleLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, targetUserId: result.id, isAdmin: makeAdmin }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Не удалось изменить права');
        return;
      }

      setResult({ ...result, is_admin: makeAdmin });
    } catch (err) {
      console.error(err);
      setError('Сервер недоступен');
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-indigo-400">Добавить администратора</span>
      </div>

      <label className="text-xs text-slate-400 block mb-1.5">ID участника (4 цифры)</label>
      <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-2 focus-within:border-indigo-500">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={searchId}
          onChange={(e) => setSearchId(e.target.value.replace(/\D/g, ''))}
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
              {result.is_admin ? 'Администратор' : 'Обычный участник'}
            </span>
          </p>

          {result.is_admin ? (
            <button
              onClick={() => handleToggleAdmin(false)}
              disabled={toggleLoading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
            >
              {toggleLoading ? 'Изменяем...' : 'Забрать права администратора'}
            </button>
          ) : (
            <button
              onClick={() => handleToggleAdmin(true)}
              disabled={toggleLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
            >
              {toggleLoading ? 'Изменяем...' : 'Сделать администратором'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminsView;