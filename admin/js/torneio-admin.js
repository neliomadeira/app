// =============================================
// TORNEIO ADMIN — JS
// =============================================

const TORNEIO_FILE = '../data/torneio-data.json';

let torneioData = { torneios: [] };
let editingTorneio = null;  // id of torneio being edited (null = new)

// =============================================
// LOAD & SAVE (localStorage + JSON sync)
// =============================================
function loadTorneioData() {
  try {
    const raw = localStorage.getItem('torneio_data');
    if (raw) {
      torneioData = JSON.parse(raw);
    } else {
      // First load: fetch from file
      fetchTorneioFile();
      return;
    }
  } catch (e) {
    torneioData = { torneios: [] };
  }
  renderTorneioDashboard();
}

async function fetchTorneioFile() {
  try {
    const resp = await fetch(TORNEIO_FILE + '?v=' + Date.now());
    torneioData = await resp.json();
  } catch (e) {
    torneioData = { torneios: [] };
  }
  saveTorneioData();
  renderTorneioDashboard();
}

function saveTorneioData() {
  localStorage.setItem('torneio_data', JSON.stringify(torneioData));
  // Show save indicator
  showTorneioToast('Dados guardados com sucesso!', 'success');
}

function exportTorneioJSON() {
  const blob = new Blob([JSON.stringify(torneioData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'torneio-data.json';
  a.click();
  URL.revokeObjectURL(url);
  showTorneioToast('Ficheiro JSON exportado! Coloque-o na pasta data/.', 'info');
}

function importTorneioJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      torneioData = JSON.parse(e.target.result);
      saveTorneioData();
      renderTorneioDashboard();
      showTorneioToast('Dados importados com sucesso!', 'success');
    } catch (err) {
      showTorneioToast('Erro: ficheiro JSON inválido.', 'error');
    }
  };
  reader.readAsText(file);
}

function showTorneioToast(msg, type = 'success') {
  const el = document.getElementById('torneioToast');
  if (!el) return;
  el.textContent = msg;
  el.className = `torneio-toast torneio-toast--${type} torneio-toast--show`;
  setTimeout(() => el.classList.remove('torneio-toast--show'), 3000);
}

// =============================================
// DASHBOARD
// =============================================
function renderTorneioDashboard() {
  const el = document.getElementById('torneioDashboard');
  if (!el) return;

  if (!torneioData.torneios.length) {
    el.innerHTML = `
      <div class="torneio-empty">
        <div class="torneio-empty__icon">🏆</div>
        <h3>Sem torneios criados</h3>
        <p>Crie o seu primeiro torneio para começar.</p>
      </div>`;
    return;
  }

  el.innerHTML = torneioData.torneios.map(t => {
    const totalJogos = (t.grupos || []).reduce((s, g) => s + g.jogos.length, 0);
    const realizados = (t.grupos || []).reduce((s, g) => s + g.jogos.filter(j => j.estado === 'realizado').length, 0);
    const equipas = new Set((t.grupos || []).flatMap(g => g.equipas.map(e => e.nome))).size;
    const stateMap = { em_curso: { label: 'Em Curso', cls: 'running' }, agendado: { label: 'Agendado', cls: 'planned' }, concluido: { label: 'Concluído', cls: 'done' } };
    const st = stateMap[t.estado] || { label: t.estado, cls: 'planned' };

    return `
      <div class="torneio-card" data-id="${t.id}">
        <div class="torneio-card__header">
          <div>
            <span class="torneio-card__estado torneio-card__estado--${st.cls}">${st.label}</span>
            <h3 class="torneio-card__nome">${t.nome}</h3>
            <span class="torneio-card__escalao">${t.escalao} · ${t.local}</span>
          </div>
          <div class="torneio-card__actions">
            <button class="admin-btn admin-btn--sm admin-btn--primary" onclick="openTorneioEditor('${t.id}')">✏️ Editar</button>
            <button class="admin-btn admin-btn--sm admin-btn--danger" onclick="deleteTorneio('${t.id}')">🗑️</button>
          </div>
        </div>
        <div class="torneio-card__stats">
          <div class="torneio-card__stat">
            <span class="torneio-card__stat-num">${equipas}</span>
            <span class="torneio-card__stat-label">Equipas</span>
          </div>
          <div class="torneio-card__stat">
            <span class="torneio-card__stat-num">${realizados}/${totalJogos}</span>
            <span class="torneio-card__stat-label">Jogos realizados</span>
          </div>
          <div class="torneio-card__stat">
            <span class="torneio-card__stat-num">${(t.grupos || []).length}</span>
            <span class="torneio-card__stat-label">Grupos</span>
          </div>
          ${t.vencedor ? `<div class="torneio-card__stat"><span class="torneio-card__stat-num" style="font-size:1rem">🏆</span><span class="torneio-card__stat-label">${t.vencedor}</span></div>` : ''}
        </div>
        <div class="torneio-card__footer">
          <span>📅 ${fmtAdminDate(t.data_inicio)}</span>
          <button class="admin-btn admin-btn--sm admin-btn--outline" onclick="openResultadosEditor('${t.id}')">⚽ Inserir Resultados</button>
        </div>
      </div>`;
  }).join('');
}

function fmtAdminDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-PT');
}

// =============================================
// TORNEIO EDITOR (create / edit)
// =============================================
function openNewTorneio() {
  editingTorneio = null;
  const modal = document.getElementById('torneioEditorModal');
  if (!modal) return;

  document.getElementById('torneioEditorTitle').textContent = 'Novo Torneio';
  document.getElementById('tEdit_nome').value = '';
  document.getElementById('tEdit_descricao').value = '';
  document.getElementById('tEdit_data_inicio').value = '';
  document.getElementById('tEdit_data_fim').value = '';
  document.getElementById('tEdit_local').value = '';
  document.getElementById('tEdit_escalao').value = 'Sub-9';
  document.getElementById('tEdit_estado').value = 'agendado';
  document.getElementById('tEdit_formato').value = 'grupos_e_eliminatoria';

  document.getElementById('tEdit_grupos').innerHTML = '';
  modal.classList.add('active');
}

function openTorneioEditor(id) {
  editingTorneio = id;
  const t = torneioData.torneios.find(x => x.id === id);
  if (!t) return;

  const modal = document.getElementById('torneioEditorModal');
  if (!modal) return;

  document.getElementById('torneioEditorTitle').textContent = 'Editar Torneio';
  document.getElementById('tEdit_nome').value = t.nome;
  document.getElementById('tEdit_descricao').value = t.descricao || '';
  document.getElementById('tEdit_data_inicio').value = t.data_inicio || '';
  document.getElementById('tEdit_data_fim').value = t.data_fim || '';
  document.getElementById('tEdit_local').value = t.local || '';
  document.getElementById('tEdit_escalao').value = t.escalao || 'Sub-9';
  document.getElementById('tEdit_estado').value = t.estado || 'agendado';
  document.getElementById('tEdit_formato').value = t.formato || 'grupos_e_eliminatoria';

  // Render groups editor
  renderGruposEditor(t.grupos || []);

  modal.classList.add('active');
}

function closeTorneioEditor() {
  const modal = document.getElementById('torneioEditorModal');
  if (modal) modal.classList.remove('active');
}

function saveTorneioEditor() {
  const nome = document.getElementById('tEdit_nome').value.trim();
  if (!nome) { showTorneioToast('O nome do torneio é obrigatório.', 'error'); return; }

  const id = editingTorneio || 'torneio-' + Date.now();
  const grupos = collectGruposFromEditor();

  const obj = {
    id,
    nome,
    descricao: document.getElementById('tEdit_descricao').value.trim(),
    data_inicio: document.getElementById('tEdit_data_inicio').value,
    data_fim: document.getElementById('tEdit_data_fim').value,
    local: document.getElementById('tEdit_local').value.trim(),
    escalao: document.getElementById('tEdit_escalao').value,
    estado: document.getElementById('tEdit_estado').value,
    formato: document.getElementById('tEdit_formato').value,
    grupos,
    eliminatoria: editingTorneio
      ? (torneioData.torneios.find(x => x.id === editingTorneio)?.eliminatoria || buildDefaultEliminatoria())
      : buildDefaultEliminatoria(),
  };

  if (obj.estado === 'concluido') {
    const vencedor = document.getElementById('tEdit_vencedor')?.value?.trim();
    if (vencedor) obj.vencedor = vencedor;
  }

  if (editingTorneio) {
    const idx = torneioData.torneios.findIndex(x => x.id === editingTorneio);
    if (idx >= 0) torneioData.torneios[idx] = obj;
  } else {
    torneioData.torneios.unshift(obj);
  }

  saveTorneioData();
  renderTorneioDashboard();
  closeTorneioEditor();
}

function buildDefaultEliminatoria() {
  return {
    fases: [
      { id: 'meias', nome: 'Meias-Finais', jogos: [] },
      { id: 'terceiro', nome: '3º Lugar', jogos: [] },
      { id: 'final', nome: 'Final', jogos: [] },
    ]
  };
}

function deleteTorneio(id) {
  if (!confirm('Tem a certeza que quer eliminar este torneio?')) return;
  torneioData.torneios = torneioData.torneios.filter(t => t.id !== id);
  saveTorneioData();
  renderTorneioDashboard();
}

// ---- GRUPOS EDITOR ----
function renderGruposEditor(grupos) {
  const el = document.getElementById('tEdit_grupos');
  if (!el) return;
  el.innerHTML = grupos.map((g, gi) => renderGrupoEditorRow(g, gi)).join('');
}

function renderGrupoEditorRow(g, gi) {
  const equipasHtml = (g.equipas || []).map((eq, ei) => `
    <div class="gedit-equipa" data-gi="${gi}" data-ei="${ei}">
      <input type="text" class="admin-input admin-input--sm" value="${eq.nome}" placeholder="Nome da equipa"
        onchange="updateEquipaName(${gi},${ei},this.value)" />
      <input type="text" class="admin-input admin-input--sm" style="width:70px" value="${eq.abrev}" placeholder="Abrev"
        onchange="updateEquipaAbrev(${gi},${ei},this.value)" />
      <label style="display:flex;align-items:center;gap:4px;font-size:0.78rem;white-space:nowrap">
        <input type="checkbox" ${eq.sc ? 'checked' : ''} onchange="updateEquipaSC(${gi},${ei},this.checked)" /> SC
      </label>
      <button class="admin-btn admin-btn--danger admin-btn--xs" onclick="removeEquipa(${gi},${ei})">✕</button>
    </div>`).join('');

  return `
    <div class="gedit-grupo" data-gi="${gi}">
      <div class="gedit-grupo__header">
        <input type="text" class="admin-input admin-input--sm" value="${g.nome}" placeholder="Nome do grupo"
          onchange="updateGrupoNome(${gi},this.value)" style="font-weight:700;width:140px" />
        <button class="admin-btn admin-btn--danger admin-btn--xs" onclick="removeGrupo(${gi})">Remover grupo</button>
      </div>
      <div class="gedit-equipas" id="geditEquipas_${gi}">${equipasHtml}</div>
      <button class="admin-btn admin-btn--outline admin-btn--sm" onclick="addEquipa(${gi})">+ Adicionar equipa</button>
    </div>`;
}

function addGrupo() {
  const grupos = collectGruposFromEditor();
  const gi = grupos.length;
  grupos.push({ id: String.fromCharCode(65 + gi), nome: `Grupo ${String.fromCharCode(65 + gi)}`, equipas: [], jogos: [] });
  renderGruposEditor(grupos);
}

function removeGrupo(gi) {
  const grupos = collectGruposFromEditor();
  grupos.splice(gi, 1);
  renderGruposEditor(grupos);
}

function addEquipa(gi) {
  const grupos = collectGruposFromEditor();
  if (!grupos[gi]) return;
  grupos[gi].equipas.push({ nome: '', abrev: '', sc: false });
  renderGruposEditor(grupos);
}

function removeEquipa(gi, ei) {
  const grupos = collectGruposFromEditor();
  grupos[gi].equipas.splice(ei, 1);
  renderGruposEditor(grupos);
}

function updateGrupoNome(gi, val) {
  const grupos = collectGruposFromEditor();
  if (grupos[gi]) grupos[gi].nome = val;
}

function updateEquipaName(gi, ei, val) {
  const grupos = collectGruposFromEditor();
  if (grupos[gi]?.equipas[ei]) grupos[gi].equipas[ei].nome = val;
}

function updateEquipaAbrev(gi, ei, val) {
  const grupos = collectGruposFromEditor();
  if (grupos[gi]?.equipas[ei]) grupos[gi].equipas[ei].abrev = val;
}

function updateEquipaSC(gi, ei, val) {
  const grupos = collectGruposFromEditor();
  if (grupos[gi]?.equipas[ei]) grupos[gi].equipas[ei].sc = val;
}

function collectGruposFromEditor() {
  const grupos = [];
  document.querySelectorAll('.gedit-grupo').forEach((grupoEl, gi) => {
    const nomeInput = grupoEl.querySelector('input[type="text"]');
    const equipas = [];
    grupoEl.querySelectorAll('.gedit-equipa').forEach(eqEl => {
      const inputs = eqEl.querySelectorAll('input[type="text"]');
      const cb = eqEl.querySelector('input[type="checkbox"]');
      equipas.push({
        nome: inputs[0]?.value || '',
        abrev: inputs[1]?.value || '',
        sc: cb?.checked || false,
      });
    });
    // Preserve existing jogos from the editing torneio if available
    let jogos = [];
    if (editingTorneio) {
      const t = torneioData.torneios.find(x => x.id === editingTorneio);
      if (t && t.grupos[gi]) jogos = t.grupos[gi].jogos || [];
    }
    grupos.push({
      id: String.fromCharCode(65 + gi),
      nome: nomeInput?.value || `Grupo ${String.fromCharCode(65 + gi)}`,
      equipas,
      jogos,
    });
  });
  return grupos;
}

// =============================================
// RESULTS EDITOR
// =============================================
function openResultadosEditor(torneioId) {
  const t = torneioData.torneios.find(x => x.id === torneioId);
  if (!t) return;

  const modal = document.getElementById('resultadosEditorModal');
  if (!modal) return;

  modal.dataset.torneioId = torneioId;
  document.getElementById('resultadosEditorTitle').textContent = `Resultados – ${t.nome}`;

  renderResultadosEditor(t);
  modal.classList.add('active');
}

function closeResultadosEditor() {
  const modal = document.getElementById('resultadosEditorModal');
  if (modal) modal.classList.remove('active');
}

function renderResultadosEditor(t) {
  const el = document.getElementById('resultadosEditorBody');
  if (!el) return;

  let html = '';

  // Groups
  (t.grupos || []).forEach((grupo, gi) => {
    const jogosHtml = grupo.jogos.map((j, ji) => renderResultRow(j, 'grupo', gi, ji)).join('');
    html += `
      <div class="res-section-label">${grupo.nome}</div>
      <div class="res-matches-list">${jogosHtml}</div>
      <div style="margin-bottom:12px">
        <button class="admin-btn admin-btn--outline admin-btn--sm" onclick="addJogoGrupo('${t.id}',${gi})">
          + Adicionar jogo no ${grupo.nome}
        </button>
      </div>`;
  });

  // Eliminatória phases
  if (t.eliminatoria?.fases?.length) {
    t.eliminatoria.fases.forEach((fase, fi) => {
      const jogosHtml = fase.jogos.map((j, ji) => renderElimResultRow(j, fi, ji, t.id)).join('');
      html += `
        <div class="res-section-label">${fase.nome}</div>
        <div class="res-matches-list">${jogosHtml}</div>
        <div style="margin-bottom:12px">
          <button class="admin-btn admin-btn--outline admin-btn--sm" onclick="addJogoElim('${t.id}',${fi})">
            + Adicionar jogo na ${fase.nome}
          </button>
        </div>`;
    });
  }

  el.innerHTML = html;
}

function renderResultRow(j, type, gi, ji) {
  const done = j.estado === 'realizado';
  return `
    <div class="res-match-row" data-type="${type}" data-gi="${gi}" data-ji="${ji}">
      <div class="res-match-time">
        <input type="time" class="admin-input admin-input--xs" value="${j.hora || ''}"
          onchange="updateJogoField(this,'hora','grupo',${gi},${ji})" />
      </div>
      <div class="res-match-teams">
        <span class="res-equipa">${j.casa}</span>
        <span class="res-vs">vs</span>
        <span class="res-equipa">${j.fora}</span>
      </div>
      <div class="res-match-score">
        <input type="number" min="0" max="99" class="admin-input admin-input--score"
          value="${j.gcasa !== null ? j.gcasa : ''}" placeholder="–"
          onchange="updateJogoField(this,'gcasa','grupo',${gi},${ji})" />
        <span style="font-weight:700;color:#666">–</span>
        <input type="number" min="0" max="99" class="admin-input admin-input--score"
          value="${j.gfora !== null ? j.gfora : ''}" placeholder="–"
          onchange="updateJogoField(this,'gfora','grupo',${gi},${ji})" />
      </div>
      <div class="res-match-estado">
        <select class="admin-input admin-input--xs" onchange="updateJogoEstado(this,'grupo',${gi},${ji})">
          <option value="agendado" ${!done ? 'selected' : ''}>Agendado</option>
          <option value="realizado" ${done ? 'selected' : ''}>Realizado</option>
        </select>
      </div>
      <button class="admin-btn admin-btn--danger admin-btn--xs" onclick="removeJogoGrupo(${gi},${ji})">✕</button>
    </div>`;
}

function renderElimResultRow(j, fi, ji, torneioId) {
  const done = j.estado === 'realizado';
  return `
    <div class="res-match-row">
      <div class="res-match-time">
        <input type="time" class="admin-input admin-input--xs" value="${j.hora || ''}"
          onchange="updateElimField(this,'hora',${fi},${ji},'${torneioId}')" />
      </div>
      <div class="res-match-teams">
        <input type="text" class="admin-input admin-input--sm" value="${j.equipa1}"
          onchange="updateElimField(this,'equipa1',${fi},${ji},'${torneioId}')" style="width:120px" />
        <span class="res-vs">vs</span>
        <input type="text" class="admin-input admin-input--sm" value="${j.equipa2}"
          onchange="updateElimField(this,'equipa2',${fi},${ji},'${torneioId}')" style="width:120px" />
      </div>
      <div class="res-match-score">
        <input type="number" min="0" max="99" class="admin-input admin-input--score"
          value="${j.g1 !== null ? j.g1 : ''}" placeholder="–"
          onchange="updateElimField(this,'g1',${fi},${ji},'${torneioId}')" />
        <span style="font-weight:700;color:#666">–</span>
        <input type="number" min="0" max="99" class="admin-input admin-input--score"
          value="${j.g2 !== null ? j.g2 : ''}" placeholder="–"
          onchange="updateElimField(this,'g2',${fi},${ji},'${torneioId}')" />
      </div>
      <div class="res-match-estado">
        <select class="admin-input admin-input--xs" onchange="updateElimEstado(this,${fi},${ji},'${torneioId}')">
          <option value="agendado" ${!done ? 'selected' : ''}>Agendado</option>
          <option value="realizado" ${done ? 'selected' : ''}>Realizado</option>
        </select>
      </div>
      <button class="admin-btn admin-btn--danger admin-btn--xs" onclick="removeJogoElim(${fi},${ji},'${torneioId}')">✕</button>
    </div>`;
}

// ---- FIELD UPDATES ----
function getTorneioById(id) {
  return torneioData.torneios.find(t => t.id === id);
}

function getCurrentEditorTorneio() {
  const modal = document.getElementById('resultadosEditorModal');
  return modal ? getTorneioById(modal.dataset.torneioId) : null;
}

function updateJogoField(input, field, type, gi, ji) {
  const t = getCurrentEditorTorneio();
  if (!t) return;
  const val = field === 'gcasa' || field === 'gfora' ? (input.value !== '' ? parseInt(input.value) : null) : input.value;
  if (type === 'grupo') t.grupos[gi].jogos[ji][field] = val;
}

function updateJogoEstado(sel, type, gi, ji) {
  const t = getCurrentEditorTorneio();
  if (!t) return;
  if (type === 'grupo') t.grupos[gi].jogos[ji].estado = sel.value;
}

function updateElimField(input, field, fi, ji, torneioId) {
  const t = getTorneioById(torneioId);
  if (!t) return;
  const val = (field === 'g1' || field === 'g2') ? (input.value !== '' ? parseInt(input.value) : null) : input.value;
  t.eliminatoria.fases[fi].jogos[ji][field] = val;
}

function updateElimEstado(sel, fi, ji, torneioId) {
  const t = getTorneioById(torneioId);
  if (!t) return;
  t.eliminatoria.fases[fi].jogos[ji].estado = sel.value;
}

// ---- ADD / REMOVE JOGOS ----
function addJogoGrupo(torneioId, gi) {
  const t = getTorneioById(torneioId);
  if (!t) return;
  const grupo = t.grupos[gi];
  const id = `${grupo.id}${grupo.jogos.length + 1}`;

  // Pick the next two teams without a complete round-robin pairing
  const equipas = grupo.equipas.map(e => e.nome);
  const existingPairs = new Set(grupo.jogos.map(j => `${j.casa}|${j.fora}`));
  let casa = equipas[0] || '', fora = equipas[1] || '';
  for (let i = 0; i < equipas.length; i++) {
    for (let j = i + 1; j < equipas.length; j++) {
      if (!existingPairs.has(`${equipas[i]}|${equipas[j]}`)) {
        casa = equipas[i]; fora = equipas[j]; break;
      }
    }
  }

  grupo.jogos.push({ id, casa, fora, gcasa: null, gfora: null, hora: '10:00', estado: 'agendado' });
  renderResultadosEditor(t);
}

function removeJogoGrupo(gi, ji) {
  const t = getCurrentEditorTorneio();
  if (!t) return;
  t.grupos[gi].jogos.splice(ji, 1);
  renderResultadosEditor(t);
}

function addJogoElim(torneioId, fi) {
  const t = getTorneioById(torneioId);
  if (!t) return;
  const fase = t.eliminatoria.fases[fi];
  fase.jogos.push({ id: `${fase.id}_${fase.jogos.length + 1}`, label: '', equipa1: '—', equipa2: '—', g1: null, g2: null, hora: '10:00', estado: 'agendado' });
  renderResultadosEditor(t);
}

function removeJogoElim(fi, ji, torneioId) {
  const t = getTorneioById(torneioId);
  if (!t) return;
  t.eliminatoria.fases[fi].jogos.splice(ji, 1);
  renderResultadosEditor(t);
}

function saveResultados() {
  const t = getCurrentEditorTorneio();
  if (!t) return;
  saveTorneioData();
  renderTorneioDashboard();
  showTorneioToast('Resultados guardados!', 'success');
}

// =============================================
// INIT
// =============================================
function initTorneioAdmin() {
  loadTorneioData();
}
