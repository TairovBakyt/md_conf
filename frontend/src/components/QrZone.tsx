import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrZoneProps {
  userId: string;
}

export const QrZone: React.FC<QrZoneProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-2xl py-3 transition-colors flex items-center justify-center gap-2"
      >
        📱 Мой QR
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 flex flex-col items-center max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-slate-300 text-sm text-center mb-4">
              Покажи этот QR-код волонтеру на станции для начисления баллов
            </p>

            <div className="p-4 bg-white rounded-xl shadow-inner">
              <QRCodeSVG
                value={userId}
                size={180}
                bgColor={'#ffffff'}
                fgColor={'#0f172a'}
                level={'H'}
              />
            </div>

            <span className="text-slate-500 text-xs font-mono mt-3">ID: {userId}</span>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full mt-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default QrZone;