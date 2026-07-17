import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

const SCANNER_ELEMENT_ID = 'prize-qr-reader';

const MANUAL_STATION_TITLES: Record<number, string> = {
  1: 'Подписка на соцсети',
  3: 'Сториз-шеринг',
  5: 'Поиск объектов',
  6: 'Игра Азамата',
};

type Mode = 'scanning' | 'found' | 'redeeming' | 'success' | 'error';

interface ParticipantProfile {
  id: string;
  username: string;
  total_score: number;
  is_quiz_passed: boolean;
  is_filword_passed: boolean;
}

interface StationStatus {
  stationNumber: number;
  completed: boolean;
  points: number;
  count: number;
  unlocked: boolean;
}

interface Prize {
  id: number;
  title: string;
  tier: 'low' | 'middle' | 'high';
  cost: number;
  stock: number | null;
  description: string | null;
}

const TIER_LABELS: Record<string, string> = {
  low: 'Low-уровень',
  middle: 'Middle-уровень',
  high: 'High-уровень',
};

const TIER_ORDER = ['low', 'middle', 'high'];

export const PrizeBoothView: React.FC = () => {
  const { user } = useUser();

  const [mode, setMode] = useState<Mode>('scanning');
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [stations, setStations] = useState<StationStatus[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showMyQr, setShowMyQr] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [redeemingPrizeId, setRedeemingPrizeId] = useState<number | null>(null);
  const [quizPoints, setQuizPoints] = useState(0);
  const [filwordPoints, setFilwordPoints] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const incomingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode !== 'scanning' || !cameraStarted) return;
    isProcessingRef.current = false;
    setCameraError('');

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => handleScanSuccess(decodedText),
        () => {}
      )
      .catch((err) => {
        console.error(err);
        setCameraError('Не удалось получить доступ к камере');
      });

    return () => {
      const s = scannerRef.current;
      if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
        s.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cameraStarted]);

  useEffect(() => {
    if (mode !== 'scanning' || !user) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/scan-requests/${user.id}`);
        const data = await res.json();
        if (res.ok && data.participantId) {
          handleScanSuccess(data.participantId);
        }
      } catch (err) {
        console.error(err);
      }
    };

    incomingPollRef.current = setInterval(poll, 2000);
    return () => {
      if (incomingPollRef.current) clearInterval(incomingPollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user]);

  const handleScanSuccess = async (scannedUserId: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (incomingPollRef.current) {
      clearInterval(incomingPollRef.current);
    }

    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      try {
        await s.stop();
      } catch (e) {
        // камера уже остановлена
      }
    }

    try {
      const [userRes, stationsRes, prizesRes] = await Promise.all([
        fetch(`${API_URL}/api/user/${scannedUserId}`),
        fetch(`${API_URL}/api/stations/${scannedUserId}`),
        fetch(`${API_URL}/api/prizes`),
      ]);
      const userData = await userRes.json();
      const stationsData = await stationsRes.json();
      const prizesData = await prizesRes.json();

      if (!userRes.ok) {
        setErrorMsg('Участник с таким QR не найден');
        setMode('error');
        return;
      }

      setProfile(userData);
      setStations(stationsRes.ok ? stationsData.stations : []);
      setQuizPoints(stationsRes.ok ? stationsData.quizPoints ?? 0 : 0);
      setFilwordPoints(stationsRes.ok ? stationsData.filwordPoints ?? 0 : 0);
      setPrizes(prizesRes.ok ? prizesData : []);
      setMode('found');
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setMode('error');
    }
  };

  const handleManualSearch = async () => {
    const trimmedId = manualId.trim();
    if (!trimmedId) return;

    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      try {
        await s.stop();
      } catch (e) {}
    }

    await handleScanSuccess(trimmedId);
  };

  const handleRedeem = async (prize: Prize) => {
    if (!profile) return;
    setRedeemingPrizeId(prize.id);
    setMode('redeeming');

    try {
      const res = await fetch(`${API_URL}/api/prizes/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, prizeId: prize.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось выдать приз');
        setMode('error');
        return;
      }

      setSuccessMsg(`Выдано «${data.prizeTitle}» участнику ${profile.username}. Остаток баллов: ${data.newBalance}`);
      setMode('success');
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setMode('error');
    } finally {
      setRedeemingPrizeId(null);
    }
  };

  const handleScanNext = () => {
    isProcessingRef.current = false;
    setProfile(null);
    setStations([]);
    setPrizes([]);
    setQuizPoints(0);
    setFilwordPoints(0);
    setCameraStarted(false);
    setShowManualInput(false);
    setShowMyQr(false);
    setErrorMsg('');
    setSuccessMsg('');
    setManualId('');
    setCameraError('');
    setMode('scanning');
  };

  const initials = profile?.username.slice(0, 2).toLowerCase() || '';

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
      {mode === 'scanning' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-indigo-400">Стойка выдачи призов</span>
          </div>

          {!cameraStarted && !showManualInput && !showMyQr && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setCameraStarted(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-3 text-sm transition-colors"
              >
                Начать сканирование
              </button>
              <button
                onClick={() => setShowManualInput(true)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-3 text-sm transition-colors"
              >
                Ввести ID вручную
              </button>
              <button
                onClick={() => setShowMyQr(true)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-3 text-sm transition-colors"
              >
                Показать мой QR
              </button>
            </div>
          )}

          {showMyQr && user && (
            <div className="flex flex-col items-center py-2">
              <p className="text-slate-400 text-xs text-center mb-4">
                Пусть участник отсканирует этот код — его профиль появится здесь автоматически
              </p>
              <div className="p-4 bg-white rounded-xl shadow-inner mb-4">
                <QRCodeSVG
                  value={`${window.location.origin}/scan-admin?admin=${user.id}`}
                  size={180}
                  bgColor={'#ffffff'}
                  fgColor={'#0f172a'}
                  level={'H'}
                />
              </div>
              <button
                onClick={() => setShowMyQr(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Назад
              </button>
            </div>
          )}

          {cameraStarted && !cameraError && <div id={SCANNER_ELEMENT_ID} className="rounded-xl overflow-hidden" />}
          {cameraStarted && cameraError && <div id={SCANNER_ELEMENT_ID} className="rounded-xl overflow-hidden hidden" />}

          {cameraStarted && !cameraError && (
            <button
              onClick={handleScanNext}
              className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Отмена
            </button>
          )}

          {cameraError && (
            <div className="text-center py-4">
              <p className="text-xs text-amber-400 mb-3">
                {cameraError}. Вернитесь назад и введите ID вручную.
              </p>
              <button
                onClick={() => {
                  setCameraStarted(false);
                  setCameraError('');
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Назад
              </button>
            </div>
          )}

          {showManualInput && (
            <div className="mt-4">
              <label className="text-xs text-slate-400 block mb-1.5">ID участника (4 цифры)</label>
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-2 focus-within:border-indigo-500">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value.replace(/\D/g, ''))}
                  placeholder="4231"
                  className="flex-1 bg-transparent px-3 py-2.5 text-slate-100 text-sm font-mono outline-none"
                />
              </div>
              <button
                onClick={handleManualSearch}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors mb-2"
              >
                Найти
              </button>
              <button
                onClick={() => setShowManualInput(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Назад
              </button>
            </div>
          )}
        </>
      )}

      {mode === 'found' && profile && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-indigo-400">Профиль участника</span>
          </div>

          <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-medium text-white">
              {initials}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-100">{profile.username}</p>
              <p className="text-xs text-slate-500 font-mono">{profile.id}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-100">{profile.total_score}</p>
              <p className="text-[10px] text-slate-500">баллов</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Станции</p>
          <div className="flex flex-col gap-1.5 mb-4">
            <div className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-300">2. Hardcore QA</span>
              <span className={`text-sm ${profile.is_quiz_passed ? 'text-emerald-400' : 'text-slate-600'}`}>
                {profile.is_quiz_passed ? `✅ +${quizPoints}` : '⬜'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
              <span className="text-xs text-slate-300">4. Word Researcher</span>
              <span className={`text-sm ${profile.is_filword_passed ? 'text-emerald-400' : 'text-slate-600'}`}>
                {profile.is_filword_passed ? `✅ +${filwordPoints}` : '⬜'}
              </span>
            </div>
            {stations.map((station) => (
              <div key={station.stationNumber} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-300">
                  {station.stationNumber}. {MANUAL_STATION_TITLES[station.stationNumber] ?? ''}
                </span>
                <span className={`text-sm ${station.completed ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {station.completed ? `✅ +${station.points}` : '⬜'}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Доступные призы</p>
          <div className="flex flex-col gap-4 mb-4">
            {TIER_ORDER.map((tier) => {
              const tierPrizes = prizes.filter((p) => p.tier === tier);
              if (tierPrizes.length === 0) return null;

              return (
                <div key={tier}>
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1.5">
                    {TIER_LABELS[tier] || tier}
                  </p>
                  <div className="flex flex-col gap-2">
                    {tierPrizes.map((prize) => {
                      const canAfford = profile.total_score >= prize.cost;
                      const outOfStock = prize.stock !== null && prize.stock <= 0;
                      const disabled = !canAfford || outOfStock || redeemingPrizeId !== null;

                      return (
                        <div
                          key={prize.id}
                          className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-slate-100 text-sm font-medium truncate">{prize.title}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{prize.cost} баллов</p>
                          </div>
                          <button
                            onClick={() => handleRedeem(prize)}
                            disabled={disabled}
                            className={`shrink-0 text-xs font-medium rounded-lg px-3.5 py-2 transition-colors ${
                              !disabled
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {outOfStock ? 'Закончился' : canAfford ? 'Выдать' : 'Не хватает баллов'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleScanNext}
            className="w-full text-slate-500 hover:text-slate-300 text-xs py-1.5 transition-colors"
          >
            Отменить и сканировать заново
          </button>
        </>
      )}

      {mode === 'redeeming' && (
        <div className="text-center text-slate-400 text-sm py-8">Выдаём приз...</div>
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
  );
};

export default PrizeBoothView;