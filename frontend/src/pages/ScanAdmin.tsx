import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useUser } from '../authorization/UserContext';
import { API_URL } from '../config';

const SCANNER_ELEMENT_ID = 'participant-qr-reader';

type ScreenState = 'scanning' | 'need-name' | 'connecting' | 'sending' | 'success' | 'error';

function extractAdminId(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.searchParams.get('admin');
  } catch {
    // не URL — считаем, что это голый ID (старый формат QR)
    return raw || null;
  }
}

export const ScanAdmin: React.FC = () => {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [screen, setScreen] = useState<ScreenState>('scanning');
  const [adminId, setAdminId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraError, setCameraError] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  // Если ID админа уже пришёл прямо в ссылке (человек открыл QR родной камерой) —
  // камеру внутри приложения включать не нужно, сразу решаем: регистрация или передача доступа
  useEffect(() => {
    const fromUrl = searchParams.get('admin');
    if (fromUrl) {
      setAdminId(fromUrl);
      setScreen(user ? 'connecting' : 'need-name');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Резервный путь: человек уже открыл сайт и жмёт "Сканировать" —
  // камера работает внутри приложения, как раньше
  useEffect(() => {
    if (screen !== 'scanning' || adminId) return;

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
  }, [screen, adminId, user]);

  // Как только известен adminId и участник уже залогинен — сразу передаём доступ
  useEffect(() => {
    if (screen === 'connecting' && adminId && user) {
      sendRequestScan(adminId, user.id, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, adminId, user]);

  const handleScanSuccess = (decodedText: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    const id = extractAdminId(decodedText);
    if (!id) return;

    const s = scannerRef.current;
    if (s && s.getState() === Html5QrcodeScannerState.SCANNING) {
      s.stop().catch(() => {});
    }

    setAdminId(id);
    setScreen(user ? 'connecting' : 'need-name');
  };

  // skipSuccessScreen=true — сразу после первой регистрации: минуем экран
  // "Готово!" и уходим на дашборд, чтобы не путать нового участника сообщением
  // про начисление баллов, которое относится к повторному сканированию.
  const sendRequestScan = async (adminIdValue: string, participantId: string, skipSuccessScreen: boolean) => {
    setScreen('sending');
    try {
      const res = await fetch(`${API_URL}/api/admin/request-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: adminIdValue, participantId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось отправить запрос');
        setScreen('error');
        return;
      }

      if (skipSuccessScreen) {
        navigate('/dashboard');
      } else {
        setScreen('success');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const handleRegisterAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminId) return;

    setScreen('connecting');
    try {
      const res = await fetch(`${API_URL}/api/auth/quick-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Не удалось зарегистрироваться');
        setScreen('error');
        return;
      }

      setUser(data);
      await sendRequestScan(adminId, data.id, true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Сервер недоступен');
      setScreen('error');
    }
  };

  const handleRetry = () => {
    setErrorMsg('');
    setCameraError('');
    setAdminId(null);
    setScreen('scanning');
  };

  if (screen === 'need-name') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8">
        <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5 text-center">
          <span className="text-3xl block mb-3">👋</span>
          <h1 className="text-slate-100 text-lg font-semibold mb-1">Добро пожаловать!</h1>
          <p className="text-slate-400 text-sm mb-5">Как вас зовут?</p>
          <form onSubmit={handleRegisterAndConnect} className="flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Бакыт"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-3 text-slate-100 text-base placeholder-slate-500 outline-none focus:border-indigo-500"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg py-3 transition-colors"
            >
              Начать
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (screen === 'connecting' || screen === 'sending') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Секунду...</span>
      </div>
    );
  }

  if (screen === 'success') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8">
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
      </div>
    );
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8">
        <div className="text-center py-4">
          <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
          <button
            onClick={handleRetry}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // screen === 'scanning' — резервный путь через камеру внутри приложения
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 px-4 py-8">
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
              onClick={() => navigate(user ? '/dashboard' : '/auth')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Назад
            </button>
          </div>
        )}

        {!cameraError && (
          <button
            onClick={() => navigate(user ? '/dashboard' : '/auth')}
            className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            Назад
          </button>
        )}
      </div>
    </div>
  );
};

export default ScanAdmin;