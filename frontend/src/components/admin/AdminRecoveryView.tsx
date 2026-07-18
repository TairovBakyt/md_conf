import React, { useEffect, useState } from 'react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

interface SearchResult {
  id: string;
  username: string;
}

interface FullParticipant {
  id: string;
  username: string;
  pin_code: string;
  total_score: number;
}

type SubTab = 'search' | 'fullList';

// Выбранная подвкладка, поиск и результаты — переживает F5. Полный список
// участников (fullList) не сохраняем — он и так подтягивается заново при
// каждом заходе на подвкладку, если пуст.
const RECOVERY_STORAGE_KEY = 'admin_recovery_state';

interface PersistedRecoveryState {
  subTab: SubTab;
  query: string;
  results: SearchResult[];
  resetTarget: SearchResult | null;
  fullListFilter: string;
  revealedId: string | null;
}

function loadPersistedRecoveryState(): PersistedRecoveryState {
  try {
    const raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedRecoveryState;
  } catch {
    // не критично
  }
  return { subTab: 'search', query: '', results: [], resetTarget: null, fullListFilter: '', revealedId: null };
}



export const AdminRecoveryView: React.FC = () => {
  const [persistedRecovery] = useState(loadPersistedRecoveryState);
  const { user } = useUser();

  const [subTab, setSubTab] = useState<SubTab>(persistedRecovery.subTab);

  const [query, setQuery] = useState(persistedRecovery.query);
  const [results, setResults] = useState<SearchResult[]>(persistedRecovery.results);
  const [searching, setSearching] = useState(false);
  const [resetTarget, setResetTarget] = useState<SearchResult | null>(persistedRecovery.resetTarget);
  const [newPin, setNewPin] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const [fullList, setFullList] = useState<FullParticipant[]>([]);
  const [fullListLoading, setFullListLoading] = useState(false);
  const [fullListFilter, setFullListFilter] = useState(persistedRecovery.fullListFilter);
  const [revealedId, setRevealedId] = useState<string | null>(persistedRecovery.revealedId);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        RECOVERY_STORAGE_KEY,
        JSON.stringify({ subTab, query, results, resetTarget, fullListFilter, revealedId })
      );
    } catch {
      // не критично
    }
  }, [subTab, query, results, resetTarget, fullListFilter, revealedId]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/search-users?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (res.ok) setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleResetPin = async () => {
    if (!user || !resetTarget) return;
    if (!/^\d{4}$/.test(newPin)) {
      setResetMsg('Введите новый PIN — ровно 4 цифры');
      return;
    }
    if (!confirm(`Сбросить PIN участнику «${resetTarget.username}» на ${newPin}? Старый PIN перестанет работать.`)) {
      return;
    }

    setResetBusy(true);
    setResetMsg('');
    try {
      const res = await fetch(`${API_URL}/api/admin/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, targetUserId: resetTarget.id, newPin }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResetMsg(data.error || 'Не удалось сбросить PIN');
        return;
      }

      setResetMsg(`Готово! Новый PIN для «${data.username}»: ${newPin} — сообщите его участнику.`);
      setNewPin('');
      setResetTarget(null);
    } catch (err) {
      console.error(err);
      setResetMsg('Сервер недоступен');
    } finally {
      setResetBusy(false);
    }
  };

  const fetchFullList = async () => {
    setFullListLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/all-participants`);
      const data = await res.json();
      if (res.ok) setFullList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFullListLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'fullList' && fullList.length === 0) {
      fetchFullList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const filteredFullList = fullList.filter(
    (p) =>
      p.username.toLowerCase().includes(fullListFilter.toLowerCase()) ||
      p.id.includes(fullListFilter)
  );

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-indigo-400">Восстановление доступа</span>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSubTab('search')}
          className={`flex-1 text-xs font-medium rounded-lg py-2.5 transition-colors ${
            subTab === 'search' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
          }`}
        >
          Забыл только PIN
        </button>
        <button
          onClick={() => setSubTab('fullList')}
          className={`flex-1 text-xs font-medium rounded-lg py-2.5 transition-colors ${
            subTab === 'fullList' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
          }`}
        >
          Забыл всё / искал не так
        </button>
      </div>

      {subTab === 'search' && (
        <>
          <p className="text-slate-500 text-xs mb-3">
            Найдите участника по нику или ID (уточните лично, что это точно он), затем поставьте новый PIN.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ник или ID участника"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg px-4 text-sm transition-colors"
            >
              Найти
            </button>
          </div>

          {results.length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setResetTarget(r);
                    setResetMsg('');
                  }}
                  className={`text-left bg-slate-800 hover:bg-slate-700 rounded-xl p-3 flex items-center justify-between transition-colors ${
                    resetTarget?.id === r.id ? 'ring-2 ring-indigo-500' : ''
                  }`}
                >
                  <span className="text-slate-100 text-sm font-medium">{r.username}</span>
                  <span className="text-slate-500 text-xs font-mono">{r.id}</span>
                </button>
              ))}
            </div>
          )}

          {resetTarget && (
            <div className="bg-slate-800 rounded-xl p-4 mb-3">
              <p className="text-slate-300 text-sm mb-2">
                Сброс PIN для <span className="font-medium text-indigo-400">{resetTarget.username}</span> (ID {resetTarget.id})
              </p>
              <label className="text-xs text-slate-400 block mb-1.5">Новый PIN (4 цифры)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-base font-mono tracking-widest outline-none focus:border-indigo-500 mb-3"
              />
              <button
                onClick={handleResetPin}
                disabled={resetBusy}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                {resetBusy ? 'Сбрасываем...' : 'Сбросить PIN'}
              </button>
            </div>
          )}

          {resetMsg && (
            <p className={`text-xs ${resetMsg.startsWith('Готово') ? 'text-emerald-400' : 'text-red-400'}`}>
              {resetMsg}
            </p>
          )}
        </>
      )}

      {subTab === 'fullList' && (
        <>
          <p className="text-slate-500 text-xs mb-3">
            Полный список участников — для случая, когда человек не помнит ни ник, ни ID. Найдите визуально,
            спросив что-то запоминающееся (когда регистрировался, сколько баллов набрал).
          </p>

          <input
            type="text"
            value={fullListFilter}
            onChange={(e) => setFullListFilter(e.target.value)}
            placeholder="Фильтр по нику или ID..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500 mb-3"
          />

          {fullListLoading ? (
            <p className="text-slate-500 text-sm text-center py-6">Загружаем...</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
              {filteredFullList.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setRevealedId(revealedId === p.id ? null : p.id)}
                  className="bg-slate-800 rounded-lg p-3 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-100 text-sm font-medium">{p.username}</span>
                    <span className="text-slate-500 text-xs">{p.total_score} баллов</span>
                  </div>
                  {revealedId === p.id && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
                      <span className="text-slate-400 text-xs font-mono">ID: {p.id}</span>
                      <span className="text-amber-400 text-xs font-mono font-semibold">PIN: {p.pin_code}</span>
                    </div>
                  )}
                </div>
              ))}
              {filteredFullList.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-6">Ничего не найдено</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminRecoveryView;