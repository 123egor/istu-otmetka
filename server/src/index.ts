import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { authorize, closeBrowser } from './auth.js';
import { login as gateLogin, logout as gateLogout, requireAuth, getToken, COOKIE_NAME } from './gate.js';
import { authQueue, startWorker, waitForBatchFinish } from './queue.js';
import {
  initDb,
  getAccounts,
  getAccountById,
  upsertAccount,
  deleteAccount,
  createBatchJob,
  getBatchJobs,
  getBatchResults,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.use(express.json());

// Статика клиента (prod: dist/client, dev: Express не трогает — Vite запускается отдельно)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// ─── Гейт: вход в приложение ────────────────────────────────────────────────────

// Публичный маршрут — регистрируется ДО requireAuth, поэтому не требует токена.
app.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  try {
    const token = gateLogin(String(username ?? ''), String(password ?? ''));
    if (!token) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000, // 12 часов
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Ошибка входа' });
  }
});

app.post('/api/logout', (req: Request, res: Response) => {
  const token = getToken(req);
  if (token) gateLogout(token);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// Всё, что зарегистрировано НИЖЕ, требует валидную сессию.
app.use('/api', requireAuth);

// Проверка сессии для клиента
app.get('/api/me', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ─── Аккаунты ─────────────────────────────────────────────────────────────────

app.get('/api/accounts', async (_req, res) => {
  const accounts = await getAccounts();
  // Пароль не возвращаем клиенту (только маску)
  res.json(accounts.map((a) => ({ id: a.id, name: a.name, login: a.login, hasPassword: true })));
});

app.post('/api/accounts', async (req: Request, res: Response) => {
  const { name, login, password } = req.body as { name?: string; login?: string; password?: string };
  if (!login?.trim() || !password?.trim()) {
    res.status(400).json({ error: 'Нужны login и password' });
    return;
  }
  const a = await upsertAccount(name?.trim() || 'Аккаунт', login.trim(), password.trim());
  res.json({ id: a.id, name: a.name, login: a.login });
});

app.delete('/api/accounts/:id', async (req: Request, res: Response) => {
  await deleteAccount(Number(req.params.id));
  res.json({ ok: true });
});

// ─── Одиночная авторизация ────────────────────────────────────────────────────

app.post('/api/attend', async (req: Request, res: Response) => {
  const { accountId, login, password, url } = req.body as {
    accountId?: number;
    login?: string;
    password?: string;
    url?: string;
  };
  if (!url) {
    res.status(400).json({ error: 'Нужен url' });
    return;
  }

  let useLogin = login;
  let usePassword = password;

  // Сохранённый аккаунт: пароль берём из БД, клиент его не присылает
  if (accountId != null) {
    const acc = await getAccountById(Number(accountId));
    if (!acc) {
      res.status(400).json({ error: 'Аккаунт не найден' });
      return;
    }
    useLogin = acc.login;
    usePassword = acc.password;
  }

  if (!useLogin || !usePassword) {
    res.status(400).json({ error: 'Нужны accountId или login+password' });
    return;
  }

  const result = await authorize(useLogin, usePassword, url);
  res.json(result);
});

// ─── Батч-авторизация ─────────────────────────────────────────────────────────

// Создать новый батч-джоб, поставить задачи в очередь
app.post('/api/batch', async (req: Request, res: Response) => {
  const { accountIds, url, concurrency = 5 } = req.body as {
    accountIds?: number[];
    url?: string;
    concurrency?: number;
  };
  if (!Array.isArray(accountIds) || accountIds.length === 0 || !url) {
    res.status(400).json({ error: 'Нужны accountIds[] и url' });
    return;
  }

  const accounts = await getAccounts();
  const selected = accounts.filter((a) => (accountIds as number[]).includes(a.id));
  if (selected.length === 0) {
    res.status(400).json({ error: 'Аккаунты не найдены' });
    return;
  }

  const safeConc = Math.min(Math.max(Number(concurrency), 1), 20);
  const jobId = await createBatchJob(url, safeConc, selected.length);

  await Promise.all(
    selected.map((a) =>
      authQueue.add(`auth-${a.login}`, {
        jobId,
        login: a.login,
        password: a.password,
        url,
        total: selected.length,
      }),
    ),
  );

  // Запускаем воркер если ещё не запущен
  startWorker(safeConc);
  void waitForBatchFinish(jobId, selected.length);

  res.json({ jobId, total: selected.length });
});

// SSE: прогресс батча в реальном времени
app.get('/api/batch/:jobId/stream', (req: Request, res: Response) => {
  const jobId = String(req.params.jobId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function send(data: object) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Сначала отдаём уже готовые результаты
  getBatchResults(jobId).then((rows) => {
    for (const r of rows) send({ type: 'result', ...r });
  });

  // Polling раз в секунду (можно заменить на Redis pub/sub)
  let lastCount = 0;
  const interval = setInterval(async () => {
    const rows = await getBatchResults(jobId);
    for (let i = lastCount; i < rows.length; i++) {
      send({ type: 'result', ...rows[i] });
    }
    lastCount = rows.length;

    const jobs = await getBatchJobs();
    const job = jobs.find((j) => j.id === jobId);
    if (job?.finished_at) {
      send({ type: 'finish', total: job.total });
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// Результаты завершённого батча
app.get('/api/batch/:jobId/results', async (req: Request, res: Response) => {
  res.json(await getBatchResults(String(req.params.jobId)));
});

// Список батч-джобов
app.get('/api/batch', async (_req, res) => {
  res.json(await getBatchJobs());
});

// ─── Fallback SPA ─────────────────────────────────────────────────────────────

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function main() {
  await initDb();
  createServer(app).listen(PORT, () => {
    console.log(`✓ Отмечалка ИРНИТУ — http://localhost:${PORT}`);
  });

  process.on('SIGTERM', async () => {
    await closeBrowser();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
