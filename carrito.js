// ============================================================================
//  CARRITO DE COSA BONITA
// ----------------------------------------------------------------------------
//  POR QUE ES UN ARCHIVO APARTE: la pagina la escribe tienda.mjs dentro de una
//  plantilla, y meter aqui dentro mas JavaScript obligaba a escapar cada
//  comilla. Asi se puede leer, probar y corregir como codigo normal.
//
//  DE DONDE SACA LOS DATOS: del bloque <script id="datos-tienda"> que escribe
//  tienda.mjs. Nunca de variables globales de la pagina.
//
//  LO QUE NO HACE A PROPOSITO: no calcula el total para cobrarlo. El total que
//  se ve aqui es informativo; cuando se pulsa "Pagar", el servidor vuelve a
//  sumar los precios desde el catalogo publicado. Si alguien edita el precio
//  en el navegador, el cobro no cambia.
// ============================================================================
(function () {
  'use strict';

  var datos = {};
  try { datos = JSON.parse(document.getElementById('datos-tienda').textContent); } catch (e) { return; }
  var PIEZAS = datos.piezas || [];
  var PAGOS = datos.pagos || {};
  var LLAVE = 'cosabonita.carrito.v1';

  var pesos = function (n) { return '$' + Number(n || 0).toLocaleString('es-CO'); };
  var piezaDe = function (id) { for (var i = 0; i < PIEZAS.length; i++) if (PIEZAS[i].id === id) return PIEZAS[i]; return null; };

  // --- lo que hay en el carrito -------------------------------------------
  // Se guarda en el navegador para que no se pierda al recargar. Si el
  // navegador no deja guardar (modo privado), el carrito sigue funcionando:
  // solo se olvida al cerrar.
  var items = [];
  try { items = JSON.parse(localStorage.getItem(LLAVE)) || []; } catch (e) { items = []; }
  items = items.filter(function (it) { return piezaDe(it.id); });

  var guardar = function () { try { localStorage.setItem(LLAVE, JSON.stringify(items)); } catch (e) {} };
  var totalPiezas = function () { return items.reduce(function (n, it) { return n + it.cantidad; }, 0); };
  var totalPesos = function () {
    return items.reduce(function (n, it) { var p = piezaDe(it.id); return n + (p ? p.precio * it.cantidad : 0); }, 0);
  };

  // --- la cajita ------------------------------------------------------------
  var $ = function (s) { return document.querySelector(s); };
  var boton = $('#carrito-boton'), fondo = $('#carrito'), lista = $('#carrito-lista');
  var elTotal = $('#carrito-total'), elAviso = $('#carrito-aviso');
  var elPagar = $('#carrito-pagar'), elWa = $('#carrito-whatsapp');
  if (!boton || !fondo) return;

  function pintar() {
    var n = totalPiezas();
    boton.dataset.hay = n ? 'si' : 'no';
    $('#carrito-cuenta').textContent = String(n);
    $('#carrito-resumen').textContent = pesos(totalPesos());

    if (!items.length) {
      lista.innerHTML = '<li class="carrito-vacio">Todavia no has puesto nada.</li>';
    } else {
      lista.innerHTML = items.map(function (it, i) {
        var p = piezaDe(it.id);
        return '<li class="carrito-linea">' +
          '<img src="' + p.fotos[0] + '" alt="">' +
          '<div class="carrito-datos">' +
            '<h3>' + p.nombre + '</h3>' +
            '<div class="col">' + it.color + '</div>' +
            '<div class="uni">' + pesos(p.precio) + ' cada una</div>' +
            '<div class="carrito-cant">' +
              '<button data-menos="' + i + '" aria-label="Una menos">-</button>' +
              '<span>' + it.cantidad + '</span>' +
              '<button data-mas="' + i + '" aria-label="Una mas">+</button>' +
              '<button class="carrito-quitar" data-quitar="' + i + '">quitar</button>' +
            '</div>' +
          '</div>' +
          '<div class="carrito-precio">' + pesos(p.precio * it.cantidad) + '</div>' +
        '</li>';
      }).join('');
    }

    elTotal.innerHTML = '<span>Total</span><span>' + pesos(totalPesos()) + '</span>';
    if (elPagar) elPagar.disabled = !items.length;
    if (elWa) {
      if (!PAGOS.whatsapp || !items.length) elWa.removeAttribute('href');
      else elWa.href = 'https://wa.me/' + PAGOS.whatsapp + '?text=' + encodeURIComponent(mensajeWhatsapp());
    }
    guardar();
  }

  function mensajeWhatsapp() {
    var L = ['Hola! Quiero pedir esto de Cosa Bonita:', ''];
    items.forEach(function (it) {
      var p = piezaDe(it.id);
      L.push('- ' + it.cantidad + ' x ' + p.nombre + ' (' + it.color + ') = ' + pesos(p.precio * it.cantidad));
    });
    L.push('');
    L.push('Total: ' + pesos(totalPesos()));
    if (PAGOS.envio && PAGOS.envio.nota) L.push('(' + PAGOS.envio.nota + ')');
    return L.join('\n');
  }

  function agregar(pieza, color, cantidad) {
    var p = piezaDe(pieza && pieza.id);
    if (!p) return;
    var c = Math.max(1, parseInt(cantidad, 10) || 1);
    var col = color || 'Negro';
    var ya = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === p.id && items[i].color === col) ya = items[i];
    }
    if (ya) ya.cantidad += c;
    else items.push({ id: p.id, color: col, cantidad: c });
    pintar();
    abrir();
  }

  function abrir() { fondo.hidden = false; document.body.style.overflow = 'hidden'; }
  function cerrar() { fondo.hidden = true; document.body.style.overflow = ''; }

  // --- pagar con Wompi ------------------------------------------------------
  // El navegador solo manda QUE quiere y CUANTAS de cada cosa. El precio y el
  // total los pone el servidor.
  function pagar() {
    if (!items.length || !PAGOS.endpoint) return;
    elAviso.textContent = '';
    elPagar.disabled = true;
    elPagar.textContent = 'Un momento...';
    fetch(PAGOS.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(function (it) {
          return { id: it.id, color: it.color, cantidad: it.cantidad };
        }),
      }),
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (r) {
      if (!r.ok || !r.j || !r.j.url) throw new Error((r.j && r.j.mensaje) || 'No se pudo abrir el pago.');
      location.href = r.j.url;
    }).catch(function (e) {
      elAviso.textContent = e.message + ' Puedes acordarlo por WhatsApp mientras lo reviso.';
      elPagar.disabled = false;
      elPagar.textContent = 'Pagar con tarjeta, PSE o Nequi';
    });
  }

  // --- enganches ------------------------------------------------------------
  boton.addEventListener('click', abrir);
  $('#carrito-cerrar').addEventListener('click', cerrar);
  fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && !fondo.hidden) cerrar(); });
  lista.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mas !== undefined) items[+b.dataset.mas].cantidad++;
    else if (b.dataset.menos !== undefined) {
      var i = +b.dataset.menos;
      if (--items[i].cantidad < 1) items.splice(i, 1);
    } else if (b.dataset.quitar !== undefined) items.splice(+b.dataset.quitar, 1);
    else return;
    pintar();
  });
  if (elPagar) elPagar.addEventListener('click', pagar);

  window.Carrito = { agregar: agregar, abrir: abrir, cerrar: cerrar, pintar: pintar };
  pintar();
})();
