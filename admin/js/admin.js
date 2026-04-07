// =============================================
// ADMIN PANEL — MAIN JS
// =============================================

// ---- AUTH ---- //
const loginForm    = document.getElementById('loginForm');
const loginError   = document.getElementById('loginError');
const loginWrap    = document.getElementById('loginWrap');
const adminLayout  = document.getElementById('adminLayout');
const togglePw     = document.getElementById('togglePw');
const loginPassEl  = document.getElementById('loginPass');

togglePw?.addEventListener('click', () => {
  loginPassEl.type = loginPassEl.type === 'password' ? 'text' : 'password';
});

loginForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const u = document.getElementById('loginUser').value.trim();
  const p = loginPassEl.value;
  if (u === 'admin' && p === '1234') {
    loginWrap.style.display = 'none';
    document.body.classList.remove('login-page');
    adminLayout.style.display = 'flex';
    initAdmin();
  } else {
    loginError.style.display = 'block';
    setTimeout(() => { loginError.style.display = 'none'; }, 3000);
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  adminLayout.style.display = 'none';
  document.body.classList.add('login-page');
  loginWrap.style.display = '';
  loginForm.reset();
});

// ---- SIDEBAR TOGGLE ---- //
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ---- NAVIGATION ---- //
const pages = {};
document.querySelectorAll('.page').forEach(p => { pages[p.id.replace('page-', '')] = p; });

function goToPage(name) {
  Object.values(pages).forEach(p => p.style.display = 'none');
  if (pages[name]) pages[name].style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${name}"]`)?.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', inscricoes: 'Inscrições', atletas: 'Atletas',
    noticias: 'Notícias', mensagens: 'Mensagens', escaloes: 'Escalões'
  };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
  document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    goToPage(item.dataset.page);
  });
});

document.querySelectorAll('.btn-sm[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => goToPage(btn.dataset.goto));
});

// ---- MODAL ---- //
const modalOverlay = document.getElementById('modalOverlay');
const modal        = document.getElementById('modal');
const modalTitle   = document.getElementById('modalTitle');
const modalBody    = document.getElementById('modalBody');
const modalFooter  = document.getElementById('modalFooter');

function openModal(title, bodyHTML, footerHTML = '') {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modalFooter.innerHTML = footerHTML;
  modalOverlay.style.display = 'flex';
}

function closeModal() { modalOverlay.style.display = 'none'; }

document.getElementById('modalClose')?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// ---- TOAST ---- //
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, type = '') {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (type ? ` toast--${type}` : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, 3000);
}

// ---- STATUS BADGE ---- //
function statusBadge(st) {
  const map = {
    'Pendente':   'status--pendente',
    'Aprovado':   'status--aprovado',
    'Rejeitado':  'status--rejeitado',
    'Não lida':   'status--nao-lida',
    'Lida':       'status--lida',
    'Respondida': 'status--respondida',
    'Activo':     'status--aprovado',
    'Inactivo':   'status--rejeitado',
  };
  return `<span class="status ${map[st] || ''}">${st}</span>`;
}

// ---- FORMAT DATE ---- //
function fmtDate(str) {
  const d = new Date(str);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ==================================================
// INIT
// ==================================================
function initAdmin() {
  renderDashboard();
  renderInscricoes();
  renderAtletas();
  renderNoticias();
  renderMensagens();
  renderEscaloes();

  // Date
  document.getElementById('pageDate').textContent =
    new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Badges
  updateBadges();
}

function updateBadges() {
  const pendentes = DB.inscricoes.filter(i => i.estado === 'Pendente').length;
  const naoLidas  = DB.mensagens.filter(m => m.estado === 'Não lida').length;
  document.getElementById('badgeInsc').textContent = pendentes;
  document.getElementById('badgeMsg').textContent  = naoLidas;
  document.getElementById('totalAtletas').textContent = DB.atletas.filter(a => a.estado === 'Activo').length;
  document.getElementById('inscPendentes').textContent = pendentes;
  document.getElementById('msgNovos').textContent = naoLidas;
}

// ==================================================
// DASHBOARD
// ==================================================
function renderDashboard() {
  // Recent inscricoes (top 4)
  const tbody = document.querySelector('#dashInscTable tbody');
  tbody.innerHTML = DB.inscricoes.slice(0, 4).map(i => `
    <tr>
      <td>${i.nome}</td>
      <td>${i.escalao}</td>
      <td>${fmtDate(i.data)}</td>
      <td>${statusBadge(i.estado)}</td>
    </tr>`).join('');

  // Recent mensagens
  const tbody2 = document.querySelector('#dashMsgTable tbody');
  tbody2.innerHTML = DB.mensagens.slice(0, 3).map(m => `
    <tr>
      <td>${m.nome}</td>
      <td>${m.assunto}</td>
      <td>${fmtDate(m.data)}</td>
      <td>${statusBadge(m.estado)}</td>
    </tr>`).join('');

  // Chart
  renderChart();
}

function renderChart() {
  const bars = document.getElementById('chartBars');
  const max = Math.max(...DB.escaloes.map(e => e.atletas));
  bars.innerHTML = DB.escaloes.map((e, i) => {
    const pct = Math.round((e.atletas / max) * 100);
    const alt = i % 2 === 0;
    return `
      <div class="chart-row">
        <span class="chart-label">${e.nome}</span>
        <div class="chart-bar-wrap">
          <div class="chart-bar ${alt ? 'chart-bar--yellow' : ''}" style="width:${pct}%">
            <span class="chart-val ${alt ? 'chart-val--dark' : ''}">${e.atletas}</span>
          </div>
        </div>
        <span class="chart-count">${e.atletas}</span>
      </div>`;
  }).join('');
}

// ==================================================
// INSCRIÇÕES
// ==================================================
function renderInscricoes(filterEscalao = '', filterEstado = '') {
  const tbody = document.querySelector('#inscTable tbody');
  let data = DB.inscricoes;
  if (filterEscalao) data = data.filter(i => i.escalao === filterEscalao);
  if (filterEstado)  data = data.filter(i => i.estado  === filterEstado);

  tbody.innerHTML = data.map(i => `
    <tr>
      <td><strong>${i.nome}</strong></td>
      <td>${i.escalao}</td>
      <td>${i.idade} anos</td>
      <td>${i.telefone}</td>
      <td>${fmtDate(i.data)}</td>
      <td>${statusBadge(i.estado)}</td>
      <td>
        <div class="btn-actions">
          <button class="btn-icon" onclick="verInscricao(${i.id})" title="Ver detalhes">&#128269;</button>
          ${i.estado === 'Pendente' ? `
            <button class="btn-icon btn-icon--green" onclick="aprovarInscricao(${i.id})" title="Aprovar">&#10003;</button>
            <button class="btn-icon btn-icon--red"   onclick="rejeitarInscricao(${i.id})" title="Rejeitar">&#10007;</button>
          ` : ''}
        </div>
      </td>
    </tr>`).join('');
}

document.getElementById('filterInscEscalao')?.addEventListener('change', function () {
  renderInscricoes(this.value, document.getElementById('filterInscEstado').value);
});
document.getElementById('filterInscEstado')?.addEventListener('change', function () {
  renderInscricoes(document.getElementById('filterInscEscalao').value, this.value);
});

window.verInscricao = function (id) {
  const i = DB.inscricoes.find(x => x.id === id);
  if (!i) return;
  openModal(`Inscrição — ${i.nome}`, `
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-item__label">Nome</span><span class="detail-item__val">${i.nome}</span></div>
      <div class="detail-item"><span class="detail-item__label">Escalão</span><span class="detail-item__val">${i.escalao}</span></div>
      <div class="detail-item"><span class="detail-item__label">Idade</span><span class="detail-item__val">${i.idade} anos</span></div>
      <div class="detail-item"><span class="detail-item__label">Posição</span><span class="detail-item__val">${i.posicao || '—'}</span></div>
      <div class="detail-item"><span class="detail-item__label">Pé preferido</span><span class="detail-item__val">${i.pref}</span></div>
      <div class="detail-item"><span class="detail-item__label">Altura / Peso</span><span class="detail-item__val">${i.altura} cm / ${i.peso} kg</span></div>
      <div class="detail-item"><span class="detail-item__label">Contacto</span><span class="detail-item__val">${i.telefone}</span></div>
      <div class="detail-item"><span class="detail-item__label">E-mail</span><span class="detail-item__val">${i.email}</span></div>
      <div class="detail-item"><span class="detail-item__label">Data</span><span class="detail-item__val">${fmtDate(i.data)}</span></div>
      <div class="detail-item"><span class="detail-item__label">Estado</span><span class="detail-item__val">${statusBadge(i.estado)}</span></div>
    </div>`,
    i.estado === 'Pendente' ? `
      <button class="btn-cancel" onclick="closeModal()">Fechar</button>
      <button class="btn-reject" onclick="rejeitarInscricao(${i.id});closeModal()">Rejeitar</button>
      <button class="btn-approve" onclick="aprovarInscricao(${i.id});closeModal()">Aprovar</button>
    ` : `<button class="btn-cancel" onclick="closeModal()">Fechar</button>`
  );
};

window.aprovarInscricao = function (id) {
  const i = DB.inscricoes.find(x => x.id === id);
  if (!i) return;
  i.estado = 'Aprovado';
  // Add to athletes if not already there
  if (!DB.atletas.find(a => a.nome === i.nome)) {
    DB.atletas.push({
      id: DB.atletas.length + 1, nome: i.nome, escalao: i.escalao,
      posicao: i.posicao, idade: i.idade, encarregado: '—',
      telefone: i.telefone, estado: 'Activo'
    });
  }
  renderInscricoes();
  renderDashboard();
  renderAtletas();
  updateBadges();
  showToast('Inscrição aprovada!', 'green');
};

window.rejeitarInscricao = function (id) {
  const i = DB.inscricoes.find(x => x.id === id);
  if (!i) return;
  i.estado = 'Rejeitado';
  renderInscricoes();
  renderDashboard();
  updateBadges();
  showToast('Inscrição rejeitada.', 'red');
};

// ==================================================
// ATLETAS
// ==================================================
function renderAtletas(query = '') {
  const tbody = document.querySelector('#atletasTable tbody');
  let data = DB.atletas;
  if (query) data = data.filter(a => a.nome.toLowerCase().includes(query.toLowerCase()));

  tbody.innerHTML = data.map(a => `
    <tr>
      <td><strong>${a.nome}</strong></td>
      <td>${a.escalao}</td>
      <td>${a.posicao || '—'}</td>
      <td>${a.idade} anos</td>
      <td>${a.encarregado}</td>
      <td>${statusBadge(a.estado)}</td>
      <td>
        <div class="btn-actions">
          <button class="btn-icon" onclick="editAtleta(${a.id})" title="Editar">&#9998;</button>
          <button class="btn-icon btn-icon--red" onclick="removeAtleta(${a.id})" title="Remover">&#128465;</button>
        </div>
      </td>
    </tr>`).join('');
}

document.getElementById('searchAtleta')?.addEventListener('input', function () {
  renderAtletas(this.value);
});

document.getElementById('btnNovoAtleta')?.addEventListener('click', () => {
  openModal('Novo Atleta', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome completo</label><input type="text" id="mNome" placeholder="Nome do atleta" /></div>
      <div class="modal-field"><label>Escalão</label>
        <select id="mEscalao">
          <option>Sub-9</option><option>Sub-11</option><option>Sub-13</option>
          <option>Sub-15</option><option>Sub-17</option><option>Sub-19</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Posição</label>
        <select id="mPosicao">
          <option value="">—</option>
          <option>Guarda-redes</option><option>Defesa Direito</option><option>Defesa Esquerdo</option>
          <option>Central</option><option>Médio Defensivo</option><option>Médio</option>
          <option>Extremo</option><option>Avançado</option>
        </select>
      </div>
      <div class="modal-field"><label>Idade</label><input type="number" id="mIdade" min="5" max="20" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Encarregado</label><input type="text" id="mEnc" placeholder="Nome do encarregado" /></div>
      <div class="modal-field"><label>Telefone</label><input type="tel" id="mTel" placeholder="+351 9XX XXX XXX" /></div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNovoAtleta()">Guardar</button>`
  );
});

window.saveNovoAtleta = function () {
  const nome = document.getElementById('mNome').value.trim();
  if (!nome) { showToast('Introduza o nome do atleta.', 'red'); return; }
  DB.atletas.push({
    id: DB.atletas.length + 1,
    nome, escalao: document.getElementById('mEscalao').value,
    posicao: document.getElementById('mPosicao').value,
    idade: Number(document.getElementById('mIdade').value) || 0,
    encarregado: document.getElementById('mEnc').value || '—',
    telefone: document.getElementById('mTel').value,
    estado: 'Activo'
  });
  renderAtletas();
  updateBadges();
  closeModal();
  showToast('Atleta adicionado!', 'green');
};

window.editAtleta = function (id) {
  const a = DB.atletas.find(x => x.id === id);
  if (!a) return;
  openModal(`Editar — ${a.nome}`, `
    <div class="modal-row">
      <div class="modal-field"><label>Nome completo</label><input type="text" id="mNome" value="${a.nome}" /></div>
      <div class="modal-field"><label>Escalão</label>
        <select id="mEscalao">
          ${['Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19'].map(e =>
            `<option ${e===a.escalao?'selected':''}>${e}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Posição</label>
        <select id="mPosicao">
          ${['—','Guarda-redes','Defesa Direito','Defesa Esquerdo','Central','Médio Defensivo','Médio','Extremo','Avançado'].map(p =>
            `<option ${p===a.posicao?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Estado</label>
        <select id="mEstado">
          <option ${a.estado==='Activo'?'selected':''}>Activo</option>
          <option ${a.estado==='Inactivo'?'selected':''}>Inactivo</option>
        </select>
      </div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveEditAtleta(${id})">Guardar</button>`
  );
};

window.saveEditAtleta = function (id) {
  const a = DB.atletas.find(x => x.id === id);
  if (!a) return;
  a.nome    = document.getElementById('mNome').value.trim() || a.nome;
  a.escalao = document.getElementById('mEscalao').value;
  a.posicao = document.getElementById('mPosicao').value === '—' ? '' : document.getElementById('mPosicao').value;
  a.estado  = document.getElementById('mEstado').value;
  renderAtletas();
  updateBadges();
  closeModal();
  showToast('Atleta actualizado!', 'green');
};

window.removeAtleta = function (id) {
  if (!confirm('Tem a certeza que pretende remover este atleta?')) return;
  const idx = DB.atletas.findIndex(x => x.id === id);
  if (idx > -1) DB.atletas.splice(idx, 1);
  renderAtletas();
  updateBadges();
  showToast('Atleta removido.', 'red');
};

// ==================================================
// NOTÍCIAS
// ==================================================
function renderNoticias() {
  const grid = document.getElementById('newsAdminGrid');
  grid.innerHTML = [
    { id: 0, titulo: '+ Nova Notícia', categoria: '', data: '', publicada: null, img: null, novo: true },
    ...DB.noticias
  ].map(n => {
    if (n.novo) return `
      <div class="news-admin-card" style="display:flex;align-items:center;justify-content:center;
        min-height:240px;border:2px dashed #e2e8f0;background:#f4f6fb;cursor:pointer"
        onclick="document.getElementById('btnNovaNoticia').click()">
        <div style="text-align:center;color:#64748b">
          <div style="font-size:2.5rem;margin-bottom:8px">+</div>
          <div style="font-weight:700;font-size:0.9rem">Nova Notícia</div>
        </div>
      </div>`;
    return `
      <div class="news-admin-card">
        <div class="news-admin-img news-admin-img--${n.img}">
          <span class="news-cat-badge">${n.categoria}</span>
        </div>
        <div class="news-admin-body">
          <div class="news-admin-title">${n.titulo}</div>
          <div class="news-admin-date">${fmtDate(n.data)} · ${n.publicada
            ? '<span style="color:#16a34a;font-weight:700">✓ Publicada</span>'
            : '<span style="color:#d97706;font-weight:700">⏸ Rascunho</span>'}</div>
        </div>
        <div class="news-admin-footer">
          <button class="btn-icon" onclick="editNoticia(${n.id})" title="Editar">&#9998;</button>
          <button class="btn-icon btn-icon--red" onclick="removeNoticia(${n.id})" title="Eliminar">&#128465;</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('btnNovaNoticia')?.addEventListener('click', () => {
  openModal('Nova Notícia', `
    <div class="modal-field"><label>Título</label><input type="text" id="mTitulo" placeholder="Título da notícia" /></div>
    <div class="modal-row">
      <div class="modal-field"><label>Categoria</label>
        <select id="mCat">
          <option>Resultado</option><option>Seleção</option><option>Conquista</option><option>Clube</option>
        </select>
      </div>
      <div class="modal-field"><label>Data</label><input type="date" id="mData" /></div>
    </div>
    <div class="modal-field"><label>Resumo</label><textarea id="mResumo" rows="3" placeholder="Texto resumido da notícia..."></textarea></div>
    <div class="modal-field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="mPublicada" /> Publicar imediatamente
      </label>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNovaNoticia()">Guardar</button>`
  );
  document.getElementById('mData').value = new Date().toISOString().split('T')[0];
});

window.saveNovaNoticia = function () {
  const titulo = document.getElementById('mTitulo').value.trim();
  if (!titulo) { showToast('Introduza o título.', 'red'); return; }
  DB.noticias.unshift({
    id: Date.now(), titulo, categoria: document.getElementById('mCat').value,
    data: document.getElementById('mData').value,
    publicada: document.getElementById('mPublicada').checked,
    img: Math.ceil(Math.random() * 3)
  });
  renderNoticias();
  closeModal();
  showToast('Notícia guardada!', 'green');
};

window.editNoticia = function (id) {
  const n = DB.noticias.find(x => x.id === id);
  if (!n) return;
  openModal(`Editar Notícia`, `
    <div class="modal-field"><label>Título</label><input type="text" id="mTitulo" value="${n.titulo}" /></div>
    <div class="modal-row">
      <div class="modal-field"><label>Categoria</label>
        <select id="mCat">
          ${['Resultado','Seleção','Conquista','Clube'].map(c =>
            `<option ${c===n.categoria?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Data</label><input type="date" id="mData" value="${n.data}" /></div>
    </div>
    <div class="modal-field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="mPublicada" ${n.publicada?'checked':''} /> Publicada
      </label>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveEditNoticia(${id})">Guardar</button>`
  );
};

window.saveEditNoticia = function (id) {
  const n = DB.noticias.find(x => x.id === id);
  if (!n) return;
  n.titulo    = document.getElementById('mTitulo').value.trim() || n.titulo;
  n.categoria = document.getElementById('mCat').value;
  n.data      = document.getElementById('mData').value;
  n.publicada = document.getElementById('mPublicada').checked;
  renderNoticias();
  closeModal();
  showToast('Notícia actualizada!', 'green');
};

window.removeNoticia = function (id) {
  if (!confirm('Eliminar esta notícia?')) return;
  const idx = DB.noticias.findIndex(x => x.id === id);
  if (idx > -1) DB.noticias.splice(idx, 1);
  renderNoticias();
  showToast('Notícia eliminada.', 'red');
};

// ==================================================
// MENSAGENS
// ==================================================
function renderMensagens(filterEstado = '') {
  const tbody = document.querySelector('#msgTable tbody');
  let data = DB.mensagens;
  if (filterEstado) data = data.filter(m => m.estado === filterEstado);

  tbody.innerHTML = data.map(m => `
    <tr style="${m.estado==='Não lida'?'font-weight:700':''}">
      <td>${m.nome}</td>
      <td>${m.email}</td>
      <td>${m.assunto}</td>
      <td>${fmtDate(m.data)}</td>
      <td>${statusBadge(m.estado)}</td>
      <td>
        <div class="btn-actions">
          <button class="btn-icon" onclick="verMensagem(${m.id})" title="Ver mensagem">&#128269;</button>
          ${m.estado !== 'Respondida' ? `<button class="btn-icon btn-icon--green" onclick="marcarRespondida(${m.id})" title="Marcar como respondida">&#10003;</button>` : ''}
          <button class="btn-icon btn-icon--red" onclick="removeMensagem(${m.id})" title="Eliminar">&#128465;</button>
        </div>
      </td>
    </tr>`).join('');
}

document.getElementById('filterMsgEstado')?.addEventListener('change', function () {
  renderMensagens(this.value);
});

window.verMensagem = function (id) {
  const m = DB.mensagens.find(x => x.id === id);
  if (!m) return;
  if (m.estado === 'Não lida') { m.estado = 'Lida'; renderMensagens(); updateBadges(); }
  openModal(`Mensagem de ${m.nome}`, `
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-item__label">Nome</span><span class="detail-item__val">${m.nome}</span></div>
      <div class="detail-item"><span class="detail-item__label">E-mail</span><span class="detail-item__val">${m.email}</span></div>
      <div class="detail-item"><span class="detail-item__label">Telefone</span><span class="detail-item__val">${m.telefone}</span></div>
      <div class="detail-item"><span class="detail-item__label">Assunto</span><span class="detail-item__val">${m.assunto}</span></div>
      <div class="detail-item" style="grid-column:span 2"><span class="detail-item__label">Mensagem</span>
        <span class="detail-item__val" style="white-space:pre-wrap">${m.mensagem}</span></div>
      <div class="detail-item"><span class="detail-item__label">Data</span><span class="detail-item__val">${fmtDate(m.data)}</span></div>
      <div class="detail-item"><span class="detail-item__label">Estado</span><span class="detail-item__val">${statusBadge(m.estado)}</span></div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Fechar</button>
     ${m.estado !== 'Respondida' ? `<button class="btn-approve" onclick="marcarRespondida(${m.id});closeModal()">Marcar respondida</button>` : ''}`
  );
};

window.marcarRespondida = function (id) {
  const m = DB.mensagens.find(x => x.id === id);
  if (!m) return;
  m.estado = 'Respondida';
  renderMensagens();
  updateBadges();
  showToast('Mensagem marcada como respondida.', 'green');
};

window.removeMensagem = function (id) {
  if (!confirm('Eliminar esta mensagem?')) return;
  const idx = DB.mensagens.findIndex(x => x.id === id);
  if (idx > -1) DB.mensagens.splice(idx, 1);
  renderMensagens();
  updateBadges();
  showToast('Mensagem eliminada.', 'red');
};

// ==================================================
// ESCALÕES
// ==================================================
function renderEscaloes() {
  const grid = document.getElementById('escaloesGrid');
  grid.innerHTML = DB.escaloes.map(e => `
    <div class="escalao-card ${e.destaque ? 'escalao-card--featured' : ''}">
      <div class="escalao-name">${e.nome} – ${e.designacao}</div>
      <div class="escalao-range">${e.faixa}</div>
      <div class="escalao-stats">
        <div class="escalao-stat">
          <span class="escalao-stat__num">${e.atletas}</span>
          <span class="escalao-stat__label">Atletas</span>
        </div>
      </div>
      <div class="escalao-treinador">
        <strong>Treinador:</strong> ${e.treinador}<br />
        <strong>Treinos:</strong> ${e.treinos}
      </div>
    </div>`).join('');
}
