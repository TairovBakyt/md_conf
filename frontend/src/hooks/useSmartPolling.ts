import { useEffect, useRef } from 'react';

/**
 * Поллинг, который приостанавливается, пока вкладка браузера неактивна
 * (свёрнута, участник переключился на другое приложение) — экономит
 * запросы к серверу без изменения видимого поведения. При возврате
 * на вкладку сразу делает один внеочередной запрос (чтобы не ждать
 * оставшуюся часть интервала для актуальных данных), затем продолжает
 * с тем же интервалом.
 *
 * Использование — замена прямого setInterval:
 *   useSmartPolling(fetchMessages, 3000);
 * вместо:
 *   useEffect(() => { const i = setInterval(fetchMessages, 3000); return () => clearInterval(i); }, []);
 *
 * enabled=false полностью останавливает поллинг (например, пока chat закрыт).
 */
export function useSmartPolling(callback: () => void, intervalMs: number, enabled: boolean = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => callbackRef.current(), intervalMs);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        // Вернулись на вкладку — сразу подтягиваем свежие данные, не дожидаясь
        // остатка интервала, затем продолжаем поллинг с начала.
        callbackRef.current();
        start();
      }
    };

    if (document.visibilityState !== 'hidden') {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}