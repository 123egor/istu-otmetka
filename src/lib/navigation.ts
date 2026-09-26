import { router } from 'expo-router';

/**
 * «Назад», если есть куда, иначе — на главный экран.
 * Нужен, когда экран открыт напрямую по deep link и истории навигации нет.
 */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
