/* =========================================================
   AMPLIFICA · CORE INTERFACE — JS helpers

   Extraído verbatim de amplifica-core.js.html (proyecto legacy) — mismo
   contenido, solo cambia el envoltorio (.js plano con <script src> en vez
   de <?!= include(...) ?> de HtmlService, que no existe en un sitio estático).
   ========================================================= */

(function (global) {
  'use strict';

  // ─── Theme ────────────────────────────────────────────────
  const THEME_KEY = 'amplifica-theme';
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const icon = document.getElementById('amp-theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }
  // Run before paint
  (function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const sys   = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const eff   = saved || sys;
    document.documentElement.setAttribute('data-theme', eff);
    document.addEventListener('DOMContentLoaded', () => {
      const icon = document.getElementById('amp-theme-icon');
      if (icon) icon.textContent = eff === 'dark' ? 'dark_mode' : 'light_mode';
    });
  })();

  // ─── Toasts ───────────────────────────────────────────────
  function ensureToastRoot() {
    let root = document.getElementById('amp-toasts');
    if (!root) { root = document.createElement('div'); root.id = 'amp-toasts'; document.body.appendChild(root); }
    return root;
  }
  function showToast(msg, type = 'info', duration = 4000) {
    const root = ensureToastRoot();
    const iconMap = { success: 'check_circle', danger: 'error', warning: 'warning', info: 'info' };
    while (root.children.length >= 5) dismissToast(root.firstElementChild);
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="material-symbols-rounded icon-fill">${iconMap[type] || 'info'}</span>
      <p class="toast-msg">${msg}</p>
      <button class="toast-close" aria-label="Cerrar">×</button>`;
    el.querySelector('.toast-close').addEventListener('click', () => dismissToast(el));
    root.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-show')));
    if (duration > 0) setTimeout(() => dismissToast(el), duration);
    return el;
  }
  function dismissToast(el) {
    if (!el || !el.parentElement) return;
    el.classList.remove('is-show'); el.classList.add('is-hide');
    setTimeout(() => el.remove(), 260);
  }

  // ─── Top loader ───────────────────────────────────────────
  function ensureTopLoader() {
    let el = document.getElementById('amp-toploader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'amp-toploader';
      el.className = 'amp-toploader';
      document.body.appendChild(el);
    }
    return el;
  }
  function setTopLoader(visible) {
    const el = ensureTopLoader();
    el.classList.toggle('is-visible', !!visible);
  }

  // ─── Button ripple ────────────────────────────────────────
  document.addEventListener('mousedown', e => {
    const btn = e.target.closest('.btn');
    if (!btn || btn.classList.contains('is-loading') || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size/2;
    const y = e.clientY - rect.top  - size/2;
    const isDark = btn.classList.contains('btn-primary') || btn.classList.contains('btn-pop');
    const color = isDark ? 'rgba(255,255,255,0.30)' : 'rgba(18,23,85,0.14)';
    const wave = document.createElement('span');
    wave.className = 'btn-ripple';
    wave.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;background:${color};`;
    btn.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  });

  // ─── Button loading state (preserves width + label) ──────
  function setButtonLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn._origW = btn.style.width;
      btn.style.width = btn.offsetWidth + 'px';
      if (!btn.querySelector('.btn-label')) {
        const wrap = document.createElement('span');
        wrap.className = 'btn-label';
        wrap.style.display = 'inline-flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        while (btn.firstChild) wrap.appendChild(btn.firstChild);
        btn.appendChild(wrap);
      }
      btn.classList.add('is-loading');
    } else {
      btn.classList.remove('is-loading');
      btn.style.width = btn._origW || '';
    }
  }

  // ─── Animated counter ────────────────────────────────────
  function animateCounter(el, to, { duration = 900, decimals = 0, suffix = '', prefix = '' } = {}) {
    const from = parseFloat(el.dataset.from || el.textContent.replace(/[^\d.\-]/g, '') || '0') || 0;
    const start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      el.textContent = prefix + v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.dataset.from = String(to);
    }
    requestAnimationFrame(tick);
  }

  // ─── Modal ───────────────────────────────────────────────
  function showInputModal({ title, placeholder = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm }) {
    const overlay = document.getElementById('amp-modal');
    const field   = overlay.querySelector('.amp-modal-field');
    const titleEl = overlay.querySelector('.amp-modal-title');
    const okBtn   = overlay.querySelector('.amp-modal-ok');
    const noBtn   = overlay.querySelector('.amp-modal-cancel');
    titleEl.textContent = title;
    field.placeholder = placeholder; field.value = '';
    okBtn.textContent = confirmLabel; noBtn.textContent = cancelLabel;
    function close() {
      overlay.classList.remove('is-open');
      document.removeEventListener('keydown', keyHandler);
    }
    function ok() {
      const v = field.value.trim();
      if (!v) { field.classList.add('shake', 'has-error'); setTimeout(() => field.classList.remove('shake','has-error'), 450); return; }
      close(); onConfirm && onConfirm(v);
    }
    function keyHandler(e) {
      if (e.key === 'Enter') ok();
      else if (e.key === 'Escape') close();
    }
    okBtn.onclick = ok; noBtn.onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
    document.addEventListener('keydown', keyHandler);
    overlay.classList.add('is-open');
    setTimeout(() => field.focus(), 60);
  }

  // ─── Side panel ──────────────────────────────────────────
  function openSidePanel({ title = 'Detalles', html = '' } = {}) {
    document.getElementById('amp-panel-title').textContent = title;
    document.getElementById('amp-panel-body').innerHTML = html;
    document.getElementById('amp-panel-backdrop').classList.add('is-open');
    document.getElementById('amp-panel').classList.add('is-open');
  }
  function closeSidePanel() {
    document.getElementById('amp-panel-backdrop').classList.remove('is-open');
    document.getElementById('amp-panel').classList.remove('is-open');
  }

  // ─── Visor de documento (drawer) ──────────────────────────
  // Extiende el patrón #pdf-drawer/#pdf-overlay de Proyecto Previo (Facturación)
  // (github/index.html, líneas ~890-950 y ~3798-3852): mismo mecanismo de slide-in
  // + base64-a-Blob + iframe, restyled con los tokens de este archivo, y con una
  // rama nueva para imágenes (el original solo tenía <iframe>).
  /**
   * Abre el panel INMEDIATAMENTE con spinner, antes de pedir el documento al backend.
   * Separado de renderDocViewerContent() a propósito: el "silencio" entre el click y
   * que el panel aparezca (mientras el fetch de descargarArchivo está en vuelo) es lo
   * que hacía sentir lento el visor — abrir de una vez con el spinner no acelera la
   * descarga real, pero elimina esa sensación de que "no pasó nada" al hacer click.
   */
  function openDocViewerLoading(label) {
    const backdrop = document.getElementById('doc-viewer-backdrop');
    const panel    = document.getElementById('doc-viewer');
    const body     = document.getElementById('doc-viewer-body');
    const labelEl  = document.getElementById('doc-viewer-label');

    labelEl.textContent = label || '';
    body.innerHTML = '<div class="row" style="justify-content:center;padding:40px;"><span class="amp-spinner lg"></span></div>';
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
  }

  function renderDocViewerContent({ mimeType = 'application/pdf', base64, fileName = 'documento' }) {
    const panel  = document.getElementById('doc-viewer');
    const body   = document.getElementById('doc-viewer-body');
    const dlBtn  = document.getElementById('doc-viewer-download');
    const tabBtn = document.getElementById('doc-viewer-newtab');

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    if (mimeType.indexOf('image/') === 0) {
      body.innerHTML = '<img src="' + url + '" alt="' + fileName + '" style="max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto;">';
    } else {
      body.innerHTML = '<iframe title="Previsualización de documento" src="' + url + '" style="width:100%;height:100%;border:0;"></iframe>';
    }

    dlBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
    };
    tabBtn.onclick = () => window.open(url, '_blank');

    panel._objectUrl = url;
  }

  /** Muestra un error dentro del propio panel (ya está abierto) en vez de cerrarlo en silencio. */
  function showDocViewerError(msg) {
    document.getElementById('doc-viewer-body').innerHTML =
      '<div class="alert alert-danger" style="margin:20px;">' + msg + '</div>';
  }

  function closeDocViewer() {
    const panel = document.getElementById('doc-viewer');
    document.getElementById('doc-viewer-backdrop').classList.remove('is-open');
    panel.classList.remove('is-open');
    if (panel._objectUrl) { URL.revokeObjectURL(panel._objectUrl); panel._objectUrl = null; }
  }

  // Expose
  global.Amp = {
    toggleTheme, applyTheme,
    showToast, dismissToast,
    setTopLoader,
    setButtonLoading,
    animateCounter,
    showInputModal,
    openSidePanel, closeSidePanel,
    openDocViewerLoading, renderDocViewerContent, showDocViewerError, closeDocViewer,
  };
})(window);
