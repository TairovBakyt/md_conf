import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { useUser } from '../../authorization/UserContext';
import { API_URL } from '../../config';

const SCANNER_ELEMENT_ID = 'qr-reader';

const STATIONS: { label: string; suggestedPoints: number }[] = [
  { label: 'Ст.3 · Instagram', suggestedPoints: 5 },
  { label: 'Ст.3 · LinkedIn', suggestedPoints: 5 },
  { label: 'Ст.4 · Сториз', suggestedPoints: 15 },
  { label: 'Ст.5 · Победа в тб', suggestedPoints: 15 },
  { label: 'Ст.5 · Участие в тб', suggestedPoints: 5 },
];

type Mode = 'scanning' | 'found' | 'submitting' | 'success' | 'error';

interface FoundParticipant {
  id: string;
  username: string;
}

export const ScanView: React.FC = () => {
  const { user } = useUser();

  const [mode, setMode] = useState<Mode>('scanning');
  const [participant, setParticipant] = useState<FoundParticipant | null>(null);
  const [selectedStation, setSelectedStation] = useState(STATIONS[0].label);
  const [pointsInput, setPointsInput] = useState(String(STATIONS[0].suggestedPoints));
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showMyQr, setShowMyQr] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');

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

  // НОВОЕ: пока админ в режиме "scanning" (независимо от того, показывает ли
  // он свой QR, включил ли камеру или ждёт) — опрашиваем сервер: не
  // отсканировал ли его кто-то из участников
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

  const handleStationClick = (station: { label: string; suggestedPoints: number }) => {
    setSelectedStation(station.label);
    setPointsInput(String(station.suggestedPoints));
  };

  const handleManualSearch = async () => {
    const trimmedId = manualId.trim();
    if (!trimmedId) return;
    const fullId = `user_${trimmedId}`;

    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      try {
        await s.stop();
      } catch (e) {
        // камера уже остановлена — игнорируем
      }
    }

    await handleScanSuccess(fullId);
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
    setCameraStarted(false);
    setShowManualInput(false);
    setShowMyQr(false);
    setSelectedStation(STATIONS[0].label);
    setPointsInput(String(STATIONS[0].suggestedPoints));
    setErrorMsg('');
    setSuccessMsg('');
    setManualId('');
    setCameraError('');
    setMode('scanning');
  };

  const initials = participant?.username.slice(0, 2).toLowerCase() || '';

  return (
    <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
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
                <QRCodeSVG value={user.id} size={180} bgColor={'#ffffff'} fgColor={'#0f172a'} level={'H'} />
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
                ID участника (только цифры)
              </label>
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-2 focus-within:border-indigo-500">
                <span className="pl-3 py-2.5 text-white text-sm font-mono select-none">user_</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value.replace(/\D/g, ''))}
                  placeholder="74484074"
                  className="flex-1 bg-transparent pr-3 py-2.5 text-slate-100 text-sm font-mono outline-none"
                />
              </div>
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
  );
};

export default ScanView;