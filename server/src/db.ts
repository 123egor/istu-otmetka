import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.SQLITE_PATH ?? path.join(__dirname, '..', 'istu_auth.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL DEFAULT 'Аккаунт',
  login      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS batch_jobs (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  concurrency INTEGER NOT NULL DEFAULT 5,
  total       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS batch_results (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id     TEXT REFERENCES batch_jobs(id) ON DELETE CASCADE,
  login      TEXT NOT NULL,
  status     TEXT NOT NULL,
  result_url TEXT,
  page_title TEXT,
  message    TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`;

export async function initDb(): Promise<void> {
  db.exec(SCHEMA);
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export type Account = { id: number; name: string; login: string; password: string };

export async function getAccounts(): Promise<Account[]> {
  return db.prepare('SELECT id, name, login, password FROM accounts ORDER BY id').all() as unknown as Account[];
}

export async function getAccountById(id: number): Promise<Account | null> {
  return (db.prepare('SELECT id, name, login, password FROM accounts WHERE id = ?').get(id) as unknown as Account) ?? null;
}

export async function upsertAccount(name: string, login: string, password: string): Promise<Account> {
  db.prepare(
    `INSERT INTO accounts (name, login, password) VALUES (?, ?, ?)
     ON CONFLICT (login) DO UPDATE SET name = excluded.name, password = excluded.password`,
  ).run(name, login, password);
  return db.prepare('SELECT id, name, login, password FROM accounts WHERE login = ?').get(login) as unknown as Account;
}

export async function deleteAccount(id: number): Promise<void> {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
}

// ─── Batch jobs ───────────────────────────────────────────────────────────────

export type BatchJobRow = {
  id: string; url: string; concurrency: number; total: number;
  created_at: string; finished_at: string | null;
};

export async function createBatchJob(url: string, concurrency: number, total: number): Promise<string> {
  const id = randomUUID();
  db.prepare('INSERT INTO batch_jobs (id, url, concurrency, total) VALUES (?, ?, ?, ?)').run(id, url, concurrency, total);
  return id;
}

export async function finishBatchJob(id: string): Promise<void> {
  db.prepare("UPDATE batch_jobs SET finished_at = datetime('now') WHERE id = ?").run(id);
}

export async function getBatchJobs(): Promise<BatchJobRow[]> {
  return db.prepare('SELECT * FROM batch_jobs ORDER BY created_at DESC LIMIT 50').all() as unknown as BatchJobRow[];
}

// ─── Batch results ──────────────────────────────────────────────────────────────

export type BatchResultRow = {
  id: number; job_id: string; login: string; status: string;
  result_url: string | null; page_title: string | null; message: string | null; created_at: string;
};

export async function insertBatchResult(
  jobId: string,
  login: string,
  status: string,
  resultUrl?: string,
  pageTitle?: string,
  message?: string,
): Promise<void> {
  db.prepare(
    'INSERT INTO batch_results (job_id, login, status, result_url, page_title, message) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(jobId, login, status, resultUrl ?? null, pageTitle ?? null, message ?? null);
}

export async function getBatchResults(jobId: string): Promise<BatchResultRow[]> {
  return db.prepare('SELECT * FROM batch_results WHERE job_id = ? ORDER BY id').all(jobId) as unknown as BatchResultRow[];
}

export async function countBatchResults(jobId: string): Promise<number> {
  const row = db.prepare('SELECT COUNT(*) AS c FROM batch_results WHERE job_id = ?').get(jobId) as { c: number };
  return row.c;
}
