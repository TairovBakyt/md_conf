import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QrZoneProps {
  userId: string;
}

export const QrZone: React.FC<QrZoneProps> = ({ userId }) => {
  return (
    <div className="w-full max-w-md mx-auto mt-6 p-6 bg-slate-800/60 backdrop-blur-md border border-slate-700 rounded-2xl flex flex-col items-center shadow-xl">
      <p className="text-slate-300 text-sm text-center mb-4">
        Покажи этот QR-код волонтеру на станции для начисления баллов
      </p>
      
      {/* Белая подложка для QR, чтобы он идеально сканировался любым телефоном */}
      <div className="p-4 bg-white rounded-xl shadow-inner">
        <QRCodeSVG 
          value={userId} 
          size={180}
          bgColor={"#ffffff"}
          fgColor={"#0f172a"} // Цвет самого кода (темно-синий/черный)
          level={"H"}         // Высокий уровень избыточности (сканируется даже при царапинах на экране)
        />
      </div>
      
      <span className="text-slate-500 text-xs font-mono mt-3">ID: {userId}</span>
    </div>
  );
};