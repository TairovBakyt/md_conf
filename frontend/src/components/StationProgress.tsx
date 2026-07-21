import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { useSmartPolling } from '../hooks/useSmartPolling';

interface StationProgressProps {
  userId: string;
  isQuizPassed: boolean;
}

const MANUAL_STATION_TITLES: Record<number, string> = {
  1: 'Digital Subscriptions',
  3: 'Сториз-шеринг',
  5: 'Поиск объектов',
  6: 'Игра Азамата',
};

const OBJECT_HUNT_STATION = 5;
const OBJECT_HUNT_TOTAL = 6;

interface StationStatus {
  stationNumber: number;
  completed: boolean;
  points: number;
  count: number;
  unlocked: boolean;
}

interface GameUnlockState {
  quiz_unlocked: boolean;
  filword_unlocked: boolean;
}

const StationProgressComponent: React.FC<StationProgressProps> = ({ userId, isQuizPassed }) => {
  const [filwordPassed, setFilwordPassed] = useState(false);
  const [manualStations, setManualStations] = useState<StationStatus[]>([]);
  const [quizPoints, setQuizPoints] = useState(0);
  const [filwordPoints, setFilwordPoints] = useState(0);
  const [gameUnlocked, setGameUnlocked] = useState<GameUnlockState>({
    quiz_unlocked: false,
    filword_unlocked: false,
  });

  const fetchFilwordStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/filword/status/${userId}`);
      const data = await res.json();
      if (res.ok) setFilwordPassed(data.passed);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchManualStations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stations/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setManualStations(data.stations);
        setQuizPoints(data.quizPoints ?? 0);
        setFilwordPoints(data.filwordPoints ?? 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Нужно, чтобы показывать "Закрыта" для викторины/филворда, если они
  // ещё не пройдены и сейчас не открыты админом — иначе непройденная
  // игра выглядит одинаково независимо от её реального статуса.
  const fetchGameSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const data = await res.json();
      if (res.ok) {
        setGameUnlocked({
          quiz_unlocked: !!data.quiz_unlocked,
          filword_unlocked: !!data.filword_unlocked,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAll = () => {
    fetchFilwordStatus();
    fetchManualStations();
    fetchGameSettings();
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useSmartPolling(fetchAll, 8000);

  const quizLocked = !isQuizPassed && !gameUnlocked.quiz_unlocked;
  const filwordLocked = !filwordPassed && !gameUnlocked.filword_unlocked;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">
        Прогресс по станциям
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 bg-slate-900 rounded-lg p-2.5">
          <span className={`text-sm ${isQuizPassed ? 'text-emerald-400' : 'text-slate-600'}`}>
            {isQuizPassed ? '✅' : quizLocked ? '🔒' : '⬜'}
          </span>
          <div className="min-w-0">
            <p className={`text-xs truncate ${isQuizPassed ? 'text-slate-200' : 'text-slate-500'}`}>
              2. Hardcore QA
            </p>
            {isQuizPassed ? (
              <p className="text-[10px] text-emerald-500/80">Пройдена · +{quizPoints} баллов</p>
            ) : quizLocked ? (
              <p className="text-[10px] text-slate-600">Закрыта</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-900 rounded-lg p-2.5">
          <span className={`text-sm ${filwordPassed ? 'text-emerald-400' : 'text-slate-600'}`}>
            {filwordPassed ? '✅' : filwordLocked ? '🔒' : '⬜'}
          </span>
          <div className="min-w-0">
            <p className={`text-xs truncate ${filwordPassed ? 'text-slate-200' : 'text-slate-500'}`}>
              4. Word Researcher
            </p>
            {filwordPassed ? (
              <p className="text-[10px] text-emerald-500/80">Пройдена · +{filwordPoints} баллов</p>
            ) : filwordLocked ? (
              <p className="text-[10px] text-slate-600">Закрыта</p>
            ) : null}
          </div>
        </div>

        {manualStations.map((station) => {
          const title = MANUAL_STATION_TITLES[station.stationNumber] ?? `Станция ${station.stationNumber}`;
          const isObjectHunt = station.stationNumber === OBJECT_HUNT_STATION;

          let icon = '🔲';
          let statusText = 'Отмечает организатор';
          let titleClass = 'text-slate-500';

          if (station.completed) {
            icon = '✅';
            titleClass = 'text-slate-200';
            if (isObjectHunt) {
              statusText = `Найдено ${station.count} из ${OBJECT_HUNT_TOTAL} · +${station.points} баллов`;
            } else {
              statusText =
                station.count > 1
                  ? `Пройдена · +${station.points} баллов (${station.count} раз)`
                  : `Пройдена · +${station.points} баллов`;
            }
          } else if (!station.unlocked) {
            icon = '🔒';
            statusText = 'Закрыта';
          } else {
            icon = '🔲';
            statusText = isObjectHunt ? `Найдено 0 из ${OBJECT_HUNT_TOTAL}` : 'Отмечает организатор';
          }

          return (
            <div key={station.stationNumber} className="flex items-center gap-2.5 bg-slate-900 rounded-lg p-2.5">
              <span className={`text-sm ${station.completed ? 'text-emerald-400' : 'text-slate-600'}`}>{icon}</span>
              <div className="min-w-0">
                <p className={`text-xs truncate ${titleClass}`}>
                  {station.stationNumber}. {title}
                </p>
                <p className={`text-[10px] ${station.completed ? 'text-emerald-500/80' : 'text-slate-600'}`}>
                  {statusText}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const StationProgress = React.memo(StationProgressComponent);

export default StationProgress;