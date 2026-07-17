import React from 'react';
import { CompanyInfo } from '../CompanyInfo';
import { ScheduleWidget } from '../ScheduleWidget';
import { SpeakersList } from '../SpeakersList';

export const AdminEventInfoView: React.FC = () => {
  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
        <span className="text-sm font-medium text-indigo-400">О мероприятии</span>
        <p className="text-slate-500 text-xs mt-1">
          MDCONF — ежегодная техническая конференция для разработчиков, где участники не только слушают доклады, но и проходят интерактивный квест: викторину, поиск слов и станции с заданиями, зарабатывая баллы на «паспорт» участника.

Как это работает
Зарегистрируйся и получи персональный QR-код
Проходи станции, викторину и филворд — получай баллы
Трать баллы в магазине призов в течение дня
Организатор
[сюда впишешь реальную информацию об организаторе — компания, контакты, соцсети]
        </p>
      </div>

      <CompanyInfo />
      <ScheduleWidget />
      <SpeakersList />
    </div>
  );
};

export default AdminEventInfoView;