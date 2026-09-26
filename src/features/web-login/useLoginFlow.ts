import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { LOGIN_FAIL_AFTER_MS, LOGIN_STABLE_MS, MAX_AUTO_SUBMITS, WIPE_DELAY_MS } from '@/config';
import type { Credentials } from '@/features/credentials';
import { WIPE_PAGE_STORAGE_JS, clearNativeCookies } from '@/features/session';
import { hostOf, isAllowedUrl, isLoginUrl, isNavigableUrl } from '@/lib/url';
import { MONITOR_JS, buildFillJs } from './scripts';

export type LoginPhase =
  | { kind: 'loading' }
  | { kind: 'submitting' }
  | { kind: 'manual'; message: string }
  | { kind: 'authorized' }
  | { kind: 'wiped' }
  | { kind: 'error'; message: string };

type PageState = { href: string; hasPassword: boolean };

/**
 * Логика сеанса входа в WebView:
 * следит за страницей, один раз автоматически заполняет форму,
 * определяет успешный вход и стирает сессию через WIPE_DELAY_MS.
 */
export function useLoginFlow(webRef: RefObject<WebView | null>, url: string, credentials: Credentials | null) {
  const [phase, setPhase] = useState<LoginPhase>({ kind: 'loading' });
  const [currentUrl, setCurrentUrl] = useState(url);
  const [loading, setLoading] = useState(true);

  const loadingRef = useRef(true);
  const submitsRef = useRef(0);
  const submittedAtRef = useRef(0);
  const sawLoginFormRef = useRef(false);
  const authorizedRef = useRef(false);
  const wipedRef = useRef(false);
  const lastStateRef = useRef<PageState | null>(null);
  const stableTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wipeSession = useCallback(async () => {
    if (wipedRef.current) return;
    wipedRef.current = true;
    webRef.current?.injectJavaScript(WIPE_PAGE_STORAGE_JS);
    await clearNativeCookies();
    setPhase({ kind: 'wiped' });
  }, [webRef]);

  const markAuthorized = useCallback(() => {
    if (authorizedRef.current) return;
    authorizedRef.current = true;
    setPhase({ kind: 'authorized' });
    wipeTimer.current = setTimeout(wipeSession, WIPE_DELAY_MS);
  }, [wipeSession]);

  // Сворачивание приложения после входа или уход с экрана — стираем куки.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' && authorizedRef.current) void wipeSession();
    });
    return () => {
      sub.remove();
      if (stableTimer.current) clearTimeout(stableTimer.current);
      if (wipeTimer.current) clearTimeout(wipeTimer.current);
      void clearNativeCookies();
    };
  }, [wipeSession]);

  function handleState(s: PageState) {
    lastStateRef.current = s;
    setCurrentUrl(s.href);
    if (stableTimer.current) clearTimeout(stableTimer.current);
    if (authorizedRef.current) return;

    if (s.hasPassword) {
      sawLoginFormRef.current = true;

      if (!credentials) {
        setPhase({ kind: 'manual', message: 'Введите логин и пароль на странице.' });
        return;
      }
      if (submitsRef.current < MAX_AUTO_SUBMITS && isNavigableUrl(s.href)) {
        submitsRef.current += 1;
        submittedAtRef.current = Date.now();
        setPhase({ kind: 'submitting' });
        webRef.current?.injectJavaScript(buildFillJs(credentials.login, credentials.password));
        return;
      }
      // Форма входа снова на экране после отправки — вероятно, неверный пароль.
      stableTimer.current = setTimeout(() => {
        const last = lastStateRef.current;
        if (last?.hasPassword && Date.now() - submittedAtRef.current >= LOGIN_FAIL_AFTER_MS) {
          setPhase({
            kind: 'error',
            message: 'Похоже, вход не удался — проверьте логин/пароль. Можно войти вручную на странице.',
          });
        }
      }, LOGIN_FAIL_AFTER_MS);
      return;
    }

    // Похоже на успешный вход: разрешённый сайт, не страница логина, формы пароля нет,
    // и до этого мы видели форму входа. Ждём, пока состояние устаканится.
    if (sawLoginFormRef.current && isAllowedUrl(s.href) && !isLoginUrl(s.href)) {
      const check = () => {
        if (lastStateRef.current !== s) return; // страница успела смениться
        if (loadingRef.current) {
          stableTimer.current = setTimeout(check, 500);
          return;
        }
        markAuthorized();
      };
      stableTimer.current = setTimeout(check, LOGIN_STABLE_MS);
    }
  }

  function onMessage(e: WebViewMessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    switch (msg?.type) {
      case 'state':
        handleState({ href: String(msg.href), hasPassword: !!msg.hasPassword });
        break;
      case 'submitted':
        setPhase({ kind: 'submitting' });
        break;
      case 'fill-error':
        setPhase({ kind: 'manual', message: `${msg.message} Войдите вручную на странице.` });
        break;
    }
  }

  function onShouldStartLoadWithRequest(req: ShouldStartLoadRequest): boolean {
    if (req.isTopFrame === false) return true; // встроенные фреймы (капча и т.п.)
    if (isNavigableUrl(req.url)) return true;
    setPhase({ kind: 'error', message: `Переход на посторонний адрес заблокирован: ${hostOf(req.url) || req.url}` });
    return false;
  }

  function onLoadStart() {
    loadingRef.current = true;
    setLoading(true);
  }

  function onLoadEnd() {
    loadingRef.current = false;
    setLoading(false);
    webRef.current?.injectJavaScript(MONITOR_JS);
  }

  function onError(e: WebViewErrorEvent) {
    // После заблокированного перехода iOS присылает ещё и ошибку загрузки —
    // не затираем ею более понятное сообщение о блокировке.
    setPhase((p) =>
      p.kind === 'error' ? p : { kind: 'error', message: `Страница не загрузилась: ${e.nativeEvent.description}` },
    );
  }

  return {
    phase,
    currentUrl,
    loading,
    webViewProps: {
      injectedJavaScript: MONITOR_JS,
      onMessage,
      onShouldStartLoadWithRequest,
      onLoadStart,
      onLoadEnd,
      onError,
    },
  };
}
