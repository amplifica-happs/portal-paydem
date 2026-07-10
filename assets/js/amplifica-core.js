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

  // ─── Sticky table headers — offset real del navbar ───────
  // .amp-navbar también es sticky top:0 — los <th> sticky (amplifica-core.css) necesitan
  // pegarse debajo de él, no debajo. Se mide en JS en vez de hardcodear un px porque el alto
  // real depende de tipografía/logo — se recalcula si la ventana cambia de tamaño.
  function actualizarOffsetSticky() {
    const nav = document.querySelector('.amp-navbar');
    document.documentElement.style.setProperty('--sticky-offset', (nav ? nav.offsetHeight : 0) + 'px');
  }
  actualizarOffsetSticky(); // este script va al final de <body> sin defer — el navbar ya existe
  window.addEventListener('resize', actualizarOffsetSticky);

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
    document.getElementById('amp-panel-body').innerHTML = '<div class="amp-panel-body-inner">' + html + '</div>';
    document.getElementById('amp-panel-backdrop').classList.add('is-open');
    document.getElementById('amp-panel').classList.add('is-open');
  }
  function closeSidePanel() {
    document.getElementById('amp-panel-backdrop').classList.remove('is-open');
    document.getElementById('amp-panel').classList.remove('is-open');
  }

  // Esc cierra lo que esté abierto más arriba: el visor de documento (se abre por encima
  // del side panel, desde una acción dentro de él) primero, y si no está abierto, el side
  // panel. `index.html` (portal) no tiene side panel, de ahí el null-check.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const docViewer = document.getElementById('doc-viewer');
    if (docViewer && docViewer.classList.contains('is-open')) { closeDocViewer(); return; }
    const sidePanel = document.getElementById('amp-panel');
    if (sidePanel && sidePanel.classList.contains('is-open')) { closeSidePanel(); }
  });

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

  // ─── Multiselect dropdown filter ──────────────────────────
  function escLocal(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Botón + panel flotante con checkboxes. Selección vacía = sin filtro (no "0 resultados"
   * por default). onChange recibe el array de valores seleccionados en cada cambio.
   */
  function multiSelect(containerEl, { label = '', options = [], onChange } = {}) {
    let opts = options;
    const selected = new Set();

    const wrap = document.createElement('div');
    wrap.className = 'ms-dropdown';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost ms-dropdown-btn';
    const panel = document.createElement('div');
    panel.className = 'ms-dropdown-panel hidden';
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    containerEl.appendChild(wrap);

    function updateLabel() {
      const n = selected.size;
      btn.innerHTML = '<span class="material-symbols-rounded">filter_list</span>' + escLocal(label) +
        (n > 0 ? '<span class="badge badge-ui ms-dropdown-count">' + n + '</span>' : '');
    }

    function emitChange() { onChange && onChange(Array.from(selected)); }

    function renderPanel() {
      panel.innerHTML =
        '<div class="ms-dropdown-actions">' +
        '<button type="button" class="btn btn-link btn-sm" data-ms-all="">Todos</button>' +
        '<button type="button" class="btn btn-link btn-sm" data-ms-clear="">Limpiar</button>' +
        '</div>' +
        '<div class="ms-dropdown-list">' +
        (opts.length === 0
          ? '<div class="text-muted ms-dropdown-empty">Sin opciones</div>'
          : opts.map(o =>
              '<label class="checkbox ms-dropdown-item"><input type="checkbox" value="' + escLocal(o.value) + '"' +
              (selected.has(o.value) ? ' checked' : '') + '><span class="checkbox-box"></span>' + escLocal(o.label) + '</label>'
            ).join('')) +
        '</div>';

      panel.querySelectorAll('input[type=checkbox]').forEach(chk => {
        chk.addEventListener('change', () => {
          if (chk.checked) selected.add(chk.value); else selected.delete(chk.value);
          updateLabel();
          emitChange();
        });
      });
      panel.querySelector('[data-ms-all]').addEventListener('click', () => {
        opts.forEach(o => selected.add(o.value));
        renderPanel(); updateLabel(); emitChange();
      });
      panel.querySelector('[data-ms-clear]').addEventListener('click', () => {
        selected.clear();
        renderPanel(); updateLabel(); emitChange();
      });
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = !panel.classList.contains('hidden');
      document.querySelectorAll('.ms-dropdown-panel').forEach(p => p.classList.add('hidden'));
      if (!isOpen) panel.classList.remove('hidden');
    });
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) panel.classList.add('hidden');
    });

    updateLabel();
    renderPanel();

    return {
      getSelected: () => Array.from(selected),
      setOptions: (newOptions) => {
        opts = newOptions || [];
        const validValues = new Set(opts.map(o => o.value));
        Array.from(selected).forEach(v => { if (!validValues.has(v)) selected.delete(v); });
        renderPanel(); updateLabel();
      }
    };
  }

  // ─── Table loading skeleton ────────────────────────────────
  /** Pinta `rows` filas de placeholders shimmer en un <tbody> mientras un fetch está en vuelo. */
  function renderTableSkeleton(tbodyEl, { cols, rows = 6 } = {}) {
    tbodyEl.innerHTML = Array.from({ length: rows }, () =>
      '<tr>' + Array.from({ length: cols }, () => '<td><span class="skel">&nbsp;</span></td>').join('') + '</tr>'
    ).join('');
  }

  // ─── Copiar al portapapeles (click-to-copy) ────────────────
  /** Envuelve `value` en un span clickeable — aplica a cualquier código de pedido mostrado en la UI. */
  function copyable(value) {
    const esc = escLocal(value);
    return '<span class="js-copy" data-copy="' + esc + '" title="Clic para copiar">' + esc + '</span>';
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('.js-copy');
    if (!el || !navigator.clipboard) return;
    const valor = el.dataset.copy;
    navigator.clipboard.writeText(valor).then(() => {
      if (el._copyTimeout) clearTimeout(el._copyTimeout);
      if (el._copyOriginal === undefined) el._copyOriginal = el.textContent;
      el.classList.add('is-copied');
      el.textContent = '✓ Copiado';
      el._copyTimeout = setTimeout(() => {
        el.classList.remove('is-copied');
        el.textContent = el._copyOriginal;
      }, 900);
    });
  });

  // ─── Pagination bar ────────────────────────────────────────
  /** Barra "Mostrar N · X–Y de Z · « ‹ page › »" — se pinta siempre dentro del .table-wrap. */
  function renderPagination(containerEl, opts = {}) {
    const {
      page = 1, pageSize = 20, total = 0,
      pageSizeOptions = [10, 20, 50],
      onPageChange, onPageSizeChange
    } = opts;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const curPage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (curPage - 1) * pageSize + 1;
    const to = Math.min(curPage * pageSize, total);

    containerEl.innerHTML =
      '<div class="pagination-bar">' +
      '<label class="pagination-size">' +
      '<span class="text-muted">Mostrar</span>' +
      '<select class="select pagination-size-select">' +
      pageSizeOptions.map(n => '<option value="' + n + '"' + (n === pageSize ? ' selected' : '') + '>' + n + '</option>').join('') +
      '</select>' +
      '</label>' +
      '<span class="text-muted tabular pagination-summary">' + from + '&ndash;' + to + ' de ' + total + '</span>' +
      '<div class="pagination-nav">' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-pg="first"' + (curPage <= 1 ? ' disabled' : '') + '><span class="material-symbols-rounded">first_page</span></button>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-pg="prev"' + (curPage <= 1 ? ' disabled' : '') + '><span class="material-symbols-rounded">chevron_left</span></button>' +
      '<span class="pagination-page tabular">' + curPage + ' / ' + totalPages + '</span>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-pg="next"' + (curPage >= totalPages ? ' disabled' : '') + '><span class="material-symbols-rounded">chevron_right</span></button>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-pg="last"' + (curPage >= totalPages ? ' disabled' : '') + '><span class="material-symbols-rounded">last_page</span></button>' +
      '</div>' +
      '</div>';

    const goTo = p => { if (p !== curPage) onPageChange && onPageChange(p); };
    containerEl.querySelector('.pagination-size-select').addEventListener('change', e => {
      onPageSizeChange && onPageSizeChange(Number(e.target.value));
    });
    containerEl.querySelector('[data-pg="first"]').addEventListener('click', () => goTo(1));
    containerEl.querySelector('[data-pg="prev"]').addEventListener('click', () => goTo(curPage - 1));
    containerEl.querySelector('[data-pg="next"]').addEventListener('click', () => goTo(curPage + 1));
    containerEl.querySelector('[data-pg="last"]').addEventListener('click', () => goTo(totalPages));
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
    multiSelect, renderPagination,
    renderTableSkeleton, copyable,
  };
})(window);
