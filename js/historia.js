// =============================================
// HISTÓRIA DO CLUBE — public page
// =============================================
(function () {

  const DEFAULT_TIMELINE = [
    { id: 1, ano: 1923, titulo: 'Fundação do Clube',
      descricao: 'O Juventude Sport Campinense nasce em Loulé com a missão de desenvolver o desporto e a juventude da região do Algarve.',
      imagem: '', destaque: true },
    { id: 2, ano: 1950, titulo: 'Instalações Próprias',
      descricao: 'Inauguração das primeiras instalações permanentes do clube, marco fundamental para o crescimento da formação desportiva.',
      imagem: '', destaque: false },
    { id: 3, ano: 1980, titulo: 'Primeira Grande Conquista Distrital',
      descricao: 'Vitória no Campeonato Distrital da AF Algarve, consolidando o clube como referência no futebol regional.',
      imagem: '', destaque: true },
    { id: 4, ano: 2000, titulo: 'Renovação e Modernização',
      descricao: 'Reestruturação dos escalões de formação com um programa de desenvolvimento de jovens atletas reconhecido em todo o Algarve.',
      imagem: '', destaque: false },
    { id: 5, ano: 2010, titulo: 'Atletas na Seleção Nacional',
      descricao: 'Primeiros atletas formados no clube convocados para seleções nacionais de sub-escalões, fruto do excelente trabalho de formação.',
      imagem: '', destaque: true },
    { id: 6, ano: 2023, titulo: 'Centenário — 100 Anos de História',
      descricao: 'Grande celebração do centenário com torneio especial, exposição fotográfica histórica e homenagens no Estádio Municipal de Loulé.',
      imagem: '', destaque: true },
  ];

  const DEFAULT_PALMARES = [
    { id: 1, competicao: 'Campeonato Distrital AF Algarve', escalao: 'Sub-17', ano: 2024, observacao: '' },
    { id: 2, competicao: 'Campeonato Distrital AF Algarve', escalao: 'Sub-15', ano: 2023, observacao: '' },
    { id: 3, competicao: 'Torneio Concelhio de Loulé',      escalao: 'Sub-13', ano: 2023, observacao: '1.º lugar' },
    { id: 4, competicao: 'Campeonato Distrital AF Algarve', escalao: 'Sub-17', ano: 2022, observacao: '' },
    { id: 5, competicao: 'Torneio da Amizade',              escalao: 'Sub-11', ano: 2022, observacao: '1.º lugar' },
    { id: 6, competicao: 'Campeonato Distrital AF Algarve', escalao: 'Sub-13', ano: 2021, observacao: '' },
  ];

  function loadTimeline() {
    try {
      const raw = localStorage.getItem('db_historia');
      if (raw) return JSON.parse(raw).sort((a, b) => (a.ano || 0) - (b.ano || 0));
    } catch (e) {}
    return DEFAULT_TIMELINE;
  }

  function loadPalmares() {
    try {
      const raw = localStorage.getItem('db_palmares');
      if (raw) return JSON.parse(raw).sort((a, b) => (b.ano || 0) - (a.ano || 0));
    } catch (e) {}
    return DEFAULT_PALMARES;
  }

  function renderTimeline() {
    const el = document.getElementById('historiaTimeline');
    if (!el) return;
    const lista = loadTimeline();
    if (!lista.length) {
      el.innerHTML = '<p class="historia-empty">Sem marcos históricos registados.</p>';
      return;
    }
    el.innerHTML = lista.map((item, i) => {
      const cls   = item.destaque ? ' timeline-item--destaque' : '';
      const side  = i % 2 === 0 ? 'left' : 'right';
      const imgHtml = item.imagem
        ? `<img src="${item.imagem}" alt="${item.titulo}" class="timeline-card__img" loading="lazy" />`
        : '';
      return `
        <div class="timeline-item timeline-item--${side}${cls}">
          <div class="timeline-year-wrap">
            <span class="timeline-year">${item.ano}</span>
          </div>
          <div class="timeline-dot"></div>
          <div class="timeline-card-wrap">
            <div class="timeline-card">
              <span class="timeline-card__year-mobile">${item.ano}</span>
              ${imgHtml}
              <h3 class="timeline-card__title">${item.titulo}</h3>
              ${item.descricao ? `<p class="timeline-card__desc">${item.descricao}</p>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderPalmares() {
    const el = document.getElementById('historiaPalmares');
    if (!el) return;
    const lista = loadPalmares();
    if (!lista.length) {
      el.innerHTML = '<p class="historia-empty" style="grid-column:1/-1">Sem títulos registados.</p>';
      return;
    }
    el.innerHTML = lista.map(t => `
      <div class="palmares-card">
        <div class="palmares-card__icon">&#127942;</div>
        <div class="palmares-card__body">
          <div class="palmares-card__title">${t.competicao}</div>
          <div class="palmares-card__meta">${t.ano}${t.observacao ? ' &middot; ' + t.observacao : ''}</div>
          ${t.escalao ? `<span class="palmares-card__badge">${t.escalao}</span>` : ''}
        </div>
      </div>`).join('');
  }

  renderTimeline();
  renderPalmares();
  initReveal();

  window.addEventListener('storage', e => {
    if (e.key === 'db_historia') { renderTimeline(); initReveal(); }
    if (e.key === 'db_palmares') { renderPalmares(); initReveal(); }
  });

  function initReveal() {
    if (!window.IntersectionObserver) return;
    const items = document.querySelectorAll('.timeline-item:not(.tl-reveal), .palmares-card:not(.tl-reveal)');
    if (!items.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('tl-visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(el => { el.classList.add('tl-reveal'); obs.observe(el); });
  }

})();
