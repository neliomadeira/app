// =============================================
// GALERIA — página completa
// =============================================
// Fonte: db_galeria. A grelha, os filtros e o estado vazio são escritos pela
// geração (modelos/galeria-pagina.php); este ficheiro só os redesenha quando o
// que está na página deixou de servir, e trata da lightbox.
//
// O que aqui estava e saiu:
//   — um _escHtml() local que não escapava o apóstrofo, a duplicar o jscEsc();
//   — o fragmento de HTML da imagem passado por jscEsc(), o que fazia o <div>
//     da fotografia aparecer como texto na página;
//   — duplo escape no título, na descrição e no aria-label (&amp;amp;);
//   — o endereço da imagem dentro de url('...') sem percent-encoding;
//   — um <img src> sem política de URL;
//   — categorias escritas à mão, incluindo uma que o painel não oferece.
//
// A lightbox fica, como melhoria progressiva: sem JavaScript vê-se a grelha e
// as legendas, com JavaScript abre-se a fotografia em grande. Passa a devolver
// o foco a quem a abriu e a retê-lo enquanto está aberta.
// =============================================
'use strict';

(function () {
  var _todas = [];        // tudo o que é publicável
  var _visiveis = [];     // o que o filtro actual mostra
  var _idx = 0;
  var _veioDe = null;     // quem abriu a lightbox

  var ICONES = {
    Jogo:      '&#9917;',
    Treino:    '&#127939;',
    Conquista: '&#127942;',
    Evento:    '&#127881;',
  };

  // Réplica exacta do jsc_media_slug() do api/conteudo.php.
  function slug(categoria) {
    var s = String(categoria || '').toLowerCase().trim();
    var de = 'áàãâéêíóôõúç', para = 'aaaaeeiooouc';
    s = s.replace(/./g, function (c) {
      var i = de.indexOf(c);
      return i === -1 ? c : para.charAt(i);
    });
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s !== '' ? s : 'outro';
  }

  function icone(categoria) {
    return ICONES[categoria] || '&#128247;';
  }

  function ler() {
    var lista = [];
    try { lista = JSON.parse(localStorage.getItem('db_galeria') || '[]'); } catch (e) { lista = []; }
    if (!Array.isArray(lista)) lista = [];
    return lista
      .filter(function (f) { return f && jscMediaAtivo(f.ativo); })
      .filter(function (f) { return String(f.titulo || '').trim() !== ''; })
      .map(function (f) {
        // jscEscUrl() devolve '' para javascript:, vbscript: e data: que não
        // seja de imagem. Um endereço recusado fica como se não existisse: a
        // fotografia leva o cartão de categoria.
        var url = String(f.url || '').trim();
        return {
          titulo:    String(f.titulo).trim(),
          categoria: String(f.categoria || '').trim(),
          data:      String(f.data || '').trim(),
          url:       jscEscUrl(url) !== '' ? url : '',
          imgPos:    String(f.imgPos || '').trim() || 'center',
          imgSize:   String(f.imgSize || '').trim() || 'cover',
          descricao: String(f.descricao || '').trim(),
        };
      });
  }

  // As categorias que têm fotografias, pela ordem em que aparecem. Não há lista
  // fixa: uma categoria sem nada não produz botão.
  function categorias(lista) {
    var fora = [];
    lista.forEach(function (f) {
      if (f.categoria !== '' && fora.indexOf(f.categoria) === -1) fora.push(f.categoria);
    });
    return fora;
  }

  // ---- Filtros --------------------------------------------------------
  function desenharFiltros(lista) {
    var bar = document.getElementById('galeriaFilters');
    if (!bar) return;
    var cats = categorias(lista);
    bar.innerHTML = cats.length > 1
      ? '<button class="news-filter-btn news-filter-btn--active" data-cat="Todos" type="button">Todos</button>'
        + cats.map(function (c) {
            return '<button class="news-filter-btn" data-cat="' + jscEsc(c) + '" type="button">' + jscEsc(c) + '</button>';
          }).join('')
      : '';
  }

  function ligarFiltros() {
    var bar = document.getElementById('galeriaFilters');
    if (!bar || bar.dataset.ligado) return;
    bar.dataset.ligado = '1';
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.news-filter-btn');
      if (!btn) return;
      bar.querySelectorAll('.news-filter-btn').forEach(function (b) {
        b.classList.remove('news-filter-btn--active');
      });
      btn.classList.add('news-filter-btn--active');
      var cat = btn.dataset.cat;
      _visiveis = cat === 'Todos' ? _todas.slice() : _todas.filter(function (f) { return f.categoria === cat; });
      // Filtrar esconde e mostra o que já está na página, em vez de o
      // reescrever: assim a grelha gerada pelo servidor continua a ser a que
      // está à vista.
      document.querySelectorAll('#galeriaGrid .galeria-item').forEach(function (el) {
        var mostra = cat === 'Todos' || el.dataset.cat === cat;
        el.hidden = !mostra;
      });
      reindexar();
    });
  }

  // ---- Grelha ---------------------------------------------------------
  function cartaoHtml(f, i) {
    var capa = f.url !== ''
      ? '<div class="galeria-item__bg" style="background-image:url(\'' + jscEscUrlCss(f.url)
        + '\');background-size:' + jscEsc(f.imgSize) + ';background-position:' + jscEsc(f.imgPos) + '"></div>'
      : '<div class="galeria-item__bg galeria-placeholder galeria-placeholder--' + jscEsc(slug(f.categoria)) + '">'
        + '<span class="galeria-placeholder__icon" aria-hidden="true">' + icone(f.categoria) + '</span>'
        + '<span class="galeria-placeholder__title">' + jscEsc(f.titulo) + '</span>'
        + '</div>';
    return '\n        <div class="galeria-item" data-idx="' + i + '" data-cat="' + jscEsc(f.categoria)
      + '" tabindex="0" role="button"\n             aria-label="Ver foto: ' + jscEsc(f.titulo) + '">\n          '
      + capa
      + '\n          <div class="galeria-item__overlay" aria-hidden="true">'
      + '\n            <p class="galeria-item__overlay-title">' + jscEsc(f.titulo) + '</p>'
      + (f.descricao ? '\n            <p class="galeria-item__overlay-desc">' + jscEsc(f.descricao) + '</p>' : '')
      + '\n          </div>\n        </div>';
  }

  function desenharGrelha(lista) {
    var grid  = document.getElementById('galeriaGrid');
    var vazio = document.getElementById('galeriaEmpty');
    if (!grid) return;
    grid.innerHTML = lista.map(cartaoHtml).join('');
    if (vazio) vazio.hidden = lista.length > 0;
  }

  // Os índices seguem a ordem do que está visível, para as setas da lightbox
  // andarem pela lista filtrada e não pela lista toda.
  function reindexar() {
    var visiveis = Array.from(document.querySelectorAll('#galeriaGrid .galeria-item'))
      .filter(function (el) { return !el.hidden; });
    visiveis.forEach(function (el, i) { el.dataset.idx = i; });
  }

  // ---- Lightbox -------------------------------------------------------
  function conteudoLightbox(f) {
    var media = document.getElementById('lbMedia');
    if (!media) return;

    if (f.url !== '') {
      media.innerHTML = '<img class="lightbox__img" src="' + jscEscUrl(f.url)
        + '" alt="' + jscEsc(f.titulo) + '" />';
    } else {
      media.innerHTML = '<div class="lightbox__placeholder galeria-placeholder galeria-placeholder--'
        + jscEsc(slug(f.categoria)) + '">'
        + '<span class="lightbox__placeholder-icon" aria-hidden="true">' + icone(f.categoria) + '</span>'
        + '<span class="lightbox__placeholder-label">' + jscEsc(f.titulo) + '</span>'
        + '</div>';
    }

    var põe = function (id, valor) {
      var el = document.getElementById(id);
      if (el) el.textContent = valor;
    };
    põe('lbBadge', f.categoria);
    põe('lbTitle', f.titulo);
    põe('lbDate', f.data ? new Date(f.data + 'T00:00:00')
      .toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : '');
    põe('lbDesc', f.descricao);
    põe('lbCounter', (_idx + 1) + ' / ' + _visiveis.length);

    var prev = document.getElementById('lbPrev');
    var next = document.getElementById('lbNext');
    if (prev) prev.disabled = _idx === 0;
    if (next) next.disabled = _idx === _visiveis.length - 1;
  }

  // O foco não sai da caixa enquanto ela está aberta: sem isto, o Tab levava
  // para a página por trás, que continua a existir.
  function prender(e) {
    var lb = document.getElementById('lightbox');
    if (e.key !== 'Tab' || !lb || lb.hasAttribute('hidden')) return;
    var focaveis = Array.from(lb.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]'))
      .filter(function (el) { return el.offsetParent !== null; });
    if (!focaveis.length) return;
    var primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  function abrir(idx, quemAbriu) {
    var lb = document.getElementById('lightbox');
    if (!lb || !_visiveis[idx]) return;
    _idx = idx;
    _veioDe = quemAbriu || document.activeElement;
    lb.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    conteudoLightbox(_visiveis[_idx]);
    var fechar = document.getElementById('lbClose');
    if (fechar) fechar.focus();
  }

  function fechar() {
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.setAttribute('hidden', '');
    document.body.style.overflow = '';
    // O foco volta ao cartão que a abriu: sem isto, quem usa teclado ficava
    // no início da página a cada fecho.
    if (_veioDe && _veioDe.focus) _veioDe.focus();
    _veioDe = null;
  }

  function navegar(passo) {
    var novo = _idx + passo;
    if (novo < 0 || novo >= _visiveis.length) return;
    _idx = novo;
    conteudoLightbox(_visiveis[_idx]);
  }

  // ---- Ligações -------------------------------------------------------
  function ligarGrelha() {
    var grid = document.getElementById('galeriaGrid');
    if (!grid || grid.dataset.ligado) return;
    grid.dataset.ligado = '1';
    // Ouvido no contentor: funciona igual sobre a grelha que o servidor gerou
    // e sobre a que este ficheiro desenha.
    grid.addEventListener('click', function (e) {
      var el = e.target.closest('.galeria-item[data-idx]');
      if (el) abrir(Number(el.dataset.idx), el);
    });
    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var el = e.target.closest('.galeria-item[data-idx]');
      if (!el) return;
      // preventDefault também no espaço: sem isto a página fazia scroll ao
      // mesmo tempo que a caixa abria.
      e.preventDefault();
      abrir(Number(el.dataset.idx), el);
    });
  }

  function ligarLightbox() {
    var lb = document.getElementById('lightbox');
    if (!lb || lb.dataset.ligado) return;
    lb.dataset.ligado = '1';
    document.getElementById('lbClose')?.addEventListener('click', fechar);
    document.getElementById('lbPrev')?.addEventListener('click', function () { navegar(-1); });
    document.getElementById('lbNext')?.addEventListener('click', function () { navegar(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) fechar(); });
    document.addEventListener('keydown', function (e) {
      var caixa = document.getElementById('lightbox');
      if (!caixa || caixa.hasAttribute('hidden')) return;
      if (e.key === 'Escape') { fechar(); return; }
      if (e.key === 'ArrowLeft')  navegar(-1);
      if (e.key === 'ArrowRight') navegar(1);
      prender(e);
    });
  }

  // ---- Arranque -------------------------------------------------------
  function arrancar() {
    _todas = ler();
    _visiveis = _todas.slice();

    var grid = document.getElementById('galeriaGrid');
    // A grelha pode já vir escrita pelo servidor. Quando vem e está atual, não
    // se toca: o visitante já a está a ver, sem JavaScript.
    if (!jscBlocoAtual(grid, _todas.length)) {
      desenharFiltros(_todas);
      desenharGrelha(_todas);
    }
    reindexar();
    ligarFiltros();
    ligarGrelha();
    ligarLightbox();
  }

  document.addEventListener('DOMContentLoaded', arrancar);
  // Quando os dados do servidor chegam (sync.js): a página não se actualizava,
  // e quem ficasse nela via os dados antigos até recarregar.
  document.addEventListener('jsc:synced', arrancar);
  window.addEventListener('storage', function (e) {
    if (e.key === 'db_galeria') arrancar();
  });
})();
