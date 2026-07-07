# Frontend — Sistema de Indemnizaciones (GitHub Pages)

Sitio estático, sin build. Dos páginas: `index.html` (portal seller) y `admin.html` (panel Admin).

## Setup

1. Desplegar primero el backend (`../backend/README.md`) y obtener la URL `/exec` del Web App.
2. Editar `assets/js/config.js` → `CONFIG.BACKEND_URL` con esa URL.
3. Servir la carpeta con cualquier servidor estático para probar local, ej.:
   `npx serve frontend` o la extensión "Live Server" de VS Code.

## Desplegar a GitHub Pages

1. GitHub Pages requiere un repositorio **público** (salvo plan GitHub Pro/Team con Pages privado). Si este repo completo (que incluye el backend y material de referencia) debe mantenerse privado, considera:
   - Mover `/frontend` a un repositorio público separado antes de publicar, o
   - Usar GitHub Pro/Team con Pages privado para todo el repo.
2. Settings → Pages → Source: rama `main`, carpeta `/frontend` (o mover el contenido de `/frontend` a la raíz de un repo dedicado — GitHub Pages sirve mejor desde la raíz o `/docs`, no soporta una subcarpeta arbitraria salvo que sea `/docs`).
3. La URL resultante (`https://{usuario}.github.io/{repo}/`) es la que va en `Config.gs` → `FRONTEND_BASE_URL` del backend, para que los links mágicos de los correos apunten al lugar correcto.

## Modo mock (antes de tener el backend desplegado)

`CONFIG.USE_MOCK = true` en `config.js` hace que `Api.get`/`Api.post` devuelvan `{ok:false, error:'mock_no_configurado'}` — sirve como interruptor rápido para no disparar llamadas reales mientras se ajusta la URL del backend. Para probar vistas específicas con datos de ejemplo, es más simple levantar el backend real en modo pruebas (ver `backend/README.md`) que mantener fixtures duplicados acá.

## Estructura

```
index.html            portal seller (?seller=..&token=..)
admin.html             panel Admin (admin.html)
assets/css/            amplifica-core.css (design system, no tocar salvo update de marca) + portal.css/admin.css (layout específico)
assets/js/             amplifica-core.js (Amp global) + config.js + util.js + api.js + portal.js/admin.js
```

Cualquier componente de UI nuevo (badges, wizard, inputs) debe seguir los tokens de `amplifica-core.css` — consultar la skill `amplifica-design-system` antes de inventar estilos nuevos.
