import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';

const SCANNER_ELEMENT_ID = 'participant-qr-reader';

type ScreenState = 'scanning' | 'sending' | 'success' | 'error';

export const ScanAdmin: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<ScreenState>('scanning');
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraError, setCameraError] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  

useEffect(() => {
  if (!user) {
    navigate('/auth');
    return;
  }

  if (screen !== 'scanning') return;

  let cancelled = false;
  isProcessingRef.current = false;
  setCameraError('');

  const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
  scannerRef.current = scanner;

  scanner
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        if (!cancelled) handleScanSuccess(decodedText);
      },
      () => {
        // ошибки отдельных кадров игнорируем — камера сканирует непрерывно
      }
    )
    .then(() => {
      // Если cleanup успел сработать раньше, чем камера реально запустилась —
      // сразу останавливаем этот "лишний" инстанс
      if (cancelled) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    })
    .catch((err) => {
      if (!cancelled) {
        console.error(err);
        setCameraError('Не удалось получить доступ к камере');
      }
    });

  return () => {
    cancelled = true;
    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      s.stop().then(() => s.clear()).catch(() => {});
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [screen, user]);

  const handleScanSuccess = async (scannedAdminId: string) => {
    if (isProcessingRef.current || !user) return;
    isProcessingRef.current = true;

    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      try {
        await s.stop();
      } catch (e) {
        // камера уже остановлена
      }
    }

    setScreen('sending');

    try {
      const res = await fetch(`${API_URL}/api/admin/request-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: scannedAdminId, participantId: user.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось отправить запрос');
        setScreen('error');
        return;
      }

      setScreen('success');
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const handleRetry = () => {
    setErrorMsg('');
    setCameraError('');
    setScreen('scanning');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8">
{screen === 'scanning' && (
  <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5">
    <p className="text-slate-300 text-sm text-center mb-4">
      Наведи камеру на QR-код организатора
    </p>

    {!cameraError && <div id={SCANNER_ELEMENT_ID} className="rounded-xl overflow-hidden" />}
    {cameraError && <div id={SCANNER_ELEMENT_ID} className="rounded-xl overflow-hidden hidden" />}

    {cameraError && (
      <div className="text-center py-4">
        <p className="text-xs text-amber-400 mb-3">{cameraError}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          Вернуться в профиль
        </button>
      </div>
    )}

    {!cameraError && (
      <button
        onClick={() => navigate('/dashboard')}
        className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
      >
        Назад
      </button>
    )}
  </div>
)}

      {screen === 'sending' && (
        <div className="text-center text-slate-400 text-sm py-8">Отправляем запрос...</div>
      )}

      {screen === 'success' && (
        <div className="text-center py-4">
          <span className="text-3xl block mb-3">✅</span>
          <p className="text-emerald-400 text-sm font-medium mb-4">
            Готово! Подойди к организатору — он увидит твой профиль и начислит баллы
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            Вернуться в профиль
          </button>
        </div>
      )}

      {screen === 'error' && (
        <div className="text-center py-4">
          <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
          <button
            onClick={handleRetry}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
};

export default ScanAdmin;