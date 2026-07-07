/**
 * util.js — helpers genéricos compartidos por portal.js y admin.js.
 */
const Util = (function () {
  function formatCLP(amount) {
    const n = Math.round(Number(amount) || 0);
    return '$ ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function formatFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-CL');
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const idx = result.indexOf(',');
        resolve(idx !== -1 ? result.substring(idx + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { formatCLP, formatFecha, qs, fileToBase64, debounce, escapeHtml };
})();
