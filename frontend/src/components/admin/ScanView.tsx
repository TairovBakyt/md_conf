import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

const SCANNER_ELEMENT_ID = 'qr-reader';
const POINTS_PER_OBJECT = 5;

const STATIONS: { label: string; suggestedPoints: number; stationNumber: number }[] = [
  { label: 'Ст.1 · Instagram', suggestedPoints: 5, stationNumber: 1 },
  { label: 'Ст.1 · LinkedIn', suggestedPoints: 5, stationNumber: 1 },
  { label: 'Ст.3 · Сториз', suggestedPoints: 15, stationNumber: 3 },
  { label: 'Ст.5 · Объект найден', suggestedPoints: POINTS_PER_OBJECT, stationNumber: 5 },
  { label: 'Ст.6 · Игра Азамата', suggestedPoints: 15, stationNumber: 6 },
];

type Mode = 'scanning' | 'found' | 'submitting' | 'success' | 'error';

interface FoundParticipant {
  id: string;
  username: string;
}

interface StationUnlockState {
  station1_unlocked: boolean;
  station3_unlocked: boolean;
  station5_unlocked: boolean;
  station6_unlocked: boolean;
}

// Состояние экрана — переживает обновление страницы (F5), чтобы админ не
// терял найденного участника посреди работы. Транзитные "в процессе"
// состояния (submitting) откатываются к "found" при восстановлении, так
// как сам запрос уже не может быть завершён после перезагрузки.
const SCAN_STORAGE_KEY = 'admin_scanview_state';

interface PersistedScanState {
  mode: Mode;
  participant: FoundParticipant | null;
  selectedStation: string;
  selectedStationNumber: number;
  pointsInput: string;
  instagramHandle: string;
  linkedinHandle: string;
  objectNumberInput: string;
  objectPointsInput: string;
  errorMsg: string;
  successMsg: string;
}

function loadPersistedScanState(): PersistedScanState | null {
  try {
    const raw = sessionStorage.getItem(SCAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedScanState;
    if (parsed.mode === 'submitting') {
      parsed.mode = parsed.participant ? 'found' : 'scanning';
    }
    return parsed;
  } catch {
    return null;
  }
}



export const ScanView: React.FC = () => {
  const [persistedScan] = useState(loadPersistedScanState);
  const { user } = useUser();

  const [mode, setMode] = useState<Mode>(persistedScan?.mode ?? 'scanning');
  const [participant, setParticipant] = useState<FoundParticipant | null>(persistedScan?.participant ?? null);
  const [selectedStation, setSelectedStation] = useState(persistedScan?.selectedStation ?? STATIONS[0].label);
  const [selectedStationNumber, setSelectedStationNumber] = useState(
    persistedScan?.selectedStationNumber ?? STATIONS[0].stationNumber
  );
  const [pointsInput, setPointsInput] = useState(persistedScan?.pointsInput ?? String(STATIONS[0].suggestedPoints));
  const [errorMsg, setErrorMsg] = useState(persistedScan?.errorMsg ?? '');
  const [successMsg, setSuccessMsg] = useState(persistedScan?.successMsg ?? '');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showMyQr, setShowMyQr] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [instagramHandle, setInstagramHandle] = useState(persistedScan?.instagramHandle ?? '');
  const [linkedinHandle, setLinkedinHandle] = useState(persistedScan?.linkedinHandle ?? '');
  const [objectNumberInput, setObjectNumberInput] = useState(persistedScan?.objectNumberInput ?? '');
  const [objectPointsInput, setObjectPointsInput] = useState(
    persistedScan?.objectPointsInput ?? String(POINTS_PER_OBJECT)
  );
  const [objectSubmitting, setObjectSubmitting] = useState(false);
  const [stationUnlocked, setStationUnlocked] = useState<StationUnlockState>({
    station1_unlocked: true,
    station3_unlocked: true,
    station5_unlocked: true,
    station6_unlocked: true,
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const incomingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Сохраняем состояние на каждое изменение — переживает F5.
  useEffect(() => {
    const toSave: PersistedScanState = {
      mode,
      participant,
      selectedStation,
      selectedStationNumber,
      pointsInput,
      instagramHandle,
      linkedinHandle,
      objectNumberInput,
      objectPointsInput,
      errorMsg,
      successMsg,
    };
    try {
      sessionStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // не критично
    }
  }, [
    mode,
    participant,
    selectedStation,
    selectedStationNumber,
    pointsInput,
    instagramHandle,
    linkedinHandle,
    objectNumberInput,
    objectPointsInput,
    errorMsg,
    successMsg,
  ]);

  // Тихий фоновый опрос статуса станций — не трогает loading/ошибки,
  // просто держит доступность кнопок актуальной, пока админ работает
  // на этой вкладке (админ может открыть/закрыть станцию из "Игры"
  // в другой вкладке в любой момент).
  const fetchStationSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const data = await res.json();
      if (res.ok) {
        setStationUnlocked({
          station1_unlocked: !!data.station1_unlocked,
          station3_unlocked: !!data.station3_unlocked,
          station5_unlocked: !!data.station5_unlocked,
          station6_unlocked: !!data.station6_unlocked,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStationSettings();
    const interval = setInterval(fetchStationSettings, 5000);
    return () => clearInterval(interval);
  }, []);

  const isStationLocked = (stationNumber: number): boolean => {
    const key = `station${stationNumber}_unlocked` as keyof StationUnlockState;
    return !stationUnlocked[key];
  };

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
        () => {
          // ошибки отдельных кадров игнорируем — камера сканирует непрерывно
        }
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

  const handleStationClick = (station: { label: string; suggestedPoints: number; stationNumber: number }) => {
    if (isStationLocked(station.stationNumber)) return;
    setSelectedStation(station.label);
    setSelectedStationNumber(station.stationNumber);
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

  const handleSubmit = async () => {
    if (!user || !participant) return;
    if (isStationLocked(selectedStationNumber)) {
      setErrorMsg(`Станция ${selectedStationNumber} сейчас закрыта — откройте её во вкладке "Игры"`);
      setMode('error');
      return;
    }
    setMode('submitting');

    try {
      const res = await fetch(`${API_URL}/api/admin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          targetUserId: participant.id,
          points: Number(pointsInput) || 0,
          stationNumber: selectedStationNumber,
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

  const handleObjectSubmit = async () => {
    if (!user || !participant || objectSubmitting) return;
    if (isStationLocked(5)) {
      setErrorMsg('Станция 5 сейчас закрыта — откройте её во вкладке "Игры"');
      setMode('error');
      return;
    }

    const objectNumber = Number(objectNumberInput);
    const points = Number(objectPointsInput);

    if (!objectNumberInput.trim() || Number.isNaN(objectNumber) || objectNumber < 1) {
      setErrorMsg('Введите номер объекта');
      setMode('error');
      return;
    }
    if (!objectPointsInput.trim() || Number.isNaN(points) || points < 0) {
      setErrorMsg('Введите количество баллов');
      setMode('error');
      return;
    }

    setObjectSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          targetUserId: participant.id,
          points,
          stationNumber: 5,
          objectNumber,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось начислить баллы');
        setMode('error');
        return;
      }

      setSuccessMsg(`Объект ${objectNumber} засчитан · +${points} баллов участнику ${participant.username}`);
      setObjectNumberInput('');
      setMode('success');
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setMode('error');
    } finally {
      setObjectSubmitting(false);
    }
  };

  const handleScanNext = () => {
    isProcessingRef.current = false;
    setParticipant(null);
    setCameraStarted(false);
    setShowManualInput(false);
    setShowMyQr(false);
    setSelectedStation(STATIONS[0].label);
    setSelectedStationNumber(STATIONS[0].stationNumber);
    setPointsInput(String(STATIONS[0].suggestedPoints));
    setErrorMsg('');
    setSuccessMsg('');
    setManualId('');
    setInstagramHandle('');
    setLinkedinHandle('');
    setCameraError('');
    setObjectNumberInput('');
    setObjectPointsInput(String(POINTS_PER_OBJECT));
    setObjectSubmitting(false);
    setMode('scanning');
  };

  // Instagram/LinkedIn — отдельные сайты, вставить текст в их поле поиска
  // напрямую через ссылку невозможно (same-origin policy). Максимум, что
  // можно сделать — скопировать ник в буфер обмена перед переходом, чтобы
  // админу оставалось только вставить его (Ctrl+V) внутри Instagram/LinkedIn.
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const handleCopyAndOpen = async (handle: string) => {
    if (handle.trim()) {
      try {
        await navigator.clipboard.writeText(handle.trim());
        setCopiedFeedback(true);
        setTimeout(() => setCopiedFeedback(false), 2000);
      } catch (err) {
        console.error(err);
        // Буфер обмена может быть недоступен (например, без HTTPS или разрешения) —
        // ссылка всё равно откроется как обычно, просто без автокопирования.
      }
    }
  };

  const initials = participant?.username.slice(0, 2).toLowerCase() || '';
  const isObjectStation = selectedStationNumber === 5;
  const currentStationLocked = isStationLocked(selectedStationNumber);
  const isInstagram = selectedStation.includes('Instagram');
  const isLinkedin = selectedStation.includes('LinkedIn');
  const currentHandle = isInstagram ? instagramHandle : linkedinHandle;

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-950 rounded-2xl p-5">
      {mode === 'scanning' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-indigo-400">Сканирование QR-кода</span>
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
              <p className="text-slate-500 text-xs font-mono mb-4">{user.id}</p>
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
              <label className="text-xs text-slate-400 block mb-1.5">
                ID участника (4 цифры)
              </label>
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
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {STATIONS.map((station) => {
              const locked = isStationLocked(station.stationNumber);
              return (
                <button
                  key={station.label}
                  onClick={() => handleStationClick(station)}
                  disabled={locked}
                  title={locked ? 'Станция закрыта — откройте во вкладке "Игры"' : undefined}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                    locked
                      ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                      : selectedStation === station.label
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  {locked ? '🔒 ' : ''}{station.label}
                </button>
              );
            })}
          </div>

          {currentStationLocked && (
            <p className="text-amber-400 text-[11px] mb-4">
              Выбранная станция сейчас закрыта — откройте её во вкладке "Игры", чтобы начислить баллы
            </p>
          )}

          {(isInstagram || isLinkedin) && (
            <div className="bg-slate-800 rounded-lg p-3 mb-4">
              <label className="text-xs text-slate-400 block mb-1.5">
                Ник участника {isInstagram ? 'в Instagram' : 'в LinkedIn'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentHandle}
                  onChange={(e) =>
                    isInstagram ? setInstagramHandle(e.target.value) : setLinkedinHandle(e.target.value)
                  }
                  placeholder="ник_участника"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm outline-none focus:border-indigo-500"
                />
                <a
                  href={
                    isInstagram
                      ? 'https://www.instagram.com/tairov.bk/followers/'
                      : encodeURI('https://www.linkedin.com/in/бакыт-таиров-b1499640a')
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleCopyAndOpen(currentHandle)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg px-3 py-2 flex items-center justify-center whitespace-nowrap transition-colors"
                >
                  Открыть подписчиков
                </a>
              </div>
              <p className="text-slate-500 text-[10px] mt-1.5">
                {copiedFeedback
                  ? `✅ Ник «${currentHandle}» скопирован — вставьте его (Ctrl+V) в поиск на странице`
                  : `Открой список подписчиков и найди там ${currentHandle ? `«${currentHandle}»` : 'ник участника'}`}
              </p>
            </div>
          )}

          {isObjectStation ? (
            <>
              <label className="text-xs text-slate-400 block mb-1.5">Номер объекта</label>
              <input
                type="text"
                inputMode="numeric"
                value={objectNumberInput}
                onChange={(e) => setObjectNumberInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Например, 3"
                disabled={currentStationLocked}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-base outline-none focus:border-indigo-500 mb-3 disabled:opacity-50"
              />

              <label className="text-xs text-slate-400 block mb-1.5">Баллов за этот объект</label>
              <input
                type="text"
                inputMode="numeric"
                value={objectPointsInput}
                onChange={(e) => setObjectPointsInput(e.target.value.replace(/\D/g, ''))}
                onFocus={(e) => e.target.select()}
                disabled={currentStationLocked}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-base outline-none focus:border-indigo-500 mb-3 disabled:opacity-50"
              />

              <button
                onClick={handleObjectSubmit}
                disabled={objectSubmitting || currentStationLocked}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors mb-2"
              >
                {objectSubmitting ? 'Начисляем...' : `Начислить объект ${objectNumberInput || '?'}`}
              </button>
              <button
                onClick={handleScanNext}
                className="w-full text-slate-500 hover:text-slate-300 text-xs py-1.5 transition-colors"
              >
                Отменить и сканировать заново
              </button>
            </>
          ) : (
            <>
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
                disabled={currentStationLocked}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 text-base outline-none focus:border-indigo-500 mb-3 disabled:opacity-50"
              />

              <button
                onClick={handleSubmit}
                disabled={currentStationLocked}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors mb-2"
              >
                <span className="sm:hidden">Начислить {pointsInput} баллов</span>
                <span className="hidden sm:inline">Начислить {pointsInput} баллов · Станция {selectedStation}</span>
              </button>
              <button
                onClick={handleScanNext}
                className="w-full text-slate-500 hover:text-slate-300 text-xs py-1.5 transition-colors"
              >
                Отменить и сканировать заново
              </button>
            </>
          )}
        </>
      )}

      {mode === 'submitting' && (
        <div className="text-center text-slate-400 text-sm py-8">Начисляем баллы...</div>
      )}

      {mode === 'success' && (
        <div className="text-center py-4">
          <p className="text-emerald-400 text-sm font-medium mb-4">{successMsg}</p>
          {participant && (
            <button
              onClick={() => setMode('found')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg py-2.5 transition-colors mb-2"
            >
              ← Назад к {participant.username}
            </button>
          )}
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

export default ScanView;