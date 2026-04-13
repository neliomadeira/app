// =============================================
// TORNEIO DE FUTEBOL — PUBLIC JS
// =============================================

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DATA_FILE = 'data/torneio-data.json';

let allTorneios = [];
let activeTorneio = null;
let activeSection = 'grupos'; // 'grupos' | 'resultados' | 'bracket'

// =============================================
// LOAD DATA
// =============================================
async function loadTorneios() {
  try {
    const resp = await fetch(DATA_FILE + '?v=' + Date.now());
    const data = await resp.json();
    allTorneios = data.torneios || [];
  } catch (e) {
    allTorneios = [];
  }
  renderTorneioTabs();
  if (allTorneios.length) {
    selectTorneio(allTorneios[0].id);
  } else {
    renderEmpty();
  }
}

// =============================================
// UTILS
// =============================================
function fmtDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.getDate() + ' de ' + MESES_FULL[d.getMonth()] + ' de ' + d.getFullYear();
}

function calcPts(v, e) { return v * 3 + e; }

function getStatusLabel(estado) {
  if (estado === 'em_curso')  return { label: 'Em Curso', cls: 'em_curso' };
  if (estado === 'agendado')  return { label: 'Agendado', cls: 'agendado' };
  if (estado === 'concluido') return { label: 'Concluído', cls: 'concluido' };
  return { label: estado, cls: 'agendado' };
}

function posBadge(pos) {
  if (pos <= 3) return `<span class="t-pos-badge t-pos-badge--${pos}">${pos}</span>`;
  return `<span style="font-weight:600;color:var(--gray-mid)">${pos}</span>`;
}

// =============================================
// BUILD STANDINGS FROM MATCHES
// =============================================
function buildStandings(grupo) {
  const map = {};
  grupo.equipas.forEach(eq => {
    map[eq.nome] = { ...eq, j: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0 };
  });
  grupo.jogos.forEach(j => {
    if (j.estado !== 'realizado' || j.gcasa === null) return;
    const c = map[j.casa], f = map[j.fora];
    if (!c || !f) return;
    c.j++; f.j++;
    c.gm += j.gcasa; c.gs += j.gfora;
    f.gm += j.gfora; f.gs += j.gcasa;
    if (j.gcasa > j.gfora) { c.v++; f.d++; }
    else if (j.gcasa < j.gfora) { f.v++; c.d++; }
    else { c.e++; f.e++; }
  });
  return Object.values(map)
    .map(t => ({ ...t, pts: calcPts(t.v, t.e), dg: t.gm - t.gs }))
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gm - a.gm);
}

// =============================================
// RENDER TORNEIO SELECTOR TABS
// =============================================
function renderTorneioTabs() {
  const inner = document.getElementById('torneioTabsInner');
  if (!inner) return;
  inner.innerHTML = allTorneios.map(t => {
    const { label, cls } = getStatusLabel(t.estado);
    return `
      <button class="torneio-tab torneio-tab--${cls}" data-id="${t.id}" onclick="selectTorneio('${t.id}')">
        <span>${t.nome}</span>
        <span class="torneio-tab__escalao">${t.escalao} · ${label}</span>
      </button>`;
  }).join('');
}

// =============================================
// SELECT & RENDER TORNEIO
// =============================================
function selectTorneio(id) {
  activeTorneio = allTorneios.find(t => t.id === id);
  if (!activeTorneio) return;

  document.querySelectorAll('.torneio-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });

  activeSection = 'grupos';
  renderHero();
  renderSectionTabs();
  renderMain();
  renderSidebar();
}

// =============================================
// HERO
// =============================================
function renderHero() {
  const t = activeTorneio;
  const { label, cls } = getStatusLabel(t.estado);
  const heroEl = document.getElementById('torneioHeroContent');
  if (!heroEl) return;

  const dateFmt = t.data_inicio === t.data_fim
    ? fmtDate(t.data_inicio)
    : fmtDate(t.data_inicio) + ' – ' + fmtDate(t.data_fim);

  heroEl.innerHTML = `
    <span class="torneio-hero__tag">${t.escalao}</span>
    <h1 class="torneio-hero__title">${t.nome.split(' ').slice(0,2).join(' ')}<br><span>${t.nome.split(' ').slice(2).join(' ')}</span></h1>
    <div class="torneio-status torneio-status--${cls}">
      <span class="torneio-status__dot"></span>${label}
    </div>
    <div class="torneio-hero__meta">
      <div class="torneio-hero__meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${dateFmt}
      </div>
      <div class="torneio-hero__meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${t.local}
      </div>
    </div>
  `;
}

// =============================================
// SECTION TABS
// =============================================
function renderSectionTabs() {
  const t = activeTorneio;
  const hasBracket = t.formato === 'grupos_e_eliminatoria' || t.formato === 'eliminatoria';
  const tabsEl = document.getElementById('sectionTabs');
  if (!tabsEl) return;

  const tabs = [
    { id: 'grupos',     label: '📊 Classificação' },
    { id: 'resultados', label: '⚽ Jogos' },
  ];
  if (hasBracket) tabs.push({ id: 'bracket', label: '🏆 Eliminatória' });

  tabsEl.innerHTML = tabs.map(tab => `
    <button class="section-tab ${activeSection === tab.id ? 'active' : ''}"
      onclick="switchSection('${tab.id}')">${tab.label}</button>
  `).join('');
}

function switchSection(sec) {
  activeSection = sec;
  document.querySelectorAll('.section-tab').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(sec === 'grupos' ? 'classif' : sec === 'resultados' ? 'jogos' : 'elim'));
  });
  renderMain();
}

// =============================================
// MAIN CONTENT
// =============================================
function renderMain() {
  const main = document.getElementById('torneioMain');
  if (!main) return;
  if (activeSection === 'grupos')    main.innerHTML = renderGrupos();
  if (activeSection === 'resultados') main.innerHTML = renderResultados();
  if (activeSection === 'bracket')   main.innerHTML = renderBracket();
}

// ---- GRUPOS / CLASSIFICAÇÃO ----
function renderGrupos() {
  const t = activeTorneio;
  if (!t.grupos || !t.grupos.length) return `<div class="t-empty"><div class="t-empty__icon">📋</div><p>Sem grupos definidos.</p></div>`;

  return t.grupos.map(grupo => {
    const standings = buildStandings(grupo);
    const rows = standings.map((eq, i) => {
      const pos = i + 1;
      const qualify = t.formato === 'grupos_e_eliminatoria' && pos <= 2;
      const badgeCls = eq.sc ? 'team-badge--sc' : 'team-badge--other';
      return `
        <tr class="${eq.sc ? 'sc-row' : ''}${qualify ? ' qualify-row' : ''}">
          <td>${posBadge(pos)}</td>
          <td>
            <div class="t-team-cell">
              <span class="t-team-badge ${badgeCls}">${eq.abrev}</span>
              <span>${eq.nome}${eq.sc ? ' ★' : ''}</span>
            </div>
          </td>
          <td>${eq.j}</td><td>${eq.v}</td><td>${eq.e}</td><td>${eq.d}</td>
          <td>${eq.gm}</td><td>${eq.gs}</td>
          <td>${eq.dg > 0 ? '+' : ''}${eq.dg}</td>
          <td class="pts-cell">${eq.pts}</td>
        </tr>`;
    }).join('');

    const legend = t.formato === 'grupos_e_eliminatoria' ? `
      <div class="qualify-legend">
        <div class="qualify-legend__item">
          <div class="qualify-legend__dot qualify-legend__dot--q"></div>
          Apuram-se para eliminatória
        </div>
      </div>` : '';

    return `
      <div class="t-card">
        <div class="t-card__header">
          <span class="t-card__title">${grupo.nome}</span>
          <span class="t-card__badge">${grupo.equipas.length} equipas</span>
        </div>
        <div class="t-table-wrap">
          <table class="t-table">
            <thead>
              <tr>
                <th class="pos-col">#</th>
                <th class="team-col">Equipa</th>
                <th title="Jogos">J</th><th title="Vitórias">V</th>
                <th title="Empates">E</th><th title="Derrotas">D</th>
                <th title="Golos marcados">GM</th><th title="Golos sofridos">GS</th>
                <th title="Diferença de golos">DG</th>
                <th class="pts-col" title="Pontos">Pts</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${legend}
      </div>`;
  }).join('');
}

// ---- RESULTADOS / JOGOS ----
function renderResultados() {
  const t = activeTorneio;
  let html = '';

  if (t.grupos && t.grupos.length) {
    t.grupos.forEach(grupo => {
      const realizados = grupo.jogos.filter(j => j.estado === 'realizado');
      const agendados  = grupo.jogos.filter(j => j.estado === 'agendado');

      const matchesHtml = [...realizados.reverse(), ...agendados].map(j => renderMatchRow(j)).join('');
      html += `
        <div class="t-card">
          <div class="t-card__header">
            <span class="t-card__title">Jogos – ${grupo.nome}</span>
            <span class="t-card__badge">${realizados.length}/${grupo.jogos.length} realizados</span>
          </div>
          <div class="t-matches">${matchesHtml || '<div class="t-empty"><p>Sem jogos registados.</p></div>'}</div>
        </div>`;
    });
  }

  if (t.eliminatoria && t.eliminatoria.fases) {
    t.eliminatoria.fases.forEach(fase => {
      const realizados = fase.jogos.filter(j => j.estado === 'realizado');
      const agendados  = fase.jogos.filter(j => j.estado === 'agendado');
      const matchesHtml = [...realizados, ...agendados].map(j => renderElimMatchRow(j)).join('');
      html += `
        <div class="t-card">
          <div class="t-card__header">
            <span class="t-card__title">${fase.nome}</span>
          </div>
          <div class="t-matches">${matchesHtml}</div>
        </div>`;
    });
  }

  return html || `<div class="t-empty"><div class="t-empty__icon">⚽</div><p>Sem jogos registados.</p></div>`;
}

function renderMatchRow(j) {
  if (j.estado === 'realizado' && j.gcasa !== null) {
    let res = ''; // from home team perspective — we track SC if applicable
    const scCasa = j.casa === 'JS Campinense' || j.casa === 'Sport Campinense';
    const scFora  = j.fora === 'JS Campinense' || j.fora === 'Sport Campinense';
    if (scCasa || scFora) {
      const gcSC = scCasa ? j.gcasa : j.gfora;
      const gsSC = scCasa ? j.gfora : j.gcasa;
      res = gcSC > gsSC ? 'v' : gcSC === gsSC ? 'e' : 'd';
    }
    const resLabel = res === 'v' ? 'Vitória' : res === 'e' ? 'Empate' : res === 'd' ? 'Derrota' : '';
    return `
      <div class="t-match">
        <div class="t-match__time">${j.hora}</div>
        <div class="t-match__divider"></div>
        <div class="t-match__teams">
          <span class="t-match__equipa${scCasa ? ' t-match__equipa--sc' : ''}">${j.casa}</span>
          <span class="vs">vs</span>
          <span class="t-match__equipa${scFora ? ' t-match__equipa--sc' : ''}">${j.fora}</span>
        </div>
        <div class="t-match__score">
          <div class="t-match__placar">${j.gcasa} – ${j.gfora}</div>
          ${res ? `<div class="t-match__badge t-match__badge--${res}">${resLabel}</div>` : ''}
        </div>
      </div>`;
  } else {
    return `
      <div class="t-match">
        <div class="t-match__time">${j.hora}</div>
        <div class="t-match__divider"></div>
        <div class="t-match__teams">
          <span class="t-match__equipa">${j.casa}</span>
          <span class="vs">vs</span>
          <span class="t-match__equipa">${j.fora}</span>
        </div>
        <div class="t-match__score">
          <div class="t-match__badge t-match__badge--a">Agendado</div>
        </div>
      </div>`;
  }
}

function renderElimMatchRow(j) {
  if (j.estado === 'realizado' && j.g1 !== null) {
    const sc1 = j.equipa1 === 'JS Campinense' || j.equipa1 === 'Sport Campinense';
    const sc2 = j.equipa2 === 'JS Campinense' || j.equipa2 === 'Sport Campinense';
    return `
      <div class="t-match">
        <div class="t-match__time">${j.hora}</div>
        <div class="t-match__divider"></div>
        <div class="t-match__teams">
          <span class="t-match__equipa${sc1 ? ' t-match__equipa--sc' : ''}">${j.equipa1}</span>
          <span class="vs">vs</span>
          <span class="t-match__equipa${sc2 ? ' t-match__equipa--sc' : ''}">${j.equipa2}</span>
        </div>
        <div class="t-match__score">
          <div class="t-match__placar">${j.g1} – ${j.g2}</div>
        </div>
      </div>`;
  } else {
    return `
      <div class="t-match">
        <div class="t-match__time">${j.hora}</div>
        <div class="t-match__divider"></div>
        <div class="t-match__teams">
          <span class="t-match__equipa">${j.equipa1 !== '—' ? j.equipa1 : j.label}</span>
          ${j.equipa1 !== '—' ? `<span class="vs">vs</span><span class="t-match__equipa">${j.equipa2}</span>` : ''}
        </div>
        <div class="t-match__score">
          <div class="t-match__badge t-match__badge--a">Agendado</div>
        </div>
      </div>`;
  }
}

// ---- BRACKET ----
function renderBracket() {
  const t = activeTorneio;
  if (!t.eliminatoria || !t.eliminatoria.fases || !t.eliminatoria.fases.length) {
    return `<div class="t-empty"><div class="t-empty__icon">🏆</div><p>Eliminatória ainda não definida.</p></div>`;
  }

  const phasesHtml = t.eliminatoria.fases.map(fase => {
    const gamesHtml = fase.jogos.map(j => {
      const sc1 = j.equipa1 === 'JS Campinense' || j.equipa1 === 'Sport Campinense';
      const sc2 = j.equipa2 === 'JS Campinense' || j.equipa2 === 'Sport Campinense';
      const done = j.estado === 'realizado' && j.g1 !== null;
      const winner1 = done && j.g1 > j.g2;
      const winner2 = done && j.g2 > j.g1;
      return `
        <div class="bracket-game${done ? ' bracket-game--winner' : ''}">
          <div class="bracket-team${winner1 ? ' bracket-team--winner' : ''}${sc1 ? ' bracket-team--sc' : ''}">
            <span class="bracket-team__name">${j.equipa1}</span>
            <span class="bracket-team__score${!done ? ' bracket-team__score--pending' : ''}">${done ? j.g1 : '–'}</span>
          </div>
          <div class="bracket-team${winner2 ? ' bracket-team--winner' : ''}${sc2 ? ' bracket-team--sc' : ''}">
            <span class="bracket-team__name">${j.equipa2}</span>
            <span class="bracket-team__score${!done ? ' bracket-team__score--pending' : ''}">${done ? j.g2 : '–'}</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="bracket-phase">
        <div class="bracket-phase__label">${fase.nome}</div>
        <div class="bracket-games">${gamesHtml}</div>
      </div>
      <div class="bracket-arrow">→</div>`;
  }).join('');

  // Remove last arrow
  const cleanHtml = phasesHtml.replace(/<div class="bracket-arrow">→<\/div>\s*$/, '');

  return `
    <div class="t-card">
      <div class="t-card__header">
        <span class="t-card__title">Fase de Eliminação</span>
      </div>
      <div class="bracket-wrap">
        <div class="bracket">${cleanHtml}</div>
      </div>
    </div>`;
}

// =============================================
// SIDEBAR
// =============================================
function renderSidebar() {
  const t = activeTorneio;
  const sidebar = document.getElementById('torneioSidebar');
  if (!sidebar) return;

  let html = '';

  // Info widget
  const dateFmt = t.data_inicio === t.data_fim
    ? fmtDate(t.data_inicio)
    : fmtDate(t.data_inicio) + '<br>' + fmtDate(t.data_fim);
  html += `
    <div class="widget">
      <div class="widget__header"><span class="widget__title">Informações</span></div>
      <div class="widget__body">
        <div class="info-list">
          <div class="info-item">
            <span class="info-item__icon">📅</span>
            <div>
              <div class="info-item__label">Data</div>
              <div class="info-item__val">${dateFmt}</div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-item__icon">📍</span>
            <div>
              <div class="info-item__label">Local</div>
              <div class="info-item__val">${t.local}</div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-item__icon">🎯</span>
            <div>
              <div class="info-item__label">Escalão</div>
              <div class="info-item__val">${t.escalao}</div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-item__icon">📋</span>
            <div>
              <div class="info-item__label">Formato</div>
              <div class="info-item__val">${t.formato === 'grupos_e_eliminatoria' ? 'Grupos + Eliminatória' : t.formato === 'liga' ? 'Liga' : 'Eliminatória'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Vencedor widget
  if (t.vencedor) {
    html += `
      <div class="widget">
        <div class="widget__header"><span class="widget__title">🏆 Vencedor</span></div>
        <div class="widget__body">
          <div class="winner-box">
            <div class="winner-box__trophy">🏆</div>
            <div class="winner-box__name">${t.vencedor}</div>
            <div class="winner-box__label">Campeão do Torneio</div>
          </div>
        </div>
      </div>`;
  }

  // Stats widget
  const totalJogos = (t.grupos || []).reduce((s, g) => s + g.jogos.length, 0)
    + (t.eliminatoria?.fases || []).reduce((s, f) => s + f.jogos.length, 0);
  const totalRealizados = (t.grupos || []).reduce((s, g) => s + g.jogos.filter(j => j.estado === 'realizado').length, 0)
    + (t.eliminatoria?.fases || []).reduce((s, f) => s + f.jogos.filter(j => j.estado === 'realizado').length, 0);
  const totalEquipas = new Set((t.grupos || []).flatMap(g => g.equipas.map(e => e.nome))).size;
  let totalGolos = 0;
  (t.grupos || []).forEach(g => g.jogos.forEach(j => { if (j.estado === 'realizado' && j.gcasa !== null) totalGolos += j.gcasa + j.gfora; }));
  (t.eliminatoria?.fases || []).forEach(f => f.jogos.forEach(j => { if (j.estado === 'realizado' && j.g1 !== null) totalGolos += j.g1 + j.g2; }));

  html += `
    <div class="widget">
      <div class="widget__header"><span class="widget__title">Estatísticas</span></div>
      <div class="widget__body" style="padding:0">
        <div class="stats-row">
          <div class="stat-item">
            <div class="stat-item__num">${totalEquipas}</div>
            <div class="stat-item__label">Equipas</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__num">${totalRealizados}</div>
            <div class="stat-item__label">Jogos</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__num">${totalGolos}</div>
            <div class="stat-item__label">Golos</div>
          </div>
        </div>
      </div>
    </div>`;

  sidebar.innerHTML = html;
}

// =============================================
// EMPTY STATE
// =============================================
function renderEmpty() {
  const main = document.getElementById('torneioMain');
  if (main) main.innerHTML = `
    <div class="t-card">
      <div class="t-empty" style="padding:60px 20px">
        <div class="t-empty__icon">🏆</div>
        <h3 style="color:var(--blue);margin-bottom:8px">Sem torneios disponíveis</h3>
        <p>Ainda não existem torneios criados. Aceda ao painel de administração para criar um torneio.</p>
      </div>
    </div>`;
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', loadTorneios);
