import { chromium, type Browser, type BrowserContext } from 'playwright';

const ALLOWED_HOSTS = ['marks.istu.edu', 'app.istu.edu'];
const LOGIN_PATH = '/esia/login';
const NAV_SUFFIX = 'istu.edu';
const FILL_WAIT_MS = 15_000;

export type AuthStatus =
  | 'success' // вход выполнен И отметка прошла («Вас отметили»)
  | 'not_marked' // вход выполнен, но метка не сработала («Ой, нерабочая метка»)
  | 'unknown' // вход выполнен, но результат отметки не распознан
  | 'wrong_credentials'
  | 'error'
  | 'timeout';

export type AuthResult = {
  status: AuthStatus;
  url?: string;
  pageTitle?: string;
  pageText?: string;
  message?: string;
};

let _browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  await _browser?.close();
  _browser = null;
}

function isAllowedHost(url: string): boolean {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isLoginUrl(url: string): boolean {
  return url.includes(LOGIN_PATH);
}

function isNavigableHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === NAV_SUFFIX || h.endsWith('.' + NAV_SUFFIX);
  } catch {
    return false;
  }
}

// Определяет по тексту страницы, прошла ли отметка.
// Маркеры основаны на реальном тексте ИРНИТУ: «Вас отметили» / «Ой, нерабочая метка».
function classifyMark(text: string): 'success' | 'not_marked' | 'unknown' {
  const s = text.toLowerCase();
  if (/нерабоч|недействительн|устарел|истёк|истек|не найдена|ошибк/.test(s)) return 'not_marked';
  if (/отмети|отмечен|зафиксир|учтён|учтен|засчит|успешно/.test(s)) return 'success';
  return 'unknown';
}

async function readMarkResult(page: import('playwright').Page): Promise<AuthResult> {
  // Ждём ровно до появления текста результата (быстрее фиксированной паузы).
  try {
    await page.waitForFunction(
      () => /отмет|отмечен|нерабоч|недействительн|зафиксир|засчит|ошибк/i.test(document.body?.innerText ?? ''),
      { timeout: 6000 },
    );
  } catch {
    /* маркер не появился за 6с — читаем что есть */
  }
  const title = await page.title();
  const fullText = await page.evaluate(() => document.body?.innerText ?? '');
  const mark = classifyMark(`${title} ${fullText}`);
  const status: AuthStatus = mark === 'not_marked' ? 'not_marked' : mark === 'unknown' ? 'unknown' : 'success';
  const message =
    mark === 'not_marked'
      ? 'Отметка не прошла — метка нерабочая или недействительная'
      : mark === 'unknown'
        ? 'Вход выполнен, но результат отметки не распознан — проверьте страницу'
        : undefined;
  return { status, url: page.url(), pageTitle: title, pageText: fullText.slice(0, 400), message };
}

export async function authorize(login: string, password: string, targetUrl: string): Promise<AuthResult> {
  const browser = await getBrowser();
  let context: BrowserContext | null = null;

  try {
    // Изолированный контекст — эквивалент incognito WebView
    context = await browser.newContext({
      locale: 'ru-RU',
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
    });
    context.setDefaultTimeout(30_000);

    // Шим для esbuild/tsx: в dev код page.evaluate оборачивается хелпером __name,
    // которого нет в браузере. Определяем его в каждом документе как no-op.
    // Строка (не функция) — чтобы esbuild её не трансформировал.
    await context.addInitScript('globalThis.__name = globalThis.__name || function (f) { return f; };');

    // Блокируем переходы за пределы *.istu.edu + не грузим тяжёлое (ускорение).
    await context.route('**/*', (route) => {
      const req = route.request();
      const type = req.resourceType();
      const url = req.url();
      // Чужой домен (документ) — блок, как раньше
      if (type === 'document' && !isNavigableHost(url) && !url.startsWith('about:')) {
        route.abort();
        return;
      }
      // Для входа и отметки не нужны картинки/шрифты/медиа — экономим время загрузки
      if (type === 'image' || type === 'media' || type === 'font') {
        route.abort();
        return;
      }
      route.continue();
    });

    const page = await context.newPage();

    // Шаг 1: Переходим на целевой URL (идём за редиректами до страницы входа)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Если уже авторизованы
    if (isAllowedHost(page.url()) && !isLoginUrl(page.url())) {
      const hasPassword = await page.$('input[type="password"]');
      if (!hasPassword) {
        return await readMarkResult(page);
      }
    }

    if (!isLoginUrl(page.url())) {
      return { status: 'error', message: `Неожиданный адрес: ${page.url()}` };
    }

    // Шаг 2: Ждём появления формы входа (SPA может рисовать её с задержкой)
    const passLocator = page.locator('input[type="password"]').first();
    try {
      await passLocator.waitFor({ state: 'visible', timeout: FILL_WAIT_MS });
    } catch {
      return { status: 'error', message: 'Форма входа не появилась' };
    }

    // Находим поле логина — последнее текстовое поле перед паролем
    const loginLocator = page.evaluate(() => {
      const pass = document.querySelector<HTMLInputElement>('input[type="password"]');
      if (!pass) return null;
      const all = Array.from(document.querySelectorAll<HTMLInputElement>('input'));
      const pIdx = all.indexOf(pass);
      for (let i = pIdx - 1; i >= 0; i--) {
        const t = (all[i].getAttribute('type') ?? 'text').toLowerCase();
        if (['text', 'email', 'tel'].includes(t) && !all[i].disabled) return all[i].name || null;
      }
      return null;
    });

    // Заполняем форму через React-совместимый способ (как buildFillJs в мобильном)
    await page.evaluate(
      ({ l, p }) => {
        function setValue(el: HTMLInputElement, value: string) {
          const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          el.focus();
          if (desc?.set) desc.set.call(el, value);
          else el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.blur();
        }

        const pass = document.querySelector<HTMLInputElement>('input[type="password"]');
        if (!pass) return;
        const all = Array.from(document.querySelectorAll<HTMLInputElement>('input'));
        const pIdx = all.indexOf(pass);
        let user: HTMLInputElement | null = null;
        for (let i = pIdx - 1; i >= 0; i--) {
          const t = (all[i].getAttribute('type') ?? 'text').toLowerCase();
          if (['text', 'email', 'tel'].includes(t) && !all[i].disabled) {
            user = all[i];
            break;
          }
        }
        if (user) setValue(user, l);
        setValue(pass, p);
      },
      { l: login, p: password },
    );

    // Шаг 3: Нажимаем кнопку входа
    await page.evaluate(() => {
      const pass = document.querySelector<HTMLInputElement>('input[type="password"]');
      const btn = Array.from(document.querySelectorAll<HTMLElement>('button, input[type="submit"]')).find((b) =>
        /войти|вход|log ?in|sign ?in|submit/i.test((b.textContent ?? (b as HTMLInputElement).value ?? '').trim()),
      );
      if (btn) btn.click();
      else if (pass?.form) {
        if (pass.form.requestSubmit) pass.form.requestSubmit();
        else pass.form.submit();
      } else {
        pass?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      }
    });

    // Шаг 4: Ждём навигации после отправки
    try {
      await page.waitForURL(
        (url) => isAllowedHost(url.toString()) && !isLoginUrl(url.toString()),
        { timeout: 15_000 },
      );
    } catch {
      // Проверяем: может мы всё ещё на странице входа (неверный пароль)?
      if (isLoginUrl(page.url()) || (await page.$('input[type="password"]'))) {
        return { status: 'wrong_credentials', url: page.url() };
      }
      return { status: 'timeout', message: 'Не удалось определить результат входа' };
    }

    // Ждём стабилизации страницы
    await page.waitForLoadState('domcontentloaded');
    const finalUrl = page.url();
    const hasPasswordAfter = await page.$('input[type="password"]');

    if (isAllowedHost(finalUrl) && !isLoginUrl(finalUrl) && !hasPasswordAfter) {
      return await readMarkResult(page);
    }

    return { status: 'wrong_credentials', url: finalUrl };
  } catch (e: any) {
    if (e.message?.includes('Timeout') || e.message?.includes('timeout')) {
      return { status: 'timeout', message: 'Превышено время ожидания (30 с)' };
    }
    return { status: 'error', message: e.message ?? 'Неизвестная ошибка' };
  } finally {
    await context?.close();
  }
}
