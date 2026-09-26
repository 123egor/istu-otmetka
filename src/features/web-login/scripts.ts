import { FILL_WAIT_MS, NAV_HOST_SUFFIX } from '@/config';

/**
 * Скрипт-наблюдатель: встраивается в каждую загруженную страницу
 * и сообщает в приложение адрес и наличие поля пароля.
 * Учётных данных здесь НЕТ.
 */
export const MONITOR_JS = `
(function () {
  if (window.__otmMonitor) return;
  window.__otmMonitor = true;
  var last = '';
  function report() {
    try {
      var hasPassword = !!document.querySelector('input[type="password"]');
      var msg = JSON.stringify({ type: 'state', href: location.href, hasPassword: hasPassword });
      if (msg !== last) {
        last = msg;
        window.ReactNativeWebView.postMessage(msg);
      }
    } catch (e) {}
  }
  report();
  setInterval(report, 700);
})();
true;
`;

/**
 * Скрипт автозаполнения. Приложение внедряет его только после того,
 * как само проверило домен, а скрипт перепроверяет домен ещё раз на месте.
 * Ищем поле пароля и ближайшее
 * текстовое поле перед ним, заполняем, жмём «Войти» (или Enter).
 */
export function buildFillJs(login: string, password: string): string {
  const L = JSON.stringify(login);
  const P = JSON.stringify(password);
  const suffix = JSON.stringify(NAV_HOST_SUFFIX);
  return `
(function () {
  var post = function (o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} };
  var suffix = ${suffix};
  var h = location.hostname;
  if (location.protocol !== 'https:' || !(h === suffix || h.slice(-(suffix.length + 1)) === '.' + suffix)) {
    post({ type: 'fill-error', message: 'Отказ: чужой домен ' + h });
    return;
  }

  function setValue(el, value) {
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    el.focus();
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function visible(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function tryFill() {
    var pass = Array.prototype.find.call(document.querySelectorAll('input[type="password"]'), visible)
      || document.querySelector('input[type="password"]');
    if (!pass) return false;

    var all = Array.prototype.slice.call(document.querySelectorAll('input'));
    var pIdx = all.indexOf(pass);
    var user = null;
    for (var i = pIdx - 1; i >= 0; i--) {
      var t = (all[i].getAttribute('type') || 'text').toLowerCase();
      if ((t === 'text' || t === 'email' || t === 'tel' || t === 'number') && !all[i].disabled) { user = all[i]; break; }
    }
    if (!user) { post({ type: 'fill-error', message: 'Не найдено поле логина рядом с паролем.' }); return true; }

    setValue(user, ${L});
    setValue(pass, ${P});

    setTimeout(function () {
      var buttons = Array.prototype.slice.call(document.querySelectorAll('button, input[type="submit"]'));
      var btn = buttons.find(function (b) {
        return /войти|вход|log ?in|sign ?in|submit/i.test((b.textContent || b.value || '').trim());
      });
      if (btn) {
        btn.click();
      } else if (pass.form) {
        if (pass.form.requestSubmit) pass.form.requestSubmit(); else pass.form.submit();
      } else {
        ['keydown', 'keypress', 'keyup'].forEach(function (type) {
          pass.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        });
      }
      post({ type: 'submitted' });
    }, 250);
    return true;
  }

  // Форма может отрисоваться не сразу (SPA) — ждём до FILL_WAIT_MS.
  if (tryFill()) return;
  var started = Date.now();
  var timer = setInterval(function () {
    if (tryFill()) { clearInterval(timer); return; }
    if (Date.now() - started > ${FILL_WAIT_MS}) {
      clearInterval(timer);
      post({ type: 'fill-error', message: 'Форма входа не появилась.' });
    }
  }, 500);
})();
true;
`;
}
