/**
 * config.js — constantes editables al desplegar. Completar BACKEND_URL con la
 * URL /exec del Web App de Apps Script una vez desplegado (ver backend/README.md).
 */
const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbwc8SBwwrWql_mVPkhXAx18VNubGh-0p6Mb3blhBZ7ZxHKE7SROIuqtKU0ggyV61MaY/exec',

  // Client ID de Google Sign-In (admin.html) — no es secreto, está pensado para ir acá.
  // Debe ser EXACTAMENTE el mismo valor que Config.gs -> GOOGLE_OAUTH_CLIENT_ID en el backend.
  GOOGLE_CLIENT_ID: '1016068082793-94bpm24ghq6dnobqaq6bubniict8f38m.apps.googleusercontent.com',

  // Activa respuestas simuladas en api.js mientras el backend no está listo.
  // Poner en false (o borrar la rama en api.js) una vez conectado al backend real.
  USE_MOCK: false
};
