// =============================================
// PERFIL DE ATLETA — atleta.js
// =============================================
(function () {

  // Estava aqui um conjunto de registos inventados, usado quando não havia
  // nada publicado. Saiu: o site não mostra pessoas, jogos nem resultados
  // que não existem. Sem dados publicados, a página diz que ainda não há.
  const DEFAULT_ATLETAS = [];

  const DEFAULT_ESCALOES = [
    { id: 7, nome: 'Sub-5',  designacao: 'Pré-Petizes' },
    { id: 8, nome: 'Sub-7',  designacao: 'Petizes'     },
    { id: 1, nome: 'Sub-9',  designacao: 'Traquinas'   },
    { id: 2, nome: 'Sub-11', designacao: 'Benjamins' },
    { id: 3, nome: 'Sub-13', designacao: 'Infantis' },
    { id: 4, nome: 'Sub-15', designacao: 'Iniciados'  },
    { id: 5, nome: 'Sub-17', designacao: 'Juvenis' },
    { id: 6, nome: 'Sub-19', designacao: 'Juniores'   },
  ];

  const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  function loadAtletas() {
    try {
      const raw = localStorage.getItem('db_atletas');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_ATLETAS;
  }

  function loadEscaloes() {
    try {
      const raw = localStorage.getItem('db_escaloes');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return DEFAULT_ESCALOES;
  }

  function calcAge(dob) {
    if (!dob) return null;
    const parts = dob.split('-');
    if (parts.length < 3) return null;
    const birth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function formatDate(dob) {
    if (!dob) return '—';
    const parts = dob.split('-');
    if (parts.length < 3) return dob;
    return `${parseInt(parts[2])} de ${MESES_PT[parseInt(parts[1]) - 1]} de ${parts[0]}`;
  }

  function initials(nome) {
    const parts = nome.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return nome[0].toUpperCase();
  }

  function posGroup(posicao) {
    const p = (posicao || '').toLowerCase();
    if (p.includes('guarda')) return 'Guarda-redes';
    if (p.includes('defesa') || p.includes('central') || p.includes('lateral')) return 'Defesa';
    if (p.includes('médio') || p.includes('extremo')) return 'Médio';
    if (p.includes('avança') || p.includes('ponta')) return 'Avançado';
    return 'Campo';
  }

  function render(atleta, escaloes) {
    const main = document.getElementById('atletaMain');
    if (!main) return;

    document.title = atleta.nome + ' – Juventude Sport Campinense';

    // A data de nascimento deixou de sair pela API pública: é um dado pessoal, e
    // os atletas da formação são menores. Quando não vem, as duas linhas que
    // dependem dela não se escrevem — em vez de ficarem a dizer "—", que é uma
    // linha vazia a ocupar espaço, ou "Invalid Date", que é pior.
    const age = calcAge(atleta.dataNascimento);
    const esc = escaloes.find(e => e.nome === atleta.escalao) || {};
    const iniStr = initials(atleta.nome);
    const inativo = atleta.estado === 'Inactivo';

    main.innerHTML = `
      <!-- ATLETA HERO -->
      <div class="atleta-hero">
        <div class="container">
          <div class="atleta-hero__back">
            <a href="escalao.html?escalao=${jscEscUrl(encodeURIComponent(atleta.escalao))}">← ${jscEsc(atleta.escalao)}</a>
          </div>
          <div class="atleta-hero__card">
            <div class="atleta-hero__avatar${jscEsc(inativo ? ' atleta-hero__avatar--inativo' : '')}">
              ${atleta.foto
                ? `<img src="${jscEscUrl(atleta.foto)}" alt="${jscEsc(atleta.nome)}" class="atleta-hero__photo" />`
                : `<span class="atleta-hero__initials">${jscEsc(iniStr)}</span>`}
            </div>
            <div class="atleta-hero__info">
              <div class="atleta-hero__badges">
                <span class="atleta-hero__esc-badge">${jscEsc(atleta.escalao)}</span>
                ${esc.designacao ? `<span class="atleta-hero__desig">${jscEsc(esc.designacao)}</span>` : ''}
                ${inativo ? '<span class="atleta-hero__inativo-tag">Inactivo</span>' : ''}
              </div>
              <h1 class="atleta-hero__name">${jscEsc(atleta.nome)}</h1>
              <p class="atleta-hero__pos">${jscEsc(atleta.posicao || 'Campo')}</p>
            </div>
            ${atleta.numero ? `<div class="atleta-hero__numero">${jscEsc(atleta.numero)}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- DETAIL GRID -->
      <div class="container atleta-detail-grid">

        <!-- LEFT: info cards -->
        <div class="atleta-left">

          <div class="atleta-card">
            <h2 class="atleta-card__title">Informação</h2>
            <ul class="atleta-info-list">
              ${atleta.dataNascimento ? `<li>
                <span class="atleta-info-list__label">Data de nascimento</span>
                <span class="atleta-info-list__val">${jscEsc(formatDate(atleta.dataNascimento))}</span>
              </li>` : ''}
              ${age !== null ? `<li>
                <span class="atleta-info-list__label">Idade</span>
                <span class="atleta-info-list__val">${jscEsc(age + ' anos')}</span>
              </li>` : ''}
              <li>
                <span class="atleta-info-list__label">Posição</span>
                <span class="atleta-info-list__val">${jscEsc(atleta.posicao || '—')}</span>
              </li>
              <li>
                <span class="atleta-info-list__label">Grupo de posição</span>
                <span class="atleta-info-list__val">${jscEsc(posGroup(atleta.posicao))}</span>
              </li>
              <li>
                <span class="atleta-info-list__label">Escalão</span>
                <span class="atleta-info-list__val">
                  <a href="escalao.html?escalao=${jscEscUrl(encodeURIComponent(atleta.escalao))}" class="atleta-esc-link">${jscEsc(atleta.escalao)}${jscEsc(esc.designacao ? ' · ' + esc.designacao : '')} →</a>
                </span>
              </li>
              ${atleta.numero ? `<li>
                <span class="atleta-info-list__label">Camisola</span>
                <span class="atleta-info-list__val">#${jscEsc(atleta.numero)}</span>
              </li>` : ''}
            </ul>
          </div>

        </div>

        <!-- RIGHT: club card -->
        <div class="atleta-right">

          <div class="atleta-card atleta-card--club">
            <div class="atleta-card__club-logo">
              <img src="images/logo.svg" alt="JSC" class="logo__img" style="width:56px;height:56px;object-fit:contain" />
            </div>
            <div class="atleta-card__club-text">
              <strong>Juventude Sport Campinense</strong>
              <span>Loulé · Algarve · Desde 1947</span>
            </div>
          </div>

          <div class="atleta-card">
            <h2 class="atleta-card__title">Escalão</h2>
            <a href="escalao.html?escalao=${jscEscUrl(encodeURIComponent(atleta.escalao))}" class="atleta-esc-card">
              <div class="atleta-esc-card__badge">${jscEsc(atleta.escalao)}</div>
              <div>
                <div class="atleta-esc-card__name">${jscEsc(esc.designacao || atleta.escalao)}</div>
                <div class="atleta-esc-card__hint">Ver plantel completo →</div>
              </div>
            </a>
          </div>

        </div>

      </div>`;
  }

  function renderError(msg) {
    const main = document.getElementById('atletaMain');
    if (main) main.innerHTML = `<div class="container" style="padding:60px 20px;text-align:center">
      <h1 style="font-size:1.1rem;font-weight:400;color:var(--gray-mid);margin-bottom:20px">${jscEsc(msg)}</h1>
      <a href="formacao.html" class="btn" style="background:var(--blue);color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none">← Voltar à Formação</a>
    </div>`;
  }

  const params = new URLSearchParams(location.search);
  const idParam = params.get('id');

  if (!idParam) { renderError('Atleta não especificado.'); return; }

  const atletas = loadAtletas();
  const atleta = atletas.find(a => String(a.id) === String(idParam));

  if (!atleta) { renderError('Atleta não encontrado.'); return; }

  render(atleta, loadEscaloes());

  window.addEventListener('storage', function (e) {
    if (e.key === 'db_atletas' || e.key === 'db_escaloes') {
      const updated = loadAtletas().find(a => String(a.id) === String(idParam));
      if (updated) render(updated, loadEscaloes());
    }
  });

})();
