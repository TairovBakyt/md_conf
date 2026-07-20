import React, { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';
import { useSmartPolling } from '../../hooks/useSmartPolling';

const SCANNER_ELEMENT_ID = 'prize-qr-reader';
const LONG_PRESS_MS = 550;

// html5-qrcode — тяжёлая библиотека, нужна только в момент реального
// запуска камеры. Импортируется динамически (см. useEffect ниже), а не
// статически вверху файла — типы через `import type` в рантайм-бандл
// не попадают.
type Html5QrcodeModule = typeof import('html5-qrcode');

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

interface RedeemedPrize {
  id: number;
  title: string;
  tier: 'low' | 'middle' | 'high';
  cost: number;
  redeemed_at: string;
}

const TIER_LABELS: Record<string, string> = {
  low: 'Low-уровень',
  middle: 'Middle-уровень',
  high: 'High-уровень',
};

const TIER_ORDER = ['low', 'middle', 'high'];

// Состояние экрана — переживает F5, чтобы админ не терял найденного
// участника. Транзитное "redeeming" откатывается к "found".
const PRIZEBOOTH_STORAGE_KEY = 'admin_prizebooth_state';

interface PersistedPrizeBoothState {
  mode: Mode;
  profile: ParticipantProfile | null;
  stations: StationStatus[];
  prizes: Prize[];
  redeemedPrizes: RedeemedPrize[];
  quizPoints: number;
  filwordPoints: number;
  deductedTotal: number;
  errorMsg: string;
  successMsg: string;
}

function loadPersistedPrizeBoothState(): PersistedPrizeBoothState | null {
  try {
    const raw = sessionStorage.getItem(PRIZEBOOTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPrizeBoothState;
    if (parsed.mode === 'redeeming') {
      parsed.mode = parsed.profile ? 'found' : 'scanning';
    }
    return parsed;
  } catch {
    return null;
  }
}

export const PrizeBoothView: React.FC = () => {
  const [persistedPrizeBooth] = useState(loadPersistedPrizeBoothState);
  const { user } = useUser();

  const [mode, setMode] = useState<Mode>(persistedPrizeBooth?.mode ?? 'scanning');
  const [profile, setProfile] = useState<ParticipantProfile | null>(persistedPrizeBooth?.profile ?? null);
  const [stations, setStations] = useState<StationStatus[]>(persistedPrizeBooth?.stations ?? []);
  const [prizes, setPrizes] = useState<Prize[]>(persistedPrizeBooth?.prizes ?? []);
  const [redeemedPrizes, setRedeemedPrizes] = useState<RedeemedPrize[]>(persistedPrizeBooth?.redeemedPrizes ?? []);
  const [errorMsg, setErrorMsg] = useState(persistedPrizeBooth?.errorMsg ?? '');
  const [successMsg, setSuccessMsg] = useState(persistedPrizeBooth?.successMsg ?? '');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showMyQr, setShowMyQr] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [redeemingPrizeId, setRedeemingPrizeId] = useState<number | null>(null);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [quizPoints, setQuizPoints] = useState(persistedPrizeBooth?.quizPoints ?? 0);
  const [filwordPoints, setFilwordPoints] = useState(persistedPrizeBooth?.filwordPoints ?? 0);
  const [deductedTotal, setDeductedTotal] = useState(persistedPrizeBooth?.deductedTotal ?? 0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPrizeIds, setSelectedPrizeIds] = useState<Set<number>>(new Set());
  const [bulkRedeeming, setBulkRedeeming] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const html5QrcodeModuleRef = useRef<Html5QrcodeModule | null>(null);
  const isProcessingRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    const toSave: PersistedPrizeBoothState = {
      mode,
      profile,
      stations,
      prizes,
      redeemedPrizes,
      quizPoints,
      filwordPoints,
      deductedTotal,
      errorMsg,
      successMsg,
    };
    try {
      sessionStorage.setItem(PRIZEBOOTH_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // не критично
    }
  }, [mode, profile, stations, prizes, redeemedPrizes, quizPoints, filwordPoints, deductedTotal, errorMsg, successMsg]);

  // Тихий фоновый поллинг — участник может сам купить приз через /prizes,
  // пока админ смотрит его профиль здесь. Обновляем баланс/призы, не
  // трогая mode/loading, чтобы не сбрасывать текущий экран.
  useSmartPolling(
    () => {
      if (profile) refetchProfileAndHistory(profile.id);
    },
    3000,
    mode === 'found' && !!profile
  );

  // Камера + html5-qrcode подгружаются динамически только здесь, в момент
  // реального запуска сканирования (cameraStarted === true) — до этого
  // библиотека вообще не скачивается браузером.
  useEffect(() => {
    if (mode !== 'scanning' || !cameraStarted) return;
    isProcessingRef.current = false;
    setCameraError('');

    let cancelled = false;

    import('html5-qrcode').then(({ Html5Qrcode, Html5QrcodeScannerState }) => {
      if (cancelled) return;
      html5QrcodeModuleRef.current = { Html5Qrcode, Html5QrcodeScannerState } as Html5QrcodeModule;

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
    });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      const mod = html5QrcodeModuleRef.current;
      if (s && mod && s.getState() === mod.Html5QrcodeScannerState.SCANNING) {
        s.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cameraStarted]);

  const pollIncomingScan = async () => {
    if (!user) return;
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

  useSmartPolling(pollIncomingScan, 2000, mode === 'scanning' && !!user);

  const refetchProfileAndHistory = async (userId: string) => {
    try {
      const [userRes, stationsRes, prizesRes, historyRes, deductionsRes] = await Promise.all([
        fetch(`${API_URL}/api/user/${userId}`),
        fetch(`${API_URL}/api/stations/${userId}`),
        fetch(`${API_URL}/api/prizes`),
        fetch(`${API_URL}/api/prizes/history/${userId}`),
        fetch(`${API_URL}/api/admin/deductions-total/${userId}`),
      ]);
      const userData = await userRes.json();
      const stationsData = await stationsRes.json();
      const prizesData = await prizesRes.json();
      const historyData = await historyRes.json();
      const deductionsData = await deductionsRes.json();

      if (userRes.ok) setProfile(userData);
      if (stationsRes.ok) {
        setStations(stationsData.stations || []);
        setQuizPoints(stationsData.quizPoints ?? 0);
        setFilwordPoints(stationsData.filwordPoints ?? 0);
      }
      if (prizesRes.ok) setPrizes(prizesData);
      if (historyRes.ok) setRedeemedPrizes(historyData);
      if (deductionsRes.ok) setDeductedTotal(deductionsData.total);
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanSuccess = async (scannedUserId: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const s = scannerRef.current;
    const mod = html5QrcodeModuleRef.current;
    if (s && mod && s.getState() === mod.Html5QrcodeScannerState.SCANNING) {
      try {
        await s.stop();
      } catch (e) {
        // камера уже остановлена
      }
    }

    try {
      const [userRes, stationsRes, prizesRes, historyRes, deductionsRes] = await Promise.all([
        fetch(`${API_URL}/api/user/${scannedUserId}`),
        fetch(`${API_URL}/api/stations/${scannedUserId}`),
        fetch(`${API_URL}/api/prizes`),
        fetch(`${API_URL}/api/prizes/history/${scannedUserId}`),
        fetch(`${API_URL}/api/admin/deductions-total/${scannedUserId}`),
      ]);
      const userData = await userRes.json();
      const stationsData = await stationsRes.json();
      const prizesData = await prizesRes.json();
      const historyData = await historyRes.json();
      const deductionsData = await deductionsRes.json();

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
      setRedeemedPrizes(historyRes.ok ? historyData : []);
      setDeductedTotal(deductionsRes.ok ? deductionsData.total : 0);
      setSelectionMode(false);
      setSelectedPrizeIds(new Set());
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
    const mod = html5QrcodeModuleRef.current;
    if (s && mod && s.getState() === mod.Html5QrcodeScannerState.SCANNING) {
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

      // Обновляем баланс, список полученных призов и остатки в магазине,
      // чтобы экран отражал актуальное состояние без повторного сканирования.
      await refetchProfileAndHistory(profile.id);

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

  const toggleSelectPrize = (prizeId: number) => {
    setSelectedPrizeIds((prev) => {
      const next = new Set(prev);
      if (next.has(prizeId)) next.delete(prizeId);
      else next.add(prizeId);
      return next;
    });
  };

  // Долгое нажатие на карточку приза (как в Telegram/Google Фото) включает
  // режим выбора и сразу отмечает нажатый приз. В обычном режиме короткий
  // тап/клик по карточке ничего не делает — только кнопка "Выдать" активна.
  const handlePrizePointerDown = (prize: Prize) => {
    const outOfStock = prize.stock !== null && prize.stock <= 0;
    if (outOfStock || selectionMode) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setSelectionMode(true);
      setSelectedPrizeIds(new Set([prize.id]));
    }, LONG_PRESS_MS);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePrizeCardClick = (prize: Prize) => {
    // Если долгое нажатие только что сработало — этот клик его "эхо",
    // игнорируем, чтобы не снять выбор сразу после включения режима.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (!selectionMode) return;
    const outOfStock = prize.stock !== null && prize.stock <= 0;
    if (outOfStock) return;
    toggleSelectPrize(prize.id);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPrizeIds(new Set());
  };

  // Доступны для выбора только те призы, которые в принципе можно
  // выдать прямо сейчас (есть в наличии) — иначе "Выбрать все" отмечало
  // бы заведомо невыполнимые пункты.
  const getSelectablePrizes = (): Prize[] => {
    return prizes.filter((p) => !(p.stock !== null && p.stock <= 0));
  };

  const handleToggleSelectAll = () => {
    const selectable = getSelectablePrizes();
    const allSelected = selectable.length > 0 && selectable.every((p) => selectedPrizeIds.has(p.id));
    setSelectionMode(true);
    if (allSelected) {
      setSelectedPrizeIds(new Set());
    } else {
      setSelectedPrizeIds(new Set(selectable.map((p) => p.id)));
    }
  };

  const selectedTotalCost = prizes
    .filter((p) => selectedPrizeIds.has(p.id))
    .reduce((sum, p) => sum + p.cost, 0);

  const handleBulkRedeem = async () => {
    if (!profile || selectedPrizeIds.size === 0 || bulkRedeeming) return;
    const selectedPrizes = prizes.filter((p) => selectedPrizeIds.has(p.id));
    if (!confirm(`Выдать выбранные призы (${selectedPrizes.length} шт., ${selectedTotalCost} баллов) участнику ${profile.username}?`)) {
      return;
    }

    setBulkRedeeming(true);
    setMode('redeeming');

    const succeeded: string[] = [];
    const failed: string[] = [];

    // Последовательно, а не параллельно — баланс меняется после каждой
    // выдачи, и следующая проверка "хватает ли баллов" должна видеть
    // уже актуальный остаток.
    for (const prize of selectedPrizes) {
      try {
        const res = await fetch(`${API_URL}/api/prizes/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.id, prizeId: prize.id }),
        });
        const data = await res.json();
        if (res.ok) {
          succeeded.push(data.prizeTitle);
        } else {
          failed.push(`${prize.title} (${data.error || 'ошибка'})`);
        }
      } catch (err) {
        console.error(err);
        failed.push(`${prize.title} (сервер недоступен)`);
      }
    }

    await refetchProfileAndHistory(profile.id);
    exitSelectionMode();
    setBulkRedeeming(false);

    let message = '';
    if (succeeded.length > 0) {
      message += `Выдано: ${succeeded.join(', ')}.`;
    }
    if (failed.length > 0) {
      message += ` Не удалось: ${failed.join(', ')}.`;
    }
    setSuccessMsg(message.trim() || 'Готово');
    setMode('success');
  };

  const handleRefund = async (redemption: RedeemedPrize) => {
    if (!profile || refundingId !== null) return;
    if (!confirm(`Вернуть «${redemption.title}»? Участнику будет возвращено ${redemption.cost} баллов.`)) return;

    setRefundingId(redemption.id);

    try {
      const res = await fetch(`${API_URL}/api/prizes/redemption/${redemption.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось вернуть приз');
        setMode('error');
        return;
      }

      await refetchProfileAndHistory(profile.id);
      setSuccessMsg(`Возврат «${data.prizeTitle}» оформлен. Возвращено ${data.refundedPoints} баллов. Баланс: ${data.newBalance}`);
      setMode('success');
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setMode('error');
    } finally {
      setRefundingId(null);
    }
  };

  const handleScanNext = () => {
    isProcessingRef.current = false;
    setProfile(null);
    setStations([]);
    setPrizes([]);
    setRedeemedPrizes([]);
    setQuizPoints(0);
    setFilwordPoints(0);
    setDeductedTotal(0);
    setCameraStarted(false);
    setShowManualInput(false);
    setShowMyQr(false);
    setErrorMsg('');
    setSuccessMsg('');
    setManualId('');
    setCameraError('');
    setSelectionMode(false);
    setSelectedPrizeIds(new Set());
    setMode('scanning');
  };

  const initials = profile?.username.slice(0, 2).toLowerCase() || '';
  const selectableCount = getSelectablePrizes().length;
  const allSelected = selectableCount > 0 && getSelectablePrizes().every((p) => selectedPrizeIds.has(p.id));

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

          {deductedTotal > 0 && (
            <div className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 mb-4">
              <span className="text-xs text-slate-400">Всего списано баллов</span>
              <span className="text-red-400 text-sm font-medium">−{deductedTotal}</span>
            </div>
          )}

          {redeemedPrizes.length > 0 && (
            <>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Уже получено ({redeemedPrizes.length})
              </p>
              <div className="flex flex-col gap-1.5 mb-4">
                {redeemedPrizes.map((rp) => (
                  <div key={rp.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-slate-300 truncate block">{rp.title}</span>
                      <span className="text-[10px] text-slate-600">
                        {new Date(rp.redeemed_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="text-emerald-400 text-xs shrink-0">−{rp.cost} б.</span>
                    <button
                      onClick={() => handleRefund(rp)}
                      disabled={refundingId !== null}
                      className="shrink-0 text-[11px] font-medium text-amber-400 hover:text-amber-300 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 transition-colors"
                    >
                      {refundingId === rp.id ? '...' : '↩ Вернуть'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              {selectionMode ? `Выбрано: ${selectedPrizeIds.size}` : 'Доступные призы'}
            </p>
            <div className="flex items-center gap-3">
              {selectionMode && (
                <button
                  onClick={exitSelectionMode}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ✕ Отмена
                </button>
              )}
              {selectableCount > 0 && (
                <button
                  onClick={handleToggleSelectAll}
                  className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {allSelected ? 'Снять выбор' : 'Выбрать все'}
                </button>
              )}
            </div>
          </div>

          {!selectionMode && (
            <p className="text-slate-600 text-[10px] mb-2">Долгое нажатие на приз включает режим выбора</p>
          )}

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
                      const disabled = outOfStock || redeemingPrizeId !== null || bulkRedeeming;
                      const isSelected = selectedPrizeIds.has(prize.id);

                      return (
                        <div
                          key={prize.id}
                          onPointerDown={() => handlePrizePointerDown(prize)}
                          onPointerUp={clearLongPressTimer}
                          onPointerLeave={clearLongPressTimer}
                          onPointerCancel={clearLongPressTimer}
                          onClick={() => handlePrizeCardClick(prize)}
                          className={`bg-slate-900 border rounded-xl p-3 flex items-center gap-3 transition-colors select-none ${
                            isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800'
                          } ${selectionMode ? 'cursor-pointer' : ''}`}
                        >
                          {selectionMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              disabled={outOfStock}
                              className="accent-indigo-500 w-4 h-4 shrink-0 disabled:opacity-30 pointer-events-none"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-100 text-sm font-medium truncate">{prize.title}</p>
                            <p className="text-slate-500 text-xs mt-0.5">
                              {prize.cost} баллов{!canAfford && !outOfStock ? ' · не хватает баллов' : ''}
                            </p>
                          </div>
                          {!selectionMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRedeem(prize);
                              }}
                              disabled={!canAfford || disabled}
                              className={`shrink-0 text-xs font-medium rounded-lg px-3.5 py-2 transition-colors ${
                                canAfford && !disabled
                                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {outOfStock ? 'Закончился' : canAfford ? 'Выдать' : 'Не хватает'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {selectionMode && selectedPrizeIds.size > 0 && (
            <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 pt-3 mb-3 -mx-5 px-5">
              <button
                onClick={handleBulkRedeem}
                disabled={bulkRedeeming || selectedTotalCost > profile.total_score}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-3 text-sm transition-colors"
              >
                {bulkRedeeming
                  ? 'Выдаём...'
                  : `Выдать выбранные (${selectedPrizeIds.size}) · ${selectedTotalCost} баллов`}
              </button>
              {selectedTotalCost > profile.total_score && (
                <p className="text-red-400 text-[11px] mt-1.5 text-center">
                  Не хватает баллов на все выбранные призы
                </p>
              )}
            </div>
          )}

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
          {profile && (
            <button
              onClick={() => setMode('found')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors mb-2"
            >
              Вернуться в профиль
            </button>
          )}
          <button
            onClick={handleScanNext}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
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