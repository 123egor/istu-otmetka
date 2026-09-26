import { ALLOWED_HOSTS, LOGIN_PATH_MARKER, NAV_HOST_SUFFIX } from '@/config';

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Ссылка ведёт на разрешённый сайт (https + marks/app.istu.edu). */
export function isAllowedUrl(url: string): boolean {
  const u = parse(url);
  return !!u && u.protocol === 'https:' && (ALLOWED_HOSTS as readonly string[]).includes(u.hostname);
}

/** Можно ли WebView переходить на этот адрес во время входа (*.istu.edu по https). */
export function isNavigableUrl(url: string): boolean {
  if (url === 'about:blank') return true;
  const u = parse(url);
  if (!u || u.protocol !== 'https:') return false;
  return u.hostname === NAV_HOST_SUFFIX || u.hostname.endsWith('.' + NAV_HOST_SUFFIX);
}

export function isLoginUrl(url: string): boolean {
  return url.includes(LOGIN_PATH_MARKER);
}

export type ExtractResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * Достаёт ссылку из произвольного текста (содержимое QR или буфера обмена)
 * и проверяет домен.
 */
export function extractAllowedUrl(raw: string): ExtractResult {
  const text = (raw ?? '').trim();
  if (!text) return { ok: false, reason: 'Пусто — нет ссылки.' };

  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  const candidate = match ? match[0].replace(/[),.;]+$/, '') : text;

  const u = parse(candidate);
  if (!u) return { ok: false, reason: 'Это не похоже на ссылку.' };
  if (u.protocol !== 'https:') return { ok: false, reason: 'Ссылка должна начинаться с https://' };
  if (!(ALLOWED_HOSTS as readonly string[]).includes(u.hostname)) {
    return {
      ok: false,
      reason: `Домен «${u.hostname}» не разрешён. Разрешены: ${ALLOWED_HOSTS.join(', ')}.`,
    };
  }
  return { ok: true, url: u.toString() };
}

export function hostOf(url: string): string {
  return parse(url)?.hostname ?? '';
}
