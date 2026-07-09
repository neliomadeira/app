// =============================================
// RESULTADOS & CLASSIFICAÇÃO — JS
// =============================================

const DADOS = {
  'Sub-17': {
    competicao: 'Campeonato Distrital AF Algarve – Iniciados',
    classificacao: [
      { equipa: 'Olhanense',          abrev: 'OLH', j:14, v:11, e:1, d:2, gm:38, gs:14, forma:'VVVEV' },
      { equipa: 'Sport Campinense',   abrev: 'SC',  j:14, v:10, e:2, d:2, gm:35, gs:16, forma:'VVVVE', sc:true },
      { equipa: 'SC Farense',         abrev: 'FAR', j:14, v: 9, e:2, d:3, gm:29, gs:17, forma:'VEVDV' },
      { equipa: 'FC Quarteira',       abrev: 'QUA', j:14, v: 8, e:2, d:4, gm:27, gs:20, forma:'VVDDE' },
      { equipa: 'CD Tavira',          abrev: 'TAV', j:14, v: 7, e:3, d:4, gm:24, gs:22, forma:'EVVDV' },
      { equipa: 'GD Silves',          abrev: 'SIL', j:14, v: 5, e:4, d:5, gm:20, gs:23, forma:'DEDVV' },
      { equipa: 'CD Portimão',        abrev: 'POR', j:14, v: 4, e:3, d:7, gm:18, gs:28, forma:'VDDDD' },
      { equipa: 'AD Lagoa',           abrev: 'LAG', j:14, v: 3, e:2, d:9, gm:14, gs:33, forma:'DDDVD' },
      { equipa: 'FC Moncarapacho',    abrev: 'MON', j:14, v: 2, e:1, d:11,gm:10, gs:40, forma:'DDDDD' },
    ],
    jogos: [
      { id:1,  casa:'Sport Campinense', fora:'CD Tavira',         gcasa:3, gfora:1, data:'2026-03-22', hora:'10:30', local:'Est. Municipal Loulé', estado:'Realizado' },
      { id:2,  casa:'GD Silves',        fora:'Sport Campinense',  gcasa:1, gfora:2, data:'2026-03-15', hora:'15:00', local:'Campo de Silves',      estado:'Realizado' },
      { id:3,  casa:'Sport Campinense', fora:'FC Quarteira',      gcasa:2, gfora:2, data:'2026-03-08', hora:'10:30', local:'Est. Municipal Loulé', estado:'Realizado' },
      { id:4,  casa:'Olhanense',        fora:'Sport Campinense',  gcasa:2, gfora:1, data:'2026-03-01', hora:'11:00', local:'Estádio José Artur Lavado', estado:'Realizado' },
      { id:5,  casa:'Sport Campinense', fora:'SC Farense',        gcasa:4, gfora:0, data:'2026-02-22', hora:'10:30', local:'Est. Municipal Loulé', estado:'Realizado' },
      { id:6,  casa:'Sport Campinense', fora:'Olhanense',         gcasa:null, gfora:null, data:'2026-04-12', hora:'10:30', local:'Est. Municipal Loulé', estado:'Agendado' },
      { id:7,  casa:'CD Portimão',      fora:'Sport Campinense',  gcasa:null, gfora:null, data:'2026-04-19', hora:'11:00', local:'Campo Municipal Portimão', estado:'Agendado' },
      { id:8,  casa:'Sport Campinense', fora:'AD Lagoa',          gcasa:null, gfora:null, data:'2026-04-26', hora:'10:30', local:'Est. Municipal Loulé', estado:'Agendado' },
    ],
  },
  'Sub-15': {
    competicao: 'Campeonato Distrital AF Algarve – Infantis',
    classificacao: [
      { equipa: 'Sport Campinense',   abrev: 'SC',  j:12, v:9,  e:2, d:1, gm:32, gs:12, forma:'VVVVV', sc:true },
      { equipa: 'SC Farense',         abrev: 'FAR', j:12, v:8,  e:2, d:2, gm:28, gs:14, forma:'VVEVD' },
      { equipa: 'FC Quarteira',       abrev: 'QUA', j:12, v:7,  e:1, d:4, gm:23, gs:18, forma:'VVDVD' },
      { equipa: 'Olhanense',          abrev: 'OLH', j:12, v:6,  e:2, d:4, gm:22, gs:20, forma:'VDVVE' },
      { equipa: 'CD Tavira',          abrev: 'TAV', j:12, v:5,  e:2, d:5, gm:18, gs:21, forma:'DVEVV' },
      { equipa: 'GD Silves',          abrev: 'SIL', j:12, v:3,  e:3, d:6, gm:15, gs:25, forma:'DEDDD' },
      { equipa: 'AD Lagoa',           abrev: 'LAG', j:12, v:2,  e:1, d:9, gm:10, gs:38, forma:'DDDDD' },
    ],
    jogos: [
      { id:10, casa:'Sport Campinense', fora:'FC Quarteira',     gcasa:3, gfora:0, data:'2026-03-29', hora:'09:00', local:'Est. Municipal Loulé', estado:'Realizado' },
      { id:11, casa:'SC Farense',       fora:'Sport Campinense', gcasa:1, gfora:2, data:'2026-03-22', hora:'09:30', local:'Estádio Algarve',      estado:'Realizado' },
      { id:12, casa:'Sport Campinense', fora:'Olhanense',        gcasa:null, gfora:null, data:'2026-04-12', hora:'09:00', local:'Est. Municipal Loulé', estado:'Agendado' },
      { id:13, casa:'CD Tavira',        fora:'Sport Campinense', gcasa:null, gfora:null, data:'2026-04-26', hora:'10:00', local:'Campo Municipal Tavira', estado:'Agendado' },
    ],
  },
  'Sub-13': {
    competicao: 'Campeonato Distrital AF Algarve – Benjamins',
    classificacao: [
      { equipa: 'FC Quarteira',       abrev: 'QUA', j:10, v:8,  e:1, d:1, gm:28, gs:10, forma:'VVVVV' },
      { equipa: 'Sport Campinense',   abrev: 'SC',  j:10, v:7,  e:2, d:1, gm:25, gs:11, forma:'VVVEV', sc:true },
      { equipa: 'Olhanense',          abrev: 'OLH', j:10, v:6,  e:1, d:3, gm:20, gs:15, forma:'VVDVD' },
      { equipa: 'GD Silves',          abrev: 'SIL', j:10, v:4,  e:2, d:4, gm:15, gs:18, forma:'VDDEV' },
      { equipa: 'CD Tavira',          abrev: 'TAV', j:10, v:3,  e:1, d:6, gm:12, gs:22, forma:'DVDDD' },
      { equipa: 'AD Lagoa',           abrev: 'LAG', j:10, v:1,  e:1, d:8, gm: 8, gs:32, forma:'DDDDD' },
    ],
    jogos: [
      { id:20, casa:'Sport Campinense', fora:'GD Silves',        gcasa:4, gfora:1, data:'2026-03-29', hora:'09:00', local:'Est. Municipal Loulé', estado:'Realizado' },
      { id:21, casa:'Olhanense',        fora:'Sport Campinense', gcasa:1, gfora:1, data:'2026-03-22', hora:'09:00', local:'Est. José Artur Lavado', estado:'Realizado' },
      { id:22, casa:'Sport Campinense', fora:'FC Quarteira',     gcasa:null, gfora:null, data:'2026-04-19', hora:'09:00', local:'Est. Municipal Loulé', estado:'Agendado' },
    ],
  },
  'Sub-19': {
    competicao: 'Campeonato Nacional Juvenis – Série Sul',
    classificacao: [
      { equipa: 'SL Benfica B',       abrev: 'SLB', j:16, v:13, e:2, d:1, gm:42, gs:12, forma:'VVVVV' },
      { equipa: 'Sporting CP B',      abrev: 'SCP', j:16, v:12, e:2, d:2, gm:38, gs:14, forma:'VVVEV' },
      { equipa: 'SC Farense',         abrev: 'FAR', j:16, v:9,  e:3, d:4, gm:28, gs:20, forma:'VVDVV' },
      { equipa: 'Olhanense',          abrev: 'OLH', j:16, v:7,  e:3, d:6, gm:24, gs:24, forma:'EVVDD' },
      { equipa: 'Sport Campinense',   abrev: 'SC',  j:16, v:6,  e:3, d:7, gm:22, gs:26, forma:'VDDVE', sc:true },
      { equipa: 'FC Portimão',        abrev: 'POR', j:16, v:5,  e:2, d:9, gm:18, gs:30, forma:'DVDDV' },
      { equipa: 'GD Silves',          abrev: 'SIL', j:16, v:3,  e:2, d:11,gm:14, gs:38, forma:'DDDDD' },
      { equipa: 'CD Tavira',          abrev: 'TAV', j:16, v:2,  e:1, d:13,gm:10, gs:46, forma:'DDDDD' },
    ],
    jogos: [
      { id:30, casa:'Sport Campinense', fora:'SC Farense',       gcasa:1, gfora:2, data:'2026-03-28', hora:'15:00', local:'Est. Municipal Loulé', estado:'Realizado' },
      { id:31, casa:'Olhanense',        fora:'Sport Campinense', gcasa:1, gfora:1, data:'2026-03-21', hora:'15:00', local:'Est. José Artur Lavado', estado:'Realizado' },
      { id:32, casa:'Sport Campinense', fora:'SL Benfica B',     gcasa:null, gfora:null, data:'2026-04-11', hora:'15:00', local:'Est. Municipal Loulé', estado:'Agendado' },
      { id:33, casa:'FC Portimão',      fora:'Sport Campinense', gcasa:null, gfora:null, data:'2026-04-18', hora:'15:00', local:'Campo Municipal Portimão', estado:'Agendado' },
    ],
  },
  'Sub-11': {
    competicao: 'Torneio Distrital AF Algarve – Traquinas',
    classificacao: [
      { equipa: 'Sport Campinense',   abrev: 'SC',  j:8, v:6, e:1, d:1, gm:22, gs: 8, forma:'VVVVV', sc:true },
      { equipa: 'FC Quarteira',       abrev: 'QUA', j:8, v:5, e:2, d:1, gm:18, gs:10, forma:'VVEVV' },
      { equipa: 'GD Silves',          abrev: 'SIL', j:8, v:4, e:1, d:3, gm:14, gs:12, forma:'VVDDV' },
      { equipa: 'CD Tavira',          abrev: 'TAV', j:8, v:2, e:2, d:4, gm:10, gs:18, forma:'DEVDD' },
      { equipa: 'AD Lagoa',           abrev: 'LAG', j:8, v:1, e:0, d:7, gm: 5, gs:21, forma:'DDDDD' },
    ],
    jogos: [
      { id:40, casa:'Sport Campinense', fora:'GD Silves',    gcasa:3, gfora:1, data:'2026-03-29', hora:'10:00', local:'Est. Municipal Loulé', estado:'Realizado' },
      { id:41, casa:'Sport Campinense', fora:'AD Lagoa',     gcasa:null, gfora:null, data:'2026-04-12', hora:'10:00', local:'Est. Municipal Loulé', estado:'Agendado' },
    ],
  },
};

// ---- HELPERS ---- //
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtData(str) {
  const d = new Date(str);
  return { day: String(d.getDate()).padStart(2,'0'), mes: MESES[d.getMonth()], full: str };
}

function calcPts(v, e) { return v * 3 + e; }

function formaHTML(forma) {
  return forma.split('').map(f => {
    const cls = f==='V'?'v':f==='E'?'e':'d';
    return `<span class="forma-dot forma-dot--${cls}">${f}</span>`;
  }).join('');
}

function isSC(name) {
  return /sport campinense|js campinense|campinense/i.test(name || '');
}

// Bloco de equipas de um jogo: para jogos do Campinense mostra só o
// adversário com etiqueta Casa/Fora; caso contrário mostra as duas equipas
function jogoEquipasHtml(j) {
  const scCasa = isSC(j.casa), scFora = isSC(j.fora);
  if (scCasa || scFora) {
    const emCasa    = scCasa;
    const adversario = emCasa ? j.fora : j.casa;
    const advLogo    = emCasa ? j.logoFora : j.logoCasa;
    return `
      <div class="jogo-equipas">
        <span class="jogo-equipa">${jogoLogo(advLogo, adversario)}${adversario}</span>
        <span class="jogo-lado jogo-lado--${emCasa ? 'casa' : 'fora'}">${emCasa ? 'Casa' : 'Fora'}</span>
      </div>`;
  }
  return `
      <div class="jogo-equipas">
        <span class="jogo-equipa">${jogoLogo(j.logoCasa, j.casa)}${j.casa}</span>
        <div class="jogo-equipa-row">
          <span class="vs">vs</span>
          <span class="jogo-equipa">${jogoLogo(j.logoFora, j.fora)}${j.fora}</span>
        </div>
      </div>`;
}

// Logo da equipa num jogo: guardado no próprio jogo ou via mapa db_logos
function jogoLogo(url, nome) {
  let resolved = url;
  if (!resolved) {
    try {
      const logos = JSON.parse(localStorage.getItem('db_logos') || '{}');
      resolved = logos[(nome || '').toLowerCase()] || '';
    } catch(e) {}
  }
  return resolved
    ? `<img src="${resolved}" alt="" class="jogo-team-logo" loading="lazy" onerror="this.style.display='none'">`
    : '';
}

function scClass(name) {
  return isSC(name) ? ' jogo-equipa--sc' : '';
}

function resultadoSC(jogo) {
  if (jogo.estado !== 'Realizado') return null;
  const scCasa = isSC(jogo.casa);
  const gcSC  = scCasa ? jogo.gcasa : jogo.gfora;
  const gcAdv = scCasa ? jogo.gfora : jogo.gcasa;
  if (gcSC > gcAdv) return 'v';
  if (gcSC === gcAdv) return 'e';
  return 'd';
}

// ---- MULTI-EQUIPA: ler equipas configuradas por escalão ---- //
function getTeams(escalao) {
  try {
    const cfg   = JSON.parse(localStorage.getItem('fpf_sync_config') || '{}');
    const teams = (cfg[escalao] || {}).teams || {};
    return Object.entries(teams).map(([key, t]) => ({ key, nome: t.nome || key }));
  } catch(e) { return []; }
}

// ---- CARREGAR DADOS (localStorage FPF > estáticos) ---- //
function getDados(escalao, teamKey) {
  const base    = DADOS[escalao] || { competicao: escalao, classificacao: [], jogos: [] };
  const clsKey  = teamKey ? `fpf_class_${escalao}__${teamKey}` : `fpf_class_${escalao}`;
  const jgsKey  = teamKey ? `fpf_jogos_${escalao}__${teamKey}` : `fpf_jogos_${escalao}`;
  try {
    const cls = localStorage.getItem(clsKey);
    const jgs = localStorage.getItem(jgsKey);
    if (cls || jgs) {
      return {
        competicao:    base.competicao,
        classificacao: cls ? JSON.parse(cls) : (teamKey ? [] : base.classificacao),
        jogos:         jgs ? JSON.parse(jgs) : (teamKey ? [] : base.jogos),
        fromFPF:       true,
      };
    }
  } catch(e) {}
  return teamKey ? { competicao: escalao, classificacao: [], jogos: [] } : base;
}

function syncBadge(escalao, teamKey) {
  const cfg   = JSON.parse(localStorage.getItem('fpf_sync_config') || '{}');
  const tCfg  = teamKey ? (cfg[escalao]?.teams?.[teamKey] || {}) : (cfg[escalao] || {});
  const t     = tCfg.lastSync || tCfg.lastJogos;
  const el    = document.getElementById('resSyncBadge');
  if (!el) return;
  el.textContent = t
    ? `${new Date(t).toLocaleDateString('pt-PT', { day:'2-digit', month:'short' })}`
    : 'Dados locais';
  el.title = t ? `Última actualização: ${new Date(t).toLocaleString('pt-PT')}` : '';
}

// ---- RENDER CLASSIFICAÇÃO ---- //
function renderClass(escalao) {
  const dados = getDados(escalao, teamActivo);
  syncBadge(escalao, teamActivo);

  document.getElementById('resCompeticao').textContent = dados.competicao;

  // Load logo map (team name → url), built by admin when importing
  let logosMap = {};
  try { logosMap = JSON.parse(localStorage.getItem('db_logos') || '{}'); } catch(e) {}

  const sorted = [...dados.classificacao].map(t => {
    // Use stored pts (includes Phase 1 carry-over from ZeroZero) when available.
    // If pts1fase is set, add it to the Phase 2 calculated pts.
    const fase2Pts  = calcPts(t.v, t.e);
    const totalPts  = t.pts != null && t.pts > fase2Pts
      ? t.pts                          // stored value already includes Phase 1
      : fase2Pts + (t.pts1fase || 0);  // add Phase 1 carry-over if entered separately
    // Resolve logo: stored per-row, or from global db_logos lookup
    const logo = t.logo || logosMap[(t.equipa || '').toLowerCase()] || '';
    return { ...t, pts: totalPts, dg: t.gm - t.gs, logo };
  }).sort((a,b) => b.pts - a.pts || b.dg - a.dg || b.gm - a.gm);

  const tbody = document.getElementById('classTable');
  tbody.innerHTML = sorted.map((t, i) => {
    const pos = i + 1;
    const posBadge = pos <= 3
      ? `<span class="pos-badge pos-badge--${pos}">${pos}</span>`
      : `<span>${pos}</span>`;
    const badgeClass = t.sc ? 'team-badge--sc' : 'team-badge--other';
    const logoEl = t.logo
      ? `<img src="${t.logo}" alt="${t.abrev}" class="team-logo" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">`
        + `<span class="team-badge ${badgeClass}" style="display:none">${t.abrev}</span>`
      : `<span class="team-badge ${badgeClass}">${t.abrev}</span>`;
    return `
      <tr class="${t.sc ? 'sc-row' : ''}">
        <td class="pos-cell">${posBadge}</td>
        <td>
          <div class="team-cell">
            ${logoEl}
            <span>${t.equipa}${t.sc ? ' ★' : ''}</span>
          </div>
        </td>
        <td>${t.j}</td>
        <td>${t.v}</td>
        <td>${t.e}</td>
        <td>${t.d}</td>
        <td>${t.gm}</td>
        <td>${t.gs}</td>
        <td>${t.dg > 0 ? '+' : ''}${t.dg}</td>
        <td class="pts-cell">${t.pts}</td>
        <td><div class="forma">${formaHTML(t.forma)}</div></td>
      </tr>`;
  }).join('');
}

// ---- RENDER JOGOS ---- //
function renderJogos(escalao) {
  const dados = getDados(escalao, teamActivo);
  if (!dados) return;

  const realizados = dados.jogos.filter(j => j.estado === 'Realizado')
    .sort((a,b) => b.data.localeCompare(a.data));
  const agendados = dados.jogos.filter(j => j.estado === 'Agendado')
    .sort((a,b) => a.data.localeCompare(b.data));

  // Resultados
  const resEl = document.getElementById('resultadosJogos');
  if (!realizados.length) {
    resEl.innerHTML = '<p class="jogo-empty">Sem resultados registados.</p>';
  } else {
    resEl.innerHTML = realizados.map(j => {
      const d        = fmtData(j.data);
      const res      = resultadoSC(j);
      const resLabel = res === 'v' ? 'Vitória' : res === 'e' ? 'Empate' : 'Derrota';
      const jData    = encodeURIComponent(JSON.stringify({ ...j, escalao: escalaoActivo }));
      return `
        <div class="jogo-item">
          <div class="jogo-data">
            <div class="jogo-data__day">${d.day}</div>
            <div class="jogo-data__mes">${d.mes}</div>
          </div>
          <div class="jogo-divider"></div>
          <div class="jogo-info">
            ${jogoEquipasHtml(j)}
            ${j.local && j.local.length > 2 ? `<div class="jogo-meta">${j.local}</div>` : ''}
          </div>
          <div class="jogo-resultado">
            <div class="resultado-placar">${j.gcasa}–${j.gfora}</div>
            ${res ? `<div class="resultado-badge resultado-badge--${res}">${resLabel}</div>` : ''}
          </div>
          <button class="jogo-share-btn" data-jogo="${jData}" title="Partilhar resultado">&#8679;</button>
        </div>`;
    }).join('');

    resEl.addEventListener('click', e => {
      const btn = e.target.closest('.jogo-share-btn');
      if (!btn) return;
      try { openShareModal(JSON.parse(decodeURIComponent(btn.dataset.jogo))); } catch(_) {}
    });
  }

  // Próximos
  const proxEl = document.getElementById('proximosJogos');
  if (!agendados.length) {
    proxEl.innerHTML = '<p class="jogo-empty">Sem jogos agendados.</p>';
  } else {
    proxEl.innerHTML = agendados.map(j => {
      const d = fmtData(j.data);
      return `
        <div class="jogo-item">
          <div class="jogo-data">
            <div class="jogo-data__day">${d.day}</div>
            <div class="jogo-data__mes">${d.mes}</div>
          </div>
          <div class="jogo-divider"></div>
          <div class="jogo-info">
            ${jogoEquipasHtml(j)}
            ${j.local && j.local.length > 2 ? `<div class="jogo-meta">${j.local}</div>` : ''}
          </div>
          <div class="jogo-agendado">
            <div class="jogo-hora">${j.hora}</div>
            <div class="jogo-badge-prox">Agendado</div>
          </div>
        </div>`;
    }).join('');
  }
}

// ---- TEAM SELECTOR ---- //
let teamActivo = '';

function renderTeamSelector(escalao) {
  const teams = getTeams(escalao);
  const bar   = document.getElementById('teamsBar');
  const inner = document.getElementById('teamsInner');
  if (!bar || !inner) return;

  if (teams.length <= 1) {
    bar.style.display = 'none';
    teamActivo = teams[0]?.key || '';
    return;
  }

  // Keep previous selection if valid, else default to first
  if (!teams.find(t => t.key === teamActivo)) teamActivo = teams[0].key;

  bar.style.display = 'block';
  inner.innerHTML = teams.map(t =>
    `<button class="team-tab${t.key === teamActivo ? ' active' : ''}" data-team="${t.key}">${t.nome}</button>`
  ).join('');

  inner.querySelectorAll('.team-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      teamActivo = btn.dataset.team;
      inner.querySelectorAll('.team-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderClass(escalaoActivo);
      renderJogos(escalaoActivo);
    });
  });
}

// ---- TABS ---- //
let escalaoActivo = 'Sub-17';

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    escalaoActivo = btn.dataset.escalao;
    teamActivo    = '';
    renderTeamSelector(escalaoActivo);
    renderClass(escalaoActivo);
    renderJogos(escalaoActivo);
  });
});

// ---- INIT ---- //
renderTeamSelector(escalaoActivo);
renderClass(escalaoActivo);
renderJogos(escalaoActivo);

// =============================================
// PARTILHA DE RESULTADOS
// =============================================
// Polyfill roundRect for Safari < 15.4
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function ptDateFull(str) {
  const d = new Date(str + 'T00:00:00');
  return `${d.getDate()} de ${MESES_FULL[d.getMonth()]}, ${d.getFullYear()}`;
}

function shareText(jogo) {
  const res = resultadoSC(jogo);
  const emoji = res === 'v' ? '🏆' : res === 'e' ? '🤝' : '💪';
  const label = res === 'v' ? 'VITÓRIA' : res === 'e' ? 'EMPATE' : 'DERROTA';
  const date  = ptDateFull(jogo.data);
  const lines = [
    `⚽ ${jogo.escalao || ''} | RESULTADO`,
    `${emoji} ${jogo.casa} ${jogo.gcasa} – ${jogo.gfora} ${jogo.fora}`,
    `📅 ${date}`,
    jogo.local ? `📍 ${jogo.local}` : '',
    '',
    `${label} 🟡`,
    '#JSCampinense #Formação #Algarve',
  ].filter(l => l !== null && (l !== '' || true));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function drawShareCard(canvas, jogo, logoImg) {
  const ctx = canvas.getContext('2d');
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;

  const res = resultadoSC(jogo);
  const resColor = res === 'v' ? '#22c55e' : res === 'e' ? '#f59e0b' : '#ef4444';
  const resLabel = res === 'v' ? 'VITÓRIA' : res === 'e' ? 'EMPATE' : 'DERROTA';

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#001133');
  bg.addColorStop(0.6, '#003B8E');
  bg.addColorStop(1, '#001f4d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle diagonal lines pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
  }

  // Top yellow accent bar
  ctx.fillStyle = '#FFD100';
  ctx.fillRect(0, 0, W, 10);

  // Bottom yellow bar
  ctx.fillStyle = '#FFD100';
  ctx.fillRect(0, H - 80, W, 80);

  // Bottom bar text
  ctx.fillStyle = '#003B8E';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JUVENTUDE SPORT CAMPINENSE', W / 2, H - 42);
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('jscampinense.pt', W / 2, H - 14);

  // Logo
  let logoY = 60;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const lSize = 120;
    const lX = (W - lSize) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(lX + lSize / 2, logoY + lSize / 2, lSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logoImg, lX, logoY, lSize, lSize);
    ctx.restore();
    logoY += lSize + 24;
  } else {
    logoY += 30;
  }

  // Escalão tag
  const tag = (jogo.escalao || '').toUpperCase();
  ctx.font = 'bold 26px Arial, sans-serif';
  const tagW = ctx.measureText(tag).width + 40;
  const tagX = (W - tagW) / 2;
  ctx.fillStyle = '#FFD100';
  ctx.beginPath();
  ctx.roundRect(tagX, logoY, tagW, 42, 21);
  ctx.fill();
  ctx.fillStyle = '#001133';
  ctx.textAlign = 'center';
  ctx.fillText(tag, W / 2, logoY + 29);
  logoY += 66;

  // Score — very large
  const score = `${jogo.gcasa}  –  ${jogo.gfora}`;
  ctx.font = `bold 220px 'Bebas Neue', Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(score, W / 2, logoY + 210);
  logoY += 240;

  // Team names
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillStyle = isSC(jogo.casa) ? '#FFD100' : 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'left';
  const casaX = 60;
  _wrapText(ctx, jogo.casa, casaX, logoY, 420, 48);

  ctx.fillStyle = isSC(jogo.fora) ? '#FFD100' : 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  _wrapText(ctx, jogo.fora, W - 60, logoY, 420, 48);
  logoY += 100;

  // Result badge
  ctx.fillStyle = resColor;
  const badgeW = 340, badgeH = 64;
  ctx.beginPath();
  ctx.roundRect((W - badgeW) / 2, logoY, badgeW, badgeH, 32);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(resLabel, W / 2, logoY + 43);
  logoY += 88;

  // Date
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(ptDateFull(jogo.data), W / 2, logoY + 10);
  if (jogo.local) {
    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(jogo.local, W / 2, logoY + 46);
  }
}

function _wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, lineY);
      line = w;
      lineY += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, lineY);
}

function openShareModal(jogo) {
  const modal   = document.getElementById('shareModal');
  const canvas  = document.getElementById('shareCanvas');
  const copiedMsg = document.getElementById('shareCopiedMsg');
  if (!modal || !canvas) return;
  if (copiedMsg) copiedMsg.style.display = 'none';

  // Draw card (logo async)
  const logo = new Image();
  logo.onload = () => drawShareCard(canvas, jogo, logo);
  logo.onerror = () => drawShareCard(canvas, jogo, null);
  logo.src = 'images/logo.png';

  // WhatsApp
  document.getElementById('shareBtnWa').onclick = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText(jogo)), '_blank');
  };

  // Twitter/X
  document.getElementById('shareBtnTw').onclick = () => {
    const t = shareText(jogo).slice(0, 280);
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(t), '_blank');
  };

  // Facebook (shares page URL — no deep text without Open Graph)
  document.getElementById('shareBtnFb').onclick = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  // Download image
  document.getElementById('shareBtnDl').onclick = () => {
    const a = document.createElement('a');
    a.download = `resultado-${jogo.casa.replace(/\s+/g,'-')}-${jogo.gcasa}-${jogo.gfora}-${jogo.fora.replace(/\s+/g,'-')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  // Copy text
  document.getElementById('shareBtnCp').onclick = () => {
    navigator.clipboard?.writeText(shareText(jogo)).then(() => {
      if (copiedMsg) { copiedMsg.style.display = ''; setTimeout(() => { copiedMsg.style.display = 'none'; }, 2000); }
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = shareText(jogo);
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      if (copiedMsg) { copiedMsg.style.display = ''; setTimeout(() => { copiedMsg.style.display = 'none'; }, 2000); }
    });
  };

  // Web Share API
  const webBtn = document.getElementById('shareBtnWeb');
  if (navigator.share && navigator.canShare) {
    webBtn.style.display = '';
    webBtn.onclick = async () => {
      try {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'resultado.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: 'Resultado', text: shareText(jogo), files: [file] });
        } else {
          await navigator.share({ title: 'Resultado', text: shareText(jogo) });
        }
      } catch(e) {}
    };
  } else {
    webBtn.style.display = 'none';
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

document.getElementById('shareClose')?.addEventListener('click', closeShareModal);
document.getElementById('shareModal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('shareModal')) closeShareModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeShareModal();
});

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}
