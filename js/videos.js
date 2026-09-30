// =============================================
// VÍDEOS — página completa
// =============================================
// Fonte: db_videos. A grelha, os filtros e o estado vazio são escritos pela
// geração (modelos/videos.php); este ficheiro só os redesenha quando o que está
// na página deixou de servir, e trata do modal.
//
// Cada cartão é uma ligação a sério para o YouTube. Sem JavaScript o vídeo abre
// lá; com JavaScript o clique é interceptado e abre-se o modal. Antes o cartão
// era um <div role="button"> e sem JavaScript não havia como ver nada.
//
// Os três endereços — miniatura, ligação e embed — são construídos a partir do
// id de onze caracteres que o jscVideoId() valida, nunca do endereço escrito no
// painel. Um vídeo sem id válido não é publicado: não há cartão sem miniatura
// nem iframe vazio.
//
// O que saiu: o _escHtml() local, incompleto e a duplicar o jscEsc(), e o
// _ytId() local, que era a mesma expressão do painel escrita duas vezes.
// =============================================
'use strict';

(function () {
  var _todos = [];
  var _visiveis = [];
  var _veioDe = null;

  function ler() {
    var lista = [];
    try { lista = JSON.parse(localStorage.getItem('db_videos') || '[]'); } catch (e) { lista = []; }
    if (!Array.isArray(lista)) lista = [];
    return lista
      .filter(function (v) { return v && jscMediaAtivo(v.ativo); })
      .filter(function (v) { return String(v.titulo || '').trim() !== ''; })
      .map(function (v) {
        var id = jscVideoId(v.url);
        return {
          titulo:    String(v.titulo).trim(),
          categoria: String(v.categoria || '').trim(),
          data:      String(v.data || '').trim(),
          descricao: String(v.descricao || '').trim(),
          videoId:   id,
          miniatura: id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : '',
          ligacao:   id ? 'https://www.youtube.com/watch?v=' + id : '',
          embed:     id ? 'https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0' : '',
        };
      })
      // Sem id válido não é publicado.
      .filter(function (v) { return v.videoId !== ''; });
  }

  function dataPt(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso
      : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function categorias(lista) {
    var fora = [];
    lista.forEach(function (v) {
      if (v.categoria !== '' && fora.indexOf(v.categoria) === -1) fora.push(v.categoria);
    });
    return fora;
  }

  // ---- Filtros --------------------------------------------------------
  function desenharFiltros(lista) {
    var bar = document.getElementById('videosFilters');
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
    var bar = document.getElementById('videosFilters');
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
      _visiveis = cat === 'Todos' ? _todos.slice() : _todos.filter(function (v) { return v.categoria === cat; });
      document.querySelectorAll('#videosGrid .video-card').forEach(function (el) {
        el.hidden = !(cat === 'Todos' || el.dataset.cat === cat);
      });
      reindexar();
    });
  }

  // ---- Grelha ---------------------------------------------------------
  function cartaoHtml(v, i) {
    return '\n        <a class="video-card" href="' + jscEsc(v.ligacao)
      + '" target="_blank" rel="noopener noreferrer"\n           data-idx="' + i
      + '" data-cat="' + jscEsc(v.categoria) + '">'
      + '\n          <div class="video-card__thumb">'
      + '\n            <img src="' + jscEscUrl(v.miniatura) + '" alt="' + jscEsc(v.titulo)
      + '" class="video-card__img" loading="lazy" />'
      + '\n            <div class="video-card__play" aria-hidden="true">&#9654;</div>'
      + (v.categoria ? '\n            <span class="video-card__cat">' + jscEsc(v.categoria) + '</span>' : '')
      + '\n          </div>'
      + '\n          <div class="video-card__body">'
      + '\n            <p class="video-card__title">' + jscEsc(v.titulo) + '</p>'
      + (dataPt(v.data) ? '\n            <p class="video-card__date">' + jscEsc(dataPt(v.data)) + '</p>' : '')
      + '\n          </div>\n        </a>';
  }

  function desenharGrelha(lista) {
    var grid  = document.getElementById('videosGrid');
    var vazio = document.getElementById('videosEmpty');
    if (!grid) return;
    grid.innerHTML = lista.map(cartaoHtml).join('');
    if (vazio) vazio.hidden = lista.length > 0;
  }

  function reindexar() {
    Array.from(document.querySelectorAll('#videosGrid .video-card'))
      .filter(function (el) { return !el.hidden; })
      .forEach(function (el, i) { el.dataset.idx = i; });
  }

  // ---- Modal ----------------------------------------------------------
  function prender(e) {
    var m = document.getElementById('videoModal');
    if (e.key !== 'Tab' || !m || m.hasAttribute('hidden')) return;
    var focaveis = Array.from(m.querySelectorAll('button:not([disabled]), a[href], iframe'))
      .filter(function (el) { return el.offsetParent !== null; });
    if (!focaveis.length) return;
    var primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  function abrir(idx, quemAbriu) {
    var v = _visiveis[idx];
    var modal = document.getElementById('videoModal');
    if (!modal || !v) return;
    _veioDe = quemAbriu || document.activeElement;

    var frame = document.getElementById('videoFrame');
    if (frame) {
      frame.src = v.embed;
      // O title do iframe passa a ser o título do vídeo. Era "Vídeo" fixo, igual
      // para todos, e quem usa leitor de ecrã não sabia qual estava a abrir.
      frame.title = v.titulo;
    }
    var põe = function (id, valor) {
      var el = document.getElementById(id);
      if (el) el.textContent = valor;
    };
    põe('vmTitle', v.titulo);
    põe('vmDate', dataPt(v.data));
    põe('vmDesc', v.descricao);
    põe('vmCat', v.categoria);

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('vmClose')?.focus();
  }

  function fechar() {
    var modal = document.getElementById('videoModal');
    if (!modal) return;
    var frame = document.getElementById('videoFrame');
    if (frame) { frame.src = ''; frame.title = 'Vídeo'; }   // pára a reprodução
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (_veioDe && _veioDe.focus) _veioDe.focus();
    _veioDe = null;
  }

  // ---- Ligações -------------------------------------------------------
  function ligarGrelha() {
    var grid = document.getElementById('videosGrid');
    if (!grid || grid.dataset.ligado) return;
    grid.dataset.ligado = '1';
    grid.addEventListener('click', function (e) {
      var el = e.target.closest('.video-card[data-idx]');
      if (!el) return;
      // A ligação leva ao YouTube sem JavaScript; com ele, abre-se o modal.
      e.preventDefault();
      abrir(Number(el.dataset.idx), el);
    });
    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var el = e.target.closest('.video-card[data-idx]');
      if (!el) return;
      e.preventDefault();
      abrir(Number(el.dataset.idx), el);
    });
  }

  function ligarModal() {
    var modal = document.getElementById('videoModal');
    if (!modal || modal.dataset.ligado) return;
    modal.dataset.ligado = '1';
    document.getElementById('vmClose')?.addEventListener('click', fechar);
    modal.addEventListener('click', function (e) { if (e.target === modal) fechar(); });
    document.addEventListener('keydown', function (e) {
      var m = document.getElementById('videoModal');
      if (!m || m.hasAttribute('hidden')) return;
      if (e.key === 'Escape') { fechar(); return; }
      prender(e);
    });
  }

  // ---- Arranque -------------------------------------------------------
  function arrancar() {
    _todos = ler();
    _visiveis = _todos.slice();

    var grid = document.getElementById('videosGrid');
    if (!jscBlocoAtual(grid, _todos.length)) {
      desenharFiltros(_todos);
      desenharGrelha(_todos);
    }
    reindexar();
    ligarFiltros();
    ligarGrelha();
    ligarModal();
  }

  document.addEventListener('DOMContentLoaded', arrancar);
  document.addEventListener('jsc:synced', arrancar);
  window.addEventListener('storage', function (e) {
    if (e.key === 'db_videos') arrancar();
  });
})();
