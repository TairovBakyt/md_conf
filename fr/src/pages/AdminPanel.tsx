import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useUser } from '../authorization/UserContext';

import { API_URL } from '../config';
const SCANNER_ELEMENT_ID = 'qr-reader';

const STATIONS: { label: string; suggestedPoints: number }[] = [
  { label: '1', suggestedPoints: 10 },
  { label: '2', suggestedPoints: 10 },
  { label: '3', suggestedPoints: 10 },
  { label: '4', suggestedPoints: 10 },
  { label: '5', suggestedPoints: 10 },
  { label: 'Instagram', suggestedPoints: 5 },
];

type Mode = 'scanning' | 'found' | 'submitting' | 'success' | 'error';

interface FoundParticipant {
  id: string;
  username: string;
}

interface Redemption {
  id: number;
  username: string;
  user_id: string;
  prize_title: string;
  cost: number;
  redeemed_at: string;
}

interface AchievementRecord {
  id: number;
  username: string;
  user_id: string;
  title: string;
  points: number;
  created_at: string;
}

interface GameSettings {
  quiz_unlocked: boolean;
  filword_unlocked: boolean;
}

export const AdminPanel: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('scanning');
  const [adminView, setAdminView] = useState<'scan' | 'redemptions' | 'achievements' | 'games'>('scan');
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [achievementRecords, setAchievementRecords] = useState<AchievementRecord[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>({ quiz_unlocked: false, filword_unlocked: false });
  const [gamesLoading, setGamesLoading] = useState(false);
  const [participant, setParticipant] = useState<FoundParticipant | null>(null);
  const [selectedStation, setSelectedStation] = useState(STATIONS[0].label);
  const [pointsInput, setPointsInput] = useState(String(STATIONS[0].suggestedPoints));
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [cameraError, setCameraError] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

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
    if (mode !== 'scanning' || adminView !== 'scan') return;
    isProcessingRef.current = false;
    setCameraError('');

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    // Html5Qrcode.getCameras()
    //   .then((cameras) => {
    //     if (!cameras || cameras.length === 0) {
    //       setCameraError('Камера не найдена на устройстве');
    //       setShowManualInput(true);
    //       return;
    //     }

    //     const realCamera =
    //       cameras.find((c) => !c.label.toLowerCase().includes('obs')) || cameras[0];

    //     return scanner.start(
    //       realCamera.id,
    //       { fps: 10, qrbox: 220 },
    //       (decodedText) => handleScanSuccess(decodedText),
    //       () => {
    //         // ошибки отдельных кадров игнорируем — камера сканирует непрерывно
    //       }
    //     );
    //   })
    //   .catch((err) => {
    //     console.error(err);
    //     setCameraError('Не удалось получить доступ к камере');
    //     setShowManualInput(true);
    //   });
    scanner
     .start(
       { facingMode: 'environment' }, // задняя камера
       { fps: 10, qrbox: 220 },
       (decodedText) => handleScanSuccess(decodedText),
       () => {
         // ошибки отдельных кадров игнорируем — камера сканирует непрерывно
       }
     )
     .catch((err) => {
  console.error(err);
  setCameraError('Не удалось получить доступ к камере');
  setShowManualInput(true);
});

    return () => {
      const s = scannerRef.current;
      if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
        s.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, adminView]);

  const handleScanSuccess = async (scannedUserId: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      try {
        await s.stop();
      } catch (e) {
        // камера уже остановлена — игнорируем
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/user/${scannedUserId}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg('Участник с таким QR не найден');
        setMode('error');
        return;
      }

      setParticipant({ id: data.id, username: data.username });
      setMode('found');
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setMode('error');
    }
  };

  const handleStationClick = (station: { label: string; suggestedPoints: number }) => {
    setSelectedStation(station.label);
    setPointsInput(String(station.suggestedPoints));
  };

  const handleManualSearch = async () => {
    const trimmedId = manualId.trim();
    if (!trimmedId) return;

    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      try {
        await s.stop();
      } catch (e) {
        // камера уже остановлена — игнорируем
      }
    }

    await handleScanSuccess(trimmedId);
  };

  const fetchRedemptions = async () => {
    setRedemptionsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/redemptions`);
      const data = await res.json();
      if (res.ok) {
        setRedemptions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRedemptionsLoading(false);
    }
  };

  const fetchAchievements = async () => {
    setAchievementsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/achievements`);
      const data = await res.json();
      if (res.ok) {
        setAchievementRecords(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAchievementsLoading(false);
    }
  };

  const fetchGameSettings = async () => {
    setGamesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const data = await res.json();
      if (res.ok) {
        setGameSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGamesLoading(false);
    }
  };

  const toggleGame = async (game: 'quiz' | 'filword', unlocked: boolean) => {
    if (!user) return;

    setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: unlocked }));

    try {
      const res = await fetch(`${API_URL}/api/admin/toggle-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user.id, game, unlocked }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error(data.error);
        setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: !unlocked }));
      }
    } catch (err) {
      console.error(err);
      setGameSettings((prev) => ({ ...prev, [`${game}_unlocked`]: !unlocked }));
    }
  };

  const handleSwitchView = (view: 'scan' | 'redemptions' | 'achievements' | 'games') => {
    setAdminView(view);
    if (view === 'redemptions') {
      fetchRedemptions();
    }
    if (view === 'achievements') {
      fetchAchievements();
    }
    if (view === 'games') {
      fetchGameSettings();
    }
  };

  const handleSubmit = async () => {
    if (!user || !participant) return;
    setMode('submitting');

    try {
      const res = await fetch(`${API_URL}/api/admin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          targetUserId: participant.id,
          points: Number(pointsInput) || 0,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось начислить баллы');
        setMode('error');
        return;
      }

      setSuccessMsg(`Начислено ${pointsInput} баллов участнику ${participant.username}`);
      setMode('success');
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setMode('error');
    }
  };

  const handleScanNext = () => {
    setParticipant(null);
    setSelectedStation(STATIONS[0].label);
    setPointsInput(String(STATIONS[0].suggestedPoints));
    setErrorMsg('');
    setSuccessMsg('');
    setShowManualInput(false);
    setManualId('');
    setMode('scanning');
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = participant?.username.slice(0, 2).toLowerCase() || '';

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
          onClick={() => handleSwitchView('scan')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            adminView === 'scan'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Сканирование
        </button>
        <button
          onClick={() => handleSwitchView('redemptions')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            adminView === 'redemptions'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Выдача призов
        </button>
        <button
          onClick={() => handleSwitchView('achievements')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            adminView === 'achievements'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Достижения
        </button>
        <button
          onClick={() => handleSwitchView('games')}
          className={`text-xs font-medium rounded-lg py-2 transition-colors ${
            adminView === 'games'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Игры
        </button>
      </div>

      {adminView === 'redemptions' ? (
        <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-indigo-400">Выкупленные призы</span>
            <button onClick={fetchRedemptions} className="text-xs text-slate-500 hover:text-slate-300">
              Обновить
            </button>
          </div>

          {redemptionsLoading ? (
            <p className="text-slate-400 text-sm text-center py-6">Загружаем...</p>
          ) : redemptions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Пока никто ничего не выкупил</p>
          ) : (
            <div className="flex flex-col gap-2">
              {redemptions.map((r) => (
                <div
                  key={r.id}
                  className="bg-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-slate-100 text-sm font-medium truncate">{r.prize_title}</p>
                    <p className="text-slate-500 text-xs font-mono truncate">
                      {r.username} · {r.user_id}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-slate-300 text-xs">{r.cost} б.</p>
                    <p className="text-slate-600 text-[10px]">
                      {new Date(r.redeemed_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : adminView === 'achievements' ? (
        <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-indigo-400">Достижения участников</span>
            <button onClick={fetchAchievements} className="text-xs text-slate-500 hover:text-slate-300">
              Обновить
            </button>
          </div>

          {achievementsLoading ? (
            <p className="text-slate-400 text-sm text-center py-6">Загружаем...</p>
          ) : achievementRecords.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Пока ни у кого нет достижений</p>
          ) : (
            <div className="flex flex-col gap-2">
              {achievementRecords.map((a) => (
                <div
                  key={a.id}
                  className="bg-slate-800 rounded-xl p-3 flex items-center gap-3"
                >
                  <span className="text-lg shrink-0">🏆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-100 text-sm font-medium truncate">{a.title}</p>
                    <p className="text-slate-500 text-xs font-mono truncate">
                      {a.username} · {a.user_id}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber-400 text-xs">+{a.points} б.</p>
                    <p className="text-slate-600 text-[10px]">
                      {new Date(a.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : adminView === 'games' ? (
        <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-indigo-400">Доступ к играм</span>
          </div>

          {gamesLoading ? (
            <p className="text-slate-400 text-sm text-center py-6">Загружаем...</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-slate-100 text-sm font-medium">Викторина «Hardcore QA»</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {gameSettings.quiz_unlocked ? 'Открыта для всех участников' : 'Закрыта'}
                  </p>
                </div>
                <button
                  onClick={() => toggleGame('quiz', !gameSettings.quiz_unlocked)}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                    gameSettings.quiz_unlocked ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      gameSettings.quiz_unlocked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-slate-100 text-sm font-medium">Филворд «Word Researcher»</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {gameSettings.filword_unlocked ? 'Открыт для всех участников' : 'Закрыт'}
                  </p>
                </div>
                <button
                  onClick={() => toggleGame('filword', !gameSettings.filword_unlocked)}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                    gameSettings.filword_unlocked ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      gameSettings.filword_unlocked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
        {mode === 'scanning' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-indigo-400">Наведите камеру на QR-код</span>
            </div>
            <div id={SCANNER_ELEMENT_ID} className="rounded-xl overflow-hidden" />
            {cameraError && (
              <p className="text-xs text-amber-400 mt-2">{cameraError}</p>
            )}

            {!showManualInput ? (
              <button
                onClick={() => setShowManualInput(true)}
                className="w-full text-slate-500 hover:text-slate-300 text-xs py-3 transition-colors"
              >
                Камера не работает? Ввести ID вручную
              </button>
            ) : (
              <div className="mt-4">
                <label className="text-xs text-slate-400 block mb-1.5">
                  ID участника (как при регистрации, например user_74484074)
                </label>
                <input
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="user_74484074"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-sm font-mono outline-none focus:border-indigo-500 mb-2"
                />
                <button
                  onClick={handleManualSearch}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
                >
                  Найти
                </button>
              </div>
            )}
          </>
        )}

        {mode === 'found' && participant && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium text-indigo-400">Участник найден</span>
            </div>

            <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-medium text-white">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-100">{participant.username}</p>
                <p className="text-xs text-slate-500 font-mono">{participant.id}</p>
              </div>
            </div>

            <label className="text-xs text-slate-400 block mb-2">Номер станции (для себя)</label>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {STATIONS.map((station) => (
                <button
                  key={station.label}
                  onClick={() => handleStationClick(station)}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                    selectedStation === station.label
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  {station.label}
                </button>
              ))}
            </div>

            <label className="text-xs text-slate-400 block mb-1.5">Начислить баллов</label>
            <input
              type="text"
              inputMode="numeric"
              value={pointsInput}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                setPointsInput(digitsOnly);
              }}
              onFocus={(e) => e.target.select()}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-base outline-none focus:border-indigo-500 mb-3"
            />

            <button
              onClick={handleSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 transition-colors mb-2"
            >
              Начислить {pointsInput} баллов · Станция {selectedStation}
            </button>
            <button
              onClick={handleScanNext}
              className="w-full text-slate-500 hover:text-slate-300 text-xs py-1.5 transition-colors"
            >
              Отменить и сканировать заново
            </button>
          </>
        )}

        {mode === 'submitting' && (
          <div className="text-center text-slate-400 text-sm py-8">Начисляем баллы...</div>
        )}

        {mode === 'success' && (
          <div className="text-center py-4">
            <p className="text-emerald-400 text-sm font-medium mb-4">{successMsg}</p>
            <button
              onClick={handleScanNext}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 transition-colors"
            >
              Сканировать следующего
            </button>
          </div>
        )}

        {mode === 'error' && (
          <div className="text-center py-4">
            <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
            <button
              onClick={handleScanNext}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default AdminPanel;