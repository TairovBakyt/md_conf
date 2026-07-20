import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { IconQr } from './icons';

interface QrZoneProps {
  userId: string;
}

export const QrZone: React.FC<QrZoneProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="pixel-btn w-full bg-mc-wood text-mc-cream font-medium py-3 flex items-center justify-center gap-2"
      >
        <IconQr className="w-5 h-5 shrink-0" /> Мой QR
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="pixel-panel p-6 flex flex-col items-center max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-mc-cream/80 text-xs text-center mb-4 leading-relaxed">
              Покажи этот QR-код волонтеру на станции для начисления баллов
            </p>

            <div className="pixel-badge p-4 bg-white">
              <QRCodeSVG
                value={userId}
                size={180}
                bgColor={'#ffffff'}
                fgColor={'#0f172a'}
                level={'H'}
              />
            </div>

            <span className="text-mc-cream/50 text-[10px] font-mono mt-3">ID: {userId}</span>

            <button
              onClick={() => setIsOpen(false)}
              className="pixel-btn w-full mt-5 bg-mc-panel-light text-mc-cream font-medium py-2.5 text-xs"
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
