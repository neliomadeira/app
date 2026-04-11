// =============================================
// SENIOR-POSTS.JS — publicações da equipa principal
// Filtro: db_noticias com categoria === 'Seniores'
// =============================================
(function () {
  'use strict';

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MESES_CURTOS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  function getPosts() {
    try {
      const raw = localStorage.getItem('db_noticias');
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

  function postCardHtml(n, i) {
    const imgStyle = n.imagem
      ? `style="background-image:url('${n.imagem}');background-size:${(n.imagemSize || 'cover')};background-position:${n.imagemPos || 'center'}"`
      : '';
    const imgClass = n.imagem ? '' : ` news-card__img--${n.img || 1}`;
    return `
      <article class="senior-post-card${i === 0 ? ' senior-post-card--featured' : ''}"
               onclick="openSeniorPost(${n.id})" style="cursor:pointer">
        <div class="senior-post-card__img${imgClass}" ${imgStyle}>
          <span class="senior-post-card__tag">Seniores</span>
        </div>
        <div class="senior-post-card__body">
          <time class="senior-post-card__date">${ptDate(n.data)}</time>
          <h3 class="senior-post-card__title">${n.titulo}</h3>
          ${n.resumo ? `<p class="senior-post-card__excerpt">${n.resumo}</p>` : ''}
          <span class="senior-post-card__more">Ler mais &rarr;</span>
        </div>
      </article>`;
  }

  function renderPosts() {
    const grid  = document.getElementById('seniorPostsGrid');
    const empty = document.getElementById('seniorPostsEmpty');
    const btn   = document.getElementById('btnVerTodosPosts');
    if (!grid) return;

    const posts = getPosts();

    if (!posts.length) {
      if (empty) empty.style.display = '';
      if (btn)   btn.style.display   = 'none';
      return;
    }

    if (empty) empty.style.display = 'none';
    grid.innerHTML = posts.slice(0, 4).map((p, i) => postCardHtml(p, i)).join('');
    if (btn) btn.style.display = posts.length > 4 ? '' : 'none';
  }

  // ---- Archive modal (inline, filtered to Seniores) ----
  function archiveDateBox(data) {
    if (!data) return '<div class="news-archive__date-box"></div>';
    const d = new Date(data + 'T00:00:00');
    return `<div class="news-archive__date-box">
      <span class="news-archive__day">${d.getDate()}</span>
      <span class="news-archive__month">${MESES_CURTOS[d.getMonth()]}</span>
    </div>`;
  }

  function showPostList() {
    const posts = getPosts();
    const body  = document.getElementById('newsArchiveBody');
    if (!body) return;
    document.getElementById('newsArchiveTitle').textContent = 'Publicações — Equipa Principal';
    body.innerHTML = `<div class="news-archive__list">${
      posts.map(n => `
        <div class="news-archive__item" onclick="openSeniorPost(${n.id})">
          ${archiveDateBox(n.data)}
          <div class="news-archive__img news-card__img--${n.img || 1}"
               ${n.imagem ? `style="background-image:url('${n.imagem}');background-size:cover;background-position:${n.imagemPos || 'center'}"` : ''}></div>
          <div class="news-archive__info">
            <span class="news-archive__cat">Seniores</span>
            <div class="news-archive__heading">${n.titulo}</div>
            ${n.resumo ? `<p class="news-archive__excerpt">${n.resumo}</p>` : ''}
          </div>
        </div>`).join('')
    }</div>`;
  }

  function openArchive() {
    showPostList();
    document.getElementById('newsArchive').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  window.openNewsArchive = openArchive;   // overrides main.js version on this page

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
            style="background-image:url('${n.imagem}');background-size:${n.imagemSize || 'cover'};background-position:${n.imagemPos || 'center'}"></div>` : ''}
        <h2 class="news-article__title">${n.titulo}</h2>
        <div class="news-article__meta">
          <span class="news-article__cat-badge">Seniores</span>
          <time>${ptDate(n.data)}</time>
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
    if (e.key === 'db_noticias') renderPosts();
  });

  // Init
  document.addEventListener('DOMContentLoaded', renderPosts);
})();
