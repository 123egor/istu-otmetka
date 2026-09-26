import { requireOptionalNativeModule } from 'expo';

type CookieCleanerModule = {
  /** Стирает все куки WebView (включая HttpOnly) и данные сайтов. */
  clearAllAsync(): Promise<boolean>;
};

// null в Expo Go: там нативного модуля нет.
export default requireOptionalNativeModule<CookieCleanerModule>('CookieCleaner');
