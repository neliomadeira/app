// =============================================
// ADMIN PANEL — MAIN JS
// =============================================

// ---- AUTH + SEGURANÇA ---- //
const loginForm    = document.getElementById('loginForm');
const loginError   = document.getElementById('loginError');
const loginWrap    = document.getElementById('loginWrap');
const adminLayout  = document.getElementById('adminLayout');
const togglePw     = document.getElementById('togglePw');
const loginPassEl  = document.getElementById('loginPass');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000;   // 5 minutos
const SESSION_MS   = 30 * 60 * 1000;  // 30 minutos de inactividade
let   sessionTimer = null;

// Hash SHA-256 via Web Crypto API
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// Retorna o hash SHA-256 da password padrão "1234"
function getDefaultHash() { return sha256('1234').catch(() => '____'); }

function getLockout() {
  try { return JSON.parse(localStorage.getItem('admin_lockout') || 'null'); } catch { return null; }
}
function setLockout(data) { localStorage.setItem('admin_lockout', JSON.stringify(data)); }
function clearLockout()   { localStorage.removeItem('admin_lockout'); }

function checkLockout() {
  const l = getLockout();
  if (!l) return null;
  const remaining = l.until - Date.now();
  if (remaining <= 0) { clearLockout(); return null; }
  return remaining;
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
  setTimeout(() => { loginError.style.display = 'none'; }, 4000);
}

function startSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    doLogout();
    showLoginError('Sessão expirada por inactividade (30 min). Faça login novamente.');
  }, SESSION_MS);
}

function resetSessionTimer() {
  if (adminLayout?.style.display !== 'none' && adminLayout?.style.display !== '') {
    startSessionTimer();
  }
}

function doLogout() {
  clearTimeout(sessionTimer);
  adminLayout.style.display = 'none';
  document.body.classList.add('login-page');
  loginWrap.style.display = '';
  loginForm.reset();
}

['click','keydown','mousemove','scroll'].forEach(evt =>
  document.addEventListener(evt, resetSessionTimer, { passive: true })
);

togglePw?.addEventListener('click', () => {
  loginPassEl.type = loginPassEl.type === 'password' ? 'text' : 'password';
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const remaining = checkLockout();
  if (remaining) {
    const mins = Math.ceil(remaining / 60000);
    showLoginError(`Conta bloqueada. Tente novamente em ${mins} minuto${mins > 1 ? 's' : ''}.`);
    return;
  }

  const u = document.getElementById('loginUser').value.trim();
  const p = loginPassEl.value;
  if (!p) { showLoginError('Introduza a palavra-passe.'); return; }

  // Carregar credenciais guardadas (suporte a hash e texto simples legado)
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('admin_creds') || 'null'); } catch(_) {}

  let inputHash;
  try { inputHash = await sha256(p); } catch(_) { inputHash = p; }

  let match = false;
  if (stored) {
    if (stored.hashed) {
      match = u === stored.user && inputHash === stored.pass;
    } else {
      // Legado: comparar texto simples e migrar para hash
      match = u === stored.user && p === stored.pass;
      if (match) {
        localStorage.setItem('admin_creds', JSON.stringify({ user: stored.user, pass: inputHash, hashed: true }));
      }
    }
  } else {
    // Credenciais padrão nunca alteradas
    const defaultHash = await sha256('1234').catch(() => '1234');
    match = u === 'admin' && (p === '1234' || inputHash === defaultHash);
    if (match) {
      localStorage.setItem('admin_creds', JSON.stringify({ user: 'admin', pass: defaultHash, hashed: true }));
    }
  }

  if (match) {
    clearLockout();
    loginWrap.style.display = 'none';
    document.body.classList.remove('login-page');
    adminLayout.style.display = 'flex';
    startSessionTimer();
    initAdmin();
  } else {
    const l = getLockout() || { count: 0, until: 0 };
    l.count += 1;
    const left = MAX_ATTEMPTS - l.count;
    if (l.count >= MAX_ATTEMPTS) {
      l.until = Date.now() + LOCKOUT_MS;
      setLockout(l);
      showLoginError('Demasiadas tentativas. Conta bloqueada por 5 minutos.');
    } else {
      setLockout(l);
      showLoginError(`Credenciais inválidas. ${left} tentativa${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''}.`);
    }
    loginPassEl.value = '';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', doLogout);

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
    'pagina-inicial': 'Página Inicial',
    galeria: 'Galeria', treinadores: 'Treinadores & Staff',
    agenda: 'Agenda & Eventos', configuracoes: 'Configurações',
  };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
  document.getElementById('sidebar').classList.remove('open');

  if (name === 'facebook') initFacebookPage();
  if (name === 'pagina-inicial') initPaginaInicial();
  if (name === 'galeria') initGaleria();
  if (name === 'treinadores') initTreinadores();
  if (name === 'agenda') initAgenda();
  if (name === 'configuracoes') initConfiguracoes();
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
  // Verificar se ainda usa password padrão → mostrar alerta
  (async function checkDefaultPassword() {
    const stored = JSON.parse(localStorage.getItem('admin_creds') || 'null');
    const defaultHash = await sha256('1234').catch(() => '');
    const isDefault = !stored || (stored.pass === defaultHash) || (!stored.hashed && stored.pass === '1234');
    const alerta = document.getElementById('secAlerta');
    if (alerta) alerta.style.display = isDefault ? 'flex' : 'none';
  })();

  renderDashboard();
  renderInscricoes();
  renderAtletas();
  renderNoticias();
  renderMensagens();
  renderEscaloes();
  renderJogos();
  renderPatrocinadores();

  // novos módulos — inicialização silenciosa para o dashboard funcionar
  if (typeof renderGaleria === 'function')    renderGaleria();
  if (typeof renderTreinadores === 'function') renderTreinadores();
  if (typeof renderAgenda === 'function')     renderAgenda();

  // Date
  document.getElementById('pageDate').textContent =
    new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Badges
  updateBadges();
}

function updateBadges() {
  const pendentes = DB.inscricoes.filter(i => i.estado === 'Pendente').length;
  const naoLidas  = DB.mensagens.filter(m => m.estado === 'Não lida').length;
  const hoje      = new Date();
  const mesAtual  = hoje.getMonth();
  const anoAtual  = hoje.getFullYear();
  const jogosmes  = (DB.jogos || []).filter(j => {
    if (!j.data) return false;
    const d = new Date(j.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).length;

  document.getElementById('badgeInsc').textContent     = pendentes;
  document.getElementById('badgeMsg').textContent       = naoLidas;
  document.getElementById('totalAtletas').textContent   = DB.atletas.filter(a => a.estado === 'Activo').length;
  document.getElementById('inscPendentes').textContent  = pendentes;
  document.getElementById('msgNovos').textContent       = naoLidas;
  document.getElementById('totalJogos').textContent     = jogosmes;
  document.getElementById('totalNoticias').textContent  = (DB.noticias || []).filter(n => n.estado === 'Publicada').length;
  document.getElementById('totalPatrocinadores').textContent = (DB.patrocinadores || []).filter(p => p.ativo).length;
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
  tbody2.innerHTML = DB.mensagens.slice(0, 4).map(m => `
    <tr>
      <td>${m.nome}</td>
      <td>${m.assunto}</td>
      <td>${statusBadge(m.estado)}</td>
    </tr>`).join('');

  // Próximos eventos agenda
  const agendaEl = document.getElementById('dashAgenda');
  if (agendaEl) {
    const proximos = (DB.agenda || [])
      .filter(e => new Date(e.data) >= new Date())
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .slice(0, 4);
    agendaEl.innerHTML = proximos.length ? proximos.map(e => {
      const d = new Date(e.data);
      return `<div class="dash-agenda-item">
        <div class="dash-agenda-date">
          <span>${d.getDate()}</span>
          ${d.toLocaleDateString('pt-PT', { month: 'short' })}
        </div>
        <div class="dash-agenda-info">
          <strong>${e.titulo}</strong>
          <small>${e.hora} · ${e.local}</small>
        </div>
      </div>`;
    }).join('') : '<p style="padding:16px;color:#999;font-size:13px">Sem eventos próximos.</p>';
  }

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
// UTILITÁRIO: UPLOAD DE IMAGEM
// ==================================================
function setupImageUpload(fileInputId, urlInputId, previewId) {
  const fileEl = document.getElementById(fileInputId);
  const urlEl  = document.getElementById(urlInputId);
  const prevEl = document.getElementById(previewId);

  function updatePreview(src) {
    if (!prevEl) return;
    const img = prevEl.querySelector('img');
    if (src) { prevEl.style.display = ''; if (img) img.src = src; }
    else { prevEl.style.display = 'none'; }
  }

  fileEl?.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Imagem demasiado grande (máx 3MB)', 'red');
      this.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      if (urlEl) urlEl.value = ev.target.result;
      updatePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  });

  urlEl?.addEventListener('input', function() { updatePreview(this.value); });
}

// ==================================================
// NOTÍCIAS
// ==================================================
function renderNoticias() {
  const grid = document.getElementById('newsAdminGrid');
  grid.innerHTML = [
    { id: 0, titulo: '+ Nova Notícia', categoria: '', data: '', publicada: null, imagem: null, novo: true },
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
    const imgStyle = n.imagem
      ? `background-image:url('${n.imagem}');background-size:${n.imagemSize||'cover'};background-position:${n.imagemPos||'center'}`
      : '';
    return `
      <div class="news-admin-card">
        <div class="news-admin-img news-admin-img--${n.img || 1}" style="${imgStyle}">
          <span class="news-cat-badge">${n.categoria}</span>
        </div>
        <div class="news-admin-body">
          <div class="news-admin-title">${n.titulo}</div>
          <div class="news-admin-date">${fmtDate(n.data)} · ${n.publicada
            ? '<span style="color:#16a34a;font-weight:700">✓ Publicada</span>'
            : '<span style="color:#d97706;font-weight:700">⏸ Rascunho</span>'}</div>
          ${n.imagem ? `<div style="font-size:11px;color:#888;margin-top:4px">🖼 Com imagem</div>` : ''}
        </div>
        <div class="news-admin-footer">
          <button class="btn-icon" onclick="editNoticia(${n.id})" title="Editar">&#9998;</button>
          <button class="btn-icon btn-icon--red" onclick="removeNoticia(${n.id})" title="Eliminar">&#128465;</button>
        </div>
      </div>`;
  }).join('');
}

function abrirModalNoticia(n = null) {
  const isNew = !n;
  const titulo   = n?.titulo     || '';
  const cat      = n?.categoria  || 'Resultado';
  const data     = n?.data       || new Date().toISOString().split('T')[0];
  const resumo   = n?.resumo     || '';
  const imagem   = n?.imagem     || '';
  const pos      = n?.imagemPos  || 'center';
  const sz       = n?.imagemSize || 'cover';
  const publicada = n?.publicada ?? false;
  const cats = ['Resultado','Seleção','Conquista','Clube','Evento','Formação'];

  openModal(isNew ? 'Nova Notícia' : 'Editar Notícia', `
    <div class="modal-field">
      <label>Título</label>
      <input type="text" class="form-input" id="mTitulo" value="${titulo}" placeholder="Título da notícia" />
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Categoria</label>
        <select class="form-input" id="mCat">
          ${cats.map(c => `<option ${c===cat?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Data</label>
        <input type="date" class="form-input" id="mData" value="${data}" />
      </div>
    </div>
    <div class="modal-field">
      <label>Resumo / Texto</label>
      <textarea class="form-input" id="mResumo" rows="4" placeholder="Texto da notícia...">${resumo}</textarea>
    </div>
    <div class="modal-field">
      <label>Imagem</label>
      <div class="img-upload-box">
        <label class="img-upload-btn" for="mFicheiro">📁 Escolher ficheiro</label>
        <input type="file" id="mFicheiro" accept="image/*" style="display:none">
        <input type="text" class="form-input" id="mImagem" value="${imagem}" placeholder="ou cole URL da imagem..." />
      </div>
      <small style="color:#888;font-size:11px;margin-top:4px;display:block">JPG, PNG, WebP — máx. 3MB</small>
    </div>
    <div id="mImagemPreview" style="margin-top:8px;${imagem?'':'display:none'}">
      <img src="${imagem}" style="max-width:100%;max-height:160px;border-radius:8px;object-fit:cover" onerror="this.parentElement.style.display='none'" />
    </div>
    <div class="modal-row" style="margin-top:8px">
      <div class="modal-field"><label>Posição da imagem</label>
        <select class="form-input" id="mImagemPos">
          <option value="center" ${pos==='center'?'selected':''}>Centro</option>
          <option value="top" ${pos==='top'?'selected':''}>Topo</option>
          <option value="bottom" ${pos==='bottom'?'selected':''}>Baixo</option>
          <option value="left center" ${pos==='left center'?'selected':''}>Esquerda</option>
          <option value="right center" ${pos==='right center'?'selected':''}>Direita</option>
        </select>
      </div>
      <div class="modal-field"><label>Tamanho</label>
        <select class="form-input" id="mImagemSize">
          <option value="cover"   ${sz==='cover'?'selected':''}>Preencher — recortar bordas</option>
          <option value="contain" ${sz==='contain'?'selected':''}>Mostrar tudo — com margens</option>
          <option value="110%"    ${sz==='110%'?'selected':''}>Zoom 110%</option>
          <option value="140%"    ${sz==='140%'?'selected':''}>Zoom 140%</option>
        </select>
      </div>
    </div>
    <div class="modal-field" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="mPublicada" ${publicada?'checked':''} />
        Publicar imediatamente
      </label>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNoticia(${n?.id ?? 'null'})">${isNew ? 'Criar Notícia' : 'Guardar'}</button>`
  );
  setupImageUpload('mFicheiro', 'mImagem', 'mImagemPreview');
}

document.getElementById('btnNovaNoticia')?.addEventListener('click', () => abrirModalNoticia());

window.saveNoticia = function(id) {
  const titulo = document.getElementById('mTitulo').value.trim();
  if (!titulo) { showToast('Introduza o título.', 'red'); return; }
  const dados = {
    titulo,
    categoria:  document.getElementById('mCat').value,
    data:       document.getElementById('mData').value,
    resumo:     document.getElementById('mResumo').value.trim(),
    imagem:     document.getElementById('mImagem').value.trim(),
    imagemPos:  document.getElementById('mImagemPos')?.value  || 'center',
    imagemSize: document.getElementById('mImagemSize')?.value || 'cover',
    publicada:  document.getElementById('mPublicada').checked,
  };
  if (id === null) {
    DB.noticias.unshift({ id: Date.now(), img: Math.ceil(Math.random()*3), ...dados });
    showToast('Notícia criada!', 'green');
  } else {
    const n = DB.noticias.find(x => x.id === id);
    if (n) Object.assign(n, dados);
    showToast('Notícia actualizada!', 'green');
  }
  saveDB(); renderNoticias(); closeModal();
};

// manter retrocompatibilidade
window.saveNovaNoticia = () => window.saveNoticia(null);

window.editNoticia = function (id) {
  const n = DB.noticias.find(x => x.id === id);
  if (!n) return;
  abrirModalNoticia(n);
};

window.removeNoticia = function (id) {
  if (!confirm('Eliminar esta notícia?')) return;
  const idx = DB.noticias.findIndex(x => x.id === id);
  if (idx > -1) DB.noticias.splice(idx, 1);
  saveDB(); renderNoticias();
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
  grid.innerHTML = DB.escaloes.map((e, i) => `
    <div class="escalao-card ${e.destaque ? 'escalao-card--featured' : ''}">
      ${e.destaque ? '<div class="escalao-destaque-badge">⭐ Destaque</div>' : ''}
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
      ${e.descricao ? `<div class="escalao-desc">${e.descricao}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn btn-sm" onclick="editEscalao(${i})" style="flex:1">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteEscalao(${i})">🗑️</button>
      </div>
    </div>`).join('');
}

window.editEscalao = function(idx) {
  const e = idx >= 0 ? DB.escaloes[idx] : {
    nome:'Sub-X', designacao:'', faixa:'', atletas:0,
    treinador:'', treinos:'', descricao:'', destaque:false
  };
  openModal(idx >= 0 ? 'Editar Categoria' : 'Nova Categoria', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome (ex: Sub-13)</label>
        <input class="form-input" id="eNome" value="${e.nome}" /></div>
      <div class="modal-field"><label>Designação (ex: Benjamins)</label>
        <input class="form-input" id="eDesig" value="${e.designacao}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Faixa etária (ex: 12 a 13 anos)</label>
        <input class="form-input" id="eFaixa" value="${e.faixa}" /></div>
      <div class="modal-field"><label>Nº de atletas</label>
        <input class="form-input" type="number" id="eAtletas" value="${e.atletas}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Treinador responsável</label>
        <input class="form-input" id="eTreinador" value="${e.treinador}" /></div>
      <div class="modal-field"><label>Horário de treinos</label>
        <input class="form-input" id="eTreinos" value="${e.treinos}" placeholder="Ex: Seg, Qua e Sex 17h" /></div>
    </div>
    <div class="modal-field"><label>Descrição (aparece no site)</label>
      <textarea class="form-input" id="eDesc" rows="3">${e.descricao || ''}</textarea></div>
    <div class="modal-field" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="eDestaque" ${e.destaque?'checked':''} />
        Marcar como destaque (aparece em evidência no site)
      </label>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="salvarEscalao(${idx})">Guardar</button>`
  );
};

window.salvarEscalao = function(idx) {
  const dados = {
    nome:       document.getElementById('eNome').value.trim(),
    designacao: document.getElementById('eDesig').value.trim(),
    faixa:      document.getElementById('eFaixa').value.trim(),
    atletas:    parseInt(document.getElementById('eAtletas').value) || 0,
    treinador:  document.getElementById('eTreinador').value.trim(),
    treinos:    document.getElementById('eTreinos').value.trim(),
    descricao:  document.getElementById('eDesc').value.trim(),
    destaque:   document.getElementById('eDestaque').checked,
  };
  if (!dados.nome) { showToast('Preencha o nome', 'red'); return; }
  if (idx >= 0) DB.escaloes[idx] = { ...DB.escaloes[idx], ...dados };
  else DB.escaloes.push({ id: Date.now(), ...dados });
  saveDB(); renderEscaloes(); closeModal();
  showToast(idx >= 0 ? 'Categoria atualizada!' : 'Categoria adicionada!', 'green');
};

window.deleteEscalao = function(idx) {
  if (!confirm('Eliminar esta categoria?')) return;
  DB.escaloes.splice(idx, 1);
  saveDB(); renderEscaloes();
  showToast('Categoria eliminada', 'red');
};

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

// =============================================
// PÁGINA INICIAL — editor de conteúdo
// =============================================

const SITE_CONFIG_KEY = 'site_config';

function getSiteConfig() {
  try { return JSON.parse(localStorage.getItem(SITE_CONFIG_KEY) || '{}'); } catch { return {}; }
}
function saveSiteConfig(cfg) {
  try {
    localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(cfg));
  } catch (e) {
    showToast('Erro ao guardar: armazenamento cheio. Remova imagens grandes e tente novamente.', 'red');
    throw e;
  }
}

function loadPaginaInicialForm() {
  const cfg = getSiteConfig();
  const fields = {
    cfgHeroTag: 'heroTag', cfgHeroTitle: 'heroTitle', cfgHeroDesc: 'heroDesc',
    cfgHeroImagem: 'heroImagem', cfgHeroImgPos: 'heroImgPos', cfgHeroOverlay: 'heroOverlay',
    cfgStat1Num: 'stat1Num', cfgStat1Label: 'stat1Label',
    cfgStat2Num: 'stat2Num', cfgStat2Label: 'stat2Label',
    cfgStat3Num: 'stat3Num', cfgStat3Label: 'stat3Label',
    cfgStat4Num: 'stat4Num', cfgStat4Label: 'stat4Label',
    cfgAboutText1: 'aboutText1', cfgAboutText2: 'aboutText2',
    cfgAboutEst: 'aboutEst', cfgAboutMotto: 'aboutMotto',
    cfgContactAddress: 'contactAddress', cfgContactPhone: 'contactPhone',
    cfgContactEmail: 'contactEmail', cfgContactHours: 'contactHours',
    cfgSocialInstagram: 'socialInstagramUrl',
    cfgSocialFacebook: 'socialFacebookUrl',
    cfgSocialWhatsapp: 'socialWhatsappUrl',
  };
  for (const [elId, cfgKey] of Object.entries(fields)) {
    const el = document.getElementById(elId);
    if (el && cfg[cfgKey] !== undefined) el.value = cfg[cfgKey];
  }
  // Mostrar preview se já tem imagem
  if (cfg.heroImagem) {
    const prev = document.getElementById('cfgHeroPreview');
    if (prev) { prev.style.display = ''; prev.querySelector('img').src = cfg.heroImagem; }
  }
}

function guardarPaginaInicial() {
  const cfg = getSiteConfig();
  const fields = {
    cfgHeroTag: 'heroTag', cfgHeroTitle: 'heroTitle', cfgHeroDesc: 'heroDesc',
    cfgHeroImagem: 'heroImagem', cfgHeroImgPos: 'heroImgPos', cfgHeroOverlay: 'heroOverlay',
    cfgStat1Num: 'stat1Num', cfgStat1Label: 'stat1Label',
    cfgStat2Num: 'stat2Num', cfgStat2Label: 'stat2Label',
    cfgStat3Num: 'stat3Num', cfgStat3Label: 'stat3Label',
    cfgStat4Num: 'stat4Num', cfgStat4Label: 'stat4Label',
    cfgAboutText1: 'aboutText1', cfgAboutText2: 'aboutText2',
    cfgAboutEst: 'aboutEst', cfgAboutMotto: 'aboutMotto',
    cfgContactAddress: 'contactAddress', cfgContactPhone: 'contactPhone',
    cfgContactEmail: 'contactEmail', cfgContactHours: 'contactHours',
    cfgSocialInstagram: 'socialInstagramUrl',
    cfgSocialFacebook: 'socialFacebookUrl',
    cfgSocialWhatsapp: 'socialWhatsappUrl',
  };
  for (const [elId, cfgKey] of Object.entries(fields)) {
    const el = document.getElementById(elId);
    if (el) cfg[cfgKey] = el.value.trim();
  }
  try {
    saveSiteConfig(cfg);
    showToast('✓ Alterações guardadas! Abra o site para ver as mudanças.', 'green');
  } catch(_) { /* saveSiteConfig already shows error toast */ }
}

window.removerHeroImagem = function() {
  const cfg = getSiteConfig();
  cfg.heroImagem = '';
  saveSiteConfig(cfg);
  const el = document.getElementById('cfgHeroImagem');
  if (el) el.value = '';
  const prev = document.getElementById('cfgHeroPreview');
  if (prev) prev.style.display = 'none';
  showToast('Imagem de fundo removida.', 'green');
};

function initPaginaInicial() {
  loadPaginaInicialForm();
  setupImageUpload('cfgHeroFicheiro', 'cfgHeroImagem', 'cfgHeroPreview');
}

// =============================================
// GALERIA
// =============================================
let galeriaFiltro = '';

function initGaleria() {
  renderGaleria();
  document.getElementById('btnNovaFoto')?.addEventListener('click', () => editFoto(-1));
  document.querySelectorAll('#galeriaCatFilters .tab-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#galeriaCatFilters .tab-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      galeriaFiltro = btn.dataset.cat;
      renderGaleria();
    });
  });
}

function renderGaleria() {
  const grid = document.getElementById('galeriaAdminGrid');
  if (!grid) return;
  const items = galeriaFiltro
    ? DB.galeria.filter(f => f.categoria === galeriaFiltro)
    : DB.galeria;

  const catIcons = { Treino:'⚽', Jogo:'🏆', Evento:'🎉', Conquista:'🥇' };
  grid.innerHTML = items.length ? items.map((f, i) => `
    <div class="galeria-card">
      <div class="galeria-card__img" ${f.url ? `style="background-image:url('${f.url}')"` : ''}>
        ${!f.url ? `<span>${catIcons[f.categoria] || '📷'}</span>` : ''}
        <span class="galeria-card__cat">${f.categoria}</span>
      </div>
      <div class="galeria-card__body">
        <p class="galeria-card__title">${f.titulo}</p>
        <p class="galeria-card__date">${fmtDate(f.data)}</p>
      </div>
      <div class="galeria-card__actions">
        <button class="btn btn-sm" onclick="editFoto(${DB.galeria.indexOf(f)})">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFoto(${DB.galeria.indexOf(f)})">🗑️</button>
      </div>
    </div>`).join('') :
    '<p style="padding:24px;color:#999;text-align:center">Sem fotos nesta categoria.</p>';
}

function editFoto(idx) {
  const f = idx >= 0 ? DB.galeria[idx] : { titulo:'', categoria:'Treino', data:'', url:'', descricao:'', imgPos:'center', imgSize:'cover' };
  const pos = f.imgPos  || 'center';
  const sz  = f.imgSize || 'cover';
  openModal(idx >= 0 ? 'Editar Foto' : 'Adicionar Foto', `
    <div class="modal-row">
      <div class="modal-field"><label>Título</label>
        <input class="form-input" id="mFotoTitulo" value="${f.titulo}" /></div>
      <div class="modal-field"><label>Categoria</label>
        <select class="form-input" id="mFotoCat">
          ${['Treino','Jogo','Evento','Conquista'].map(c => `<option ${f.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
    </div>
    <div class="modal-field"><label>Data</label>
      <input class="form-input" type="date" id="mFotoData" value="${f.data}" /></div>
    <div class="modal-field">
      <label>Imagem</label>
      <div class="img-upload-box">
        <label class="img-upload-btn" for="mFotoFicheiro">📁 Escolher ficheiro</label>
        <input type="file" id="mFotoFicheiro" accept="image/*" style="display:none">
        <input class="form-input" type="text" id="mFotoUrl" placeholder="ou cole URL da imagem..." value="${f.url}" />
      </div>
      <small style="color:#888;font-size:11px;margin-top:4px;display:block">JPG, PNG, WebP — máx. 3MB</small>
    </div>
    <div id="mFotoPreview" style="margin-top:8px;${f.url?'':'display:none'}">
      <img src="${f.url}" style="max-width:100%;max-height:160px;border-radius:8px;object-fit:cover" onerror="this.parentElement.style.display='none'" />
    </div>
    <div class="modal-row" style="margin-top:8px">
      <div class="modal-field"><label>Posição</label>
        <select class="form-input" id="mFotoPos">
          <option value="center" ${pos==='center'?'selected':''}>Centro</option>
          <option value="top" ${pos==='top'?'selected':''}>Topo</option>
          <option value="bottom" ${pos==='bottom'?'selected':''}>Baixo</option>
          <option value="left center" ${pos==='left center'?'selected':''}>Esquerda</option>
          <option value="right center" ${pos==='right center'?'selected':''}>Direita</option>
        </select>
      </div>
      <div class="modal-field"><label>Tamanho</label>
        <select class="form-input" id="mFotoSize">
          <option value="cover"   ${sz==='cover'?'selected':''}>Preencher — recortar bordas</option>
          <option value="contain" ${sz==='contain'?'selected':''}>Mostrar tudo — com margens</option>
          <option value="110%"    ${sz==='110%'?'selected':''}>Zoom 110%</option>
          <option value="140%"    ${sz==='140%'?'selected':''}>Zoom 140%</option>
        </select>
      </div>
    </div>
    <div class="modal-field"><label>Descrição</label>
      <textarea class="form-input" id="mFotoDesc" rows="2">${f.descricao}</textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarFoto(${idx})">Guardar</button>`);
  setupImageUpload('mFotoFicheiro', 'mFotoUrl', 'mFotoPreview');
}

function salvarFoto(idx) {
  const item = {
    titulo:    document.getElementById('mFotoTitulo').value.trim(),
    categoria: document.getElementById('mFotoCat').value,
    data:      document.getElementById('mFotoData').value,
    url:       document.getElementById('mFotoUrl').value.trim(),
    imgPos:    document.getElementById('mFotoPos')?.value  || 'center',
    imgSize:   document.getElementById('mFotoSize')?.value || 'cover',
    descricao: document.getElementById('mFotoDesc').value.trim(),
  };
  if (!item.titulo) { showToast('Preencha o título', 'red'); return; }
  if (idx >= 0) DB.galeria[idx] = { ...DB.galeria[idx], ...item };
  else DB.galeria.unshift({ id: Date.now(), ...item });
  closeModal(); renderGaleria();
  showToast(idx >= 0 ? 'Foto atualizada' : 'Foto adicionada', 'green');
}

function deleteFoto(idx) {
  if (!confirm('Remover esta foto?')) return;
  DB.galeria.splice(idx, 1);
  renderGaleria();
  showToast('Foto removida', 'green');
}

// =============================================
// TREINADORES / STAFF
// =============================================
function initTreinadores() {
  renderTreinadores();
  document.getElementById('btnNovoTreinador')?.addEventListener('click', () => editTreinador(-1));
}

function renderTreinadores() {
  const grid = document.getElementById('staffGrid');
  if (!grid) return;
  grid.innerHTML = DB.treinadores.map((t, i) => {
    const iniciais = t.nome.split(' ').map(n => n[0]).slice(0,2).join('');
    return `<div class="staff-card ${t.ativo ? '' : 'inactive'}">
      <div class="staff-avatar">${iniciais}</div>
      <div class="staff-info">
        <p class="staff-name">${t.nome} ${t.ativo ? '' : '<span style="font-size:11px;color:#999">(inactivo)</span>'}</p>
        <p class="staff-cargo">${t.cargo}</p>
        <p class="staff-meta">📋 ${t.escalao} · Desde ${t.desde}</p>
        <p class="staff-meta">📞 ${t.telefone}</p>
        <div class="staff-actions">
          <button class="btn btn-sm" onclick="editTreinador(${i})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTreinador(${i})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function editTreinador(idx) {
  const t = idx >= 0 ? DB.treinadores[idx] : { nome:'', cargo:'', escalao:'Todos', telefone:'', email:'', desde:'2026', ativo:true };
  openModal(idx >= 0 ? 'Editar Membro' : 'Novo Membro', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome completo</label>
        <input class="form-input" id="mTNome" value="${t.nome}" /></div>
      <div class="modal-field"><label>Cargo</label>
        <input class="form-input" id="mTCargo" value="${t.cargo}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mTEscalao">
          ${['Todos','Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19'].map(e => `<option ${t.escalao===e?'selected':''}>${e}</option>`).join('')}
        </select></div>
      <div class="modal-field"><label>Desde (ano)</label>
        <input class="form-input" id="mTDesde" value="${t.desde}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Telefone</label>
        <input class="form-input" id="mTTel" value="${t.telefone}" /></div>
      <div class="modal-field"><label>E-mail</label>
        <input class="form-input" id="mTEmail" value="${t.email}" /></div>
    </div>
    <div class="modal-field"><label>Estado</label>
      <select class="form-input" id="mTAtivo">
        <option value="1" ${t.ativo?'selected':''}>Activo</option>
        <option value="0" ${!t.ativo?'selected':''}>Inactivo</option>
      </select></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarTreinador(${idx})">Guardar</button>`);
}

function salvarTreinador(idx) {
  const item = {
    nome: document.getElementById('mTNome').value.trim(),
    cargo: document.getElementById('mTCargo').value.trim(),
    escalao: document.getElementById('mTEscalao').value,
    desde: document.getElementById('mTDesde').value.trim(),
    telefone: document.getElementById('mTTel').value.trim(),
    email: document.getElementById('mTEmail').value.trim(),
    ativo: document.getElementById('mTAtivo').value === '1',
  };
  if (!item.nome) { showToast('Preencha o nome', 'red'); return; }
  if (idx >= 0) DB.treinadores[idx] = { ...DB.treinadores[idx], ...item };
  else DB.treinadores.unshift({ id: Date.now(), ...item });
  closeModal(); renderTreinadores();
  showToast(idx >= 0 ? 'Membro atualizado' : 'Membro adicionado', 'green');
}

function deleteTreinador(idx) {
  if (!confirm('Remover este membro?')) return;
  DB.treinadores.splice(idx, 1);
  renderTreinadores();
  showToast('Membro removido', 'green');
}

// =============================================
// AGENDA / EVENTOS
// =============================================
function initAgenda() {
  renderAgenda();
  document.getElementById('btnNovoEvento')?.addEventListener('click', () => editEvento(-1));
  document.getElementById('filterAgendaTipo')?.addEventListener('change', renderAgenda);
  document.getElementById('filterAgendaEscalao')?.addEventListener('change', renderAgenda);
}

function renderAgenda() {
  const list = document.getElementById('agendaList');
  if (!list) return;
  const tipo    = document.getElementById('filterAgendaTipo')?.value || '';
  const escalao = document.getElementById('filterAgendaEscalao')?.value || '';

  let items = [...(DB.agenda || [])].sort((a, b) => new Date(a.data) - new Date(b.data));
  if (tipo)    items = items.filter(e => e.tipo === tipo);
  if (escalao) items = items.filter(e => e.escalao === escalao || e.escalao === 'Todos');

  list.innerHTML = items.length ? items.map((e, i) => {
    const d = new Date(e.data);
    const passado = d < new Date();
    return `<div class="agenda-list-item" style="${passado ? 'opacity:0.6' : ''}">
      <div class="agenda-date-box">
        <span class="day">${d.getDate()}</span>
        <span class="month">${d.toLocaleDateString('pt-PT',{month:'short'})}</span>
        <span class="time">${e.hora}</span>
      </div>
      <div class="agenda-body">
        <span class="agenda-tipo-badge ${e.tipo}">${e.tipo}</span>
        <p class="agenda-title">${e.titulo}</p>
        <p class="agenda-meta">📍 ${e.local} · 👥 ${e.escalao}</p>
        ${e.descricao ? `<p class="agenda-meta">${e.descricao}</p>` : ''}
        <div class="agenda-actions">
          <button class="btn btn-sm" onclick="editEvento(${DB.agenda.indexOf(e)})">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEvento(${DB.agenda.indexOf(e)})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('') : '<p style="padding:24px;color:#999;text-align:center">Sem eventos.</p>';
}

function editEvento(idx) {
  const e = idx >= 0 ? DB.agenda[idx] : { titulo:'', tipo:'Jogo', escalao:'Todos', data:'', hora:'', local:'', descricao:'', estado:'Agendado' };
  openModal(idx >= 0 ? 'Editar Evento' : 'Novo Evento', `
    <div class="modal-field"><label>Título</label>
      <input class="form-input" id="mEvTitulo" value="${e.titulo}" /></div>
    <div class="modal-row">
      <div class="modal-field"><label>Tipo</label>
        <select class="form-input" id="mEvTipo">
          ${['Jogo','Torneio','Treino','Reunião','Outro'].map(t => `<option ${e.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mEvEscalao">
          ${['Todos','Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19'].map(s => `<option ${e.escalao===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Data</label>
        <input class="form-input" type="date" id="mEvData" value="${e.data}" /></div>
      <div class="modal-field"><label>Hora</label>
        <input class="form-input" type="time" id="mEvHora" value="${e.hora}" /></div>
    </div>
    <div class="modal-field"><label>Local</label>
      <input class="form-input" id="mEvLocal" value="${e.local}" /></div>
    <div class="modal-field"><label>Descrição</label>
      <textarea class="form-input" id="mEvDesc" rows="2">${e.descricao}</textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarEvento(${idx})">Guardar</button>`);
}

function salvarEvento(idx) {
  const item = {
    titulo: document.getElementById('mEvTitulo').value.trim(),
    tipo: document.getElementById('mEvTipo').value,
    escalao: document.getElementById('mEvEscalao').value,
    data: document.getElementById('mEvData').value,
    hora: document.getElementById('mEvHora').value,
    local: document.getElementById('mEvLocal').value.trim(),
    descricao: document.getElementById('mEvDesc').value.trim(),
    estado: 'Agendado',
  };
  if (!item.titulo || !item.data) { showToast('Preencha título e data', 'red'); return; }
  if (idx >= 0) DB.agenda[idx] = { ...DB.agenda[idx], ...item };
  else DB.agenda.unshift({ id: Date.now(), ...item });
  closeModal(); renderAgenda();
  showToast(idx >= 0 ? 'Evento atualizado' : 'Evento adicionado', 'green');
}

function deleteEvento(idx) {
  if (!confirm('Remover este evento?')) return;
  DB.agenda.splice(idx, 1);
  renderAgenda();
  showToast('Evento removido', 'green');
}

// =============================================
// CONFIGURAÇÕES
// =============================================
function initConfiguracoes() {
  // Carregar credenciais guardadas
  const creds = JSON.parse(localStorage.getItem('admin_creds') || '{}');
  if (creds.user) document.getElementById('cfgAdminUser').value = creds.user;

  // Carregar cores guardadas
  const cores = JSON.parse(localStorage.getItem('site_cores') || '{}');
  if (cores.azul)    document.getElementById('cfgCorAzul').value    = cores.azul;
  if (cores.amarelo) document.getElementById('cfgCorAmarelo').value = cores.amarelo;

  // Carregar dados do clube
  const clube = JSON.parse(localStorage.getItem('dados_clube') || '{}');
  if (clube.nome)    document.getElementById('cfgClubNome').value    = clube.nome;
  if (clube.sigla)   document.getElementById('cfgClubSigla').value   = clube.sigla;
  if (clube.ano)     document.getElementById('cfgClubAno').value     = clube.ano;
  if (clube.estadio) document.getElementById('cfgClubEstadio').value = clube.estadio;
}

async function guardarSeguranca() {
  const user = document.getElementById('cfgAdminUser').value.trim();
  const pw   = document.getElementById('cfgAdminPw').value;
  const conf = document.getElementById('cfgAdminPwConf').value;
  if (!user) { showToast('Introduza o nome de utilizador', 'red'); return; }
  if (pw && pw.length < 6) { showToast('A palavra-passe deve ter pelo menos 6 caracteres', 'red'); return; }
  if (pw && pw !== conf)   { showToast('As palavras-passe não coincidem', 'red'); return; }

  const existing = JSON.parse(localStorage.getItem('admin_creds') || 'null');
  let passHash = existing?.pass || null;

  if (pw) {
    try { passHash = await sha256(pw); } catch(_) { passHash = pw; }
  }
  if (!passHash) {
    showToast('Introduza uma palavra-passe', 'red'); return;
  }

  localStorage.setItem('admin_creds', JSON.stringify({ user, pass: passHash, hashed: true }));
  document.getElementById('cfgAdminPw').value = '';
  document.getElementById('cfgAdminPwConf').value = '';

  // Esconder aviso de password padrão se existir
  const alerta = document.getElementById('secAlerta');
  if (alerta) alerta.style.display = 'none';

  showToast('✓ Credenciais guardadas com segurança (SHA-256)', 'green');
}

function guardarDadosClube() {
  const clube = {
    nome:    document.getElementById('cfgClubNome').value.trim(),
    sigla:   document.getElementById('cfgClubSigla').value.trim(),
    ano:     document.getElementById('cfgClubAno').value.trim(),
    estadio: document.getElementById('cfgClubEstadio').value.trim(),
  };
  localStorage.setItem('dados_clube', JSON.stringify(clube));
  showToast('Dados do clube guardados', 'green');
}

function guardarAparencia() {
  const azul    = document.getElementById('cfgCorAzul').value;
  const amarelo = document.getElementById('cfgCorAmarelo').value;
  localStorage.setItem('site_cores', JSON.stringify({ azul, amarelo }));
  document.documentElement.style.setProperty('--primary', azul);
  document.documentElement.style.setProperty('--yellow', amarelo);
  showToast('Cores aplicadas! Atualize o site para ver as mudanças.', 'green');
}

function resetarCores() {
  localStorage.removeItem('site_cores');
  document.getElementById('cfgCorAzul').value    = '#003B8E';
  document.getElementById('cfgCorAmarelo').value = '#FFD100';
  document.documentElement.style.removeProperty('--primary');
  document.documentElement.style.removeProperty('--yellow');
  showToast('Cores originais restauradas', 'green');
}

function exportarDados() {
  const dados = {
    exportadoEm: new Date().toISOString(),
    inscricoes:   DB.inscricoes,
    atletas:      DB.atletas,
    noticias:     DB.noticias,
    mensagens:    DB.mensagens,
    escaloes:     DB.escaloes,
    jogos:        DB.jogos,
    patrocinadores: DB.patrocinadores,
    galeria:      DB.galeria,
    treinadores:  DB.treinadores,
    agenda:       DB.agenda,
    siteConfig:   JSON.parse(localStorage.getItem('site_config') || '{}'),
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `backup-jscampinense-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('Backup exportado com sucesso', 'green');
}

function importarDados() {
  document.getElementById('importBackupFile').click();
}

function processarImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const dados = JSON.parse(ev.target.result);
      if (dados.inscricoes)     DB.inscricoes     = dados.inscricoes;
      if (dados.atletas)        DB.atletas        = dados.atletas;
      if (dados.noticias)       DB.noticias       = dados.noticias;
      if (dados.mensagens)      DB.mensagens      = dados.mensagens;
      if (dados.jogos)          DB.jogos          = dados.jogos;
      if (dados.patrocinadores) DB.patrocinadores = dados.patrocinadores;
      if (dados.galeria)        DB.galeria        = dados.galeria;
      if (dados.treinadores)    DB.treinadores    = dados.treinadores;
      if (dados.agenda)         DB.agenda         = dados.agenda;
      if (dados.siteConfig)     localStorage.setItem('site_config', JSON.stringify(dados.siteConfig));
      showToast('✓ Backup importado com sucesso! Recarregue a página.', 'green');
    } catch {
      showToast('Ficheiro inválido', 'red');
    }
  };
  reader.readAsText(file);
}
