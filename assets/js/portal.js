/**
 * portal.js — state machine del portal seller. El backend es la única autoridad:
 * ningún estado (firmada/vencida/etc.) se decide localmente sin una respuesta del servidor.
 */
(function () {
  let seller = null, token = null, sesionHistorico = null, notaActual = null;
  const cacheDocumentos = {}; // key: seller|idNota|cual -> {mimeType, base64, nombreArchivo} — inmutables, no expiran en la sesión

  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }

  function boot() {
    seller = Util.qs('seller');
    token = Util.qs('token');

    if (!seller) { showView('view-landing'); return; }

    if (token) {
      showView('view-loading');
      Api.get('getNota', { seller, token }).then(res => {
        if (res.ok) {
          notaActual = res.data;
          renderNota(res.data);
          showView('view-nota');
        } else if (res.error === 'token_expirado') {
          showView('view-token-expired');
        } else if (res.error === 'no_encontrado') {
          showView('view-not-found');
        } else {
          document.getElementById('generic-error-msg').textContent = 'No pudimos cargar tu Nota. Intenta nuevamente.';
          showView('view-generic-error');
        }
      });
    } else {
      showView('view-no-token');
    }
  }

  function renderNota(nota) {
    document.getElementById('nota-id').textContent = nota.id_nota;
    document.getElementById('nota-seller').textContent = nota.sellerNombre;
    document.getElementById('nota-estado-badge').textContent = nota.estado;
    document.getElementById('nota-periodo').textContent = nota.periodo || '';
    document.getElementById('nota-monto').textContent = nota.montoTotalFormateado;

    const tbody = document.getElementById('nota-casos-body');
    tbody.innerHTML = (nota.casos || []).map(c =>
      '<tr><td>' + Util.escapeHtml(c.id_pedido) + '</td><td>' + Util.formatCLP(c.monto) +
      '</td><td>' + Util.escapeHtml(c.responsable || '') + '</td></tr>'
    ).join('');

    // Colapsado por default — evita el scroll largo al abrir el link mágico.
    document.getElementById('nota-casos-wrap').classList.add('hidden');
    const btnToggleCasos = document.getElementById('btn-toggle-detalle-casos');
    btnToggleCasos.querySelector('.material-symbols-rounded').textContent = 'expand_more';
    btnToggleCasos.lastChild.textContent = ' Ver detalle de pedidos';

    const pendiente = document.getElementById('nota-firma-pendiente');
    const firmada = document.getElementById('nota-firmada');
    if (nota.firmada) {
      pendiente.classList.add('hidden');
      firmada.classList.remove('hidden');
      document.getElementById('nota-fecha-firma').textContent = Util.formatFecha(nota.fecha_firma);
    } else {
      pendiente.classList.remove('hidden');
      firmada.classList.add('hidden');
    }
  }

  function verArchivo(cual, sellerParam, idNota, tokenParam, sesionParam) {
    const label = (cual === 'firmado' ? 'Documento firmado' : 'Nota de Cobro') + ' — ' + idNota;
    Amp.openDocViewerLoading(label);

    const claveCache = sellerParam + '|' + idNota + '|' + cual;
    if (cacheDocumentos[claveCache]) {
      Amp.renderDocViewerContent(cacheDocumentos[claveCache]);
      return;
    }

    Api.get('descargarArchivo', { seller: sellerParam, idNota: idNota, cual: cual, token: tokenParam, sesion: sesionParam }).then(res => {
      if (!res.ok) { Amp.showDocViewerError(res.detalle || 'No se pudo cargar el documento'); return; }
      const datos = { mimeType: res.data.mimeType, base64: res.data.base64, fileName: res.data.nombreArchivo };
      cacheDocumentos[claveCache] = datos;
      Amp.renderDocViewerContent(datos);
    });
  }

  function subirFirmaNota(sellerParam, idNota, tokenParam, sesionParam, file, btn, onDone) {
    if (!file) { Amp.showToast('Selecciona un archivo primero', 'warning'); return; }
    if (['application/pdf', 'image/jpeg', 'image/png'].indexOf(file.type) === -1) {
      Amp.showToast('Debe ser un PDF, JPG o PNG', 'warning'); // cortesía de UX, el backend valida igual
    }
    Amp.setButtonLoading(btn, true);
    Util.fileToBase64(file)
      .then(b64 => Api.post('subirFirma', { seller: sellerParam, idNota: idNota, token: tokenParam, sesion: sesionParam, archivoBase64: b64 }))
      .then(res => {
        Amp.setButtonLoading(btn, false);
        if (res.ok) { Amp.showToast('Firma subida correctamente', 'success'); onDone && onDone(); }
        else Amp.showToast(res.detalle || 'No se pudo subir el archivo', 'danger');
      });
  }

  function cargarHistorial() {
    showView('view-loading');
    Api.get('listarNotasSeller', { seller: seller, sesion: sesionHistorico }).then(res => {
      if (!res.ok) {
        showView('view-otp-request');
        Amp.showToast('Tu sesión venció, solicita un código nuevo', 'warning');
        return;
      }
      renderHistorial(res.data);
      showView('view-historial');
    });
  }

  function renderHistorial(notas) {
    const cont = document.getElementById('historial-lista');
    cont.innerHTML = '';
    notas.forEach(nota => {
      const card = document.createElement('div');
      card.className = 'card historial-card';
      card.innerHTML =
        '<div class="card-head">' +
        '  <div>' +
        '    <div class="eyebrow">Nota N&deg; ' + Util.escapeHtml(nota.id_nota) + ' &middot; ' + Util.escapeHtml(nota.periodo || '') + '</div>' +
        '    <div style="font-size:18px;font-weight:700;">' + nota.montoTotalFormateado + '</div>' +
        '  </div>' +
        '  <span class="badge badge-ui">' + Util.escapeHtml(nota.estado) + '</span>' +
        (nota.origen === 'legacy' ? ' <span class="badge badge-warning">LEGACY</span>' : '') +
        '</div>' +
        '<div class="historial-detalle hidden">' +
        '  <div class="table-wrap" style="margin:12px 0;">' +
        '    <table class="table"><thead><tr><th>ID Pedido</th><th>Monto</th></tr></thead>' +
        '    <tbody>' + (nota.casos || []).map(c => '<tr><td>' + Util.escapeHtml(c.id_pedido) + '</td><td>' + Util.formatCLP(c.monto) + '</td></tr>').join('') + '</tbody></table>' +
        '  </div>' +
        '  <div class="row">' +
        '    <button class="btn btn-ghost btn-sm btn-ver-original">Ver original</button>' +
        (nota.firmada ? '    <button class="btn btn-ghost btn-sm btn-ver-firmado">Ver firmado</button>' : '') +
        '  </div>' +
        (!nota.firmada && nota.origen !== 'legacy' ?
          '  <div style="margin-top:12px;">' +
          '    <input type="file" class="input input-firma-historial" accept="application/pdf,image/jpeg,image/png">' +
          '    <button class="btn btn-primary btn-sm btn-subir-firma-historial" style="margin-top:8px;">Subir firma</button>' +
          '  </div>' : '') +
        '</div>';

      card.querySelector('.card-head').addEventListener('click', () => {
        card.querySelector('.historial-detalle').classList.toggle('hidden');
      });
      card.querySelector('.btn-ver-original').addEventListener('click', e => {
        e.stopPropagation();
        verArchivo('original', seller, nota.id_nota, null, sesionHistorico);
      });
      const btnFirmado = card.querySelector('.btn-ver-firmado');
      if (btnFirmado) btnFirmado.addEventListener('click', e => {
        e.stopPropagation();
        verArchivo('firmado', seller, nota.id_nota, null, sesionHistorico);
      });
      const btnSubir = card.querySelector('.btn-subir-firma-historial');
      if (btnSubir) btnSubir.addEventListener('click', e => {
        e.stopPropagation();
        const file = card.querySelector('.input-firma-historial').files[0];
        subirFirmaNota(seller, nota.id_nota, null, sesionHistorico, file, btnSubir, cargarHistorial);
      });

      cont.appendChild(card);
    });
  }

  // ── Wiring ──────────────────────────────────────────────
  document.getElementById('btn-toggle-detalle-casos').addEventListener('click', () => {
    const wrap = document.getElementById('nota-casos-wrap');
    const btn = document.getElementById('btn-toggle-detalle-casos');
    const expandido = wrap.classList.contains('hidden'); // va a quedar así tras el toggle
    wrap.classList.toggle('hidden');
    btn.querySelector('.material-symbols-rounded').textContent = expandido ? 'expand_less' : 'expand_more';
    btn.lastChild.textContent = expandido ? ' Ocultar detalle de pedidos' : ' Ver detalle de pedidos';
  });

  document.getElementById('btn-ver-original').addEventListener('click', () =>
    verArchivo('original', seller, notaActual.id_nota, token, sesionHistorico));

  document.getElementById('btn-ver-firmado').addEventListener('click', e => {
    e.preventDefault();
    verArchivo('firmado', seller, notaActual.id_nota, token, sesionHistorico);
  });

  document.getElementById('btn-subir-firma').addEventListener('click', () => {
    const file = document.getElementById('input-firma').files[0];
    const btn = document.getElementById('btn-subir-firma');
    subirFirmaNota(seller, notaActual.id_nota, token, sesionHistorico, file, btn, () => {
      Api.get('getNota', { seller, token }).then(r2 => { if (r2.ok) { notaActual = r2.data; renderNota(r2.data); } });
    });
  });

  ['btn-ver-historico-1', 'btn-ver-historico-2', 'btn-ver-historico-3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => showView('view-otp-request'));
  });

  document.getElementById('btn-enviar-otp').addEventListener('click', () => {
    const btn = document.getElementById('btn-enviar-otp');
    Amp.setButtonLoading(btn, true);
    Api.post('solicitarAccesoHistorico', { seller: seller }).then(res => {
      Amp.setButtonLoading(btn, false);
      if (res.ok) {
        showView('view-otp-verify');
        Amp.showToast('Código enviado a tu correo registrado', 'success');
      } else {
        const err = document.getElementById('otp-request-error');
        err.textContent = res.detalle || 'No se pudo enviar el código';
        err.classList.remove('hidden');
      }
    });
  });

  document.getElementById('btn-reenviar-otp').addEventListener('click', () => showView('view-otp-request'));

  document.getElementById('btn-verificar-otp').addEventListener('click', () => {
    const codigo = document.getElementById('input-otp').value.trim();
    const btn = document.getElementById('btn-verificar-otp');
    Amp.setButtonLoading(btn, true);
    Api.post('verificarCodigoHistorico', { seller: seller, codigo: codigo }).then(res => {
      Amp.setButtonLoading(btn, false);
      if (res.ok) {
        sesionHistorico = res.data.sesion;
        cargarHistorial();
      } else {
        const err = document.getElementById('otp-verify-error');
        if (res.error === 'otp_max_intentos') err.textContent = 'Máximo de intentos alcanzado, pide un código nuevo';
        else if (res.intentosRestantes !== undefined) err.textContent = 'Código incorrecto — ' + res.intentosRestantes + ' intento(s) restante(s)';
        else err.textContent = 'Código incorrecto';
        err.classList.remove('hidden');
      }
    });
  });

  document.addEventListener('DOMContentLoaded', boot);
})();
