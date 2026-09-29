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

  // Percent-encode de um caractere, byte a byte em UTF-8 e em maiúsculas,
  // igual ao rawurlencode() do PHP. Feito à mão porque o
  // encodeURIComponent deixa passar ' ( ) — precisamente os que fechariam
  // o url(...) do CSS.
  function pctCss(c) {
    return Array.from(new TextEncoder().encode(c))
      .map(function (b) { return '%' + b.toString(16).toUpperCase().padStart(2, '0'); })
      .join('');
  }

  // Para URLs que vão dentro de url('...') numa folha de estilo. Além do
  // escape de HTML e da recusa de esquemas perigosos, os caracteres que
  // fechariam a função ou a string são percent-encoded: sem isso, um
  // apóstrofo no nome do ficheiro fecha o url(...) e o resto do valor passa
  // a ser CSS.
  //
  // Tem de dar exatamente o mesmo resultado que o jsc_esc_url_css() do
  // api/conteudo.php: o mesmo cartão é desenhado aqui e gerado lá.
  function jscEscUrlCss(valor) {
    if (valor === null || valor === undefined) return '';
    return jscEscUrl(String(valor).replace(/['"()\\\s]/g, pctCss));
  }

  global.jscEsc = jscEsc;
  global.jscEscUrl = jscEscUrl;
  global.jscEscUrlCss = jscEscUrlCss;
})(typeof window !== 'undefined' ? window : this);

// =====================================================
// ATIVAR COM O TECLADO
// =====================================================
// Há cartões que são clicáveis sem serem um botão nem uma ligação: um
// <div onclick>. Ao rato respondem, ao teclado não — não recebem foco e
// não têm tecla que os acione.
//
// Estes cartões passam a levar role="button" e tabindex="0", e é aqui que
// se lhes dá a tecla: Enter e barra de espaço, como num botão a sério.
// Fica neste ficheiro por ser o único que todas as páginas carregam.
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  var el = document.activeElement;
  if (!el || !el.hasAttribute || !el.hasAttribute('data-tecla')) return;
  e.preventDefault();
  el.click();
});
