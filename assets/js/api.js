/**
 * api.js — wrapper único de comunicación con el backend Apps Script.
 * Reglas centralizadas acá para que ningún call-site pueda romperlas:
 *  - GET: query string normal.
 *  - POST: SIEMPRE Content-Type: text/plain;charset=utf-8 (nunca application/json),
 *    para evitar el preflight CORS que Apps Script no responde correctamente.
 *  - Toda respuesta ya viene en la forma {ok, data} / {ok:false, error, detalle} —
 *    Api solo la pasa a través, salvo el atajo de sesión vencida (ver onSessionExpired).
 */
const Api = (function () {
  let onSessionExpired = null;

  function setSessionExpiredHandler(fn) { onSessionExpired = fn; }

  function normalizar(res) {
    if (res && res.ok === false && res.error === 'sesion_invalida' && onSessionExpired) {
      onSessionExpired();
    }
    return res;
  }

  function get(action, params) {
    if (CONFIG.USE_MOCK) return Promise.resolve({ ok: false, error: 'mock_no_configurado' });

    const qs = new URLSearchParams(Object.assign({ action }, params || {}));
    return fetch(CONFIG.BACKEND_URL + '?' + qs.toString())
      .then(r => r.json())
      .then(normalizar)
      .catch(() => ({ ok: false, error: 'network' }));
  }

  function post(action, payload) {
    if (CONFIG.USE_MOCK) return Promise.resolve({ ok: false, error: 'mock_no_configurado' });

    return fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload || {}))
    })
      .then(r => r.json())
      .then(normalizar)
      .catch(() => ({ ok: false, error: 'network' }));
  }

  return { get, post, setSessionExpiredHandler };
})();
