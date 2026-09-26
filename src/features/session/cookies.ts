import { Platform } from 'react-native';

type CookieManagerLike = { clearAll(useWebKit?: boolean): Promise<boolean>; flush?(): Promise<void> };

let cached: CookieManagerLike | null | undefined;

/**
 * Нативный менеджер кук. Есть только в development/production-сборке;
 * в Expo Go модуля нет — тогда просто возвращаем null, а куки всё равно
 * не переживут закрытие экрана, потому что WebView работает в режиме incognito.
 */
function getCookieManager(): CookieManagerLike | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-cookies/cookies');
    const cm: CookieManagerLike | undefined = mod?.default ?? mod;
    cached = cm && typeof cm.clearAll === 'function' ? cm : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Стирает все куки WebView на уровне ОС (включая HttpOnly). */
export async function clearNativeCookies(): Promise<boolean> {
  const cm = getCookieManager();
  if (!cm) return false;
  try {
    if (Platform.OS === 'ios') {
      await cm.clearAll(true); // WKWebsiteDataStore
      await cm.clearAll(false); // NSHTTPCookieStorage
    } else {
      await cm.clearAll();
      await cm.flush?.();
    }
    return true;
  } catch (e) {
    console.warn('[session] Не удалось очистить куки:', e);
    return false;
  }
}
