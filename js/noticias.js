// Dedicated news page — noticias.html
(function () {
  const NEWS_KEY = 'jsc_noticias';
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const PREVIEW = 9;

  let _all = [];
  let _cat = '';
  let _expanded = false;

  function ptDate(d) {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return `${dt.getDate()} de ${MESES[dt.getMonth()]}, ${dt.getFullYear()}`;
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(NEWS_KEY);
      if (!raw) return [];
      const now = new Date().toISOString();
      return JSON.parse(raw)
        .filter(n => n.publicada || (n.scheduledAt && n.scheduledAt <= now))
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    } catch (e) { return []; }
  }

  function filtered() {
    return _cat ? _all.filter(n => n.categoria === _cat) : _all;
  }

  function renderFilters() {
    const bar = document.getElementById('notFilters');
    if (!bar) return;
    const cats = [...new Set(_all.map(n => n.categoria).filter(Boolean))];
    if (!cats.length) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    bar.innerHTML = ['Todas', ...cats].map(c =>
      `<button class="news-filter-btn${(c === 'Todas' ? '' : c) === _cat ? ' active' : ''}" data-cat="${c === 'Todas' ? '' : c}">${c}</button>`
    ).join('');
  }

  function renderFeatured() {
    const wrap = document.getElementById('notFeatured');
    if (!wrap) return;
    const destaque = _all.find(n => n.destaque);
    if (!destaque) { wrap.innerHTML = ''; return; }
    const plainText = (destaque.resumo || '').replace(/<[^>]+>/g, '');
    const excerpt = plainText.length > 200 ? plainText.slice(0, 200) + '…' : plainText;
    const imgStyle = destaque.imagem
      ? `background-image:url('${destaque.imagem}');background-size:cover;background-position:${destaque.focalPos || 'center'};background-repeat:no-repeat`
      : '';
    wrap.innerHTML = `
      <article class="news-hero-card" data-id="${destaque.id}" style="cursor:pointer">
        <div class="news-hero-card__img" ${imgStyle ? `style="${imgStyle}"` : ''}>
          <span class="news-hero-card__tag">&#11088; Destaque</span>
        </div>
        <div class="news-hero-card__body">
          <span class="news-card__cat">${destaque.categoria || ''}</span>
          <time class="news-card__date">${ptDate(destaque.data)}</time>
          <h2 class="news-hero-card__title">${destaque.titulo}</h2>
          ${excerpt ? `<p class="news-hero-card__excerpt">${excerpt}</p>` : ''}
          <span class="news-card__link">Ler mais &rarr;</span>
        </div>
      </article>`;
    wrap.querySelector('.news-hero-card').addEventListener('click', () => openArticle(destaque.id));
  }

  const SHARE_BTN_STYLE = 'font-size:0.75rem;padding:5px 10px;border-radius:20px;background:#f0f4ff;color:#003B8E;border:none;cursor:pointer;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:4px';

  function shareRowHtml(id, titulo) {
    const pageUrl  = encodeURIComponent(window.location.origin + '/noticias.html?id=' + id);
    const titleEnc = encodeURIComponent(titulo);
    const waUrl    = 'https://wa.me/?text=' + titleEnc + '%20' + pageUrl;
    const fbUrl    = 'https://www.facebook.com/sharer/sharer.php?u=' + pageUrl;
    return `<div class="news-share" style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #eee;flex-wrap:wrap">` +
      `<a href="${waUrl}" target="_blank" rel="noopener" class="news-share-btn" style="${SHARE_BTN_STYLE}">&#128241; WhatsApp</a>` +
      `<a href="${fbUrl}" target="_blank" rel="noopener" class="news-share-btn" style="${SHARE_BTN_STYLE}">&#128216; Facebook</a>` +
      `<button onclick="(function(b){var u=window.location.origin+'/noticias.html?id=${id}';navigator.clipboard.writeText(u).then(function(){var t=b.textContent;b.textContent='✓ Copiado!';setTimeout(function(){b.textContent=t},2000)}).catch(function(){var t=b.textContent;b.textContent='✓ Copiado!';setTimeout(function(){b.textContent=t},2000)})})(this)" class="news-share-btn" style="${SHARE_BTN_STYLE}">&#128279; Copiar link</button>` +
      `</div>`;
  }

  function renderGrid() {
    const grid    = document.getElementById('notGrid');
    const moreWrap = document.getElementById('notMoreWrap');
    const moreBtn  = document.getElementById('notMoreBtn');
    const empty   = document.getElementById('notEmpty');
    if (!grid) return;

    const lista = filtered();
    const show  = _expanded ? lista : lista.slice(0, PREVIEW);

    if (!lista.length) {
      grid.innerHTML = '';
      if (moreWrap) moreWrap.style.display = 'none';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    grid.innerHTML = show.map((n, i) => {
      const imgStyle = n.imagem
        ? `background-image:url('${n.imagem}');background-size:${n.imagemSize || 'cover'};background-position:${n.focalPos || 'center'};background-repeat:no-repeat`
        : '';
      const plainText = (n.resumo || '').replace(/<[^>]+>/g, '');
      const excerpt = plainText.length > 130 ? plainText.slice(0, 130) + '…' : plainText;
      return `
        <article class="news-card news-page__card" style="cursor:pointer" data-id="${n.id}">
          <div class="news-card__img${n.imagem ? '' : ` news-card__img--${(i % 3) + 1}`}"${imgStyle ? ` style="${imgStyle}"` : ''}>
            <span class="news-card__cat">${n.categoria || ''}</span>
          </div>
          <div class="news-card__body">
            <time class="news-card__date">${ptDate(n.data)}</time>
            <h2 class="news-card__title" style="font-size:1.05rem">${n.titulo}</h2>
            ${excerpt ? `<p class="news-card__excerpt">${excerpt}</p>` : ''}
            <span class="news-card__link">Ler mais &rarr;</span>
            ${shareRowHtml(n.id, n.titulo)}
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.news-page__card').forEach(card => {
      card.addEventListener('click', () => openArticle(card.dataset.id));
    });

    if (moreWrap && moreBtn) {
      const remaining = lista.length - show.length;
      if (!_expanded && remaining > 0) {
        moreWrap.style.display = '';
        moreBtn.textContent = `Ver mais notícias (${remaining} restantes)`;
      } else {
        moreWrap.style.display = 'none';
      }
    }
  }

  function openArticle(id) {
    const n = _all.find(x => x.id == id);
    if (!n) return;
    history.pushState({ notId: id }, '', `?id=${id}`);
    showArticle(n);
  }

  function showArticle(n) {
    const grid     = document.getElementById('notGrid');
    const filters  = document.getElementById('notFilters');
    const moreWrap = document.getElementById('notMoreWrap');
    const article  = document.getElementById('notArticle');
    const empty    = document.getElementById('notEmpty');
    const featured = document.getElementById('notFeatured');

    if (grid)     grid.style.display     = 'none';
    if (filters)  filters.style.display  = 'none';
    if (moreWrap) moreWrap.style.display = 'none';
    if (empty)    empty.style.display    = 'none';
    if (featured) featured.style.display = 'none';
    if (!article) return;

    const imgPos   = n.imagemPos  || 'top';
    const imgSize  = n.imagemSize || 'cover';
    const imgStyle = n.imagem
      ? `background-image:url('${n.imagem}');background-size:${imgSize};background-position:${n.focalPos || 'center'};background-repeat:no-repeat`
      : '';
    const imgHtml = n.imagem
      ? `<div class="news-article__img news-article__img--${imgPos}" style="${imgStyle}"></div>`
      : '';
    const topImg  = imgPos === 'top'    ? imgHtml : '';
    const midImg  = imgPos === 'center' ? imgHtml : '';
    const bodyImg = (imgPos === 'left' || imgPos === 'right') ? imgHtml : '';

    article.style.display = '';
    article.innerHTML = `
      <div class="not-article-wrap">
        <button class="news-archive__back" id="notBack" style="padding:20px 0 0">&#8592; Voltar às notícias</button>
        <div class="news-article" style="padding:0 0 32px">
          ${topImg}
          <h1 class="news-article__title">${n.titulo}</h1>
          <div class="news-article__meta">
            <span class="news-article__cat-badge">${n.categoria || ''}</span>
            <time>${ptDate(n.data)}</time>
          </div>
          ${midImg}
          <div class="news-article__body">
            ${bodyImg}${n.resumo || '<em style="color:#aaa">Sem texto disponível.</em>'}
          </div>
          <div style="clear:both"></div>
          ${n.id !== '__preview__' ? shareRowHtml(n.id, n.titulo) : ''}
        </div>
      </div>`;

    document.getElementById('notBack')?.addEventListener('click', () => {
      history.pushState({}, '', 'noticias.html');
      backToList();
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToList() {
    const grid     = document.getElementById('notGrid');
    const filters  = document.getElementById('notFilters');
    const article  = document.getElementById('notArticle');
    const featured = document.getElementById('notFeatured');

    if (article)  article.style.display  = 'none';
    if (grid)     grid.style.display     = '';
    if (featured) featured.style.display = '';
    renderFilters();
    renderGrid();
    renderFeatured();
  }

  window.addEventListener('popstate', e => {
    if (e.state?.notId) {
      const n = _all.find(x => x.id == e.state.notId);
      if (n) showArticle(n);
    } else {
      backToList();
    }
  });

  document.getElementById('notFilters')?.addEventListener('click', e => {
    const btn = e.target.closest('.news-filter-btn');
    if (!btn) return;
    _cat = btn.dataset.cat;
    _expanded = false;
    document.querySelectorAll('.news-filter-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.cat === _cat)
    );
    renderGrid();
  });

  document.getElementById('notMoreBtn')?.addEventListener('click', () => {
    _expanded = true;
    renderGrid();
  });

  // Initialise
  _all = loadAll();

  const params       = new URLSearchParams(window.location.search);
  const idParam      = params.get('id');
  const previewParam = params.get('preview');

  if (previewParam === '1') {
    // Preview mode — read draft from sessionStorage
    try {
      const prev = JSON.parse(sessionStorage.getItem('news_preview') || 'null');
      if (prev) {
        // Banner de pré-visualização
        const section = document.querySelector('.section .container');
        if (section) {
          const banner = document.createElement('div');
          banner.style.cssText = 'background:#fef3c7;border:2px solid #f59e0b;padding:12px 20px;border-radius:10px;margin-bottom:24px;display:flex;align-items:center;gap:12px;font-size:0.9rem;font-weight:600;color:#92400e';
          banner.innerHTML = '<span style="font-size:1.1rem">&#9889;</span> Pré-visualização &mdash; esta notícia ainda não está publicada. <button onclick="window.close()" style="margin-left:auto;background:rgba(0,0,0,0.08);border:none;cursor:pointer;border-radius:6px;padding:4px 10px;font-size:0.85rem">Fechar</button>';
          section.prepend(banner);
        }
        showArticle(prev);
      } else {
        renderFilters();
        renderGrid();
        renderFeatured();
      }
    } catch (e) {
      renderFilters();
      renderGrid();
      renderFeatured();
    }
  } else if (idParam) {
    const n = _all.find(x => x.id == idParam);
    if (n) {
      showArticle(n);
    } else {
      renderFilters();
      renderGrid();
      renderFeatured();
    }
  } else {
    renderFilters();
    renderGrid();
    renderFeatured();
  }

  window.addEventListener('storage', e => {
    if (e.key === NEWS_KEY) {
      _all = loadAll();
      const article = document.getElementById('notArticle');
      if (!article || article.style.display === 'none') {
        renderFilters();
        renderGrid();
        renderFeatured();
      }
    }
  });
})();
