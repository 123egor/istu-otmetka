npm run dev:serverЭто web-приложение (монорепо на npm workspaces): `server/` (Node.js + Express + TypeScript) и `client/` (React + Vite + TypeScript).

## Стек

- **Backend**: Node.js 22+, Express, TypeScript (ESM). Запуск через `tsx`.
- **Автоматизация браузера**: Playwright (headless Chromium). Вся авторизация на `*.istu.edu` идёт через реальный браузерный контекст, не через голые HTTP-запросы.
- **База**: SQLite через встроенный модуль `node:sqlite` (без нативной компиляции). Файл `server/istu_auth.db`. SQL напрямую, без ORM.
- **Очередь**: in-memory (`server/src/queue.ts`) с ограничением параллельности. Redis/BullMQ намеренно не используются локально.
- **Frontend**: React 19 + Vite. Стили — инлайн через объекты стилей и `theme.ts`, без CSS-фреймворков. UI mobile-first.

Локально ничего внешнего (Docker/Postgres/Redis) не требуется — только Node.

## Команды

```bash
npm install          # ставит оба workspace + playwright install chromium
npm run dev:server   # backend на :3000
npm run dev:client   # frontend на :5173 (проксирует /api)
npm run build        # client build + server tsc
npm run typecheck    # проверка типов обоих пакетов
```

Перед завершением задачи прогоняй `npm run typecheck`.

## Правила

- Разрешённые для авторизации домены — только `marks.istu.edu` и `app.istu.edu`. Не расширяй список без явной просьбы.
- Секреты и настройки — через `.env` (пример в `server/.env.example`), не хардкодить.
- Логику авторизации (`server/src/auth.ts`) меняй осторожно: она повторяет поведение исходного мобильного WebView (ожидание формы, заполнение полей React-совместимым способом, определение успеха по URL и отсутствию поля пароля).
- Frontend не обращается к ISTU напрямую — только через `/api/*` к своему серверу.
- Если переводишь на прод-инфраструктуру (Postgres + Redis) — держи тот же интерфейс модулей `db.ts` и `queue.ts`, чтобы `index.ts` не менялся.
