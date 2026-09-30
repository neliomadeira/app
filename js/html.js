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

  // Para URLs atribuídos DIRECTAMENTE a uma propriedade de style — o
  // element.style.backgroundImage de um url('...'). Recusa esquemas
  // perigosos e percent-encode os caracteres que fechariam a função ou a
  // string: sem isso, um apóstrofo no nome do ficheiro fecha o url(...) e o
  // resto do valor passa a ser CSS.
  //
  // Aqui NÃO se escapa HTML. O valor não passa por um parser de HTML, e
  // escapá-lo transformaria um & legítimo da query em &amp; — a imagem
  // deixava de carregar. Para um style="..." dentro de innerHTML é o
  // jscEscUrlCss() abaixo que serve.
  // A ordem é a mesma do jsc_esc_url_css() do api/conteudo.php: primeiro o
  // percent-encoding, depois o trim e a recusa de esquemas. Trocá-la fazia
  // os dois divergirem num endereço com espaços à volta — o PHP encodava-os
  // e o JavaScript cortava-os.
  function jscUrlCss(valor) {
    if (valor === null || valor === undefined) return '';
    var s = String(valor).replace(/['"()\\\s]/g, pctCss).trim();
    if (/^\s*(javascript|vbscript)\s*:/i.test(s)) return '';
    if (/^\s*data\s*:/i.test(s) && !/^\s*data:image\//i.test(s)) return '';
    return s;
  }

  // Para URLs que vão dentro de url('...') num style="..." escrito em
  // innerHTML: o mesmo que o jscUrlCss(), mais o escape de HTML que esse
  // contexto exige. Construído sobre ele, para não haver duas versões da
  // mesma regra.
  //
  // Tem de dar exatamente o mesmo resultado que o jsc_esc_url_css() do
  // api/conteudo.php: o mesmo cartão é desenhado aqui e gerado lá.
  function jscEscUrlCss(valor) {
    return jscEsc(jscUrlCss(valor));
  }

  // O id de um vídeo do YouTube, a partir de qualquer dos endereços que o
  // painel aceita. Devolve '' quando não é um deles: é por isso que o
  // endereço do iframe nunca é o endereço que alguém escreveu, mas sempre um
  // construído a partir de onze caracteres validados aqui.
  //
  // Réplica exacta do jsc_video_id() do api/conteudo.php. Substitui o _ytId()
  // do js/videos.js e o _ytIdAdmin() do painel, que eram a mesma expressão
  // escrita duas vezes.
  function jscVideoId(url) {
    var m = String(url === null || url === undefined ? '' : url)
      .match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  // Está publicado? Sem o campo conta como publicado, para não esconder o que
  // já esteja lá. Vale para fotografias, vídeos, marcos históricos e títulos
  // do palmarés, e por isso vive num sítio só. Réplica exacta do jsc_ativo()
  // do api/conteudo.php.
  function jscAtivo(valor) {
    return valor !== false;
  }

  // O nome que os blocos do Bloco 7 usam. Delega, em vez de repetir a regra.
  // Réplica exacta do jsc_media_ativo() do api/conteudo.php.
  function jscMediaAtivo(valor) {
    return jscAtivo(valor);
  }

  // O ano de um registo histórico, como número, ou 0 quando não há nenhum
  // utilizável. Um ano com texto ('mil novecentos') dá 0: não se adivinha.
  // Réplica exacta do jsc_ano_historico() do api/conteudo.php.
  function jscAnoHistorico(valor) {
    if (typeof valor === 'number' && isFinite(valor) && Math.floor(valor) === valor) return valor;
    var s = String(valor === null || valor === undefined ? '' : valor).trim();
    if (s === '' || !/^-?\d+$/.test(s)) return 0;
    return parseInt(s, 10);
  }

  // Ordenação estável por ano. O sort() do JavaScript é estável desde o
  // ES2019, mas o usort() do PHP só passou a ser no 8.0 — e o alojamento de
  // campinense.pt corre 7.4. Para os dois lados darem a MESMA ordem quando há
  // anos repetidos, ambos desempatam pelo índice de entrada. Sem isto, dois
  // títulos do mesmo ano podiam trocar de lugar entre o PHP e o JavaScript, e
  // a página gerada e a redesenhada deixavam de ser iguais.
  //
  // Réplica exacta do jsc_ordenar_por_ano() do api/conteudo.php.
  function jscOrdenarPorAno(lista, crescente) {
    return lista
      .map(function (item, i) { return { i: i, item: item }; })
      .sort(function (a, b) {
        var aa = a.item._ano || 0, bb = b.item._ano || 0;
        if (aa !== bb) return crescente ? (aa < bb ? -1 : 1) : (aa > bb ? -1 : 1);
        return a.i < b.i ? -1 : (a.i > b.i ? 1 : 0);
      })
      .map(function (e) { return e.item; });
  }

  // Uma modalidade está ativa? Uma modalidade sem o campo conta como ativa —
  // é a regra que o site já usa, e apertá-la esconderia modalidades que hoje
  // aparecem. Réplica exacta do jsc_modalidade_ativa() do api/conteudo.php.
  function jscModalidadeAtiva(valor) {
    return valor !== false;
  }

  // Um endereço que vai para uma PROPRIEDADE (el.href = ...), não para um
  // atributo de HTML escrito à mão. Aqui não se escapa nada — escapar
  // transformaria & em &amp; dentro do endereço — mas recusa-se o esquema.
  //
  // Sem isto, um "javascript:..." guardado no painel no endereço de um botão do
  // herói ou de uma rede social ficava no href e corria ao primeiro clique.
  // Foi medido a acontecer.
  //
  // Réplica exacta do jsc_href_seguro() do api/sanitizar.php: devolve '' onde o
  // PHP devolve null.
  function jscHrefSeguro(valor) {
    var v = String(valor === null || valor === undefined ? '' : valor).trim();
    if (v === '') return '';
    // Tira os caracteres de controlo que servem para disfarçar o esquema,
    // por exemplo "java\tscript:".
    var limpo = v.replace(/[\x00-\x20]+/g, '');
    if (/^[a-z0-9.+-]*script\s*:/i.test(limpo)) return '';
    if (/^(javascript|vbscript|data|blob|file|about)\s*:/i.test(limpo)) return '';
    if (/^(https?|mailto|tel)\s*:/i.test(limpo)) return v;   // esquema aceite
    if (/^[a-z][a-z0-9.+-]*:/i.test(limpo)) return '';        // qualquer outro
    return v;                                                 // relativo ou âncora
  }

  // Os textos institucionais curtos que entram como HTML — o título do herói e
  // a morada. O filtro a sério está no servidor (jsc_sanitizar_inline), antes de
  // gravar; este é a segunda linha, para o caso de o valor chegar ao browser por
  // outro caminho que não a publicação.
  //
  // Mesma lista de elementos do JSC_ELEMENTOS_INLINE do api/sanitizar.php, e
  // nenhum atributo.
  var JSC_INLINE = ['BR', 'SPAN', 'STRONG', 'EM', 'B', 'I'];
  var JSC_INLINE_FORA = ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET',
                         'FORM', 'INPUT', 'BUTTON', 'SELECT', 'OPTION', 'TEXTAREA',
                         'LINK', 'META', 'BASE', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT'];
  function jscHtmlSeguro(valor) {
    var texto = String(valor === null || valor === undefined ? '' : valor);
    if (texto === '') return '';
    // O <template> não executa nada do que lá está dentro: nem script, nem
    // onerror de imagem. É por isso que a análise se faz aqui.
    var t = document.createElement('template');
    t.innerHTML = texto;
    limparInline(t.content);
    return t.innerHTML;
  }
  function limparInline(no) {
    for (var i = no.childNodes.length - 1; i >= 0; i--) {
      var f = no.childNodes[i];
      if (f.nodeType === 8) { no.removeChild(f); continue; }   // comentário
      if (f.nodeType === 3) continue;                          // texto fica
      if (f.nodeType !== 1) { no.removeChild(f); continue; }
      var nome = f.nodeName.toUpperCase();
      if (JSC_INLINE_FORA.indexOf(nome) !== -1) { no.removeChild(f); continue; }
      limparInline(f);
      if (JSC_INLINE.indexOf(nome) === -1) {
        // Não é permitido, mas o texto lá dentro é: desembrulha-se.
        while (f.firstChild) no.insertBefore(f.firstChild, f);
        no.removeChild(f);
        continue;
      }
      for (var j = f.attributes.length - 1; j >= 0; j--) {
        f.removeAttribute(f.attributes[j].name);
      }
    }
  }

  // Um valor de opacidade do painel, entre 0 e 1. Só isso: era um campo que
  // entrava cru dentro de rgba(), e com "0.5),rgb(0,0,255" acrescentava paradas
  // de cor ao gradiente do herói. Injecção de CSS medida e confirmada.
  function jscOpacidade(valor, omissao) {
    var n = parseFloat(String(valor === null || valor === undefined ? '' : valor).trim());
    if (!isFinite(n) || n < 0 || n > 1) return omissao;
    return String(n);
  }

  // Uma posição de fundo do painel. Aceita as palavras do CSS e pares de
  // percentagens ou pixéis; qualquer outra coisa dá o valor por omissão, em vez
  // de um valor inválido que o browser resolve para 0% 0%.
  function jscPosicaoFundo(valor, omissao) {
    var v = String(valor === null || valor === undefined ? '' : valor).trim();
    if (v === '') return omissao;
    if (/^(left|right|center|top|bottom)(\s+(left|right|center|top|bottom))?$/i.test(v)) return v;
    if (/^-?\d+(\.\d+)?(%|px)(\s+-?\d+(\.\d+)?(%|px))?$/.test(v)) return v;
    return omissao;
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
  global.jscUrlCss = jscUrlCss;
  global.jscEscUrlCss = jscEscUrlCss;
  global.jscVideoId = jscVideoId;
  global.jscMediaAtivo = jscMediaAtivo;
  global.jscModalidadeAtiva = jscModalidadeAtiva;
  global.jscHojeISO = jscHojeISO;
  global.jscBlocoAtual = jscBlocoAtual;
  global.jscIniciais = jscIniciais;
  global.jscPatrocinadorAtivo = jscPatrocinadorAtivo;
  global.jscPatrocinadorUrl = jscPatrocinadorUrl;
  global.jscPatrocinadorSector = jscPatrocinadorSector;
  global.jscPatrocinadorDesde = jscPatrocinadorDesde;
  global.jscAtivo = jscAtivo;
  global.jscAnoHistorico = jscAnoHistorico;
  global.jscOrdenarPorAno = jscOrdenarPorAno;
  global.jscHrefSeguro = jscHrefSeguro;
  global.jscHtmlSeguro = jscHtmlSeguro;
  global.jscOpacidade = jscOpacidade;
  global.jscPosicaoFundo = jscPosicaoFundo;
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
