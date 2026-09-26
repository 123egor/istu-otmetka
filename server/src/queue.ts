import { authorize } from './auth.js';
import { insertBatchResult, finishBatchJob, countBatchResults } from './db.js';

export type AuthJobData = {
  jobId: string;
  login: string;
  password: string;
  url: string;
  total: number;
};

type QueueJob = { name: string; data: AuthJobData };

const jobs: QueueJob[] = [];
let running = false;
let concurrency = 5;
let active = 0;

// Очередь в памяти. Для сервера/VPS можно заменить на BullMQ + Redis.
export const authQueue = {
  add(name: string, data: AuthJobData): Promise<void> {
    jobs.push({ name, data });
    pump();
    return Promise.resolve();
  },
};

export function startWorker(c = 5): void {
  concurrency = Math.min(Math.max(c, 1), 20);
  running = true;
  pump();
}

function pump(): void {
  if (!running) return;
  while (active < concurrency && jobs.length > 0) {
    const job = jobs.shift()!;
    active++;
    void processJob(job).finally(() => {
      active--;
      pump();
    });
  }
}

async function processJob(job: QueueJob): Promise<void> {
  const { jobId, login, password, url } = job.data;
  try {
    const result = await authorize(login, password, url);
    await insertBatchResult(jobId, login, result.status, result.url, result.pageTitle, result.message);
  } catch (e: any) {
    await insertBatchResult(jobId, login, 'error', undefined, undefined, e?.message ?? 'Ошибка воркера');
  }
}

// Ждёт, пока все задачи батча запишут результат, и помечает джоб завершённым.
export async function waitForBatchFinish(jobId: string, total: number): Promise<void> {
  const check = setInterval(async () => {
    const done = await countBatchResults(jobId);
    if (done >= total) {
      clearInterval(check);
      await finishBatchJob(jobId);
    }
  }, 1000);
}
