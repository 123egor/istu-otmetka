import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const AUTH_USER = process.env.AUTH_USER ?? 'student';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? '';

export const COOKIE_NAME = 'gate';

// Валидные сессии живут в памяти: при перезапуске сервера нужно войти заново.
const sessions = new Set<string>();

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function login(username: string, password: string): string | null {
  if (!AUTH_PASSWORD) {
    throw new Error('AUTH_PASSWORD не задан в server/.env — вход невозможен');
  }
  if (safeEqual(username, AUTH_USER) && safeEqual(password, AUTH_PASSWORD)) {
    const token = randomUUID();
    sessions.add(token);
    return token;
  }
  return null;
}

export function logout(token: string): void {
  sessions.delete(token);
}

export function getToken(req: Request): string {
  const header = req.headers.cookie;
  if (!header) return '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    const k = part.slice(0, idx).trim();
    if (k === COOKIE_NAME) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getToken(req);
  if (token && sessions.has(token)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Не авторизован' });
}
