// =============================================
// HISTÓRIA DO CLUBE — cronologia e palmarés
// =============================================
// Fonte: db_historia e db_palmares. As duas zonas são escritas pela geração
// (modelos/historia-cronologia.php e modelos/historia-palmares.php); este
// ficheiro só as redesenha quando o que está na página deixou de servir, e
// trata da revelação ao rolar.
//
// O que aqui estava e saiu:
//   — DEFAULT_TIMELINE com 22 marcos e DEFAULT_PALMARES com 16 títulos,
//     cópias completas dos factos históricos do clube. Havia três cópias
//     iguais — esta, uma em admin/js/admin.js e uma em js/pesquisa.js. A
//     semente única passou para admin/js/data.js, ao lado dos escalões e das
//     modalidades. Nenhum facto foi perdido; o que saiu foram as cópias;
//   — o fallback para essas cópias quando a base estava vazia. Base vazia
//     passa a mostrar o estado vazio, em vez de história escrita no código;
//   — a ordenação que só se aplicava quando havia dados publicados: sem eles,
//     o palmarés saía pela ordem do array e começava em 1984, não em 2026;
//   — <img src=""> quando o endereço da imagem era recusado.
//
// A revelação ao rolar fica como melhoria progressiva, e o CSS sozinho nunca
// esconde: o estado invisível existe só com html.jsc-anima, marca que este
// ficheiro põe. Na impressão e sem JavaScript, o que está escrito vê-se.
// =============================================
'use strict';

(function () {

  // ---- Leitura ------------------------------------------------------------
  // Réplicas exactas do jsc_historia() e do jsc_palmares() do
  // api/conteudo.php, incluindo a ordenação estável.

  function lerBase(chave) {
    var lista = [];
    try { lista = JSON.parse(localStorage.getItem(chave) || '[]'); } catch (e) { lista = []; }
    return Array.isArray(lista) ? lista : [];
  }

  function texto(o, chave) {
    return typeof o[chave] === 'string' ? o[chave].trim() : '';
  }

  function lerMarcos() {
    var fora = lerBase('db_historia')
      .filter(function (h) { return h && typeof h === 'object' && jscAtivo(h.ativo); })
      // Sem título não há <h3> nem nome acessível. O registo fica nos dados; o
      // que não acontece é ir para a página incompleto.
      .filter(function (h) { return texto(h, 'titulo') !== ''; })
      .map(function (h) {
        var ano = jscAnoHistorico(h.ano);
        var imagem = texto(h, 'imagem');
        // jscEscUrl() devolve '' para javascript:, vbscript: e data: que não
        // seja de imagem. Endereço recusado conta como ausência: o marco sai
        // sem imagem, nunca com src="".
        if (imagem !== '' && jscEscUrl(imagem) === '') imagem = '';
        return {
          _ano:      ano === 0 ? Number.MAX_SAFE_INTEGER : ano,  // sem ano vai para o fim
          ano:       ano === 0 ? '' : String(ano),
          titulo:    texto(h, 'titulo'),
          descricao: texto(h, 'descricao'),
          imagem:    imagem,
          destaque:  !!h.destaque,
        };
      });
    return jscOrdenarPorAno(fora, true);
  }

  function lerTitulos() {
    var fora = lerBase('db_palmares')
      .filter(function (t) { return t && typeof t === 'object' && jscAtivo(t.ativo); })
      .filter(function (t) { return texto(t, 'competicao') !== ''; })
      .map(function (t) {
        var ano = jscAnoHistorico(t.ano);
        return {
          _ano:       ano === 0 ? Number.MIN_SAFE_INTEGER : ano,  // sem ano vai para o fim
          ano:        ano === 0 ? '' : String(ano),
          competicao: texto(t, 'competicao'),
          // Texto livre: guarda grupos etários, designações como 'Traquinas A'
          // e nomes de atletas. Escreve-se o que lá estiver.
          escalao:    texto(t, 'escalao'),
          observacao: texto(t, 'observacao'),
        };
      });
    return jscOrdenarPorAno(fora, false);
  }

  // ---- Desenho ------------------------------------------------------------
  // Mesmo HTML que os modelos PHP escrevem.

  function desenharMarcos(el, lista) {
    if (!lista.length) {
      el.innerHTML = '<p class="historia-empty">Sem marcos históricos registados.</p>';
      return;
    }
    el.innerHTML = lista.map(function (m, i) {
      var lado = i % 2 === 0 ? 'left' : 'right';
      var classe = 'timeline-item timeline-item--' + lado
                 + (m.destaque ? ' timeline-item--destaque' : '');
      var ano = m.ano !== ''
        ? '<div class="timeline-year-wrap"><span class="timeline-year">' + jscEsc(m.ano) + '</span></div>'
        : '';
      var anoMovel = m.ano !== ''
        ? '<span class="timeline-card__year-mobile">' + jscEsc(m.ano) + '</span>'
        : '';
      // A imagem é decorativa: o título vem logo a seguir, no <h3>.
      var img = m.imagem !== ''
        ? '<img src="' + jscEscUrl(m.imagem) + '" alt="" aria-hidden="true" class="timeline-card__img" loading="lazy" />'
        : '';
      var desc = m.descricao !== ''
        ? '<p class="timeline-card__desc">' + jscEsc(m.descricao) + '</p>'
        : '';
      return '<div class="' + classe + '">'
           + ano
           + '<div class="timeline-dot"></div>'
           + '<div class="timeline-card-wrap"><div class="timeline-card">'
           + anoMovel + img
           + '<h3 class="timeline-card__title">' + jscEsc(m.titulo) + '</h3>'
           + desc
           + '</div></div>'
           + '</div>';
    }).join('');
  }

  function desenharTitulos(el, lista) {
    if (!lista.length) {
      el.innerHTML = '<p class="historia-empty" style="grid-column:1/-1">Sem títulos registados.</p>';
      return;
    }
    el.innerHTML = lista.map(function (t) {
      var meta = t.observacao !== ''
        ? (t.ano !== '' ? jscEsc(t.ano) + ' &middot; ' + jscEsc(t.observacao) : jscEsc(t.observacao))
        : jscEsc(t.ano);
      return '<div class="palmares-card">'
           + '<div class="palmares-card__icon" aria-hidden="true">&#127942;</div>'
           + '<div class="palmares-card__body">'
           + '<div class="palmares-card__title">' + jscEsc(t.competicao) + '</div>'
           + (meta !== '' ? '<div class="palmares-card__meta">' + meta + '</div>' : '')
           + (t.escalao !== '' ? '<span class="palmares-card__badge">' + jscEsc(t.escalao) + '</span>' : '')
           + '</div></div>';
    }).join('');
  }

  // ---- Sincronização ------------------------------------------------------
  // Se o bloco que o servidor escreveu continua a servir, não se toca nele:
  // redesenhar o que já está certo só dava trabalho ao browser e podia perder
  // o estado da revelação.

  function sincronizar() {
    var tl = document.getElementById('historiaTimeline');
    var pm = document.getElementById('historiaPalmares');
    var mudou = false;

    if (tl) {
      var marcos = lerMarcos();
      if (!jscBlocoAtual(tl, marcos.length)) { desenharMarcos(tl, marcos); mudou = true; }
    }
    if (pm) {
      var titulos = lerTitulos();
      if (!jscBlocoAtual(pm, titulos.length)) { desenharTitulos(pm, titulos); mudou = true; }
    }
    if (mudou) revelar();
  }

  // ---- Revelação ao rolar -------------------------------------------------

  function revelar() {
    if (!window.IntersectionObserver) return;
    var itens = document.querySelectorAll('.timeline-item:not(.tl-reveal), .palmares-card:not(.tl-reveal)');
    if (!itens.length) return;
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('tl-visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    // Só a partir daqui o CSS pode esconder: a marca no documento é o que liga
    // a animação. Sem ela, o que está escrito fica visível.
    document.documentElement.classList.add('jsc-anima');
    itens.forEach(function (el) { el.classList.add('tl-reveal'); obs.observe(el); });
  }

  sincronizar();
  revelar();

  // Depois de publicar, o js/sync.js traz o conteúdo novo e avisa.
  document.addEventListener('jsc:synced', sincronizar);
  window.addEventListener('storage', function (e) {
    if (e.key === 'db_historia' || e.key === 'db_palmares') sincronizar();
  });

})();
