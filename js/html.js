// =====================================================
// ESCAPE DE HTML — Juventude Sport Campinense
// =====================================================
// Tudo o que venha de fora — o que um visitante escreve num formulário, o
// que um administrador escreve no painel, o que chega do servidor — tem de
// passar por aqui antes de entrar em innerHTML.
//
// Sem isto, um nome como <img src=x onerror="..."> deixa de ser texto e
// passa a ser código a correr na página de quem o lê.
//
// Uso:
//     el.innerHTML = `<td>${jscEsc(m.nome)}</td>`;
//
// Não usar em valores que são HTML de propósito (por exemplo o resultado
// de statusBadge()): esses são construídos pelo código, não escritos por
// ninguém, e escapá-los faria aparecer as etiquetas como texto.
// =====================================================
(function (global) {
  'use strict';

  var MAPA = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  function jscEsc(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).replace(/[&<>"']/g, function (c) { return MAPA[c]; });
  }

  // Para valores que vão dentro de url(...) ou de href/src: além do escape
  // de HTML, recusa esquemas perigosos como javascript: e data:text/html.
  function jscEscUrl(valor) {
    if (valor === null || valor === undefined) return '';
    var s = String(valor).trim();
    if (/^\s*(javascript|vbscript)\s*:/i.test(s)) return '';
    if (/^\s*data\s*:/i.test(s) && !/^\s*data:image\//i.test(s)) return '';
    return jscEsc(s);
  }

  global.jscEsc = jscEsc;
  global.jscEscUrl = jscEscUrl;
})(typeof window !== 'undefined' ? window : this);
