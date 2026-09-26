import type { Account, BatchResultRow } from './types';

const BASE = '/api';

// Колбэк, вызываемый при 401 (сессия истекла) — App показывает экран входа.
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

async function handle<T>(r: Response): Promise<T> {
  if (r.status === 401) {
    onUnauthorized?.();
    throw new Error('Сессия истекла — войдите заново');
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error((err as { error: string }).error ?? r.statusText);
  }
  return r.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  return handle<T>(r);
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path, { credentials: 'same-origin' });
  return handle<T>(r);
}

async function del(path: string): Promise<void> {
  const r = await fetch(BASE + path, { method: 'DELETE', credentials: 'same-origin' });
  await handle<{ ok: boolean }>(r);
}

// ─── Гейт ─────────────────────────────────────────────────────────────────────

export function login(username: string, password: string): Promise<{ ok: boolean }> {
  return post('/login', { username, password });
}

export function logout(): Promise<{ ok: boolean }> {
  return post('/logout', {});
}

export async function checkAuth(): Promise<boolean> {
  try {
    const r = await fetch(BASE + '/me', { credentials: 'same-origin' });
    return r.ok;
  } catch {
    return false;
  }
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export function getAccounts(): Promise<Account[]> {
  return get('/accounts');
}

export function upsertAccount(name: string, login: string, password: string): Promise<Account> {
  return post('/accounts', { name, login, password });
}

export function deleteAccount(id: number): Promise<void> {
  return del(`/accounts/${id}`);
}

// ─── Batch ────────────────────────────────────────────────────────────────────

export function startBatch(accountIds: number[], url: string, concurrency: number): Promise<{ jobId: string; total: number }> {
  return post('/batch', { accountIds, url, concurrency });
}

export function getBatchResults(jobId: string): Promise<BatchResultRow[]> {
  return get(`/batch/${jobId}/results`);
}

export function streamBatch(
  jobId: string,
  onResult: (row: BatchResultRow) => void,
  onFinish: (total: number) => void,
): () => void {
  // EventSource шлёт cookie автоматически (same-origin), токен в URL не нужен.
  const es = new EventSource(`/api/batch/${jobId}/stream`);
  es.onmessage = (e) => {
    const data = JSON.parse(e.data as string) as { type: string } & Record<string, unknown>;
    if (data.type === 'result') onResult(data as unknown as BatchResultRow);
    if (data.type === 'finish') {
      onFinish(data.total as number);
      es.close();
    }
  };
  return () => es.close();
}
