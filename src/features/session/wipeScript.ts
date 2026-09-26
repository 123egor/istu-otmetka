/**
 * JS, который выполняется внутри страницы и стирает всё, что видно из JS:
 * не-HttpOnly куки (для всех путей и доменов), localStorage, sessionStorage,
 * IndexedDB и Cache Storage. HttpOnly-куки чистит clearNativeCookies().
 */
export const WIPE_PAGE_STORAGE_JS = `
(function () {
  try {
    var host = location.hostname;
    var parts = host.split('.');
    var domains = [''];
    for (var i = 0; i < parts.length - 1; i++) {
      var d = parts.slice(i).join('.');
      domains.push('; domain=' + d, '; domain=.' + d);
    }
    var segs = location.pathname.split('/');
    var paths = ['; path=/'];
    for (var j = 1; j < segs.length; j++) {
      paths.push('; path=' + segs.slice(0, j + 1).join('/'));
    }
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!name) return;
      domains.forEach(function (dm) {
        paths.forEach(function (p) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0' + p + dm;
        });
      });
    });
  } catch (e) {}
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  try {
    if (window.indexedDB && indexedDB.databases) {
      indexedDB.databases().then(function (dbs) {
        dbs.forEach(function (db) { if (db.name) indexedDB.deleteDatabase(db.name); });
      });
    }
  } catch (e) {}
  try {
    if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
  } catch (e) {}
  try {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'wiped' }));
  } catch (e) {}
})();
true;
`;
