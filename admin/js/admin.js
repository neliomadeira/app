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

// ---- ZEROZERO BOOKMARKLET MESSAGE RECEIVER ----
// Receives data sent by the bookmarklet running on the ZeroZero page
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'jsc-zz-import') return;
  const text = e.data.text || '';
  if (!text.trim()) return;
  // Fill whichever import textarea is currently visible
  const formTA = document.getElementById('formacaoImportTA');
  const senTA  = document.getElementById('senioresImportTA');
  if (formTA && document.getElementById('formacaoImportModal')?.style.display !== 'none') {
    formTA.value = text;
    if (typeof previewFormacaoImport === 'function') previewFormacaoImport();
  } else if (senTA && document.getElementById('senioresImportModal')?.style.display !== 'none') {
    senTA.value = text;
    if (typeof previewSenioresImport === 'function') previewSenioresImport();
  } else {
    // No modal open — store for next paste
    window._zzBookmarkletData = text;
    showToast('Dados ZeroZero recebidos — abre o modal de importação e clica Pré-visualizar.', 'green');
  }
});

// ---- ZEROZERO BOOKMARKLET HREF ----
// Built at runtime so the postMessage origin matches wherever the admin is hosted.
(function() {
  const adminOrigin = window.location.origin;
  // Bookmarklet script — extracts players from any ZeroZero plantel page.
  // Sends data back to the admin window via postMessage, or copies to clipboard as fallback.
  const bm = `(function(){
var GRUPOS={'guarda-redes':'Guarda-Redes','guarda redes':'Guarda-Redes','defesas':'Defesa','defesa':'Defesa','édios':'Médio','médio':'Médio','meios':'Médio','meio':'Médio','avançados':'Avançado','avançado':'Avançado','pontas de lança':'Avançado'};
var lines=[],seen={},grupo='';
var reDateTitle=/\\d{1,2}[\\s\\/\\.][a-zà-ÿ]{3}/i;
document.querySelectorAll('tr').forEach(function(tr){
  var rowTxt=tr.textContent.replace(/\\s+/g,' ').trim();
  var rowLow=rowTxt.toLowerCase();
  for(var k in GRUPOS){if(rowLow===k||rowLow.startsWith(k+'\\n')){grupo=GRUPOS[k];lines.push(grupo);return;}}
  var cells=Array.from(tr.querySelectorAll('td'));
  if(!cells.length)return;
  var birth='',name='';
  cells.forEach(function(td){
    var title=td.getAttribute('title')||td.getAttribute('data-birth')||'';
    if(title&&reDateTitle.test(title)&&!birth)birth=title;
    var t=td.textContent.replace(/\\s+/g,' ').trim();
    if(!name&&t.length>3&&!/^\\d+$/.test(t)&&!/^[A-Z]{2,3}$/.test(t)&&/[a-zà-ÿ]/.test(t))name=t;
  });
  if(name&&!seen[name.toLowerCase()]){
    seen[name.toLowerCase()]=1;
    if(grupo){lines.push(grupo);grupo='';}
    lines.push(name);
    if(birth)lines.push(birth);
  }
});
var out=lines.join('\\n');
var n=Object.keys(seen).length;
if(!n){alert('Nenhum jogador encontrado. Garante que estás no separador Plantel do ZeroZero.');return;}
var nd=lines.filter(function(l){return reDateTitle.test(l);}).length;
if(window.opener&&!window.opener.closed){
  try{window.opener.postMessage({type:'jsc-zz-import',text:out},'${adminOrigin}');
  alert('✓ '+n+' jogadores enviados ('+nd+' com data de nascimento).\\nFecha esta aba e volta ao admin.');return;}catch(e){}
}
(navigator.clipboard?navigator.clipboard.writeText(out):Promise.reject()).then(function(){
  alert('✓ '+n+' jogadores copiados ('+nd+' com data).\\nVolta ao admin → cola na caixa → Pré-visualizar.');
}).catch(function(){
  var ta=document.createElement('textarea');
  ta.style.cssText='position:fixed;top:0;left:0;width:90vw;height:40vh;z-index:999999;background:#fff;padding:8px;font-size:11px';
  ta.value=out;document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');alert('Copiado! Volta ao admin e cola.');}catch(e){alert('Seleciona o texto e copia manualmente.');}
});
})();`;

  const href = 'javascript:' + encodeURIComponent(bm);
  document.querySelectorAll('#zzBookmarklet, #zzBookmarkletSen').forEach(function(a) {
    a.href = href;
    a.addEventListener('click', function(e) { e.preventDefault(); alert('Arrasta este botão para a barra de favoritos do teu browser (não cliques — arrasta!).'); });
  });
})();

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
    historia: 'História do Clube',
    'pagina-inicial': 'Página Inicial',
    galeria: 'Galeria', videos: 'Vídeos', treinadores: 'Treinadores & Staff',
    agenda: 'Agenda & Eventos', modalidades: 'Modalidades',
    seniores: 'Equipa Sénior', configuracoes: 'Configurações',
    formacao: 'Futebol Formação',
  };
  document.getElementById('topbarTitle').textContent = titles[name] || name;
  document.getElementById('sidebar').classList.remove('open');

  if (name === 'noticias') renderNoticias();
  if (name === 'facebook') initFacebookPage();
  if (name === 'historia') initHistoria();
  if (name === 'pagina-inicial') initPaginaInicial();
  if (name === 'galeria') initGaleria();
  if (name === 'videos')  initVideosAdmin();
  if (name === 'treinadores') initTreinadores();
  if (name === 'agenda') initAgenda();
  if (name === 'modalidades') initModalidades();
  if (name === 'seniores') initSeniores();
  if (name === 'formacao') initFormacao();
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

function closeModal() {
  modalOverlay.style.display = 'none';
  if (window._noticiaDraftTimer) { clearInterval(window._noticiaDraftTimer); window._noticiaDraftTimer = null; }
}

document.getElementById('modalClose')?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// Ctrl+S / Cmd+S saves the open modal
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    if (modalOverlay?.style.display !== 'none') {
      e.preventDefault();
      modalFooter?.querySelector('.btn-save')?.click();
    }
  }
});

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
  // Persistir dados padrão se ainda não existem no localStorage
  // Inicializar noticias se ainda não existem
  if (!localStorage.getItem(NEWS_KEY)) saveNoticias([]);

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
  if (typeof renderGaleria === 'function')      renderGaleria();
  if (typeof renderTreinadores === 'function')  renderTreinadores();
  if (typeof renderAgenda === 'function')       renderAgenda();
  if (typeof renderModalidades === 'function')  renderModalidades();

  // Date
  document.getElementById('pageDate').textContent =
    new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Populate static escalão selects from DB.escaloes
  _refreshEscalaoSelects();

  // Badges
  updateBadges();

  // Puxar inscrições/mensagens novas da base de dados do servidor
  if (typeof sincronizarRegistosServidor === 'function') sincronizarRegistosServidor();
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
  document.getElementById('totalNoticias').textContent  = loadNoticias().filter(n => n.publicada).length;
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

window.exportarInscricoesCSV = function () {
  const escalao = document.getElementById('filterInscEscalao')?.value || '';
  const estado  = document.getElementById('filterInscEstado')?.value  || '';
  let data = DB.inscricoes;
  if (escalao) data = data.filter(i => i.escalao === escalao);
  if (estado)  data = data.filter(i => i.estado  === estado);

  const cols = ['id','nome','escalao','idade','posicao','pref','altura','peso',
                 'nomeResp','telefone','email','modalidade','nivel','data','estado'];
  const labels = ['ID','Nome','Escalão','Idade','Posição','Pé preferido','Altura (cm)','Peso (kg)',
                   'Encarregado','Telefone','E-mail','Modalidade','Nível','Data inscrição','Estado'];

  function esc(val) {
    const s = val == null ? '' : String(val);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  }

  const rows = [labels.join(',')];
  data.forEach(i => rows.push(cols.map(c => esc(i[c])).join(',')));

  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = new Date().toISOString().slice(0,10);
  const suf  = [escalao, estado].filter(Boolean).join('_') || 'todos';
  a.href     = url;
  a.download = `inscricoes_${suf}_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`✓ ${data.length} inscrição(ões) exportada(s)`, 'green');
};

window.verInscricao = function (id) {
  const i = DB.inscricoes.find(x => x.id === id);
  if (!i) return;
  openModal(`Inscrição — ${i.nome}`, `
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-item__label">Nome</span><span class="detail-item__val">${i.nome}</span></div>
      ${i.modalidade ? `<div class="detail-item"><span class="detail-item__label">Modalidade</span><span class="detail-item__val">${i.modalidade}</span></div>` : ''}
      <div class="detail-item"><span class="detail-item__label">Escalão</span><span class="detail-item__val">${i.escalao}</span></div>
      ${i.nivel && i.nivel !== '—' ? `<div class="detail-item"><span class="detail-item__label">Nível</span><span class="detail-item__val">${i.nivel}</span></div>` : ''}
      <div class="detail-item"><span class="detail-item__label">Idade</span><span class="detail-item__val">${i.idade} anos</span></div>
      <div class="detail-item"><span class="detail-item__label">Posição</span><span class="detail-item__val">${i.posicao || '—'}</span></div>
      ${i.pref && i.pref !== '—' ? `<div class="detail-item"><span class="detail-item__label">Pé preferido</span><span class="detail-item__val">${i.pref}</span></div>` : ''}
      ${i.altura && i.altura !== '—' ? `<div class="detail-item"><span class="detail-item__label">Altura / Peso</span><span class="detail-item__val">${i.altura} cm / ${i.peso || '—'} kg</span></div>` : ''}
      ${i.nomeResp && i.nomeResp !== '—' ? `<div class="detail-item"><span class="detail-item__label">Encarregado</span><span class="detail-item__val">${i.nomeResp}</span></div>` : ''}
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
  _regPush('inscricao', i.id, 'Aprovado');
  if (!DB.atletas.find(a => a.nome === i.nome)) {
    DB.atletas.push({
      id: DB.atletas.length + 1, nome: i.nome, escalao: i.escalao,
      posicao: i.posicao, idade: i.idade, encarregado: i.nomeResp || '—',
      telefone: i.telefone, estado: 'Activo'
    });
  }
  saveDB();
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
  _regPush('inscricao', i.id, 'Rejeitado');
  saveDB();
  renderInscricoes();
  renderDashboard();
  updateBadges();
  showToast('Inscrição rejeitada.', 'red');
};

// ==================================================
// ATLETAS
// ==================================================
function calcIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const n    = new Date(dataNascimento + 'T00:00:00');
  let idade  = hoje.getFullYear() - n.getFullYear();
  if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) idade--;
  return idade;
}

function fmtNasc(dataNascimento) {
  if (!dataNascimento) return '—';
  const d = new Date(dataNascimento + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _atletaAvatar(a) {
  if (a.foto) return `<img src="${a.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" />`;
  const initials = a.nome.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();
  return `<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">${initials}</div>`;
}

let _atletaEscalaoFiltro = '';

function renderAtletas(query = '') {
  const tbody = document.querySelector('#atletasTable tbody');
  let data = DB.atletas;
  if (_atletaEscalaoFiltro) data = data.filter(a => a.escalao === _atletaEscalaoFiltro);
  if (query) data = data.filter(a => a.nome.toLowerCase().includes(query.toLowerCase()));

  const hoje = new Date();
  tbody.innerHTML = data.map(a => {
    const idade = calcIdade(a.dataNascimento);
    const nasc  = a.dataNascimento ? new Date(a.dataNascimento + 'T00:00:00') : null;
    const isAniversario = nasc && nasc.getDate() === hoje.getDate() && nasc.getMonth() === hoje.getMonth();
    return `<tr${isAniversario ? ' style="background:#fffbeb"' : ''}>
      <td style="padding:6px 8px">${_atletaAvatar(a)}</td>
      <td><strong>${a.nome}</strong>${isAniversario ? ' 🎂' : ''}</td>
      <td>${a.escalao}</td>
      <td>${a.posicao || '—'}</td>
      <td>${fmtNasc(a.dataNascimento)}${idade !== null ? ` <small style="color:#888">(${idade} anos)</small>` : ''}</td>
      <td>${a.encarregado}</td>
      <td>${statusBadge(a.estado)}</td>
      <td>
        <div class="btn-actions">
          <button class="btn-icon" onclick="editAtleta(${a.id})" title="Editar">&#9998;</button>
          <button class="btn-icon btn-icon--red" onclick="removeAtleta(${a.id})" title="Remover">&#128465;</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

document.getElementById('searchAtleta')?.addEventListener('input', function () {
  renderAtletas(this.value);
});

document.getElementById('atletasEscalaoTabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.tab-filter');
  if (!btn) return;
  document.querySelectorAll('#atletasEscalaoTabs .tab-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _atletaEscalaoFiltro = btn.dataset.escalao;
  renderAtletas(document.getElementById('searchAtleta').value);
});

document.getElementById('btnNovoAtleta')?.addEventListener('click', () => {
  openModal('Novo Atleta', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome completo</label><input type="text" class="form-input" id="mNome" placeholder="Nome do atleta" /></div>
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mEscalao">${_escOpts('')}</select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Posição</label>
        <select class="form-input" id="mPosicao">
          <option value="">—</option>
          <option>Guarda-redes</option><option>Defesa Direito</option><option>Defesa Esquerdo</option>
          <option>Central</option><option>Médio Defensivo</option><option>Médio</option>
          <option>Extremo</option><option>Avançado</option>
        </select>
      </div>
      <div class="modal-field"><label>Data de Nascimento</label>
        <input type="date" class="form-input" id="mDataNasc" />
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Encarregado</label><input type="text" class="form-input" id="mEnc" placeholder="Nome do encarregado" /></div>
      <div class="modal-field"><label>Telefone</label><input type="tel" class="form-input" id="mTel" placeholder="+351 9XX XXX XXX" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Nº Camisola</label><input type="number" class="form-input" id="mNumero" min="1" max="99" placeholder="—" /></div>
    </div>
    ${_fotoModalHTML()}`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNovoAtleta()">Guardar</button>`
  );
});

function _fotoModalHTML(fotoAtual = '') {
  return `<div class="modal-field">
    <label>Foto</label>
    <input type="hidden" id="mFoto" value="${fotoAtual}" />
    <input type="file" id="mFotoFile" accept="image/*" style="display:none" onchange="handleAtletaFoto(this,'mFoto','mFotoPreview')" />
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
      <button type="button" class="btn-sm" onclick="document.getElementById('mFotoFile').click()">&#128190; Ficheiro</button>
      <button type="button" class="btn-sm" onclick="colarFotoClipboard()" title="Copiar imagem no FPF → colar aqui">&#128203; Colar (Ctrl+V)</button>
      <span style="font-size:0.78rem;color:#888">Clique direito na foto do FPF → Copiar imagem → Colar aqui</span>
    </div>
    <div id="mFotoPreview" style="${fotoAtual ? 'display:flex;align-items:center' : 'display:none'};margin-top:4px;gap:10px">
      <img src="${fotoAtual}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--blue)" />
      <button type="button" class="btn-sm btn-icon--red" onclick="clearAtletaFoto('mFoto','mFotoPreview')">&#10005; Remover</button>
    </div>
  </div>`;
}

function _setAtletaFotoB64(b64) {
  document.getElementById('mFoto').value = b64;
  const prev = document.getElementById('mFotoPreview');
  prev.querySelector('img').src = b64;
  prev.style.display = 'flex';
  prev.style.alignItems = 'center';
  prev.style.gap = '10px';
}

window.colarFotoClipboard = async function () {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imgType = item.types.find(t => t.startsWith('image/'));
      if (imgType) {
        const blob = await item.getType(imgType);
        const file = new File([blob], 'foto.jpg', { type: imgType });
        compressImage(file, b64 => _setAtletaFotoB64(b64));
        return;
      }
    }
    showToast('Nenhuma imagem na área de transferência. Clique direito na foto → Copiar imagem.', 'red');
  } catch {
    showToast('Sem permissão para ler a área de transferência. Use Ctrl+V na zona da foto.', 'red');
  }
};

// Ctrl+V paste na área do modal
document.addEventListener('paste', function (e) {
  if (!document.getElementById('mFoto')) return; // modal não está aberto
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) compressImage(file, b64 => _setAtletaFotoB64(b64));
      return;
    }
  }
});

window.handleAtletaFoto = function(input, hiddenId, previewId) {
  const file = input.files[0];
  if (!file) return;
  compressImage(file, b64 => {
    document.getElementById(hiddenId).value = b64;
    const prev = document.getElementById(previewId);
    prev.querySelector('img').src = b64;
    prev.style.display = 'flex';
    prev.style.alignItems = 'center';
  });
};

window.clearAtletaFoto = function(hiddenId, previewId) {
  document.getElementById(hiddenId).value = '';
  const prev = document.getElementById(previewId);
  prev.querySelector('img').src = '';
  prev.style.display = 'none';
};

window.saveNovoAtleta = function () {
  const nome = document.getElementById('mNome').value.trim();
  if (!nome) { showToast('Introduza o nome do atleta.', 'red'); return; }
  DB.atletas.push({
    id: Date.now(),
    nome,
    escalao:        document.getElementById('mEscalao').value,
    posicao:        document.getElementById('mPosicao').value,
    dataNascimento: document.getElementById('mDataNasc').value || '',
    encarregado:    document.getElementById('mEnc').value || '—',
    telefone:       document.getElementById('mTel').value,
    foto:           document.getElementById('mFoto')?.value || '',
    numero:         parseInt(document.getElementById('mNumero')?.value) || '',
    estado: 'Activo'
  });
  saveDB();
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
      <div class="modal-field"><label>Nome completo</label>
        <input type="text" class="form-input" id="mNome" value="${a.nome}" />
      </div>
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mEscalao">${_escOpts(a.escalao)}</select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Posição</label>
        <select class="form-input" id="mPosicao">
          ${['—','Guarda-redes','Defesa Direito','Defesa Esquerdo','Central','Médio Defensivo','Médio','Extremo','Avançado'].map(p =>
            `<option${(p===(a.posicao||'—'))?' selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Data de Nascimento</label>
        <input type="date" class="form-input" id="mDataNasc" value="${a.dataNascimento || ''}" />
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Encarregado</label>
        <input type="text" class="form-input" id="mEnc" value="${a.encarregado || ''}" />
      </div>
      <div class="modal-field"><label>Estado</label>
        <select class="form-input" id="mEstado">
          <option${a.estado==='Activo'?' selected':''}>Activo</option>
          <option${a.estado==='Inactivo'?' selected':''}>Inactivo</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Nº Camisola</label>
        <input type="number" class="form-input" id="mNumero" min="1" max="99" value="${a.numero || ''}" placeholder="—" />
      </div>
    </div>
    ${_fotoModalHTML(a.foto)}`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveEditAtleta(${id})">Guardar</button>`
  );
};

window.saveEditAtleta = function (id) {
  const a = DB.atletas.find(x => x.id === id);
  if (!a) return;
  a.nome           = document.getElementById('mNome').value.trim()    || a.nome;
  a.escalao        = document.getElementById('mEscalao').value;
  a.posicao        = document.getElementById('mPosicao').value === '—' ? '' : document.getElementById('mPosicao').value;
  a.dataNascimento = document.getElementById('mDataNasc').value        || a.dataNascimento || '';
  a.encarregado    = document.getElementById('mEnc').value             || a.encarregado;
  a.estado         = document.getElementById('mEstado').value;
  a.foto           = document.getElementById('mFoto')?.value           ?? a.foto ?? '';
  a.numero         = parseInt(document.getElementById('mNumero')?.value) || a.numero || '';
  saveDB();
  renderAtletas();
  updateBadges();
  closeModal();
  showToast('Atleta actualizado!', 'green');
};

window.removeAtleta = function (id) {
  if (!confirm('Tem a certeza que pretende remover este atleta?')) return;
  const idx = DB.atletas.findIndex(x => x.id === id);
  if (idx > -1) DB.atletas.splice(idx, 1);
  saveDB();
  renderAtletas();
  updateBadges();
  showToast('Atleta removido.', 'red');
};

document.getElementById('btnApagarTodosAtletas')?.addEventListener('click', () => {
  const total = DB.atletas.length;
  if (!total) { showToast('Não há atletas para apagar.', ''); return; }
  if (!confirm(`Tem a certeza que pretende apagar TODOS os ${total} atletas?\n\nEsta ação não pode ser desfeita.`)) return;
  DB.atletas = [];
  saveDB();
  renderAtletas();
  updateBadges();
  showToast(`${total} atletas removidos.`, 'red');
});

// ==================================================
// IMPORTAR PLANTEL FPF (paste-from-table)
// ==================================================

document.getElementById('btnImportarPlantel')?.addEventListener('click', () => {
  document.getElementById('plantelModal').style.display = 'flex';
});

window.fecharPlantel = function () {
  document.getElementById('plantelModal').style.display = 'none';
  document.getElementById('plantelTA').value = '';
  document.getElementById('plantelPreview').innerHTML = '';
  _plantelHTMLDoc = null;
};

let _plantelHTMLDoc = null;

// Capture HTML on paste so we can extract image URLs
document.getElementById('plantelTA')?.addEventListener('paste', function (e) {
  const html = e.clipboardData?.getData('text/html');
  if (html) {
    try {
      _plantelHTMLDoc = new DOMParser().parseFromString(html, 'text/html');
    } catch (_) { _plantelHTMLDoc = null; }
  }
});

function _getImgSrc(img) {
  // Try every attribute used for lazy-loading, in priority order
  const attrs = ['src','data-src','data-lazy','data-lazy-src','data-original','data-srcset','srcset'];
  for (const attr of attrs) {
    let val = img.getAttribute(attr) || '';
    if (!val) continue;
    // srcset may be "url 1x, url2 2x" — take first
    if (attr.includes('srcset')) val = val.split(',')[0].trim().split(/\s+/)[0];
    if (val.startsWith('data:image')) continue; // skip inline placeholders
    if (val.includes('blank') || val.includes('placeholder') || val.includes('1x1') || val.includes('spacer')) continue;
    if (val.length < 8) continue;
    return val;
  }
  // Also check inline style background-image
  const style = img.getAttribute('style') || '';
  const bgMatch = style.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
  if (bgMatch) return bgMatch[1];
  return '';
}

function _resolveUrl(src, baseUrl) {
  if (!src || src.startsWith('http') || src.startsWith('data:')) return src;
  return baseUrl + (src.startsWith('/') ? '' : '/') + src;
}

function _imgForNameInDoc(nome, doc, baseUrl) {
  if (!doc) return '';
  const nomeLow = nome.toLowerCase().replace(/\s+/g, ' ').trim();
  // Split name into words for partial matching
  const words = nomeLow.split(' ').filter(w => w.length > 2);

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = node.textContent.toLowerCase().replace(/\s+/g, ' ').trim();
    // Match full name OR all significant words present
    const matches = txt.includes(nomeLow) || (words.length >= 2 && words.every(w => txt.includes(w)));
    if (!matches) continue;

    // Walk up to 10 levels looking for an img
    let cur = node.parentElement;
    for (let i = 0; i < 10 && cur; i++) {
      const img = cur.querySelector('img');
      if (img) {
        let src = _getImgSrc(img);
        if (src) {
          src = _resolveUrl(src, baseUrl);
          // Skip logos / nav images (usually very short paths or contain 'logo','icon','flag')
          if (!src.includes('logo') && !src.includes('icon') && !src.includes('flag') && !src.includes('escudo')) return src;
        }
      }
      // Also check divs with background-image (ZeroZero uses these for player avatars)
      const bgEl = cur.querySelector('[style*="background-image"]');
      if (bgEl) {
        const style = bgEl.getAttribute('style') || '';
        const m = style.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
        if (m) {
          let src = _resolveUrl(m[1], baseUrl);
          if (src && !src.includes('logo') && !src.includes('flag')) return src;
        }
      }
      cur = cur.parentElement;
    }
  }
  return '';
}

function _fpfImgForName(nome) {
  return _imgForNameInDoc(nome, _plantelHTMLDoc, 'https://www.fpf.pt');
}

const _FPF_POS = {
  'GR':'Guarda-redes','GK':'Guarda-redes','G':'Guarda-redes',
  'DC':'Central','CB':'Central',
  'DD':'Defesa Direito','RB':'Defesa Direito','DR':'Defesa Direito',
  'DE':'Defesa Esquerdo','LB':'Defesa Esquerdo','DL':'Defesa Esquerdo','DLE':'Defesa Esquerdo',
  'MD':'Médio Defensivo','MDC':'Médio Defensivo','MDF':'Médio Defensivo',
  'MED':'Médio','MC':'Médio','M':'Médio','CM':'Médio','MEO':'Médio','MO':'Médio','AM':'Médio',
  'EX':'Extremo','W':'Extremo','LW':'Extremo','RW':'Extremo','LD':'Extremo','LE':'Extremo',
  'AV':'Avançado','ST':'Avançado','PL':'Avançado','CF':'Avançado','CA':'Avançado',
};

function _mapPos(code) {
  if (!code) return '';
  return _FPF_POS[code.toUpperCase().trim()] || '';
}

function _isNac(str) {
  return /^[A-Z]{2,3}$/.test(str.trim()) || /[\u{1F1E0}-\u{1F1FF}]{2}/u.test(str);
}

const _MONTHS_PT = {
  jan:'01',janeiro:'01', fev:'02',fevereiro:'02', mar:'03','março':'03',marco:'03',
  abr:'04',abril:'04',   mai:'05',maio:'05',       jun:'06',junho:'06',
  jul:'07',julho:'07',   ago:'08',agosto:'08',      set:'09',setembro:'09',
  out:'10',outubro:'10', nov:'11',novembro:'11',    dez:'12',dezembro:'12'
};

function _normalizeDateFPF(str) {
  if (!str) return '';
  return _extractDate(str.trim());
}

// Find a date pattern anywhere in a string (exact-string or embedded)
function _extractDate(str) {
  if (!str) return '';
  str = str.trim();
  // "12 abr 2009" / "12 abr. 2009" / "12 abril 2009" / "12 de abril de 2009"
  let m = str.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóúãõç]{3,})\.?\s+(?:de\s+)?(\d{4})/i);
  if (m) { const mm = _MONTHS_PT[m[2].toLowerCase()]; if (mm) return `${m[3]}-${mm}-${m[1].padStart(2,'0')}`; }
  // "12/04/2009" or "12-04-2009" anywhere in string
  m = str.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (m && Number(m[2]) <= 12) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // "2009-04-12" ISO anywhere in string
  m = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

// ── Direct URL fetch utilities ────────────────────────────────────────────────

async function _fetchViaProxy(url) {
  // Try our own server-side proxy first (no CORS issues, no third-party limits)
  const localProxy = `../proxy.php?url=${encodeURIComponent(url)}`;
  const externalProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  const tryFetch = async (proxyUrl, timeout) => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(proxyUrl, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) return null;
      const text = await res.text();
      // If proxy.php is not being executed (served as raw text by a static server),
      // its response starts with "<?php". Reject and fall through to external proxies.
      if (text.trimStart().startsWith('<?php')) return null;
      return text.length >= 500 ? text : null;
    } catch(e) { clearTimeout(tid); return null; }
  };

  // Try local proxy first (fast, reliable)
  const local = await tryFetch(localProxy, 15000);
  if (local) return local;

  // Fall back to external CORS proxies
  let lastErr = 'Falha na ligação';
  for (const proxy of externalProxies) {
    try {
      const text = await tryFetch(proxy, 12000);
      if (text) return text;
    } catch(e) { lastErr = e.message || lastErr; }
  }
  throw new Error('Não foi possível aceder à página automaticamente — o site pode bloquear robôs, ou o servidor ainda não tem PHP ativo. Solução: abre a página no browser, seleciona a tabela, copia (Ctrl+C) e cola aqui (Ctrl+V).');
}

// Convert a parsed HTML document to structured plain text (block elements → newlines, table cells → tabs)
function _docToText(doc) {
  const BLOCK = new Set(['div','p','li','h1','h2','h3','h4','h5','h6','section','article','header','footer','br']);
  const SKIP  = new Set(['script','style','noscript','nav','iframe','button','input','select']);
  const parts = [];
  function walk(node) {
    if (node.nodeType === 3) {
      const t = node.textContent.replace(/\s+/g,' ').trim();
      if (t) parts.push(t);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (tag === 'br') { parts.push('\n'); return; }
    // <time datetime="2009-04-12"> — emit the datetime attribute as a date line
    if (tag === 'time') {
      const dt = node.getAttribute('datetime') || node.getAttribute('data-date') || '';
      const d = _extractDate(dt) || _extractDate(node.textContent.trim());
      if (d) { parts.push('\n' + node.textContent.trim() + '\n'); return; }
    }
    if (tag === 'td' || tag === 'th') {
      for (const c of node.childNodes) walk(c);
      // ZeroZero: age cell has title="12 abr. 2009" — emit the date after cell content
      const title = node.getAttribute('title') || node.getAttribute('data-birth') || node.getAttribute('data-nascimento') || '';
      if (title && _extractDate(title)) parts.push('\n' + title);
      parts.push('\t');
      return;
    }
    if (tag === 'tr') { parts.push('\n'); for (const c of node.childNodes) walk(c); parts.push('\n'); return; }
    // Generic: emit title attribute if it looks like a date (e.g. <span title="12 abr. 2009">)
    if (tag === 'span' || tag === 'a') {
      const title = node.getAttribute('title') || '';
      if (title && _extractDate(title)) parts.push('\n' + title + '\n');
    }
    if (BLOCK.has(tag)) parts.push('\n');
    for (const c of node.childNodes) walk(c);
    if (BLOCK.has(tag)) parts.push('\n');
  }
  walk(doc.body || doc.documentElement);
  return parts.join('').replace(/\t\n/g, '\n').replace(/[ \t]+ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

async function _zzFetchAndFill(url, taId, htmlDocSetter, onDone) {
  const btn = document.querySelector(`[onclick*="${onDone.name || ''}"]`) || null;
  const statusEl = document.getElementById(taId)?.parentElement;
  const ta = document.getElementById(taId);
  if (!ta) return;

  // Show loading state
  ta.placeholder = '⏳ A buscar dados do ZeroZero…';
  ta.value = '';

  let html;
  try {
    html = await _fetchViaProxy(url);
  } catch(e) {
    ta.placeholder = 'Cola aqui manualmente (fetch falhou)';
    showToast(e.message, 'red');
    return;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (htmlDocSetter) htmlDocSetter(doc);
  const text = _docToText(doc);
  ta.value = text;
  ta.placeholder = '';
  onDone();
}

window.buscarUrlSeniores = async function(btn) {
  const url = document.getElementById('senioresImportUrl')?.value.trim();
  if (!url) { showToast('Introduz um URL do ZeroZero', 'red'); return; }
  btn.textContent = '⏳ A buscar…'; btn.disabled = true;
  try {
    await _zzFetchAndFill(url, 'senioresImportTA', (doc) => { _senioresImportHTMLDoc = doc; }, previewSenioresImport);
  } finally { btn.textContent = '⬇ Buscar'; btn.disabled = false; }
};

window.buscarUrlFormacao = async function(btn) {
  const url = document.getElementById('formacaoImportUrl')?.value.trim();
  if (!url) { showToast('Introduz um URL do ZeroZero', 'red'); return; }
  btn.textContent = '⏳ A buscar…'; btn.disabled = true;
  try {
    await _zzFetchAndFill(url, 'formacaoImportTA', (doc) => { _formacaoImportHTMLDoc = doc; }, previewFormacaoImport);
  } finally { btn.textContent = '⬇ Buscar'; btn.disabled = false; }
};

window.buscarUrlColar = async function(btn) {
  const url = document.getElementById('colarClassUrl')?.value.trim();
  if (!url) { showToast('Introduz um URL', 'red'); return; }
  btn.textContent = '⏳ A buscar…'; btn.disabled = true;
  try {
    await _zzFetchAndFill(url, 'colarClassTA', null, previewColarClass);
  } finally { btn.textContent = '⬇ Buscar'; btn.disabled = false; }
};

// ZeroZero position group headers
const _ZZ_GRUPOS = {
  'guarda-redes':'Guarda-redes','guarda redes':'Guarda-redes',
  'defesas':'Defesa','defesa':'Defesa',
  'médios':'Médio','médio':'Médio','meios':'Médio','meio':'Médio',
  'avançados':'Avançado','avançado':'Avançado',
  'pontas de lança':'Avançado','ponta de lança':'Avançado',
};
function _zzGrupo(line) { return _ZZ_GRUPOS[line.toLowerCase().trim()] || null; }

function _parseZeroZero(lines) {
  const players = [];
  let posGrupo = '';
  const junkRe = /^(plantel|equipa|época|temporada|zerozero|guardar|filtrar|ver mais|carregar|menu|login|©|anterior|próximo|página|sub-|\.com)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (junkRe.test(line)) continue;
    if (line.length < 2) continue;
    const grupo = _zzGrupo(line);
    if (grupo) { posGrupo = grupo; continue; }

    // Skip lines that are purely a date (they'll be picked up by lookahead below)
    if (_normalizeDateFPF(line)) continue;
    // Skip pure nationality codes and pure age lines
    if (_isNac(line) || /^\(?\d{1,2}\s*(anos)?\)?$/i.test(line)) continue;

    const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    let lo = 0, hi = parts.length;
    let numero = '', nome = '', posicao = posGrupo, dataNascimento = '';

    if (/^\d{1,2}$/.test(parts[lo])) { numero = parts[lo]; lo++; }
    if (lo >= hi) continue;
    // Strip trailing age "(24 anos)" or bare number ≤ 40
    if (/^\(?\d{1,2}\s*(anos)?\)?$/i.test(parts[hi-1])) hi--;
    // Strip trailing nationality
    if (hi > lo + 1 && _isNac(parts[hi-1])) hi--;
    // Strip trailing date (inline, same line)
    const maybeDate = _normalizeDateFPF(parts[hi-1]);
    if (maybeDate && hi > lo + 1) { dataNascimento = maybeDate; hi--; }
    // Strip nationality again (may appear before date)
    if (hi > lo + 1 && _isNac(parts[hi-1])) hi--;
    // Strip position code if no group
    if (!posicao && hi > lo + 1 && _mapPos(parts[hi-1])) { posicao = _mapPos(parts[hi-1]); hi--; }

    nome = parts.slice(lo, hi).join(' ').trim();
    if (!nome || nome.length < 2 || /^\d+$/.test(nome)) continue;

    // Lookahead: if no date yet, scan next lines for one (multi-line ZeroZero layout)
    // Only stop at a new position group header; skip junk/nationality/age lines
    if (!dataNascimento) {
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (_zzGrupo(lines[j])) break; // next group = definitely a new player block
        const d = _extractDate(lines[j]);
        if (d) { dataNascimento = d; break; }
      }
    }

    players.push({ numero, nome, posicao, dataNascimento, foto: _fpfImgForName(nome) });
  }
  return players;
}

function parsePastedAtletas(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const players = [];

  // Detect FPF card format: contains "Data de nascimento:" lines
  const hasCardFormat = lines.some(l => /^data de nascimento/i.test(l));

  // Detect ZeroZero format: has position group headers (Guarda-Redes, Defesas, Médios…)
  const hasZZFormat = !hasCardFormat && lines.some(l => _zzGrupo(l) !== null);
  if (hasZZFormat) return _parseZeroZero(lines);

  if (hasCardFormat) {
    // Strategy: "Data de nascimento" always follows the player name.
    // Scan forward; when we hit a birth-date label, the last non-junk line was the name.
    const isJunk = s =>
      /^(filtrar|filtre|escalão|clube|equipa|inscrito|resultado|jogadores|fpf|federação|menu|pesquisar|anterior|próximo|página|ver mais|carregar|copyright|login|logout|entrar)/i.test(s) ||
      /^data de nascimento/i.test(s) ||
      /^\d+$/.test(s) ||
      s.length < 3;

    let lastName = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/^data de nascimento/i.test(line)) {
        // Check if date is inline: "Data de nascimento: 12 abr 2009"
        const inlineDate = line.match(/data de nascimento[:\s]+(.+)/i);
        let dataNascimento = inlineDate ? _normalizeDateFPF(inlineDate[1].trim()) : '';

        // If not inline, next line should be the date
        if (!dataNascimento && i + 1 < lines.length) {
          dataNascimento = _normalizeDateFPF(lines[i + 1]);
          if (dataNascimento) i++;
        }

        if (lastName) {
          players.push({ numero: '', nome: lastName, posicao: '', dataNascimento, foto: _fpfImgForName(lastName) });
          lastName = '';
        }
        i++;
        continue;
      }

      if (!isJunk(line)) {
        lastName = line.replace(/\s+/g, ' ').trim();
      } else {
        // Junk lines reset the candidate name
        if (isJunk(line) && !/^data de nascimento/i.test(line)) lastName = '';
      }
      i++;
    }
    return players;
  }

  // Fallback: tab-separated table format
  for (const line of lines) {
    if (/^(nº|n\.|nome|jogador|pos|posição|nat\.|nac\.|equipa|escalão|clube|data)/i.test(line)) continue;

    const parts = line.split(/\t+/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    let numero = '', nome = '', posicao = '';

    if (parts.length === 1) {
      if (/^\d+$/.test(parts[0])) continue;
      nome = parts[0];
    } else {
      let lo = 0, hi = parts.length;

      if (/^\d{1,3}$/.test(parts[0])) { numero = parts[0]; lo++; }
      if (hi > lo + 1 && _isNac(parts[hi - 1])) hi--;
      if (hi > lo + 1 && _mapPos(parts[hi - 1])) { posicao = _mapPos(parts[hi - 1]); hi--; }

      nome = parts.slice(lo, hi).join(' ').trim();
    }

    if (!nome || nome.length < 2 || /^\d+$/.test(nome)) continue;
    players.push({ numero, nome, posicao, dataNascimento: '', foto: _fpfImgForName(nome) });
  }
  return players;
}

window.previewPlantel = function () {
  const text = document.getElementById('plantelTA').value.trim();
  const escalao = document.getElementById('plantelEscalao').value;
  const prev = document.getElementById('plantelPreview');
  if (!text) { prev.innerHTML = ''; return; }

  const players = parsePastedAtletas(text);
  if (!players.length) {
    prev.innerHTML = '<p style="color:#c00;font-size:0.85rem">Nenhum jogador reconhecido. Certifica-te de que copiaste a tabela completa.</p>';
    return;
  }

  const existNames = DB.atletas.filter(a => a.escalao === escalao).map(a => a.nome.toLowerCase());
  const novos = players.filter(p => !existNames.includes(p.nome.toLowerCase())).length;
  const dups   = players.length - novos;

  const withPhoto = players.filter(p => p.foto).length;
  const withDate  = players.filter(p => p.dataNascimento).length;
  prev.innerHTML = `
    <div style="font-size:0.82rem;color:#555;margin-bottom:8px">
      <strong>${players.length}</strong> jogadores reconhecidos
      · <span style="color:#16a34a">${novos} novos</span>
      ${dups ? `· <span style="color:#d97706">${dups} duplicados</span>` : ''}
      ${withPhoto ? `· <span style="color:#2563eb">${withPhoto} com foto</span>` : ''}
      ${withDate ? `· <span style="color:#7c3aed">${withDate} com data nasc.</span>` : ''}
    </div>
    ${!withDate ? `<p style="font-size:0.78rem;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:7px 10px;margin:0 0 8px">
      ⚠️ Datas de nascimento não encontradas.<br>
      <strong>Método 1:</strong> usa o botão <strong>⬇ Buscar</strong> com o URL do plantel.<br>
      <strong>Método 2 (colar):</strong> no ZeroZero vai ao separador <em>Plantel</em>, prime <strong>Ctrl+A</strong> → <strong>Ctrl+C</strong> e cola aqui — o HTML copiado contém as datas mesmo sem o Buscar.
    </p>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
      <thead><tr style="background:#f0f4ff">
        <th style="padding:6px 8px;width:40px"></th>
        <th style="padding:6px 10px;text-align:left">Nome</th>
        <th style="padding:6px 10px;text-align:left">Dt. Nasc.</th>
        <th style="padding:6px 10px;text-align:left"></th>
      </tr></thead>
      <tbody>${players.map(p => {
        const dup = existNames.includes(p.nome.toLowerCase());
        const avatar = p.foto
          ? `<img src="${p.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'" />`
          : `<div style="width:32px;height:32px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:#999">${p.nome.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>`;
        return `<tr style="border-bottom:1px solid #eee${dup ? ';opacity:0.55' : ''}">
          <td style="padding:4px 8px">${avatar}</td>
          <td style="padding:4px 10px;font-weight:600">${p.nome}</td>
          <td style="padding:4px 10px;color:#888">${p.dataNascimento || '—'}</td>
          <td style="padding:4px 10px">${dup
            ? '<span style="color:#d97706;font-size:0.75rem">duplicado</span>'
            : '<span style="color:#16a34a;font-size:0.75rem">novo</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
};

window.diagPlantel = function () {
  const text = document.getElementById('plantelTA').value;
  const prev = document.getElementById('plantelPreview');
  if (!text.trim()) { prev.innerHTML = '<p style="color:#c00;font-size:0.85rem">Textarea vazia — cola primeiro o texto da FPF ou ZeroZero.</p>'; return; }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 40);
  const hasCard = lines.some(l => /^data de nascimento/i.test(l));
  const hasZZ   = !hasCard && lines.some(l => _zzGrupo(l) !== null);
  const modo    = hasCard ? 'FPF — Cartões' : hasZZ ? 'ZeroZero — Grupos por posição' : 'Tabela genérica';
  prev.innerHTML = `
    <div style="font-size:0.8rem;color:#555;margin-bottom:6px">
      Modo: <strong>${modo}</strong> · ${text.split('\n').filter(l => l.trim()).length} linhas
    </div>
    <div style="font-size:0.75rem;color:#888;margin-bottom:4px">
      <span style="color:#1a6;font-weight:700">■</span> grupo/FPF
      <span style="color:#2563eb;font-weight:700;margin-left:8px">■</span> data detetada
    </div>
    <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:10px;font-family:monospace;font-size:0.78rem;max-height:260px;overflow-y:auto">
      ${lines.map((l, i) => {
        const isGrp  = /^data de nascimento/i.test(l) || _zzGrupo(l);
        const isDate = !isGrp && !!_extractDate(l);
        const color  = isGrp ? '#1a6' : isDate ? '#2563eb' : '#333';
        const tag    = isGrp ? ' [GRUPO]' : isDate ? ` [DATA: ${_extractDate(l)}]` : '';
        return `<div style="padding:1px 0;color:${color}">${i + 1}: ${l.replace(/</g,'&lt;')}${tag}</div>`;
      }).join('')}
    </div>`;
};

window.guardarPlantel = function () {
  const text    = document.getElementById('plantelTA').value.trim();
  const escalao = document.getElementById('plantelEscalao').value;
  const dupMode = document.getElementById('plantelDup').value;
  if (!text) return;

  const players = parsePastedAtletas(text);
  if (!players.length) { showToast('Nenhum jogador reconhecido.', 'red'); return; }

  let added = 0, skipped = 0, replaced = 0;

  for (const p of players) {
    const idx = DB.atletas.findIndex(
      a => a.nome.toLowerCase() === p.nome.toLowerCase() && a.escalao === escalao
    );
    if (idx > -1) {
      if (dupMode === 'replace') {
        if (p.posicao) DB.atletas[idx].posicao = p.posicao;
        if (p.foto && !DB.atletas[idx].foto) DB.atletas[idx].foto = p.foto;
        replaced++;
      } else skipped++;
    } else {
      DB.atletas.push({
        id: Date.now() + Math.random(),
        nome: p.nome, escalao, posicao: p.posicao || '',
        dataNascimento: p.dataNascimento || '', encarregado: '—', telefone: '', foto: p.foto || '',
        estado: 'Activo',
      });
      added++;
    }
  }

  saveDB(); renderAtletas(); updateBadges(); fecharPlantel();
  const msg = [
    added    ? `${added} importados`    : '',
    replaced ? `${replaced} atualizados` : '',
    skipped  ? `${skipped} ignorados`    : '',
  ].filter(Boolean).join(', ');
  showToast(msg + '.', 'green');
};

// ==================================================
// UTILITÁRIO: UPLOAD DE IMAGEM
// ==================================================

// Comprime uma imagem para máx. 800px. PNG preserva transparência; JPEG usa qualidade 0.75.
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const isPng = file.type === 'image/png';
      if (isPng) {
        ctx.clearRect(0, 0, w, h); // preserve transparency
      }
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : 0.75));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

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
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem demasiado grande (máx 5MB)', 'red');
      this.value = '';
      return;
    }
    compressImage(file, dataUrl => {
      if (urlEl) urlEl.value = dataUrl;
      updatePreview(dataUrl);
    });
  });

  urlEl?.addEventListener('input', function() { updatePreview(this.value); });
}

// ==================================================
// NOTÍCIAS — sistema limpo (chave localStorage: jsc_noticias)
// ==================================================
const NEWS_KEY = 'jsc_noticias';

function loadNoticias() {
  try { return JSON.parse(localStorage.getItem(NEWS_KEY) || '[]'); } catch(e) { return []; }
}

function saveNoticias(arr) {
  try {
    localStorage.setItem(NEWS_KEY, JSON.stringify(arr));
    return true;
  } catch(e) {
    showToast('ERRO: armazenamento cheio. Apague notícias antigas.', 'red');
    return false;
  }
}

function renderNoticias() {
  const grid = document.getElementById('newsAdminGrid');
  if (!grid) return;
  const lista = loadNoticias();
  grid.innerHTML = [
    `<div class="news-admin-card" style="display:flex;align-items:center;justify-content:center;
      min-height:240px;border:2px dashed #e2e8f0;background:#f4f6fb;cursor:pointer"
      onclick="abrirModalNoticia()">
      <div style="text-align:center;color:#64748b">
        <div style="font-size:2.5rem;margin-bottom:8px">+</div>
        <div style="font-weight:700;font-size:0.9rem">Nova Notícia</div>
      </div>
    </div>`,
    ...lista.map((n, i) => {
      let statusHtml;
      if (n.scheduledAt && !n.publicada) {
        const dt = n.scheduledAt.replace('T', ' ').slice(0, 16);
        statusHtml = `<span style="color:#7c3aed;font-weight:700">&#9200; ${dt}</span>`;
      } else if (n.publicada) {
        statusHtml = `<span style="color:#16a34a;font-weight:700">&#10003; Publicada</span>`;
      } else {
        statusHtml = `<span style="color:#d97706;font-weight:700">&#9646; Rascunho</span>`;
      }
      const destaqueHtml = n.destaque ? `<span style="background:#f59e0b;color:#fff;font-size:0.7rem;padding:2px 7px;border-radius:20px;font-weight:700;margin-left:6px">&#11088;</span>` : '';
      return `
      <div class="news-admin-card">
        <div class="news-admin-img news-admin-img--${(i % 3) + 1}"
             style="${n.imagem ? `background-image:url('${n.imagem}');background-size:cover;background-position:center;background-repeat:no-repeat` : ''}">
          <span class="news-cat-badge">${n.categoria || ''}</span>
        </div>
        <div class="news-admin-body">
          <div class="news-admin-title">${n.titulo}${destaqueHtml}</div>
          <div class="news-admin-date">${fmtDate(n.data)} &middot; ${statusHtml}</div>
        </div>
        <div class="news-admin-footer">
          <button class="btn-icon" onclick="editNoticia(${n.id})" title="Editar">&#9998;</button>
          <button class="btn-icon btn-icon--red" onclick="removeNoticia(${n.id})" title="Eliminar">&#128465;</button>
        </div>
      </div>`;
    })
  ].join('');
}

function abrirModalNoticia(n) {
  const isNew     = !n;
  const cats      = ['Resultado','Seleção','Conquista','Clube','Evento','Formação','Seniores'];
  const pos       = n?.imagemPos  || 'top';
  const sz        = n?.imagemSize || 'cover';
  const focalPos  = n?.focalPos   || 'center';
  const focalPct  = focalToPercent(focalPos);

  openModal(isNew ? 'Nova Notícia' : 'Editar Notícia', `
    ${isNew ? `<div class="tpl-bar">
      <span class="tpl-bar__label">⚡ Template:</span>
      <div class="tpl-dropdown">
        <button class="tpl-trigger" type="button" onclick="toggleTplMenu('Noticia')">Escolher template &#9662;</button>
        <div class="tpl-menu" id="tplMenuNoticia" style="display:none">
          <button type="button" onclick="aplicarTemplateNoticia('resultado')">⚽ Resultado de Jogo</button>
          <button type="button" onclick="aplicarTemplateNoticia('convocatoria')">📋 Convocatória</button>
          <button type="button" onclick="aplicarTemplateNoticia('inscricoes')">📝 Inscrições Abertas</button>
          <button type="button" onclick="aplicarTemplateNoticia('conquista')">🏆 Conquista / Título</button>
          <button type="button" onclick="aplicarTemplateNoticia('comunicado')">📢 Comunicado Oficial</button>
        </div>
      </div>
    </div>` : ''}
    <div class="modal-field">
      <label>Título *</label>
      <input type="text" class="form-input" id="mTitulo" value="${n?.titulo || ''}" placeholder="Título da notícia" />
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Categoria</label>
        <select class="form-input" id="mCat">
          ${cats.map(c => `<option${c === (n?.categoria || 'Resultado') ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Data</label>
        <input type="date" class="form-input" id="mData" value="${n?.data || new Date().toISOString().split('T')[0]}" />
      </div>
    </div>
    <div class="modal-field">
      <label>Texto da notícia</label>
      <div class="rte-toolbar" id="rteToolbar">
        <button type="button" class="rte-btn" data-cmd="bold"        title="Negrito"><b>N</b></button>
        <button type="button" class="rte-btn" data-cmd="italic"      title="Itálico"><i>I</i></button>
        <button type="button" class="rte-btn" data-cmd="underline"   title="Sublinhado"><u>S</u></button>
        <span class="rte-sep"></span>
        <select class="rte-select" id="rteFonte" title="Fonte">
          <option value="inherit">Padrão</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Impact, sans-serif">Impact</option>
        </select>
        <select class="rte-select" id="rteTamanho" title="Tamanho">
          <option value="1">Muito Pequeno</option>
          <option value="2">Pequeno</option>
          <option value="3" selected>Normal</option>
          <option value="4">Grande</option>
          <option value="5">Muito Grande</option>
          <option value="6">Enorme</option>
        </select>
        <span class="rte-sep"></span>
        <label class="rte-color-wrap" title="Cor do texto">
          <span>A</span>
          <input type="color" id="rteCor" value="#111111" />
        </label>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" data-cmd="justifyLeft"   title="Alinhar esquerda">&#8676;</button>
        <button type="button" class="rte-btn" data-cmd="justifyCenter" title="Centrar">&#8677;</button>
        <button type="button" class="rte-btn" data-cmd="justifyRight"  title="Alinhar direita">&#8677;</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" data-cmd="insertUnorderedList"  title="Lista com pontos">&#8226;</button>
        <button type="button" class="rte-btn" data-cmd="insertOrderedList"   title="Lista numerada">1.</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn rte-btn--block" data-block="h2" title="Título H2" style="font-weight:700;font-size:0.78rem">H2</button>
        <button type="button" class="rte-btn rte-btn--block" data-block="h3" title="Título H3" style="font-weight:700;font-size:0.78rem">H3</button>
        <button type="button" class="rte-btn rte-btn--block" data-block="p"  title="Parágrafo normal" style="font-size:0.82rem">¶</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" data-img="1" title="Inserir imagem no texto">&#128247;</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn rte-btn--clear" id="rteClear" title="Limpar formatação">&#10005; Limpar</button>
      </div>
      <div id="rteImgPanel" style="display:none;border:1px solid #dde3ef;border-radius:10px;padding:14px;margin-top:4px;background:#f8faff"></div>
      <div class="rte-editor form-input" id="mResumoEditor" contenteditable="true" data-placeholder="Texto da notícia...">${n?.resumo || ''}</div>
      <div id="mAutoSaveIndicator" style="font-size:0.74rem;color:#94a3b8;margin-top:4px;min-height:16px"></div>
    </div>

    <div class="modal-field">
      <label>Imagem</label>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
        <label class="img-upload-btn" for="mFicheiro" style="cursor:pointer;background:var(--blue);color:#fff;padding:6px 14px;border-radius:6px;font-size:0.82rem;font-weight:600">
          📁 Escolher ficheiro
        </label>
        <input type="file" id="mFicheiro" accept="image/*" style="display:none" onchange="previewNoticiaImg(this)">
        <span style="color:#888;font-size:0.8rem">ou</span>
        <input type="url" class="form-input" id="mImagem" value="${n?.imagem || ''}" placeholder="https://..." style="flex:1;min-width:160px" oninput="previewNoticiaUrl(this.value)" />
      </div>
      <div id="mImagemPreview" style="${n?.imagem ? '' : 'display:none'}">
        <div style="font-size:0.78rem;color:#888;margin-bottom:4px">Clique na imagem para definir o ponto focal do recorte</div>
        <div id="mNoticiaPreviewWrap" style="position:relative;border-radius:8px;overflow:hidden;background:#1a3a80;height:180px;cursor:crosshair">
          <img id="mImagemPreviewImg" src="${n?.imagem || ''}"
            style="width:100%;height:100%;object-fit:cover;object-position:${focalPos};pointer-events:none;display:block"
            onerror="this.parentElement.parentElement.style.display='none'" />
          <div id="mNoticiaFocalPin" style="position:absolute;left:${focalPct[0]}%;top:${focalPct[1]}%;transform:translate(-50%,-50%);pointer-events:none;z-index:3;display:${n?.imagem?'block':'none'}">
            <svg width="30" height="30" viewBox="0 0 30 30" style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.6))">
              <circle cx="15" cy="15" r="13" fill="white" fill-opacity="0.92"/>
              <circle cx="15" cy="15" r="5" fill="#0055cc"/>
              <line x1="15" y1="2" x2="15" y2="8" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
              <line x1="15" y1="22" x2="15" y2="28" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
              <line x1="2" y1="15" x2="8" y2="15" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
              <line x1="22" y1="15" x2="28" y2="15" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <div id="mImagemTamanho" style="font-size:11px;color:#888;margin-top:3px"></div>
      </div>
      <input type="hidden" id="mFocalPos" value="${focalPos}" />
    </div>

    <div class="modal-row" style="margin-top:4px">
      <div class="modal-field">
        <label>Posição no artigo</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px" id="mPosGroup">
          ${[
            ['top',    '▬ Topo',     'Largura total antes do texto'],
            ['center', '▬ Centro',   'Largura total entre parágrafos'],
            ['left',   '◧ Esquerda', 'Texto flui à direita'],
            ['right',  '◨ Direita',  'Texto flui à esquerda'],
          ].map(([val, label, desc]) => `
            <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:2px solid ${val===pos?'var(--blue)':'#e2e8f0'};border-radius:8px;cursor:pointer;font-size:0.82rem;background:${val===pos?'#eff6ff':'#fff'}" onclick="selectImagePos('${val}')">
              <input type="radio" name="mImagemPos" value="${val}" ${val===pos?'checked':''} style="display:none">
              <span style="font-size:1rem">${label.split(' ')[0]}</span>
              <span><strong>${label.split(' ').slice(1).join(' ')}</strong><br><small style="color:#888">${desc}</small></span>
            </label>`).join('')}
        </div>
        <input type="hidden" id="mImagemPos" value="${pos}">
      </div>
      <div class="modal-field">
        <label>Tamanho da imagem</label>
        <select class="form-input" id="mImagemSize" style="margin-top:4px">
          <option value="cover"   ${sz==='cover'  ?'selected':''}>Preencher (corta bordas)</option>
          <option value="contain" ${sz==='contain'?'selected':''}>Mostrar tudo</option>
          <option value="110%"    ${sz==='110%'   ?'selected':''}>Zoom 110%</option>
          <option value="140%"    ${sz==='140%'   ?'selected':''}>Zoom 140%</option>
        </select>
        <div style="margin-top:6px;font-size:0.78rem;color:#888">
          Máx. 5MB — comprimido automaticamente
        </div>
      </div>
    </div>

    <div class="modal-row" style="margin-top:8px">
      <div class="modal-field">
        <label>Estado</label>
        <select class="form-input" id="mStatus" onchange="toggleAgendamento()">
          <option value="publicada" ${(isNew || (n?.publicada && !n?.scheduledAt)) ? 'selected' : ''}>&#10003; Publicada</option>
          <option value="rascunho"  ${(!isNew && !n?.publicada && !n?.scheduledAt) ? 'selected' : ''}>&#9646; Rascunho</option>
          <option value="agendada"  ${n?.scheduledAt ? 'selected' : ''}>&#9200; Agendada</option>
        </select>
      </div>
      <div class="modal-field" id="mAgendamentoWrap" style="${n?.scheduledAt ? '' : 'display:none'}">
        <label>Data e hora de publicação</label>
        <input type="datetime-local" class="form-input" id="mScheduledAt" value="${n?.scheduledAt || ''}" />
      </div>
    </div>
    <div class="modal-field" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="mDestaque" ${n?.destaque ? 'checked' : ''} />
        &#11088; Artigo em destaque (aparece no topo da página de notícias)
      </label>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-cancel" onclick="previewNoticiaForm()" style="background:#f0f4ff;color:#003B8E;border:1px solid #c7d8f8">&#128065; Pré-visualizar</button>
     <button class="btn-save" onclick="saveNoticia(${isNew ? 'null' : n.id})">${isNew ? 'Criar Notícia' : 'Guardar'}</button>`
  );
  _initRTE(n ? n.id : null);

  // Restore draft offer
  (function () {
    try {
      const draft = JSON.parse(localStorage.getItem('news_autosave') || 'null');
      if (!draft) return;
      const draftId  = draft.articleId ?? null;
      const curId    = n ? n.id : null;
      if (String(draftId) !== String(curId)) return;
      const ts = draft.savedAt ? new Date(draft.savedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:0.83rem;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
      banner.innerHTML = `<span>&#128190; Rascunho automático encontrado (${ts}). Restaurar?</span>`
        + `<button onclick="restoreNoticiaDraft()" style="background:#f59e0b;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.8rem">Restaurar</button>`
        + `<button onclick="discardNoticiaDraft()" style="background:transparent;color:#92400e;border:none;cursor:pointer;font-size:0.8rem;text-decoration:underline">Descartar</button>`;
      modalBody.prepend(banner);
    } catch (e) {}
  })();
}

function _initRTE(articleId) {
  const editor  = document.getElementById('mResumoEditor');
  const toolbar = document.getElementById('rteToolbar');
  if (!editor || !toolbar) return;

  toolbar.addEventListener('mousedown', e => {
    const btn = e.target.closest('[data-cmd],[data-block],[data-img]');
    if (!btn) return;
    e.preventDefault();
    editor.focus();
    if (btn.dataset.cmd)   document.execCommand(btn.dataset.cmd,   false, null);
    if (btn.dataset.block) document.execCommand('formatBlock', false, btn.dataset.block);
    if (btn.dataset.img) {
      // Save cursor position before showing panel
      const sel = window.getSelection();
      window._rteRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      _toggleRteImgPanel();
    }
    _updateToolbarState();
  });

  // click-to-focus for news image
  setTimeout(function () {
    var wrap = document.getElementById('mNoticiaPreviewWrap');
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var rect  = wrap.getBoundingClientRect();
      var x     = Math.round((e.clientX - rect.left) / rect.width  * 100);
      var y     = Math.round((e.clientY - rect.top)  / rect.height * 100);
      var pos   = x + '% ' + y + '%';
      var input = document.getElementById('mFocalPos');
      var img   = document.getElementById('mImagemPreviewImg');
      var pin   = document.getElementById('mNoticiaFocalPin');
      if (input) input.value = pos;
      if (img)   img.style.objectPosition = pos;
      if (pin)   { pin.style.left = x + '%'; pin.style.top = y + '%'; pin.style.display = 'block'; }
    });
  }, 0);

  document.getElementById('rteFonte')?.addEventListener('change', e => {
    editor.focus();
    document.execCommand('fontName', false, e.target.value);
  });

  document.getElementById('rteTamanho')?.addEventListener('change', e => {
    editor.focus();
    document.execCommand('fontSize', false, e.target.value);
  });

  document.getElementById('rteCor')?.addEventListener('input', e => {
    editor.focus();
    document.execCommand('foreColor', false, e.target.value);
  });

  document.getElementById('rteClear')?.addEventListener('click', () => {
    editor.focus();
    document.execCommand('removeFormat', false, null);
  });

  editor.addEventListener('keyup', _updateToolbarState);
  editor.addEventListener('mouseup', _updateToolbarState);

  function _updateToolbarState() {
    toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
      try { btn.classList.toggle('active', document.queryCommandState(btn.dataset.cmd)); } catch(e) {}
    });
  }

  // Auto-save draft every 30 s
  if (window._noticiaDraftTimer) clearInterval(window._noticiaDraftTimer);
  window._noticiaDraftTimer = setInterval(function () {
    try {
      const titulo = document.getElementById('mTitulo')?.value.trim();
      if (!titulo) return;
      const draft = {
        articleId:  articleId,
        savedAt:    new Date().toISOString(),
        titulo,
        categoria:  document.getElementById('mCat')?.value          || '',
        data:       document.getElementById('mData')?.value          || '',
        resumo:     document.getElementById('mResumoEditor')?.innerHTML || '',
        imagem:     document.getElementById('mImagem')?.value.trim() || '',
        imagemPos:  document.getElementById('mImagemPos')?.value     || 'top',
        imagemSize: document.getElementById('mImagemSize')?.value    || 'cover',
        focalPos:   document.getElementById('mFocalPos')?.value      || 'center',
        status:     document.getElementById('mStatus')?.value        || 'publicada',
        scheduledAt:document.getElementById('mScheduledAt')?.value   || '',
        destaque:   document.getElementById('mDestaque')?.checked    || false,
      };
      localStorage.setItem('news_autosave', JSON.stringify(draft));
      const hm = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      const ind = document.getElementById('mAutoSaveIndicator');
      if (ind) ind.textContent = `&#10003; Guardado automaticamente às ${hm}`;
    } catch (e) {}
  }, 30000);
}

function _toggleRteImgPanel() {
  const panel = document.getElementById('rteImgPanel');
  if (!panel) return;
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  panel.style.display = '';
  panel.innerHTML = `
    <div style="font-weight:700;font-size:0.82rem;color:#001f4d;margin-bottom:10px">&#128247; Inserir imagem no texto</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
      <label class="img-upload-btn" for="rteImgFile" style="cursor:pointer;background:var(--blue);color:#fff;padding:5px 12px;border-radius:6px;font-size:0.8rem;font-weight:600">&#128193; Ficheiro</label>
      <input type="file" id="rteImgFile" accept="image/*" style="display:none">
      <span style="color:#aaa;font-size:0.8rem">ou</span>
      <input type="url" class="form-input" id="rteImgUrl" placeholder="https://url-da-imagem..." style="flex:1;min-width:180px;font-size:0.82rem;padding:6px 10px">
    </div>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px">
        <label style="font-size:0.8rem;color:#555">Alinhamento:</label>
        <select id="rteImgAlign" class="form-input" style="font-size:0.8rem;padding:5px 8px">
          <option value="block">&#8596; Centralizada</option>
          <option value="left">&#9664; Flutua esquerda</option>
          <option value="right">&#9654; Flutua direita</option>
          <option value="inline">Inline</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <label style="font-size:0.8rem;color:#555">Legenda:</label>
        <input type="text" class="form-input" id="rteImgCaption" placeholder="Opcional..." style="font-size:0.8rem;padding:5px 8px;width:160px">
      </div>
    </div>
    <div id="rteImgPreviewBox" style="display:none;margin-bottom:10px;text-align:center">
      <img id="rteImgPreviewImg" style="max-width:100%;max-height:140px;border-radius:6px;object-fit:contain;border:1px solid #e2e8f0">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button type="button" onclick="document.getElementById('rteImgPanel').style.display='none'" style="background:none;border:1px solid #dde3ef;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.8rem">Cancelar</button>
      <button type="button" onclick="doInsertImageRTE()" style="background:var(--blue);color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:700">Inserir</button>
    </div>`;

  document.getElementById('rteImgFile')?.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Ficheiro demasiado grande (máx 5MB)', 'red'); return; }
    compressImage(file, function (dataUrl) {
      const urlInput = document.getElementById('rteImgUrl');
      if (urlInput) urlInput.value = dataUrl;
      _showRteImgPreview(dataUrl);
    });
  });
  document.getElementById('rteImgUrl')?.addEventListener('input', function () {
    _showRteImgPreview(this.value);
  });
  document.getElementById('rteImgUrl')?.focus();
}

function _showRteImgPreview(src) {
  const box = document.getElementById('rteImgPreviewBox');
  const img = document.getElementById('rteImgPreviewImg');
  if (!box || !img) return;
  if (src) { box.style.display = ''; img.src = src; img.onerror = () => { box.style.display = 'none'; }; }
  else { box.style.display = 'none'; }
}

window.doInsertImageRTE = function () {
  const url = document.getElementById('rteImgUrl')?.value.trim();
  if (!url) { showToast('Escolha um ficheiro ou introduza um URL.', 'red'); return; }

  const align   = document.getElementById('rteImgAlign')?.value || 'block';
  const caption = document.getElementById('rteImgCaption')?.value.trim() || '';

  let imgStyle;
  if (align === 'block')  imgStyle = 'display:block;max-width:100%;height:auto;border-radius:6px;margin:12px auto';
  else if (align === 'left')   imgStyle = 'float:left;max-width:46%;height:auto;border-radius:6px;margin:4px 16px 8px 0;clear:left';
  else if (align === 'right')  imgStyle = 'float:right;max-width:46%;height:auto;border-radius:6px;margin:4px 0 8px 16px;clear:right';
  else imgStyle = 'max-width:100%;height:auto;border-radius:6px;margin:4px 2px';

  let html = `<img src="${url}" style="${imgStyle}" loading="lazy" alt="${caption || ''}">`;
  if (caption) html += `<span style="display:block;text-align:center;font-size:0.82rem;color:#888;margin:4px 0 12px">${caption}</span>`;
  html += align === 'block' ? '<br>' : '';

  const editor = document.getElementById('mResumoEditor');
  if (!editor) return;
  editor.focus();

  if (window._rteRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(window._rteRange);
    window._rteRange = null;
  }
  document.execCommand('insertHTML', false, html);
  document.getElementById('rteImgPanel').style.display = 'none';
};

window.previewNoticiaImg = function(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Ficheiro demasiado grande (máx 5MB)', 'red'); input.value = ''; return; }
  compressImage(file, dataUrl => {
    document.getElementById('mImagem').value = dataUrl;
    const prev = document.getElementById('mImagemPreview');
    const img  = document.getElementById('mImagemPreviewImg');
    const pin  = document.getElementById('mNoticiaFocalPin');
    const info = document.getElementById('mImagemTamanho');
    prev.style.display = '';
    img.src = dataUrl;
    if (pin) pin.style.display = 'block';
    const kb = Math.round(dataUrl.length * 0.75 / 1024);
    if (info) info.textContent = `Tamanho comprimido: ~${kb} KB`;
  });
};

window.previewNoticiaUrl = function(url) {
  const prev = document.getElementById('mImagemPreview');
  const img  = document.getElementById('mImagemPreviewImg');
  const pin  = document.getElementById('mNoticiaFocalPin');
  if (url) { prev.style.display = ''; img.src = url; if (pin) pin.style.display = 'block'; }
  else { prev.style.display = 'none'; }
};

window.selectImagePos = function(val) {
  document.getElementById('mImagemPos').value = val;
  document.querySelectorAll('#mPosGroup label').forEach(lbl => {
    const radio = lbl.querySelector('input[type=radio]');
    const isSelected = radio.value === val;
    radio.checked = isSelected;
    lbl.style.borderColor  = isSelected ? 'var(--blue)' : '#e2e8f0';
    lbl.style.background   = isSelected ? '#eff6ff'     : '#fff';
  });
};

document.getElementById('btnNovaNoticia')?.addEventListener('click', () => abrirModalNoticia());

window.saveNoticia = function(id) {
  const titulo = document.getElementById('mTitulo')?.value.trim();
  if (!titulo) { showToast('Introduza o título.', 'red'); return; }

  const status      = document.getElementById('mStatus')?.value || 'publicada';
  const scheduledAt = status === 'agendada' ? document.getElementById('mScheduledAt')?.value || '' : '';
  if (status === 'agendada' && !scheduledAt) { showToast('Escolha uma data e hora para agendar.', 'red'); return; }

  const dados = {
    titulo,
    categoria:  document.getElementById('mCat')?.value          || 'Resultado',
    data:       document.getElementById('mData')?.value          || new Date().toISOString().split('T')[0],
    resumo:     document.getElementById('mResumoEditor')?.innerHTML.trim() || '',
    imagem:     document.getElementById('mImagem')?.value.trim() || '',
    imagemPos:  document.getElementById('mImagemPos')?.value     || 'top',
    imagemSize: document.getElementById('mImagemSize')?.value    || 'cover',
    focalPos:   document.getElementById('mFocalPos')?.value      || 'center',
    publicada:  status === 'publicada',
    scheduledAt,
    destaque:   document.getElementById('mDestaque')?.checked    || false,
  };

  const lista = loadNoticias();

  if (id === null) {
    lista.unshift({ id: Date.now(), ...dados });
  } else {
    const idx = lista.findIndex(n => n.id == id);
    if (idx > -1) lista[idx] = { ...lista[idx], ...dados };
  }

  if (!saveNoticias(lista)) return;

  try { localStorage.removeItem('news_autosave'); } catch (e) {}
  const now = new Date().toISOString();
  const pub = lista.filter(n => n.publicada || (n.scheduledAt && n.scheduledAt <= now)).length;
  showToast(`${id === null ? 'Notícia criada' : 'Notícia actualizada'}! ${pub} visível(is) no site.`, 'green');
  renderNoticias();
  closeModal();
};

window.editNoticia = function(id) {
  const n = loadNoticias().find(n => n.id === id);
  if (n) abrirModalNoticia(n);
};

window.removeNoticia = function(id) {
  if (!confirm('Eliminar esta notícia?')) return;
  const lista = loadNoticias().filter(n => n.id !== id);
  saveNoticias(lista);
  renderNoticias();
  showToast('Notícia eliminada.', 'red');
};

window.toggleAgendamento = function() {
  const status = document.getElementById('mStatus')?.value;
  const wrap   = document.getElementById('mAgendamentoWrap');
  if (wrap) wrap.style.display = status === 'agendada' ? '' : 'none';
};

window.restoreNoticiaDraft = function() {
  try {
    const d = JSON.parse(localStorage.getItem('news_autosave') || 'null');
    if (!d) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const setHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val || ''; };
    const setChk  = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    set('mTitulo', d.titulo);
    set('mCat',    d.categoria);
    set('mData',   d.data);
    setHTML('mResumoEditor', d.resumo);
    set('mImagem', d.imagem);
    set('mImagemPos', d.imagemPos);
    set('mImagemSize', d.imagemSize);
    set('mFocalPos', d.focalPos);
    set('mStatus', d.status);
    set('mScheduledAt', d.scheduledAt);
    setChk('mDestaque', d.destaque);
    if (d.status === 'agendada') { const w = document.getElementById('mAgendamentoWrap'); if (w) w.style.display = ''; }
    if (d.imagem) { previewNoticiaUrl(d.imagem); }
    if (d.imagemPos) { selectImagePos(d.imagemPos); }
    modalBody.querySelector('[style*="fef9c3"]')?.remove();
    const ind = document.getElementById('mAutoSaveIndicator');
    if (ind) ind.textContent = 'Rascunho restaurado.';
  } catch (e) {}
};

window.discardNoticiaDraft = function() {
  try { localStorage.removeItem('news_autosave'); } catch (e) {}
  modalBody.querySelector('[style*="fef9c3"]')?.remove();
};

window.previewNoticiaForm = function() {
  const titulo = document.getElementById('mTitulo')?.value.trim();
  if (!titulo) { showToast('Introduza o título para pré-visualizar.', 'red'); return; }
  const dados = {
    id:         '__preview__',
    titulo,
    categoria:  document.getElementById('mCat')?.value          || '',
    data:       document.getElementById('mData')?.value          || '',
    resumo:     document.getElementById('mResumoEditor')?.innerHTML.trim() || '',
    imagem:     document.getElementById('mImagem')?.value.trim() || '',
    imagemPos:  document.getElementById('mImagemPos')?.value     || 'top',
    imagemSize: document.getElementById('mImagemSize')?.value    || 'cover',
    focalPos:   document.getElementById('mFocalPos')?.value      || 'center',
  };
  sessionStorage.setItem('news_preview', JSON.stringify(dados));
  window.open('../noticias.html?preview=1', '_blank');
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
  if (m.estado === 'Não lida') { m.estado = 'Lida'; _regPush('contacto', m.id, 'Lida'); saveDB(); renderMensagens(); updateBadges(); }
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
  _regPush('contacto', m.id, 'Respondida');
  saveDB();
  renderMensagens();
  updateBadges();
  showToast('Mensagem marcada como respondida.', 'green');
};

window.removeMensagem = function (id) {
  if (!confirm('Eliminar esta mensagem?')) return;
  const idx = DB.mensagens.findIndex(x => x.id === id);
  if (idx > -1) DB.mensagens.splice(idx, 1);
  _regDelete('contacto', id);
  saveDB();
  renderMensagens();
  updateBadges();
  showToast('Mensagem eliminada.', 'red');
};

// ==================================================
// ESCALÕES
// ==================================================

// Returns sorted <option> elements from DB.escaloes; falls back to defaults when empty.
// Pass includeAll=true to prepend a "Todos" option.
function _escOpts(current, includeAll) {
  let nomes = DB.escaloes.map(e => e.nome)
    .sort((a,b) => (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0));
  if (!nomes.length) nomes = ['Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19'];
  if (includeAll) nomes = ['Todos', ...nomes];
  return nomes.map(n => `<option${n===current?' selected':''}>${n}</option>`).join('');
}

// Refreshes all static escalão selects/tabs (plantelEscalao, filterJogoEscalao, atletasEscalaoTabs)
function _refreshEscalaoSelects() {
  const plantel = document.getElementById('plantelEscalao');
  if (plantel) {
    const cur = plantel.value;
    plantel.innerHTML = _escOpts(cur);
    if (!plantel.value) plantel.selectedIndex = 0;
  }
  const jogoFilter = document.getElementById('filterJogoEscalao');
  if (jogoFilter) {
    const cur = jogoFilter.value;
    jogoFilter.innerHTML = `<option value="">Todos os escalões</option>${_escOpts(cur)}`;
    if (!jogoFilter.value) jogoFilter.value = '';
  }
  const atTabs = document.getElementById('atletasEscalaoTabs');
  if (atTabs) {
    const nomes = DB.escaloes.map(e => e.nome)
      .sort((a,b) => (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0));
    const cur = _atletaEscalaoFiltro;
    atTabs.innerHTML = `<button class="tab-filter${!cur?' active':''}" data-escalao="">Todos</button>`
      + nomes.map(n => `<button class="tab-filter${n===cur?' active':''}" data-escalao="${n}">${n}</button>`).join('');
  }
}

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
  const SUB_OPTIONS = ['Sub-7','Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19','Sub-21','Sub-23'];
  openModal(idx >= 0 ? 'Editar Categoria' : 'Nova Categoria', `
    <div class="modal-row">
      <div class="modal-field"><label>Sub-escalão</label>
        <select class="form-input" id="eNome">
          ${SUB_OPTIONS.map(s=>`<option${s===e.nome?' selected':''}>${s}</option>`).join('')}
        </select></div>
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
  saveDB(); renderEscaloes(); closeModal(); _onEscaloesChanged();
  showToast(idx >= 0 ? 'Categoria atualizada!' : 'Categoria adicionada!', 'green');
};

window.deleteEscalao = function(idx) {
  if (!confirm('Eliminar esta categoria?')) return;
  DB.escaloes.splice(idx, 1);
  saveDB(); renderEscaloes(); _onEscaloesChanged();
  showToast('Categoria eliminada', 'red');
};

// Called whenever escalões are added/removed/renamed — refreshes all dependent UI
function _onEscaloesChanged() {
  _refreshEscalaoSelects();
  // Force formação tabs to rebuild on next visit
  const ft = document.getElementById('formacaoTabs');
  if (ft) ft.dataset.ready = '';
  // Validate _formacaoEscalao is still in list; reset to first if not
  const nomes = DB.escaloes.map(e => e.nome);
  if (nomes.length && !nomes.includes(_formacaoEscalao)) _formacaoEscalao = nomes[0];
}

// ==================================================
// JOGOS
// ==================================================
function fmtDataJogo(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function renderJogos(filterEscalao = '') {
  const scRe = /sport campinense|js campinense|campinense/i;

  const jogoRow = (j) => `
      <tr>
        <td>${fmtDataJogo(j.data)}<br/><span style="font-size:0.75rem;color:var(--gray-text)">${j.hora}</span></td>
        <td>${j.escalao}</td>
        <td style="${scRe.test(j.casa)?'font-weight:700;color:var(--blue)':''}">${j.casa}</td>
        <td style="${scRe.test(j.fora)?'font-weight:700;color:var(--blue)':''}">${j.fora}</td>
        <td style="text-align:center;font-size:1.1rem">${j.estado === 'Realizado'
          ? `<strong>${j.gcasa} – ${j.gfora}</strong>`
          : `<span style="color:var(--gray-text)">—</span>`}</td>
        <td style="font-size:0.8rem;color:var(--gray-text)">${j.local}</td>
        <td>
          <div class="btn-actions">
            ${j.estado === 'Agendado' ? `<button class="btn-icon btn-icon--green" onclick="registarResultado(${j.id})" title="Registar resultado">&#9999;</button>` : ''}
            <button class="btn-icon" onclick="editJogo(${j.id})" title="Editar">&#9998;</button>
            <button class="btn-icon btn-icon--red" onclick="removeJogo(${j.id})" title="Eliminar">&#128465;</button>
          </div>
        </td>
      </tr>`;

  let data = [...DB.jogos];
  if (filterEscalao) data = data.filter(j => j.escalao === filterEscalao);

  // Próximos jogos: agendados, mais próximo primeiro
  const prox = data.filter(j => j.estado !== 'Realizado')
    .sort((a, b) => a.data.localeCompare(b.data));
  // Últimos resultados: realizados, mais recente primeiro
  const res = data.filter(j => j.estado === 'Realizado')
    .sort((a, b) => b.data.localeCompare(a.data));

  const proxBody = document.querySelector('#jogosProxTable tbody');
  if (proxBody) {
    proxBody.innerHTML = prox.length ? prox.map(jogoRow).join('')
      : '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">Sem jogos agendados.</td></tr>';
  }
  const resBody = document.querySelector('#jogosTable tbody');
  if (resBody) {
    resBody.innerHTML = res.length ? res.map(jogoRow).join('')
      : '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">Sem resultados registados.</td></tr>';
  }
  const pc = document.getElementById('jogosProxCount');
  const rc = document.getElementById('jogosResCount');
  if (pc) pc.textContent = prox.length ? `(${prox.length})` : '';
  if (rc) rc.textContent = res.length ? `(${res.length})` : '';
}

document.getElementById('filterJogoEscalao')?.addEventListener('change', function () {
  renderJogos(this.value);
});

document.getElementById('btnNovoJogo')?.addEventListener('click', () => {
  openModal('Novo Jogo', `
    <div class="modal-row">
      <div class="modal-field"><label>Escalão *</label>
        <select id="mJEscalao">${_escOpts('')}</select>
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
        <select id="mJEscalao">${_escOpts(j.escalao)}</select>
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
  saveDB();
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
  saveDB();
  renderPatrocinadores();
  closeModal();
  showToast('Patrocinador actualizado!', 'green');
};

window.togglePatrocinador = function (id) {
  const p = DB.patrocinadores.find(x => x.id === id);
  if (!p) return;
  p.ativo = !p.ativo;
  saveDB();
  renderPatrocinadores();
  showToast(p.ativo ? 'Patrocinador activado.' : 'Patrocinador desactivado.', p.ativo ? 'green' : '');
};

window.removePatrocinador = function (id) {
  if (!confirm('Eliminar este patrocinador?')) return;
  const idx = DB.patrocinadores.findIndex(x => x.id === id);
  if (idx > -1) DB.patrocinadores.splice(idx, 1);
  saveDB();
  renderPatrocinadores();
  showToast('Patrocinador eliminado.', 'red');
};

// ==================================================
// CLASSIFICAÇÃO & JOGOS — MULTI-EQUIPA POR ESCALÃO
// ==================================================
// Config: cfg['Sub-17'].teams = { 'A': { nome, lastSync, nTeams, lastJogos, nJogos }, ... }
// Storage keys: fpf_class_Sub-17__A  /  fpf_jogos_Sub-17__A

const CLASS_ESCALOES   = ['Sub-17','Sub-15','Sub-13','Sub-19','Sub-11'];
const CLASS_CONFIG_KEY = 'fpf_sync_config';

function loadClassConfig()     { try { return JSON.parse(localStorage.getItem(CLASS_CONFIG_KEY)||'{}'); } catch(e){ return {}; } }
function saveClassConfig(cfg)  { localStorage.setItem(CLASS_CONFIG_KEY, JSON.stringify(cfg)); }

function teamStorageKey(escalao, teamKey, tipo) {
  // tipo: 'class' or 'jogos'
  const prefix = tipo === 'class' ? 'fpf_class_' : 'fpf_jogos_';
  return teamKey ? `${prefix}${escalao}__${teamKey}` : `${prefix}${escalao}`;
}

// ── Render sync rows ──────────────────────────────
function renderClassSyncRows() {
  const tbody = document.getElementById('fpfSyncRows');
  if (!tbody) return;
  const cfg = loadClassConfig();

  let html = '';
  for (const escalao of CLASS_ESCALOES) {
    const escCfg   = cfg[escalao] || {};
    const teams    = escCfg.teams  || {};
    const teamKeys = Object.keys(teams);

    const escLast = escCfg.lastSync
      ? `<span style="font-weight:400;font-size:0.7rem;opacity:0.8;margin-left:10px">últ. atualização: ${new Date(escCfg.lastSync).toLocaleDateString('pt-PT')}${escCfg.nTeams ? ' ('+escCfg.nTeams+' eq.)' : ''}</span>`
      : '';
    html += `<tr style="background:var(--blue);color:#fff">
      <td colspan="4" style="padding:8px 14px;font-weight:700;letter-spacing:0.5px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span>${escalao}${escLast}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" style="background:var(--yellow);color:#001b4d;border:none;font-weight:700"
            onclick="abrirColar('${escalao}','class','')">&#128203; Colar classificação</button>
          <button class="btn-sm" style="background:var(--yellow);color:#001b4d;border:none;font-weight:700"
            onclick="abrirColar('${escalao}','jogos','')">&#128197; Colar jogos</button>
          <button class="btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)"
            onclick="abrirEditorClass('${escalao}','')">&#9998; Manual</button>
          <button class="btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)"
            title="Para escalões com várias equipas/séries (ex: equipa A e B)"
            onclick="adicionarEquipa('${escalao}')">+ Equipa / Série</button>
        </span>
      </td>
    </tr>`;

    if (!teamKeys.length) {
      html += `<tr><td colspan="4" style="padding:10px 20px;color:#aaa;font-size:0.82rem;font-style:italic">
        Nenhuma equipa configurada — clique em "+ Equipa / Série" para adicionar.
      </td></tr>`;
    } else {
      for (const tk of teamKeys) {
        const t         = teams[tk];
        const lastClass = t.lastSync  ? new Date(t.lastSync).toLocaleDateString('pt-PT')  + (t.nTeams ? ` (${t.nTeams} eq.)` : '')  : '—';
        const lastJogos = t.lastJogos ? new Date(t.lastJogos).toLocaleDateString('pt-PT') + (t.nJogos ? ` (${t.nJogos} jg.)` : '')  : '—';
        html += `<tr style="border-bottom:1px solid #eee">
          <td style="padding:8px 14px 8px 24px;font-weight:700">${t.nome || tk}
            ${t.compLabel ? `<div style="font-size:0.72rem;color:#888;font-weight:400">${t.compLabel}</div>` : ''}
          </td>
          <td style="padding:8px 14px;font-size:0.8rem;color:#555">
            <span style="color:#999;font-size:0.7rem">Classificação</span><br>${lastClass}
          </td>
          <td style="padding:8px 14px;font-size:0.8rem;color:#555">
            <span style="color:#999;font-size:0.7rem">Jogos</span><br>${lastJogos}
          </td>
          <td style="padding:8px 14px;text-align:right;white-space:nowrap;display:flex;gap:5px;justify-content:flex-end">
            <button class="btn-sm" onclick="abrirColar('${escalao}','class','${tk}')">&#128203; Classificação</button>
            <button class="btn-sm" onclick="abrirEditorClass('${escalao}','${tk}')" title="Editar classificação manualmente">&#9998;</button>
            <button class="btn-sm" onclick="abrirColar('${escalao}','jogos','${tk}')">&#128197; Jogos</button>
            <button class="btn-sm" style="color:#c00" onclick="limparEquipa('${escalao}','${tk}')">&#x2715;</button>
          </td>
        </tr>`;
      }
    }
  }
  tbody.innerHTML = html;
}

// ── Editor manual de classificação ──────────────────────────────
let _edClassCtx = null; // { escalao, teamKey }

function abrirEditorClass(escalao, teamKey) {
  _edClassCtx = { escalao, teamKey };
  const key = teamStorageKey(escalao, teamKey, 'class');
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
  if (!rows.length) rows = [{ equipa: 'Sport Campinense', j:0, v:0, e:0, d:0, gm:0, gs:0, forma:'' }];

  const cfg  = loadClassConfig();
  const tNome = teamKey ? (cfg[escalao]?.teams?.[teamKey]?.nome || teamKey) : '';

  openModal(`Editar Classificação — ${escalao}${tNome ? ' · ' + tNome : ''}`, `
    <p style="font-size:0.78rem;color:#888;margin:0 0 10px">
      Pontos calculados automaticamente (V×3 + E). "Forma" é opcional — últimas jornadas com V, E ou D (ex: VVEDV).
    </p>
    <div style="overflow-x:auto">
      <table class="table" id="edClassTable" style="min-width:640px">
        <thead><tr>
          <th style="min-width:180px">Equipa</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>Forma</th><th></th>
        </tr></thead>
        <tbody>${rows.map(_edClassRowHTML).join('')}</tbody>
      </table>
    </div>
    <button type="button" class="btn-sm" style="margin-top:10px" onclick="edClassAddRow()">+ Adicionar equipa</button>
  `, `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-save" onclick="salvarEditorClass()">Guardar classificação</button>`);
}

function _edClassRowHTML(t) {
  const num = (v) => v == null ? 0 : v;
  const esc = (s) => String(s || '').replace(/"/g, '&quot;');
  return `<tr>
    <td><input class="form-input ed-equipa" value="${esc(t.equipa)}" placeholder="Nome da equipa" style="min-width:170px"></td>
    <td><input class="form-input ed-j"  type="number" min="0" value="${num(t.j)}"  style="width:56px"></td>
    <td><input class="form-input ed-v"  type="number" min="0" value="${num(t.v)}"  style="width:56px"></td>
    <td><input class="form-input ed-e"  type="number" min="0" value="${num(t.e)}"  style="width:56px"></td>
    <td><input class="form-input ed-d"  type="number" min="0" value="${num(t.d)}"  style="width:56px"></td>
    <td><input class="form-input ed-gm" type="number" min="0" value="${num(t.gm)}" style="width:56px"></td>
    <td><input class="form-input ed-gs" type="number" min="0" value="${num(t.gs)}" style="width:56px"></td>
    <td><input class="form-input ed-forma" value="${esc(t.forma)}" placeholder="VVEDV" maxlength="5" style="width:76px;text-transform:uppercase"></td>
    <td><button type="button" class="btn-sm" style="color:#c00" title="Remover linha"
      onclick="this.closest('tr').remove()">&#x2715;</button></td>
  </tr>`;
}

function edClassAddRow() {
  const tbody = document.querySelector('#edClassTable tbody');
  if (tbody) tbody.insertAdjacentHTML('beforeend', _edClassRowHTML({ equipa:'', j:0, v:0, e:0, d:0, gm:0, gs:0, forma:'' }));
}

function _abrevEquipa(nome) {
  const stop = /^(de|da|do|dos|das|e|a|o)$/i;
  const words = (nome || '').split(/\s+/).filter(w => w && !stop.test(w));
  if (!words.length) return '???';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').slice(0, 3).toUpperCase();
}

function salvarEditorClass() {
  if (!_edClassCtx) return;
  const { escalao, teamKey } = _edClassCtx;

  const rows = [];
  document.querySelectorAll('#edClassTable tbody tr').forEach(tr => {
    const g = (cls) => tr.querySelector('.' + cls);
    const equipa = g('ed-equipa').value.trim();
    if (!equipa) return;
    const n = (cls) => Math.max(0, parseInt(g(cls).value, 10) || 0);
    const forma = g('ed-forma').value.trim().toUpperCase().replace(/[^VED]/g, '').slice(0, 5);
    rows.push({
      equipa,
      abrev: _abrevEquipa(equipa),
      j: n('ed-j'), v: n('ed-v'), e: n('ed-e'), d: n('ed-d'),
      gm: n('ed-gm'), gs: n('ed-gs'),
      forma,
      sc: /campinense/i.test(equipa),
    });
  });

  if (!rows.length) { showToast('Adicione pelo menos uma equipa', 'red'); return; }

  const key = teamStorageKey(escalao, teamKey, 'class');
  localStorage.setItem(key, JSON.stringify(rows));

  // Registar data de atualização para o badge "última sincronização"
  const cfg = loadClassConfig();
  if (teamKey) {
    cfg[escalao] = cfg[escalao] || {};
    cfg[escalao].teams = cfg[escalao].teams || {};
    cfg[escalao].teams[teamKey] = cfg[escalao].teams[teamKey] || { nome: teamKey };
    cfg[escalao].teams[teamKey].lastSync = new Date().toISOString();
    cfg[escalao].teams[teamKey].nTeams   = rows.length;
  } else {
    cfg[escalao] = cfg[escalao] || {};
    cfg[escalao].lastSync = new Date().toISOString();
    cfg[escalao].nTeams   = rows.length;
  }
  saveClassConfig(cfg);

  closeModal();
  renderClassSyncRows();
  showToast(`Classificação de ${escalao} guardada (${rows.length} equipas)`, 'green');
}

document.getElementById('btnImportarFPF')?.addEventListener('click', () => {
  const panel = document.getElementById('fpfImportPanel');
  const open  = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) renderClassSyncRows();
});

// ── HTML clipboard paste for standings / results ──────────────────────────────
// When the user copies a ZeroZero (or AF Algarve) page, the clipboard has rich
// HTML with proper <table> structure. Parse that directly instead of messy text.
(function() {
  const ta = document.getElementById('colarClassTA');
  if (!ta) return;
  ta.addEventListener('paste', function(e) {
    const html = e.clipboardData?.getData('text/html');
    if (!html || html.length < 300) {
      // Plain-text paste — let it land in the textarea, then preview automatically
      setTimeout(previewColarClass, 120);
      return;
    }
    e.preventDefault();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = _htmlToStructuredText(doc);
    if (text.trim().length > 20) {
      ta.value = text;
      setTimeout(previewColarClass, 80);
    }
  });
})();

// Extract structured text from HTML: tables → tab-separated rows, divs → newlines
function _htmlToStructuredText(doc) {
  // Remove clutter
  doc.querySelectorAll('script,style,noscript,nav,footer,header,iframe,button,input,select').forEach(el => el.remove());

  const blocks = [];

  // Process tables first — most reliable for standings & tab-separated results
  for (const table of doc.querySelectorAll('table')) {
    const rows = [];
    for (const tr of table.querySelectorAll('tr')) {
      const cells = Array.from(tr.querySelectorAll('td,th'))
        .map(c => {
          const text = c.textContent.replace(/\s+/g, ' ').trim();
          // Capture team logo URLs from img-only cells (no meaningful text)
          if (!text) {
            const img = c.querySelector('img[src]');
            if (img && /^https?:\/\//.test(img.src)) return `[img:${img.src}]`;
          }
          return text;
        })
        .filter(Boolean);
      if (cells.length >= 3) rows.push(cells.join('\t'));
    }
    if (rows.length >= 2) { blocks.push(rows.join('\n')); table.remove(); }
  }

  // Also include remaining text content (for non-table match lists)
  const rest = _docToText(doc);
  if (rest.trim().length > 30) blocks.push(rest.trim());

  return blocks.join('\n\n');
}

// ── Adicionar / remover equipa ────────────────────
window.adicionarEquipa = function(escalao) {
  const nome = prompt(`Nome da equipa ou série em ${escalao}:\n(ex: "Equipa A", "Série Norte", "Divisão 2")`);
  if (!nome || !nome.trim()) return;
  const cfg = loadClassConfig();
  if (!cfg[escalao]) cfg[escalao] = {};
  if (!cfg[escalao].teams) cfg[escalao].teams = {};
  const tk = nome.trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,20) || ('t'+Date.now());
  if (cfg[escalao].teams[tk]) { showToast('Já existe uma equipa com esse nome', 'red'); return; }
  cfg[escalao].teams[tk] = { nome: nome.trim(), compLabel: '' };
  saveClassConfig(cfg);
  renderClassSyncRows();
  showToast(`${escalao}: "${nome.trim()}" adicionada`, 'green');
};

window.limparEquipa = function(escalao, tk) {
  const cfg  = loadClassConfig();
  const nome = cfg[escalao]?.teams?.[tk]?.nome || tk;
  if (!confirm(`Remover "${nome}" (${escalao})? Todos os dados serão apagados.`)) return;
  localStorage.removeItem(teamStorageKey(escalao, tk, 'class'));
  localStorage.removeItem(teamStorageKey(escalao, tk, 'jogos'));
  if (cfg[escalao]?.teams) delete cfg[escalao].teams[tk];
  saveClassConfig(cfg);
  renderClassSyncRows();
  showToast(`${escalao}: "${nome}" removida`, 'green');
};

// ── Modal unificado ───────────────────────────────
let _colarEscalao = '';
let _colarMode    = 'class';
let _colarTeam    = '';

const COLAR_CONFIG = {
  class: {
    title: (esc, team) => `Colar Classificação — ${esc}${team ? ' · '+team : ''}`,
    hint: `Funciona com <strong>AF Algarve</strong> e <strong>ZeroZero</strong>:<br>
           • <strong>AF Algarve:</strong> vai a <a href="https://afalgarve.pt/competicoes/" target="_blank" rel="noopener">afalgarve.pt/competicoes/</a>, abre a classificação, seleciona tudo (Ctrl+A) e copia.<br>
           • <strong>ZeroZero:</strong> vai à página da competição → separador <em>Classificação</em>, seleciona a tabela e copia.`,
    ph:   'Cole aqui o texto copiado da tabela de classificação (AF Algarve ou ZeroZero)...',
  },
  jogos: {
    title: (esc, team) => `Colar Jogos — ${esc}${team ? ' · '+team : ''}`,
    hint: `Funciona com <strong>AF Algarve</strong> e <strong>ZeroZero</strong>:<br>
           • <strong>AF Algarve:</strong> vai ao calendário da competição, seleciona as linhas dos jogos e copia.<br>
           • <strong>ZeroZero:</strong> vai à página da equipa → separador <em>Jogos</em> ou <em>Calendário</em>, seleciona tudo e copia.`,
    ph:   'Cole aqui o texto copiado dos jogos (AF Algarve ou ZeroZero)...',
  },
};

window.abrirColar = function(escalao, mode, teamKey) {
  _colarEscalao = escalao;
  _colarMode    = mode;
  _colarTeam    = teamKey || '';
  const cfg  = loadClassConfig();
  const teamNome = teamKey ? (cfg[escalao]?.teams?.[teamKey]?.nome || teamKey) : '';
  const c    = COLAR_CONFIG[mode];
  const m    = document.getElementById('colarClassModal');
  if (!m || !c) return;
  m.querySelector('#colarClassTitle').textContent  = c.title(escalao, teamNome);
  m.querySelector('#colarClassHint').innerHTML      = c.hint;
  m.querySelector('#colarClassTA').value            = '';
  m.querySelector('#colarClassTA').placeholder      = c.ph;
  m.querySelector('#colarClassPreview').innerHTML   = '';
  m.style.display = 'flex';
};

window.fecharColarClass = function() {
  const m = document.getElementById('colarClassModal');
  if (m) m.style.display = 'none';
};

// ── Parsers ───────────────────────────────────────
function _makeClassRow(nome, nums, rowCount, ptsFirst) {
  // Strip optional leading position number (1, 2, 3…) if sequential
  let seq = nums;
  if (seq.length >= 8 && seq[0] === rowCount + 1) seq = seq.slice(1);
  if (seq.length < 7) return null;
  let j, v, e, d, gm, gs, pts;
  if (ptsFirst) {
    // ZeroZero column order: Pts J V E D GM GS DG
    [pts, j, v, e, d, gm, gs] = seq;
  } else if (seq.length >= 8) {
    [j, v, e, d, gm, gs, , pts] = seq; // skip DG column
  } else {
    [j, v, e, d, gm, gs, pts] = seq;
  }
  // Sanity: J should equal V+E+D (±2 for walkovers/rounding)
  if (Math.abs(j - (v + e + d)) > 2) {
    // Fallback 1: try Pts-first ordering (ZeroZero without detected header)
    let [pts2, j2, v2, e2, d2, gm2, gs2] = seq;
    if (!ptsFirst && Math.abs(j2 - (v2 + e2 + d2)) <= 2) {
      pts = pts2; j = j2; v = v2; e = e2; d = d2; gm = gm2; gs = gs2;
    } else if (ptsFirst && seq.length >= 8) {
      // Fallback 2: header said Pts-first but row is J-first (mixed copy)
      let [j3, v3, e3, d3, gm3, gs3, , pts3] = seq;
      if (Math.abs(j3 - (v3 + e3 + d3)) <= 2) {
        j = j3; v = v3; e = e3; d = d3; gm = gm3; gs = gs3; pts = pts3 || 0;
      } else return null;
    } else return null;
  }
  nome = nome.replace(/[*°º]/g, '').trim();
  if (!nome || nome.length < 2) return null;
  return {
    equipa: nome,
    abrev: nome.replace(/^(fc|sc|cd|cf|sl|gd|os|ad|af)\s*/i, '').slice(0, 3).toUpperCase(),
    j: j||0, v: v||0, e: e||0, d: d||0, gm: gm||0, gs: gs||0,
    dg: (gm||0)-(gs||0), pts: pts||0, forma: ''
  };
}

// Parse a single token into a class stat integer, returns null if not a stat number
function _classNum(p) {
  const n = parseInt((p || '').replace(/[^\d\-]/g, ''));
  return isNaN(n) ? null : n;
}

// Decide whether a token is a team-name word (not a stat/code/flag)
function _isNameWord(p) {
  if (!p) return false;
  if (/^[-+]?\d+$/.test(p)) return false;                // pure number
  if (/^[A-ZÁÉÍÓÚ]{2,4}$/.test(p)) return false;        // team code e.g. OLH
  if (/^[\u{1F1E0}-\u{1F1FF}]{2}/u.test(p)) return false; // flag emoji
  return p.replace(/[^a-zA-ZÀ-ž\s\-]/g, '').trim().length > 1;
}

function parsePastedTable(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows  = [];

  // Detect ZeroZero's Pts-first column order from header "P J V E D GM GS DG"
  let ptsFirst = false;
  for (const line of lines) {
    if (/\d/.test(line) && !/^\[img:/.test(line) && !/^\d{1,2}$/.test(line)) break;
    const hp = (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/))
      .map(p => p.trim()).filter(Boolean);
    if (hp.length >= 7 && /^P(ts)?$/i.test(hp[0]) && /^J$/i.test(hp[1])) {
      ptsFirst = true; break;
    }
  }

  // ── Strategy 1: tab-separated or multi-space-separated rows ──────────────
  // Also handles ZeroZero's block layout where position, logo, abbreviation
  // and team name each appear on their own line above the stats line.
  let pendingPos  = null; // position number seen alone on its own line
  let pendingLogo = '';   // [img:...] seen alone on its own line
  let pendingName = '';   // team name seen alone on its own line
  for (const line of lines) {
    // Standalone position number (1–30) → hold for the next team line
    if (/^\d{1,2}$/.test(line) && parseInt(line) <= 30) {
      pendingPos = parseInt(line); pendingName = ''; continue;
    }
    // Standalone [img:...] → hold logo for the next team line
    if (/^\[img:https?:\/\//.test(line)) {
      pendingLogo = line.slice(5, -1); continue;
    }
    // Standalone team abbreviation (SLB, SCP...) → ignore, keep pendings
    if (/^[A-ZÁÉÍÓÚ]{2,4}$/.test(line)) continue;

    let parts = line.includes('\t')
      ? line.split('\t').map(p => p.trim())
      : line.split(/\s{2,}/).map(p => p.trim());
    parts = parts.filter(Boolean);
    if (parts.length < 4) {
      // Short non-numeric line after a position → team name on its own line
      if (pendingPos !== null && !/\d/.test(line) && _isNameWord(line)) {
        pendingName = pendingName ? pendingName + ' ' + line : line;
      }
      continue;
    }
    if (parts.every(p => !/\d/.test(p) && !/^\[img:/.test(p))) {
      pendingPos = null; pendingName = ''; continue; // header/label row
    }

    // Extract logo URL from any inline [img:...] token, or use pending logo
    let logoUrl = pendingLogo;
    pendingLogo = '';
    parts = parts.filter(p => {
      if (/^\[img:/.test(p)) { logoUrl = p.slice(5, -1); return false; }
      return true;
    });

    const nameIdx = parts.findIndex(_isNameWord);
    let name, endIdx;
    if (nameIdx < 0) {
      // Stats-only line: use the name collected from previous lines (ZeroZero block layout)
      if (!pendingName) { pendingPos = null; continue; }
      name = pendingName;
      endIdx = 0;
    } else {
      // Team name may span consecutive name-word parts
      name = parts[nameIdx];
      endIdx = nameIdx + 1;
      while (endIdx < parts.length && _isNameWord(parts[endIdx])) {
        name += ' ' + parts[endIdx++];
      }
    }
    let nums = (nameIdx < 0 ? parts : parts.filter((_, i) => i < nameIdx || i >= endIdx))
      .map(p => _classNum(p)).filter(n => n !== null);
    // Prepend pending position if not already the first num
    if (pendingPos !== null) {
      if (nums.length === 0 || nums[0] !== pendingPos) nums = [pendingPos, ...nums];
      pendingPos = null;
    }
    pendingName = '';
    const row = _makeClassRow(name, nums, rows.length, ptsFirst);
    if (row) { if (logoUrl) row.logo = logoUrl; rows.push(row); }
  }
  if (rows.length > 0) return rows;

  // ── Strategy 2: single-space-separated on one line ───────────────────────
  // e.g. "1 Sport Campinense 14 10 2 2 35 16 +19 32"
  for (const line of lines) {
    if (line.includes('\t') || line.split(/\s{2,}/).length > 2) continue;
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 8) continue;
    if (tokens.every(t => !/\d/.test(t))) continue;
    let start = 0;
    if (/^\d{1,2}$/.test(tokens[0]) && parseInt(tokens[0]) < 30) start = 1;
    const nameWords = [];
    let numBuf = [];
    for (let i = start; i < tokens.length; i++) {
      const n = _classNum(tokens[i]);
      if (n !== null) {
        numBuf.push(n);
      } else if (_isNameWord(tokens[i])) {
        if (numBuf.length >= 7) break;
        nameWords.push(tokens[i]);
        numBuf = [];
      }
    }
    if (nameWords.length === 0 || numBuf.length < 7) continue;
    const pos = start === 1 ? parseInt(tokens[0]) : rows.length + 1;
    const nums = pos < 30 ? [pos, ...numBuf] : numBuf;
    const row = _makeClassRow(nameWords.join(' '), nums, rows.length, ptsFirst);
    if (row) rows.push(row);
  }
  if (rows.length > 0) return rows;

  // ── Strategy 3: vertical (one value per line) ────────────────────────────
  // Each cell is on its own line. Group into classification rows.
  let i = 0;
  while (i < lines.length) {
    const posMatch = lines[i].match(/^\d{1,2}$/);
    if (!posMatch || parseInt(lines[i]) !== rows.length + 1 || parseInt(lines[i]) > 30) { i++; continue; }
    const expectedPos = parseInt(lines[i]);
    i++;
    // Skip optional [img:...] logo line and 2-4 uppercase abbreviation
    let logoUrl3 = '';
    if (i < lines.length && /^\[img:https?:\/\//.test(lines[i])) {
      logoUrl3 = lines[i].slice(5, -1); i++;
    }
    if (i < lines.length && /^[A-ZÁÉÍÓÚ]{2,4}$/.test(lines[i])) i++;
    // Collect name tokens (non-numeric, non-[img] lines)
    const nameTokens = [];
    while (i < lines.length && !(/^\d/.test(lines[i])) && !/^\[img:/.test(lines[i]) && _isNameWord(lines[i])) {
      nameTokens.push(lines[i++]);
    }
    if (!nameTokens.length) continue;
    // Collect stat numbers — stop before the next sequential position number,
    // but only after collecting at least 7 stats (avoids D=2 or E=1 false matches).
    const nums = [];
    while (i < lines.length && nums.length < 9) {
      const line = lines[i];
      if (nums.length >= 7 && /^\d{1,2}$/.test(line) && parseInt(line) === rows.length + 2) break;
      const n = _classNum(line);
      if (n !== null) { nums.push(n); i++; }
      else break;
    }
    const row = _makeClassRow(nameTokens.join(' '), [expectedPos, ...nums], rows.length, ptsFirst);
    if (row) { if (logoUrl3) row.logo = logoUrl3; rows.push(row); }
  }
  return rows;
}

function markSCRows(arr) {
  const SC = ['sport campinense','campinense','js campinense'];
  return arr.map(r => ({ ...r, sc: SC.some(n=>(r.equipa||'').toLowerCase().includes(n))||undefined }));
}

const MESES_PT = { jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12,
  janeiro:1,fevereiro:2,'março':3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };

function parseDate(s) {
  s=(s||'').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){const yr=m[3].length===2?'20'+m[3]:m[3];return `${yr}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
  // Short DD/MM — only accept "/" separator: "3-1" looks like a score, not a date
  m=s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if(m) return `2026-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})\s+([A-Za-zÀ-ž]+)(?:\s+(\d{2,4}))?$/);
  if(m){const mo=MESES_PT[(m[2]||'').toLowerCase().slice(0,3)];if(mo){const yr=m[3]?(m[3].length===2?'20'+m[3]:m[3]):'2026';return `${yr}-${String(mo).padStart(2,'0')}-${m[1].padStart(2,'0')}`;}}
  return null;
}
function parseTime(s) {
  s=(s||'').trim(); const m=s.match(/^(\d{1,2})[h:](\d{2})$/i);
  if(!m) return null; const h=parseInt(m[1]),mi=parseInt(m[2]);
  if(h>23||mi>59) return null; return `${String(h).padStart(2,'0')}:${m[2]}`;
}
function parseScore(s) {
  s=(s||'').trim();
  // Handle en-dash and em-dash as well as hyphen
  s = s.replace(/[–—]/g, '-');
  const m=s.match(/^(\d{1,3})\s*[-:]\s*(\d{1,3})$/);
  if(!m) return null; if(parseTime(s)) return null;
  return { gcasa:parseInt(m[1]), gfora:parseInt(m[2]) };
}

// ZeroZero format: date on own line, then optionally time, then home, score/–, away, [local]
function parseZZJogos(lines, next) {
  const jogos = [];
  const junkRe = /^(jogos|calendário|resultados|jornada|época|competição|equipa|©|filtrar|anterior|próximo|zerozero)/i;
  for (let i = 0; i < lines.length; i++) {
    const d = parseDate(lines[i]);
    // Skip lines that are scores (e.g. "3-1") — parseDate can match them as short DD-MM dates
    if (!d || !/^\d{1,2}/.test(lines[i].trim()) || parseScore(lines[i])) continue;
    let j = i + 1;
    let hora = '15:00', casa = '', fora = '', score = null;
    // optional time
    if (j < lines.length && parseTime(lines[j])) { hora = parseTime(lines[j]) || hora; j++; }
    // home team
    if (j < lines.length && !parseDate(lines[j]) && !parseScore(lines[j]) && !parseTime(lines[j]) && !junkRe.test(lines[j])) {
      casa = lines[j].trim(); j++;
    }
    // score or separator
    if (j < lines.length) {
      const sc = parseScore(lines[j]);
      if (sc) { score = sc; j++; }
      else if (/^[-–]$/.test(lines[j].trim())) j++; // separator
    }
    // away team
    if (j < lines.length && !parseDate(lines[j]) && !parseScore(lines[j]) && !parseTime(lines[j]) && !junkRe.test(lines[j])) {
      fora = lines[j].trim(); j++;
    }
    if (!casa || !fora || casa === fora) continue;
    jogos.push({ id: next(), casa, fora, gcasa: score?.gcasa ?? null, gfora: score?.gfora ?? null,
      data: d, hora, local: '', estado: score ? 'Realizado' : 'Agendado' });
  }
  return jogos;
}

// ── Resolução de logos → nomes de equipas ─────────
// O ZeroZero cola jogos só com logos ([img:...]) sem nomes em texto.
// Se a classificação já foi importada (com logos), reconhecemos as
// equipas pelo id do logo e recuperamos os nomes.
function _logoId(url) {
  const m = (url || '').match(/equipas\/(\d+)_/);
  return m ? m[1] : (url || '').split('?')[0];
}

function _logoTeamMaps() {
  const idToName = {}, nameToLogo = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('fpf_class_')) continue;
    try {
      JSON.parse(localStorage.getItem(k) || '[]').forEach(r => {
        if (r.equipa && r.logo) {
          idToName[_logoId(r.logo)] = r.equipa;
          nameToLogo[r.equipa.toLowerCase()] = r.logo;
        }
      });
    } catch(e) {}
  }
  // db_logos (nome → url) também conta
  try {
    const logos = JSON.parse(localStorage.getItem('db_logos') || '{}');
    Object.entries(logos).forEach(([nome, url]) => {
      if (!nameToLogo[nome]) nameToLogo[nome] = url;
      const id = _logoId(url);
      if (!idToName[id]) idToName[id] = nome.replace(/\b\w/g, c => c.toUpperCase());
    });
  } catch(e) {}
  return { idToName, nameToLogo };
}

let _lastJogosUnresolved = 0; // equipas não reconhecidas na última colagem

function _resolveImgTeamTokens(text) {
  const { idToName } = _logoTeamMaps();
  _lastJogosUnresolved = 0;
  return text.replace(/\[img:(https?:[^\]\s]+)\]/g, (m, url) => {
    const nome = idToName[_logoId(url)];
    if (nome) return nome;
    _lastJogosUnresolved++;
    return '';
  });
}

function _attachJogoLogos(jogos) {
  const { nameToLogo } = _logoTeamMaps();
  jogos.forEach(j => {
    j.logoCasa = nameToLogo[(j.casa || '').toLowerCase()] || '';
    j.logoFora = nameToLogo[(j.fora || '').toLowerCase()] || '';
  });
  return jogos;
}

function parsePastedJogos(text) {
  // Substituir tokens [img:...] pelos nomes das equipas (via classificação importada)
  text = _resolveImgTeamTokens(text);
  const raw = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const idBase = { v: Date.now() };
  const next = () => idBase.v++;
  // ZeroZero detection: date lines (DD/MM/YYYY or "22 mar 2026") followed by team names on separate lines
  const dateFirstLines = raw.filter((l,i) => parseDate(l) && !parseScore(l) && /^\d{1,2}/.test(l) && i+1<raw.length && !parseDate(raw[i+1]) && !parseScore(raw[i+1]));
  if (dateFirstLines.length > 0) {
    const zzResult = parseZZJogos(raw, next);
    if (zzResult.length > 0) return _attachJogoLogos(zzResult);
  }
  const dateOnlyLines = raw.filter(l=>/^\d{1,2}\s+[A-Za-zÀ-ž]{3,}(\s+\d{4})?$/.test(l)&&parseDate(l));
  if (dateOnlyLines.length > 0) return _attachJogoLogos(parseMultiLineJogos(raw, next));
  return _attachJogoLogos(parseSingleLineJogos(raw, next));
}

function parseMultiLineJogos(lines, next) {
  const jogos = [];
  const dateIdxs = [];
  for (let i=0;i<lines.length;i++) { if(parseDate(lines[i])&&/^\d{1,2}[\s\/\-]/.test(lines[i])) dateIdxs.push(i); }
  for (const d of dateIdxs) {
    if(d<1||d+2>=lines.length) continue;
    const home=lines[d-1].trim(), dateStr=parseDate(lines[d]), mid=lines[d+1].trim(), away=lines[d+2].trim(), venueRaw=lines[d+3]||'';
    const timeObj=parseTime(mid), scoreObj=!timeObj?parseScore(mid):null;
    if(parseDate(home)||parseDate(away)||parseTime(home)||parseScore(home)) continue;
    const nextDateIdx=dateIdxs.find(i=>i>d);
    const venueIsGame=nextDateIdx!==undefined&&nextDateIdx<=d+4;
    const local=(!venueIsGame&&venueRaw&&!parseDate(venueRaw)&&!parseTime(venueRaw)&&!parseScore(venueRaw))?venueRaw.trim():'';
    jogos.push({ id:next(),casa:home,fora:away,gcasa:scoreObj?scoreObj.gcasa:null,gfora:scoreObj?scoreObj.gfora:null,data:dateStr,hora:timeObj||'15:00',local,estado:scoreObj?'Realizado':'Agendado' });
  }
  return jogos;
}

function parseSingleLineJogos(lines, next) {
  const jogos = [];
  for (const line of lines) {
    let parts=line.includes('\t')?line.split('\t').map(p=>p.trim()):line.split(/\s{2,}/).map(p=>p.trim());
    // Remove standalone dashes (score placeholder for unplayed games) and
    // junk tokens (h2h link text, estado words) so they are never mistaken
    // for a team name or local
    parts=parts.filter(Boolean);
    // Jogos anulados/cancelados (ZeroZero marca com ANU/CAN) não são importados
    if (parts.some(p=>/^(anu|anulado|can|cancelado)$/i.test(p))) continue;
    parts=parts
      .filter(p=>!/^[-–—]$/.test(p))
      .filter(p=>!/^(h2h|realizado|agendado|adiado|adi|encerrado|int|interrompido)$/i.test(p))
      .filter(p=>!/^[VED]$/.test(p)); // letras de forma (V/E/D) do ZeroZero
    if(parts.length<3) continue;
    let dateIdx=-1,scoreIdx=-1,timeIdx=-1;
    for(let i=0;i<parts.length;i++){
      if(dateIdx<0&&parseDate(parts[i])){dateIdx=i;continue;}
      if(scoreIdx<0&&parseScore(parts[i])){scoreIdx=i;continue;}
      if(timeIdx<0&&parseTime(parts[i])){timeIdx=i;continue;}
    }
    if(dateIdx<0) continue;
    const dateStr=parseDate(parts[dateIdx]),horaStr=timeIdx>=0?parseTime(parts[timeIdx]):'15:00',scoreObj=scoreIdx>=0?parseScore(parts[scoreIdx]):null;
    const used=new Set([dateIdx,scoreIdx,timeIdx].filter(i=>i>=0));
    const rest=parts.filter((_,i)=>!used.has(i));
    let casa,fora,local;
    if(scoreIdx>=0){
      let prev=-1,nx=-1;
      for(let i=scoreIdx-1;i>=0;i--){if(!used.has(i)){prev=i;break;}}
      for(let i=scoreIdx+1;i<parts.length;i++){if(!used.has(i)){nx=i;break;}}
      casa=prev>=0?parts[prev]:rest[0]; fora=nx>=0?parts[nx]:rest[1];
      const ti=new Set([prev,nx].filter(i=>i>=0));
      local=parts.filter((_,i)=>!used.has(i)&&!ti.has(i))[0]||'';
    } else {
      const vsIdx=rest.findIndex(p=>/^vs\.?$/i.test(p));
      if(vsIdx>=0){casa=rest.slice(0,vsIdx).join(' ');fora=rest.slice(vsIdx+1).join(' ');local='';}
      else{[casa='',fora='',local='']=rest;}
    }
    if(!casa||!fora) continue;
    jogos.push({ id:next(),casa:casa.trim(),fora:fora.trim(),gcasa:scoreObj?scoreObj.gcasa:null,gfora:scoreObj?scoreObj.gfora:null,data:dateStr,hora:horaStr,local:(local||'').trim(),estado:scoreObj?'Realizado':'Agendado' });
  }
  return jogos;
}

// ── Pré-visualizar ────────────────────────────────
window.previewColarClass = function() {
  const ta=document.getElementById('colarClassTA'), div=document.getElementById('colarClassPreview');
  if(!ta||!div) return;
  if (_colarMode === 'class') {
    const rows = parsePastedTable(ta.value);
    if (!rows.length) {
      const nLines = ta.value.split('\n').filter(l => l.trim()).length;
      const nNums  = (ta.value.match(/\d+/g) || []).length;
      div.innerHTML = `<div style="color:#c00;font-size:0.85rem;line-height:1.6">
        &#9888; <strong>Não foi possível reconhecer dados de classificação</strong> (${nLines} linhas, ${nNums} números detetados).<br>
        Dicas:<br>
        &bull; Seleciona a tabela <strong>inteira</strong> no site — do "1º" até à última equipa, incluindo todas as colunas de números (J, V, E, D, golos, pontos)<br>
        &bull; Cola diretamente com <strong>Ctrl+V</strong> (não uses "colar sem formatação")<br>
        &bull; No telemóvel pode não funcionar — usa um computador ou o botão <strong>&#9998; Editar manualmente</strong><br>
        &bull; Se continuar a falhar, o <strong>&#9998; Editar manualmente</strong> permite inserir a tabela à mão em 2 minutos</div>`;
      return;
    }
    const marked = markSCRows(rows);
    const hasLogos = rows.some(r => r.logo);
    div.innerHTML = `<p style="color:#22a75e;font-size:0.85rem;margin-bottom:8px">&#10003; ${rows.length} equipas reconhecidas${hasLogos?' · logos detectados':''}</p>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8rem">
      <thead><tr style="background:#001b4d;color:#fff">
        <th style="padding:5px 8px">#</th>
        ${hasLogos?'<th style="padding:5px 8px">Logo</th>':''}
        <th style="padding:5px 8px;text-align:left">Equipa</th>
        <th style="padding:5px 8px">J</th><th style="padding:5px 8px">V</th><th style="padding:5px 8px">E</th><th style="padding:5px 8px">D</th>
        <th style="padding:5px 8px">GM</th><th style="padding:5px 8px">GS</th>
        <th style="padding:5px 8px" title="Pontos armazenados (inclui 1ª fase se copiado do ZeroZero)">Pts</th>
      </tr></thead>
      <tbody>${marked.map((r,i)=>`<tr style="background:${r.sc?'rgba(255,209,0,0.12)':i%2===0?'#f9f9f9':'#fff'};${r.sc?'font-weight:700':''}">
        <td style="padding:4px 8px;text-align:center">${i+1}</td>
        ${hasLogos?`<td style="padding:4px 8px;text-align:center">${r.logo?`<img src="${r.logo}" style="width:22px;height:22px;object-fit:contain" onerror="this.style.opacity=0.2">`:'—'}</td>`:''}
        <td style="padding:4px 8px">${r.equipa}${r.sc?' &#11088;':''}</td>
        <td style="padding:4px 8px;text-align:center">${r.j}</td><td style="padding:4px 8px;text-align:center">${r.v}</td>
        <td style="padding:4px 8px;text-align:center">${r.e}</td><td style="padding:4px 8px;text-align:center">${r.d}</td>
        <td style="padding:4px 8px;text-align:center">${r.gm}</td><td style="padding:4px 8px;text-align:center">${r.gs}</td>
        <td style="padding:4px 8px;text-align:center;font-weight:700;color:#001b4d">${r.pts}</td>
      </tr>`).join('')}</tbody></table></div>
    <div style="margin-top:14px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:12px">
      <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px;color:#7a5700">&#43; Pontos da 1ª Fase (carregados para a 2ª fase)</div>
      <p style="font-size:0.75rem;color:#888;margin:0 0 10px">Se este for a 2ª fase de uma competição, insere os pontos carregados de cada equipa. Deixa em branco se não aplicável.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px">
        ${marked.map((r,i)=>`<label style="display:flex;align-items:center;gap:6px;font-size:0.8rem">
          <span style="flex:1;font-weight:${r.sc?700:400}">${r.equipa}</span>
          <input type="number" min="0" max="99" placeholder="0"
            style="width:52px;padding:3px 6px;border:1px solid #ddd;border-radius:4px;font-size:0.8rem;text-align:center"
            data-pts1fase="${i}" value="${r.pts1fase||''}">
        </label>`).join('')}
      </div>
    </div>
    <p style="font-size:0.75rem;color:#888;margin-top:8px">&#11088; = JS Campinense. Confira antes de guardar.</p>`;
  } else {
    const jogos = parsePastedJogos(ta.value);
    if (!jogos.length) {
      div.innerHTML = `<div style="color:#c00;font-size:0.85rem;line-height:1.6">
        &#9888; <strong>Não foi possível reconhecer jogos.</strong><br>
        Cada jogo precisa de: <strong>data</strong> (ex: 22/03/2026), <strong>equipa casa</strong>, <strong>resultado</strong> (ex: 3-1, ou – se ainda não jogado) e <strong>equipa fora</strong>.<br>
        Dicas:<br>
        &bull; No ZeroZero: página da equipa &rarr; separador <em>Jogos</em>, seleciona a lista completa e copia<br>
        &bull; Também podes escrever à mão, um jogo por linha:<br>
        <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">22/03/2026&#9;15:00&#9;Sport Campinense&#9;3-1&#9;CD Tavira&#9;Est. Municipal</code><br>
        (separado por Tab ou 2+ espaços)</div>`;
      return;
    }
    const r=jogos.filter(j=>j.estado==='Realizado').length, a=jogos.filter(j=>j.estado==='Agendado').length;
    const scRe=/sport campinense|js campinense|campinense/i;
    const nSC=jogos.filter(j=>scRe.test(j.casa)||scRe.test(j.fora)).length;
    const logoImg = (url) => url ? `<img src="${url}" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;margin-right:5px" onerror="this.style.display='none'">` : '';
    const unresolvedHint = _lastJogosUnresolved > 0
      ? `<p style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:10px;font-size:0.78rem;color:#7a5700;margin:0 0 10px">
          &#9888; ${_lastJogosUnresolved} equipas vinham só com logo (sem nome) e não foram reconhecidas.
          <strong>Importa primeiro a classificação deste escalão</strong> — assim fico a conhecer as equipas pelos logos e os nomes aparecem automaticamente.</p>`
      : '';
    div.innerHTML = `${unresolvedHint}
    <p style="color:#22a75e;font-size:0.85rem;margin-bottom:8px">&#10003; ${jogos.length} jogos reconhecidos (${r} realizados · ${a} agendados)</p>
    ${nSC > 0 && nSC < jogos.length ? `
      <label style="display:flex;align-items:center;gap:8px;background:#e8f4fd;border:1px solid #b3d9f7;border-radius:8px;padding:10px;font-size:0.82rem;margin-bottom:10px;cursor:pointer">
        <input type="checkbox" id="colarSoSC" checked style="width:16px;height:16px">
        <span>Guardar apenas os <strong>${nSC} jogos do Campinense</strong> (ignorar os restantes ${jogos.length - nSC})</span>
      </label>` : ''}
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8rem">
      <thead><tr style="background:#001b4d;color:#fff">
        <th style="padding:5px 8px">Data</th><th style="padding:5px 8px;text-align:left">Casa</th>
        <th style="padding:5px 8px">Res.</th><th style="padding:5px 8px;text-align:left">Fora</th>
        <th style="padding:5px 8px">Hora</th><th style="padding:5px 8px;text-align:left">Local</th>
        <th style="padding:5px 8px">Estado</th>
      </tr></thead>
      <tbody>${jogos.map((j,i)=>{
        const sc=scRe.test(j.casa+' '+j.fora);
        return `<tr style="background:${sc?'rgba(255,209,0,0.1)':i%2===0?'#f9f9f9':'#fff'}">
          <td style="padding:4px 8px;white-space:nowrap">${j.data}</td>
          <td style="padding:4px 8px">${logoImg(j.logoCasa)}${j.casa}</td>
          <td style="padding:4px 8px;text-align:center;font-weight:700">${j.gcasa!=null?j.gcasa+'–'+j.gfora:'–'}</td>
          <td style="padding:4px 8px">${logoImg(j.logoFora)}${j.fora}</td>
          <td style="padding:4px 8px;text-align:center">${j.hora}</td>
          <td style="padding:4px 8px;font-size:0.75rem">${j.local}</td>
          <td style="padding:4px 8px;text-align:center;font-size:0.75rem;color:${j.estado==='Realizado'?'#22a75e':'#888'}">${j.estado}</td>
        </tr>`;}).join('')}</tbody></table></div>
    <p style="font-size:0.75rem;color:#888;margin-top:8px">Confira os dados antes de guardar.</p>`;
  }
};

// ── Guardar ───────────────────────────────────────
window.guardarColarClass = function() {
  const ta = document.getElementById('colarClassTA');
  if (!ta) return;
  const now     = new Date().toISOString();
  const cfg     = loadClassConfig();
  const escCfg  = cfg[_colarEscalao] || (cfg[_colarEscalao] = {});
  // Sem equipa/série: guardar ao nível do escalão (chave fpf_class_Sub-XX)
  let teamCfg;
  if (_colarTeam) {
    const teams = escCfg.teams || (escCfg.teams = {});
    teamCfg = teams[_colarTeam] || (teams[_colarTeam] = { nome: _colarTeam });
  } else {
    teamCfg = escCfg;
  }

  if (_colarMode === 'class') {
    const rows = parsePastedTable(ta.value);
    if (!rows.length) { showToast('Nenhum dado válido para guardar', 'red'); return; }

    // Read pts1fase inputs from the preview section
    const pts1Inputs = document.querySelectorAll('[data-pts1fase]');
    pts1Inputs.forEach(inp => {
      const idx = parseInt(inp.dataset.pts1fase);
      const val = parseInt(inp.value);
      if (!isNaN(val) && val > 0 && rows[idx]) rows[idx].pts1fase = val;
    });

    const final = markSCRows(rows);

    // Save logos to db_logos (team name → logo URL)
    const logos = JSON.parse(localStorage.getItem('db_logos') || '{}');
    final.forEach(r => { if (r.logo) logos[r.equipa.toLowerCase()] = r.logo; });
    localStorage.setItem('db_logos', JSON.stringify(logos));

    localStorage.setItem(teamStorageKey(_colarEscalao, _colarTeam, 'class'), JSON.stringify(final));
    teamCfg.lastSync = now;
    teamCfg.nTeams   = final.length;
    saveClassConfig(cfg);
    fecharColarClass();
    renderClassSyncRows();
    showToast(`${_colarEscalao}${teamCfg.nome && _colarTeam ? ' · ' + teamCfg.nome : ''}: ${final.length} equipas guardadas`, 'green');
  } else {
    let jogos = parsePastedJogos(ta.value);
    if (!jogos.length) { showToast('Nenhum jogo válido para guardar', 'red'); return; }
    // Filtro "só jogos do Campinense" (checkbox na pré-visualização)
    if (document.getElementById('colarSoSC')?.checked) {
      const scRe = /sport campinense|js campinense|campinense/i;
      jogos = jogos.filter(j => scRe.test(j.casa) || scRe.test(j.fora));
      if (!jogos.length) { showToast('Nenhum jogo do Campinense encontrado na colagem', 'red'); return; }
    }
    localStorage.setItem(teamStorageKey(_colarEscalao, _colarTeam, 'jogos'), JSON.stringify(jogos));

    // Merge into DB.jogos
    const escalao = _colarEscalao, teamLabel = _colarTeam ? (teamCfg.nome || _colarTeam) : '';
    const scRe    = /sport campinense|js campinense|campinense/i;
    let added=0, updated=0;
    for (const j of jogos) {
      const kc = s => (s||'').toLowerCase().trim();
      const ex  = DB.jogos.find(e => e.data===j.data && kc(e.casa)===kc(j.casa) && kc(e.fora)===kc(j.fora));
      if (ex) {
        if (j.estado==='Realizado' && ex.estado==='Agendado') { ex.gcasa=j.gcasa; ex.gfora=j.gfora; ex.estado='Realizado'; updated++; }
      } else {
        DB.jogos.push({ id:Date.now()+Math.floor(Math.random()*10000), escalao, equipa:teamLabel,
          casa:j.casa, fora:j.fora, gcasa:j.gcasa, gfora:j.gfora, data:j.data, hora:j.hora, local:j.local, estado:j.estado });
        added++;
      }
    }
    saveDB();
    renderJogos();

    teamCfg.lastJogos = now;
    teamCfg.nJogos    = jogos.length;
    saveClassConfig(cfg);
    fecharColarClass();
    renderClassSyncRows();
    showToast(`${escalao}${teamLabel ? ' · ' + teamLabel : ''}: ${added} jogos adicionados${updated?', '+updated+' actualizados':''}`, 'green');
  }
};




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

// Textos padrão do site público (index.html) — mostrados nos campos do
// admin enquanto não houver valor guardado, para se editar sobre o real
const SITE_DEFAULTS = {
  heroTag:   'Formando Campeões desde 1923 →',
  heroTitle: 'Juventude<br /><span>Sport Campinense</span>',
  heroDesc:  'Desenvolvendo talentos, construindo carácter e cultivando a paixão pelo futebol em Loulé, Algarve.',
  stat1Num: '300+', stat1Label: 'Atletas',
  stat2Num: '6',    stat2Label: 'Escalões',
  stat3Num: '100+', stat3Label: 'Anos de história',
  stat4Num: '80+',  stat4Label: 'Títulos',
  aboutText1: 'O Juventude Sport Campinense é o departamento de formação do Sport Campinense de Loulé, um dos clubes mais emblemáticos do Algarve. A nossa missão é descobrir e desenvolver talentos do futebol algarvio, oferecendo estrutura profissional e uma formação de excelência.',
  aboutText2: 'Para além do futebol de alto nível, priorizamos a formação humana dos nossos atletas, com acompanhamento pedagógico, psicológico e nutricional. Acreditamos que um atleta completo começa dentro do campo, mas constrói-se fora dele.',
  aboutEst:   'EST. 1923',
  aboutMotto: '"Mais que um Clube, uma família!"',
  aboutVal1Title: 'Disciplina', aboutVal1Desc: 'Base para o sucesso dentro e fora do campo.',
  aboutVal2Title: 'Respeito',   aboutVal2Desc: 'Com colegas, adversários e a família do futebol.',
  aboutVal3Title: 'Dedicação',  aboutVal3Desc: 'Compromisso diário com a evolução e o colectivo.',
  contactAddress: 'Rua Nuno A. de Mascarenhas, Lote 16<br />8100-610 Loulé, Portugal',
  contactPhone:   '+351 937 952 710',
  contactEmail:   'geral@campinense.pt',
  contactHours:   'Segunda a Sexta, das 9h às 18h',
  heroBtn1Text: 'Quero inscrever-me',  heroBtn1Url: 'inscricao.html',
  heroBtn2Text: 'Conhecer o clube',    heroBtn2Url: '#sobre',
  footerTagline: 'Formando campeões dentro e fora do campo.',
};

function loadPaginaInicialForm() {
  const cfg = getSiteConfig();
  const fields = {
    cfgHeroTag: 'heroTag', cfgHeroTitle: 'heroTitle', cfgHeroDesc: 'heroDesc',
    cfgHeroImagem: 'heroImagem', cfgHeroImgPos: 'heroImgPos', cfgHeroOverlay: 'heroOverlay',
    cfgHeroSlideSpeed: 'heroSlideSpeed',
    cfgStat1Num: 'stat1Num', cfgStat1Label: 'stat1Label',
    cfgStat2Num: 'stat2Num', cfgStat2Label: 'stat2Label',
    cfgStat3Num: 'stat3Num', cfgStat3Label: 'stat3Label',
    cfgStat4Num: 'stat4Num', cfgStat4Label: 'stat4Label',
    cfgAboutText1: 'aboutText1', cfgAboutText2: 'aboutText2',
    cfgAboutEst: 'aboutEst', cfgAboutMotto: 'aboutMotto',
    cfgAboutVal1Title: 'aboutVal1Title', cfgAboutVal1Desc: 'aboutVal1Desc',
    cfgAboutVal2Title: 'aboutVal2Title', cfgAboutVal2Desc: 'aboutVal2Desc',
    cfgAboutVal3Title: 'aboutVal3Title', cfgAboutVal3Desc: 'aboutVal3Desc',
    cfgContactAddress: 'contactAddress', cfgContactPhone: 'contactPhone',
    cfgContactEmail: 'contactEmail', cfgContactHours: 'contactHours',
    cfgContactLat: 'contactLat', cfgContactLon: 'contactLon',
    cfgSocialInstagram: 'socialInstagramUrl',
    cfgSocialFacebook: 'socialFacebookUrl',
    cfgSocialWhatsapp: 'socialWhatsappUrl',
    cfgHeroBtn1Text: 'heroBtn1Text', cfgHeroBtn1Url: 'heroBtn1Url',
    cfgHeroBtn2Text: 'heroBtn2Text', cfgHeroBtn2Url: 'heroBtn2Url',
    cfgSeoTitle: 'seoTitle', cfgSeoDesc: 'seoDesc',
    cfgFooterTagline: 'footerTagline',
    cfgHomepageNewsCount: 'homepageNewsCount',
  };
  for (const [elId, cfgKey] of Object.entries(fields)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    if (cfg[cfgKey] !== undefined && cfg[cfgKey] !== '') el.value = cfg[cfgKey];
    else if (SITE_DEFAULTS[cfgKey] !== undefined) el.value = SITE_DEFAULTS[cfgKey];
  }
  // Checkboxes
  const sl = document.getElementById('cfgHeroSlideshow');
  if (sl) sl.checked = cfg.heroSlideshow === true || cfg.heroSlideshow === 'true';
  const jd = document.getElementById('cfgJogoDestaqueAtivo');
  if (jd) jd.checked = cfg.jogoDestaqueAtivo === true || cfg.jogoDestaqueAtivo === 'true';
  // Preview imagem
  if (cfg.heroImagem) {
    const prev = document.getElementById('cfgHeroPreview');
    if (prev) { prev.style.display = ''; prev.querySelector('img').src = cfg.heroImagem; }
  }
  // Popup
  const popup = JSON.parse(localStorage.getItem('site_popup') || '{}');
  const el = (id) => document.getElementById(id);
  if (el('cfgPopupAtivo'))    el('cfgPopupAtivo').checked = popup.ativo === true;
  if (el('cfgPopupTitulo') && popup.titulo)   el('cfgPopupTitulo').value = popup.titulo;
  if (el('cfgPopupTexto')  && popup.texto)    el('cfgPopupTexto').value  = popup.texto;
  if (el('cfgPopupTipo')   && popup.tipo)     el('cfgPopupTipo').value   = popup.tipo;
  if (el('cfgPopupBtnTexto') && popup.btnTexto) el('cfgPopupBtnTexto').value = popup.btnTexto;
  if (el('cfgPopupBtnLink')  && popup.btnLink)  el('cfgPopupBtnLink').value  = popup.btnLink;
  // Banner
  const banner = JSON.parse(localStorage.getItem('site_banner') || '{}');
  if (el('cfgBannerAtivo'))    el('cfgBannerAtivo').checked = banner.ativo === true;
  if (el('cfgBannerTexto') && banner.texto)       el('cfgBannerTexto').value     = banner.texto;
  if (el('cfgBannerTipo')  && banner.tipo)        el('cfgBannerTipo').value      = banner.tipo;
  if (el('cfgBannerLinkTexto') && banner.linkTexto) el('cfgBannerLinkTexto').value = banner.linkTexto;
  if (el('cfgBannerLink')  && banner.link)        el('cfgBannerLink').value      = banner.link;
  // SEO char counters
  _setupSeoCounter('cfgSeoTitle', 'cfgSeoTitleCount', 60);
  _setupSeoCounter('cfgSeoDesc', 'cfgSeoDescCount', 160);
}

async function _nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=pt&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json();
  return data && data.length ? data[0] : null;
}

async function geocodificarMorada() {
  const addr = document.getElementById('cfgContactAddress')?.value.trim();
  const status = document.getElementById('geoStatus');
  const btn = document.getElementById('btnGeocodificar');
  if (!addr) { if (status) status.textContent = 'Introduza uma morada primeiro.'; return; }
  if (status) { status.textContent = '⏳ A localizar...'; status.style.color = '#888'; }
  if (btn) btn.disabled = true;

  try {
    // Estratégia 1: morada completa tal como está
    let result = await _nominatimSearch(addr);

    // Estratégia 2: remover número de porta (ex: "Rua X 43" → "Rua X")
    if (!result) {
      const semNumero = addr.replace(/\s+\d+\s*$/, '').trim();
      if (semNumero !== addr) result = await _nominatimSearch(semNumero);
    }

    // Estratégia 3: adicionar "Portugal" se não constar
    if (!result && !/portugal/i.test(addr)) {
      result = await _nominatimSearch(addr + ', Portugal');
    }

    // Estratégia 4: só a rua + "Loulé Portugal"
    if (!result) {
      const soPrimeiro = addr.split(',')[0].trim();
      result = await _nominatimSearch(soPrimeiro + ', Loulé, Portugal');
    }

    if (result) {
      const lat = parseFloat(result.lat).toFixed(6);
      const lon = parseFloat(result.lon).toFixed(6);
      document.getElementById('cfgContactLat').value = lat;
      document.getElementById('cfgContactLon').value = lon;
      const label = result.display_name.split(',').slice(0, 3).join(',');
      if (status) { status.innerHTML = `✓ Localizado: <strong>${lat}, ${lon}</strong><br><small>${label}</small>`; status.style.color = '#2e7d32'; }
    } else {
      if (status) { status.textContent = '⚠ Não encontrado. Tente incluir a cidade: "Rua X, Loulé".'; status.style.color = '#c00'; }
    }
  } catch(e) {
    if (status) { status.textContent = '⚠ Erro de ligação. Tente novamente.'; status.style.color = '#c00'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function guardarPaginaInicial() {
  const cfg = getSiteConfig();
  const fields = {
    cfgHeroTag: 'heroTag', cfgHeroTitle: 'heroTitle', cfgHeroDesc: 'heroDesc',
    cfgHeroImagem: 'heroImagem', cfgHeroImgPos: 'heroImgPos', cfgHeroOverlay: 'heroOverlay',
    cfgHeroSlideSpeed: 'heroSlideSpeed',
    cfgStat1Num: 'stat1Num', cfgStat1Label: 'stat1Label',
    cfgStat2Num: 'stat2Num', cfgStat2Label: 'stat2Label',
    cfgStat3Num: 'stat3Num', cfgStat3Label: 'stat3Label',
    cfgStat4Num: 'stat4Num', cfgStat4Label: 'stat4Label',
    cfgAboutText1: 'aboutText1', cfgAboutText2: 'aboutText2',
    cfgAboutEst: 'aboutEst', cfgAboutMotto: 'aboutMotto',
    cfgAboutVal1Title: 'aboutVal1Title', cfgAboutVal1Desc: 'aboutVal1Desc',
    cfgAboutVal2Title: 'aboutVal2Title', cfgAboutVal2Desc: 'aboutVal2Desc',
    cfgAboutVal3Title: 'aboutVal3Title', cfgAboutVal3Desc: 'aboutVal3Desc',
    cfgContactAddress: 'contactAddress', cfgContactPhone: 'contactPhone',
    cfgContactEmail: 'contactEmail', cfgContactHours: 'contactHours',
    cfgContactLat: 'contactLat', cfgContactLon: 'contactLon',
    cfgSocialInstagram: 'socialInstagramUrl',
    cfgSocialFacebook: 'socialFacebookUrl',
    cfgSocialWhatsapp: 'socialWhatsappUrl',
    cfgHeroBtn1Text: 'heroBtn1Text', cfgHeroBtn1Url: 'heroBtn1Url',
    cfgHeroBtn2Text: 'heroBtn2Text', cfgHeroBtn2Url: 'heroBtn2Url',
    cfgSeoTitle: 'seoTitle', cfgSeoDesc: 'seoDesc',
    cfgFooterTagline: 'footerTagline',
    cfgHomepageNewsCount: 'homepageNewsCount',
  };
  for (const [elId, cfgKey] of Object.entries(fields)) {
    const el = document.getElementById(elId);
    if (el) cfg[cfgKey] = el.value.trim();
  }
  // Checkboxes
  const sl = document.getElementById('cfgHeroSlideshow');
  if (sl) cfg.heroSlideshow = sl.checked;
  const jd = document.getElementById('cfgJogoDestaqueAtivo');
  if (jd) cfg.jogoDestaqueAtivo = jd.checked;

  // Auto-geocode address if changed and no coords yet
  const newAddr = cfg.contactAddress;
  const hasCoords = cfg.contactLat && cfg.contactLon;
  const addrChanged = newAddr && newAddr !== (getSiteConfig().contactAddress);
  if (newAddr && (!hasCoords || addrChanged)) {
    showToast('⏳ A localizar morada no mapa...', 'blue');
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(newAddr)}&format=json&limit=1&countrycodes=pt`,
      { headers: { 'Accept': 'application/json' } })
      .then(r => r.json())
      .then(data => {
        if (data && data.length) {
          cfg.contactLat = parseFloat(data[0].lat).toFixed(6);
          cfg.contactLon = parseFloat(data[0].lon).toFixed(6);
          const latEl = document.getElementById('cfgContactLat');
          const lonEl = document.getElementById('cfgContactLon');
          if (latEl) latEl.value = cfg.contactLat;
          if (lonEl) lonEl.value = cfg.contactLon;
        }
        saveSiteConfig(cfg);
        showToast('✓ Alterações guardadas e mapa atualizado!', 'green');
      })
      .catch(() => {
        saveSiteConfig(cfg);
        showToast('✓ Alterações guardadas! (geocodificação indisponível)', 'green');
      });
    return;
  }

  try {
    saveSiteConfig(cfg);
    showToast('✓ Alterações guardadas! Abra o site para ver as mudanças.', 'green');
  } catch(_) { /* saveSiteConfig already shows error toast */ }
}

function guardarPopup() {
  const g = (id) => document.getElementById(id);
  const ativo    = g('cfgPopupAtivo')?.checked || false;
  const titulo   = g('cfgPopupTitulo')?.value.trim() || '';
  const texto    = g('cfgPopupTexto')?.value.trim() || '';
  const tipo     = g('cfgPopupTipo')?.value || 'info';
  const btnTexto = g('cfgPopupBtnTexto')?.value.trim() || '';
  const btnLink  = g('cfgPopupBtnLink')?.value.trim() || '';
  localStorage.setItem('site_popup', JSON.stringify({ ativo, titulo, texto, tipo, btnTexto, btnLink }));
  showToast('✓ Popup guardado!', 'green');
}

function _setupSeoCounter(inputId, countId, max) {
  const el = document.getElementById(inputId);
  const cnt = document.getElementById(countId);
  if (!el || !cnt) return;
  function update() {
    const n = el.value.length;
    cnt.textContent = `${n}/${max} caracteres`;
    cnt.style.color = n > max ? '#e53e3e' : n > max * 0.85 ? '#d97706' : '#003B8E';
  }
  el.addEventListener('input', update);
  update();
}

function guardarBanner() {
  const g = (id) => document.getElementById(id);
  const ativo     = g('cfgBannerAtivo')?.checked || false;
  const texto     = g('cfgBannerTexto')?.value.trim() || '';
  const tipo      = g('cfgBannerTipo')?.value || 'info';
  const linkTexto = g('cfgBannerLinkTexto')?.value.trim() || '';
  const link      = g('cfgBannerLink')?.value.trim() || '';
  localStorage.setItem('site_banner', JSON.stringify({ ativo, texto, tipo, linkTexto, link }));
  showToast('✓ Banner guardado!', 'green');
}

window.guardarPopup  = guardarPopup;
window.guardarBanner = guardarBanner;

// =============================================
// TEMPLATES DE CONTEÚDO
// =============================================

const TEMPLATES_NOTICIA = {
  resultado: {
    categoria: 'Resultado',
    titulo: 'Resultado | [Escalão] vs [Adversário] — [x-x]',
    corpo: '<p><strong>⚽ Resultado do Jogo</strong></p><p>[Escalão] <strong>[x]</strong> — <strong>[x]</strong> [Adversário]</p><p>⚽ Golos: [Nome do jogador] ([min]\')</p><p>📍 Local: [Local do jogo]</p><p>🏆 Competição: [Nome da competição]</p><p>Parabéns a todos os jogadores e equipa técnica por mais uma excelente exibição!</p>',
  },
  convocatoria: {
    categoria: 'Seleção',
    titulo: 'Convocatória | [Escalão] – [Competição]',
    corpo: '<p><strong>📋 Convocatória para o próximo jogo</strong></p><p>📅 Data: [Data]</p><p>⏰ Concentração: [Hora]</p><p>📍 Local de concentração: [Local]</p><p><strong>Jogadores convocados:</strong></p><p>[Nomes dos jogadores convocados]</p><p>Bom trabalho a todos! 💪 <em>Mais que um Clube, uma família!!</em></p>',
  },
  inscricoes: {
    categoria: 'Clube',
    titulo: 'Inscrições Abertas | Época 2025/26',
    corpo: '<p>A <strong>Juventude Sport Campinense</strong> tem prazer em anunciar que as inscrições para a época <strong>2025/26</strong> estão abertas!</p><p><strong>Escalões disponíveis:</strong></p><p>⚽ Sub-9 · Sub-11 · Sub-13 · Sub-15 · Sub-17 · Sub-19</p><p><strong>Como inscrever:</strong></p><p>📞 Telefone: [número]</p><p>📧 E-mail: [email]</p><p>📍 Presencialmente em: [morada]</p><p>🗓️ Período de inscrições: [data início] a [data fim]</p><p>Não perca esta oportunidade! Vagas limitadas.</p>',
  },
  conquista: {
    categoria: 'Conquista',
    titulo: 'Campeões! [Escalão] vence [Competição]',
    corpo: '<p>🏆 <strong>CAMPEÕES!</strong></p><p>A equipa <strong>[Escalão]</strong> da Juventude Sport Campinense sagrou-se campeã de <strong>[Competição]</strong>!</p><p>Uma época de muito trabalho e dedicação culminou nesta merecida conquista. Parabéns a todos os jogadores, equipa técnica, famílias e adeptos que tornaram este momento possível.</p><p>💛💙 <em>Mais que um Clube, uma família!!</em></p>',
  },
  comunicado: {
    categoria: 'Clube',
    titulo: 'Comunicado | [Assunto]',
    corpo: '<p><strong>Comunicado Oficial da Juventude Sport Campinense</strong></p><p>A direção da Juventude Sport Campinense vem por este meio informar todos os sócios, atletas, pais e encarregados de educação sobre <strong>[assunto]</strong>.</p><p>[Corpo do comunicado]</p><p>Para mais informações, contacte a secretaria através de [e-mail/telefone].</p><p>Atenciosamente,<br><strong>A Direção</strong></p>',
  },
};

const TEMPLATES_EVENTO = {
  jogoCasa: {
    tipo: 'Jogo',
    titulo: '[Escalão] vs [Adversário]',
    hora: '10:00',
    local: 'Estádio Municipal de Loulé',
    descricao: 'Jogo em casa. Entrada livre para todos os adeptos.',
  },
  jogoFora: {
    tipo: 'Jogo',
    titulo: '[Adversário] vs [Escalão]',
    hora: '10:00',
    local: '',
    descricao: 'Jogo fora. Concentração no local indicado 1 hora antes do início.',
  },
  treino: {
    tipo: 'Treino',
    titulo: 'Sessão de Treino',
    hora: '17:00',
    local: 'Campo de Treino',
    descricao: '',
  },
  torneio: {
    tipo: 'Torneio',
    titulo: 'Torneio [Nome]',
    hora: '09:00',
    local: 'Estádio Municipal de Loulé',
    descricao: 'Torneio inter-clubes. Mais informações em breve.',
  },
  reuniaoPais: {
    tipo: 'Reunião',
    titulo: 'Reunião de Encarregados de Educação',
    hora: '19:00',
    local: 'Sede do Clube',
    descricao: 'Presença obrigatória de todos os encarregados de educação dos atletas.',
  },
  evento: {
    tipo: 'Outro',
    titulo: '[Nome do Evento]',
    hora: '10:00',
    local: '',
    descricao: '',
  },
};

window.toggleTplMenu = function(tipo) {
  const menu = document.getElementById('tplMenu' + tipo);
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  // Fechar todos os menus abertos
  document.querySelectorAll('.tpl-menu').forEach(m => { m.style.display = 'none'; });
  if (!isOpen) menu.style.display = '';
};

// Fechar menus ao clicar fora
document.addEventListener('click', function(e) {
  if (!e.target.closest('.tpl-dropdown')) {
    document.querySelectorAll('.tpl-menu').forEach(m => { m.style.display = 'none'; });
  }
});

window.aplicarTemplateNoticia = function(key) {
  const tpl = TEMPLATES_NOTICIA[key];
  if (!tpl) return;
  const titulo = document.getElementById('mTitulo');
  const cat    = document.getElementById('mCat');
  const editor = document.getElementById('mResumoEditor');
  if (titulo) titulo.value    = tpl.titulo;
  if (cat)    cat.value       = tpl.categoria;
  if (editor) editor.innerHTML = tpl.corpo;
  const menu = document.getElementById('tplMenuNoticia');
  if (menu) menu.style.display = 'none';
  titulo?.focus();
  showToast('Template aplicado! Complete os campos entre [ ]', 'green');
};

window.aplicarTemplateEvento = function(key) {
  const tpl = TEMPLATES_EVENTO[key];
  if (!tpl) return;
  const titulo = document.getElementById('mEvTitulo');
  const tipo   = document.getElementById('mEvTipo');
  const hora   = document.getElementById('mEvHora');
  const local  = document.getElementById('mEvLocal');
  const desc   = document.getElementById('mEvDesc');
  if (titulo) titulo.value = tpl.titulo;
  if (tipo)   tipo.value   = tpl.tipo;
  if (hora)   hora.value   = tpl.hora;
  if (local)  local.value  = tpl.local;
  if (desc)   desc.value   = tpl.descricao;
  const menu = document.getElementById('tplMenuEvento');
  if (menu) menu.style.display = 'none';
  titulo?.focus();
  showToast('Template aplicado! Complete os campos entre [ ]', 'green');
};

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
  saveDB(); closeModal(); renderGaleria();
  showToast(idx >= 0 ? 'Foto atualizada' : 'Foto adicionada', 'green');
}

function deleteFoto(idx) {
  if (!confirm('Remover esta foto?')) return;
  DB.galeria.splice(idx, 1);
  saveDB(); renderGaleria();
  showToast('Foto removida', 'green');
}

// =============================================
// VÍDEOS
// =============================================
let videosFiltro = '';

function _ytIdAdmin(url) {
  if (!url) return '';
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

function initVideosAdmin() {
  renderVideos();
  document.getElementById('btnNovoVideo')?.addEventListener('click', () => editVideo(-1));
  document.querySelectorAll('#videosCatFilters .tab-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#videosCatFilters .tab-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      videosFiltro = btn.dataset.cat;
      renderVideos();
    });
  });
}

function renderVideos() {
  const grid = document.getElementById('videosAdminGrid');
  if (!grid) return;
  const items = videosFiltro
    ? (DB.videos || []).filter(v => v.categoria === videosFiltro)
    : (DB.videos || []);

  grid.innerHTML = items.length ? items.map((v, i) => {
    const id    = _ytIdAdmin(v.url);
    const thumb = id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
    return `
    <div class="galeria-card">
      <div class="galeria-card__img" ${thumb ? `style="background-image:url('${thumb}')"` : 'style="background:#001f4d"'}>
        ${!thumb ? '<span style="font-size:2rem">🎬</span>' : ''}
        <span class="galeria-card__cat">${v.categoria || 'Outro'}</span>
      </div>
      <div class="galeria-card__body">
        <p class="galeria-card__title">${v.titulo}</p>
        <p class="galeria-card__date">${fmtDate(v.data)}</p>
      </div>
      <div class="galeria-card__actions">
        <button class="btn btn-sm" onclick="editVideo(${(DB.videos||[]).indexOf(v)})">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVideo(${(DB.videos||[]).indexOf(v)})">🗑️</button>
      </div>
    </div>`; }).join('') :
    '<p style="padding:24px;color:#999;text-align:center">Nenhum vídeo nesta categoria.</p>';
}

function editVideo(idx) {
  if (!DB.videos) DB.videos = [];
  const v = idx >= 0 ? DB.videos[idx] : { titulo:'', categoria:'Golos', data:'', url:'', descricao:'' };
  const id = _ytIdAdmin(v.url);
  openModal(idx >= 0 ? 'Editar Vídeo' : 'Adicionar Vídeo', `
    <div class="modal-row">
      <div class="modal-field"><label>Título</label>
        <input class="form-input" id="mVidTitulo" value="${v.titulo}" placeholder="Ex: Sub-17 — Golo de Pedro Costa vs Tavira" /></div>
      <div class="modal-field"><label>Categoria</label>
        <select class="form-input" id="mVidCat">
          ${['Golos','Melhores Momentos','Entrevistas','Treino','Jogo','Outro'].map(c => `<option ${v.categoria===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
    </div>
    <div class="modal-field"><label>Data</label>
      <input class="form-input" type="date" id="mVidData" value="${v.data}" /></div>
    <div class="modal-field">
      <label>URL do YouTube</label>
      <input class="form-input" type="url" id="mVidUrl" value="${v.url}" placeholder="https://www.youtube.com/watch?v=..." />
      <small style="color:#888;font-size:11px;margin-top:4px;display:block">Cole o link de qualquer vídeo do YouTube (incluindo Shorts)</small>
    </div>
    ${id ? `<div id="mVidPreview" style="margin-top:8px"><img src="https://img.youtube.com/vi/${id}/mqdefault.jpg" style="max-width:100%;border-radius:8px" /></div>` : ''}
    <div class="modal-field"><label>Descrição (opcional)</label>
      <textarea class="form-input" id="mVidDesc" rows="2">${v.descricao}</textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarVideo(${idx})">Guardar</button>`);
}

function salvarVideo(idx) {
  if (!DB.videos) DB.videos = [];
  const item = {
    titulo:    document.getElementById('mVidTitulo').value.trim(),
    categoria: document.getElementById('mVidCat').value,
    data:      document.getElementById('mVidData').value,
    url:       document.getElementById('mVidUrl').value.trim(),
    descricao: document.getElementById('mVidDesc').value.trim(),
  };
  if (!item.titulo) { showToast('Preencha o título', 'red'); return; }
  if (!item.url)    { showToast('Cole o URL do YouTube', 'red'); return; }
  if (idx >= 0) DB.videos[idx] = { ...DB.videos[idx], ...item };
  else DB.videos.unshift({ id: Date.now(), ...item });
  saveDB(); closeModal(); renderVideos();
  showToast(idx >= 0 ? 'Vídeo atualizado' : 'Vídeo adicionado', 'green');
}

function deleteVideo(idx) {
  if (!confirm('Remover este vídeo?')) return;
  DB.videos.splice(idx, 1);
  saveDB(); renderVideos();
  showToast('Vídeo removido', 'green');
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
    const fotoStyle = t.foto
      ? ` style="background-image:url('${t.foto}');background-size:cover;background-position:center;color:transparent"`
      : '';
    return `<div class="staff-card ${t.ativo ? '' : 'inactive'}">
      <div class="staff-avatar"${fotoStyle}>${iniciais}</div>
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
  const t = idx >= 0 ? DB.treinadores[idx] : { nome:'', cargo:'', escalao:'Todos', telefone:'', email:'', desde:'2026', ativo:true, foto:'' };
  openModal(idx >= 0 ? 'Editar Membro' : 'Novo Membro', `
    <div class="modal-row">
      <div class="modal-field"><label>Nome completo</label>
        <input class="form-input" id="mTNome" value="${t.nome}" /></div>
      <div class="modal-field"><label>Cargo</label>
        <input class="form-input" id="mTCargo" value="${t.cargo}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mTEscalao">${_escOpts(t.escalao, true)}</select></div>
      <div class="modal-field"><label>Desde (ano)</label>
        <input class="form-input" id="mTDesde" value="${t.desde}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Telefone</label>
        <input class="form-input" id="mTTel" value="${t.telefone}" /></div>
      <div class="modal-field"><label>E-mail</label>
        <input class="form-input" id="mTEmail" value="${t.email}" /></div>
    </div>
    <div class="modal-field"><label>Foto (URL ou upload)</label>
      <input class="form-input" type="text" id="mTFoto" value="${t.foto||''}" placeholder="https://... ou carregar ficheiro" />
      <input type="file" id="mTFotoFile" accept="image/*" style="display:none" />
      <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mTFotoFile').click()">&#128190; Carregar foto</button>
      <div id="mTFotoPreview" style="${t.foto?'':'display:none'};margin-top:8px">
        <img src="${t.foto||''}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #003B8E" />
      </div>
    </div>
    <div class="modal-field"><label>Estado</label>
      <select class="form-input" id="mTAtivo">
        <option value="1" ${t.ativo?'selected':''}>Activo</option>
        <option value="0" ${!t.ativo?'selected':''}>Inactivo</option>
      </select></div>
  `, `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-save" onclick="salvarTreinador(${idx})">Guardar</button>`);
  setupImageUpload('mTFotoFile', 'mTFoto', 'mTFotoPreview');
}

function salvarTreinador(idx) {
  const item = {
    nome:     document.getElementById('mTNome').value.trim(),
    cargo:    document.getElementById('mTCargo').value.trim(),
    escalao:  document.getElementById('mTEscalao').value,
    desde:    document.getElementById('mTDesde').value.trim(),
    telefone: document.getElementById('mTTel').value.trim(),
    email:    document.getElementById('mTEmail').value.trim(),
    foto:     document.getElementById('mTFoto').value.trim(),
    ativo:    document.getElementById('mTAtivo').value === '1',
  };
  if (!item.nome) { showToast('Preencha o nome', 'red'); return; }
  if (idx >= 0) DB.treinadores[idx] = { ...DB.treinadores[idx], ...item };
  else DB.treinadores.unshift({ id: Date.now(), ...item });
  saveDB();
  closeModal(); renderTreinadores();
  showToast(idx >= 0 ? 'Membro atualizado' : 'Membro adicionado', 'green');
}

function deleteTreinador(idx) {
  if (!confirm('Remover este membro?')) return;
  DB.treinadores.splice(idx, 1);
  saveDB();
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
    ${idx < 0 ? `<div class="tpl-bar">
      <span class="tpl-bar__label">⚡ Template:</span>
      <div class="tpl-dropdown">
        <button class="tpl-trigger" type="button" onclick="toggleTplMenu('Evento')">Escolher template &#9662;</button>
        <div class="tpl-menu" id="tplMenuEvento" style="display:none">
          <button type="button" onclick="aplicarTemplateEvento('jogoCasa')">🏠 Jogo em Casa</button>
          <button type="button" onclick="aplicarTemplateEvento('jogoFora')">✈️ Jogo Fora</button>
          <button type="button" onclick="aplicarTemplateEvento('treino')">⚽ Sessão de Treino</button>
          <button type="button" onclick="aplicarTemplateEvento('torneio')">🏆 Torneio</button>
          <button type="button" onclick="aplicarTemplateEvento('reuniaoPais')">👨‍👩‍👧 Reunião de Pais</button>
          <button type="button" onclick="aplicarTemplateEvento('evento')">📅 Outro Evento</button>
        </div>
      </div>
    </div>` : ''}
    <div class="modal-field"><label>Título</label>
      <input class="form-input" id="mEvTitulo" value="${e.titulo}" /></div>
    <div class="modal-row">
      <div class="modal-field"><label>Tipo</label>
        <select class="form-input" id="mEvTipo">
          ${['Jogo','Torneio','Treino','Reunião','Outro'].map(t => `<option ${e.tipo===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mEvEscalao">${_escOpts(e.escalao, true)}</select></div>
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
  saveDB();
  closeModal(); renderAgenda();
  showToast(idx >= 0 ? 'Evento atualizado' : 'Evento adicionado', 'green');
}

function deleteEvento(idx) {
  if (!confirm('Remover este evento?')) return;
  DB.agenda.splice(idx, 1);
  saveDB();
  renderAgenda();
  showToast('Evento removido', 'green');
}

// =============================================
// CONFIGURAÇÕES
// =============================================
function initConfiguracoes() {
  // Carregar modo manutenção
  const manu = JSON.parse(localStorage.getItem('site_manutencao') || '{}');
  const chk  = document.getElementById('cfgManutencao');
  if (chk) {
    chk.checked = !!manu.ativo;
    _applyManutencaoSlider(!!manu.ativo);
  }
  const msgEl = document.getElementById('cfgManutencaoMsg');
  if (msgEl && manu.mensagem) msgEl.value = manu.mensagem;

  // Carregar token de publicação
  const apiToken = localStorage.getItem('jsc_api_token');
  const apiTokenEl = document.getElementById('cfgApiToken');
  if (apiTokenEl && apiToken) apiTokenEl.value = apiToken;

  // Última publicação
  const ultimaPub = localStorage.getItem('jsc_ultima_publicacao');
  const ultimaPubEl = document.getElementById('ultimaPublicacao');
  if (ultimaPubEl && ultimaPub) ultimaPubEl.textContent = 'Última publicação: ' + ultimaPub;

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
  if (clube.navNome) document.getElementById('cfgNavNome').value     = clube.navNome;
  if (clube.navSub)  document.getElementById('cfgNavSub').value      = clube.navSub;
  if (clube.logo) {
    const logoInput = document.getElementById('cfgClubLogo');
    if (logoInput) logoInput.value = clube.logo;
    const prev = document.getElementById('cfgClubLogoPreview');
    if (prev) { prev.style.display = ''; prev.querySelector('img').src = clube.logo; }
  }
  setupImageUpload('cfgClubLogoFicheiro', 'cfgClubLogo', 'cfgClubLogoPreview');

  // Carregar configuração de email
  const emailCfg = JSON.parse(localStorage.getItem('email_config') || '{}');
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  setVal('cfgEmailDest',         emailCfg.dest);
  setVal('cfgEmailPublicKey',    emailCfg.publicKey);
  setVal('cfgEmailServiceId',    emailCfg.serviceId);
  setVal('cfgEmailTplContacto',  emailCfg.tplContacto);
  setVal('cfgEmailTplInscricao', emailCfg.tplInscricao);
  setVal('cfgServerUrl',         emailCfg.serverUrl);
  setVal('cfgServerToken',       emailCfg.serverToken);

  // Activar modo correcto
  if (emailCfg.mode === 'server') {
    const rb = document.getElementById('modeServer');
    if (rb) { rb.checked = true; rb.dispatchEvent(new Event('change')); }
  }

  _updateEmailStatus(emailCfg);

  // Carregar conteúdo legal
  const legal = JSON.parse(localStorage.getItem('site_legal') || '{}');
  const privEl = document.getElementById('cfgLegalPrivacidade');
  const termEl = document.getElementById('cfgLegalTermos');
  if (privEl && legal.privacidade) privEl.value = legal.privacidade;
  if (termEl && legal.termos)      termEl.value  = legal.termos;
}

window.switchLegalTab = function(tab) {
  document.getElementById('legalPanelPrivacidade').style.display = tab === 'privacidade' ? '' : 'none';
  document.getElementById('legalPanelTermos').style.display      = tab === 'termos'      ? '' : 'none';
  document.getElementById('legalTabPriv').classList.toggle('active',  tab === 'privacidade');
  document.getElementById('legalTabTermos').classList.toggle('active', tab === 'termos');
  const activeStyle = 'border-bottom:2px solid var(--blue)';
  document.getElementById('legalTabPriv').style.borderBottom   = tab === 'privacidade' ? '2px solid var(--blue)' : '';
  document.getElementById('legalTabTermos').style.borderBottom = tab === 'termos'      ? '2px solid var(--blue)' : '';
};

window.guardarLegal = function() {
  const legal = {
    privacidade: (document.getElementById('cfgLegalPrivacidade')?.value || '').trim(),
    termos:      (document.getElementById('cfgLegalTermos')?.value      || '').trim(),
  };
  localStorage.setItem('site_legal', JSON.stringify(legal));
  showToast('Conteúdo legal guardado!', 'green');
};

window.resetarLegal = function() {
  if (!confirm('Repor o texto padrão? O conteúdo guardado será apagado.')) return;
  localStorage.removeItem('site_legal');
  const privEl = document.getElementById('cfgLegalPrivacidade');
  const termEl = document.getElementById('cfgLegalTermos');
  if (privEl) privEl.value = '';
  if (termEl) termEl.value = '';
  showToast('Texto padrão reposto.', 'green');
};

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

// ---- TOKEN DE PUBLICAÇÃO ----
function guardarApiToken() {
  const token = document.getElementById('cfgApiToken')?.value.trim();
  if (!token) { showToast('Introduza o token', 'red'); return; }
  localStorage.setItem('jsc_api_token', token);
  showToast('✓ Token guardado', 'green');
}

// ---- PUBLICAR NO SERVIDOR ----
async function publicarNoServidor() {
  const token = localStorage.getItem('jsc_api_token') || 'campinense2025';
  const ls = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  // Classificações e jogos por escalão/equipa (chaves dinâmicas fpf_class_* / fpf_jogos_*)
  const classData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('fpf_class_') || k.startsWith('fpf_jogos_'))) {
      const v = ls(k);
      if (v) classData[k] = v;
    }
  }
  const dados = {
    publicadoEm:    new Date().toISOString(),
    noticias:       loadNoticias(),
    agenda:         DB.agenda,
    galeria:        DB.galeria,
    videos:         DB.videos,
    atletas:        DB.atletas,
    escaloes:       DB.escaloes,
    treinadores:    DB.treinadores,
    patrocinadores: DB.patrocinadores,
    modalidades:    DB.modalidades,
    modPosts:       ls('db_mod_posts'),
    jogos:          DB.jogos,
    seniores:       ls('db_seniores'),
    senioresInfo:   ls('db_seniores_info'),
    siteConfig:     ls('site_config'),
    dadosClube:     ls('dados_clube'),
    sitePopup:      ls('site_popup'),
    siteBanner:     ls('site_banner'),
    siteAviso:      ls('site_aviso'),
    siteCores:      ls('site_cores'),
    siteLegal:      ls('site_legal'),
    emailConfig:    ls('email_config'),
    fbPosts:        ls('fb_posts'),
    logos:          ls('db_logos'),
    classConfig:    ls('fpf_sync_config'),
    classData:      Object.keys(classData).length ? classData : null,
  };
  try {
    const btn = document.querySelector('[onclick="publicarNoServidor()"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ A publicar...'; }
    const resp = await fetch('/api/save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-JSC-Token': token },
      body: JSON.stringify(dados),
    });
    const json = await resp.json();
    if (btn) { btn.disabled = false; btn.innerHTML = '&#128640; Publicar agora'; }
    if (resp.ok && json.ok) {
      const ts = new Date().toLocaleString('pt-PT');
      localStorage.setItem('jsc_ultima_publicacao', ts);
      const el = document.getElementById('ultimaPublicacao');
      if (el) el.textContent = 'Última publicação: ' + ts;
      showToast('✓ Site atualizado! Visitantes já veem o novo conteúdo.', 'green');
    } else if (resp.status === 401) {
      showToast('❌ Token inválido. Verifique em Configurações > Segurança.', 'red');
    } else {
      showToast('❌ Erro ao publicar: ' + (json.error || resp.status), 'red');
    }
  } catch (e) {
    showToast('❌ Sem ligação ao servidor: ' + e.message, 'red');
    const btn = document.querySelector('[onclick="publicarNoServidor()"]');
    if (btn) { btn.disabled = false; btn.innerHTML = '&#128640; Publicar agora'; }
  }
}
window.publicarNoServidor = publicarNoServidor;
window.guardarApiToken    = guardarApiToken;

// ---- REGISTOS DO SERVIDOR (base de dados MySQL) ----
// Inscrições e mensagens submetidas pelos visitantes chegam à BD via
// api/submit.php; aqui puxamo-las para o admin e empurramos mudanças
// de estado. Silencioso quando a BD não está configurada.
function _regToken() { return localStorage.getItem('jsc_api_token') || 'campinense2025'; }

function _regPush(tipo, id, estado) {
  fetch('/api/registos.php?tipo=' + tipo, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-JSC-Token': _regToken() },
    body: JSON.stringify({ acao: 'estado', id, estado }),
  }).catch(() => {});
}

function _regDelete(tipo, id) {
  fetch('/api/registos.php?tipo=' + tipo, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-JSC-Token': _regToken() },
    body: JSON.stringify({ acao: 'apagar', id }),
  }).catch(() => {});
}

function _mapInscricaoServidor(item) {
  const EMAP = { sub9:'Sub-9', sub11:'Sub-11', sub13:'Sub-13', sub15:'Sub-15', sub17:'Sub-17', sub19:'Sub-19' };
  let idade = '—';
  if (item.dataNasc) {
    const hoje = new Date(), n = new Date(item.dataNasc + 'T00:00:00');
    let a = hoje.getFullYear() - n.getFullYear();
    if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) a--;
    if (a >= 0 && a <= 99) idade = a;
  }
  return {
    id:         item.id,
    nome:       item.nome        || '—',
    modalidade: item.modalidade  || 'Futebol',
    escalao:    EMAP[item.escalao] || item.escalao || '—',
    nivel:      item.nivel       || '—',
    idade,
    dataNasc:   item.dataNasc    || '',
    posicao:    item.posicao     || '—',
    pref:       item.pePreferido || '—',
    altura:     item.altura      || '—',
    peso:       item.peso        || '—',
    nomeResp:   item.nomeResp    || '—',
    telefone:   item.telefone    || '—',
    email:      item.email       || '—',
    data:       item.data        || new Date().toISOString().slice(0, 10),
    estado:     item.estado      || 'Pendente',
  };
}

async function sincronizarRegistosServidor() {
  const headers = { 'X-JSC-Token': _regToken() };
  const puxar = async (tipo) => {
    const r = await fetch('/api/registos.php?tipo=' + tipo, { headers });
    if (!r.ok) return null;
    const json = await r.json();
    return json.ok ? json.registos : null;
  };
  let novasInsc = 0, novasMsgs = 0;
  try {
    const inscricoes = await puxar('inscricao');
    if (inscricoes) {
      inscricoes.forEach(item => {
        if (!DB.inscricoes.find(x => x.id === item.id)) {
          DB.inscricoes.unshift(_mapInscricaoServidor(item));
          novasInsc++;
        }
      });
    }
    const mensagens = await puxar('contacto');
    if (mensagens) {
      mensagens.forEach(item => {
        if (!DB.mensagens.find(x => x.id === item.id)) {
          DB.mensagens.unshift(item);
          novasMsgs++;
        }
      });
    }
  } catch (_) { return; }
  if (novasInsc || novasMsgs) {
    saveDB();
    renderInscricoes();
    renderMensagens();
    renderDashboard();
    updateBadges();
    const partes = [];
    if (novasInsc) partes.push(novasInsc + (novasInsc === 1 ? ' nova inscrição' : ' novas inscrições'));
    if (novasMsgs) partes.push(novasMsgs + (novasMsgs === 1 ? ' nova mensagem' : ' novas mensagens'));
    showToast('📥 ' + partes.join(' e ') + ' do servidor', 'green');
  }
}

// ---- MANUTENÇÃO ----
function _applyManutencaoSlider(on) {
  const slider = document.getElementById('cfgManutencaoSlider');
  const thumb  = document.getElementById('cfgManutencaoThumb');
  if (!slider) return;
  slider.style.background = on ? '#e53e3e' : '#ccc';
  if (thumb) thumb.style.transform = on ? 'translateX(24px)' : 'translateX(0)';
}

window.toggleManutencao = function(on) {
  _applyManutencaoSlider(on);
};

window.guardarManutencao = function() {
  const on  = document.getElementById('cfgManutencao')?.checked || false;
  const msg = document.getElementById('cfgManutencaoMsg')?.value.trim()
              || 'Estamos a melhorar o site. Voltamos em breve!';
  localStorage.setItem('site_manutencao', JSON.stringify({ ativo: on, mensagem: msg }));
  const st = document.getElementById('cfgManutencaoStatus');
  if (st) {
    st.style.display = '';
    st.style.color   = on ? '#c00' : '#16a34a';
    st.textContent   = on ? '🔴 Site em manutenção — visitantes veem a página de manutenção.' : '🟢 Site público activo.';
  }
  showToast(on ? 'Modo de manutenção activado.' : 'Site público reactivado.', on ? 'red' : 'green');
};

function guardarDadosClube() {
  const existing = JSON.parse(localStorage.getItem('dados_clube') || '{}');
  const clube = {
    ...existing,
    nome:    document.getElementById('cfgClubNome').value.trim(),
    sigla:   document.getElementById('cfgClubSigla').value.trim(),
    ano:     document.getElementById('cfgClubAno').value.trim(),
    estadio: document.getElementById('cfgClubEstadio').value.trim(),
    navNome: document.getElementById('cfgNavNome').value.trim(),
    navSub:  document.getElementById('cfgNavSub').value.trim(),
    logo:    document.getElementById('cfgClubLogo').value.trim(),
  };
  localStorage.setItem('dados_clube', JSON.stringify(clube));
  showToast('✓ Dados do clube guardados! Atualize o site para ver as mudanças.', 'green');
}

window.removerLogoClube = function() {
  const existing = JSON.parse(localStorage.getItem('dados_clube') || '{}');
  existing.logo = '';
  localStorage.setItem('dados_clube', JSON.stringify(existing));
  const el = document.getElementById('cfgClubLogo');
  if (el) el.value = '';
  const prev = document.getElementById('cfgClubLogoPreview');
  if (prev) prev.style.display = 'none';
  showToast('Logótipo removido.', 'green');
};

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
  const ls = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  // Classificações e jogos por escalão/equipa (chaves dinâmicas)
  const classData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('fpf_class_') || k.startsWith('fpf_jogos_'))) {
      const v = ls(k);
      if (v) classData[k] = v;
    }
  }
  const dados = {
    exportadoEm:    new Date().toISOString(),
    versao:         '3',
    // Dados operacionais
    inscricoes:     DB.inscricoes,
    atletas:        DB.atletas,
    noticias:       loadNoticias(),
    mensagens:      DB.mensagens,
    escaloes:       DB.escaloes,
    jogos:          DB.jogos,
    patrocinadores: DB.patrocinadores,
    galeria:        DB.galeria,
    treinadores:    DB.treinadores,
    agenda:         DB.agenda,
    modalidades:    DB.modalidades,
    modPosts:       ls('db_mod_posts'),
    videos:         DB.videos,
    seniores:       ls('db_seniores'),
    senioresInfo:   ls('db_seniores_info'),
    fbPosts:        ls('fb_posts'),
    fbConfig:       ls('fb_config'),
    logos:          ls('db_logos'),
    classConfig:    ls('fpf_sync_config'),
    classData:      Object.keys(classData).length ? classData : null,
    // Configurações do site
    siteConfig:     ls('site_config'),
    dadosClube:     ls('dados_clube'),
    sitePopup:      ls('site_popup'),
    siteManutencao: ls('site_manutencao'),
    siteLegal:      ls('site_legal'),
    siteBanner:     ls('site_banner'),
    siteAviso:      ls('site_aviso'),
    siteCores:      ls('site_cores'),
    emailConfig:    ls('email_config'),
    apiToken:       ls('jsc_api_token'),
    adminCreds:     ls('admin_creds'),
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `backup-campinense-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('✓ Backup completo exportado!', 'green');
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
      const d = JSON.parse(ev.target.result);
      // Dados operacionais
      if (d.inscricoes)     DB.inscricoes     = d.inscricoes;
      if (d.atletas)        DB.atletas        = d.atletas;
      if (d.noticias)       saveNoticias(d.noticias);
      if (d.mensagens)      DB.mensagens      = d.mensagens;
      if (d.escaloes)       DB.escaloes       = d.escaloes;
      if (d.jogos)          DB.jogos          = d.jogos;
      if (d.patrocinadores) DB.patrocinadores = d.patrocinadores;
      if (d.galeria)        DB.galeria        = d.galeria;
      if (d.treinadores)    DB.treinadores    = d.treinadores;
      if (d.agenda)         DB.agenda         = d.agenda;
      if (d.modalidades)    DB.modalidades    = d.modalidades;
      if (d.videos)         DB.videos         = d.videos;
      saveDB();
      // localStorage direto
      const lsSet = (key, val) => { if (val !== null && val !== undefined) localStorage.setItem(key, JSON.stringify(val)); };
      lsSet('db_seniores',      d.seniores);
      lsSet('db_seniores_info', d.senioresInfo);
      lsSet('db_mod_posts',     d.modPosts);
      lsSet('fb_posts',         d.fbPosts);
      lsSet('fb_config',        d.fbConfig);
      lsSet('db_logos',         d.logos);
      lsSet('fpf_sync_config',  d.classConfig);
      if (d.classData && typeof d.classData === 'object') {
        Object.keys(d.classData).forEach((k) => {
          if (k.startsWith('fpf_class_') || k.startsWith('fpf_jogos_')) lsSet(k, d.classData[k]);
        });
      }
      lsSet('site_config',      d.siteConfig);
      lsSet('dados_clube',      d.dadosClube);
      lsSet('site_popup',       d.sitePopup);
      lsSet('site_banner',      d.siteBanner);
      lsSet('site_manutencao',  d.siteManutencao);
      lsSet('site_legal',       d.siteLegal);
      lsSet('site_aviso',       d.siteAviso);
      lsSet('site_cores',       d.siteCores);
      lsSet('email_config',     d.emailConfig);
      lsSet('jsc_api_token',    d.apiToken);
      if (d.adminCreds) lsSet('admin_creds', d.adminCreds);
      showToast('✓ Backup importado com sucesso! A recarregar...', 'green');
      setTimeout(() => location.reload(), 1500);
    } catch {
      showToast('Ficheiro inválido ou corrompido', 'red');
    }
  };
  reader.readAsText(file);
}

// =============================================
// MODALIDADES
// =============================================

function initModalidades() {
  renderModalidades();
  document.getElementById('btnNovaModalidade')?.addEventListener('click', () => editModalidade(-1));
}

function renderModalidades() {
  const tbody = document.querySelector('#modalidadesTable tbody');
  if (!tbody) return;
  const lista = DB.modalidades || [];
  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#999;padding:32px">Sem modalidades. Clique em "+ Nova Modalidade" para adicionar.</td></tr>`;
    return;
  }
  tbody.innerHTML = lista.map((m, i) => {
    const nPosts = (JSON.parse(localStorage.getItem('db_mod_posts') || '[]')).filter(p => p.modalidadeId == m.id).length;
    return `
    <tr>
      <td style="font-size:1.5rem;text-align:center">${m.icone || '🏅'}</td>
      <td><strong>${m.nome}</strong></td>
      <td style="font-size:0.85rem">${m.treinos || '—'}</td>
      <td style="font-size:0.85rem">${m.local || '—'}</td>
      <td style="font-size:0.85rem">${m.responsavel || '—'}</td>
      <td>${m.ativo !== false ? '<span class="status status--aprovado">Ativa</span>' : '<span class="status status--rejeitado">Inativa</span>'}</td>
      <td>
        <button class="btn-sm" onclick="gerirPostsMod(${m.id}, '${m.nome.replace(/'/g,"\\'")}')">&#128196; Posts${nPosts ? ' ('+nPosts+')' : ''}</button>
        <button class="btn-sm" onclick="editModalidade(${i})">Editar</button>
        <button class="btn-sm btn-sm--danger" onclick="deleteModalidade(${i})">Remover</button>
      </td>
    </tr>`;
  }).join('');
}

function editModalidade(idx) {
  const m = idx >= 0 ? DB.modalidades[idx] : { nome:'', icone:'🏅', descricao:'', treinos:'', local:'', responsavel:'', ativo:true, imagem:'', imagemPos:'center' };
  openModal(
    idx >= 0 ? 'Editar Modalidade' : 'Nova Modalidade',
    `<div style="display:grid;gap:14px">
      <div class="modal-field">
        <label class="form-label">Nome da modalidade</label>
        <input class="form-input" type="text" id="mNome" value="${m.nome}" placeholder="Ex: Kickboxing, Judo, Natação..." />
      </div>
      <div class="modal-field">
        <label class="form-label">Ícone (emoji)</label>
        <div style="display:flex;align-items:center;gap:10px">
          <button type="button" id="mIconeBtn" class="emoji-picker-trigger" onclick="toggleEmojiPicker('mIcone','mIconeBtn')" title="Escolher emoji">${m.icone || '🏅'}</button>
          <input class="form-input" type="text" id="mIcone" value="${m.icone || '🏅'}" placeholder="🥊" style="font-size:1.3rem;width:90px" oninput="document.getElementById('mIconeBtn').textContent=this.value||'🏅'" />
        </div>
        <div id="emojiPickerRoot"></div>
      </div>
      <div class="modal-field">
        <label class="form-label">Descrição</label>
        <textarea class="form-input" id="mDesc" rows="3" placeholder="Breve descrição da modalidade...">${m.descricao || ''}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="modal-field">
          <label class="form-label">Horários de treino</label>
          <input class="form-input" type="text" id="mTreinos" value="${m.treinos || ''}" placeholder="3ª e 5ª — 19h00" />
        </div>
        <div class="modal-field">
          <label class="form-label">Local</label>
          <input class="form-input" type="text" id="mLocal" value="${m.local || ''}" placeholder="Pavilhão Municipal" />
        </div>
      </div>
      <div class="modal-field">
        <label class="form-label">Responsável / Treinador</label>
        <input class="form-input" type="text" id="mResponsavel" value="${m.responsavel || ''}" placeholder="Nome do responsável" />
      </div>
      <div class="modal-field">
        <label class="form-label">Imagem de fundo (URL ou upload)</label>
        <input class="form-input" type="text" id="mImagem" value="${m.imagem || ''}" placeholder="https://..." />
        <input type="file" id="mFicheiro" accept="image/*" style="display:none" />
        <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mFicheiro').click()">&#128190; Carregar imagem</button>
        <div id="mPreview" style="${m.imagem ? '' : 'display:none'};margin-top:8px;position:relative;display:${m.imagem?'':'none'}">
          <img src="${m.imagem || ''}" style="max-height:100px;border-radius:6px;object-fit:cover" />
          <button type="button" class="btn-sm btn-sm--danger" style="margin-left:8px;vertical-align:top" onclick="document.getElementById('mImagem').value='';document.getElementById('mPreview').style.display='none'">Remover</button>
        </div>
      </div>
      <div class="modal-field">
        <label class="form-label">Posição da imagem</label>
        <select class="form-input" id="mImgPos">
          <option value="center" ${(m.imagemPos||'center')==='center'?'selected':''}>Centro</option>
          <option value="top" ${m.imagemPos==='top'?'selected':''}>Topo</option>
          <option value="bottom" ${m.imagemPos==='bottom'?'selected':''}>Base</option>
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="mAtivo" ${m.ativo !== false ? 'checked' : ''} style="width:16px;height:16px" />
        Modalidade ativa (visível no site)
      </label>
    </div>`,
    `<button class="btn-save" onclick="saveModalidade(${idx})">Guardar</button>
     <button class="btn-cancel" onclick="closeModal()">Cancelar</button>`
  );
  setupImageUpload('mFicheiro', 'mImagem', 'mPreview');
}

function saveModalidade(idx) {
  const nome = document.getElementById('mNome').value.trim();
  if (!nome) { showToast('Introduza o nome da modalidade', 'red'); return; }
  const obj = {
    id:           idx >= 0 ? DB.modalidades[idx].id : (Date.now()),
    nome,
    icone:        document.getElementById('mIcone').value.trim() || '🏅',
    descricao:    document.getElementById('mDesc').value.trim(),
    treinos:      document.getElementById('mTreinos').value.trim(),
    local:        document.getElementById('mLocal').value.trim(),
    responsavel:  document.getElementById('mResponsavel').value.trim(),
    imagem:       document.getElementById('mImagem').value.trim(),
    imagemPos:    document.getElementById('mImgPos').value,
    ativo:        document.getElementById('mAtivo').checked,
  };
  if (idx >= 0) DB.modalidades[idx] = obj;
  else DB.modalidades.push(obj);
  saveDB();
  closeModal();
  renderModalidades();
  showToast(idx >= 0 ? 'Modalidade atualizada' : 'Modalidade adicionada', 'green');
}

function deleteModalidade(idx) {
  if (!confirm('Remover esta modalidade?')) return;
  DB.modalidades.splice(idx, 1);
  saveDB();
  renderModalidades();
  showToast('Modalidade removida', 'green');
}

// =============================================
// POSTS DE MODALIDADE
// =============================================

function loadModPosts() {
  try { return JSON.parse(localStorage.getItem('db_mod_posts') || '[]'); } catch(e) { return []; }
}
function saveModPosts(arr) {
  try { localStorage.setItem('db_mod_posts', JSON.stringify(arr)); return true; }
  catch(e) { showToast('ERRO: armazenamento cheio.', 'red'); return false; }
}

function gerirPostsMod(modId, modNome) {
  function buildList() {
    const posts = loadModPosts().filter(p => p.modalidadeId == modId)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const rows = posts.length
      ? posts.map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:0.93rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.titulo}</div>
              <div style="font-size:0.78rem;color:#888">${p.data || ''} · ${p.publicada ? '<span style="color:#22a75e">Publicado</span>' : '<span style="color:#e05">Rascunho</span>'}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn-sm" onclick="abrirFormPostMod(${modId},'${modNome.replace(/'/g,"\\'")}',${p.id})">Editar</button>
              <button class="btn-sm btn-sm--danger" onclick="deletePostMod(${modId},'${modNome.replace(/'/g,"\\'")}',${p.id})">&#128465;</button>
            </div>
          </div>`).join('')
      : `<p style="color:#999;text-align:center;padding:24px 0">Sem publicações. Crie a primeira!</p>`;
    return `<div style="max-height:320px;overflow-y:auto">${rows}</div>`;
  }

  openModal(
    `Publicações — ${modNome}`,
    buildList(),
    `<button class="btn-save" onclick="abrirFormPostMod(${modId},'${modNome.replace(/'/g,"\\'")}',null)">+ Nova publicação</button>
     <a href="../modalidade.html?id=${modId}" target="_blank" class="btn-cancel" style="text-decoration:none">Ver página &#8599;</a>
     <button class="btn-cancel" onclick="closeModal()">Fechar</button>`
  );
}

function focalToPercent(pos) {
  var map = {
    'top left':[0,0],'top':[50,0],'top right':[100,0],
    'left':[0,50],'center':[50,50],'right':[100,50],
    'bottom left':[0,100],'bottom':[50,100],'bottom right':[100,100]
  };
  if (map[pos]) return map[pos];
  var parts = String(pos).split(' ');
  if (parts.length === 2) return [parseFloat(parts[0]), parseFloat(parts[1])];
  return [50, 50];
}

function abrirFormPostMod(modId, modNome, postId) {
  const posts = loadModPosts();
  const p = postId ? (posts.find(x => x.id == postId) || {}) : {};
  const curPos  = p.imagemPos  || 'center';
  const curSize = p.imagemSize || 'cover';
  const pct = focalToPercent(curPos);
  openModal(
    postId ? 'Editar Publicação' : 'Nova Publicação',
    `<div style="display:grid;gap:14px">
      <div class="modal-field">
        <label class="form-label">Título *</label>
        <input class="form-input" type="text" id="mpTitulo" value="${(p.titulo||'').replace(/"/g,'&quot;')}" placeholder="Título da publicação" />
      </div>
      <div class="modal-field">
        <label class="form-label">Texto / Conteúdo</label>
        <textarea class="form-input" id="mpTexto" rows="5" placeholder="Conteúdo da publicação...">${p.texto || ''}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="modal-field">
          <label class="form-label">Data</label>
          <input class="form-input" type="date" id="mpData" value="${p.data || new Date().toISOString().slice(0,10)}" />
        </div>
        <div class="modal-field">
          <label class="form-label">Estado</label>
          <select class="form-input" id="mpPublicada">
            <option value="1" ${p.publicada ? 'selected' : ''}>Publicado</option>
            <option value="0" ${!p.publicada && postId ? 'selected' : ''}>Rascunho</option>
          </select>
        </div>
      </div>
      <div class="modal-field">
        <label class="form-label">Imagem (URL ou upload)</label>
        <input class="form-input" type="text" id="mpImagem" value="${p.imagem || ''}" placeholder="https://..." oninput="previewModPostImg(this.value)" />
        <input type="file" id="mpFicheiro" accept="image/*" style="display:none" onchange="uploadModPostImg(this)" />
        <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mpFicheiro').click()">&#128190; Carregar</button>
      </div>
      <div class="modal-field">
        <label class="form-label">Tamanho</label>
        <select class="form-input" id="mpImagemSize" onchange="updateModPostPreview()">
          <option value="cover"   ${curSize==='cover'   ?'selected':''}>Preencher (recortar)</option>
          <option value="contain" ${curSize==='contain' ?'selected':''}>Completa (sem recorte)</option>
        </select>
      </div>
      <input type="hidden" id="mpImagemPos" value="${curPos}" />
      <div id="mpPreview" style="${p.imagem ? '' : 'display:none'}">
        <label class="form-label" style="margin-bottom:4px;display:block">
          Pré-visualização
          <small style="color:#888;font-weight:400;margin-left:6px">— clique na imagem para definir o ponto focal</small>
        </label>
        <div id="mpPreviewWrap" style="position:relative;border-radius:8px;overflow:hidden;background:#1a3a80;height:220px;cursor:crosshair">
          <img id="mpPreviewImg" src="${p.imagem || ''}"
            style="width:100%;height:100%;object-fit:${curSize==='contain'?'contain':'cover'};object-position:${curPos};pointer-events:none;display:block" />
          <div id="mpFocalPin" style="position:absolute;left:${pct[0]}%;top:${pct[1]}%;transform:translate(-50%,-50%);pointer-events:none;z-index:3;display:${p.imagem?'block':'none'}">
            <svg width="30" height="30" viewBox="0 0 30 30" style="filter:drop-shadow(0 1px 4px rgba(0,0,0,0.6))">
              <circle cx="15" cy="15" r="13" fill="white" fill-opacity="0.92"/>
              <circle cx="15" cy="15" r="5" fill="#0055cc"/>
              <line x1="15" y1="2" x2="15" y2="8" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
              <line x1="15" y1="22" x2="15" y2="28" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
              <line x1="2" y1="15" x2="8" y2="15" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
              <line x1="22" y1="15" x2="28" y2="15" stroke="#0055cc" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>`,
    `<button class="btn-save" onclick="savePostMod(${modId},'${modNome.replace(/'/g,"\\'")}',${postId||null})">Guardar</button>
     <button class="btn-cancel" onclick="gerirPostsMod(${modId},'${modNome.replace(/'/g,"\\'")}')">&#8592; Voltar</button>`
  );
  setTimeout(function () {
    var wrap = document.getElementById('mpPreviewWrap');
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var rect = wrap.getBoundingClientRect();
      var x = Math.round((e.clientX - rect.left) / rect.width * 100);
      var y = Math.round((e.clientY - rect.top)  / rect.height * 100);
      var pos = x + '% ' + y + '%';
      var input = document.getElementById('mpImagemPos');
      var img   = document.getElementById('mpPreviewImg');
      var pin   = document.getElementById('mpFocalPin');
      if (input) input.value = pos;
      if (img)   img.style.objectPosition = pos;
      if (pin) { pin.style.left = x + '%'; pin.style.top = y + '%'; pin.style.display = 'block'; }
    });
  }, 0);
}

function previewModPostImg(url) {
  var prev = document.getElementById('mpPreview');
  var img  = document.getElementById('mpPreviewImg');
  var pin  = document.getElementById('mpFocalPin');
  if (!prev || !img) return;
  if (url) {
    img.src = url;
    img.style.objectFit      = document.getElementById('mpImagemSize')?.value === 'contain' ? 'contain' : 'cover';
    img.style.objectPosition = document.getElementById('mpImagemPos')?.value || 'center';
    if (pin) pin.style.display = 'block';
    prev.style.display = '';
  } else {
    prev.style.display = 'none';
  }
}
function updateModPostPreview() {
  var img = document.getElementById('mpPreviewImg');
  if (!img) return;
  img.style.objectFit      = document.getElementById('mpImagemSize')?.value === 'contain' ? 'contain' : 'cover';
  img.style.objectPosition = document.getElementById('mpImagemPos')?.value || 'center';
  var src  = document.getElementById('mpImagem')?.value.trim();
  var prev = document.getElementById('mpPreview');
  if (prev && src) prev.style.display = '';
}
window.updateModPostPreview = updateModPostPreview;

function uploadModPostImg(input) {
  if (!input.files || !input.files[0]) return;
  compressImage(input.files[0], function(dataUrl, sizeKb) {
    document.getElementById('mpImagem').value = dataUrl;
    previewModPostImg(dataUrl);
    showToast('Imagem carregada (' + sizeKb + ' KB)', 'green');
  });
}

function savePostMod(modId, modNome, postId) {
  const titulo = document.getElementById('mpTitulo')?.value.trim();
  if (!titulo) { showToast('Introduza o título.', 'red'); return; }
  const post = {
    id:           postId || Date.now(),
    modalidadeId: modId,
    titulo,
    texto:     document.getElementById('mpTexto')?.value.trim() || '',
    data:      document.getElementById('mpData')?.value || '',
    imagem:      document.getElementById('mpImagem')?.value.trim() || '',
    imagemSize:  document.getElementById('mpImagemSize')?.value || 'cover',
    imagemPos:   document.getElementById('mpImagemPos')?.value  || 'center',
    publicada:   document.getElementById('mpPublicada')?.value === '1',
  };
  const posts = loadModPosts();
  const idx = posts.findIndex(x => x.id == postId);
  if (idx >= 0) posts[idx] = post;
  else posts.unshift(post);
  if (!saveModPosts(posts)) return;
  showToast(postId ? 'Publicação atualizada' : 'Publicação criada', 'green');
  renderModalidades();
  gerirPostsMod(modId, modNome);
}

function deletePostMod(modId, modNome, postId) {
  if (!confirm('Remover esta publicação?')) return;
  const posts = loadModPosts().filter(p => p.id != postId);
  saveModPosts(posts);
  showToast('Publicação removida', 'green');
  renderModalidades();
  gerirPostsMod(modId, modNome);
}

// =============================================
// EMAIL CONFIG (EmailJS + Servidor PHP)
// =============================================

// Toggle painéis conforme o modo seleccionado
document.querySelectorAll('input[name="emailMode"]').forEach(r => {
  r.addEventListener('change', () => {
    const isServer = r.value === 'server';
    const pJS  = document.getElementById('panelEmailJS');
    const pSrv = document.getElementById('panelServer');
    if (pJS)  pJS.style.display  = isServer ? 'none' : '';
    if (pSrv) pSrv.style.display = isServer ? '' : 'none';
    // update label styles
    document.querySelectorAll('input[name="emailMode"]').forEach(rb => {
      const lbl = rb.closest('label');
      if (!lbl) return;
      lbl.style.borderColor = rb.checked ? '#003B8E' : '#ddd';
      lbl.style.background  = rb.checked ? '#e8f0fe' : '';
      lbl.style.color       = rb.checked ? '#003B8E' : '#555';
    });
  });
});

function guardarEmailConfig() {
  const mode = document.querySelector('input[name="emailMode"]:checked')?.value || 'emailjs';
  const cfg = {
    mode,
    dest:         document.getElementById('cfgEmailDest')?.value.trim()        || '',
    // EmailJS
    publicKey:    document.getElementById('cfgEmailPublicKey')?.value.trim()   || '',
    serviceId:    document.getElementById('cfgEmailServiceId')?.value.trim()   || '',
    tplContacto:  document.getElementById('cfgEmailTplContacto')?.value.trim() || '',
    tplInscricao: document.getElementById('cfgEmailTplInscricao')?.value.trim()|| '',
    // Servidor PHP
    serverUrl:    document.getElementById('cfgServerUrl')?.value.trim()        || '',
    serverToken:  document.getElementById('cfgServerToken')?.value.trim()      || '',
  };
  localStorage.setItem('email_config', JSON.stringify(cfg));
  _updateEmailStatus(cfg);
  showToast('✓ Configuração de email guardada', 'green');
}

function _updateEmailStatus(cfg) {
  const statusEl = document.getElementById('emailConfigStatus');
  if (!statusEl) return;
  const ok = (cfg.mode === 'server' && cfg.serverUrl)
          || (cfg.mode !== 'server' && cfg.publicKey && cfg.serviceId);
  if (ok) {
    statusEl.style.cssText = 'display:block;background:#d4edda;border-left:4px solid #28a745;border-radius:6px;padding:10px 14px;font-size:13px;color:#155724';
    statusEl.textContent   = cfg.mode === 'server'
      ? '✓ Modo servidor PHP — mail.php em ' + cfg.serverUrl
      : '✓ Modo EmailJS — formulários irão enviar emails reais.';
  } else {
    statusEl.style.cssText = 'display:block;background:#fff3cd;border-left:4px solid #ffc107;border-radius:6px;padding:10px 14px;font-size:13px;color:#856404';
    statusEl.textContent   = '⚠ Sem configuração completa — a enviar emails reais requer todos os campos preenchidos.';
  }
}

async function testarEmail() {
  const cfg = JSON.parse(localStorage.getItem('email_config') || '{}');
  const btn = document.getElementById('btnTestarEmail');
  if (btn) { btn.textContent = 'A enviar...'; btn.disabled = true; }

  try {
    if (cfg.mode === 'server') {
      if (!cfg.serverUrl) throw new Error('Configure o URL do servidor antes de testar.');
      const res = await fetch(cfg.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-Token': cfg.serverToken || '' },
        body: JSON.stringify({
          _tipo: 'contacto', _token: cfg.serverToken || '',
          nome: 'Teste Admin', email: cfg.dest || 'admin@jscampinense.pt',
          telefone: '+351 000 000 000', assunto: 'Teste', mensagem: 'Email de teste do painel JSC.',
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Erro desconhecido');
    } else {
      if (!cfg.publicKey || !cfg.serviceId || !cfg.tplContacto)
        throw new Error('Preencha Public Key, Service ID e Template de Contacto.');
      await loadEmailJS(cfg.publicKey);
      await window.emailjs.send(cfg.serviceId, cfg.tplContacto, {
        nome: 'Teste Admin', email: cfg.dest || '', telefone: '+351 000 000 000',
        assunto: 'Teste JSC Admin', mensagem: 'Email de teste do painel administrativo.',
        to_email: cfg.dest,
      });
    }
    showToast('✓ Email de teste enviado com sucesso!', 'green');
  } catch(err) {
    showToast('Erro: ' + (err?.text || err?.message || JSON.stringify(err)), 'red');
  } finally {
    if (btn) { btn.textContent = '✉ Enviar email de teste'; btn.disabled = false; }
  }
}

// Envia configuração SMTP ao servidor via POST (para escrita em .env ou validação)
async function enviarConfigServidor() {
  const url = document.getElementById('cfgServerUrl')?.value.trim();
  if (!url) { showToast('Introduza primeiro o URL do servidor', 'red'); return; }
  const smtpCfg = {
    _action:     'save_smtp',
    _token:      document.getElementById('cfgServerToken')?.value.trim() || '',
    smtp_host:   document.getElementById('cfgSmtpHost')?.value.trim()   || '',
    smtp_port:   document.getElementById('cfgSmtpPort')?.value          || '587',
    smtp_user:   document.getElementById('cfgSmtpUser')?.value.trim()   || '',
    smtp_pass:   document.getElementById('cfgSmtpPass')?.value          || '',
    smtp_secure: document.getElementById('cfgSmtpSecure')?.value        || 'tls',
    mail_to:     document.getElementById('cfgEmailDest')?.value.trim()  || '',
  };
  try {
    const res  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret-Token': smtpCfg._token },
      body: JSON.stringify(smtpCfg),
    });
    const json = await res.json();
    if (json.ok) showToast('✓ Configuração SMTP guardada no servidor', 'green');
    else throw new Error(json.error);
  } catch(e) {
    showToast('Erro: ' + e.message, 'red');
  }
}

// Carrega o SDK do EmailJS dinamicamente (apenas uma vez)
function loadEmailJS(publicKey) {
  return new Promise((resolve, reject) => {
    if (window.emailjs) {
      window.emailjs.init({ publicKey });
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    script.onload = () => {
      window.emailjs.init({ publicKey });
      resolve();
    };
    script.onerror = () => reject(new Error('Falha ao carregar EmailJS SDK'));
    document.head.appendChild(script);
  });
}

// Exportar para uso nos formulários públicos
window.getEmailConfig    = () => JSON.parse(localStorage.getItem('email_config') || '{}');
window.loadEmailJS       = loadEmailJS;

// =============================================
// EQUIPA SÉNIOR — CRUD
// =============================================

function initSeniores() {
  // Load info fields
  const info = DB.senioresInfo || {};
  ['Temporada','Liga','Treinador','Treinos','Estadio','Descricao'].forEach(key => {
    const el = document.getElementById('seniorInfo' + key);
    if (el) el.value = info[key.toLowerCase()] || '';
  });

  renderSeniores();

  const btnInfo = document.getElementById('btnGuardarInfoSeniores');
  if (btnInfo && !btnInfo._bound) {
    btnInfo._bound = true;
    btnInfo.addEventListener('click', guardarInfoSeniores);
  }

  const btnNovo = document.getElementById('btnNovoJogador');
  if (btnNovo && !btnNovo._bound) {
    btnNovo._bound = true;
    btnNovo.addEventListener('click', () => editJogador(null));
  }
}

function renderSeniores() {
  const tbody = document.querySelector('#senioresTable tbody');
  if (!tbody) return;
  const plantel = DB.seniores || [];
  if (!plantel.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:24px">Nenhum jogador registado</td></tr>';
    return;
  }
  const posOrder = { GR: 0, DEF: 1, MEI: 2, AVA: 3 };
  const sorted = [...plantel].sort((a, b) => {
    const pd = (posOrder[a.posicao] ?? 9) - (posOrder[b.posicao] ?? 9);
    return pd !== 0 ? pd : (a.numero || 99) - (b.numero || 99);
  });
  tbody.innerHTML = sorted.map(j => `
    <tr data-id="${j.id}">
      <td><strong>${j.numero || '—'}</strong></td>
      <td>${j.nome}</td>
      <td><span class="badge" style="${posBadgeStyle(j.posicao)}">${j.posicaoFull || j.posicao}</span></td>
      <td>${j.foto ? `<img src="${j.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : '<span style="color:#aaa">—</span>'}</td>
      <td>${j.ativo !== false ? '<span class="badge badge--success">Ativo</span>' : '<span class="badge badge--danger">Inativo</span>'}</td>
      <td>
        <button class="btn-icon" onclick="editJogador('${j.id}')">&#9998;</button>
        <button class="btn-icon btn-icon--danger" onclick="deleteJogador('${j.id}')">&#128465;</button>
      </td>
    </tr>`).join('');
}

function posBadgeStyle(pos) {
  const styles = {
    GR:  'background:rgba(34,197,94,0.15);color:#16a34a;padding:2px 8px;border-radius:20px',
    DEF: 'background:rgba(59,130,246,0.15);color:#2563eb;padding:2px 8px;border-radius:20px',
    MEI: 'background:rgba(251,191,36,0.15);color:#b45309;padding:2px 8px;border-radius:20px',
    AVA: 'background:rgba(239,68,68,0.15);color:#dc2626;padding:2px 8px;border-radius:20px',
  };
  return styles[pos] || '';
}

function editJogador(id) {
  const existing = id ? (DB.seniores || []).find(j => j.id === id) : null;
  const j = existing || { id: 'j_' + Date.now(), nome: '', numero: '', posicao: 'DEF', posicaoFull: 'Defesa', foto: '', ativo: true };

  const posicoes = [
    { val: 'GR',  label: 'Guarda-Redes' },
    { val: 'DEF', label: 'Defesa' },
    { val: 'MEI', label: 'Médio' },
    { val: 'AVA', label: 'Avançado' },
  ];

  openModal(
    id ? 'Editar Jogador' : 'Novo Jogador',
    `<div class="form-grid" style="grid-template-columns:1fr 1fr;gap:16px">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-control" id="fldJNome" value="${j.nome}">
        </div>
        <div class="form-group">
          <label class="form-label">Número</label>
          <input class="form-control" id="fldJNumero" type="number" min="1" max="99" value="${j.numero}">
        </div>
        <div class="form-group">
          <label class="form-label">Posição</label>
          <select class="form-control" id="fldJPosicao">
            ${posicoes.map(p => `<option value="${p.val}" ${j.posicao===p.val?'selected':''}>${p.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-control" id="fldJAtivo">
            <option value="1" ${j.ativo!==false?'selected':''}>Ativo</option>
            <option value="0" ${j.ativo===false?'selected':''}>Inativo</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">Foto (URL ou upload)</label>
        <div style="display:flex;gap:12px;align-items:center">
          <input class="form-control" id="fldJFotoUrl" placeholder="https://..." value="${j.foto||''}" style="flex:1">
          <label class="btn-icon" style="cursor:pointer;padding:8px 12px;background:#f0f0f0;border-radius:8px">
            &#128247;
            <input type="file" accept="image/*" id="fldJFotoFile" style="display:none">
          </label>
        </div>
        <div id="fldJFotoPreview" style="margin-top:10px;${j.foto?'':'display:none'}">
          <img id="fldJFotoImg" src="${j.foto||''}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #e0e0e0">
        </div>
      </div>`,
    `<button class="btn-save" onclick="saveJogador('${j.id}','${id||''}')">&#128190; Guardar</button>
     <button class="btn-cancel" onclick="closeModal()">Cancelar</button>`
  );

  // Photo URL preview
  document.getElementById('fldJFotoUrl').addEventListener('input', function() {
    const preview = document.getElementById('fldJFotoPreview');
    const img = document.getElementById('fldJFotoImg');
    if (this.value) { img.src = this.value; preview.style.display = ''; }
    else { preview.style.display = 'none'; }
  });

  // File upload
  document.getElementById('fldJFotoFile').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    compressImage(file, dataUrl => {
      document.getElementById('fldJFotoUrl').value = dataUrl;
      document.getElementById('fldJFotoImg').src = dataUrl;
      document.getElementById('fldJFotoPreview').style.display = '';
    });
  });
}

function saveJogador(id, originalId) {
  const nome = document.getElementById('fldJNome')?.value.trim();
  if (!nome) { alert('O nome é obrigatório.'); return; }

  const posEl = document.getElementById('fldJPosicao');
  const posLabels = { GR: 'Guarda-Redes', DEF: 'Defesa', MEI: 'Médio', AVA: 'Avançado' };
  const pos = posEl.value;

  const jogador = {
    id,
    nome,
    numero: parseInt(document.getElementById('fldJNumero')?.value) || '',
    posicao: pos,
    posicaoFull: posLabels[pos] || pos,
    foto: document.getElementById('fldJFotoUrl')?.value.trim() || '',
    ativo: document.getElementById('fldJAtivo')?.value === '1',
  };

  if (!DB.seniores) DB.seniores = [];
  const idx = DB.seniores.findIndex(j => j.id === id);
  if (idx >= 0) {
    DB.seniores[idx] = jogador;
  } else {
    DB.seniores.push(jogador);
  }

  saveDB();
  closeModal();
  renderSeniores();
}

function deleteJogador(id) {
  if (!confirm('Eliminar este jogador do plantel?')) return;
  DB.seniores = (DB.seniores || []).filter(j => j.id !== id);
  saveDB();
  renderSeniores();
}

function guardarInfoSeniores() {
  if (!DB.senioresInfo) DB.senioresInfo = {};
  DB.senioresInfo.temporada = document.getElementById('seniorInfoTemporada')?.value.trim() || '';
  DB.senioresInfo.liga      = document.getElementById('seniorInfoLiga')?.value.trim() || '';
  DB.senioresInfo.treinador = document.getElementById('seniorInfoTreinador')?.value.trim() || '';
  DB.senioresInfo.treinos   = document.getElementById('seniorInfoTreinos')?.value.trim() || '';
  DB.senioresInfo.estadio   = document.getElementById('seniorInfoEstadio')?.value.trim() || '';
  DB.senioresInfo.descricao = document.getElementById('seniorInfoDescricao')?.value.trim() || '';
  saveDB();
  const btn = document.getElementById('btnGuardarInfoSeniores');
  if (btn) { btn.textContent = '✓ Guardado!'; setTimeout(() => { btn.textContent = '💾 Guardar Informações'; }, 2000); }
}

// ==================================================
// IMPORTAR SENIORES — ZeroZero
// ==================================================

let _senioresImportHTMLDoc = null;

document.getElementById('btnImportarSeniores')?.addEventListener('click', () => {
  document.getElementById('senioresImportModal').style.display = 'flex';
});

document.getElementById('btnApagarTodosSeniores')?.addEventListener('click', () => {
  const total = (DB.seniores || []).length;
  if (!total) { showToast('Não há jogadores para apagar.', ''); return; }
  if (!confirm(`Tem a certeza que pretende apagar TODOS os ${total} jogadores da equipa sénior?\n\nEsta ação não pode ser desfeita.`)) return;
  DB.seniores = [];
  saveDB();
  renderSeniores();
  showToast(`${total} jogadores removidos.`, 'red');
});

document.getElementById('senioresImportTA')?.addEventListener('paste', function(e) {
  const html = e.clipboardData?.getData('text/html');
  if (!html) return;
  try {
    _senioresImportHTMLDoc = new DOMParser().parseFromString(html, 'text/html');
    // Convert clipboard HTML → structured text WITH title-attr birth dates extracted.
    // This replaces the plain-text fallback which loses ZeroZero's hidden date attributes.
    const enriched = _docToText(_senioresImportHTMLDoc);
    if (enriched.trim().length > 50) {
      e.preventDefault();
      document.getElementById('senioresImportTA').value = enriched;
    }
  } catch(_) {}
});

window.fecharSenioresImport = function() {
  document.getElementById('senioresImportModal').style.display = 'none';
  document.getElementById('senioresImportTA').value = '';
  document.getElementById('senioresImportPreview').innerHTML = '';
  _senioresImportHTMLDoc = null;
};

function _seniorFoto(nome) {
  return _imgForNameInDoc(nome, _senioresImportHTMLDoc, 'https://www.zerozero.pt');
}

const _ZZ_POS_SENIOR = {
  'Guarda-redes': { posicao: 'GR',  posicaoFull: 'Guarda-Redes' },
  'Defesa':       { posicao: 'DEF', posicaoFull: 'Defesa' },
  'Médio':        { posicao: 'MEI', posicaoFull: 'Médio' },
  'Avançado':     { posicao: 'AVA', posicaoFull: 'Avançado' },
};

function _parseSenioresZZ(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const players = [];
  let posGrupo = '';
  const junkRe = /^(plantel|equipa|época|temporada|zerozero|guardar|filtrar|ver mais|carregar|menu|login|©|anterior|próximo|página|\.com)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (junkRe.test(line)) continue;
    if (line.length < 2) continue;

    const grupo = _zzGrupo(line);
    if (grupo) { posGrupo = grupo; continue; }

    // Skip pure date / nationality / age lines (picked up by lookahead)
    if (_normalizeDateFPF(line)) continue;
    if (_isNac(line) || /^\(?\d{1,2}\s*(anos)?\)?$/i.test(line)) continue;

    const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    let lo = 0, hi = parts.length;
    let numero = '', nome = '', dataNascimento = '';

    if (/^\d{1,2}$/.test(parts[lo])) { numero = parts[lo]; lo++; }
    if (lo >= hi) continue;
    if (/^\(?\d{1,2}\s*(anos)?\)?$/i.test(parts[hi-1])) hi--;
    if (hi > lo + 1 && _isNac(parts[hi-1])) hi--;
    const maybeDate = _normalizeDateFPF(parts[hi-1]);
    if (maybeDate && hi > lo + 1) { dataNascimento = maybeDate; hi--; }
    if (hi > lo + 1 && _isNac(parts[hi-1])) hi--;

    nome = parts.slice(lo, hi).join(' ').trim();
    if (!nome || nome.length < 2 || /^\d+$/.test(nome)) continue;

    // Lookahead for date on a separate line
    if (!dataNascimento) {
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (_zzGrupo(lines[j])) break;
        const d = _extractDate(lines[j]);
        if (d) { dataNascimento = d; break; }
      }
    }

    const posMap = _ZZ_POS_SENIOR[posGrupo] || { posicao: 'DEF', posicaoFull: posGrupo || 'Defesa' };
    players.push({ nome, numero, posicao: posMap.posicao, posicaoFull: posMap.posicaoFull, dataNascimento, foto: _seniorFoto(nome) });
  }
  return players;
}

window.previewSenioresImport = function() {
  const text = document.getElementById('senioresImportTA').value.trim();
  const prev = document.getElementById('senioresImportPreview');
  if (!text) { prev.innerHTML = ''; return; }

  const players = _parseSenioresZZ(text);
  if (!players.length) {
    prev.innerHTML = '<p style="color:#c00;font-size:0.85rem">Nenhum jogador reconhecido. Certifica-te de que copiaste a página do ZeroZero.</p>';
    return;
  }

  const existNames = (DB.seniores || []).map(j => j.nome.toLowerCase());
  const novos = players.filter(p => !existNames.includes(p.nome.toLowerCase())).length;
  const dups   = players.length - novos;
  const comFoto = players.filter(p => p.foto).length;

  prev.innerHTML = `
    <div style="font-size:0.82rem;color:#555;margin-bottom:8px">
      <strong>${players.length}</strong> jogadores reconhecidos
      · <span style="color:#16a34a">${novos} novos</span>
      ${dups ? `· <span style="color:#d97706">${dups} duplicados</span>` : ''}
      ${comFoto ? `· <span style="color:#2563eb">${comFoto} com foto</span>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
      <thead><tr style="background:#f0f4ff">
        <th style="padding:6px 8px;width:40px"></th>
        <th style="padding:6px 10px;text-align:left">#</th>
        <th style="padding:6px 10px;text-align:left">Nome</th>
        <th style="padding:6px 10px;text-align:left">Posição</th>
        <th style="padding:6px 10px;text-align:left"></th>
      </tr></thead>
      <tbody>${players.map(p => {
        const dup = existNames.includes(p.nome.toLowerCase());
        const avatar = p.foto
          ? `<img src="${p.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'">`
          : `<div style="width:32px;height:32px;border-radius:50%;background:#003B8E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700">${p.nome.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>`;
        return `<tr style="border-bottom:1px solid #eee${dup?';opacity:0.55':''}">
          <td style="padding:4px 8px">${avatar}</td>
          <td style="padding:4px 10px;color:#888">${p.numero || '—'}</td>
          <td style="padding:4px 10px;font-weight:600">${p.nome}</td>
          <td style="padding:4px 10px"><span style="${posBadgeStyle(p.posicao)}">${p.posicaoFull}</span></td>
          <td style="padding:4px 10px">${dup ? '<span style="color:#d97706;font-size:0.75rem">duplicado</span>' : '<span style="color:#16a34a;font-size:0.75rem">novo</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
};

window.diagSenioresImport = function() {
  const text = document.getElementById('senioresImportTA').value;
  const prev = document.getElementById('senioresImportPreview');
  if (!text.trim()) { prev.innerHTML = '<p style="color:#c00;font-size:0.85rem">Textarea vazia.</p>'; return; }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 30);
  const hasZZ = lines.some(l => _zzGrupo(l) !== null);
  prev.innerHTML = `
    <div style="font-size:0.8rem;color:#555;margin-bottom:6px">
      Modo: <strong>${hasZZ ? 'ZeroZero (grupos por posição detectados)' : 'Genérico'}</strong>
      &nbsp;·&nbsp; ${text.split('\n').filter(l=>l.trim()).length} linhas
    </div>
    <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:10px;font-family:monospace;font-size:0.78rem;max-height:200px;overflow-y:auto">
      ${lines.map((l,i) => `<div style="padding:1px 0;color:${_zzGrupo(l)?'#1a6':'#333'}">${i+1}: ${l.replace(/</g,'&lt;')}</div>`).join('')}
    </div>
    <p style="font-size:0.78rem;color:#888;margin-top:6px">Verde = cabeçalho de posição detectado.</p>`;
};

window.guardarSenioresImport = function() {
  const text     = document.getElementById('senioresImportTA').value.trim();
  const dupMode  = document.getElementById('senioresDupMode').value;
  if (!text) return;

  const players = _parseSenioresZZ(text);
  if (!players.length) { showToast('Nenhum jogador reconhecido.', 'red'); return; }

  if (!DB.seniores) DB.seniores = [];
  let added = 0, skipped = 0, replaced = 0;

  for (const p of players) {
    const idx = DB.seniores.findIndex(j => j.nome.toLowerCase() === p.nome.toLowerCase());
    if (idx > -1) {
      if (dupMode === 'replace') {
        DB.seniores[idx] = { ...DB.seniores[idx], ...p, id: DB.seniores[idx].id, ativo: DB.seniores[idx].ativo };
        replaced++;
      } else skipped++;
    } else {
      DB.seniores.push({ id: 'zz_' + Date.now() + Math.random(), ativo: true, ...p });
      added++;
    }
  }

  saveDB(); renderSeniores(); fecharSenioresImport();
  const msg = [added?`${added} importados`:'', replaced?`${replaced} atualizados`:'', skipped?`${skipped} ignorados`:''].filter(Boolean).join(', ');
  showToast(msg + '.', 'green');
};

// ==================================================
// FUTEBOL FORMAÇÃO — escalões Sub-9 a Sub-19
// ==================================================

let _formacaoEscalao = '';

function _formacaoNomes() {
  const nomes = DB.escaloes.map(e => e.nome)
    .sort((a,b) => (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0));
  return nomes.length ? nomes : ['Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19'];
}

function initFormacao() {
  // Ensure current escalão is valid
  const nomes = _formacaoNomes();
  if (!_formacaoEscalao || !nomes.includes(_formacaoEscalao)) _formacaoEscalao = nomes[0];

  // Render tabs if not yet rendered
  const tabsEl = document.getElementById('formacaoTabs');
  if (tabsEl && !tabsEl.dataset.ready) {
    tabsEl.dataset.ready = '1';
    tabsEl.innerHTML = nomes.map(e =>
      `<button class="tab-filter${e === _formacaoEscalao ? ' active' : ''}" data-ef="${e}">${e}</button>`
    ).join('');
    tabsEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-ef]');
      if (!btn) return;
      tabsEl.querySelectorAll('.tab-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _formacaoEscalao = btn.dataset.ef;
      _renderFormacao();
    });
  }

  // Bind buttons (guard against duplicate listeners)
  const btnNovo = document.getElementById('btnFormacaoNovoAtleta');
  if (btnNovo && !btnNovo._bf) {
    btnNovo._bf = true;
    btnNovo.addEventListener('click', () => editFormacaoAtleta(null));
  }
  const btnImp = document.getElementById('btnFormacaoImportar');
  if (btnImp && !btnImp._bf) {
    btnImp._bf = true;
    btnImp.addEventListener('click', () => {
      document.getElementById('formacaoImportTitle').textContent = `Importar Plantel — ${_formacaoEscalao}`;
      document.getElementById('formacaoImportModal').style.display = 'flex';
      // If bookmarklet already sent data before modal was open, fill now
      if (window._zzBookmarkletData) {
        document.getElementById('formacaoImportTA').value = window._zzBookmarkletData;
        window._zzBookmarkletData = null;
        previewFormacaoImport();
      }
    });
  }
  const btnDel = document.getElementById('btnFormacaoApagarTodos');
  if (btnDel && !btnDel._bf) {
    btnDel._bf = true;
    btnDel.addEventListener('click', () => {
      const total = (DB.atletas || []).filter(a => a.escalao === _formacaoEscalao).length;
      if (!total) { showToast(`Não há atletas no ${_formacaoEscalao}.`, ''); return; }
      if (!confirm(`Apagar TODOS os ${total} atletas do ${_formacaoEscalao}?\n\nEsta ação não pode ser desfeita.`)) return;
      DB.atletas = (DB.atletas || []).filter(a => a.escalao !== _formacaoEscalao);
      saveDB(); _renderFormacaoTable(); updateBadges();
      showToast(`${total} atletas do ${_formacaoEscalao} removidos.`, 'red');
    });
  }
  const btnComp = document.getElementById('btnCompletarDatas');
  if (btnComp && !btnComp._bf) {
    btnComp._bf = true;
    btnComp.addEventListener('click', () => abrirCompletarDatas());
  }

  _renderFormacao();
}

// ---- Formação ZeroZero/FPF Import ----
let _formacaoImportHTMLDoc = null;

document.getElementById('formacaoImportTA')?.addEventListener('paste', function(e) {
  const html = e.clipboardData?.getData('text/html');
  if (!html) return;
  try {
    _formacaoImportHTMLDoc = new DOMParser().parseFromString(html, 'text/html');
    const enriched = _docToText(_formacaoImportHTMLDoc);
    if (enriched.trim().length > 50) {
      e.preventDefault();
      document.getElementById('formacaoImportTA').value = enriched;
    }
  } catch(_) {}
});

window.fecharFormacaoImport = function() {
  document.getElementById('formacaoImportModal').style.display = 'none';
  document.getElementById('formacaoImportTA').value = '';
  document.getElementById('formacaoImportPreview').innerHTML = '';
  _formacaoImportHTMLDoc = null;
};

function _formacaoImgForName(nome) {
  // Try ZeroZero first, then FPF
  return _imgForNameInDoc(nome, _formacaoImportHTMLDoc, 'https://www.zerozero.pt')
      || _imgForNameInDoc(nome, _formacaoImportHTMLDoc, 'https://www.fpf.pt');
}

function _parsedFormacaoPlayers() {
  const text = document.getElementById('formacaoImportTA').value.trim();
  if (!text) return [];
  // Temporarily swap the HTML doc so _fpfImgForName/_parseZeroZero uses ours
  const savedPlantel = _plantelHTMLDoc;
  _plantelHTMLDoc = _formacaoImportHTMLDoc;
  const players = parsePastedAtletas(text);
  _plantelHTMLDoc = savedPlantel;
  return players;
}

window.previewFormacaoImport = function() {
  const prev = document.getElementById('formacaoImportPreview');
  const players = _parsedFormacaoPlayers();
  if (!players.length) {
    prev.innerHTML = '<p style="color:#c00;font-size:0.85rem">Nenhum jogador reconhecido. Usa o botão Diagnóstico para ver o que foi detetado.</p>';
    return;
  }
  const existNames = (DB.atletas || []).filter(a => a.escalao === _formacaoEscalao).map(a => a.nome.toLowerCase());
  const novos = players.filter(p => !existNames.includes(p.nome.toLowerCase())).length;
  const dups = players.length - novos;
  const comFoto = players.filter(p => p.foto).length;
  prev.innerHTML = `
    <div style="font-size:0.82rem;color:#555;margin-bottom:8px">
      <strong>${players.length}</strong> jogadores · <span style="color:#16a34a">${novos} novos</span>
      ${dups ? `· <span style="color:#d97706">${dups} duplicados</span>` : ''}
      ${comFoto ? `· <span style="color:#2563eb">${comFoto} com foto</span>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem">
      <thead><tr style="background:#f0f4ff">
        <th style="padding:6px 8px;width:40px"></th>
        <th style="padding:6px 10px;text-align:left">#</th>
        <th style="padding:6px 10px;text-align:left">Nome</th>
        <th style="padding:6px 10px;text-align:left">Posição</th>
        <th style="padding:6px 10px;text-align:left">Dt. Nasc.</th>
        <th style="padding:6px 10px;text-align:left"></th>
      </tr></thead>
      <tbody>${players.map(p => {
        const dup = existNames.includes(p.nome.toLowerCase());
        const avatar = p.foto
          ? `<img src="${p.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'">`
          : `<div style="width:32px;height:32px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700">${p.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>`;
        return `<tr style="border-bottom:1px solid #eee${dup?';opacity:0.55':''}">
          <td style="padding:4px 8px">${avatar}</td>
          <td style="padding:4px 10px;color:#888">${p.numero||'—'}</td>
          <td style="padding:4px 10px;font-weight:600">${p.nome}</td>
          <td style="padding:4px 10px">${p.posicao||'—'}</td>
          <td style="padding:4px 10px;color:#888;font-size:0.8rem">${p.dataNascimento||'—'}</td>
          <td style="padding:4px 10px">${dup?'<span style="color:#d97706;font-size:0.75rem">duplicado</span>':'<span style="color:#16a34a;font-size:0.75rem">novo</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
};

window.diagFormacaoImport = function() {
  const text = document.getElementById('formacaoImportTA').value;
  const prev = document.getElementById('formacaoImportPreview');
  if (!text.trim()) { prev.innerHTML = '<p style="color:#c00;font-size:0.85rem">Textarea vazia.</p>'; return; }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 40);
  const hasCard = lines.some(l => /^data de nascimento/i.test(l));
  const hasZZ   = !hasCard && lines.some(l => _zzGrupo(l) !== null);
  const modo    = hasCard ? 'FPF — Cartões' : hasZZ ? 'ZeroZero — Grupos por posição' : 'Tabela genérica';
  prev.innerHTML = `
    <div style="font-size:0.8rem;color:#555;margin-bottom:6px">Modo: <strong>${modo}</strong> · ${text.split('\n').filter(l=>l.trim()).length} linhas</div>
    <div style="font-size:0.75rem;color:#888;margin-bottom:4px">
      <span style="color:#1a6;font-weight:700">■</span> grupo/data
      <span style="color:#2563eb;font-weight:700;margin-left:8px">■</span> data detetada
      <span style="color:#888;margin-left:8px">■</span> outra linha
    </div>
    <div style="background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:10px;font-family:monospace;font-size:0.78rem;max-height:260px;overflow-y:auto">
      ${lines.map((l,i) => {
        const isGrp  = /^data de nascimento/i.test(l) || _zzGrupo(l);
        const isDate = !isGrp && !!_extractDate(l);
        const color  = isGrp ? '#1a6' : isDate ? '#2563eb' : '#333';
        const tag    = isGrp ? ' [GRUPO]' : isDate ? ` [DATA: ${_extractDate(l)}]` : '';
        return `<div style="padding:1px 0;color:${color}">${i+1}: ${l.replace(/</g,'&lt;')}${tag}</div>`;
      }).join('')}
    </div>`;
};

window.guardarFormacaoImport = function() {
  const dupMode = document.getElementById('formacaoDupMode').value;
  const players = _parsedFormacaoPlayers();
  if (!players.length) { showToast('Nenhum jogador reconhecido.', 'red'); return; }

  if (!DB.atletas) DB.atletas = [];
  let added = 0, skipped = 0, replaced = 0;

  for (const p of players) {
    const idx = DB.atletas.findIndex(a => a.nome.toLowerCase() === p.nome.toLowerCase() && a.escalao === _formacaoEscalao);
    if (idx > -1) {
      if (dupMode === 'replace') {
        DB.atletas[idx] = { ...DB.atletas[idx], posicao: p.posicao || DB.atletas[idx].posicao,
          numero: p.numero || DB.atletas[idx].numero,
          dataNascimento: p.dataNascimento || DB.atletas[idx].dataNascimento,
          foto: p.foto || DB.atletas[idx].foto };
        replaced++;
      } else skipped++;
    } else {
      DB.atletas.push({ id: Date.now() + Math.random(), nome: p.nome, escalao: _formacaoEscalao,
        posicao: p.posicao || '', numero: p.numero || '', dataNascimento: p.dataNascimento || '',
        foto: p.foto || '', encarregado: '—', telefone: '', estado: 'Activo' });
      added++;
    }
  }
  saveDB(); _renderFormacaoTable(); updateBadges(); fecharFormacaoImport();
  const msg = [added?`${added} importados`:'', replaced?`${replaced} atualizados`:'', skipped?`${skipped} ignorados`:''].filter(Boolean).join(', ');
  showToast(msg + '.', 'green');
};

// ---- COMPLETAR DATAS (FPF cross-reference) ----

// Normalise a name for fuzzy matching: lowercase, remove accents, strip non-alpha
function _normName(n) {
  return (n || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Score how well two names match (0=no match, 1=exact, 0.5=partial)
function _nameScore(a, b) {
  const na = _normName(a), nb = _normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = na.split(' '), wb = nb.split(' ');
  // Count shared words (min 4 chars to avoid matching "de", "da", etc.)
  const shared = wa.filter(w => w.length >= 4 && wb.includes(w)).length;
  if (shared >= 2) return 0.9;
  if (shared === 1) return 0.6;
  // One name fully contained in the other
  if (na.includes(nb) || nb.includes(na)) return 0.7;
  return 0;
}

// Parse FPF "Jogadores Inscritos" table or any source with name + birth date
function _parseFPFDatas(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = []; // [{nome, dataNascimento}]

  // Check for FPF card format ("Data de nascimento:" lines)
  const hasCard = lines.some(l => /^data de nascimento/i.test(l));
  if (hasCard) {
    let lastName = '';
    const isJunk = s => /^(filtrar|escalão|clube|fpf|federação|menu|pesquisar|ver mais|login|logout)/i.test(s) || s.length < 3;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^data de nascimento/i.test(line)) {
        const inline = line.match(/data de nascimento[:\s]+(.+)/i);
        let d = inline ? _extractDate(inline[1]) : '';
        if (!d && i + 1 < lines.length) { d = _extractDate(lines[i + 1]); if (d) i++; }
        if (lastName && d) result.push({ nome: lastName, dataNascimento: d });
        lastName = '';
      } else if (!isJunk(line) && !/^\d+$/.test(line)) {
        lastName = line;
      }
    }
    return result;
  }

  // Tab-separated table: detect header row containing "nasc" or "nascimento"
  let dateCol = -1, nameCol = 1;
  for (const line of lines) {
    if (/nasc|nascimento/i.test(line)) {
      const cols = line.split(/\t/).map((c, i) => ({ v: c.toLowerCase().trim(), i }));
      const dc = cols.find(c => /nasc/i.test(c.v));
      const nc = cols.find(c => /nome|jogador/i.test(c.v));
      if (dc) dateCol = dc.i;
      if (nc) nameCol = nc.i;
      break;
    }
  }

  for (const line of lines) {
    if (/nasc|nascimento|^n[rº°]?\.?\t|^nr\b/i.test(line)) continue; // skip header
    const parts = line.split(/\t/).map(p => p.trim());
    if (parts.length < 2) continue;
    // Try to find date in any column if dateCol not detected
    let dataNascimento = dateCol >= 0 ? _extractDate(parts[dateCol] || '') : '';
    if (!dataNascimento) {
      for (const p of parts) { dataNascimento = _extractDate(p); if (dataNascimento) break; }
    }
    const nome = parts[nameCol] || parts[0] || '';
    if (nome && nome.length > 2 && !/^\d+$/.test(nome) && dataNascimento) {
      result.push({ nome: nome.replace(/\s+/g, ' ').trim(), dataNascimento });
    }
  }
  return result;
}

let _completarDatasMatches = []; // [{atleta, fpfEntry, score}]

function abrirCompletarDatas() {
  document.getElementById('completarDatasEscalao').textContent = `— ${_formacaoEscalao}`;
  document.getElementById('completarDatasTA').value = '';
  document.getElementById('completarDatasPreview').innerHTML = '';
  document.getElementById('btnGuardarDatas').disabled = true;
  _completarDatasMatches = [];
  document.getElementById('completarDatasModal').style.display = 'flex';
}

window.fecharCompletarDatas = function() {
  document.getElementById('completarDatasModal').style.display = 'none';
};

window.previewCompletarDatas = function() {
  const text = document.getElementById('completarDatasTA').value.trim();
  const prev = document.getElementById('completarDatasPreview');
  if (!text) { prev.innerHTML = ''; return; }

  const fpfList = _parseFPFDatas(text);
  if (!fpfList.length) {
    prev.innerHTML = '<p style="color:#c00;font-size:0.85rem">Nenhum jogador com data reconhecido. Copia a tabela inteira da FPF (incluindo cabeçalho).</p>';
    document.getElementById('btnGuardarDatas').disabled = true;
    return;
  }

  const athletes = (DB.atletas || []).filter(a => a.escalao === _formacaoEscalao);
  _completarDatasMatches = [];

  for (const fpf of fpfList) {
    let best = null, bestScore = 0;
    for (const a of athletes) {
      const score = _nameScore(a.nome, fpf.nome);
      if (score > bestScore && score >= 0.6) { best = a; bestScore = score; }
    }
    _completarDatasMatches.push({ fpf, atleta: best, score: bestScore });
  }

  const matched  = _completarDatasMatches.filter(m => m.atleta && !m.atleta.dataNascimento);
  const updated  = _completarDatasMatches.filter(m => m.atleta && m.atleta.dataNascimento && m.atleta.dataNascimento !== m.fpf.dataNascimento);
  const noMatch  = _completarDatasMatches.filter(m => !m.atleta);
  const already  = _completarDatasMatches.filter(m => m.atleta && m.atleta.dataNascimento === m.fpf.dataNascimento);

  document.getElementById('btnGuardarDatas').disabled = (matched.length + updated.length) === 0;

  prev.innerHTML = `
    <div style="font-size:0.82rem;color:#555;margin-bottom:10px">
      <span style="color:#16a34a;font-weight:600">${matched.length} datas novas</span>
      ${updated.length ? `· <span style="color:#d97706;font-weight:600">${updated.length} a atualizar</span>` : ''}
      ${already.length ? `· <span style="color:#888">${already.length} já tinham data</span>` : ''}
      ${noMatch.length ? `· <span style="color:#c00">${noMatch.length} sem correspondência</span>` : ''}
      · ${fpfList.length} jogadores na FPF
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.81rem">
      <thead><tr style="background:#f5f3ff">
        <th style="padding:6px 10px;text-align:left">Nome FPF</th>
        <th style="padding:6px 10px;text-align:left">Data nasc.</th>
        <th style="padding:6px 10px;text-align:left">Atleta encontrado</th>
        <th style="padding:6px 10px;text-align:left">Estado</th>
      </tr></thead>
      <tbody>${_completarDatasMatches.map(m => {
        let status, statusColor;
        if (!m.atleta) { status = 'Sem correspondência'; statusColor = '#c00'; }
        else if (!m.atleta.dataNascimento) { status = '+ Nova data'; statusColor = '#16a34a'; }
        else if (m.atleta.dataNascimento === m.fpf.dataNascimento) { status = 'Igual'; statusColor = '#888'; }
        else { status = `Atualizar (era ${m.atleta.dataNascimento})`; statusColor = '#d97706'; }
        return `<tr style="border-bottom:1px solid #eee">
          <td style="padding:5px 10px">${m.fpf.nome}</td>
          <td style="padding:5px 10px;color:#7c3aed;font-weight:600">${m.fpf.dataNascimento}</td>
          <td style="padding:5px 10px;color:#555">${m.atleta ? m.atleta.nome : '—'}</td>
          <td style="padding:5px 10px;color:${statusColor};font-size:0.78rem;font-weight:600">${status}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
};

window.guardarCompletarDatas = function() {
  let count = 0;
  for (const m of _completarDatasMatches) {
    if (!m.atleta) continue;
    const idx = DB.atletas.findIndex(a => a.id === m.atleta.id);
    if (idx > -1 && m.fpf.dataNascimento) {
      DB.atletas[idx].dataNascimento = m.fpf.dataNascimento;
      count++;
    }
  }
  saveDB(); _renderFormacaoTable(); fecharCompletarDatas();
  showToast(`${count} datas de nascimento actualizadas.`, 'green');
};

function _renderFormacao() {
  document.getElementById('formacaoTitle').textContent = `Futebol Formação — ${_formacaoEscalao}`;
  _renderFormacaoInfo();
  _renderFormacaoTable();
}

function _renderFormacaoInfo() {
  const e = (DB.escaloes || []).find(e => e.nome === _formacaoEscalao) || {};
  const card = document.getElementById('formacaoInfoCard');
  if (!card) return;
  card.innerHTML = `
    <div class="card">
      <h2 class="card__title" style="margin-bottom:16px">ℹ️ Informações da Equipa</h2>
      <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px">
        <div class="form-group">
          <label class="form-label">Designação</label>
          <input class="form-control" id="fmInfoDesig" value="${e.designacao || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Faixa Etária</label>
          <input class="form-control" id="fmInfoFaixa" value="${e.faixa || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Treinador Principal</label>
          <input class="form-control" id="fmInfoTreinador" value="${e.treinador || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Horários de Treino</label>
          <input class="form-control" id="fmInfoTreinos" value="${e.treinos || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Competição / Liga</label>
          <input class="form-control" id="fmInfoComp" value="${e.competicao || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Local de Treino</label>
          <input class="form-control" id="fmInfoLocal" value="${e.local || ''}">
        </div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">Descrição</label>
        <textarea class="form-control" id="fmInfoDesc" rows="2">${e.descricao || ''}</textarea>
      </div>
      <button class="btn-save" id="btnGuardarInfoFormacao" style="margin-top:12px">💾 Guardar Informações</button>
    </div>`;
  document.getElementById('btnGuardarInfoFormacao').addEventListener('click', _guardarInfoFormacao);
}

function _guardarInfoFormacao() {
  const e = (DB.escaloes || []).find(e => e.nome === _formacaoEscalao);
  if (!e) return;
  e.designacao = document.getElementById('fmInfoDesig')?.value.trim() || e.designacao;
  e.faixa      = document.getElementById('fmInfoFaixa')?.value.trim()    || e.faixa;
  e.treinador  = document.getElementById('fmInfoTreinador')?.value.trim() || '';
  e.treinos    = document.getElementById('fmInfoTreinos')?.value.trim()   || '';
  e.competicao = document.getElementById('fmInfoComp')?.value.trim()     || '';
  e.local      = document.getElementById('fmInfoLocal')?.value.trim()    || '';
  e.descricao  = document.getElementById('fmInfoDesc')?.value.trim()     || '';
  saveDB();
  const btn = document.getElementById('btnGuardarInfoFormacao');
  if (btn) { btn.textContent = '✓ Guardado!'; setTimeout(() => { btn.innerHTML = '💾 Guardar Informações'; }, 2000); }
}

function _renderFormacaoTable() {
  const tbody = document.querySelector('#formacaoTable tbody');
  if (!tbody) return;
  const atletas = (DB.atletas || []).filter(a => a.escalao === _formacaoEscalao);
  if (!atletas.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px">Nenhum atleta registado para este escalão</td></tr>';
    return;
  }
  const sorted = [...atletas].sort((a, b) => {
    const ap = a.posicao || 'z', bp = b.posicao || 'z';
    return ap < bp ? -1 : ap > bp ? 1 : a.nome.localeCompare(b.nome);
  });
  const hoje = new Date();
  tbody.innerHTML = sorted.map(a => {
    const nasc = a.dataNascimento ? new Date(a.dataNascimento + 'T00:00:00') : null;
    const isAniv = nasc && nasc.getDate() === hoje.getDate() && nasc.getMonth() === hoje.getMonth();
    const avatar = a.foto
      ? `<img src="${a.foto}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700">${a.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>`;
    const dateFmt = a.dataNascimento ? new Date(a.dataNascimento+'T00:00:00').toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `<tr${isAniv?' style="background:#fffbeb"':''}>
      <td style="padding:6px 8px">${avatar}</td>
      <td><strong>${a.numero || '—'}</strong></td>
      <td>${a.nome}${isAniv?' 🎂':''}</td>
      <td>${a.posicao || '—'}</td>
      <td style="font-size:0.82rem;color:#666">${dateFmt}</td>
      <td>${a.estado === 'Activo' ? '<span class="badge badge--success">Activo</span>' : '<span class="badge badge--danger">Inactivo</span>'}</td>
      <td>
        <div class="btn-actions">
          <button class="btn-icon" onclick="editFormacaoAtleta('${a.id}')">✏️</button>
          <button class="btn-icon btn-icon--red" onclick="deleteFormacaoAtleta('${a.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.editFormacaoAtleta = function(id) {
  const existing = id ? (DB.atletas || []).find(a => String(a.id) === String(id)) : null;
  const a = existing || {
    id: 'fa_' + Date.now(),
    nome: '', numero: '', escalao: _formacaoEscalao,
    posicao: '', dataNascimento: '', encarregado: '', telefone: '',
    foto: '', estado: 'Activo'
  };

  const posicoes = ['Guarda-redes','Defesa Direito','Defesa Esquerdo','Central','Médio Defensivo','Médio','Extremo','Avançado'];

  openModal(id ? `Editar — ${a.nome}` : `Novo Atleta — ${_formacaoEscalao}`, `
    <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:16px">
      <div class="form-group">
        <label class="form-label">Nome *</label>
        <input class="form-control" id="fmANome" value="${a.nome}">
      </div>
      <div class="form-group">
        <label class="form-label">Nº Camisola</label>
        <input class="form-control" id="fmANumero" type="number" min="1" max="99" value="${a.numero || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Posição</label>
        <select class="form-control" id="fmAPosicao">
          <option value="">—</option>
          ${posicoes.map(p => `<option${p===a.posicao?' selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data de Nascimento</label>
        <input class="form-control" id="fmADataNasc" type="date" value="${a.dataNascimento || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Encarregado</label>
        <input class="form-control" id="fmAEnc" value="${a.encarregado || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-control" id="fmAEstado">
          <option${a.estado==='Activo'?' selected':''}>Activo</option>
          <option${a.estado==='Inactivo'?' selected':''}>Inactivo</option>
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-top:12px">
      <label class="form-label">Foto (URL ou upload)</label>
      <div style="display:flex;gap:12px;align-items:center">
        <input class="form-control" id="fmAFotoUrl" placeholder="https://... ou colar da FPF" value="${a.foto||''}" style="flex:1">
        <label class="btn-icon" style="cursor:pointer;padding:8px 12px;background:#f0f0f0;border-radius:8px" title="Carregar ficheiro">
          📷 <input type="file" accept="image/*" id="fmAFotoFile" style="display:none">
        </label>
      </div>
      <div id="fmAFotoPreview" style="margin-top:10px;${a.foto?'':'display:none'}">
        <img id="fmAFotoImg" src="${a.foto||''}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #e0e0e0">
      </div>
    </div>`,
    `<button class="btn-save" onclick="saveFormacaoAtleta('${a.id}','${id||''}')">💾 Guardar</button>
     <button class="btn-cancel" onclick="closeModal()">Cancelar</button>`
  );

  document.getElementById('fmAFotoUrl').addEventListener('input', function() {
    const prev = document.getElementById('fmAFotoPreview');
    const img  = document.getElementById('fmAFotoImg');
    if (this.value) { img.src = this.value; prev.style.display = ''; }
    else prev.style.display = 'none';
  });

  document.getElementById('fmAFotoFile').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    compressImage(file, b64 => {
      document.getElementById('fmAFotoUrl').value = b64;
      document.getElementById('fmAFotoImg').src   = b64;
      document.getElementById('fmAFotoPreview').style.display = '';
    });
  });
};

window.saveFormacaoAtleta = function(id, originalId) {
  const nome = document.getElementById('fmANome')?.value.trim();
  if (!nome) { alert('O nome é obrigatório.'); return; }

  const atleta = {
    id: originalId || id,
    nome,
    numero:         parseInt(document.getElementById('fmANumero')?.value) || '',
    escalao:        _formacaoEscalao,
    posicao:        document.getElementById('fmAPosicao')?.value || '',
    dataNascimento: document.getElementById('fmADataNasc')?.value || '',
    encarregado:    document.getElementById('fmAEnc')?.value.trim() || '—',
    telefone:       '',
    foto:           document.getElementById('fmAFotoUrl')?.value.trim() || '',
    estado:         document.getElementById('fmAEstado')?.value || 'Activo',
  };

  if (!DB.atletas) DB.atletas = [];
  const idx = DB.atletas.findIndex(a => String(a.id) === String(atleta.id));
  if (idx >= 0) DB.atletas[idx] = atleta;
  else DB.atletas.push(atleta);

  saveDB();
  closeModal();
  _renderFormacaoTable();
  updateBadges();
};

window.deleteFormacaoAtleta = function(id) {
  if (!confirm('Eliminar este atleta do plantel?')) return;
  DB.atletas = (DB.atletas || []).filter(a => String(a.id) !== String(id));
  saveDB();
  _renderFormacaoTable();
  updateBadges();
};

// =============================================
// EMOJI PICKER — componente reutilizável
// =============================================
(function() {
  const CATS = [
    {
      label: '⚽ Desporto',
      emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥅','⛳','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷','🏂','🪂','🏋','🤼','🤸','⛹','🤺','🤾','🏌','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🎗']
    },
    {
      label: '🏃 Atividade',
      emojis: ['🏃','🚶','🧍','🧎','🧗','🏇','🤸','🏋','🤼','🤺','🤾','⛹','🏌','🏊','🚴','🛹','🛼','🤼','🧘','💃','🕺','🚵','🪄','🎯','🎳','🎮','🕹','🎲','🎰','🎭','🎨','🖼','🎬','🎤']
    },
    {
      label: '🌟 Geral',
      emojis: ['⭐','🌟','💫','✨','🔥','💥','🎉','🎊','🏟','🌍','🌎','🌏','🌈','☀','🌙','⚡','🌊','🍀','🌸','🏔','🦁','🐯','🦅','🦋','💪','🫶','👊','✌','🤝','👏','🙌','❤','🧡','💛','💙','💚','💜','🖤','🤍']
    },
    {
      label: '👥 Pessoas',
      emojis: ['👤','👥','🧑','👨','👩','🧒','👦','👧','🧑‍🤝‍🧑','👫','👬','👭','🫂','🤜','🤛','👋','🤚','✋','🖐','👐','🙏','🤲','💪','🦾','👀','🧠','🦷','🦴','👅','👂','👃']
    },
    {
      label: '📦 Objetos',
      emojis: ['🎽','👟','🥿','👠','🧢','🎒','🏋','🎸','🎺','🎻','🥁','🎙','📢','📣','📡','🔭','🔬','🧪','🧫','💊','🩺','🩹','🌡','🧲','⚙','🔧','🔨','🪓','🛠','🗡','⚔','🛡','🪃','🪁','🎪','🎠']
    },
  ];

  let _anchorId = null;
  let _inputId  = null;

  function buildPicker() {
    const el = document.createElement('div');
    el.className = 'emoji-picker';
    el.id = 'emojiPickerPopup';
    el.innerHTML = `
      <div class="emoji-picker__search-wrap">
        <input class="emoji-picker__search" id="emojiSearch" placeholder="🔍 Pesquisar emoji..." autocomplete="off" />
      </div>
      <div class="emoji-picker__tabs" id="emojiTabs">
        ${CATS.map((c,i) => `<button class="emoji-picker__tab${i===0?' active':''}" data-cat="${i}">${c.label.split(' ')[0]}</button>`).join('')}
      </div>
      <div class="emoji-picker__grid" id="emojiGrid"></div>`;
    return el;
  }

  function renderGrid(emojis) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;
    grid.innerHTML = emojis.map(e =>
      `<button type="button" class="emoji-picker__emoji" title="${e}">${e}</button>`
    ).join('');
    grid.querySelectorAll('.emoji-picker__emoji').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(_inputId);
        const anchor = document.getElementById(_anchorId);
        if (input)  { input.value = btn.textContent; input.dispatchEvent(new Event('input')); }
        if (anchor) anchor.textContent = btn.textContent;
        closeEmojiPicker();
      });
    });
  }

  function openPicker(inputId, anchorId, rootId) {
    _inputId  = inputId;
    _anchorId = anchorId;

    let existing = document.getElementById('emojiPickerPopup');
    if (existing) existing.remove();

    const root = document.getElementById(rootId || 'emojiPickerRoot');
    if (!root) return;

    const picker = buildPicker();
    root.appendChild(picker);

    let activeCat = 0;
    renderGrid(CATS[0].emojis);

    picker.querySelector('#emojiTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-picker__tab');
      if (!btn) return;
      picker.querySelectorAll('.emoji-picker__tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = +btn.dataset.cat;
      document.getElementById('emojiSearch').value = '';
      renderGrid(CATS[activeCat].emojis);
    });

    picker.querySelector('#emojiSearch').addEventListener('input', function() {
      const q = this.value.trim().toLowerCase();
      if (!q) { renderGrid(CATS[activeCat].emojis); return; }
      const all = CATS.flatMap(c => c.emojis);
      // basic filter — shows all; proper search needs a names DB, so just show all
      renderGrid(all);
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', _outsideClick);
    }, 10);
  }

  function _outsideClick(e) {
    const popup = document.getElementById('emojiPickerPopup');
    if (popup && !popup.contains(e.target) && e.target.id !== _anchorId) {
      closeEmojiPicker();
    }
  }

  function closeEmojiPicker() {
    const popup = document.getElementById('emojiPickerPopup');
    if (popup) popup.remove();
    document.removeEventListener('click', _outsideClick);
  }

  window.toggleEmojiPicker = function(inputId, anchorId, rootId) {
    const existing = document.getElementById('emojiPickerPopup');
    if (existing) { closeEmojiPicker(); return; }
    openPicker(inputId, anchorId, rootId);
  };

  window.closeEmojiPicker = closeEmojiPicker;
})();

// =============================================
// HISTÓRIA DO CLUBE — admin CRUD
// =============================================
const HISTORIA_KEY  = 'db_historia';
const PALMARES_KEY  = 'db_palmares';

function loadHistoria()  { try { return JSON.parse(localStorage.getItem(HISTORIA_KEY)  || '[]'); } catch(e) { return []; } }
function saveHistoria(a) { localStorage.setItem(HISTORIA_KEY,  JSON.stringify(a)); }
function loadPalmares()  { try { return JSON.parse(localStorage.getItem(PALMARES_KEY)  || '[]'); } catch(e) { return []; } }
function savePalmares(a) { localStorage.setItem(PALMARES_KEY,  JSON.stringify(a)); }

function initHistoria() {
  renderHistoriaList();
  renderPalmaresList();
}

function renderHistoriaList() {
  const el = document.getElementById('historiaAdminList');
  if (!el) return;
  const lista = loadHistoria().sort((a, b) => (a.ano || 0) - (b.ano || 0));
  if (!lista.length) {
    el.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px 0">Sem entradas. Clique em "+ Nova entrada" para começar.</p>';
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#f4f6fb;font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:1px">
      <th style="padding:10px 12px;text-align:left">Ano</th>
      <th style="padding:10px 12px;text-align:left">Título</th>
      <th style="padding:10px 12px;text-align:center">Destaque</th>
      <th style="padding:10px 12px;text-align:right">Ações</th>
    </tr></thead>
    <tbody>
      ${lista.map(h => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px;font-weight:700;color:var(--blue);font-size:1.05rem">${h.ano}</td>
          <td style="padding:12px;font-size:0.9rem">${h.titulo}</td>
          <td style="padding:12px;text-align:center">${h.destaque ? '⭐' : '—'}</td>
          <td style="padding:12px;text-align:right;white-space:nowrap">
            <button class="btn-icon" onclick="editHistoria(${h.id})" title="Editar">&#9998;</button>
            <button class="btn-icon btn-icon--red" onclick="deleteHistoria(${h.id})" title="Eliminar">&#128465;</button>
          </td>
        </tr>`).join('')}
    </tbody></table>`;
}

function renderPalmaresList() {
  const el = document.getElementById('palmaresAdminList');
  if (!el) return;
  const lista = loadPalmares().sort((a, b) => (b.ano || 0) - (a.ano || 0));
  if (!lista.length) {
    el.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px 0">Sem títulos. Clique em "+ Novo título" para começar.</p>';
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#f4f6fb;font-size:0.8rem;color:#64748b;text-transform:uppercase;letter-spacing:1px">
      <th style="padding:10px 12px;text-align:left">Ano</th>
      <th style="padding:10px 12px;text-align:left">Competição</th>
      <th style="padding:10px 12px;text-align:left">Escalão</th>
      <th style="padding:10px 12px;text-align:right">Ações</th>
    </tr></thead>
    <tbody>
      ${lista.map(t => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px;font-weight:700;color:var(--blue)">${t.ano}</td>
          <td style="padding:12px;font-size:0.9rem">${t.competicao}${t.observacao ? ' <span style="color:#888;font-size:0.8rem">· ' + t.observacao + '</span>' : ''}</td>
          <td style="padding:12px"><span style="background:var(--yellow);color:var(--blue-dark);font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px">${t.escalao || '—'}</span></td>
          <td style="padding:12px;text-align:right;white-space:nowrap">
            <button class="btn-icon" onclick="editPalmares(${t.id})" title="Editar">&#9998;</button>
            <button class="btn-icon btn-icon--red" onclick="deletePalmares(${t.id})" title="Eliminar">&#128465;</button>
          </td>
        </tr>`).join('')}
    </tbody></table>`;
}

window.abrirModalHistoria = function(h) {
  const isNew = !h;
  openModal(isNew ? 'Nova Entrada na Linha do Tempo' : 'Editar Entrada', `
    <div class="modal-row">
      <div class="modal-field">
        <label>Ano *</label>
        <input type="number" class="form-input" id="hAno" value="${h?.ano || new Date().getFullYear()}" min="1900" max="2100" />
      </div>
      <div class="modal-field">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:26px">
          <input type="checkbox" id="hDestaque" ${h?.destaque ? 'checked' : ''} />
          Destaque (evento marcante)
        </label>
      </div>
    </div>
    <div class="modal-field">
      <label>Título *</label>
      <input type="text" class="form-input" id="hTitulo" value="${h?.titulo || ''}" placeholder="Ex: Fundação do Clube" />
    </div>
    <div class="modal-field">
      <label>Descrição</label>
      <textarea class="form-input" id="hDescricao" rows="4" placeholder="Conte o que aconteceu neste marco histórico...">${h?.descricao || ''}</textarea>
    </div>
    <div class="modal-field">
      <label>Imagem (URL)</label>
      <input type="url" class="form-input" id="hImagem" value="${h?.imagem || ''}" placeholder="https://..." />
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveHistoriaEntry(${isNew ? 'null' : h.id})">Guardar</button>`
  );
};

window.editHistoria = function(id) {
  const h = loadHistoria().find(x => x.id === id);
  if (h) abrirModalHistoria(h);
};

window.saveHistoriaEntry = function(id) {
  const titulo = document.getElementById('hTitulo')?.value.trim();
  const ano    = parseInt(document.getElementById('hAno')?.value) || 0;
  if (!titulo) { showToast('Introduza o título.', 'red'); return; }
  if (!ano)    { showToast('Introduza o ano.',    'red'); return; }

  const dados = {
    ano,
    titulo,
    descricao: document.getElementById('hDescricao')?.value.trim() || '',
    imagem:    document.getElementById('hImagem')?.value.trim()    || '',
    destaque:  document.getElementById('hDestaque')?.checked       || false,
  };

  const lista = loadHistoria();
  if (id === null) {
    lista.push({ id: Date.now(), ...dados });
  } else {
    const idx = lista.findIndex(x => x.id === id);
    if (idx > -1) lista[idx] = { ...lista[idx], ...dados };
  }
  saveHistoria(lista);
  showToast(id === null ? 'Entrada criada!' : 'Entrada actualizada!', 'green');
  closeModal();
  renderHistoriaList();
};

window.deleteHistoria = function(id) {
  if (!confirm('Eliminar esta entrada da linha do tempo?')) return;
  saveHistoria(loadHistoria().filter(x => x.id !== id));
  renderHistoriaList();
};

window.abrirModalPalmares = function(t) {
  const isNew = !t;
  const escaloes = ['Sub-7','Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19','Sub-21','Sénior','Futsal','Kickboxing','Judo','Geral'];
  openModal(isNew ? 'Novo Título / Conquista' : 'Editar Título', `
    <div class="modal-field">
      <label>Competição / Torneio *</label>
      <input type="text" class="form-input" id="pComp" value="${t?.competicao || ''}" placeholder="Ex: Campeonato Distrital AF Algarve" />
    </div>
    <div class="modal-row">
      <div class="modal-field">
        <label>Ano *</label>
        <input type="number" class="form-input" id="pAno" value="${t?.ano || new Date().getFullYear()}" min="1900" max="2100" />
      </div>
      <div class="modal-field">
        <label>Escalão</label>
        <select class="form-input" id="pEscalao">
          <option value="">— Geral —</option>
          ${escaloes.map(e => `<option${e === (t?.escalao || '') ? ' selected' : ''}>${e}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-field">
      <label>Observação (opcional)</label>
      <input type="text" class="form-input" id="pObs" value="${t?.observacao || ''}" placeholder="Ex: 1.º lugar, Campeão..." />
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="savePalmaresEntry(${isNew ? 'null' : t.id})">Guardar</button>`
  );
};

window.editPalmares = function(id) {
  const t = loadPalmares().find(x => x.id === id);
  if (t) abrirModalPalmares(t);
};

window.savePalmaresEntry = function(id) {
  const competicao = document.getElementById('pComp')?.value.trim();
  const ano        = parseInt(document.getElementById('pAno')?.value)  || 0;
  if (!competicao) { showToast('Introduza o nome da competição.', 'red'); return; }
  if (!ano)        { showToast('Introduza o ano.', 'red'); return; }

  const dados = {
    competicao,
    ano,
    escalao:    document.getElementById('pEscalao')?.value || '',
    observacao: document.getElementById('pObs')?.value.trim()    || '',
  };

  const lista = loadPalmares();
  if (id === null) {
    lista.push({ id: Date.now(), ...dados });
  } else {
    const idx = lista.findIndex(x => x.id === id);
    if (idx > -1) lista[idx] = { ...lista[idx], ...dados };
  }
  savePalmares(lista);
  showToast(id === null ? 'Título adicionado!' : 'Título actualizado!', 'green');
  closeModal();
  renderPalmaresList();
};

window.deletePalmares = function(id) {
  if (!confirm('Eliminar este título do palmarés?')) return;
  savePalmares(loadPalmares().filter(x => x.id !== id));
  renderPalmaresList();
};
