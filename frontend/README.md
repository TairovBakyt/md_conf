\# MDCONF 2026 — Quest Platform

Веб-платформа для геймификации ИТ-конференции MDCONF 2026: участники проходят квесты, зарабатывают баллы и обменивают их на призы. Волонтёры и организаторы управляют процессом через отдельную админ-панель.

## Стек

**Frontend:** React + TypeScript + Vite + Tailwind CSS
**Backend:** Node.js + Express + TypeScript
**База данных:** PostgreSQL

## Возможности

### Для участников
- Регистрация по username + 4-значный PIN
- Личный кабинет с QR-кодом (паспорт участника) и балансом баллов
- Игра-викторина **«Hardcore QA»** — 20 вопросов, таймер 20 сек на вопрос, подсветка правильного ответа при ошибке, бонус за идеальное прохождение
- Игра-филворд **«Word Researcher»** — сетка 15×15, поиск 10 ИТ-терминов, выделение слов мышкой/пальцем, показ всех слов после завершения
- Магазин призов с обменом баллов
- Отображение полученных достижений

### Для админов / волонтёров
- Сканирование QR-кода участника (камера или ручной ввод ID) для начисления баллов на станциях
- Выдача призов — список всех обменов
- Просмотр всех выданных достижений
- Включение/выключение доступа к играм для всех участников
- Управление правами администратора — любой админ может назначить другого

### Инфраструктура
- Роутинг защищён на уровне React Router (`ProtectedRoute`, `AdminRoute`) + страница 404
- Сессия сохраняется в `localStorage`, с дозагрузкой актуальных данных с сервера при каждом заходе (баллы и права админа не устаревают)
- Адрес бэкенда конфигурируется через `.env` (`VITE_API_URL`), не зашит в код
- Бэкенд разложен на модульные роуты по разделам API

## Структура проекта

```
backend/
  src/
    server.ts              — точка входа, подключение роутов
    db.ts                  — подключение к PostgreSQL
    questions.json         — вопросы викторины
    filword.json           — сетка филворда + координаты слов
    routes/
      auth.routes.ts        — /api/auth/*
      user.routes.ts        — /api/user/*
      settings.routes.ts    — /api/settings
      quiz.routes.ts        — /api/quiz/*
      filword.routes.ts     — /api/filword/*
      prizes.routes.ts      — /api/prizes/*
      admin.routes.ts       — /api/admin/*

frontend/
  src/
    App.tsx                — роутинг с защитой доступа
    config.ts               — API_URL из .env
    authorization/
      UserContext.tsx       — сессия, автообновление данных пользователя
    components/
      ActionZone.tsx, BalanceZone.tsx, QrZone.tsx
      routes/
        ProtectedRoute.tsx, AdminRoute.tsx
      admin/
        ScanView.tsx, RedemptionsView.tsx, AchievementsView.tsx
        GamesView.tsx, AdminsView.tsx
    pages/
      Auth.tsx, Dashboard.tsx, About.tsx, Prizes.tsx
      QuizGame.tsx, FilwordGame.tsx, AdminPanel.tsx, NotFound.tsx
```

## База данных

Таблицы: `users`, `quiz_sessions`, `filword_sessions`, `achievements`, `prizes`, `prize_redemptions`, `event_settings`.

Ключевые поля `users`: `id`, `username`, `pin_code`, `total_score`, `is_admin`.

## Запуск локально

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Создайте `.env` в папке `frontend` на основе `.env.example`:
```
VITE_API_URL=http://localhost:3000
```

И `.env` в папке `backend`:
```
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mdconf_db
```

## Известные технические решения / нюансы

- QR-сканер использует `facingMode: 'environment'` — библиотека `html5-qrcode` требует строку, а не объект `{ideal: ...}`
- Доступ к камере с телефона по локальной сети требует HTTPS — при тестировании использовался ngrok-туннель
- В `vite.config.ts` установлен `allowedHosts: true` для работы через внешние туннели при разработке — для продакшена стоит сузить список
- Координаты слов филворда (`wordPositions` в `filword.json`) вычислены автоматически поиском по сетке в 4 направлениях (только горизонталь/вертикаль, без диагоналей)



---

Разработано соло в интенсивном темпе за несколько дней с помощью Claude в качестве пары для код-ревью и отладки.