// =============================================
// HISTÓRIA DO CLUBE — public page
// =============================================
(function () {

  const DEFAULT_TIMELINE = [
    { id: 1, ano: 1947, titulo: 'Fundação do Clube',
      descricao: 'O Juventude Sport Campinense é fundado em Loulé a 12 de dezembro de 1947, ligado à juventude e à comunidade louletana. Pedro Correia Bota, jogador e fundador, orientou o clube nos primeiros anos.',
      imagem: '', destaque: true },
    { id: 2, ano: 1948, titulo: 'Filiação desportiva',
      descricao: 'O clube é federado a 8 de janeiro, iniciando o seu percurso oficial na Associação de Futebol do Algarve.',
      imagem: '', destaque: false },
    { id: 3, ano: 1950, titulo: 'Crescimento e implantação local',
      descricao: 'Ao longo das décadas de 1950 e 1960, o Campinense consolida a presença na vida desportiva de Loulé. O futebol torna-se a principal modalidade, com participação em competições regionais e distritais.',
      imagem: '', destaque: false },
    { id: 4, ano: 1978, titulo: 'Ascensão competitiva',
      descricao: 'No final da década de 1970, o clube inicia uma das fases mais fortes da sua história no futebol sénior, afirmando-se nas competições nacionais.',
      imagem: '', destaque: false },
    { id: 5, ano: 1982, titulo: 'Melhor campanha na Taça de Portugal',
      descricao: 'Na época de 1981/82, o clube alcança os 1/32 de final — a melhor campanha conhecida nas suas 12 participações na Taça de Portugal.',
      imagem: '', destaque: true },
    { id: 6, ano: 1984, titulo: 'Campeão da Série F da III Divisão Nacional',
      descricao: 'Na época de 1983/84, o Campinense vence a Série F da III Divisão Nacional e conquista o acesso ao segundo escalão do futebol português.',
      imagem: '', destaque: true },
    { id: 7, ano: 1985, titulo: 'II Divisão Nacional — Zona Sul',
      descricao: 'Em 1984/85, o clube disputa a II Divisão Nacional, o ponto competitivo mais elevado da sua história. No total: uma época na II Divisão, nove na III Divisão e doze presenças na Taça de Portugal.',
      imagem: '', destaque: true },
    { id: 8, ano: 1988, titulo: 'Título distrital sénior',
      descricao: 'A equipa sénior conquista um título distrital, reforçando o estatuto do clube no futebol algarvio.',
      imagem: '', destaque: false },
    { id: 9, ano: 1994, titulo: 'Criação da secção de boxe',
      descricao: 'Nasce a secção de boxe, com atletas de formação, manutenção e competição — incluindo trabalho de inclusão através do boxe adaptado.',
      imagem: '', destaque: false },
    { id: 10, ano: 1995, titulo: 'Medalha Municipal de Mérito — Grau Prata',
      descricao: 'A Câmara Municipal de Loulé distingue o clube pelo seu papel na promoção do desporto, na formação dos jovens e na vida social do concelho.',
      imagem: '', destaque: true },
    { id: 11, ano: 2001, titulo: 'Utilidade pública',
      descricao: 'O clube é reconhecido como pessoa coletiva de utilidade pública, confirmando oficialmente a sua relevância social, associativa e desportiva.',
      imagem: '', destaque: false },
    { id: 12, ano: 2006, titulo: 'Campeão Distrital e Taça do Algarve',
      descricao: 'Época dourada em 2005/06: conquista do Campeonato Distrital da 1.ª Divisão da AF Algarve e da Taça do Algarve, garantindo o regresso às competições nacionais.',
      imagem: '', destaque: true },
    { id: 13, ano: 2007, titulo: 'Regresso aos campeonatos nacionais',
      descricao: 'O clube disputa três épocas consecutivas na III Divisão Nacional (2006/07 a 2008/09) e volta a marcar presença na Taça de Portugal.',
      imagem: '', destaque: false },
    { id: 14, ano: 2010, titulo: 'Aposta reforçada na formação',
      descricao: 'Durante a década de 2010, a formação torna-se um dos pilares do projeto desportivo, com trabalho regular em vários escalões, dos mais jovens aos juniores.',
      imagem: '', destaque: false },
    { id: 15, ano: 2017, titulo: 'Iniciados Campeões do Algarve',
      descricao: 'Na época de 2016/17, os Iniciados conquistam um título inédito de Campeões do Algarve e o acesso ao Campeonato Nacional de Iniciados.',
      imagem: '', destaque: true },
    { id: 16, ano: 2018, titulo: 'Torneios e futsal feminino',
      descricao: 'Realiza-se o V Torneio Humberto «Laranjeira» Faísca e o clube promove o torneio e o Algarve Invitational de futsal feminino.',
      imagem: '', destaque: false },
    { id: 17, ano: 2019, titulo: 'Kickboxing e formação em destaque',
      descricao: 'Atletas do clube conquistam títulos no kickboxing e os Traquinas A vencem a Mértola Cup.',
      imagem: '', destaque: false },
    { id: 18, ano: 2020, titulo: 'Resiliência e multidesporto',
      descricao: 'O clube adapta-se às restrições da pandemia mantendo a ligação a atletas e famílias. Cristina Azevedo sagra-se vice-campeã nacional de ciclismo (Masters 40) em representação do Campinense.',
      imagem: '', destaque: false },
    { id: 19, ano: 2021, titulo: 'Entidade Formadora de Três Estrelas',
      descricao: 'A FPF certifica o clube como Entidade Formadora de Três Estrelas. Nasce a Campinense Cup e o projeto de futsal feminino ganha novo impulso.',
      imagem: '', destaque: true },
    { id: 20, ano: 2022, titulo: 'Iniciados vencem a Challenge Cup',
      descricao: 'Novo momento de destaque da formação, seguido do título distrital da 2.ª Divisão em 2022/23, com subida à 1.ª Divisão.',
      imagem: '', destaque: false },
    { id: 21, ano: 2024, titulo: 'Futsal feminino em força',
      descricao: 'O clube coorganiza a Taça de Campeão de Inverno e realiza a II Maratona de Futsal Feminino, dinamizando a modalidade no Algarve.',
      imagem: '', destaque: false },
    { id: 22, ano: 2025, titulo: 'Campeão da Liga Algarve de Futsal Feminino',
      descricao: 'Título da Liga Algarve de Futsal Feminino em 2024/25, subida dos Juvenis (Sub-17) à 1.ª Divisão Distrital e quarta edição da Campinense Cup.',
      imagem: '', destaque: true },
    { id: 23, ano: 2026, titulo: 'Âmbito nacional e novos torneios',
      descricao: 'A equipa sénior feminina participa na Taça Nacional de Futsal Feminino 2025/26. Realizam-se o IX Torneio Humberto Faísca e o II Torneio de Futebol Feminino.',
      imagem: '', destaque: false },
  ];

  const DEFAULT_PALMARES = [
    { id: 1, competicao: 'III Divisão Nacional — Série F', escalao: 'Seniores', ano: 1984, observacao: 'Campeão — subida à II Divisão' },
    { id: 2, competicao: 'Campeonato Distrital 1.ª Divisão AF Algarve', escalao: 'Seniores', ano: 2006, observacao: 'Campeão' },
    { id: 3, competicao: 'Taça do Algarve', escalao: 'Seniores', ano: 2006, observacao: 'Vencedor' },
    { id: 4, competicao: 'Título Distrital', escalao: 'Seniores', ano: 1988, observacao: '' },
    { id: 5, competicao: 'Campeonato do Algarve', escalao: 'Iniciados', ano: 2017, observacao: 'Campeão — acesso ao Nacional' },
    { id: 6, competicao: 'Campeonato Distrital 2.ª Divisão', escalao: 'Iniciados', ano: 2023, observacao: 'Campeão — subida à 1.ª Divisão' },
    { id: 7, competicao: 'Liga Algarve de Futsal Feminino', escalao: 'Sen. Femininos', ano: 2025, observacao: 'Campeão' },
    { id: 8, competicao: 'Challenge Cup', escalao: 'Iniciados', ano: 2022, observacao: 'Vencedor' },
    { id: 9, competicao: 'Mértola Cup', escalao: 'Traquinas A', ano: 2019, observacao: 'Vencedor' },
    { id: 10, competicao: '1.ª Divisão Distrital', escalao: 'Juvenis (Sub-17)', ano: 2025, observacao: 'Subida' },
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
