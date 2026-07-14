import React from 'react';

export const DocsView: React.FC = () => {
  return (
    <div className="w-full max-w-sm bg-slate-950 rounded-2xl p-5 space-y-5">
      <div>
        <h2 className="text-indigo-400 text-sm font-semibold mb-2">Сканирование</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          Три способа найти участника: отсканировать его QR-код камерой, ввести его ID вручную, либо показать участнику свой QR — он сам отсканирует его на своём телефоне, и его профиль появится здесь автоматически (в течение ~2 секунд). После выбора профиля выбери станцию (или введи баллы вручную) и нажми «Начислить».
        </p>
      </div>

      <div>
        <h2 className="text-indigo-400 text-sm font-semibold mb-2">Станции и баллы</h2>
        <ul className="text-slate-400 text-xs leading-relaxed space-y-1.5 list-disc list-inside">
          <li><strong className="text-slate-300">Ст.1 Hardcore QA</strong> — баллы начисляются автоматически внутри викторины</li>
          <li><strong className="text-slate-300">Ст.2 Word Researcher</strong> — баллы начисляются автоматически внутри филворда</li>
          <li><strong className="text-slate-300">Ст.3 Instagram / LinkedIn</strong> — по 5 баллов за подписку, начисляй вручную после проверки</li>
          <li><strong className="text-slate-300">Ст.4 Сториз</strong> — 15 баллов за выложенную Stories с тегом</li>
          <li><strong className="text-slate-300">Ст.5 Тимбилдинг</strong> — 15 баллов за победу, 5 баллов за участие без победы</li>
        </ul>
      </div>

      <div>
        <h2 className="text-indigo-400 text-sm font-semibold mb-2">Игры (вкладка «Игры»)</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          Для каждой игры (Викторина и Филворд) сначала нажми «Открыть для всех» — участники увидят комнату ожидания и счётчик присоединившихся. Когда все готовы, нажми «Начать отсчёт для всех» — игра стартует одновременно у всех участников. По завершении жми «Завершить и вернуть всех», чтобы закрыть игру и вернуть участников в личный кабинет.
        </p>
        <p className="text-amber-400 text-xs leading-relaxed mt-2">
          Не открывай обе игры одновременно — участник может быть автоматически переброшен из одной игры сразу в другую без паузы. Проводи их по очереди.
        </p>
      </div>

      <div>
        <h2 className="text-indigo-400 text-sm font-semibold mb-2">Выдача призов</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          Здесь отображается история всех выданных призов — кто и что получил, в каком порядке.
        </p>
      </div>

      <div>
        <h2 className="text-indigo-400 text-sm font-semibold mb-2">Достижения</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          Список всех начисленных достижений (например, «Senior Developer» за идеальное прохождение викторины).
        </p>
      </div>

      <div>
        <h2 className="text-indigo-400 text-sm font-semibold mb-2">Администраторы</h2>
        <p className="text-slate-400 text-xs leading-relaxed">
          Назначай или снимай права администратора у участников по их ID. Будь осторожен — у назначенного администратора появится полный доступ к этой панели.
        </p>
      </div>
    </div>
  );
};

export default DocsView;