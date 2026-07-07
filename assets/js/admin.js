/**
 * admin.js — panel Admin. Sesión guardada en sessionStorage (sobrevive un refresh
 * dentro de la ventana de 6h, se limpia al cerrar la pestaña); el backend revalida
 * cada llamada igual, así que esto es solo comodidad, no la fuente de autoridad.
 */
(function () {
  const SESSION_KEY = 'amp_sesionAdmin';
  const EMAIL_KEY = 'amp_sesionAdminEmail';
  let preview = null; // último previsualizarNotas, con selección en memoria
  const tabsCargados = {};

  function getSesion() { return sessionStorage.getItem(SESSION_KEY); }
  function setSesion(v) { sessionStorage.setItem(SESSION_KEY, v); }
  function clearSesion() { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(EMAIL_KEY); }

  function showGate() {
    document.getElementById('view-admin-gate').classList.remove('hidden');
    document.getElementById('view-admin-shell').classList.add('hidden');
    document.getElementById('btn-logout').classList.add('hidden');
    document.getElementById('admin-email-actual').classList.add('hidden');
  }
  function showShell() {
    document.getElementById('view-admin-gate').classList.add('hidden');
    document.getElementById('view-admin-shell').classList.remove('hidden');
    document.getElementById('btn-logout').classList.remove('hidden');
    const email = sessionStorage.getItem(EMAIL_KEY);
    if (email) {
      const el = document.getElementById('admin-email-actual');
      el.textContent = email;
      el.classList.remove('hidden');
    }
    if (!tabsCargados['tab-listado']) { cargarListado(); tabsCargados['tab-listado'] = true; }
  }

  Api.setSessionExpiredHandler(() => {
    clearSesion();
    showGate();
    Amp.showToast('Tu sesión expiró, inicia sesión de nuevo', 'warning');
  });

  // ── Gate — Google Sign-In restringido a amplifica.io ───────
  // El parámetro hd acá es solo un filtro cosmético del selector de cuentas de Google;
  // la aplicación real del dominio ocurre en el backend (verificarSesionGoogle).
  function handleGoogleCredential(response) {
    const err = document.getElementById('admin-gate-error');
    err.classList.add('hidden');
    Api.post('verificarSesionGoogle', { idToken: response.credential }).then(res => {
      if (res.ok) {
        setSesion(res.data.sesion);
        sessionStorage.setItem(EMAIL_KEY, res.data.email);
        showShell();
      } else {
        err.textContent = res.detalle || 'Cuenta no autorizada — usa tu cuenta de Amplifica.';
        err.classList.remove('hidden');
      }
    });
  }
  window.handleGoogleCredential = handleGoogleCredential;

  // El script de GIS está marcado async en el <head> — puede terminar de cargar en
  // cualquier momento, incluso después de que este archivo ya se ejecutó. Esperar a
  // window.load garantiza que google.accounts.id ya existe (load espera scripts async).
  function initGoogleSignIn() {
    if (!window.google || !google.accounts || !google.accounts.id) return;
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      hd: 'amplifica.io'
    });
    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' }
    );
  }
  window.addEventListener('load', initGoogleSignIn);

  document.getElementById('btn-logout').addEventListener('click', () => { clearSesion(); showGate(); });

  // ── Tabs ──────────────────────────────────────────────────
  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
      const target = document.getElementById(btn.dataset.tab);
      target.classList.remove('hidden');

      if (!tabsCargados[btn.dataset.tab]) {
        tabsCargados[btn.dataset.tab] = true;
        if (btn.dataset.tab === 'tab-generar') cargarPreview();
        if (btn.dataset.tab === 'tab-auditoria') cargarAuditoria();
      }
    });
  });

  // ── Tab: Listado ──────────────────────────────────────────
  function poblarSelectAnio() {
    const sel = document.getElementById('select-anio');
    const actual = new Date().getFullYear();
    sel.innerHTML = '';
    for (let a = actual; a >= actual - 3; a--) {
      const opt = document.createElement('option');
      opt.value = a; opt.textContent = a;
      sel.appendChild(opt);
    }
  }
  poblarSelectAnio();

  let notasListado = [];
  function cargarListado() {
    const anio = document.getElementById('select-anio').value || new Date().getFullYear();
    Api.get('listarNotas', { anio: anio, sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar el listado', 'danger'); return; }
      notasListado = res.data.sort((a, b) => (b.id_nota || '').localeCompare(a.id_nota || ''));
      renderListado(notasListado);
    });
  }
  function renderListado(notas) {
    const tbody = document.getElementById('listado-body');
    tbody.innerHTML = notas.map(n =>
      '<tr class="fila-nota" data-seller="' + Util.escapeHtml(n.seller) + '" data-id-nota="' + Util.escapeHtml(n.id_nota) + '">' +
      '<td>' + Util.escapeHtml(n.id_nota) + '</td>' +
      '<td>' + Util.escapeHtml(n.seller_nombre || n.seller) + '</td>' +
      '<td>' + Util.escapeHtml(n.periodo || '') + '</td>' +
      '<td><span class="badge badge-ui">' + Util.escapeHtml(n.estado) + '</span>' +
      (n.origen === 'legacy' ? ' <span class="badge badge-warning">LEGACY</span>' : '') + '</td>' +
      '<td>' + Util.formatCLP((n.casos || []).reduce((s, c) => s + (Number(c.monto) || 0), 0)) + '</td>' +
      '</tr>'
    ).join('');
    tbody.querySelectorAll('.fila-nota').forEach(tr => {
      tr.addEventListener('click', () => abrirDetalleNota(tr.dataset.seller, tr.dataset.idNota));
    });
  }
  document.getElementById('select-anio').addEventListener('change', cargarListado);
  document.getElementById('btn-refrescar-listado').addEventListener('click', cargarListado);
  document.getElementById('input-filtro-listado').addEventListener('input', Util.debounce(e => {
    const q = e.target.value.toLowerCase();
    renderListado(notasListado.filter(n =>
      (n.seller_nombre || n.seller || '').toLowerCase().indexOf(q) !== -1 ||
      (n.id_nota || '').toLowerCase().indexOf(q) !== -1
    ));
  }, 200));

  function abrirDetalleNota(seller, idNota) {
    Api.get('getNotaVerificada', { seller: seller, idNota: idNota, sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar la Nota', 'danger'); return; }
      const nota = res.data;
      const montoTotal = (nota.casos || []).reduce((s, c) => s + (Number(c.monto) || 0), 0);
      const html =
        '<div class="col" style="gap:14px;">' +
        '<div><span class="badge badge-ui">' + Util.escapeHtml(nota.estado) + '</span>' +
        (nota.origen === 'legacy' ? ' <span class="badge badge-warning">LEGACY — importada del sistema anterior</span>' : '') + '</div>' +
        '<div><div class="field-label">Seller</div>' + Util.escapeHtml(nota.seller_nombre || nota.seller) + '</div>' +
        '<div><div class="field-label">Período</div>' + Util.escapeHtml(nota.periodo || '') + '</div>' +
        '<div><div class="field-label">Monto Total</div>' + Util.formatCLP(montoTotal) + '</div>' +
        '<div><div class="field-label">Fecha generada</div>' + Util.escapeHtml(nota.fecha_generada || '') + '</div>' +
        '<div><div class="field-label">Fecha firma</div>' + Util.escapeHtml(nota.fecha_firma || '—') + '</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>ID Pedido</th><th>Monto</th></tr></thead><tbody>' +
        (nota.casos || []).map(c => '<tr><td>' + Util.escapeHtml(c.id_pedido) + '</td><td>' + Util.formatCLP(c.monto) + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<div class="row"><button class="btn btn-ghost btn-sm" id="dp-ver-original">Ver original</button>' +
        (nota.pdf_firmado_id ? '<button class="btn btn-ghost btn-sm" id="dp-ver-firmado">Ver firmado</button>' : '') + '</div>' +
        (nota.estado === 'Firmada' ?
          '<div class="field"><div class="field-label">Marcar pago programado</div>' +
          '<input type="date" id="dp-fecha-pago" class="input"><button class="btn btn-primary btn-sm" id="dp-marcar-pago" style="margin-top:8px;">Marcar</button></div>' : '') +
        '</div>';

      Amp.openSidePanel({ title: 'Nota N° ' + nota.id_nota, html: html });

      document.getElementById('dp-ver-original').addEventListener('click', () => verArchivoAdmin('original', seller, idNota));
      const btnFirmado = document.getElementById('dp-ver-firmado');
      if (btnFirmado) btnFirmado.addEventListener('click', () => verArchivoAdmin('firmado', seller, idNota));
      const btnPago = document.getElementById('dp-marcar-pago');
      if (btnPago) btnPago.addEventListener('click', () => {
        const fecha = document.getElementById('dp-fecha-pago').value;
        if (!fecha) { Amp.showToast('Selecciona una fecha', 'warning'); return; }
        Amp.setButtonLoading(btnPago, true);
        Api.post('marcarPagoProgramado', { seller: seller, idNota: idNota, fecha: fecha, sesionAdmin: getSesion() }).then(r => {
          Amp.setButtonLoading(btnPago, false);
          if (r.ok) { Amp.showToast('Pago programado', 'success'); Amp.closeSidePanel(); cargarListado(); }
          else Amp.showToast('No se pudo marcar el pago', 'danger');
        });
      });
    });
  }

  function verArchivoAdmin(cual, seller, idNota) {
    Api.get('descargarArchivo', { seller: seller, idNota: idNota, cual: cual, sesion: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar el documento', 'danger'); return; }
      Amp.openDocViewer({
        label: (cual === 'firmado' ? 'Documento firmado' : 'Nota de Cobro') + ' — ' + idNota,
        mimeType: res.data.mimeType, base64: res.data.base64, fileName: res.data.nombreArchivo
      });
    });
  }

  // ── Tab: Generar Notas ────────────────────────────────────
  document.getElementById('toggle-modo-prueba').addEventListener('change', e => {
    document.getElementById('alerta-modo-prueba').classList.toggle('hidden', !e.target.checked);
  });

  function cargarPreview() {
    document.getElementById('generar-resultado').classList.add('hidden');
    Api.get('previsualizarNotas', { sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar el preview', 'danger'); return; }
      preview = res.data;
      renderPreview();
    });
  }
  function renderPreview() {
    const cont = document.getElementById('generar-cards');
    cont.innerHTML = '';
    preview.sellers.forEach(s => {
      const esMissing = preview.missingSellers.indexOf(s.sellerNombre) !== -1;
      const esBadBank = preview.badBankSellers.indexOf(s.sellerNombre) !== -1;
      const card = document.createElement('div');
      card.className = 'card seller-card';
      card.innerHTML =
        '<div class="card-head">' +
        '<label class="checkbox"><input type="checkbox" class="chk-seller" data-seller="' + Util.escapeHtml(s.seller) + '" checked><span class="checkbox-box"></span>' +
        '<div><div style="font-size:17px;font-weight:700;">' + Util.escapeHtml(s.sellerNombre) + '</div>' +
        '<div class="text-muted" style="font-size:12px;">' + Util.escapeHtml(s.razonSocial) + ' · ' + Util.escapeHtml(s.rut) + '</div></div></label>' +
        (esMissing ? '<span class="badge badge-danger">Seller no encontrado en Datos Bancarios</span>' : '') +
        (esBadBank ? '<span class="badge badge-danger">Falta info bancaria</span>' : '') +
        '</div>' +
        '<div class="text-muted" style="font-size:13px;margin-bottom:8px;">' + Util.escapeHtml(s.banco) + ' · ' + Util.escapeHtml(s.cuenta) + '</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>ID Pedido</th><th>Monto</th></tr></thead><tbody>' +
        s.casos.map(c => '<tr><td>' + Util.escapeHtml(c.idPedido) + '</td><td>' + Util.formatCLP(c.monto) + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<div style="text-align:right;margin-top:8px;font-weight:700;">Total: ' + Util.formatCLP(s.montoTotal) + '</div>';

      const chk = card.querySelector('.chk-seller');
      chk.addEventListener('change', () => card.classList.toggle('is-deselected', !chk.checked));
      cont.appendChild(card);
    });
  }
  document.getElementById('btn-refrescar-preview').addEventListener('click', cargarPreview);

  document.getElementById('btn-confirmar-generacion').addEventListener('click', () => {
    const seleccionados = Array.from(document.querySelectorAll('.chk-seller:checked')).map(c => c.dataset.seller);
    if (seleccionados.length === 0) { Amp.showToast('Selecciona al menos un seller', 'warning'); return; }
    const modoPrueba = document.getElementById('toggle-modo-prueba').checked;
    const accion = modoPrueba ? 'generarNotasModoPrueba' : 'generarNotas';

    document.getElementById('generar-progreso').classList.remove('hidden');
    document.getElementById('generar-resultado').classList.add('hidden');
    document.getElementById('btn-confirmar-generacion').disabled = true;

    Api.post(accion, { sellersSeleccionados: seleccionados, sesionAdmin: getSesion() }).then(res => {
      document.getElementById('generar-progreso').classList.add('hidden');
      document.getElementById('btn-confirmar-generacion').disabled = false;
      const resCont = document.getElementById('generar-resultado');
      resCont.classList.remove('hidden');
      if (!res.ok) { Amp.showToast('No se pudo generar', 'danger'); return; }

      resCont.innerHTML = res.data.map(r =>
        '<div class="alert ' + (r.ok ? 'alert-success' : 'alert-danger') + '">' +
        (r.ok
          ? '<span class="material-symbols-rounded icon-fill">check_circle</span><span>' + Util.escapeHtml(r.sellerNombre) + ' — Nota N° ' + Util.escapeHtml(r.idNota) + ' generada</span>' +
            ' <button class="btn btn-ghost btn-sm btn-ver-generada" data-seller="' + Util.escapeHtml(r.seller) + '" data-id-nota="' + Util.escapeHtml(r.idNota) + '">Previsualizar</button>'
          : '<span class="material-symbols-rounded">error</span><span>' + Util.escapeHtml(r.sellerNombre) + ' — error: ' + Util.escapeHtml(r.error) + '</span>') +
        '</div>'
      ).join('');

      resCont.querySelectorAll('.btn-ver-generada').forEach(btn => {
        btn.addEventListener('click', () => verArchivoAdmin('original', btn.dataset.seller, btn.dataset.idNota));
      });

      Amp.showToast('Generación completada', 'success');
      tabsCargados['tab-listado'] = false; // forzar recarga la próxima vez que se visite
    });
  });

  // ── Tab: Auditoría ────────────────────────────────────────
  function cargarAuditoria() {
    Api.get('listarCasosNoElegibles', { sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar la auditoría', 'danger'); return; }
      const { yaProcesado, pendienteAprobacion, bloqueado } = res.data;

      document.getElementById('auditoria-bloqueado-body').innerHTML = bloqueado.map(f =>
        '<tr><td>' + f.fila + '</td><td>' + Util.escapeHtml(f.seller) + '</td><td>' + Util.escapeHtml(f.idPedido) + '</td>' +
        '<td><span class="badge badge-danger">' + Util.escapeHtml(f.motivo) + '</span></td>' +
        '<td><a class="btn btn-link btn-sm" href="' + f.link + '" target="_blank" rel="noopener">Ver en Sheet</a></td></tr>'
      ).join('') || '<tr><td colspan="5" class="text-muted">Sin casos bloqueados 🎉</td></tr>';

      document.getElementById('count-pendiente').textContent = pendienteAprobacion.length;
      document.getElementById('auditoria-pendiente-body').innerHTML = pendienteAprobacion.map(f =>
        '<tr><td>' + f.fila + '</td><td>' + Util.escapeHtml(f.seller) + '</td><td>' + Util.escapeHtml(f.idPedido) + '</td><td>' + Util.escapeHtml(f.estado) + '</td></tr>'
      ).join('');

      document.getElementById('count-procesado').textContent = yaProcesado.length;
      document.getElementById('auditoria-procesado-body').innerHTML = yaProcesado.map(f =>
        '<tr><td>' + f.fila + '</td><td>' + Util.escapeHtml(f.seller) + '</td><td>' + Util.escapeHtml(f.idPedido) + '</td></tr>'
      ).join('');
    });
  }

  // ── Tab: Pagos ────────────────────────────────────────────
  document.getElementById('btn-exportar-pagos').addEventListener('click', () => {
    const btn = document.getElementById('btn-exportar-pagos');
    Amp.setButtonLoading(btn, true);
    Api.get('exportarPendientesPago', { sesionAdmin: getSesion() }).then(res => {
      Amp.setButtonLoading(btn, false);
      if (!res.ok) { Amp.showToast('No se pudo exportar', 'danger'); return; }
      const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'pendientes_pago_' + Util.formatFecha(new Date().toISOString()).replace(/\//g, '-') + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  });

  document.getElementById('btn-importar-pagos').addEventListener('click', () => {
    const file = document.getElementById('input-csv-pagos').files[0];
    if (!file) { Amp.showToast('Selecciona un archivo CSV primero', 'warning'); return; }
    const btn = document.getElementById('btn-importar-pagos');
    Amp.setButtonLoading(btn, true);
    Util.fileToBase64(file)
      .then(b64 => Api.post('importarFechasPago', { archivoCsvBase64: b64, sesionAdmin: getSesion() }))
      .then(res => {
        Amp.setButtonLoading(btn, false);
        if (res.ok) Amp.showToast(res.data.aplicadas + ' fila(s) aplicadas', 'success');
        else Amp.showToast('No se pudo importar', 'danger');
      });
  });

  // ── Boot ──────────────────────────────────────────────────
  if (getSesion()) showShell(); else showGate();
})();
