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

  // O dia de hoje em AAAA-MM-DD, na hora local de quem visita.
  function jscHojeISO() {
    var d = new Date();
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  // O bloco que o servidor escreveu neste contentor ainda serve?
  //
  // Três perguntas, e todas têm de dar sim:
  //   data-gerado  o que está guardado não é mais recente do que o gerado;
  //   data-itens   o gerador escreveu tantos itens quantos os que contamos
  //                agora (trata das notícias agendadas que venceram depois
  //                da publicação);
  //   data-desde   a lista foi gerada a contar do dia de hoje (trata da
  //                agenda, onde um evento passa a ser passado à meia-noite).
  //
  // Um atributo que não exista não é verificado: assim um bloco que não
  // precise de contagem ou de data continua a funcionar.
  function jscBlocoAtual(el, itens, desde) {
    if (!el) return false;
    var gerado = el.getAttribute('data-gerado') || '';
    if (!gerado) return false;
    var publicado = '';
    try { publicado = localStorage.getItem('jsc_publicado_em') || ''; } catch (_) {}
    if (publicado && publicado > gerado) return false;
    var n = el.getAttribute('data-itens');
    if (n !== null && itens !== undefined && Number(n) !== itens) return false;
    var d = el.getAttribute('data-desde');
    if (d !== null && desde !== undefined && d !== desde) return false;
    return true;
  }

  // As iniciais que aparecem quando não há logótipo. Réplica exacta do
  // jsc_iniciais() do api/conteudo.php, e tolerante: um nome ausente devolve
  // '' em vez de estourar. A versão que vivia dentro do patrocinadores.html
  // fazia nome.trim() sem guarda, e um registo sem nome lançava um TypeError
  // que deixava a página inteira em branco.
  function jscIniciais(nome) {
    return String(nome === null || nome === undefined ? '' : nome)
      .trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0); })
      .join('').toUpperCase();
  }

  // Um patrocinador está ativo? Réplica exacta do jsc_patrocinador_ativo() do
  // api/conteudo.php. As duas páginas discordavam: a inicial aceitava
  // qualquer valor verdadeiro, a de patrocinadores exigia exactamente true, e
  // um "ativo": 1 aparecia numa e não na outra.
  function jscPatrocinadorAtivo(valor) {
    if (valor === true) return true;
    if (typeof valor === 'number') return valor === 1;
    if (typeof valor === 'string') {
      var v = valor.trim().toLowerCase();
      return v === 'true' || v === '1';
    }
    return false;
  }

  // O endereço do site de um patrocinador. Só http e https — lista de
  // permitidos, não de proibidos. Sem esquema assume-se https. Réplica
  // exacta do jsc_patrocinador_url() do api/conteudo.php.
  function jscPatrocinadorUrl(website) {
    var s = String(website === null || website === undefined ? '' : website).trim();
    if (s === '') return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    if (!/^https?:\/\/[^\s/?#]/i.test(s)) return '';
    return s;
  }

  // O sector. Um travessão é a marca de um campo não preenchido, não um
  // sector. Réplica exacta do jsc_patrocinador_sector().
  function jscPatrocinadorSector(valor) {
    var s = String(valor === null || valor === undefined ? '' : valor).trim();
    return (s === '-' || s === '\u2014' || s === '\u2013') ? '' : s;
  }

  // O ano de "Parceiro desde". Réplica exacta do jsc_patrocinador_desde().
  function jscPatrocinadorDesde(valor) {
    var m = String(valor === null || valor === undefined ? '' : valor).match(/(\d{4})/);
    if (!m) return '';
    var ano = parseInt(m[1], 10);
    return (ano >= 1900 && ano <= 2100) ? String(ano) : '';
  }

  global.jscEsc = jscEsc;
  global.jscEscUrl = jscEscUrl;
  global.jscEscUrlCss = jscEscUrlCss;
  global.jscHojeISO = jscHojeISO;
  global.jscBlocoAtual = jscBlocoAtual;
  global.jscIniciais = jscIniciais;
  global.jscPatrocinadorAtivo = jscPatrocinadorAtivo;
  global.jscPatrocinadorUrl = jscPatrocinadorUrl;
  global.jscPatrocinadorSector = jscPatrocinadorSector;
  global.jscPatrocinadorDesde = jscPatrocinadorDesde;
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
