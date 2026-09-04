import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrZoneProps {
  userId: string;
  pinCode?: string;
}

export const QrZone: React.FC<QrZoneProps> = ({ userId, pinCode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pinVisible, setPinVisible] = useState(false);

  const closeModal = () => {
    setIsOpen(false);
    setPinVisible(false);
  };

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
          onClick={closeModal}
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

            {pinCode && (
              <div className="w-full mt-4 pt-4 border-t border-slate-800">
                <p className="text-slate-400 text-[11px] text-center mb-2">
                  Данные для входа, если понадобится зайти заново вручную
                </p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-slate-500 text-xs">PIN:</span>
                  <span className="text-slate-100 text-lg font-mono tracking-widest">
                    {pinVisible ? pinCode : '••••'}
                  </span>
                  <button
                    onClick={() => setPinVisible((v) => !v)}
                    className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
                  >
                    {pinVisible ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
                <p className="text-slate-600 text-[10px] text-center mt-2">
                  Запиши или сфотографируй — вход по имени и этому PIN
                </p>
              </div>
            )}

            <button
              onClick={closeModal}
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