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
    noticias: 'Notícias', mensagens: 'Mensagens', escaloes: 'Escalões',
    jogos: 'Jogos', patrocinadores: 'Patrocinadores', facebook: 'Facebook',
  };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
  document.getElementById('sidebar').classList.remove('open');

  if (name === 'facebook') initFacebookPage();
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
  renderJogos();
  renderPatrocinadores();

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

// ==================================================
// JOGOS
// ==================================================
function fmtDataJogo(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function renderJogos(filterEscalao = '', filterEstado = '') {
  const tbody = document.querySelector('#jogosTable tbody');
  let data = [...DB.jogos];
  if (filterEscalao) data = data.filter(j => j.escalao === filterEscalao);
  if (filterEstado)  data = data.filter(j => j.estado  === filterEstado);
  data.sort((a, b) => b.data.localeCompare(a.data));

  tbody.innerHTML = data.map(j => {
    const sc = j.casa === 'Sport Campinense' || j.fora === 'Sport Campinense';
    const resultado = j.estado === 'Realizado'
      ? `<strong>${j.gcasa} – ${j.gfora}</strong>`
      : `<span style="color:var(--gray-text)">—</span>`;
    const estadoBadge = j.estado === 'Realizado'
      ? `<span class="status status--aprovado">Realizado</span>`
      : `<span class="status status--pendente">Agendado</span>`;
    return `
      <tr>
        <td>${fmtDataJogo(j.data)}<br/><span style="font-size:0.75rem;color:var(--gray-text)">${j.hora}</span></td>
        <td>${j.escalao}</td>
        <td style="${j.casa==='Sport Campinense'?'font-weight:700;color:var(--blue)':''}">${j.casa}</td>
        <td style="${j.fora==='Sport Campinense'?'font-weight:700;color:var(--blue)':''}">${j.fora}</td>
        <td style="text-align:center;font-size:1.1rem">${resultado}</td>
        <td style="font-size:0.8rem;color:var(--gray-text)">${j.local}</td>
        <td>${estadoBadge}</td>
        <td>
          <div class="btn-actions">
            ${j.estado === 'Agendado' ? `<button class="btn-icon btn-icon--green" onclick="registarResultado(${j.id})" title="Registar resultado">&#9999;</button>` : ''}
            <button class="btn-icon" onclick="editJogo(${j.id})" title="Editar">&#9998;</button>
            <button class="btn-icon btn-icon--red" onclick="removeJogo(${j.id})" title="Eliminar">&#128465;</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

document.getElementById('filterJogoEscalao')?.addEventListener('change', function () {
  renderJogos(this.value, document.getElementById('filterJogoEstado').value);
});
document.getElementById('filterJogoEstado')?.addEventListener('change', function () {
  renderJogos(document.getElementById('filterJogoEscalao').value, this.value);
});

document.getElementById('btnNovoJogo')?.addEventListener('click', () => {
  openModal('Novo Jogo', `
    <div class="modal-row">
      <div class="modal-field"><label>Escalão *</label>
        <select id="mJEscalao">
          <option>Sub-9</option><option>Sub-11</option><option>Sub-13</option>
          <option>Sub-15</option><option>Sub-17</option><option>Sub-19</option>
        </select>
      </div>
      <div class="modal-field"><label>Data *</label><input type="date" id="mJData" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Hora</label><input type="time" id="mJHora" value="10:30" /></div>
      <div class="modal-field"><label>Local</label><input type="text" id="mJLocal" placeholder="Est. Municipal Loulé" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Equipa Casa *</label><input type="text" id="mJCasa" placeholder="Nome da equipa" /></div>
      <div class="modal-field"><label>Equipa Fora *</label><input type="text" id="mJFora" placeholder="Nome da equipa" /></div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNovoJogo()">Guardar</button>`
  );
  document.getElementById('mJData').value = new Date().toISOString().split('T')[0];
  document.getElementById('mJCasa').value = 'Sport Campinense';
});

window.saveNovoJogo = function () {
  const casa = document.getElementById('mJCasa').value.trim();
  const fora = document.getElementById('mJFora').value.trim();
  if (!casa || !fora) { showToast('Preencha as equipas.', 'red'); return; }
  DB.jogos.push({
    id: Date.now(),
    escalao: document.getElementById('mJEscalao').value,
    casa, fora,
    gcasa: null, gfora: null,
    data:  document.getElementById('mJData').value,
    hora:  document.getElementById('mJHora').value,
    local: document.getElementById('mJLocal').value || 'Est. Municipal Loulé',
    estado: 'Agendado',
  });
  renderJogos();
  closeModal();
  showToast('Jogo adicionado!', 'green');
};

window.registarResultado = function (id) {
  const j = DB.jogos.find(x => x.id === id);
  if (!j) return;
  openModal(`Registar Resultado`, `
    <p style="margin-bottom:16px;color:var(--gray-text);font-size:0.9rem">
      ${j.escalao} · ${fmtDataJogo(j.data)} · ${j.hora}
    </p>
    <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:20px">
      <div style="text-align:center">
        <div style="font-weight:700;margin-bottom:8px">${j.casa}</div>
        <input type="number" id="mGCasa" min="0" max="30" value="0"
          style="width:70px;padding:12px;font-size:1.5rem;text-align:center;border:2px solid var(--gray-border);border-radius:8px;font-family:var(--font-display)" />
      </div>
      <div style="font-family:var(--font-display);font-size:2rem;color:var(--gray-text)">–</div>
      <div style="text-align:center">
        <div style="font-weight:700;margin-bottom:8px">${j.fora}</div>
        <input type="number" id="mGFora" min="0" max="30" value="0"
          style="width:70px;padding:12px;font-size:1.5rem;text-align:center;border:2px solid var(--gray-border);border-radius:8px;font-family:var(--font-display)" />
      </div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-approve" onclick="saveResultado(${id})">Confirmar</button>`
  );
};

window.saveResultado = function (id) {
  const j = DB.jogos.find(x => x.id === id);
  if (!j) return;
  j.gcasa  = parseInt(document.getElementById('mGCasa').value) || 0;
  j.gfora  = parseInt(document.getElementById('mGFora').value) || 0;
  j.estado = 'Realizado';
  renderJogos();
  closeModal();
  showToast(`Resultado registado: ${j.gcasa} – ${j.gfora}`, 'green');
};

window.editJogo = function (id) {
  const j = DB.jogos.find(x => x.id === id);
  if (!j) return;
  openModal('Editar Jogo', `
    <div class="modal-row">
      <div class="modal-field"><label>Escalão</label>
        <select id="mJEscalao">
          ${['Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19'].map(e =>
            `<option ${e===j.escalao?'selected':''}>${e}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Data</label><input type="date" id="mJData" value="${j.data}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Hora</label><input type="time" id="mJHora" value="${j.hora}" /></div>
      <div class="modal-field"><label>Local</label><input type="text" id="mJLocal" value="${j.local}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Equipa Casa</label><input type="text" id="mJCasa" value="${j.casa}" /></div>
      <div class="modal-field"><label>Equipa Fora</label><input type="text" id="mJFora" value="${j.fora}" /></div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveEditJogo(${id})">Guardar</button>`
  );
};

window.saveEditJogo = function (id) {
  const j = DB.jogos.find(x => x.id === id);
  if (!j) return;
  j.escalao = document.getElementById('mJEscalao').value;
  j.data    = document.getElementById('mJData').value;
  j.hora    = document.getElementById('mJHora').value;
  j.local   = document.getElementById('mJLocal').value;
  j.casa    = document.getElementById('mJCasa').value.trim() || j.casa;
  j.fora    = document.getElementById('mJFora').value.trim() || j.fora;
  renderJogos();
  closeModal();
  showToast('Jogo actualizado!', 'green');
};

window.removeJogo = function (id) {
  if (!confirm('Eliminar este jogo?')) return;
  const idx = DB.jogos.findIndex(x => x.id === id);
  if (idx > -1) DB.jogos.splice(idx, 1);
  renderJogos();
  showToast('Jogo eliminado.', 'red');
};

// ==================================================
// PATROCINADORES
// ==================================================
function renderPatrocinadores() {
  const wrap = document.getElementById('sponsorsAdminTiers');
  const tiers = ['Ouro', 'Prata', 'Bronze'];
  wrap.innerHTML = tiers.map(tier => {
    const lista = DB.patrocinadores.filter(p => p.tier === tier);
    return `
      <div class="sponsors-admin-tier">
        <div class="sponsors-admin-tier__header">
          <span class="tier-label tier-label--${tier.toLowerCase()}">&#9733; ${tier}</span>
          <span style="font-size:0.8rem;color:var(--gray-text)">${lista.filter(p=>p.ativo).length} activos · ${lista.filter(p=>!p.ativo).length} inactivos</span>
        </div>
        <div class="sponsors-admin-grid">
          ${lista.map(p => `
            <div class="sponsor-admin-card ${p.ativo ? '' : 'sponsor-admin-card--inactive'}">
              <span class="sponsor-admin-card__tier-dot dot--${p.tier.toLowerCase()}"></span>
              <div class="sponsor-admin-logo">${p.nome}</div>
              <div class="sponsor-admin-name">${p.nome}</div>
              <div class="sponsor-admin-sector">${p.sector} · Desde ${p.desde}</div>
              <div class="sponsor-admin-actions">
                <button class="btn-icon" onclick="editPatrocinador(${p.id})" title="Editar">&#9998;</button>
                <button class="btn-icon ${p.ativo ? 'btn-icon--red' : 'btn-icon--green'}"
                  onclick="togglePatrocinador(${p.id})"
                  title="${p.ativo ? 'Desactivar' : 'Activar'}">${p.ativo ? '&#9940;' : '&#9989;'}</button>
                <button class="btn-icon btn-icon--red" onclick="removePatrocinador(${p.id})" title="Eliminar">&#128465;</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

document.getElementById('btnNovoPatrocinador')?.addEventListener('click', () => {
  openModal('Novo Patrocinador', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome da empresa *</label>
        <input type="text" id="mPNome" placeholder="Nome da empresa" /></div>
      <div class="modal-field"><label>Sector</label>
        <input type="text" id="mPSector" placeholder="Ex: Construção, Saúde..." /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Nível de patrocínio</label>
        <select id="mPTier">
          <option>Ouro</option><option>Prata</option><option>Bronze</option>
        </select>
      </div>
      <div class="modal-field"><label>Ano de início</label>
        <input type="number" id="mPDesde" value="2026" min="2000" max="2099" /></div>
    </div>
    <div class="modal-field"><label>Website (opcional)</label>
      <input type="url" id="mPWebsite" placeholder="https://empresa.pt" /></div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNovoPatrocinador()">Guardar</button>`
  );
});

window.saveNovoPatrocinador = function () {
  const nome = document.getElementById('mPNome').value.trim();
  if (!nome) { showToast('Introduza o nome.', 'red'); return; }
  DB.patrocinadores.push({
    id: Date.now(), nome,
    sector:  document.getElementById('mPSector').value || '—',
    tier:    document.getElementById('mPTier').value,
    desde:   String(document.getElementById('mPDesde').value),
    website: document.getElementById('mPWebsite').value,
    ativo:   true,
  });
  renderPatrocinadores();
  closeModal();
  showToast('Patrocinador adicionado!', 'green');
};

window.editPatrocinador = function (id) {
  const p = DB.patrocinadores.find(x => x.id === id);
  if (!p) return;
  openModal(`Editar — ${p.nome}`, `
    <div class="modal-row">
      <div class="modal-field"><label>Nome</label>
        <input type="text" id="mPNome" value="${p.nome}" /></div>
      <div class="modal-field"><label>Sector</label>
        <input type="text" id="mPSector" value="${p.sector}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Nível</label>
        <select id="mPTier">
          ${['Ouro','Prata','Bronze'].map(t =>
            `<option ${t===p.tier?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Desde</label>
        <input type="number" id="mPDesde" value="${p.desde}" /></div>
    </div>
    <div class="modal-field"><label>Website</label>
      <input type="url" id="mPWebsite" value="${p.website}" /></div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveEditPatrocinador(${id})">Guardar</button>`
  );
};

window.saveEditPatrocinador = function (id) {
  const p = DB.patrocinadores.find(x => x.id === id);
  if (!p) return;
  p.nome    = document.getElementById('mPNome').value.trim() || p.nome;
  p.sector  = document.getElementById('mPSector').value;
  p.tier    = document.getElementById('mPTier').value;
  p.desde   = String(document.getElementById('mPDesde').value);
  p.website = document.getElementById('mPWebsite').value;
  renderPatrocinadores();
  closeModal();
  showToast('Patrocinador actualizado!', 'green');
};

window.togglePatrocinador = function (id) {
  const p = DB.patrocinadores.find(x => x.id === id);
  if (!p) return;
  p.ativo = !p.ativo;
  renderPatrocinadores();
  showToast(p.ativo ? 'Patrocinador activado.' : 'Patrocinador desactivado.', p.ativo ? 'green' : '');
};

window.removePatrocinador = function (id) {
  if (!confirm('Eliminar este patrocinador?')) return;
  const idx = DB.patrocinadores.findIndex(x => x.id === id);
  if (idx > -1) DB.patrocinadores.splice(idx, 1);
  renderPatrocinadores();
  showToast('Patrocinador eliminado.', 'red');
};

// ==================================================
// IMPORTAR FPF
// ==================================================

// Toggle painel
document.getElementById('btnImportarFPF')?.addEventListener('click', () => {
  const panel = document.getElementById('fpfImportPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

// Tabs do painel
document.querySelectorAll('.fpf-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.fpf-tab').forEach(t => t.classList.remove('fpf-tab--active'));
    document.querySelectorAll('.fpf-tab-content').forEach(c => c.style.display = 'none');
    tab.classList.add('fpf-tab--active');
    const target = document.getElementById(`ftab-${tab.dataset.ftab}`);
    if (target) target.style.display = 'block';
  });
});

// Carregar ficheiro
document.getElementById('fpfFileInput')?.addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  document.getElementById('fpfFileName').textContent = `📄 ${file.name}`;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('fpfJsonInput').value = e.target.result;
    // Switch para tab JSON
    document.querySelectorAll('.fpf-tab').forEach(t => t.classList.remove('fpf-tab--active'));
    document.querySelectorAll('.fpf-tab-content').forEach(c => c.style.display = 'none');
    document.querySelector('.fpf-tab[data-ftab="json"]').classList.add('fpf-tab--active');
    document.getElementById('ftab-json').style.display = 'block';
    infoImport(`✓ Ficheiro carregado: ${file.name}`, 'ok');
  };
  reader.readAsText(file);
});

// Carregar via URL
window.importarFPFUrl = async function () {
  const url = document.getElementById('fpfUrlInput').value.trim();
  if (!url) { infoImport('Introduza um URL válido.', 'err'); return; }
  infoImport('A carregar...', '');
  try {
    const res  = await fetch(url);
    const json = await res.text();
    document.getElementById('fpfJsonInput').value = json;
    document.querySelectorAll('.fpf-tab').forEach(t => t.classList.remove('fpf-tab--active'));
    document.querySelectorAll('.fpf-tab-content').forEach(c => c.style.display = 'none');
    document.querySelector('.fpf-tab[data-ftab="json"]').classList.add('fpf-tab--active');
    document.getElementById('ftab-json').style.display = 'block';
    infoImport('✓ JSON carregado com sucesso.', 'ok');
  } catch (e) {
    infoImport(`Erro: ${e.message}`, 'err');
  }
};

function infoImport(msg, tipo) {
  const el = document.getElementById('fpfImportInfo');
  el.textContent = msg;
  el.className = 'fpf-import-info' + (tipo ? ` ${tipo}` : '');
}

// Processar importação
window.processarImportFPF = function () {
  const raw = document.getElementById('fpfJsonInput').value.trim();
  if (!raw) { infoImport('Cole o JSON gerado pelo scraper.', 'err'); return; }

  let dados;
  try {
    dados = JSON.parse(raw);
  } catch (e) {
    infoImport('JSON inválido: ' + e.message, 'err');
    return;
  }

  if (!dados.competicoes || !Array.isArray(dados.competicoes)) {
    infoImport('Formato inválido. O JSON deve ter a chave "competicoes".', 'err');
    return;
  }

  let totalJogos = 0;
  let idCounter = Date.now();

  dados.competicoes.forEach(comp => {
    const escalao = extrairEscalao(comp.nome || comp.escalao || '');

    // Importar jogos
    (comp.jogos || []).forEach(j => {
      // Evitar duplicados por data+equipas
      const jaExiste = DB.jogos.find(x =>
        x.data === j.data && x.casa === j.casa && x.fora === j.fora
      );
      if (!jaExiste) {
        DB.jogos.push({
          id:      ++idCounter,
          escalao: escalao || comp.escalao || 'Sub-17',
          casa:    j.casa,
          fora:    j.fora,
          gcasa:   j.gcasa,
          gfora:   j.gfora,
          data:    j.data,
          hora:    j.hora || '—',
          local:   j.local || '—',
          estado:  j.estado || (j.gcasa !== null ? 'Realizado' : 'Agendado'),
        });
        totalJogos++;
      }
    });
  });

  renderJogos();
  document.getElementById('fpfImportPanel').style.display = 'none';
  document.getElementById('fpfJsonInput').value = '';

  const gerado = dados.geradoEm
    ? ` (dados de ${new Date(dados.geradoEm).toLocaleDateString('pt-PT')})`
    : '';
  showToast(`✓ ${totalJogos} jogos importados da FPF${gerado}`, 'green');
};

// Tenta extrair escalão do nome da competição
function extrairEscalao(nome) {
  const mapa = [
    [/sub.?19|juveni/i,   'Sub-19'],
    [/sub.?17|iniciado/i, 'Sub-17'],
    [/sub.?15|infantil/i, 'Sub-15'],
    [/sub.?13|benjamin/i, 'Sub-13'],
    [/sub.?11|traquina/i, 'Sub-11'],
    [/sub.?9|petiz/i,     'Sub-9'],
  ];
  for (const [re, label] of mapa) {
    if (re.test(nome)) return label;
  }
  return null;
}

// =============================================
// FACEBOOK ADMIN
// =============================================

// ── Storage helpers ──────────────────────────
function getFbPosts() {
  try { return JSON.parse(localStorage.getItem('fb_posts') || '[]'); } catch { return []; }
}
function saveFbPosts(arr) {
  localStorage.setItem('fb_posts', JSON.stringify(arr));
}
function getFbConfig() {
  try { return JSON.parse(localStorage.getItem('fb_config') || '{}'); } catch { return {}; }
}
function saveFbConfig(cfg) {
  localStorage.setItem('fb_config', JSON.stringify(cfg));
}

// ── Render posts grid ─────────────────────────
function renderFbPosts() {
  const posts = getFbPosts();
  const grid  = document.getElementById('fbPostsGrid');
  const count = document.getElementById('fbPostCount');
  if (!grid) return;

  if (count) count.textContent = `(${posts.length})`;

  if (!posts.length) {
    grid.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📘</div>
      <p>Sem publicações guardadas. Adicione manualmente ou sincronize via API.</p>
    </div>`;
    return;
  }

  grid.innerHTML = posts.map((p, i) => {
    const tipoIcon  = { foto:'📷', video:'▶️', link:'🔗', texto:'📝' }[p.tipo] || '📝';
    const tipoLabel = { foto:'Foto', video:'Vídeo', link:'Partilha', texto:'Publicação' }[p.tipo] || 'Publicação';
    const dataStr   = p.data ? new Date(p.data).toLocaleDateString('pt-PT', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const imgStyle  = p.imagem ? `background-image:url('${p.imagem}')` : '';
    return `
    <div class="fb-posts-admin-card">
      <div class="fb-posts-admin-card__img" style="${imgStyle}">
        ${!p.imagem ? `<span>${tipoIcon}</span>` : ''}
      </div>
      <div class="fb-posts-admin-card__body">
        <div class="fb-posts-admin-card__meta">
          <span class="badge">${tipoLabel}</span>
          <time>${dataStr}</time>
        </div>
        <p class="fb-posts-admin-card__text">${(p.texto || '').slice(0, 120)}${(p.texto || '').length > 120 ? '…' : ''}</p>
        ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" class="fb-posts-admin-card__link">Ver publicação →</a>` : ''}
      </div>
      <div class="fb-posts-admin-card__actions">
        <button class="btn btn-sm" onclick="editFbPost(${i})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFbPost(${i})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ── Load config into form ─────────────────────
function loadFbConfig() {
  const cfg = getFbConfig();
  const tkEl = document.getElementById('fbAccessToken');
  const idEl = document.getElementById('fbPageId');
  if (tkEl) tkEl.value = cfg.accessToken || '';
  if (idEl) idEl.value = cfg.pageId || '';
}

// ── Save API config ───────────────────────────
function guardarFbConfig() {
  const token  = (document.getElementById('fbAccessToken')?.value || '').trim();
  const pageId = (document.getElementById('fbPageId')?.value || '').trim();
  saveFbConfig({ accessToken: token, pageId });

  const syncBtn = document.getElementById('btnSincFb');
  if (syncBtn) syncBtn.style.display = (token && pageId) ? '' : 'none';

  showToast('Configuração Facebook guardada', 'green');
}

// ── Test API connection ───────────────────────
async function testarFbApi() {
  const cfg = getFbConfig();
  if (!cfg.accessToken || !cfg.pageId) {
    showToast('Preencha o Access Token e o Page ID primeiro', 'red');
    return;
  }
  const btn = document.getElementById('btnTestarFbApi');
  if (btn) { btn.disabled = true; btn.textContent = 'A testar…'; }
  try {
    const url  = `https://graph.facebook.com/v19.0/${cfg.pageId}?fields=name,fan_count&access_token=${cfg.accessToken}`;
    const res  = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    showToast(`✓ Ligação OK — Página: ${json.name} (${json.fan_count || 0} seguidores)`, 'green');
  } catch (e) {
    showToast(`Erro: ${e.message}`, 'red');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Testar Ligação'; }
  }
}

// ── Sync posts via Graph API ──────────────────
async function sincronizarFacebook() {
  const cfg = getFbConfig();
  if (!cfg.accessToken || !cfg.pageId) {
    showToast('Configure o Access Token e o Page ID primeiro', 'red');
    return;
  }
  const btn = document.getElementById('btnSincFb');
  if (btn) { btn.disabled = true; btn.textContent = 'A sincronizar…'; }
  try {
    const fields = 'message,story,full_picture,permalink_url,created_time,attachments,reactions.summary(true)';
    const url    = `https://graph.facebook.com/v19.0/${cfg.pageId}/posts?fields=${fields}&limit=20&access_token=${cfg.accessToken}`;
    const res    = await fetch(url);
    const json   = await res.json();
    if (json.error) throw new Error(json.error.message);

    const posts = (json.data || []).map(p => {
      const att  = p.attachments?.data?.[0];
      const tipo = att?.type?.includes('video') ? 'video'
                 : att?.type?.includes('photo') || p.full_picture ? 'foto'
                 : att?.type?.includes('share') ? 'link' : 'texto';
      return {
        id:     p.id,
        texto:  p.message || p.story || '',
        imagem: p.full_picture || att?.media?.image?.src || '',
        url:    p.permalink_url,
        data:   p.created_time,
        tipo,
        likes:  p.reactions?.summary?.total_count || 0,
      };
    });

    saveFbPosts(posts);
    renderFbPosts();
    showToast(`✓ ${posts.length} publicações importadas do Facebook`, 'green');
  } catch (e) {
    showToast(`Erro ao sincronizar: ${e.message}`, 'red');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Sincronizar agora'; }
  }
}

// ── Clear all posts ───────────────────────────
function limparFbPosts() {
  if (!confirm('Apagar todas as publicações guardadas?')) return;
  saveFbPosts([]);
  renderFbPosts();
  showToast('Publicações apagadas', 'green');
}

// ── Delete single post ────────────────────────
function deleteFbPost(i) {
  const posts = getFbPosts();
  posts.splice(i, 1);
  saveFbPosts(posts);
  renderFbPosts();
  showToast('Publicação removida', 'green');
}

// ── Edit / Add post modal ─────────────────────
function editFbPost(i) {
  const posts = getFbPosts();
  const post  = i >= 0 ? posts[i] : { texto:'', imagem:'', url:'', data:'', tipo:'texto', likes:0 };
  openFbPostModal(post, i);
}

function openFbPostModal(post, idx) {
  // Remove existing modal if any
  document.getElementById('fbPostModal')?.remove();

  const tipos = ['texto','foto','video','link'];
  const modal = document.createElement('div');
  modal.id = 'fbPostModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <h3>${idx >= 0 ? 'Editar' : 'Adicionar'} Publicação</h3>
        <button class="modal-close" onclick="document.getElementById('fbPostModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Tipo</label>
        <select id="fbPostTipo" class="form-input" style="margin-bottom:12px">
          ${tipos.map(t => `<option value="${t}" ${post.tipo===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
        </select>
        <label class="form-label">Texto da publicação</label>
        <textarea id="fbPostTexto" class="form-input" rows="4" style="margin-bottom:12px">${post.texto||''}</textarea>
        <label class="form-label">URL da imagem (opcional)</label>
        <input id="fbPostImagem" class="form-input" type="url" placeholder="https://…" value="${post.imagem||''}" style="margin-bottom:12px">
        <label class="form-label">URL da publicação</label>
        <input id="fbPostUrl" class="form-input" type="url" placeholder="https://facebook.com/…" value="${post.url||''}" style="margin-bottom:12px">
        <label class="form-label">Data</label>
        <input id="fbPostData" class="form-input" type="date" value="${post.data ? post.data.slice(0,10) : ''}" style="margin-bottom:12px">
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('fbPostModal').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarFbPost(${idx})">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function salvarFbPost(idx) {
  const posts = getFbPosts();
  const post = {
    texto:  document.getElementById('fbPostTexto')?.value.trim() || '',
    imagem: document.getElementById('fbPostImagem')?.value.trim() || '',
    url:    document.getElementById('fbPostUrl')?.value.trim() || '',
    data:   document.getElementById('fbPostData')?.value || '',
    tipo:   document.getElementById('fbPostTipo')?.value || 'texto',
    likes:  idx >= 0 ? (posts[idx]?.likes || 0) : 0,
  };
  if (!post.texto && !post.url) { showToast('Preencha o texto ou URL', 'red'); return; }
  if (idx >= 0) posts[idx] = post;
  else posts.unshift(post);
  saveFbPosts(posts);
  document.getElementById('fbPostModal')?.remove();
  renderFbPosts();
  showToast(idx >= 0 ? 'Publicação atualizada' : 'Publicação adicionada', 'green');
}

// ── Init Facebook page ────────────────────────
function initFacebookPage() {
  loadFbConfig();
  renderFbPosts();

  document.getElementById('btnAddFbPost')?.addEventListener('click', () => editFbPost(-1));

  // Show sync button if config is present
  const cfg = getFbConfig();
  if (cfg.accessToken && cfg.pageId) {
    document.getElementById('btnSincFb').style.display = '';
  }
}
