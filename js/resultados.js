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

  const sorted = [...dados.classificacao].map(t => ({
    ...t, pts: calcPts(t.v, t.e), dg: t.gm - t.gs
  })).sort((a,b) => b.pts - a.pts || b.dg - a.dg || b.gm - a.gm);

  const tbody = document.getElementById('classTable');
  tbody.innerHTML = sorted.map((t, i) => {
    const pos = i + 1;
    const posBadge = pos <= 3
      ? `<span class="pos-badge pos-badge--${pos}">${pos}</span>`
      : `<span>${pos}</span>`;
    const badgeClass = t.sc ? 'team-badge--sc' : 'team-badge--other';
    return `
      <tr class="${t.sc ? 'sc-row' : ''}">
        <td class="pos-cell">${posBadge}</td>
        <td>
          <div class="team-cell">
            <span class="team-badge ${badgeClass}">${t.abrev}</span>
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
      return `
        <div class="jogo-item">
          <div class="jogo-data">
            <div class="jogo-data__day">${d.day}</div>
            <div class="jogo-data__mes">${d.mes}</div>
          </div>
          <div class="jogo-divider"></div>
          <div class="jogo-info">
            <div class="jogo-equipas">
              <span class="jogo-equipa${scClass(j.casa)}">${j.casa}</span>
              <div class="jogo-equipa-row">
                <span class="vs">vs</span>
                <span class="jogo-equipa${scClass(j.fora)}">${j.fora}</span>
              </div>
            </div>
            ${j.local ? `<div class="jogo-meta">${j.local}</div>` : ''}
          </div>
          <div class="jogo-resultado">
            <div class="resultado-placar">${j.gcasa}–${j.gfora}</div>
            ${res ? `<div class="resultado-badge resultado-badge--${res}">${resLabel}</div>` : ''}
          </div>
        </div>`;
    }).join('');
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
            <div class="jogo-equipas">
              <span class="jogo-equipa${scClass(j.casa)}">${j.casa}</span>
              <div class="jogo-equipa-row">
                <span class="vs">vs</span>
                <span class="jogo-equipa${scClass(j.fora)}">${j.fora}</span>
              </div>
            </div>
            ${j.local ? `<div class="jogo-meta">${j.local}</div>` : ''}
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
