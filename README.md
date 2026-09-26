# Отмечалка ИРНИТУ — web

Web-версия отмечалки: авторизация на `*.istu.edu` через реальный headless-браузер (Playwright) на сервере. Поддерживает одиночный вход по ссылке/QR и **батч-авторизацию** нескольких аккаунтов параллельно.

Локально запускается **без Docker, Postgres и Redis** — используется встроенный в Node SQLite и очередь в памяти.

## Стек

| Слой | Технология |
|------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Автоматизация | Playwright (headless Chromium) |
| База | SQLite (`node:sqlite`, встроен в Node 22+) |
| Очередь | in-memory (с ограничением параллельности) |

> Для сервера/VPS слой БД можно заменить на PostgreSQL, а очередь — на BullMQ + Redis (заготовка `docker-compose.yml` в репозитории).

## Структура

```
.
├── server/            # Backend
│   └── src/
│       ├── index.ts   # Express API (accounts, attend, batch + SSE)
│       ├── auth.ts    # Авторизация через Playwright
│       ├── queue.ts   # Очередь в памяти + воркер
│       └── db.ts      # SQLite (accounts, batch_jobs, batch_results)
├── client/            # Frontend
│   └── src/
│       ├── App.tsx
│       ├── screens/   # Home, Login, Accounts, Settings, Batch
│       └── components/
├── docker-compose.yml # (опционально) Postgres + Redis для прод-варианта
└── package.json       # npm workspaces
```

## Запуск

Нужен только **Node 22+** (проверено на v24).

```bash
npm install            # ставит server + client, затем playwright install chromium
```

В двух терминалах:

```bash
npm run dev:server     # http://localhost:3000
npm run dev:client     # http://localhost:5173 (проксирует /api на :3000)
```

Откройте `http://localhost:5173`.

Файл БД `server/istu_auth.db` создаётся автоматически при первом запуске.

### Продакшн

```bash
npm run build          # собирает client, затем компилирует server
npm start              # сервер отдаёт client/dist на http://localhost:3000
```

## API

| Метод | Путь | Назначение |
|-------|------|-----------|
| `GET` | `/api/accounts` | список аккаунтов |
| `POST` | `/api/accounts` | добавить/обновить аккаунт |
| `DELETE` | `/api/accounts/:id` | удалить аккаунт |
| `POST` | `/api/attend` | одиночная авторизация |
| `POST` | `/api/batch` | запустить батч |
| `GET` | `/api/batch/:jobId/stream` | SSE-прогресс батча |
| `GET` | `/api/batch/:jobId/results` | результаты батча |

## Разрешённые домены

Авторизация выполняется только на `marks.istu.edu` и `app.istu.edu`. Переходы за пределы `*.istu.edu` блокируются на уровне Playwright.
