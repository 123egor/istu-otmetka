import CookieCleaner from '../../../modules/cookie-cleaner';

/**
 * Стирает все куки WebView на уровне ОС (включая HttpOnly).
 * Нативный модуль есть только в development/production-сборке; в Expo Go его нет —
 * тогда возвращаем false, а куки всё равно не переживут закрытие экрана,
 * потому что WebView работает в режиме incognito.
 */
export async function clearNativeCookies(): Promise<boolean> {
  if (!CookieCleaner) return false;
  try {
    return await CookieCleaner.clearAllAsync();
  } catch (e) {
    console.warn('[session] Не удалось очистить куки:', e);
    return false;
  }
}
