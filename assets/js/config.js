/**
 * config.js — constantes editables al desplegar. Completar BACKEND_URL con la
 * URL /exec del Web App de Apps Script una vez desplegado (ver backend/README.md).
 */
const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/REEMPLAZAR_CON_TU_DEPLOYMENT_ID/exec',

  // Client ID de Google Sign-In (admin.html) — no es secreto, está pensado para ir acá.
  // Debe ser EXACTAMENTE el mismo valor que Config.gs -> GOOGLE_OAUTH_CLIENT_ID en el backend.
  GOOGLE_CLIENT_ID: '<pendiente>.apps.googleusercontent.com',

  // Activa respuestas simuladas en api.js mientras el backend no está listo.
  // Poner en false (o borrar la rama en api.js) una vez conectado al backend real.
  USE_MOCK: false
};
