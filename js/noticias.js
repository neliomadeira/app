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

  function readingTime(html) {
    const words = (html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    const mins  = Math.max(1, Math.round(words / 200));
    return `${mins} min`;
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
    // hidden, e não style.display: o projeto tem [hidden] com !important
    // (Fase B), e um style inline perderia contra ele.
    if (!cats.length) { bar.hidden = true; bar.innerHTML = ''; return; }
    bar.hidden = false;
    bar.innerHTML = ['Todas', ...cats].map(c =>
      `<button class="news-filter-btn${jscEsc((c === 'Todas' ? '' : c) === _cat ? ' active' : '')}" data-cat="${jscEsc(c === 'Todas' ? '' : c)}">${jscEsc(c)}</button>`
    ).join('');
  }

  function renderFeatured() {
    const wrap = document.getElementById('notFeatured');
    if (!wrap) return;
    const destaque = _all.find(n => n.destaque);
    if (!destaque) { wrap.innerHTML = ''; wrap.hidden = true; return; }
    wrap.hidden = false;
    const plainText = (destaque.resumo || '').replace(/<[^>]+>/g, '');
    const excerpt = plainText.length > 200 ? plainText.slice(0, 200) + '…' : plainText;
    const imgStyle = destaque.imagem
      ? `background-image:url('${jscEscUrlCss(destaque.imagem)}');background-size:cover;background-position:${jscEsc(destaque.focalPos || 'center')};background-repeat:no-repeat`
      : '';
    wrap.innerHTML = `
      <article class="news-hero-card" data-id="${jscEsc(destaque.id)}" style="cursor:pointer">
        <div class="news-hero-card__img" ${imgStyle ? `style="${imgStyle}"` : ''}>
          <span class="news-hero-card__tag">&#11088; Destaque</span>
        </div>
        <div class="news-hero-card__body">
          <span class="news-card__cat">${jscEsc(destaque.categoria || '')}</span>
          <time class="news-card__date">${jscEsc(ptDate(destaque.data))}</time>
          <h2 class="news-hero-card__title">${jscEsc(destaque.titulo)}</h2>
          ${excerpt ? `<p class="news-hero-card__excerpt">${jscEsc(excerpt)}</p>` : ''}
          <a class="news-card__link" href="noticias.html?id=${jscEsc(encodeURIComponent(destaque.id))}">Ler mais &rarr;</a>
        </div>
      </article>`;
  }

  const SHARE_BTN_STYLE = 'font-size:0.75rem;padding:5px 10px;border-radius:20px;background:#f0f4ff;color:#003B8E;border:none;cursor:pointer;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:4px';

  function shareRowHtml(id, titulo) {
    const pageUrl  = encodeURIComponent(window.location.origin + '/noticias.html?id=' + id);
    const titleEnc = encodeURIComponent(titulo);
    const waUrl    = 'https://wa.me/?text=' + titleEnc + '%20' + pageUrl;
    const fbUrl    = 'https://www.facebook.com/sharer/sharer.php?u=' + pageUrl;
    return `<div class="news-share" style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #eee;flex-wrap:wrap">` +
      `<a href="${jscEscUrl(waUrl)}" target="_blank" rel="noopener" class="news-share-btn" style="${jscEsc(SHARE_BTN_STYLE)}">&#128241; WhatsApp</a>` +
      `<a href="${jscEscUrl(fbUrl)}" target="_blank" rel="noopener" class="news-share-btn" style="${jscEsc(SHARE_BTN_STYLE)}">&#128216; Facebook</a>` +
      `<button onclick="(function(b){var u=window.location.origin+'/noticias.html?id=${id}';navigator.clipboard.writeText(u).then(function(){var t=b.textContent;b.textContent='✓ Copiado!';setTimeout(function(){b.textContent=t},2000)}).catch(function(){var t=b.textContent;b.textContent='✓ Copiado!';setTimeout(function(){b.textContent=t},2000)})})(this)" class="news-share-btn" style="${jscEsc(SHARE_BTN_STYLE)}">&#128279; Copiar link</button>` +
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
      if (moreWrap) moreWrap.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    grid.innerHTML = show.map((n, i) => {
      const imgStyle = n.imagem
        ? `background-image:url('${jscEscUrlCss(n.imagem)}');background-size:${jscEsc(n.imagemSize || 'cover')};background-position:${jscEsc(n.focalPos || 'center')};background-repeat:no-repeat`
        : '';
      const plainText = (n.resumo || '').replace(/<[^>]+>/g, '');
      const excerpt = plainText.length > 130 ? plainText.slice(0, 130) + '…' : plainText;
      return `
        <article class="news-card news-page__card" style="cursor:pointer" data-id="${jscEsc(n.id)}">
          <div class="news-card__img${n.imagem ? '' : ` news-card__img--${jscEsc((i % 3) + 1)}`}"${imgStyle ? ` style="${imgStyle}"` : ''}>
            <span class="news-card__cat">${jscEsc(n.categoria || '')}</span>
          </div>
          <div class="news-card__body">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <time class="news-card__date">${jscEsc(ptDate(n.data))}</time>
              <span class="news-card__date" style="opacity:0.6">&#128336; ${jscEsc(readingTime(n.resumo))} de leitura</span>
            </div>
            <h2 class="news-card__title" style="font-size:1.05rem">${jscEsc(n.titulo)}</h2>
            ${excerpt ? `<p class="news-card__excerpt">${jscEsc(excerpt)}</p>` : ''}
            <a class="news-card__link" href="noticias.html?id=${jscEsc(encodeURIComponent(n.id))}">Ler mais &rarr;</a>
            ${shareRowHtml(n.id, n.titulo)}
          </div>
        </article>`;
    }).join('');

    if (moreWrap && moreBtn) {
      const remaining = lista.length - show.length;
      if (!_expanded && remaining > 0) {
        moreWrap.hidden = false;
        moreBtn.textContent = `Ver mais notícias (${remaining} restantes)`;
      } else {
        moreWrap.hidden = true;
      }
    }
  }

  function injectArticleSchema(n) {
    const old = document.getElementById('articleJsonLd');
    if (old) old.remove();
    if (!n || n.id === '__preview__') return;
    const plain = (n.resumo || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 500);
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      'headline': n.titulo,
      'description': plain,
      'datePublished': n.data ? n.data + 'T00:00:00+00:00' : '',
      'url': 'https://campinense.pt/noticias.html?id=' + n.id,
      'publisher': {
        '@type': 'Organization',
        'name': 'Juventude Sport Campinense',
        'logo': { '@type': 'ImageObject', 'url': 'https://campinense.pt/images/logo.png' }
      }
    };
    if (n.imagem && !n.imagem.startsWith('data:')) schema.image = n.imagem;
    const s = document.createElement('script');
    s.id = 'articleJsonLd';
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }

  function openArticle(id) {
    const n = _all.find(x => x.id == id);
    if (!n) return;
    history.pushState({ notId: id }, '', `?id=${id}`);
    showArticle(n);
  }

  // ---- Barra de progresso de leitura ----
  let _progressBar = null;

  function _updateProgress() {
    if (!_progressBar) return;
    const wrap = document.querySelector('.not-article-wrap .news-article');
    if (!wrap) return;
    const rect  = wrap.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const done  = Math.min(Math.max(-rect.top, 0), Math.max(total, 0));
    const p     = total > 0 ? done / total : 1;
    _progressBar.firstElementChild.style.width = (p * 100).toFixed(1) + '%';
  }

  function startReadingProgress() {
    if (_progressBar) return;
    _progressBar = document.createElement('div');
    _progressBar.className = 'reading-progress';
    _progressBar.setAttribute('aria-hidden', 'true');
    _progressBar.innerHTML = '<div class="reading-progress__fill"></div>';
    document.body.appendChild(_progressBar);
    window.addEventListener('scroll', _updateProgress, { passive: true });
    window.addEventListener('resize', _updateProgress);
    _updateProgress();
  }

  function stopReadingProgress() {
    if (!_progressBar) return;
    window.removeEventListener('scroll', _updateProgress);
    window.removeEventListener('resize', _updateProgress);
    _progressBar.remove();
    _progressBar = null;
  }

  function showArticle(n) {
    const grid     = document.getElementById('notGrid');
    const filters  = document.getElementById('notFilters');
    const moreWrap = document.getElementById('notMoreWrap');
    const article  = document.getElementById('notArticle');
    const empty    = document.getElementById('notEmpty');
    const featured = document.getElementById('notFeatured');

    if (grid)     grid.hidden     = true;
    if (filters)  filters.hidden  = true;
    if (moreWrap) moreWrap.hidden = true;
    if (empty)    empty.hidden    = true;
    if (featured) featured.hidden = true;
    if (!article) return;

    const imgPos   = n.imagemPos  || 'top';
    const imgSize  = n.imagemSize || 'cover';
    const imgStyle = n.imagem
      ? `background-image:url('${jscEscUrlCss(n.imagem)}');background-size:${jscEsc(imgSize)};background-position:${jscEsc(n.focalPos || 'center')};background-repeat:no-repeat`
      : '';
    const imgHtml = n.imagem
      ? `<div class="news-article__img news-article__img--${jscEsc(imgPos)}" style="${imgStyle}"></div>`
      : '';
    const topImg  = imgPos === 'top'    ? imgHtml : '';
    const midImg  = imgPos === 'center' ? imgHtml : '';
    const bodyImg = (imgPos === 'left' || imgPos === 'right') ? imgHtml : '';

    const relacionados = n.id === '__preview__' ? [] :
      _all.filter(x => x.id != n.id && x.categoria === n.categoria).slice(0, 3);

    const relacionadosHtml = relacionados.length ? `
      <div class="not-related">
        <h3 class="not-related__title">Mais em ${jscEsc(n.categoria)}</h3>
        <div class="not-related__grid">
          ${relacionados.map((r, i) => {
            const imgStyle = r.imagem
              ? `background-image:url('${jscEscUrl(r.imagem)}');background-size:cover;background-position:${jscEsc(r.focalPos || 'center')}`
              : '';
            return `<article class="not-related__card" data-rel-id="${jscEsc(r.id)}" style="cursor:pointer">
              <div class="not-related__img not-related__img--${jscEsc((i % 3) + 1)}"${imgStyle ? ` style="${imgStyle}"` : ''}></div>
              <div class="not-related__body">
                <time class="news-card__date">${jscEsc(ptDate(r.data))}</time>
                <p class="not-related__heading">${jscEsc(r.titulo)}</p>
              </div>
            </article>`;
          }).join('')}
        </div>
      </div>` : '';

    article.hidden = false;
    article.innerHTML = `
      <div class="not-article-wrap">
        <div style="padding-top:20px">
          <button class="news-archive__back" id="notBack">&#8592; Voltar às notícias</button>
        </div>
        <div class="news-article" style="padding:0 0 32px">
          ${jscEsc(topImg)}
          <h1 class="news-article__title">${jscEsc(n.titulo)}</h1>
          <div class="news-article__meta">
            <span class="news-article__cat-badge">${jscEsc(n.categoria || '')}</span>
            <time>${jscEsc(ptDate(n.data))}</time>
            <span style="color:#999;font-size:0.82rem">&#128336; ${jscEsc(readingTime(n.resumo))} de leitura</span>
          </div>
          ${jscEsc(midImg)}
          <div class="news-article__body">
            ${bodyImg}${n.resumo || '<em style="color:#aaa">Sem texto disponível.</em>'}
          </div>
          <div style="clear:both"></div>
          ${n.id !== '__preview__' ? shareRowHtml(n.id, n.titulo) : ''}
        </div>
        ${relacionadosHtml}
      </div>`;

    injectArticleSchema(n);

    document.getElementById('notBack')?.addEventListener('click', () => {
      history.pushState({}, '', 'noticias.html');
      backToList();
    });
    article.querySelectorAll('.not-related__card').forEach(card => {
      card.addEventListener('click', () => openArticle(card.dataset.relId));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    startReadingProgress();
  }

  function backToList() {
    stopReadingProgress();
    const grid     = document.getElementById('notGrid');
    const filters  = document.getElementById('notFilters');
    const article  = document.getElementById('notArticle');
    const featured = document.getElementById('notFeatured');

    if (article)  article.hidden  = true;
    if (grid)     grid.hidden     = false;
    if (featured) featured.hidden = false;
    document.getElementById('articleJsonLd')?.remove();
    desenharLista();
  }

  window.addEventListener('popstate', e => {
    if (e.state?.notId) {
      const n = _all.find(x => x.id == e.state.notId);
      if (n) showArticle(n);
    } else {
      backToList();
    }
  });

  // Os cliques são ouvidos no contentor, não em cada cartão. Assim funcionam
  // igual sobre os cartões que o servidor gerou e sobre os que este ficheiro
  // desenha — e não há ouvintes a ligar de novo a cada desenho.
  function abrirDoClique(e) {
    const externo = e.target.closest('a[target="_blank"], .news-share');
    if (externo) return;                       // partilha segue o seu caminho
    const cartao = e.target.closest('[data-id]');
    if (!cartao) return;
    e.preventDefault();                        // com JavaScript abre aqui
    openArticle(cartao.dataset.id);
  }
  document.getElementById('notGrid')?.addEventListener('click', abrirDoClique);
  document.getElementById('notFeatured')?.addEventListener('click', abrirDoClique);

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

  // O bloco desta página pode já vir escrito no HTML pelo servidor
  // (api/gerar.php). Quando vem e está atual, não se toca: o visitante já o
  // está a ver, e reescrevê-lo só arriscava mostrar uma versão mais antiga.
  //
  // Duas condições, e ambas têm de se verificar:
  //   data-gerado  o que está guardado não é mais recente do que o gerado;
  //   data-itens   o gerador escreveu tantos cartões quantos os que agora
  //                contamos. É isto que trata das notícias agendadas: uma
  //                que tenha vencido depois da publicação faz a contagem
  //                subir, e então desenhamos, para ela aparecer a horas.
  function blocoGeradoEstaAtual() {
    const grade = document.getElementById('notGrid');
    if (!grade) return false;
    const gerado = grade.getAttribute('data-gerado') || '';
    if (!gerado) return false;
    const publicado = localStorage.getItem('jsc_publicado_em') || '';
    if (publicado && publicado > gerado) return false;
    return Number(grade.getAttribute('data-itens')) === _all.length;
  }

  // Só o primeiro desenho é que se pode dispensar. Tudo o que venha depois —
  // filtrar, "Ver mais", voltar do artigo, o painel a gravar noutro
  // separador — desenha sempre.
  const _servido = blocoGeradoEstaAtual();

  function desenharLista() {
    renderFilters();
    renderGrid();
    renderFeatured();
  }

  function desenharListaSeNecessario() {
    if (_servido) return;
    desenharLista();
  }

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
        desenharListaSeNecessario();
      }
    } catch (e) {
      desenharListaSeNecessario();
    }
  } else if (idParam) {
    const n = _all.find(x => x.id == idParam);
    if (n) {
      showArticle(n);
    } else {
      desenharListaSeNecessario();
    }
  } else {
    desenharListaSeNecessario();
  }

  window.addEventListener('storage', e => {
    if (e.key === NEWS_KEY) {
      _all = loadAll();
      const article = document.getElementById('notArticle');
      if (!article || article.hidden) {
        desenharLista();
      }
    }
  });
})();
