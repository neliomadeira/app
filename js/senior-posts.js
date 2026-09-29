// =============================================
// SENIOR-POSTS.JS — publicações da equipa principal
// Filtro: jsc_noticias com categoria === 'Seniores'
// (criadas no admin em Notícias, categoria "Seniores")
// =============================================
(function () {
  'use strict';

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MESES_CURTOS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  // Quantas publicações cabem na grelha. O mesmo número que o
  // jsc_seniores_previa() do api/conteudo.php.
  const PREVIA = 4;

  function getPosts() {
    try {
      const raw = localStorage.getItem('jsc_noticias');
      if (!raw) return [];
      return JSON.parse(raw)
        .filter(n => n.publicada && n.categoria === 'Seniores')
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    } catch (e) { return []; }
  }

  function ptDate(str) {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;
  }

  // O "Ler mais" é uma ligação a sério para noticias.html?id=N. Antes era um
  // <span aria-hidden> e o cartão inteiro um <div role="button" onclick>: sem
  // JavaScript não havia nada para clicar, e com o teclado chegava-se ao
  // cartão mas não a um destino. Com JavaScript, o ouvinte no contentor
  // intercepta o clique e abre o modal como antes.
  //
  // O endereço da imagem passa pelo jscEscUrlCss() do js/html.js, que dá o
  // mesmo resultado que o jsc_esc_url_css() do api/conteudo.php: o cartão
  // gerado no servidor e o cartão desenhado aqui são o mesmo cartão.
  function postCardHtml(n, i) {
    const imgStyle = n.imagem
      ? ` style="background-image:url('${jscEscUrlCss(n.imagem)}');background-size:${jscEsc(n.imagemSize || 'cover')};background-position:${jscEsc(n.imagemPos || 'center')}"`
      : '';
    const imgClass = n.imagem ? '' : ` news-card__img--${jscEsc(n.img || 1)}`;
    return `
      <article class="senior-post-card${jscEsc(i === 0 ? ' senior-post-card--featured' : '')}"
               data-id="${jscEsc(n.id)}" style="cursor:pointer">
        <div class="senior-post-card__img${imgClass}"${imgStyle}>
          <span class="senior-post-card__tag">Seniores</span>
        </div>
        <div class="senior-post-card__body">
          <time class="senior-post-card__date">${jscEsc(ptDate(n.data))}</time>
          <h3 class="senior-post-card__title">${jscEsc(n.titulo)}</h3>
          ${n.resumo ? `<p class="senior-post-card__excerpt">${jscEsc(n.resumo.replace(/<[^>]+>/g, ''))}</p>` : ''}
          <a class="senior-post-card__more" href="noticias.html?id=${jscEsc(encodeURIComponent(n.id))}">Ler mais &rarr;</a>
        </div>
      </article>`;
  }

  function renderPosts() {
    const grid  = document.getElementById('seniorPostsGrid');
    const empty = document.getElementById('seniorPostsEmpty');
    const btn   = document.getElementById('btnVerTodosPosts');
    if (!grid) return;

    const posts = getPosts();

    // hidden, e não style.display: o projeto tem [hidden] com !important
    // (Fase B), e um style inline perderia contra ele.
    if (!posts.length) {
      grid.querySelectorAll('.senior-post-card').forEach(c => c.remove());
      if (empty) empty.hidden = false;
      if (btn)   btn.hidden   = true;
      return;
    }

    if (empty) empty.hidden = true;
    // O estado vazio vive dentro da grelha: reescreve-se a grelha toda e
    // volta-se a pô-lo lá, escondido.
    grid.innerHTML = posts.slice(0, PREVIA).map((p, i) => postCardHtml(p, i)).join('')
      + '\n        <div class="senior-posts__empty" id="seniorPostsEmpty" hidden>'
      + '\n          <p>Sem publicações de momento. As novidades da equipa principal aparecem aqui.</p>'
      + '\n        </div>';
    if (btn) btn.hidden = posts.length <= PREVIA;
  }

  // ---- Archive modal (inline, filtered to Seniores) ----
  function archiveDateBox(data) {
    if (!data) return '<div class="news-archive__date-box"></div>';
    const d = new Date(data + 'T00:00:00');
    return `<div class="news-archive__date-box">
      <span class="news-archive__day">${jscEsc(d.getDate())}</span>
      <span class="news-archive__month">${jscEsc(MESES_CURTOS[d.getMonth()])}</span>
    </div>`;
  }

  function showPostList() {
    const posts = getPosts();
    const body  = document.getElementById('newsArchiveBody');
    if (!body) return;
    document.getElementById('newsArchiveTitle').textContent = 'Publicações — Equipa Principal';
    body.innerHTML = `<div class="news-archive__list">${
      posts.map(n => `
        <div class="news-archive__item" role="button" tabindex="0" data-tecla onclick="openSeniorPost(${jscEsc(n.id)})">
          ${archiveDateBox(n.data)}
          <div class="news-archive__img news-card__img--${jscEsc(n.img || 1)}"
               ${n.imagem ? `style="background-image:url('${jscEscUrlCss(n.imagem)}');background-size:cover;background-position:${jscEsc(n.imagemPos || 'center')}"` : ''}></div>
          <div class="news-archive__info">
            <span class="news-archive__cat">Seniores</span>
            <div class="news-archive__heading">${jscEsc(n.titulo)}</div>
            ${n.resumo ? `<p class="news-archive__excerpt">${jscEsc(n.resumo.replace(/<[^>]+>/g, ''))}</p>` : ''}
          </div>
        </div>`).join('')
    }</div>`;
  }

  function openArchive() {
    showPostList();
    document.getElementById('newsArchive').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  // A substituição do openNewsArchive vai para o arranque, mais abaixo, e não
  // aqui: o js/main.js atribui a sua versão dentro do DOMContentLoaded dele,
  // que corre DEPOIS desta linha e apagava esta. O botão "Ver todas as
  // publicações" desta página abria assim o arquivo de todas as notícias, em
  // vez do das publicações da equipa principal.

  window.openSeniorPost = function (id) {
    const posts = getPosts();
    const n = posts.find(x => x.id == id);
    if (!n) return;

    const body = document.getElementById('newsArchiveBody');
    if (!body) return;
    document.getElementById('newsArchiveTitle').textContent = 'Publicação';

    body.innerHTML = `
      <button class="news-archive__back" onclick="showPostList()">&#8592; Voltar</button>
      <div class="news-article">
        ${n.imagem ? `<div class="news-article__img"
            style="background-image:url('${jscEscUrlCss(n.imagem)}');background-size:${jscEsc(n.imagemSize || 'cover')};background-position:${jscEsc(n.imagemPos || 'center')}"></div>` : ''}
        <h2 class="news-article__title">${jscEsc(n.titulo)}</h2>
        <div class="news-article__meta">
          <span class="news-article__cat-badge">Seniores</span>
          <time>${jscEsc(ptDate(n.data))}</time>
        </div>
        <div class="news-article__body">${n.resumo || '<em style="color:#aaa">Sem texto disponível.</em>'}</div>
      </div>`;

    document.getElementById('newsArchive').classList.add('open');
    document.body.style.overflow = 'hidden';
    body.scrollTop = 0;
  };

  // Close modal
  document.getElementById('newsArchiveClose')
    ?.addEventListener('click', closeArchive);
  document.getElementById('newsArchive')
    ?.addEventListener('click', e => {
      if (e.target === document.getElementById('newsArchive')) closeArchive();
    });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeArchive();
  });

  function closeArchive() {
    document.getElementById('newsArchive')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Auto-update when admin saves from another tab
  window.addEventListener('storage', e => {
    if (e.key === 'jsc_noticias') renderPosts();
  });

  // Re-render quando os dados do servidor chegam (sync.js)
  document.addEventListener('jsc:synced', renderPosts);

  // Quantas publicações existem no total. É este número que o gerador
  // escreve no data-itens, e é por ele que se sabe se a grelha gerada
  // continua a servir.
  function blocoGeradoEstaAtual() {
    return jscBlocoAtual(document.getElementById('seniorPostsGrid'), getPosts().length);
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    // Aqui, e não no arranque do ficheiro: os ouvintes de DOMContentLoaded
    // correm pela ordem em que foram registados, e o do js/main.js é o
    // primeiro. Atribuir depois dele é o que faz esta versão ganhar.
    window.openNewsArchive = openArchive;

    // A grelha pode já vir escrita no HTML pelo servidor. Quando vem e está
    // atual, não se toca: o visitante já a está a ver, sem JavaScript.
    if (!blocoGeradoEstaAtual()) renderPosts();

    // Os cliques são ouvidos no contentor, e não em cada cartão: assim
    // funcionam igual sobre a grelha que o servidor gerou e sobre a que este
    // ficheiro desenha. A ligação do "Ler mais" é interceptada — com
    // JavaScript abre-se o modal, sem ele a ligação leva a um destino real.
    document.getElementById('seniorPostsGrid')?.addEventListener('click', (e) => {
      const cartao = e.target.closest('.senior-post-card[data-id]');
      if (!cartao) return;
      e.preventDefault();
      window.openSeniorPost(cartao.dataset.id);
    });
  });
})();
