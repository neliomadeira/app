// =============================================
// PERFIL DE ATLETA — atleta.js
// =============================================
(function () {

  const DEFAULT_ATLETAS = [
    { id: 1,  nome: 'Diogo Nunes Marques',    escalao: 'Sub-9',  posicao: '',             numero: '', dataNascimento: '2018-04-13', encarregado: 'Carlos Nunes',   telefone: '+351 915 678 901', estado: 'Activo',   foto: '' },
    { id: 2,  nome: 'Rui Sousa Carvalho',      escalao: 'Sub-11', posicao: 'Médio',        numero: '', dataNascimento: '2016-07-22', encarregado: 'Ana Carvalho',   telefone: '+351 962 789 012', estado: 'Activo',   foto: '' },
    { id: 3,  nome: 'Luís Tavares Brito',      escalao: 'Sub-11', posicao: 'Avançado',     numero: '', dataNascimento: '2015-11-08', encarregado: 'Mário Tavares',  telefone: '+351 935 111 222', estado: 'Activo',   foto: '' },
    { id: 4,  nome: 'Rafael Castro Mota',      escalao: 'Sub-13', posicao: 'Extremo',      numero: '', dataNascimento: '2014-03-30', encarregado: 'Paulo Castro',   telefone: '+351 912 222 333', estado: 'Activo',   foto: '' },
    { id: 5,  nome: 'Gonçalo Pires Mendes',    escalao: 'Sub-13', posicao: 'Central',      numero: '', dataNascimento: '2013-09-15', encarregado: 'Sofia Pires',    telefone: '+351 963 333 444', estado: 'Activo',   foto: '' },
    { id: 6,  nome: 'Tiago Ferreira Lima',     escalao: 'Sub-15', posicao: 'Defesa Dir.',  numero: '', dataNascimento: '2012-06-01', encarregado: 'Jorge Ferreira', telefone: '+351 934 444 555', estado: 'Activo',   foto: '' },
    { id: 7,  nome: 'Bernardo Santos Cruz',    escalao: 'Sub-15', posicao: 'Médio Def.',   numero: '', dataNascimento: '2011-02-19', encarregado: 'Carla Santos',   telefone: '+351 916 555 666', estado: 'Activo',   foto: '' },
    { id: 8,  nome: 'Francisco Lopes Vaz',     escalao: 'Sub-17', posicao: 'Avançado',     numero: '', dataNascimento: '2010-08-05', encarregado: 'António Lopes',  telefone: '+351 962 666 777', estado: 'Activo',   foto: '' },
    { id: 9,  nome: 'Martim Costa Azevedo',    escalao: 'Sub-17', posicao: 'Extremo',      numero: '', dataNascimento: '2009-12-27', encarregado: 'Rosa Costa',     telefone: '+351 933 777 888', estado: 'Activo',   foto: '' },
    { id: 10, nome: 'Pedro Gomes Rodrigues',   escalao: 'Sub-19', posicao: 'Guarda-redes', numero: '', dataNascimento: '2008-05-14', encarregado: '-',              telefone: '+351 916 901 234', estado: 'Activo',   foto: '' },
    { id: 11, nome: 'Rodrigo Alves Monteiro',  escalao: 'Sub-19', posicao: 'Médio',        numero: '', dataNascimento: '2007-10-03', encarregado: '-',              telefone: '+351 915 888 999', estado: 'Inactivo', foto: '' },
  ];

  const DEFAULT_ESCALOES = [
    { id: 1, nome: 'Sub-9',  designacao: 'Petizes'   },
    { id: 2, nome: 'Sub-11', designacao: 'Traquinas' },
    { id: 3, nome: 'Sub-13', designacao: 'Benjamins' },
    { id: 4, nome: 'Sub-15', designacao: 'Infantis'  },
    { id: 5, nome: 'Sub-17', designacao: 'Iniciados' },
    { id: 6, nome: 'Sub-19', designacao: 'Juvenis'   },
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

    const age = calcAge(atleta.dataNascimento);
    const esc = escaloes.find(e => e.nome === atleta.escalao) || {};
    const iniStr = initials(atleta.nome);
    const inativo = atleta.estado === 'Inactivo';

    main.innerHTML = `
      <!-- ATLETA HERO -->
      <div class="atleta-hero">
        <div class="container">
          <div class="atleta-hero__back">
            <a href="escalao.html?escalao=${encodeURIComponent(atleta.escalao)}">← ${atleta.escalao}</a>
          </div>
          <div class="atleta-hero__card">
            <div class="atleta-hero__avatar${inativo ? ' atleta-hero__avatar--inativo' : ''}">
              ${atleta.foto
                ? `<img src="${atleta.foto}" alt="${atleta.nome}" class="atleta-hero__photo" />`
                : `<span class="atleta-hero__initials">${iniStr}</span>`}
            </div>
            <div class="atleta-hero__info">
              <div class="atleta-hero__badges">
                <span class="atleta-hero__esc-badge">${atleta.escalao}</span>
                ${esc.designacao ? `<span class="atleta-hero__desig">${esc.designacao}</span>` : ''}
                ${inativo ? '<span class="atleta-hero__inativo-tag">Inactivo</span>' : ''}
              </div>
              <h1 class="atleta-hero__name">${atleta.nome}</h1>
              <p class="atleta-hero__pos">${atleta.posicao || 'Campo'}</p>
            </div>
            ${atleta.numero ? `<div class="atleta-hero__numero">${atleta.numero}</div>` : ''}
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
              <li>
                <span class="atleta-info-list__label">Data de nascimento</span>
                <span class="atleta-info-list__val">${formatDate(atleta.dataNascimento)}</span>
              </li>
              <li>
                <span class="atleta-info-list__label">Idade</span>
                <span class="atleta-info-list__val">${age !== null ? age + ' anos' : '—'}</span>
              </li>
              <li>
                <span class="atleta-info-list__label">Posição</span>
                <span class="atleta-info-list__val">${atleta.posicao || '—'}</span>
              </li>
              <li>
                <span class="atleta-info-list__label">Grupo de posição</span>
                <span class="atleta-info-list__val">${posGroup(atleta.posicao)}</span>
              </li>
              <li>
                <span class="atleta-info-list__label">Escalão</span>
                <span class="atleta-info-list__val">
                  <a href="escalao.html?escalao=${encodeURIComponent(atleta.escalao)}" class="atleta-esc-link">${atleta.escalao}${esc.designacao ? ' · ' + esc.designacao : ''} →</a>
                </span>
              </li>
              ${atleta.numero ? `<li>
                <span class="atleta-info-list__label">Camisola</span>
                <span class="atleta-info-list__val">#${atleta.numero}</span>
              </li>` : ''}
            </ul>
          </div>

        </div>

        <!-- RIGHT: club card -->
        <div class="atleta-right">

          <div class="atleta-card atleta-card--club">
            <div class="atleta-card__club-logo">
              <img src="images/logo.png" alt="JSC" class="logo__img" style="width:56px;height:56px;object-fit:contain" />
            </div>
            <div class="atleta-card__club-text">
              <strong>Juventude Sport Campinense</strong>
              <span>Loulé · Algarve · Desde 1947</span>
            </div>
          </div>

          <div class="atleta-card">
            <h2 class="atleta-card__title">Escalão</h2>
            <a href="escalao.html?escalao=${encodeURIComponent(atleta.escalao)}" class="atleta-esc-card">
              <div class="atleta-esc-card__badge">${atleta.escalao}</div>
              <div>
                <div class="atleta-esc-card__name">${esc.designacao || atleta.escalao}</div>
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
      <p style="font-size:1.1rem;color:#666;margin-bottom:20px">${msg}</p>
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
