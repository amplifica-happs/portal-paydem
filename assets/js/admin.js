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
  const cacheDocumentos = {}; // key: seller|idNota|cual -> {mimeType, base64, nombreArchivo} — inmutables, no expiran en la sesión

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
  function activarTab(btn) {
    document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(btn.dataset.tab).classList.remove('hidden');

    if (!tabsCargados[btn.dataset.tab]) {
      tabsCargados[btn.dataset.tab] = true;
      if (btn.dataset.tab === 'tab-generar') { cargarPreview(); cargarProveedoresPdf(); }
      if (btn.dataset.tab === 'tab-auditoria') cargarAuditoria();
      if (btn.dataset.tab === 'tab-pruebas') cargarNotasPrueba();
    }
  }
  function bindTabButton(btn) {
    btn.addEventListener('click', () => activarTab(btn));
  }
  document.querySelectorAll('.dash-tab').forEach(bindTabButton);

  // ── Easter egg: "Listado de Pruebas" — 5 clics seguidos en el logo del navbar.
  // No se persiste en sessionStorage/localStorage a propósito: al recargar la página
  // el tab y su contenido dejan de existir hasta repetir el gesto.
  let clicsLogo = 0;
  let ultimoClicLogo = 0;
  let pruebasTabCreada = false;
  let pruebasCtrl = null;

  document.querySelector('.amp-navbar').addEventListener('click', e => {
    if (!e.target.closest('.nav-logo')) return;
    const ahora = Date.now();
    clicsLogo = (ahora - ultimoClicLogo > 1200) ? 1 : clicsLogo + 1;
    ultimoClicLogo = ahora;
    if (clicsLogo >= 5) {
      clicsLogo = 0;
      if (!pruebasTabCreada) crearTabPruebas();
    }
  });

  function crearTabPruebas() {
    pruebasTabCreada = true;

    const btn = document.createElement('button');
    btn.className = 'btn dash-tab';
    btn.dataset.tab = 'tab-pruebas';
    btn.textContent = 'Pruebas';
    document.querySelector('.btn-group').appendChild(btn);
    bindTabButton(btn);

    const section = document.createElement('section');
    section.id = 'tab-pruebas';
    section.className = 'tab-section hidden';
    section.innerHTML =
      '<p class="text-muted" style="margin-bottom:16px;">Notas de prueba — namespace _pruebas, nunca entran al índice real.</p>' +
      '<div class="row" style="margin-bottom:16px;justify-content:space-between;">' +
      '<div class="row">' +
      '<input type="text" id="input-filtro-pruebas" class="input" placeholder="Buscar seller o N° Nota..." style="width:260px;">' +
      '<div id="filtro-sellers-pruebas"></div>' +
      '<div id="filtro-estados-pruebas"></div>' +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" id="btn-refrescar-pruebas"><span class="material-symbols-rounded">refresh</span> Refrescar</button>' +
      '</div>' +
      '<div class="table-wrap">' +
      '<table class="table"><thead><tr><th>N° Nota</th><th>Seller</th><th>Período</th><th>Estado</th><th>Monto</th></tr></thead>' +
      '<tbody id="pruebas-body"></tbody></table>' +
      '<div id="pruebas-paginacion"></div>' +
      '</div>';
    document.getElementById('view-admin-shell').appendChild(section);
    document.getElementById('btn-refrescar-pruebas').addEventListener('click', cargarNotasPrueba);

    pruebasCtrl = crearControladorListadoNotas_({
      tbodyId: 'pruebas-body', filtroInputId: 'input-filtro-pruebas',
      filtroSellersId: 'filtro-sellers-pruebas', filtroEstadosId: 'filtro-estados-pruebas',
      paginacionId: 'pruebas-paginacion',
      onRowClick: (seller, idNota) => abrirDetalleNotaPrueba(idNota),
      mostrarLegacy: false // las Notas de prueba nunca son legacy
    });

    Amp.showToast('Listado de Pruebas habilitado', 'success');
    activarTab(btn);
  }

  // ── Tab: Listado ──────────────────────────────────────────
  function poblarSelectAnio(id) {
    const sel = document.getElementById(id);
    const actual = new Date().getFullYear();
    sel.innerHTML = '';
    for (let a = actual; a >= actual - 3; a--) {
      const opt = document.createElement('option');
      opt.value = a; opt.textContent = a;
      sel.appendChild(opt);
    }
  }
  poblarSelectAnio('select-anio-reconstruir');
  poblarSelectAnio('select-anio');

  /**
   * Controlador de filtros (sellers + estado, vía Amp.multiSelect) + búsqueda de texto +
   * paginación (Amp.renderPagination) sobre una lista de Notas — compartido entre "Listado"
   * (Notas reales) y "Pruebas" (namespace _pruebas), que solo difieren en de dónde sacan los
   * datos y si muestran el badge LEGACY.
   */
  function crearControladorListadoNotas_({ tbodyId, filtroInputId, filtroSellersId, filtroEstadosId, paginacionId, onRowClick, mostrarLegacy }) {
    let notas = [];
    const filtros = { sellers: [], estados: [] };
    let pagina = 1;
    let pageSize = 20;
    let msSellers = null;
    let msEstados = null;

    function actualizarOpcionesFiltros() {
      const sellersUnicos = Array.from(new Set(notas.map(n => n.seller_nombre || n.seller))).sort();
      const estadosUnicos = Array.from(new Set(notas.map(n => n.estado).filter(Boolean))).sort();
      if (!msSellers) {
        msSellers = Amp.multiSelect(document.getElementById(filtroSellersId), {
          label: 'Sellers',
          options: sellersUnicos.map(s => ({ value: s, label: s })),
          onChange: sel => { filtros.sellers = sel; pagina = 1; aplicarFiltros(); }
        });
        msEstados = Amp.multiSelect(document.getElementById(filtroEstadosId), {
          label: 'Estado',
          options: estadosUnicos.map(e => ({ value: e, label: e })),
          onChange: sel => { filtros.estados = sel; pagina = 1; aplicarFiltros(); }
        });
      } else {
        msSellers.setOptions(sellersUnicos.map(s => ({ value: s, label: s })));
        msEstados.setOptions(estadosUnicos.map(e => ({ value: e, label: e })));
      }
    }

    function aplicarFiltros() {
      const q = document.getElementById(filtroInputId).value.toLowerCase();
      const sellersSet = new Set(filtros.sellers);
      const estadosSet = new Set(filtros.estados);
      const filtradas = notas.filter(n => {
        const nombreSeller = n.seller_nombre || n.seller || '';
        if (q && nombreSeller.toLowerCase().indexOf(q) === -1 && (n.id_nota || '').toLowerCase().indexOf(q) === -1) return false;
        if (sellersSet.size > 0 && !sellersSet.has(nombreSeller)) return false;
        if (estadosSet.size > 0 && !estadosSet.has(n.estado)) return false;
        return true;
      });

      const totalPaginas = Math.max(1, Math.ceil(filtradas.length / pageSize));
      pagina = Math.min(pagina, totalPaginas);
      const desde = (pagina - 1) * pageSize;
      renderFilas(filtradas.slice(desde, desde + pageSize));

      Amp.renderPagination(document.getElementById(paginacionId), {
        page: pagina, pageSize: pageSize, total: filtradas.length,
        onPageChange: p => { pagina = p; aplicarFiltros(); },
        onPageSizeChange: n => { pageSize = n; pagina = 1; aplicarFiltros(); }
      });
    }

    function renderFilas(lista) {
      const tbody = document.getElementById(tbodyId);
      tbody.innerHTML = lista.map(n =>
        '<tr class="fila-nota" data-seller="' + Util.escapeHtml(n.seller) + '" data-id-nota="' + Util.escapeHtml(n.id_nota) + '">' +
        '<td>' + Util.escapeHtml(n.id_nota) + '</td>' +
        '<td>' + Util.escapeHtml(n.seller_nombre || n.seller) + '</td>' +
        '<td>' + Util.escapeHtml(n.periodo || '') + '</td>' +
        '<td><span class="badge badge-ui">' + Util.escapeHtml(n.estado) + '</span>' +
        (mostrarLegacy && n.origen === 'legacy' ? ' <span class="badge badge-warning">LEGACY</span>' : '') + '</td>' +
        '<td>' + Util.formatCLP((n.casos || []).reduce((s, c) => s + (Number(c.monto) || 0), 0)) + '</td>' +
        '</tr>'
      ).join('') || '<tr><td colspan="5" class="text-muted" style="text-align:center;padding:24px;">Sin resultados para estos filtros</td></tr>';
      tbody.querySelectorAll('.fila-nota').forEach(tr => {
        tr.addEventListener('click', () => onRowClick(tr.dataset.seller, tr.dataset.idNota));
      });
    }

    document.getElementById(filtroInputId).addEventListener('input', Util.debounce(() => {
      pagina = 1;
      aplicarFiltros();
    }, 200));

    return {
      getNotas: () => notas,
      setNotas(nuevasNotas) {
        notas = nuevasNotas;
        actualizarOpcionesFiltros();
        pagina = 1;
        aplicarFiltros();
      }
    };
  }

  const listadoCtrl = crearControladorListadoNotas_({
    tbodyId: 'listado-body', filtroInputId: 'input-filtro-listado',
    filtroSellersId: 'filtro-sellers-listado', filtroEstadosId: 'filtro-estados-listado',
    paginacionId: 'listado-paginacion',
    onRowClick: (seller, idNota) => abrirDetalleNota(seller, idNota),
    mostrarLegacy: true
  });

  function cargarListado() {
    Amp.renderTableSkeleton(document.getElementById('listado-body'), { cols: 5 });
    const anio = document.getElementById('select-anio').value || new Date().getFullYear();
    Api.get('listarNotas', { anio: anio, sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar el listado', 'danger'); return; }
      listadoCtrl.setNotas(res.data.sort((a, b) => (b.id_nota || '').localeCompare(a.id_nota || '')));
    });
  }
  document.getElementById('select-anio').addEventListener('change', cargarListado);
  document.getElementById('btn-refrescar-listado').addEventListener('click', cargarListado);

  /**
   * `listadoCtrl` ya trae la Nota completa (viene del índice, que guarda copias completas —
   * ver listarNotasIndice_). Abrir el panel de inmediato con ese dato evita esperar el
   * round-trip de getNotaVerificada (lento en Notas legacy por la reparación de rev que
   * hace esa llamada) — la verificación se dispara igual, pero en segundo plano.
   */
  let detalleAbiertoActual = null;

  const ESTADOS_REGENERABLES_ = ['Generada', 'Enviada', 'Vista', 'Token Expirado'];

  /**
   * Bloque de información + tabla de casos, compartido entre el panel de detalle del Listado
   * (con botones de acción alrededor) y la vista de solo-lectura de "Listado de Pruebas"
   * (sin botones de acción, sin llamar nunca a getNotaVerificada — ver abrirDetalleNotaPrueba).
   */
  function construirInfoNotaHtml_(nota) {
    const montoTotal = (nota.casos || []).reduce((s, c) => s + (Number(c.monto) || 0), 0);
    const puedeCopiarLink = nota.origen !== 'legacy' && !!nota.token && !!nota.token_expira;
    const linkAcceso = puedeCopiarLink ? (CONFIG.FRONTEND_BASE_URL + '?seller=' + encodeURIComponent(nota.seller) + '&token=' + nota.token) : '';
    return (
      '<div><span class="badge badge-ui">' + Util.escapeHtml(nota.estado) + '</span>' +
      (nota.origen === 'legacy' ? ' <span class="badge badge-warning">LEGACY — importada del sistema anterior</span>' : '') + '</div>' +
      '<div class="detalle-grid">' +
      '<div class="field"><div class="field-label">Seller</div><div>' + Util.escapeHtml(nota.seller_nombre || nota.seller) + '</div></div>' +
      '<div class="field"><div class="field-label">Período</div><div>' + Util.escapeHtml(nota.periodo || '') + '</div></div>' +
      '<div class="field"><div class="field-label">Monto Total</div><div class="detalle-monto">' + Util.formatCLP(montoTotal) + '</div></div>' +
      '<div class="field"><div class="field-label">Fecha generada</div><div>' + Util.escapeHtml(nota.fecha_generada || '') + '</div></div>' +
      (nota.token_expira ? '<div class="field"><div class="field-label">Fecha expiración del link</div><div>' + Util.formatFecha(nota.token_expira) + '</div></div>' : '') +
      '<div class="field"><div class="field-label">Fecha firma</div><div>' + Util.escapeHtml(nota.fecha_firma || '—') + '</div></div>' +
      (nota.veces_regenerado ? '<div class="field" style="grid-column:1/-1;"><div class="field-label">Regenerada</div><div>' + nota.veces_regenerado + ' vez(es) — última: ' + Util.escapeHtml(nota.fecha_ultima_regeneracion || '') + '</div></div>' : '') +
      '</div>' +
      '<div class="row" style="gap:8px;">' +
      (puedeCopiarLink ? '<button class="btn btn-ghost btn-sm js-copy" data-copy="' + Util.escapeHtml(linkAcceso) + '">Copiar link de acceso</button>' : '') +
      '<button class="btn btn-ghost btn-sm" id="dp-ver-original">Ver Nota de Cobro</button>' +
      (nota.pdf_firmado_id ? '<button class="btn btn-ghost btn-sm" id="dp-ver-firmado">Ver firmado</button>' : '') +
      '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>ID Pedido</th><th>Monto</th></tr></thead><tbody>' +
      (nota.casos || []).map(c => '<tr><td>' + Amp.copyable(c.id_pedido) + '</td><td>' + Util.formatCLP(c.monto) + '</td></tr>').join('') +
      '</tbody></table></div>'
    );
  }

  function construirDetalleNotaHtml(nota, verificando) {
    const puedeRegenerar = nota.origen !== 'legacy' && ESTADOS_REGENERABLES_.indexOf(nota.estado) !== -1;
    return (
      '<div class="col" style="gap:var(--sp-5);">' +
      (verificando ? '<div class="row" style="gap:6px;"><span class="amp-spinner sm"></span><span class="text-muted" style="font-size:12px;">Verificando…</span></div>' : '') +
      construirInfoNotaHtml_(nota) +
      '<div class="row" style="gap:8px;">' +
      (nota.estado === 'Generada' ? '<button class="btn btn-primary btn-sm" id="dp-enviar-pendiente">Enviar por correo</button>' : '') +
      (puedeRegenerar ? '<button class="btn btn-ghost btn-sm" id="dp-regenerar">Regenerar</button>' : '') +
      '</div>' +
      '<div id="dp-regenerar-panel" class="hidden"></div>' +
      (nota.estado === 'Firmada' ?
        '<div class="field"><div class="field-label">Marcar pago programado</div>' +
        '<input type="date" id="dp-fecha-pago" class="input"><button class="btn btn-primary btn-sm" id="dp-marcar-pago" style="margin-top:8px;">Marcar</button></div>' : '') +
      '</div>'
    );
  }

  function construirDiffRegeneracionHtml_(diff) {
    const filaCaso = (c, signo) => '<tr><td>' + signo + ' ' + Amp.copyable(c.id_pedido) + '</td><td>' + Util.formatCLP(c.monto) + '</td></tr>';
    const sinCambios = diff.agregados.length === 0 && diff.removidos.length === 0;
    return (
      '<div class="alert alert-warning" style="margin-top:12px;">' +
      '<div style="margin-bottom:8px;">Monto anterior: ' + Util.escapeHtml(diff.montoAnterior) + ' → Monto nuevo: ' + Util.escapeHtml(diff.montoNuevo) + '</div>' +
      (sinCambios ? '<div class="text-muted">Sin cambios en los casos — solo se reconstruye el PDF.</div>' :
        '<div class="table-wrap"><table class="table"><tbody>' +
        diff.agregados.map(c => filaCaso(c, '+')).join('') +
        diff.removidos.map(c => filaCaso(c, '−')).join('') +
        '</tbody></table></div>') +
      '<div class="row" style="gap:8px;margin-top:12px;">' +
      '<button class="btn btn-primary btn-sm" id="dp-confirmar-regenerar">Confirmar regeneración</button>' +
      '<button class="btn btn-ghost btn-sm" id="dp-cancelar-regenerar">Cancelar</button>' +
      '</div></div>'
    );
  }

  function bindVerArchivoHandlers_(seller, idNota) {
    document.getElementById('dp-ver-original').addEventListener('click', () => verArchivoAdmin('original', seller, idNota));
    const btnFirmado = document.getElementById('dp-ver-firmado');
    if (btnFirmado) btnFirmado.addEventListener('click', () => verArchivoAdmin('firmado', seller, idNota));
  }

  function bindDetalleNotaHandlers(seller, idNota) {
    bindVerArchivoHandlers_(seller, idNota);
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

    const btnEnviarPendiente = document.getElementById('dp-enviar-pendiente');
    if (btnEnviarPendiente) btnEnviarPendiente.addEventListener('click', () => {
      Amp.setButtonLoading(btnEnviarPendiente, true);
      Api.post('enviarNotaPendiente', { seller: seller, idNota: idNota, sesionAdmin: getSesion() }).then(r => {
        Amp.setButtonLoading(btnEnviarPendiente, false);
        if (r.ok) { Amp.showToast('Nota enviada por correo', 'success'); Amp.closeSidePanel(); cargarListado(); }
        else Amp.showToast(r.detalle || 'No se pudo enviar la Nota', 'danger');
      });
    });

    const btnRegenerar = document.getElementById('dp-regenerar');
    if (btnRegenerar) btnRegenerar.addEventListener('click', () => {
      Amp.setButtonLoading(btnRegenerar, true);
      Api.get('previsualizarRegeneracion', { seller: seller, idNota: idNota, sesionAdmin: getSesion() }).then(res => {
        Amp.setButtonLoading(btnRegenerar, false);
        if (!res.ok) { Amp.showToast(res.detalle || 'No se pudo previsualizar la regeneración', 'danger'); return; }

        const panel = document.getElementById('dp-regenerar-panel');
        panel.classList.remove('hidden');
        panel.innerHTML = construirDiffRegeneracionHtml_(res.data);

        document.getElementById('dp-cancelar-regenerar').addEventListener('click', () => {
          panel.classList.add('hidden');
          panel.innerHTML = '';
        });
        const btnConfirmar = document.getElementById('dp-confirmar-regenerar');
        btnConfirmar.addEventListener('click', () => {
          Amp.setButtonLoading(btnConfirmar, true);
          Api.post('regenerarNota', { seller: seller, idNota: idNota, sesionAdmin: getSesion() }).then(r => {
            Amp.setButtonLoading(btnConfirmar, false);
            if (!r.ok) { Amp.showToast(r.detalle || 'No se pudo regenerar la Nota', 'danger'); return; }
            Amp.showToast(
              r.data.estado === 'Enviada' ? 'Nota regenerada — se reenvió el aviso en el mismo hilo de correo' : 'Nota regenerada',
              'success'
            );
            Amp.closeSidePanel();
            cargarListado();
          });
        });
      });
    });
  }

  function abrirDetalleNota(seller, idNota) {
    const clave = seller + '|' + idNota;
    detalleAbiertoActual = clave;
    const cacheada = listadoCtrl.getNotas().find(n => n.seller === seller && n.id_nota === idNota);

    if (cacheada) {
      Amp.openSidePanel({ title: 'Indemnizaciones Caso N° ' + idNota, html: construirDetalleNotaHtml(cacheada, true) });
      bindDetalleNotaHandlers(seller, idNota);
    } else {
      Amp.openSidePanel({ title: 'Indemnizaciones Caso N° ' + idNota, html: '<div class="row" style="justify-content:center;padding:40px;"><span class="amp-spinner lg"></span></div>' });
    }

    Api.get('getNotaVerificada', { seller: seller, idNota: idNota, sesionAdmin: getSesion() }).then(res => {
      if (detalleAbiertoActual !== clave) return; // el admin ya abrió otra Nota mientras tanto
      if (!res.ok) {
        if (!cacheada) Amp.showToast('No se pudo cargar la Nota', 'danger');
        return;
      }
      const nota = res.data;
      Amp.openSidePanel({ title: 'Indemnizaciones Caso N° ' + nota.id_nota, html: construirDetalleNotaHtml(nota, false) });
      bindDetalleNotaHandlers(seller, idNota);
    });
  }

  function verArchivoAdmin(cual, seller, idNota) {
    const label = (cual === 'firmado' ? 'Documento firmado' : 'Nota de Cobro') + ' — ' + idNota;
    Amp.openDocViewerLoading(label);

    const claveCache = seller + '|' + idNota + '|' + cual;
    if (cacheDocumentos[claveCache]) {
      Amp.renderDocViewerContent(cacheDocumentos[claveCache]);
      return;
    }

    Api.get('descargarArchivo', { seller: seller, idNota: idNota, cual: cual, sesion: getSesion() }).then(res => {
      if (!res.ok) { Amp.showDocViewerError(res.detalle || 'No se pudo cargar el documento'); return; }
      const datos = { mimeType: res.data.mimeType, base64: res.data.base64, fileName: res.data.nombreArchivo };
      cacheDocumentos[claveCache] = datos;
      Amp.renderDocViewerContent(datos);
    });
  }

  // ── Tab: Generar Notas ────────────────────────────────────
  document.getElementById('toggle-modo-prueba').addEventListener('change', e => {
    document.getElementById('alerta-modo-prueba').classList.toggle('hidden', !e.target.checked);
  });

  function cargarProveedoresPdf() {
    const select = document.getElementById('select-proveedor-pdf');
    if (select.options.length > 0) return; // ya poblado, no repetir la llamada
    Api.get('listarProveedoresPdf', { sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) return;
      select.innerHTML = res.data.map(p => '<option value="' + Util.escapeHtml(p.id) + '">' + Util.escapeHtml(p.nombre) + '</option>').join('');
    });
  }

  function cargarPreview() {
    Api.get('previsualizarNotas', { sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar el preview', 'danger'); return; }
      preview = res.data;
      renderPreview();
    });
  }

  function toggleSellerRow(row, forzarExpandido) {
    const body = row.querySelector('.seller-row-body');
    const icon = row.querySelector('.seller-row-toggle .material-symbols-rounded');
    const expandido = forzarExpandido !== undefined ? forzarExpandido : body.classList.contains('hidden');
    body.classList.toggle('hidden', !expandido);
    icon.textContent = expandido ? 'expand_less' : 'expand_more';
  }

  function actualizarResumenSeleccionGenerar() {
    const total = document.querySelectorAll('.chk-seller').length;
    const seleccionados = document.querySelectorAll('.chk-seller:checked').length;
    document.getElementById('generar-seleccion-resumen').textContent = seleccionados + ' de ' + total + ' seller(s) seleccionados';
  }

  function renderPreview() {
    const cont = document.getElementById('generar-lista');
    cont.innerHTML = '';
    preview.sellers.forEach(s => {
      const esMissing = preview.missingSellers.indexOf(s.sellerNombre) !== -1;
      const esBadBank = preview.badBankSellers.indexOf(s.sellerNombre) !== -1;
      const necesitaAtencion = esMissing || esBadBank;

      const row = document.createElement('div');
      row.className = 'seller-row';
      row.dataset.seller = s.seller;
      row.innerHTML =
        '<div class="seller-row-head">' +
        '<label class="checkbox seller-row-check"><input type="checkbox" class="chk-seller" data-seller="' + Util.escapeHtml(s.seller) + '" checked><span class="checkbox-box"></span></label>' +
        '<div class="seller-row-info">' +
        '<div class="seller-row-name">' + Util.escapeHtml(s.sellerNombre) +
        (esMissing ? ' <span class="badge badge-danger">Seller no encontrado en Datos Bancarios</span>' : '') +
        (esBadBank ? ' <span class="badge badge-danger">Falta info bancaria</span>' : '') +
        '<span class="seller-row-result-badge"></span>' +
        '</div>' +
        '<div class="text-muted seller-row-meta">' + s.casos.length + ' pedido(s) · Total ' + Util.formatCLP(s.montoTotal) + ' · ' + Util.escapeHtml(s.razonSocial) + '</div>' +
        '</div>' +
        '<button type="button" class="btn btn-icon btn-ghost seller-row-toggle"><span class="material-symbols-rounded">' + (necesitaAtencion ? 'expand_less' : 'expand_more') + '</span></button>' +
        '</div>' +
        '<div class="seller-row-body' + (necesitaAtencion ? '' : ' hidden') + '">' +
        '<div class="text-muted" style="font-size:13px;margin-bottom:8px;">' + Util.escapeHtml(s.banco) + ' · ' + Util.escapeHtml(s.cuenta) + ' · ' + Util.escapeHtml(s.rut) + '</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>ID Pedido</th><th>Monto</th></tr></thead><tbody>' +
        s.casos.map(c => '<tr><td>' + Amp.copyable(c.idPedido) + '</td><td>' + Util.formatCLP(c.monto) + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<div class="seller-row-result"></div>' +
        '</div>';

      const chk = row.querySelector('.chk-seller');
      chk.addEventListener('change', () => { row.classList.toggle('is-deselected', !chk.checked); actualizarResumenSeleccionGenerar(); });

      row.querySelector('.seller-row-head').addEventListener('click', e => {
        if (e.target.closest('.seller-row-check')) return;
        toggleSellerRow(row);
      });

      cont.appendChild(row);
    });
    actualizarResumenSeleccionGenerar();
  }
  document.getElementById('btn-refrescar-preview').addEventListener('click', cargarPreview);

  document.getElementById('btn-seleccionar-todos').addEventListener('click', () => {
    document.querySelectorAll('.chk-seller').forEach(chk => { chk.checked = true; chk.closest('.seller-row').classList.remove('is-deselected'); });
    actualizarResumenSeleccionGenerar();
  });
  document.getElementById('btn-limpiar-seleccion').addEventListener('click', () => {
    document.querySelectorAll('.chk-seller').forEach(chk => { chk.checked = false; chk.closest('.seller-row').classList.add('is-deselected'); });
    actualizarResumenSeleccionGenerar();
  });

  /** Pinta el resultado de generación directamente en la fila del seller (sin lista aparte) y la expande. */
  function aplicarResultadoGeneracion_(r) {
    const row = Array.from(document.querySelectorAll('.seller-row')).find(el => el.dataset.seller === r.seller);
    if (!row) return;

    row.querySelector('.seller-row-result-badge').innerHTML = r.ok
      ? ' <span class="badge badge-success">Nota N° ' + Util.escapeHtml(r.idNota) + '</span>'
      : ' <span class="badge badge-danger">Error</span>';

    const mensajeExito = r.estado === 'Generada' ? ' generada — pendiente de envío' : ' generada y enviada';
    const resultCont = row.querySelector('.seller-row-result');
    resultCont.innerHTML =
      '<div class="alert ' + (r.ok ? 'alert-success' : 'alert-danger') + '" style="margin-top:12px;">' +
      (r.ok
        ? '<span class="material-symbols-rounded icon-fill">check_circle</span><span>Nota N° ' + Util.escapeHtml(r.idNota) + mensajeExito + '</span>' +
          ' <button class="btn btn-ghost btn-sm btn-ver-generada" data-seller="' + Util.escapeHtml(r.seller) + '" data-id-nota="' + Util.escapeHtml(r.idNota) + '">Previsualizar</button>'
        : '<span class="material-symbols-rounded">error</span><span>Error: ' + Util.escapeHtml(r.error) + '</span>') +
      '</div>';

    const btnVer = resultCont.querySelector('.btn-ver-generada');
    if (btnVer) btnVer.addEventListener('click', () => verArchivoAdmin('original', btnVer.dataset.seller, btnVer.dataset.idNota));

    toggleSellerRow(row, true);
  }

  document.getElementById('btn-confirmar-generacion').addEventListener('click', () => {
    const seleccionados = Array.from(document.querySelectorAll('.chk-seller:checked')).map(c => c.dataset.seller);
    if (seleccionados.length === 0) { Amp.showToast('Selecciona al menos un seller', 'warning'); return; }
    const modoPrueba = document.getElementById('toggle-modo-prueba').checked;
    const accion = modoPrueba ? 'generarNotasModoPrueba' : 'generarNotas';
    const proveedorPreferido = document.getElementById('select-proveedor-pdf').value;
    const enviarInmediato = document.getElementById('toggle-enviar-inmediato').checked;

    document.getElementById('generar-progreso').classList.remove('hidden');
    document.getElementById('btn-confirmar-generacion').disabled = true;

    Api.post(accion, { sellersSeleccionados: seleccionados, proveedorPreferido: proveedorPreferido, enviarInmediato: enviarInmediato, sesionAdmin: getSesion() }).then(res => {
      document.getElementById('generar-progreso').classList.add('hidden');
      document.getElementById('btn-confirmar-generacion').disabled = false;
      if (!res.ok) { Amp.showToast(res.detalle || 'No se pudo generar', 'danger'); return; }

      res.data.forEach(aplicarResultadoGeneracion_);

      const huboFallos = res.data.some(r => !r.ok);
      if (huboFallos) Amp.showToast('Generación completada con errores — revisa el detalle en cada seller', 'warning');
      else Amp.showToast('Generación completada', 'success');
      tabsCargados['tab-listado'] = false; // forzar recarga la próxima vez que se visite
    });
  });

  // ── Tab: Auditoría ────────────────────────────────────────
  let auditoriaData = { yaProcesado: [], pendienteAprobacion: [], bloqueado: [] };
  let msSellersAuditoria = null;
  const auditoriaFiltro = { sellers: [] };
  const auditoriaPaginas = { bloqueado: 1, pendiente: 1, procesado: 1 };
  const auditoriaPageSize = { bloqueado: 20, pendiente: 20, procesado: 20 };

  function cargarAuditoria() {
    Amp.renderTableSkeleton(document.getElementById('auditoria-bloqueado-body'), { cols: 5 });
    Amp.renderTableSkeleton(document.getElementById('auditoria-pendiente-body'), { cols: 4 });
    Amp.renderTableSkeleton(document.getElementById('auditoria-procesado-body'), { cols: 3 });
    Api.get('listarCasosNoElegibles', { sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar la auditoría', 'danger'); return; }
      auditoriaData = res.data;
      document.getElementById('count-pendiente').textContent = auditoriaData.pendienteAprobacion.length;
      document.getElementById('count-procesado').textContent = auditoriaData.yaProcesado.length;

      const sellersUnicos = Array.from(new Set(
        [].concat(auditoriaData.bloqueado, auditoriaData.pendienteAprobacion, auditoriaData.yaProcesado).map(f => f.seller)
      )).sort();
      if (!msSellersAuditoria) {
        msSellersAuditoria = Amp.multiSelect(document.getElementById('filtro-sellers-auditoria'), {
          label: 'Sellers',
          options: sellersUnicos.map(s => ({ value: s, label: s })),
          onChange: sel => {
            auditoriaFiltro.sellers = sel;
            auditoriaPaginas.bloqueado = auditoriaPaginas.pendiente = auditoriaPaginas.procesado = 1;
            renderAuditoria();
          }
        });
      } else {
        msSellersAuditoria.setOptions(sellersUnicos.map(s => ({ value: s, label: s })));
      }
      renderAuditoria();
    });
  }

  function filtrarAuditoriaPorSeller_(lista) {
    if (auditoriaFiltro.sellers.length === 0) return lista;
    const set = new Set(auditoriaFiltro.sellers);
    return lista.filter(f => set.has(f.seller));
  }

  function renderTablaAuditoriaPaginada_(config) {
    const filtrada = filtrarAuditoriaPorSeller_(config.lista);
    const totalPaginas = Math.max(1, Math.ceil(filtrada.length / auditoriaPageSize[config.pageKey]));
    auditoriaPaginas[config.pageKey] = Math.min(auditoriaPaginas[config.pageKey], totalPaginas);
    const desde = (auditoriaPaginas[config.pageKey] - 1) * auditoriaPageSize[config.pageKey];
    const slice = filtrada.slice(desde, desde + auditoriaPageSize[config.pageKey]);

    const mensajeVacio = filtrada.length === 0 && config.lista.length > 0 ? 'Sin resultados para estos filtros' : config.vacioHtml;
    document.getElementById(config.tbodyId).innerHTML = slice.map(config.filaHtml).join('') ||
      '<tr><td colspan="' + config.colspan + '" class="text-muted" style="text-align:center;padding:24px;">' + mensajeVacio + '</td></tr>';

    Amp.renderPagination(document.getElementById(config.paginacionId), {
      page: auditoriaPaginas[config.pageKey], pageSize: auditoriaPageSize[config.pageKey], total: filtrada.length,
      onPageChange: p => { auditoriaPaginas[config.pageKey] = p; renderTablaAuditoriaPaginada_(config); },
      onPageSizeChange: n => { auditoriaPageSize[config.pageKey] = n; auditoriaPaginas[config.pageKey] = 1; renderTablaAuditoriaPaginada_(config); }
    });
  }

  function renderAuditoria() {
    renderTablaAuditoriaPaginada_({
      lista: auditoriaData.bloqueado, tbodyId: 'auditoria-bloqueado-body', paginacionId: 'auditoria-bloqueado-paginacion',
      pageKey: 'bloqueado', colspan: 5,
      filaHtml: f => '<tr><td>' + f.fila + '</td><td>' + Util.escapeHtml(f.seller) + '</td><td>' + Amp.copyable(f.idPedido) + '</td>' +
        '<td><span class="badge badge-danger">' + Util.escapeHtml(f.motivo) + '</span></td>' +
        '<td><a class="btn btn-link btn-sm" href="' + f.link + '" target="_blank" rel="noopener">Ver en Sheet</a></td></tr>',
      vacioHtml: 'Sin casos bloqueados 🎉'
    });
    renderTablaAuditoriaPaginada_({
      lista: auditoriaData.pendienteAprobacion, tbodyId: 'auditoria-pendiente-body', paginacionId: 'auditoria-pendiente-paginacion',
      pageKey: 'pendiente', colspan: 4,
      filaHtml: f => '<tr><td>' + f.fila + '</td><td>' + Util.escapeHtml(f.seller) + '</td><td>' + Amp.copyable(f.idPedido) + '</td><td>' + Util.escapeHtml(f.estado) + '</td></tr>',
      vacioHtml: 'Sin casos pendientes'
    });
    renderTablaAuditoriaPaginada_({
      lista: auditoriaData.yaProcesado, tbodyId: 'auditoria-procesado-body', paginacionId: 'auditoria-procesado-paginacion',
      pageKey: 'procesado', colspan: 3,
      filaHtml: f => '<tr><td>' + f.fila + '</td><td>' + Util.escapeHtml(f.seller) + '</td><td>' + Amp.copyable(f.idPedido) + '</td></tr>',
      vacioHtml: 'Sin casos procesados'
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

  // ── Tab: Herramientas ─────────────────────────────────────
  document.getElementById('btn-reconstruir-indice').addEventListener('click', () => {
    const anio = document.getElementById('select-anio-reconstruir').value;
    const btn = document.getElementById('btn-reconstruir-indice');
    Amp.setButtonLoading(btn, true);
    Api.post('reconstruirIndiceAdmin', { anio: anio, sesionAdmin: getSesion() }).then(res => {
      Amp.setButtonLoading(btn, false);
      if (res.ok) {
        Amp.showToast('Índice ' + anio + ' reconstruido — ' + res.data.total + ' Nota(s)', 'success');
        tabsCargados['tab-listado'] = false; // forzar recarga la próxima vez que se visite
      } else {
        Amp.showToast(res.detalle || 'No se pudo reconstruir el índice', 'danger');
      }
    });
  });

  // Flujo en dos pasos (preparar + procesar un seller a la vez) — evita acercarse al
  // límite de 6 min de Apps Script y da progreso real en vez de un spinner ciego.
  document.getElementById('btn-migrar-legacy').addEventListener('click', () => {
    const confirmado = window.confirm(
      'Esto va a mover carpetas y archivos reales en Drive (carpetas de año hacia Notas/, ' +
      'PDFs legacy sueltos hacia Generadas/) y crear registros históricos marcados como LEGACY. ' +
      'Es seguro correrlo más de una vez. ¿Continuar?'
    );
    if (!confirmado) return;

    const btn = document.getElementById('btn-migrar-legacy');
    const logBox = document.getElementById('migrar-legacy-log');
    const progresoBox = document.getElementById('migrar-legacy-progreso');
    const progressBar = document.getElementById('migrar-legacy-progress-bar');
    const progressTexto = document.getElementById('migrar-legacy-progress-texto');

    Amp.setButtonLoading(btn, true);
    logBox.classList.add('hidden');
    logBox.innerHTML = '';
    progresoBox.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressTexto.textContent = 'Preparando…';

    const agregarLog = lineas => {
      logBox.classList.remove('hidden');
      lineas.forEach(linea => {
        const span = document.createElement('span');
        span.className = 'terminal-line';
        span.textContent = linea;
        logBox.appendChild(span);
      });
      logBox.scrollTop = logBox.scrollHeight;
    };

    Api.post('prepararMigracionLegacyAdmin', { sesionAdmin: getSesion() }).then(prepRes => {
      if (!prepRes.ok) {
        Amp.setButtonLoading(btn, false);
        Amp.showToast(prepRes.detalle || 'No se pudo preparar la migración', 'danger');
        return;
      }
      agregarLog(prepRes.data.log);

      const pendientes = prepRes.data.pendientes;
      const total = pendientes.length;
      let procesados = 0, totalMigradas = 0, totalFallidas = 0;

      if (total === 0) {
        Amp.setButtonLoading(btn, false);
        progressTexto.textContent = 'Nada pendiente';
        progressBar.style.width = '100%';
        Amp.showToast('No había Notas legacy pendientes de migrar', 'success');
        return;
      }
      progressTexto.textContent = '0 / ' + total + ' sellers';

      function procesarSiguiente() {
        if (procesados >= total) {
          Amp.setButtonLoading(btn, false);
          const resumen = totalMigradas + ' Nota(s) legacy migrada(s)' +
            (totalFallidas > 0 ? ', ' + totalFallidas + ' fallida(s) — revisa el log' : '');
          Amp.showToast(resumen, totalFallidas > 0 ? 'warning' : 'success');
          tabsCargados['tab-listado'] = false;
          return;
        }

        const item = pendientes[procesados];
        Api.post('migrarUnSellerLegacyAdmin', { anio: item.anio, sellerFolder: item.sellerFolder, sesionAdmin: getSesion() })
          .then(res => {
            if (res.ok) {
              totalMigradas += res.data.migradas;
              totalFallidas += res.data.fallidas;
              agregarLog(res.data.log);
            } else {
              totalFallidas++;
              agregarLog(['ERROR: ' + item.sellerFolder + ' (' + item.anio + '): ' + (res.detalle || 'falló la llamada')]);
            }
            procesados++;
            progressBar.style.width = Math.round((procesados / total) * 100) + '%';
            progressTexto.textContent = procesados + ' / ' + total + ' sellers';
            procesarSiguiente();
          });
      }
      procesarSiguiente();
    });
  });

  // ── Tab: Pruebas (creado dinámicamente, ver crearTabPruebas) ──────────────
  function cargarNotasPrueba() {
    Amp.renderTableSkeleton(document.getElementById('pruebas-body'), { cols: 5 });
    Api.get('listarNotasPrueba', { sesionAdmin: getSesion() }).then(res => {
      if (!res.ok) { Amp.showToast('No se pudo cargar el listado de pruebas', 'danger'); return; }
      pruebasCtrl.setNotas(res.data.sort((a, b) => (b.id_nota || '').localeCompare(a.id_nota || '')));
    });
  }

  /**
   * Solo lectura a propósito: pinta directo el dato ya cargado, sin llamar nunca a
   * getNotaVerificada (para storageKey '_pruebas' esa función terminaría escribiendo la
   * Nota de prueba en el índice REAL, rompiendo el aislamiento — ver TrackingService.gs)
   * ni mostrar los botones de enviar/regenerar/marcar pago de construirDetalleNotaHtml.
   */
  function abrirDetalleNotaPrueba(idNota) {
    const nota = pruebasCtrl.getNotas().find(n => n.id_nota === idNota);
    if (!nota) return;
    Amp.openSidePanel({ title: 'Indemnizaciones Caso N° ' + idNota, html: construirInfoNotaHtml_(nota) });
    bindVerArchivoHandlers_(nota.seller, idNota);
  }

  // ── Boot ──────────────────────────────────────────────────
  if (getSesion()) showShell(); else showGate();
})();
