import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { IconCheck, IconLock, IconEmptySquare } from './icons';

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

export const StationProgress: React.FC<StationProgressProps> = ({ userId, isQuizPassed }) => {
  const [filwordPassed, setFilwordPassed] = useState(false);
  const [manualStations, setManualStations] = useState<StationStatus[]>([]);
  const [quizPoints, setQuizPoints] = useState(0);
  const [filwordPoints, setFilwordPoints] = useState(0);
  const [gameUnlocked, setGameUnlocked] = useState<GameUnlockState>({
    quiz_unlocked: false,
    filword_unlocked: false,
  });

  useEffect(() => {
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

    fetchFilwordStatus();
    fetchManualStations();
    fetchGameSettings();
    const interval = setInterval(() => {
      fetchFilwordStatus();
      fetchManualStations();
      fetchGameSettings();
    }, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const quizLocked = !isQuizPassed && !gameUnlocked.quiz_unlocked;
  const filwordLocked = !filwordPassed && !gameUnlocked.filword_unlocked;

  return (
    <div className="pixel-panel p-4">
      <p className="text-mc-cream/60 text-[10px] font-medium uppercase tracking-wider mb-3">
        Прогресс по станциям
      </p>

      <div className="flex flex-col gap-2">
        <div className="pixel-tile flex items-center gap-2.5 p-2.5">
          <span className={`shrink-0 ${isQuizPassed ? 'text-mc-emerald' : 'text-mc-cream/30'}`}>
            {isQuizPassed ? <IconCheck className="w-4 h-4" /> : quizLocked ? <IconLock className="w-4 h-4" /> : <IconEmptySquare className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className={`text-[10px] truncate ${isQuizPassed ? 'text-mc-cream' : 'text-mc-cream/50'}`}>
              2. Hardcore QA
            </p>
            {isQuizPassed ? (
              <p className="text-[9px] text-mc-emerald/80">Пройдена · +{quizPoints} баллов</p>
            ) : quizLocked ? (
              <p className="text-[9px] text-mc-cream/30">Закрыта</p>
            ) : null}
          </div>
        </div>

        <div className="pixel-tile flex items-center gap-2.5 p-2.5">
          <span className={`shrink-0 ${filwordPassed ? 'text-mc-emerald' : 'text-mc-cream/30'}`}>
            {filwordPassed ? <IconCheck className="w-4 h-4" /> : filwordLocked ? <IconLock className="w-4 h-4" /> : <IconEmptySquare className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <p className={`text-[10px] truncate ${filwordPassed ? 'text-mc-cream' : 'text-mc-cream/50'}`}>
              4. Word Researcher
            </p>
            {filwordPassed ? (
              <p className="text-[9px] text-mc-emerald/80">Пройдена · +{filwordPoints} баллов</p>
            ) : filwordLocked ? (
              <p className="text-[9px] text-mc-cream/30">Закрыта</p>
            ) : null}
          </div>
        </div>

        {manualStations.map((station) => {
          const title = MANUAL_STATION_TITLES[station.stationNumber] ?? `Станция ${station.stationNumber}`;
          const isObjectHunt = station.stationNumber === OBJECT_HUNT_STATION;

          let icon = <IconEmptySquare className="w-4 h-4" />;
          let statusText = 'Отмечает организатор';
          let titleClass = 'text-mc-cream/50';

          if (station.completed) {
            icon = <IconCheck className="w-4 h-4" />;
            titleClass = 'text-mc-cream';
            if (isObjectHunt) {
              statusText = `Найдено ${station.count} из ${OBJECT_HUNT_TOTAL} · +${station.points} баллов`;
            } else {
              statusText =
                station.count > 1
                  ? `Пройдена · +${station.points} баллов (${station.count} раз)`
                  : `Пройдена · +${station.points} баллов`;
            }
          } else if (!station.unlocked) {
            icon = <IconLock className="w-4 h-4" />;
            statusText = 'Закрыта';
          } else {
            icon = <IconEmptySquare className="w-4 h-4" />;
            statusText = isObjectHunt ? `Найдено 0 из ${OBJECT_HUNT_TOTAL}` : 'Отмечает организатор';
          }

          return (
            <div key={station.stationNumber} className="pixel-tile flex items-center gap-2.5 p-2.5">
              <span className={`shrink-0 ${station.completed ? 'text-mc-emerald' : 'text-mc-cream/30'}`}>{icon}</span>
              <div className="min-w-0">
                <p className={`text-[10px] truncate ${titleClass}`}>
                  {station.stationNumber}. {title}
                </p>
                <p className={`text-[9px] ${station.completed ? 'text-mc-emerald/80' : 'text-mc-cream/30'}`}>
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

export default StationProgress;