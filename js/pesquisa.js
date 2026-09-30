// =============================================
// PESQUISA — site-wide search
// =============================================
(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Default data (mirrors admin/js/data.js)
  // ------------------------------------------------------------------

  // Estava aqui um conjunto de registos inventados, usado quando não havia
  // nada publicado. Saiu: o site não mostra pessoas, jogos nem resultados
  // que não existem. Sem dados publicados, a página diz que ainda não há.
  var DEFAULT_NOTICIAS = [];

  var DEFAULT_ATLETAS = [];

  var DEFAULT_ESCALOES = [
    { id: 7, nome: 'Sub-5',  designacao: 'Pré-Petizes', faixa: 'Até 5 anos',   treinador: '' },
    { id: 8, nome: 'Sub-7',  designacao: 'Petizes',     faixa: '6 a 7 anos',   treinador: '' },
    { id: 1, nome: 'Sub-9',  designacao: 'Traquinas',   faixa: '8 a 9 anos',   treinador: ''  },
    { id: 2, nome: 'Sub-11', designacao: 'Benjamins', faixa: '10 a 11 anos', treinador: ''    },
    { id: 3, nome: 'Sub-13', designacao: 'Infantis', faixa: '12 a 13 anos', treinador: ''  },
    { id: 4, nome: 'Sub-15', designacao: 'Iniciados',  faixa: '14 a 15 anos', treinador: ''   },
    { id: 5, nome: 'Sub-17', designacao: 'Juvenis', faixa: '16 a 17 anos', treinador: '' },
    { id: 6, nome: 'Sub-19', designacao: 'Juniores',   faixa: '18 a 19 anos', treinador: '' },
  ];

  var DEFAULT_AGENDA = [];



  var DEFAULT_TREINADORES = [];

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function ptDate(d) {
    if (!d) return '';
    var dt = new Date(d + 'T00:00:00');
    if (isNaN(dt.getTime())) return d;
    return dt.getDate() + ' de ' + MESES[dt.getMonth()] + ', ' + dt.getFullYear();
  }

  function stripHtml(str) {
    return (str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return fallback;
  }

  // ------------------------------------------------------------------
  // Build index
  // ------------------------------------------------------------------

  function buildIndex() {
    var index = [];

    // Notícias — only publicada:true
    var noticias = load('jsc_noticias', DEFAULT_NOTICIAS);
    noticias.filter(function (n) { return n.publicada; }).forEach(function (n) {
      var resumoPlain = stripHtml(n.resumo);
      index.push({
        type:     'noticia',
        title:    n.titulo || '',
        subtitle: (n.categoria || '') + (n.data ? ' · ' + ptDate(n.data) : ''),
        url:      'noticias.html?id=' + n.id,
        text:     [(n.titulo || ''), (n.categoria || ''), resumoPlain].join(' ').toLowerCase(),
      });
    });

    // Atletas
    var atletas = load('db_atletas', DEFAULT_ATLETAS);
    atletas.forEach(function (a) {
      index.push({
        type:     'atleta',
        title:    a.nome || '',
        subtitle: (a.posicao || '') + (a.escalao ? ' · ' + a.escalao : ''),
        url:      'atleta.html?id=' + a.id,
        text:     [(a.nome || ''), (a.posicao || ''), (a.escalao || '')].join(' ').toLowerCase(),
      });
    });

    // Escalões
    var escaloes = load('db_escaloes', DEFAULT_ESCALOES);
    escaloes.forEach(function (e) {
      index.push({
        type:     'escalao',
        title:    e.nome || '',
        subtitle: (e.designacao || '') + (e.faixa ? ' · ' + e.faixa : ''),
        url:      'escalao.html?escalao=' + encodeURIComponent(e.nome || ''),
        text:     [(e.nome || ''), (e.designacao || ''), (e.faixa || ''), (e.treinador || '')].join(' ').toLowerCase(),
      });
    });

    // Agenda
    var agenda = load('db_agenda', DEFAULT_AGENDA);
    agenda.forEach(function (ev) {
      var sub = (ev.tipo || '');
      if (ev.data) sub += ' · ' + ptDate(ev.data);
      if (ev.local) sub += ' · ' + ev.local;
      index.push({
        type:     'evento',
        title:    ev.titulo || '',
        subtitle: sub,
        url:      'agenda.html',
        text:     [(ev.titulo || ''), (ev.tipo || ''), (ev.escalao || ''), (ev.local || ''), stripHtml(ev.descricao)].join(' ').toLowerCase(),
      });
    });

    // Estavam aqui cópias completas dos 22 marcos da cronologia e dos 16 títulos
  // do palmarés — as terceiras, iguais às de js/historia.js e de
  // admin/js/admin.js. Saíram as três: a semente única está em
  // admin/js/data.js. Sem dados publicados a pesquisa não encontra história,
  // em vez de encontrar história escrita no código.

  // História
    // Um registo inativo não aparece publicamente — e a pesquisa é público.
    var historia = load('db_historia', []).filter(function (h) {
      return h && jscAtivo(h.ativo) && String(h.titulo || '').trim() !== '';
    });
    historia.forEach(function (h) {
      index.push({
        type:     'historia',
        title:    h.titulo || '',
        subtitle: h.ano ? String(h.ano) : '',
        url:      'historia.html',
        text:     [(h.titulo || ''), stripHtml(h.descricao), (h.ano ? String(h.ano) : '')].join(' ').toLowerCase(),
      });
    });

    // Palmarés — type 'historia' too (links to historia.html)
    var palmares = load('db_palmares', []).filter(function (p) {
      return p && jscAtivo(p.ativo) && String(p.competicao || '').trim() !== '';
    });
    palmares.forEach(function (p) {
      var sub = (p.ano ? String(p.ano) : '') + (p.observacao ? ' · ' + p.observacao : '');
      index.push({
        type:     'historia',
        title:    (p.competicao || '') + (p.escalao ? ' — ' + p.escalao : ''),
        subtitle: sub,
        url:      'historia.html',
        text:     [(p.competicao || ''), (p.escalao || ''), (p.observacao || ''), (p.ano ? String(p.ano) : '')].join(' ').toLowerCase(),
      });
    });

    // Treinadores
    var treinadores = load('db_treinadores', DEFAULT_TREINADORES);
    treinadores.forEach(function (t) {
      index.push({
        type:     'treinador',
        title:    t.nome || '',
        subtitle: (t.cargo || '') + (t.escalao ? ' · ' + t.escalao : ''),
        url:      'formacao.html',
        text:     [(t.nome || ''), (t.cargo || ''), (t.escalao || '')].join(' ').toLowerCase(),
      });
    });

    // Vídeos
    var videos = load('db_videos', []);
    videos.forEach(function (v) {
      index.push({
        type:     'video',
        title:    v.titulo || '',
        subtitle: (v.categoria || '') + (v.data ? ' · ' + ptDate(v.data) : ''),
        url:      'videos.html',
        text:     [(v.titulo || ''), (v.categoria || ''), (v.descricao || '')].join(' ').toLowerCase(),
      });
    });

    return index;
  }

  // ------------------------------------------------------------------
  // Search
  // ------------------------------------------------------------------

  function search(query, index) {
    var words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    var results = index.filter(function (item) {
      return words.every(function (w) { return item.text.indexOf(w) !== -1; });
    });

    // Sort: exact title match first, then partial title, then rest
    var titleLower = query.toLowerCase().trim();
    results.sort(function (a, b) {
      var aExact = a.title.toLowerCase() === titleLower ? 0 : 1;
      var bExact = b.title.toLowerCase() === titleLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      var aPartial = a.title.toLowerCase().indexOf(titleLower) !== -1 ? 0 : 1;
      var bPartial = b.title.toLowerCase().indexOf(titleLower) !== -1 ? 0 : 1;
      return aPartial - bPartial;
    });

    return results;
  }

  // ------------------------------------------------------------------
  // Highlight
  // ------------------------------------------------------------------

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(str, words) {
    if (!str || !words || !words.length) return str || '';
    var result = str;
    words.forEach(function (w) {
      if (!w) return;
      var re = new RegExp('(' + escapeRegex(w) + ')', 'gi');
      result = result.replace(re, '<mark>$1</mark>');
    });
    return result;
  }

  // ------------------------------------------------------------------
  // Type metadata
  // ------------------------------------------------------------------

  var TYPE_META = {
    noticia:   { icon: '📰', label: 'Notícias'   },
    atleta:    { icon: '⚽', label: 'Atletas'     },
    escalao:   { icon: '👥', label: 'Escalões'    },
    evento:    { icon: '📅', label: 'Eventos'     },
    historia:  { icon: '🏆', label: 'História'    },
    treinador: { icon: '👨‍🏫', label: 'Treinadores' },
    video:     { icon: '🎥', label: 'Vídeos'      },
  };

  // Group order
  var TYPE_ORDER = ['noticia', 'atleta', 'escalao', 'evento', 'historia', 'treinador', 'video'];

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  function renderResults(query, results) {
    var container = document.getElementById('searchResults');
    var hint      = document.getElementById('searchHint');
    if (!container) return;

    if (!query.trim()) {
      container.innerHTML = '';
      if (hint) hint.style.display = '';
      return;
    }

    if (hint) hint.style.display = 'none';

    if (!results.length) {
      container.innerHTML =
        '<p class="search-empty">Nenhum resultado para "<strong>' +
        escHtml(query) + '</strong>". Tente outros termos.</p>';
      return;
    }

    var words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    // Group by type
    var groups = {};
    results.forEach(function (item) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });

    var html = '<p class="search-count">' + results.length +
      ' resultado' + (results.length !== 1 ? 's' : '') +
      ' para "<strong>' + escHtml(query) + '</strong>"</p>';

    TYPE_ORDER.forEach(function (type) {
      if (!groups[type] || !groups[type].length) return;
      var meta  = TYPE_META[type] || { icon: '', label: type };
      var items = groups[type];
      var cards = items.map(function (item) {
        return (
          '<a href="' + escHtml(item.url) + '" class="search-result">' +
            '<div class="search-result__type">' + meta.icon + ' ' + meta.label + '</div>' +
            '<div class="search-result__title">' + highlight(escHtml(item.title), words) + '</div>' +
            (item.subtitle
              ? '<div class="search-result__sub">' + highlight(escHtml(item.subtitle), words) + '</div>'
              : '') +
          '</a>'
        );
      }).join('');

      html +=
        '<div class="search-group">' +
          '<h2 class="search-group__title">' +
            meta.icon + ' ' + meta.label +
            ' <span class="search-group__count">(' + items.length + ')</span>' +
          '</h2>' +
          '<div class="search-group__items">' + cards + '</div>' +
        '</div>';
    });

    container.innerHTML = html;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------

  var _index = null;
  var _debounceTimer = null;

  function getIndex() {
    if (!_index) _index = buildIndex();
    return _index;
  }

  function runSearch(query) {
    var results = search(query, getIndex());
    renderResults(query, results);
  }

  function init() {
    var input     = document.getElementById('searchInput');
    var clearBtn  = document.getElementById('searchClear');
    if (!input) return;

    // Pre-fill from ?q= URL param
    var params = new URLSearchParams(window.location.search);
    var qParam = params.get('q') || '';
    if (qParam) {
      input.value = qParam;
      if (clearBtn) clearBtn.style.display = '';
      runSearch(qParam);
    }

    input.addEventListener('input', function () {
      var val = input.value;
      if (clearBtn) clearBtn.style.display = val ? '' : 'none';

      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function () {
        // Update URL
        var url = new URL(window.location.href);
        if (val.trim()) {
          url.searchParams.set('q', val);
        } else {
          url.searchParams.delete('q');
        }
        history.replaceState(null, '', url.toString());
        runSearch(val);
      }, 200);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        clearBtn.style.display = 'none';
        var url = new URL(window.location.href);
        url.searchParams.delete('q');
        history.replaceState(null, '', url.toString());
        runSearch('');
        input.focus();
      });
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        var url = new URL(window.location.href);
        url.searchParams.delete('q');
        history.replaceState(null, '', url.toString());
        runSearch('');
      }
    });
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
