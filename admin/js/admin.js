// =============================================
// ADMIN PANEL — MAIN JS
// =============================================

// ---- AUTENTICAÇÃO ---- //
// A verificação acontece no servidor (api/auth.php). Antes corria toda
// aqui: as credenciais estavam no localStorage e a comparação era feita
// em JavaScript que o visitante controla, o que não é autenticação.
const loginForm    = document.getElementById('loginForm');
const loginError   = document.getElementById('loginError');
const loginWrap    = document.getElementById('loginWrap');
const adminLayout  = document.getElementById('adminLayout');
const togglePw     = document.getElementById('togglePw');
const loginPassEl  = document.getElementById('loginPass');
const loginUserEl  = document.getElementById('loginUser');
const loginBtn     = loginForm ? loginForm.querySelector('.btn-login') : null;
const loginTitulo  = document.querySelector('.login-sub');

const SESSION_MS   = 30 * 60 * 1000;  // 30 minutos de inactividade
let   sessionTimer = null;
let   primeiroArranque = false;
let   SESSAO = null;

async function apiAuth(acao, corpo) {
  const opcoes = {
    method: corpo ? 'POST' : 'GET',
    headers: { 'X-JSC-Painel': '1' },
    credentials: 'same-origin',
    // Nunca de uma cópia guardada: isto é o estado da sessão agora.
    cache: 'no-store',
  };
  if (corpo) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  // Caminho relativo ao painel, não à raiz do servidor. Com '/api/...' o
  // painel só funcionava se o site estivesse na raiz do endereço: aberto
  // pelo Live Server a partir da pasta-mãe, o pedido ia para
  // http://127.0.0.1:5500/api/auth.php — que não existe — e o painel
  // dizia que o servidor tinha respondido de forma inesperada.
  const r = await fetch('../api/auth.php?acao=' + encodeURIComponent(acao), opcoes);
  const texto = await r.text();
  let j = {};
  let phpNaoCorre = false;
  try {
    j = JSON.parse(texto);
  } catch (_) {
    // Um servidor que não execute PHP devolve o código-fonte como texto.
    // É esse o sinal, e é inequívoco.
    phpNaoCorre = /^\s*<\?php/.test(texto) || texto.indexOf('<?php') !== -1;
  }
  return { estado: r.status, phpNaoCorre, ...j };
}

// Endereços de desenvolvimento. O modo local só existe aqui: num servidor a
// sério, se o PHP falhar, o painel recusa em vez de abrir sem autenticação.
function ambienteDeDesenvolvimento() {
  if (location.protocol === 'file:') return true;
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === ''
      || /^192\.168\./.test(h) || /^10\./.test(h)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}

// MODO LOCAL — sem PHP
// O Live Server do VS Code serve ficheiros e não executa PHP. Como a
// autenticação e a publicação vivem em PHP, o painel deixava de abrir: foi
// isso que aconteceu ao passar o login para o servidor.
//
// Aqui o painel abre para trabalhar no conteúdo, que está todo no
// localStorage deste browser. Não há login porque não há servidor com quem o
// fazer — e também não há nada do servidor ao alcance: publicar, ler
// inscrições e gerir contas ficam indisponíveis até haver PHP.
let MODO_LOCAL = false;

function entrarEmModoLocal(motivo) {
  MODO_LOCAL = true;
  SESSAO = null;
  loginWrap.style.display = 'none';
  document.body.classList.remove('login-page');
  adminLayout.style.display = 'flex';

  const nome = document.getElementById('adminUserName');
  if (nome) nome.textContent = 'Modo local';
  const avatar = document.getElementById('adminUserAvatar');
  if (avatar) avatar.textContent = '\u{1F4BB}';

  const aviso = document.getElementById('avisoPerfil');
  if (aviso) {
    aviso.textContent = 'Modo local, sem PHP (' + motivo + '). Pode escrever e organizar '
      + 'conteúdo, que fica guardado neste browser. Não é possível entrar com conta, publicar, '
      + 'ler inscrições nem gerir contas — isso precisa de PHP a correr. Para ter o painel '
      + 'completo, pare o Live Server e corra o iniciar.bat (Windows) ou ./iniciar.sh na pasta '
      + 'do projeto; depois abra http://localhost:8000/admin/.';
    aviso.hidden = false;
  }

  // Em modo local todas as secções de conteúdo estão disponíveis; as que
  // dependem do servidor avisam quando forem usadas.
  document.querySelectorAll('.nav-item[data-page]').forEach(function (i) { i.hidden = false; });

  initAdmin();
}

function showLoginError(msg, persistente) {
  loginError.textContent = msg;
  loginError.style.display = 'block';
  if (!persistente) setTimeout(() => { loginError.style.display = 'none'; }, 6000);
}

function startSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(async () => {
    await apiAuth('sair', {}).catch(() => {});
    mostrarLogin();
    showLoginError('Sessão expirada por inactividade (30 min). Entre novamente.', true);
  }, SESSION_MS);
}

function resetSessionTimer() {
  if (adminLayout && adminLayout.style.display === 'flex') startSessionTimer();
}

function mostrarLogin() {
  clearTimeout(sessionTimer);
  SESSAO = null;
  adminLayout.style.display = 'none';
  document.body.classList.add('login-page');
  loginWrap.style.display = '';
  if (loginForm) loginForm.reset();
}

// Que capacidade é precisa para ver cada secção do menu. O servidor
// recusa à mesma quem tente lá chegar por outro caminho: isto é conforto,
// não é a proteção.
const AREA_DA_PAGINA = {
  dashboard:       null,            // aberto a quem tenha sessão
  inscricoes:     'inscricoes',
  mensagens:      'inscricoes',
  atletas:        'atletas',
  treinadores:    'treinadores',
  escaloes:       'equipas',
  formacao:       'equipas',
  seniores:       'equipas',
  jogos:          'jogos',
  agenda:         'agenda',
  noticias:       'noticias',
  galeria:        'galeria',
  videos:         'videos',
  patrocinadores: 'patrocinadores',
  modalidades:    'modalidades',
  historia:       'institucional',
  'pagina-inicial':'homepage',
  facebook:       'redes',
  configuracoes:  'configuracoes',
};

function aplicarPermissoesNaInterface(sessao) {
  const podem = (sessao && sessao.permissoes) || [];
  let visiveis = 0;
  document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
    const pagina = item.getAttribute('data-page');
    const area = AREA_DA_PAGINA[pagina];
    const pode = area === null || area === undefined || podem.indexOf(area) !== -1;
    item.hidden = !pode;
    if (pode && pagina !== 'dashboard') visiveis++;
  });

  // Quem só tem Matchday fica sem nenhuma secção: a área do dia de jogo
  // ainda não está construída. Mais vale dizê-lo do que mostrar um painel
  // vazio sem explicação.
  const aviso = document.getElementById('avisoPerfil');
  if (aviso) {
    if (!visiveis) {
      aviso.textContent = 'O perfil ' + (sessao.perfilNome || sessao.perfil) +
        ' ainda não tem nenhuma área disponível neste painel. A área de dia de jogo está prevista para uma fase seguinte.';
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }
  }
}

function entrarNoPainel(sessao) {
  SESSAO = sessao;
  aplicarPermissoesNaInterface(sessao);
  loginWrap.style.display = 'none';
  document.body.classList.remove('login-page');
  adminLayout.style.display = 'flex';
  startSessionTimer();
  const nome = document.getElementById('adminUserName');
  if (nome && sessao) nome.textContent = (sessao.nome || sessao.utilizador) + ' \u00b7 ' + (sessao.perfilNome || sessao.perfil);
  const avatar = document.getElementById('adminUserAvatar');
  if (avatar && sessao) avatar.textContent = (sessao.nome || sessao.utilizador).trim().charAt(0).toUpperCase();
  initAdmin();
}

// Primeiro arranque: em vez de uma palavra-passe por omissão, o painel
// pede que seja criada a conta de administrador.
function prepararPrimeiroArranque() {
  primeiroArranque = true;
  if (loginTitulo) loginTitulo.textContent = 'Criar conta de administrador';
  if (loginBtn) loginBtn.textContent = 'Criar conta';
  if (loginUserEl) loginUserEl.placeholder = 'escolha um nome de utilizador';
  if (loginPassEl) {
    loginPassEl.placeholder = 'mínimo 10 caracteres';
    loginPassEl.setAttribute('autocomplete', 'new-password');
  }
  showLoginError('Ainda não existe nenhuma conta. Crie a sua para proteger o painel.', true);
}

// A marca que impede o js/sync.js de sobrepor o armazém deste browser.
//
// O painel guarda o que está a ser escrito só no localStorage, e partilha-o com
// o site público. Desde que o /api/load.php entrega apenas a projeção pública,
// abrir uma página do site nesta aba sobreporia os rascunhos pela versão
// publicada — e o Publicar seguinte apagava-os também do servidor.
//
// Escreve-se no arranque, antes de qualquer autenticação: quem abre o /admin/
// está a usar este browser como painel, tenha ou não sessão.
try { localStorage.setItem('jsc_painel_local', '1'); } catch (_) {}

async function arrancarAutenticacao() {
  let r;
  try {
    r = await apiAuth('estado');
  } catch (_) {
    if (ambienteDeDesenvolvimento()) { entrarEmModoLocal('servidor não respondeu'); return; }
    mostrarLogin();
    showLoginError('Não foi possível falar com o servidor. O painel precisa de PHP para funcionar.', true);
    return;
  }
  if (r.phpNaoCorre) {
    if (ambienteDeDesenvolvimento()) { entrarEmModoLocal('o servidor não executa PHP'); return; }
    mostrarLogin();
    showLoginError('Este servidor não está a executar PHP. O painel precisa de PHP para autenticar '
      + 'e para publicar. Fale com o alojamento antes de continuar.', true);
    return;
  }
  if (r.estado === 404) {
    // A pasta api/ não está a ser servida a partir daqui. Em
    // desenvolvimento é o caso do Live Server: abre-se o painel para
    // trabalhar no conteúdo e diz-se como ter o resto.
    if (ambienteDeDesenvolvimento()) { entrarEmModoLocal('api/ não encontrada neste endereço'); return; }
    mostrarLogin();
    showLoginError('Não encontrei api/auth.php a partir deste endereço. Confirme que a pasta api/ '
      + 'foi enviada para o servidor, ao lado da pasta admin/.', true);
    return;
  }
  if (!r.ok) {
    mostrarLogin();
    showLoginError('O servidor respondeu de forma inesperada ao pedido de sessão (código '
      + r.estado + ').', true);
    return;
  }
  if (r.sessao) { entrarNoPainel(r.sessao); return; }
  mostrarLogin();
  if (r.primeiroArranque) prepararPrimeiroArranque();
}

['click','keydown','mousemove','scroll'].forEach(evt =>
  document.addEventListener(evt, resetSessionTimer, { passive: true })
);

togglePw?.addEventListener('click', () => {
  const aMostrar = loginPassEl.type === 'password';
  loginPassEl.type = aMostrar ? 'text' : 'password';
  // O botão é um olho: sem isto, quem usa leitor de ecrã ouvia "botão" e
  // mais nada, e não sabia se a palavra-passe estava à vista.
  togglePw.setAttribute('aria-label', aMostrar ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
  togglePw.setAttribute('aria-pressed', aMostrar ? 'true' : 'false');
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = loginUserEl.value.trim();
  const p = loginPassEl.value;
  if (!u || !p) { showLoginError('Indique utilizador e palavra-passe.'); return; }

  if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = primeiroArranque ? 'A criar…' : 'A entrar…'; }
  let r;
  try {
    r = primeiroArranque
      ? await apiAuth('criar-primeiro', { utilizador: u, password: p, nome: u })
      : await apiAuth('entrar', { utilizador: u, password: p });
  } catch (_) {
    r = { ok: false, error: 'Não foi possível falar com o servidor.' };
  }
  if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = primeiroArranque ? 'Criar conta' : 'Entrar'; }

  if (r.ok && r.sessao) {
    primeiroArranque = false;
    if (loginTitulo) loginTitulo.textContent = 'Painel Administrativo';
    if (loginBtn) loginBtn.textContent = 'Entrar';
    loginError.style.display = 'none';
    entrarNoPainel(r.sessao);
  } else {
    showLoginError(r.error || 'Não foi possível entrar.');
    loginPassEl.value = '';
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await apiAuth('sair', {}).catch(() => {});
  mostrarLogin();
});

document.addEventListener('DOMContentLoaded', arrancarAutenticacao);

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
  return `<span class="status ${jscEsc(map[st] || '')}">${jscEsc(st)}</span>`;
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
  // Aqui criava-se a chave das notícias quando ela não existia:
  //
  //     if (!localStorage.getItem(NEWS_KEY)) saveNoticias([]);
  //
  // Não era preciso — o loadNoticias() devolve [] quando a chave falta — e num
  // browser que perdeu o armazém era activamente mau: abrir o painel escrevia
  // uma lista vazia por cima do nada, e a partir daí passava a existir uma
  // lista vazia a sério, pronta a ser publicada por cima das notícias do site.
  //
  // Medido: das 34 chaves perdidas em produção, a jsc_noticias foi uma das
  // três que reapareceram, e foi esta linha que a recriou. A ausência da chave
  // volta a significar ausência, e o painel trabalha com [] em memória.

  // Já não existe palavra-passe por omissão: a conta é criada no primeiro
  // arranque, no servidor. O aviso deixa de fazer sentido.
  const alerta = document.getElementById('secAlerta');
  if (alerta) alerta.style.display = 'none';

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
  if (typeof renderLogos === 'function')        renderLogos();

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
      <td>${jscEsc(i.nome)}</td>
      <td>${jscEsc(i.escalao)}</td>
      <td>${jscEsc(fmtDate(i.data))}</td>
      <td>${statusBadge(i.estado)}</td>
    </tr>`).join('');

  // Recent mensagens
  const tbody2 = document.querySelector('#dashMsgTable tbody');
  tbody2.innerHTML = DB.mensagens.slice(0, 4).map(m => `
    <tr>
      <td>${jscEsc(m.nome)}</td>
      <td>${jscEsc(m.assunto)}</td>
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
          <span>${jscEsc(d.getDate())}</span>
          ${jscEsc(d.toLocaleDateString('pt-PT', { month: 'short' }))}
        </div>
        <div class="dash-agenda-info">
          <strong>${jscEsc(e.titulo)}</strong>
          <small>${jscEsc(e.hora)} · ${jscEsc(e.local)}</small>
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
        <span class="chart-label">${jscEsc(e.nome)}</span>
        <div class="chart-bar-wrap">
          <div class="chart-bar ${jscEsc(alt ? 'chart-bar--yellow' : '')}" style="width:${jscEsc(pct)}%">
            <span class="chart-val ${jscEsc(alt ? 'chart-val--dark' : '')}">${jscEsc(e.atletas)}</span>
          </div>
        </div>
        <span class="chart-count">${jscEsc(e.atletas)}</span>
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
      <td><strong>${jscEsc(i.nome)}</strong></td>
      <td>${jscEsc(i.escalao)}</td>
      <td>${jscEsc(i.idade)} anos</td>
      <td>${jscEsc(i.telefone)}</td>
      <td>${jscEsc(fmtDate(i.data))}</td>
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
      <div class="detail-item"><span class="detail-item__label">Nome</span><span class="detail-item__val">${jscEsc(i.nome)}</span></div>
      ${i.modalidade ? `<div class="detail-item"><span class="detail-item__label">Modalidade</span><span class="detail-item__val">${jscEsc(i.modalidade)}</span></div>` : ''}
      <div class="detail-item"><span class="detail-item__label">Escalão</span><span class="detail-item__val">${jscEsc(i.escalao)}</span></div>
      ${i.nivel && i.nivel !== '—' ? `<div class="detail-item"><span class="detail-item__label">Nível</span><span class="detail-item__val">${jscEsc(i.nivel)}</span></div>` : ''}
      <div class="detail-item"><span class="detail-item__label">Idade</span><span class="detail-item__val">${jscEsc(i.idade)} anos</span></div>
      <div class="detail-item"><span class="detail-item__label">Posição</span><span class="detail-item__val">${jscEsc(i.posicao || '—')}</span></div>
      ${i.pref && i.pref !== '—' ? `<div class="detail-item"><span class="detail-item__label">Pé preferido</span><span class="detail-item__val">${jscEsc(i.pref)}</span></div>` : ''}
      ${i.altura && i.altura !== '—' ? `<div class="detail-item"><span class="detail-item__label">Altura / Peso</span><span class="detail-item__val">${jscEsc(i.altura)} cm / ${jscEsc(i.peso || '—')} kg</span></div>` : ''}
      ${i.nomeResp && i.nomeResp !== '—' ? `<div class="detail-item"><span class="detail-item__label">Encarregado</span><span class="detail-item__val">${jscEsc(i.nomeResp)}</span></div>` : ''}
      <div class="detail-item"><span class="detail-item__label">Contacto</span><span class="detail-item__val">${jscEsc(i.telefone)}</span></div>
      <div class="detail-item"><span class="detail-item__label">E-mail</span><span class="detail-item__val">${jscEsc(i.email)}</span></div>
      <div class="detail-item"><span class="detail-item__label">Data</span><span class="detail-item__val">${jscEsc(fmtDate(i.data))}</span></div>
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
  if (a.foto) return `<img src="${jscEscUrl(a.foto)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" />`;
  const initials = a.nome.split(' ').filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();
  return `<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">${jscEsc(initials)}</div>`;
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
      <td><strong>${jscEsc(a.nome)}</strong>${jscEsc(isAniversario ? ' 🎂' : '')}</td>
      <td>${jscEsc(a.escalao)}</td>
      <td>${jscEsc(a.posicao || '—')}</td>
      <td>${jscEsc(fmtNasc(a.dataNascimento))}${idade !== null ? ` <small style="color:#888">(${jscEsc(idade)} anos)</small>` : ''}</td>
      <td>${jscEsc(a.encarregado)}</td>
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
    <input type="hidden" id="mFoto" value="${jscEsc(fotoAtual)}" />
    <input type="file" id="mFotoFile" accept="image/*" style="display:none" onchange="handleAtletaFoto(this,'mFoto','mFotoPreview')" />
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
      <button type="button" class="btn-sm" onclick="document.getElementById('mFotoFile').click()">&#128190; Ficheiro</button>
      <button type="button" class="btn-sm" onclick="colarFotoClipboard()" title="Copiar imagem no FPF → colar aqui">&#128203; Colar (Ctrl+V)</button>
      <span style="font-size:0.78rem;color:#888">Clique direito na foto do FPF → Copiar imagem → Colar aqui</span>
    </div>
    <div id="mFotoPreview" style="${jscEsc(fotoAtual ? 'display:flex;align-items:center' : 'display:none')};margin-top:4px;gap:10px">
      <img src="${jscEscUrl(fotoAtual)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--blue)" />
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
        <input type="text" class="form-input" id="mNome" value="${jscEsc(a.nome)}" />
      </div>
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mEscalao">${_escOpts(a.escalao)}</select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Posição</label>
        <select class="form-input" id="mPosicao">
          ${['—','Guarda-redes','Defesa Direito','Defesa Esquerdo','Central','Médio Defensivo','Médio','Extremo','Avançado'].map(p =>
            `<option${jscEsc((p===(a.posicao||'—'))?' selected':'')}>${jscEsc(p)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Data de Nascimento</label>
        <input type="date" class="form-input" id="mDataNasc" value="${jscEsc(a.dataNascimento || '')}" />
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Encarregado</label>
        <input type="text" class="form-input" id="mEnc" value="${jscEsc(a.encarregado || '')}" />
      </div>
      <div class="modal-field"><label>Estado</label>
        <select class="form-input" id="mEstado">
          <option${jscEsc(a.estado==='Activo'?' selected':'')}>Activo</option>
          <option${jscEsc(a.estado==='Inactivo'?' selected':'')}>Inactivo</option>
        </select>
      </div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Nº Camisola</label>
        <input type="number" class="form-input" id="mNumero" min="1" max="99" value="${jscEsc(a.numero || '')}" placeholder="—" />
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
  //
  // O endpoint vive em api/, com os outros treze endpoints autenticados. Estava
  // na raiz, e no alojamento real a raiz não via a sessão do painel: o Buscar
  // recebia "Precisa de sessao no painel" com o Admin autenticado no mesmo
  // browser. Ver o cabeçalho do api/proxy.php.
  const localProxy = `../api/proxy.php?url=${encodeURIComponent(url)}`;
  const externalProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  // O que o NOSSO proxy respondeu quando recusou. Antes, um !res.ok devolvia
  // null e a resposta era descartada sem ser lida: o painel dizia "fetch
  // falhou" e o servidor tinha explicado o motivo em texto simples. Foi assim
  // que um "Precisa de sessao no painel" ficou invisível durante dias.
  let erroLocal = '';

  const tryFetch = async (proxyUrl, timeout, guardarErro) => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(proxyUrl, { signal: ctrl.signal, credentials: 'same-origin' });
      clearTimeout(tid);
      if (!res.ok) {
        if (guardarErro) {
          try { erroLocal = (await res.text()).trim().slice(0, 300); } catch (_) {}
        }
        return null;
      }
      const text = await res.text();
      // If api/proxy.php is not being executed (served as raw text by a static
      // server), its response starts with "<?php". Reject and fall through to
      // external proxies.
      if (text.trimStart().startsWith('<?php')) return null;
      return text.length >= 500 ? text : null;
    } catch(e) { clearTimeout(tid); return null; }
  };

  // Try local proxy first (fast, reliable)
  const local = await tryFetch(localProxy, 15000, true);
  if (local) return local;

  // Fall back to external CORS proxies
  let lastErr = 'Falha na ligação';
  for (const proxy of externalProxies) {
    try {
      const text = await tryFetch(proxy, 12000);
      if (text) return text;
    } catch(e) { lastErr = e.message || lastErr; }
  }
  // O que o nosso servidor disse vale mais do que qualquer texto genérico.
  if (erroLocal) {
    throw new Error('O servidor respondeu: ' + erroLocal
      + ' — se precisares, abre a página no browser, copia a tabela e cola aqui.');
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
    // O motivo fica à vista no campo, e não só num aviso que desaparece.
    ta.placeholder = 'Cola aqui manualmente — ' + (e.message || 'a busca falhou');
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
      <strong>${jscEsc(players.length)}</strong> jogadores reconhecidos
      · <span style="color:#16a34a">${jscEsc(novos)} novos</span>
      ${dups ? `· <span style="color:#d97706">${jscEsc(dups)} duplicados</span>` : ''}
      ${withPhoto ? `· <span style="color:#2563eb">${jscEsc(withPhoto)} com foto</span>` : ''}
      ${withDate ? `· <span style="color:#7c3aed">${jscEsc(withDate)} com data nasc.</span>` : ''}
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
          ? `<img src="${jscEscUrl(p.foto)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'" />`
          : `<div style="width:32px;height:32px;border-radius:50%;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:#999">${p.nome.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>`;
        return `<tr style="border-bottom:1px solid #eee${jscEsc(dup ? ';opacity:0.55' : '')}">
          <td style="padding:4px 8px">${avatar}</td>
          <td style="padding:4px 10px;font-weight:600">${jscEsc(p.nome)}</td>
          <td style="padding:4px 10px;color:#888">${jscEsc(p.dataNascimento || '—')}</td>
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
      Modo: <strong>${jscEsc(modo)}</strong> · ${jscEsc(text.split('\n').filter(l => l.trim()).length)} linhas
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
        statusHtml = `<span style="color:#7c3aed;font-weight:700">&#9200; ${jscEsc(dt)}</span>`;
      } else if (n.publicada) {
        statusHtml = `<span style="color:#16a34a;font-weight:700">&#10003; Publicada</span>`;
      } else {
        statusHtml = `<span style="color:#d97706;font-weight:700">&#9646; Rascunho</span>`;
      }
      const destaqueHtml = n.destaque ? `<span style="background:#f59e0b;color:#fff;font-size:0.7rem;padding:2px 7px;border-radius:20px;font-weight:700;margin-left:6px">&#11088;</span>` : '';
      return `
      <div class="news-admin-card">
        <div class="news-admin-img news-admin-img--${jscEsc((i % 3) + 1)}"
             style="${n.imagem ? `background-image:url('${jscEscUrl(n.imagem)}');background-size:cover;background-position:center;background-repeat:no-repeat` : ''}">
          <span class="news-cat-badge">${jscEsc(n.categoria || '')}</span>
        </div>
        <div class="news-admin-body">
          <div class="news-admin-title">${jscEsc(n.titulo)}${destaqueHtml}</div>
          <div class="news-admin-date">${jscEsc(fmtDate(n.data))} &middot; ${statusHtml}</div>
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
      <input type="text" class="form-input" id="mTitulo" value="${jscEsc(n?.titulo || '')}" placeholder="Título da notícia" />
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Categoria</label>
        <select class="form-input" id="mCat">
          ${cats.map(c => `<option${jscEsc(c === (n?.categoria || 'Resultado') ? ' selected' : '')}>${jscEsc(c)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field"><label>Data</label>
        <input type="date" class="form-input" id="mData" value="${jscEsc(n?.data || new Date().toISOString().split('T')[0])}" />
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
        <input type="url" class="form-input" id="mImagem" value="${jscEsc(n?.imagem || '')}" placeholder="https://..." style="flex:1;min-width:160px" oninput="previewNoticiaUrl(this.value)" />
      </div>
      <div id="mImagemPreview" style="${jscEsc(n?.imagem ? '' : 'display:none')}">
        <div style="font-size:0.78rem;color:#888;margin-bottom:4px">Clique na imagem para definir o ponto focal do recorte</div>
        <div id="mNoticiaPreviewWrap" style="position:relative;border-radius:8px;overflow:hidden;background:#1a3a80;height:180px;cursor:crosshair">
          <img id="mImagemPreviewImg" src="${jscEscUrl(n?.imagem || '')}"
            style="width:100%;height:100%;object-fit:cover;object-position:${jscEsc(focalPos)};pointer-events:none;display:block"
            onerror="this.parentElement.parentElement.style.display='none'" />
          <div id="mNoticiaFocalPin" style="position:absolute;left:${jscEsc(focalPct[0])}%;top:${jscEsc(focalPct[1])}%;transform:translate(-50%,-50%);pointer-events:none;z-index:3;display:${jscEsc(n?.imagem?'block':'none')}">
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
      <input type="hidden" id="mFocalPos" value="${jscEsc(focalPos)}" />
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
            <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:2px solid ${jscEsc(val===pos?'var(--blue)':'#e2e8f0')};border-radius:8px;cursor:pointer;font-size:0.82rem;background:${jscEsc(val===pos?'#eff6ff':'#fff')}" onclick="selectImagePos('${val}')">
              <input type="radio" name="mImagemPos" value="${jscEsc(val)}" ${jscEsc(val===pos?'checked':'')} style="display:none">
              <span style="font-size:1rem">${jscEsc(label.split(' ')[0])}</span>
              <span><strong>${label.split(' ').slice(1).join(' ')}</strong><br><small style="color:#888">${jscEsc(desc)}</small></span>
            </label>`).join('')}
        </div>
        <input type="hidden" id="mImagemPos" value="${jscEsc(pos)}">
      </div>
      <div class="modal-field">
        <label>Tamanho da imagem</label>
        <select class="form-input" id="mImagemSize" style="margin-top:4px">
          <option value="cover"   ${jscEsc(sz==='cover'  ?'selected':'')}>Preencher (corta bordas)</option>
          <option value="contain" ${jscEsc(sz==='contain'?'selected':'')}>Mostrar tudo</option>
          <option value="110%"    ${jscEsc(sz==='110%'   ?'selected':'')}>Zoom 110%</option>
          <option value="140%"    ${jscEsc(sz==='140%'   ?'selected':'')}>Zoom 140%</option>
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
          <option value="publicada" ${jscEsc((isNew || (n?.publicada && !n?.scheduledAt)) ? 'selected' : '')}>&#10003; Publicada</option>
          <option value="rascunho"  ${jscEsc((!isNew && !n?.publicada && !n?.scheduledAt) ? 'selected' : '')}>&#9646; Rascunho</option>
          <option value="agendada"  ${jscEsc(n?.scheduledAt ? 'selected' : '')}>&#9200; Agendada</option>
        </select>
      </div>
      <div class="modal-field" id="mAgendamentoWrap" style="${jscEsc(n?.scheduledAt ? '' : 'display:none')}">
        <label>Data e hora de publicação</label>
        <input type="datetime-local" class="form-input" id="mScheduledAt" value="${jscEsc(n?.scheduledAt || '')}" />
      </div>
    </div>
    <div class="modal-field" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="mDestaque" ${jscEsc(n?.destaque ? 'checked' : '')} />
        &#11088; Artigo em destaque (aparece no topo da página de notícias)
      </label>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-cancel" onclick="previewNoticiaForm()" style="background:#f0f4ff;color:#003B8E;border:1px solid #c7d8f8">&#128065; Pré-visualizar</button>
     <button class="btn-save" onclick="saveNoticia(${isNew ? 'null' : n.id})">${jscEsc(isNew ? 'Criar Notícia' : 'Guardar')}</button>`
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
      banner.innerHTML = `<span>&#128190; Rascunho automático encontrado (${jscEsc(ts)}). Restaurar?</span>`
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

  let html = `<img src="${jscEscUrl(url)}" style="${imgStyle}" loading="lazy" alt="${jscEsc(caption || '')}">`;
  if (caption) html += `<span style="display:block;text-align:center;font-size:0.82rem;color:#888;margin:4px 0 12px">${jscEsc(caption)}</span>`;
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
    <tr style="${jscEsc(m.estado==='Não lida'?'font-weight:700':'')}">
      <td>${jscEsc(m.nome)}</td>
      <td>${jscEsc(m.email)}</td>
      <td>${jscEsc(m.assunto)}</td>
      <td>${jscEsc(fmtDate(m.data))}</td>
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
      <div class="detail-item"><span class="detail-item__label">Nome</span><span class="detail-item__val">${jscEsc(m.nome)}</span></div>
      <div class="detail-item"><span class="detail-item__label">E-mail</span><span class="detail-item__val">${jscEsc(m.email)}</span></div>
      <div class="detail-item"><span class="detail-item__label">Telefone</span><span class="detail-item__val">${jscEsc(m.telefone)}</span></div>
      <div class="detail-item"><span class="detail-item__label">Assunto</span><span class="detail-item__val">${jscEsc(m.assunto)}</span></div>
      <div class="detail-item" style="grid-column:span 2"><span class="detail-item__label">Mensagem</span>
        <span class="detail-item__val" style="white-space:pre-wrap">${jscEsc(m.mensagem)}</span></div>
      <div class="detail-item"><span class="detail-item__label">Data</span><span class="detail-item__val">${jscEsc(fmtDate(m.data))}</span></div>
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
// Devolve MARKUP: uma cadeia de <option>. Quem a usa insere-a como HTML, e por
// isso NÃO a envolve em jscEsc() — envolvê-la escapava os < e os > e o browser
// passava a ver texto; um <select> não mostra texto, e o campo Escalão abria
// vazio em sete formulários do painel. Pior: ao guardar um registo existente, um
// select sem opções devolve "" e apagava o escalão que lá estava.
//
// O escape faz-se aqui, onde é devido: no NOME, que é texto dentro da opção. O
// ' selected' é um literal do código e não precisa de escape nenhum. A opção
// continua sem atributo value, pelo que select.value devolve o nome tal como
// está nos dados — o formato não muda.
function _escOpts(current, includeAll) {
  let nomes = DB.escaloes.map(e => e.nome)
    .sort((a,b) => (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0));
  if (!nomes.length) nomes = ['Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19'];
  if (includeAll) nomes = ['Todos', ...nomes];
  return nomes.map(n => `<option${n===current?' selected':''}>${jscEsc(n)}</option>`).join('');
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
    atTabs.innerHTML = `<button class="tab-filter${jscEsc(!cur?' active':'')}" data-escalao="">Todos</button>`
      + nomes.map(n => `<button class="tab-filter${jscEsc(n===cur?' active':'')}" data-escalao="${n}">${n}</button>`).join('');
  }
}

function renderEscaloes() {
  const grid = document.getElementById('escaloesGrid');
  grid.innerHTML = DB.escaloes.map((e, i) => `
    <div class="escalao-card ${jscEsc(e.destaque ? 'escalao-card--featured' : '')}">
      ${e.destaque ? '<div class="escalao-destaque-badge">⭐ Destaque</div>' : ''}
      <div class="escalao-name">${jscEsc(e.nome)} – ${jscEsc(e.designacao)}</div>
      <div class="escalao-range">${jscEsc(e.faixa)}</div>
      <div class="escalao-stats">
        <div class="escalao-stat">
          <span class="escalao-stat__num">${jscEsc(e.atletas)}</span>
          <span class="escalao-stat__label">Atletas</span>
        </div>
      </div>
      <div class="escalao-treinador">
        <strong>Treinador:</strong> ${e.treinador ? jscEsc(e.treinador) : '<em style="color:#94a3b8">por preencher</em>'}<br />
        <strong>Treinos:</strong> ${e.treinos ? jscEsc(e.treinos) : '<em style="color:#94a3b8">por preencher</em>'}
      </div>
      ${e.descricao ? `<div class="escalao-desc">${jscEsc(e.descricao)}</div>` : ''}
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
  // Sugestões, não uma lista fechada: o clube pode ter escalões fora da
  // escada habitual (femininos, sub-23, equipas B) e não deve ficar preso.
  const SUB_OPTIONS = ['Sub-5','Sub-7','Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19','Sub-21','Sub-23','Sénior'];
  openModal(idx >= 0 ? 'Editar Categoria' : 'Nova Categoria', `
    <div class="modal-row">
      <div class="modal-field"><label>Escalão</label>
        <input class="form-input" id="eNome" list="eNomeSugestoes" value="${jscEsc(e.nome === 'Sub-X' ? '' : e.nome)}" placeholder="Ex: Sub-13" autocomplete="off" />
        <datalist id="eNomeSugestoes">
          ${SUB_OPTIONS.map(s=>`<option value="${jscEsc(s)}"></option>`).join('')}
        </datalist></div>
      <div class="modal-field"><label>Designação (ex: Benjamins)</label>
        <input class="form-input" id="eDesig" value="${jscEsc(e.designacao)}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Faixa etária (ex: 12 a 13 anos)</label>
        <input class="form-input" id="eFaixa" value="${jscEsc(e.faixa)}" /></div>
      <div class="modal-field"><label>Nº de atletas</label>
        <input class="form-input" type="number" id="eAtletas" value="${jscEsc(e.atletas)}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Treinador responsável</label>
        <input class="form-input" id="eTreinador" value="${jscEsc(e.treinador)}" /></div>
      <div class="modal-field"><label>Horário de treinos</label>
        <input class="form-input" id="eTreinos" value="${jscEsc(e.treinos)}" placeholder="Dias e hora dos treinos" /></div>
    </div>
    <div class="modal-field"><label>Descrição (aparece no site)</label>
      <textarea class="form-input" id="eDesc" rows="3">${jscEsc(e.descricao || '')}</textarea></div>
    <div class="modal-field" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="eDestaque" ${jscEsc(e.destaque?'checked':'')} />
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
// O escalão com que os jogos da Equipa Sénior são gravados no db_jogos.
//
// É uma string e não uma entrada do db_escaloes, e isso é o ponto todo: criar
// um escalão "Seniores" na Formação punha-o no plantel, nos atletas, na
// formacao.html e na escalao.html. Assim os jogos vivem no mesmo db_jogos — a
// publicação, a projeção pública e o js/sync.js levam-nos sem uma linha de PHP
// nova — e nenhuma página da Formação os mostra: o js/escalao.js filtra pelo
// escalão da sua página e os separadores da resultados.html são fixos.
const JSC_SENIOR_ESCALAO = 'Seniores';

function fmtDataJogo(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function renderJogos(filterEscalao = '') {
  const scRe = /sport campinense|js campinense|campinense/i;

  const jogoRow = (j) => `
      <tr>
        <td>${jscEsc(fmtDataJogo(j.data))}<br/><span style="font-size:0.75rem;color:var(--gray-text)">${jscEsc(j.hora)}</span></td>
        <td>${jscEsc(j.escalao)}</td>
        <td style="${jscEsc(scRe.test(j.casa)?'font-weight:700;color:var(--blue)':'')}">${jscEsc(j.casa)}</td>
        <td style="${jscEsc(scRe.test(j.fora)?'font-weight:700;color:var(--blue)':'')}">${jscEsc(j.fora)}</td>
        <td style="text-align:center;font-size:1.1rem">${j.estado === 'Realizado'
          ? `<strong>${jscEsc(j.gcasa)} – ${jscEsc(j.gfora)}</strong>`
          : `<span style="color:var(--gray-text)">—</span>`}</td>
        <td style="font-size:0.8rem;color:var(--gray-text)">${jscEsc(j.local)}</td>
        <td>
          <div class="btn-actions">
            ${j.estado === 'Agendado' ? `<button class="btn-icon btn-icon--green" onclick="registarResultado(${j.id})" title="Registar resultado">&#9999;</button>` : ''}
            <button class="btn-icon" onclick="editJogo(${j.id})" title="Editar">&#9998;</button>
            <button class="btn-icon btn-icon--red" onclick="removeJogo(${j.id})" title="Eliminar">&#128465;</button>
          </div>
        </td>
      </tr>`;

  // Os jogos da Equipa Sénior ficam fora desta lista, de propósito: são
  // geridos na página Equipa Sénior e não pertencem à Formação. O escalão
  // 'Seniores' não existe no db_escaloes nem no CLASS_ESCALOES, logo também
  // não aparece no filtro acima — sem esta linha apareceriam em "Todos os
  // escalões", que é precisamente onde não devem estar.
  let data = (DB.jogos || []).filter(j => j.escalao !== JSC_SENIOR_ESCALAO);
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

  // A colagem de jogos e o CRUD acabam todos aqui. A tabela da Equipa Sénior
  // lê o mesmo DB.jogos, por isso refresca-se no mesmo sítio em vez de cada
  // caminho ter de se lembrar dela. A função devolve logo se a página não
  // estiver montada.
  if (typeof renderJogosSenior === 'function') renderJogosSenior();
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
      ${jscEsc(j.escalao)} · ${jscEsc(fmtDataJogo(j.data))} · ${jscEsc(j.hora)}
    </p>
    <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:20px">
      <div style="text-align:center">
        <div style="font-weight:700;margin-bottom:8px">${jscEsc(j.casa)}</div>
        <input type="number" id="mGCasa" min="0" max="30" value="0"
          style="width:70px;padding:12px;font-size:1.5rem;text-align:center;border:2px solid var(--gray-border);border-radius:8px;font-family:var(--font-display)" />
      </div>
      <div style="font-family:var(--font-display);font-size:2rem;color:var(--gray-text)">–</div>
      <div style="text-align:center">
        <div style="font-weight:700;margin-bottom:8px">${jscEsc(j.fora)}</div>
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
      <div class="modal-field"><label>Data</label><input type="date" id="mJData" value="${jscEsc(j.data)}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Hora</label><input type="time" id="mJHora" value="${jscEsc(j.hora)}" /></div>
      <div class="modal-field"><label>Local</label><input type="text" id="mJLocal" value="${jscEsc(j.local)}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Equipa Casa</label><input type="text" id="mJCasa" value="${jscEsc(j.casa)}" /></div>
      <div class="modal-field"><label>Equipa Fora</label><input type="text" id="mJFora" value="${jscEsc(j.fora)}" /></div>
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
// EQUIPA SÉNIOR — JOGOS, RESULTADOS E CLASSIFICAÇÃO
// ==================================================
// Nada aqui duplica o sistema da Formação: os jogos vão para o mesmo
// DB.jogos com escalao === JSC_SENIOR_ESCALAO, e a classificação usa as
// funções que já existem — abrirColar(), abrirEditorClass() e
// apagarClassBase() — com o escalão 'Seniores' e sem série. A chave fica
// fpf_class_Seniores e atravessa a publicação sem alteração no PHP.
//
// A JORNADA é opcional, e opcional quer dizer que a propriedade não existe
// quando está vazia, em vez de existir com '' ou 0. Os 73 jogos que já
// estavam gravados não a têm e continuam a funcionar: aparecem com «—».

// O número da jornada escrito no formulário, ou undefined se estiver vazio.
function _sjJornada() {
  const el = document.getElementById('mSJJornada');
  if (!el) return undefined;
  const v = String(el.value || '').trim();
  if (v === '') return undefined;
  const n = parseInt(v, 10);
  return (isFinite(n) && n > 0 && n < 1000) ? n : undefined;
}

function _sjFormulario(j) {
  const o = j || {};
  return `
    <div class="modal-row">
      <div class="modal-field"><label>Jornada</label>
        <input type="number" id="mSJJornada" min="1" max="999" placeholder="opcional"
               value="${jscEsc(o.jornada != null ? o.jornada : '')}" /></div>
      <div class="modal-field"><label>Data *</label>
        <input type="date" id="mSJData" value="${jscEsc(o.data || '')}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Hora</label>
        <input type="time" id="mSJHora" value="${jscEsc(o.hora || '15:00')}" /></div>
      <div class="modal-field"><label>Local</label>
        <input type="text" id="mSJLocal" placeholder="Campo Municipal N.º 2 - Loulé"
               value="${jscEsc(o.local || '')}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Equipa Casa *</label>
        <input type="text" id="mSJCasa" placeholder="Nome da equipa"
               value="${jscEsc(o.casa || '')}" /></div>
      <div class="modal-field"><label>Equipa Fora *</label>
        <input type="text" id="mSJFora" placeholder="Nome da equipa"
               value="${jscEsc(o.fora || '')}" /></div>
    </div>`;
}

function renderJogosSenior() {
  const corpoProx = document.querySelector('#seniorJogosProxTable tbody');
  const corpoRes  = document.querySelector('#seniorJogosTable tbody');
  if (!corpoProx || !corpoRes) return;   // a página não está montada

  // O botão de correcção só existe enquanto houver o que corrigir, e diz
  // quantos são. Sem jogos por identificar não se mostra sequer.
  const btnRev = document.getElementById('btnRevisaoSenior');
  if (btnRev) {
    const n = jogosSeniorPorCorrigir().length;
    btnRev.style.display = n ? '' : 'none';
    btnRev.innerHTML = '&#9888; Corrigir adversários (' + jscEsc(n) + ')';
  }

  const scRe = /sport campinense|js campinense|campinense/i;
  const linha = (j) => `
      <tr>
        <td style="text-align:center">${jscEsc(j.jornada != null && j.jornada !== '' ? j.jornada : '—')}</td>
        <td>${jscEsc(fmtDataJogo(j.data))}<br/><span style="font-size:0.75rem;color:var(--gray-text)">${jscEsc(j.hora || '')}</span></td>
        <td style="${jscEsc(scRe.test(j.casa || '') ? 'font-weight:700;color:var(--blue)' : '')}">${jscEsc(j.casa)}</td>
        <td style="${jscEsc(scRe.test(j.fora || '') ? 'font-weight:700;color:var(--blue)' : '')}">${jscEsc(j.fora)}</td>
        <td style="text-align:center;font-size:1.1rem">${j.estado === 'Realizado'
          ? `<strong>${jscEsc(j.gcasa)} – ${jscEsc(j.gfora)}</strong>`
          : '<span style="color:var(--gray-text)">—</span>'}</td>
        <td style="font-size:0.8rem;color:var(--gray-text)">${jscEsc(j.local || '')}</td>
        <td>
          <div class="btn-actions">
            ${j.estado !== 'Realizado' ? `<button class="btn-icon btn-icon--green" onclick="registarResultadoSenior(${jscEsc(j.id)})" title="Registar resultado">&#9999;</button>` : ''}
            <button class="btn-icon" onclick="editJogoSenior(${jscEsc(j.id)})" title="Editar">&#9998;</button>
            <button class="btn-icon btn-icon--red" onclick="removeJogoSenior(${jscEsc(j.id)})" title="Eliminar">&#128465;</button>
          </div>
        </td>
      </tr>`;

  const todos = (DB.jogos || []).filter(j => j && j.escalao === JSC_SENIOR_ESCALAO);
  // A data pode faltar num jogo importado: o localeCompare direto rebentava.
  const porData = (a, b) => String(a.data || '').localeCompare(String(b.data || ''));
  const prox = todos.filter(j => j.estado !== 'Realizado').sort(porData);
  const res  = todos.filter(j => j.estado === 'Realizado').sort((a, b) => porData(b, a));

  corpoProx.innerHTML = prox.length ? prox.map(linha).join('')
    : '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">Sem jogos agendados.</td></tr>';
  corpoRes.innerHTML = res.length ? res.map(linha).join('')
    : '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">Sem resultados registados.</td></tr>';

  const cnt = document.getElementById('seniorJogosCount');
  if (cnt) cnt.textContent = todos.length
    ? `(${todos.length} — ${prox.length} agendados, ${res.length} realizados)` : '';
}

window.novoJogoSenior = function () {
  openModal('Novo Jogo — Equipa Sénior', _sjFormulario(null),
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNovoJogoSenior()">Guardar</button>`);
  const d = document.getElementById('mSJData');
  if (d) d.value = new Date().toISOString().split('T')[0];
  const c = document.getElementById('mSJCasa');
  if (c) c.value = 'Sport Campinense';
};

window.saveNovoJogoSenior = function () {
  const casa = (document.getElementById('mSJCasa')?.value || '').trim();
  const fora = (document.getElementById('mSJFora')?.value || '').trim();
  const data = document.getElementById('mSJData')?.value || '';
  if (!casa || !fora) { showToast('Preencha as equipas.', 'red'); return; }
  if (!data)          { showToast('Preencha a data.', 'red');    return; }

  const jogo = {
    id: Date.now(),
    escalao: JSC_SENIOR_ESCALAO,
    casa, fora,
    gcasa: null, gfora: null,
    data,
    hora:  document.getElementById('mSJHora')?.value || '',
    local: (document.getElementById('mSJLocal')?.value || '').trim() || 'Campo Municipal N.º 2 - Loulé',
    estado: 'Agendado',
  };
  const jorn = _sjJornada();
  if (jorn !== undefined) jogo.jornada = jorn;   // opcional: vazio não grava campo

  DB.jogos.push(jogo);
  saveDB();      // o CRUD de jogos da Formação não grava; este grava.
  renderJogos(); // e isto refresca as duas tabelas
  closeModal();
  showToast('Jogo adicionado!', 'green');
};

window.editJogoSenior = function (id) {
  const j = (DB.jogos || []).find(x => x.id === id);
  if (!j) return;
  openModal('Editar Jogo — Equipa Sénior', _sjFormulario(j),
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveEditJogoSenior(${jscEsc(id)})">Guardar</button>`);
};

window.saveEditJogoSenior = function (id) {
  const j = (DB.jogos || []).find(x => x.id === id);
  if (!j) return;
  const casa = (document.getElementById('mSJCasa')?.value || '').trim();
  const fora = (document.getElementById('mSJFora')?.value || '').trim();
  j.data  = document.getElementById('mSJData')?.value || j.data;
  j.hora  = document.getElementById('mSJHora')?.value || '';
  j.local = (document.getElementById('mSJLocal')?.value || '').trim();
  j.casa  = casa || j.casa;
  j.fora  = fora || j.fora;
  // Apagar a jornada é uma operação legítima: o campo é opcional, e deixá-lo
  // em branco tem de o devolver a «sem jornada», não guardar '' nem 0.
  const jorn = _sjJornada();
  if (jorn === undefined) delete j.jornada; else j.jornada = jorn;
  saveDB();
  renderJogos();
  closeModal();
  showToast('Jogo actualizado!', 'green');
};

// Registar resultado.
//
// A primeira versão disto chamava o registarResultado() da Formação e depois
// procurava o botão do rodapé do modal para lhe reescrever o onclick. Ficava
// a depender de um seletor de CSS acertar num botão que outra função
// desenhou: muda-se a classe do botão ali e isto deixa de gravar, em
// silêncio. O formulário é de três linhas — escreve-se, e a gravação é a
// desta página, que chama o saveDB().
window.registarResultadoSenior = function (id) {
  const j = (DB.jogos || []).find(x => x.id === id);
  if (!j) return;
  const campo = (lado, nome) => `
      <div style="text-align:center">
        <div style="font-weight:700;margin-bottom:8px">${jscEsc(nome)}</div>
        <input type="number" id="mSJG${lado}" min="0" max="30" value="0"
          style="width:70px;padding:12px;font-size:1.5rem;text-align:center;border:2px solid var(--gray-border);border-radius:8px;font-family:var(--font-display)" />
      </div>`;
  openModal('Registar Resultado — Equipa Sénior', `
    <p style="margin-bottom:16px;color:var(--gray-text);font-size:0.9rem">
      ${jscEsc(j.jornada != null && j.jornada !== '' ? 'Jornada ' + j.jornada + ' · ' : '')}${jscEsc(fmtDataJogo(j.data))}${jscEsc(j.hora ? ' · ' + j.hora : '')}
    </p>
    <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:20px">
      ${campo('Casa', j.casa)}
      <div style="font-family:var(--font-display);font-size:2rem;color:var(--gray-text)">–</div>
      ${campo('Fora', j.fora)}
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-approve" onclick="saveResultadoSenior(${jscEsc(id)})">Confirmar</button>`);
};

window.saveResultadoSenior = function (id) {
  const j = (DB.jogos || []).find(x => x.id === id);
  if (!j) return;
  j.gcasa  = parseInt(document.getElementById('mSJGCasa')?.value, 10) || 0;
  j.gfora  = parseInt(document.getElementById('mSJGFora')?.value, 10) || 0;
  j.estado = 'Realizado';
  saveDB();
  renderJogos();
  closeModal();
  showToast(`Resultado registado: ${j.gcasa} – ${j.gfora}`, 'green');
};

window.removeJogoSenior = function (id) {
  const j = (DB.jogos || []).find(x => x.id === id);
  if (!j) return;
  if (!confirm(`Eliminar este jogo da Equipa Sénior?\n\n${j.casa} – ${j.fora}\n${j.data || '(sem data)'}\n\nSó este jogo é eliminado. Os jogos da Formação não são afectados.`)) return;
  const idx = DB.jogos.findIndex(x => x.id === id);
  if (idx > -1) DB.jogos.splice(idx, 1);
  saveDB();
  renderJogos();
  showToast('Jogo eliminado.', 'red');
};

// ---- Classificação ------------------------------------------------
// O resumo do que está gravado em fpf_class_Seniores, e o botão de apagar
// só aparece quando há linhas para apagar.
function renderClassSeniorResumo() {
  const alvo = document.getElementById('seniorClassTabela');
  if (!alvo) return;   // a página não está montada

  const chave = teamStorageKey(JSC_SENIOR_ESCALAO, '', 'class');
  let linhas = [];
  try {
    const cru = JSON.parse(localStorage.getItem(chave) || '[]');
    if (Array.isArray(cru)) linhas = cru;
  } catch (e) {}

  const resumo = document.getElementById('seniorClassResumo');
  const btnAp  = document.getElementById('btnApagarClassSenior');
  if (btnAp) btnAp.style.display = linhas.length ? '' : 'none';

  if (!linhas.length) {
    if (resumo) resumo.textContent = '';
    alvo.innerHTML = '<p style="color:#999;font-size:0.85rem;margin:0">'
      + 'Sem classificação gravada. Use «Colar classificação» ou «Manual».</p>';
    return;
  }

  const cfg  = loadClassConfig();
  const esc  = cfg[JSC_SENIOR_ESCALAO] || {};
  const data = esc.lastSync ? new Date(esc.lastSync).toLocaleDateString('pt-PT') : '';
  if (resumo) resumo.textContent = `(${linhas.length} equipas${data ? ' · ' + data : ''})`;

  // Os pontos são os mesmos que a página pública mostra: V×3 + E, mais o
  // arrastado da 1.ª fase quando existe. A conta está no js/resultados.js;
  // aqui é só para se ver no painel o que foi gravado.
  const pontos = (t) => {
    const base = (Number(t.v) || 0) * 3 + (Number(t.e) || 0);
    return (t.pts != null && Number(t.pts) > base) ? Number(t.pts) : base + (Number(t.pts1fase) || 0);
  };
  const ordenadas = [...linhas].sort((a, b) =>
    pontos(b) - pontos(a)
    || ((Number(b.gm) || 0) - (Number(b.gs) || 0)) - ((Number(a.gm) || 0) - (Number(a.gs) || 0))
    || (Number(b.gm) || 0) - (Number(a.gm) || 0));

  alvo.innerHTML = `
    <div style="overflow-x:auto">
      <table class="table" style="min-width:560px">
        <thead><tr>
          <th>#</th><th>Equipa</th><th>J</th><th>V</th><th>E</th><th>D</th>
          <th>GM</th><th>GS</th><th>DG</th><th>Pts</th>
        </tr></thead>
        <tbody>
          ${ordenadas.map((t, i) => {
            const dg = (Number(t.gm) || 0) - (Number(t.gs) || 0);
            return `<tr>
              <td style="text-align:center">${jscEsc(i + 1)}</td>
              <td>${jscEsc(t.equipa || '—')}</td>
              <td>${jscEsc(t.j)}</td><td>${jscEsc(t.v)}</td><td>${jscEsc(t.e)}</td>
              <td>${jscEsc(t.d)}</td><td>${jscEsc(t.gm)}</td><td>${jscEsc(t.gs)}</td>
              <td>${jscEsc(dg > 0 ? '+' : '')}${jscEsc(dg)}</td>
              <td style="font-weight:700;color:var(--blue)">${jscEsc(pontos(t))}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

window.apagarClassSenior = function () {
  if (typeof apagarClassBase !== 'function') return;
  apagarClassBase(JSC_SENIOR_ESCALAO);
  renderClassSeniorResumo();
};

// ---- Corrigir adversários por identificar --------------------------
// Os 24 jogos que ficaram com «h2h» no lugar do adversário não se apagam nem
// se voltam a importar: uma reimportação criaria registos novos, porque a
// chave de fusão inclui os nomes, e ficavam 24 jogos a dobrar.
//
// Corrige-se cada registo no sítio, pelo id, e só o nome do lado que não
// identifica ninguém. A data, a hora, o lado do clube, o estado, o resultado,
// a jornada e o local ficam exactamente como estão. Nada é apagado, e os
// jogos da Formação nem sequer são lidos.
//
// A correspondência é pela DATA, e só quando ela decide sozinha: medido no
// painel, os 29 jogos dos seniores têm 29 datas diferentes. Onde houver
// dúvida — nenhum jogo na colagem para aquela data, mais do que um, ou o lado
// do clube a não bater certo — o registo fica como está e aparece na lista
// dos que precisam de revisão manual.
let _revSeniorPlano = null;   // a última pré-visualização, à espera de confirmação

function jogosSeniorPorCorrigir() {
  return (DB.jogos || []).filter(j => j && j.escalao === JSC_SENIOR_ESCALAO
    && (_jscPorIdentificar(j.casa) || _jscPorIdentificar(j.fora)));
}

window.abrirRevisaoSenior = function () {
  const m = document.getElementById('revisaoSeniorModal');
  if (!m) return;
  _revSeniorPlano = null;
  const ta = document.getElementById('revisaoSeniorTA');
  if (ta) ta.value = '';
  const porCorrigir = jogosSeniorPorCorrigir().length;
  const res = document.getElementById('revisaoSeniorResumo');
  if (res) {
    res.innerHTML = porCorrigir
      ? '<strong>' + jscEsc(porCorrigir) + '</strong> jogo(s) com o adversário por identificar.'
      : 'Nenhum jogo por corrigir — todos os adversários estão identificados.';
  }
  const prev = document.getElementById('revisaoSeniorPreview');
  if (prev) prev.innerHTML = '';
  const btn = document.getElementById('btnAplicarRevisaoSenior');
  if (btn) btn.style.display = 'none';
  m.style.display = 'flex';
};

window.fecharRevisaoSenior = function () {
  const m = document.getElementById('revisaoSeniorModal');
  if (m) m.style.display = 'none';
  _revSeniorPlano = null;
};

// A cópia de segurança antes de corrigir: os jogos todos, como estão, num
// ficheiro. Não publica nada e não toca no servidor.
window.descarregarCopiaJogos = function () {
  try {
    const dados = JSON.stringify({ exportadoEm: new Date().toISOString(), jogos: DB.jogos || [] }, null, 2);
    const url = URL.createObjectURL(new Blob([dados], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jsc-jogos-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Cópia dos jogos descarregada.', 'green');
  } catch (e) {
    showToast('Não foi possível descarregar a cópia: ' + (e.message || e.name), 'red');
  }
};

window.previsualizarRevisaoSenior = function () {
  const ta = document.getElementById('revisaoSeniorTA');
  const prev = document.getElementById('revisaoSeniorPreview');
  const btn = document.getElementById('btnAplicarRevisaoSenior');
  if (!ta || !prev) return;
  _revSeniorPlano = null;
  if (btn) btn.style.display = 'none';

  const colados = parsePastedJogos(ta.value || '');
  if (!colados.length) {
    prev.innerHTML = '<p style="color:#dc2626;font-size:0.85rem;margin:0">Nenhum jogo reconhecido nesta colagem.</p>';
    return;
  }

  const porData = {};
  colados.forEach(c => { (porData[c.data] = porData[c.data] || []).push(c); });

  const linhas = [];
  const plano = [];
  jogosSeniorPorCorrigir()
    .slice()
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
    .forEach(j => {
      const atual = String(j.casa) + ' vs ' + String(j.fora);
      const cands = porData[j.data] || [];
      let estado = '', proposto = '—';
      if (!cands.length)      estado = 'sem correspondência nesta colagem';
      else if (cands.length > 1) estado = 'mais do que um jogo nesta data — rever à mão';
      else {
        const c = cands[0];
        const adv = _jscAdversarioDe(c);
        const clubeEmCasa = _jscEhClube(j.casa);
        const coladoClubeEmCasa = _jscEhClube(c.casa);
        if (!adv)                      estado = 'a colagem não diz quem é o adversário';
        else if (_jscPorIdentificar(adv)) estado = 'o adversário continua por identificar na colagem';
        else if (clubeEmCasa !== coladoClubeEmCasa) estado = 'casa/fora não bate certo — rever à mão';
        else {
          proposto = clubeEmCasa ? (String(j.casa) + ' vs ' + adv) : (adv + ' vs ' + String(j.fora));
          estado = 'vai corrigir';
          plano.push({ id: j.id, adversario: adv, lado: clubeEmCasa ? 'fora' : 'casa',
                       logo: c.logoCasa && !coladoClubeEmCasa ? c.logoCasa : (c.logoFora && coladoClubeEmCasa ? c.logoFora : '') });
        }
      }
      linhas.push({ data: j.data, atual, proposto, estado });
    });

  // Datas que a colagem traz e o painel não tem. Não se acrescenta nada aqui:
  // só se diz, para não passarem despercebidas.
  const datasNoPainel = new Set((DB.jogos || [])
    .filter(j => j.escalao === JSC_SENIOR_ESCALAO).map(j => j.data));
  const emFalta = Object.keys(porData).filter(d => !datasNoPainel.has(d)).sort();

  const vaiCorrigir = linhas.filter(l => l.estado === 'vai corrigir').length;
  const porRever = linhas.length - vaiCorrigir;

  prev.innerHTML = ''
    + '<p style="font-size:0.85rem;margin:0 0 8px">'
    +   '<strong>' + jscEsc(colados.length) + '</strong> jogos na colagem · '
    +   '<strong style="color:#16a34a">' + jscEsc(vaiCorrigir) + '</strong> a corrigir · '
    +   '<strong style="color:#b45309">' + jscEsc(porRever) + '</strong> para revisão manual'
    + '</p>'
    + (emFalta.length
        ? '<p style="font-size:0.8rem;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;'
          + 'padding:8px 10px;color:#7a5700;margin:0 0 8px">A colagem tem jogos em datas que não existem '
          + 'no painel: ' + jscEsc(emFalta.join(', ')) + '. Esta ferramenta não os acrescenta — '
          + 'acrescente-os com «Novo jogo» ou com «Colar jogos».</p>'
        : '')
    + '<div style="overflow-x:auto"><table class="table" style="min-width:620px;font-size:0.8rem">'
    + '<thead><tr><th>Data</th><th>Como está</th><th>Como fica</th><th>Estado</th></tr></thead><tbody>'
    + linhas.map(l => '<tr>'
        + '<td style="white-space:nowrap">' + jscEsc(l.data) + '</td>'
        + '<td>' + jscEsc(l.atual) + '</td>'
        + '<td>' + jscEsc(l.proposto) + '</td>'
        + '<td style="color:' + (l.estado === 'vai corrigir' ? '#16a34a' : '#b45309') + '">'
        +   jscEsc(l.estado) + '</td>'
        + '</tr>').join('')
    + '</tbody></table></div>';

  if (vaiCorrigir) {
    _revSeniorPlano = plano;
    if (btn) {
      btn.style.display = '';
      btn.textContent = '✓ Corrigir ' + vaiCorrigir + ' jogo(s)';
    }
  }
};

window.aplicarRevisaoSenior = function () {
  if (!_revSeniorPlano || !_revSeniorPlano.length) {
    showToast('Não há nada confirmado para corrigir. Pré-visualize primeiro.', 'red');
    return;
  }
  const n = _revSeniorPlano.length;
  if (!confirm('Vão ser corrigidos ' + n + ' jogo(s) dos Seniores.\n\n'
      + 'Só muda o nome do adversário. A data, a hora, o lado, o estado e o resultado '
      + 'ficam como estão, e nenhum jogo é apagado.\n\nContinuar?')) return;

  let feitos = 0;
  for (const passo of _revSeniorPlano) {
    const j = (DB.jogos || []).find(x => x && x.id === passo.id);
    if (!j || j.escalao !== JSC_SENIOR_ESCALAO) continue;          // desapareceu entretanto
    if (!_jscPorIdentificar(j[passo.lado])) continue;              // já não precisa
    j[passo.lado] = passo.adversario;
    if (passo.logo) j[passo.lado === 'casa' ? 'logoCasa' : 'logoFora'] = passo.logo;
    delete j.revisao;
    feitos++;
  }
  saveDB();
  _revSeniorPlano = null;
  renderJogos();
  const resta = jogosSeniorPorCorrigir().length;
  fecharRevisaoSenior();
  showToast(feitos + ' jogo(s) corrigidos' + (resta ? ', ' + resta + ' ainda por identificar' : '')
    + '. Publique quando quiser que o site mostre a alteração.', 'green');
};

// ==================================================
// PATROCINADORES
// ==================================================
// Uma grelha só, pela ordem dos dados — a mesma ordem em que aparecem no
// site. Havia três grupos, um por nível de patrocínio, e a divisão saiu do
// site e daqui: nenhum patrocinador tem tratamento diferente de outro.
//
// O campo tier continua nos registos já guardados, por compatibilidade
// histórica, e não é lido em sítio nenhum. Os registos novos não o levam — e
// era por isso que esta função tinha de mudar ao mesmo tempo que o selector:
// agrupava por p.tier.toLowerCase(), que num registo novo não existe e
// deixaria a lista do painel a lançar um erro em vez de aparecer.
function renderPatrocinadores() {
  const wrap = document.getElementById('sponsorsAdminTiers');
  if (!wrap) return;
  const lista = DB.patrocinadores || [];
  const activos = lista.filter(p => p.ativo).length;
  wrap.innerHTML = `
      <div class="sponsors-admin-tier">
        <div class="sponsors-admin-tier__header">
          <span style="font-size:0.9rem;font-weight:700">Patrocinadores</span>
          <span style="font-size:0.8rem;color:var(--gray-text)">${jscEsc(activos)} activos · ${jscEsc(lista.length - activos)} inactivos</span>
        </div>
        <div class="sponsors-admin-grid">
          ${lista.length ? lista.map(p => `
            <div class="sponsor-admin-card ${jscEsc(p.ativo ? '' : 'sponsor-admin-card--inactive')}">
              ${p.logo ? `<img src="${jscEscUrl(p.logo)}" alt="" class="sponsor-admin-logo-img" />`
                       : `<div class="sponsor-admin-logo">${jscEsc(p.nome)}</div>`}
              <div class="sponsor-admin-name">${jscEsc(p.nome)}</div>
              <div class="sponsor-admin-sector">${jscEsc([p.sector, p.desde ? 'Desde ' + p.desde : ''].filter(Boolean).join(' · '))}</div>
              <div class="sponsor-admin-actions">
                <button class="btn-icon" onclick="editPatrocinador(${p.id})" title="Editar">&#9998;</button>
                <button class="btn-icon ${p.ativo ? 'btn-icon--red' : 'btn-icon--green'}"
                  onclick="togglePatrocinador(${p.id})"
                  title="${jscEsc(p.ativo ? 'Desactivar' : 'Activar')}">${p.ativo ? '&#9940;' : '&#9989;'}</button>
                <button class="btn-icon btn-icon--red" onclick="removePatrocinador(${p.id})" title="Eliminar">&#128465;</button>
              </div>
            </div>`).join('')
            : '<p style="color:var(--gray-text);font-size:0.85rem;padding:8px 0">Nenhum patrocinador registado.</p>'}
        </div>
      </div>`;
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
      <div class="modal-field"><label>Ano de início</label>
        <input type="number" id="mPDesde" value="2026" min="2000" max="2099" /></div>
      <div class="modal-field"><label>Website (opcional)</label>
        <input type="url" id="mPWebsite" placeholder="https://empresa.pt" /></div>
    </div>
    <div class="modal-field"><label>Logótipo (URL ou upload)</label>
      <input class="form-input" type="text" id="mPLogo" value="" placeholder="https://... ou carregar ficheiro" />
      <input type="file" id="mPLogoFile" accept="image/*" style="display:none" />
      <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mPLogoFile').click()">&#128190; Carregar logótipo</button>
      <div id="mPLogoPreview" style="display:none;margin-top:8px">
        <img src="" style="max-width:120px;max-height:64px;object-fit:contain;border:1px solid #e0e0e0;border-radius:6px;padding:4px;background:#fff" />
      </div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveNovoPatrocinador()">Guardar</button>`
  );
  setupImageUpload('mPLogoFile', 'mPLogo', 'mPLogoPreview');
});

window.saveNovoPatrocinador = function () {
  const nome = document.getElementById('mPNome').value.trim();
  if (!nome) { showToast('Introduza o nome.', 'red'); return; }
  // Sem tier: a divisão por níveis deixou de existir no site e aqui. O campo
  // fica nos registos antigos por compatibilidade histórica e não é lido.
  //
  // Sector em branco fica em branco. Gravava-se aqui um travessão, e o site
  // publicava-o como se fosse o sector da empresa.
  DB.patrocinadores.push({
    id: Date.now(), nome,
    sector:  document.getElementById('mPSector').value.trim(),
    desde:   String(document.getElementById('mPDesde').value),
    website: document.getElementById('mPWebsite').value.trim(),
    logo:    document.getElementById('mPLogo').value.trim(),
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
        <input type="text" id="mPNome" value="${jscEsc(p.nome)}" /></div>
      <div class="modal-field"><label>Sector</label>
        <input type="text" id="mPSector" value="${jscEsc(p.sector)}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Desde</label>
        <input type="number" id="mPDesde" value="${jscEsc(p.desde)}" /></div>
      <div class="modal-field"><label>Website</label>
        <input type="url" id="mPWebsite" value="${jscEsc(p.website || '')}" /></div>
    </div>
    <div class="modal-field"><label>Logótipo (URL ou upload)</label>
      <input class="form-input" type="text" id="mPLogo" value="${jscEsc(p.logo || '')}" placeholder="https://... ou carregar ficheiro" />
      <input type="file" id="mPLogoFile" accept="image/*" style="display:none" />
      <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mPLogoFile').click()">&#128190; Carregar logótipo</button>
      <div id="mPLogoPreview" style="${jscEsc(p.logo ? '' : 'display:none')};margin-top:8px">
        <img src="${jscEscUrl(p.logo || '')}" style="max-width:120px;max-height:64px;object-fit:contain;border:1px solid #e0e0e0;border-radius:6px;padding:4px;background:#fff" />
      </div>
    </div>`,
    `<button class="btn-cancel" onclick="closeModal()">Cancelar</button>
     <button class="btn-save" onclick="saveEditPatrocinador(${id})">Guardar</button>`
  );
  setupImageUpload('mPLogoFile', 'mPLogo', 'mPLogoPreview');
};

window.saveEditPatrocinador = function (id) {
  const p = DB.patrocinadores.find(x => x.id === id);
  if (!p) return;
  p.nome    = document.getElementById('mPNome').value.trim() || p.nome;
  p.sector  = document.getElementById('mPSector').value.trim();
  p.desde   = String(document.getElementById('mPDesde').value);
  p.website = document.getElementById('mPWebsite').value.trim();
  p.logo    = document.getElementById('mPLogo').value.trim();
  // O tier que o registo já tivesse fica como está: não se apaga nem se
  // migra. Deixou apenas de ter efeito na publicação.
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

// Um mapa que volta do servidor pode chegar como [].
//
// O PHP codifica um mapa VAZIO como array: {"Sub-15":{}} sai da publicação como
// {"Sub-15":[]}. E em JavaScript escrever propriedades num array é legal e não
// dá erro, mas o JSON.stringify() descarta-as. O resultado, medido no painel do
// clube: adicionar uma série aos Sub-15 dizia «adicionada» em verde, a série
// existia em memória, o armazém ficava exactamente igual, e a lista continuava
// a dizer «Nenhuma equipa configurada» para sempre. Os Sub-17 funcionavam
// porque a sua entrada era um objecto.
//
// O caminho de entrada é o «Repor do servidor» e o «Importar backup», que
// escrevem o classConfig vindo da publicação. A raiz — o PHP a transformar {}
// em [] — é outro bloco; isto aqui é o que impede o painel de perder escritas.
function jscMapa(v) {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
}

// Converter um valor que não é mapa para {} é destrutivo se ele tiver algo lá
// dentro. Com os arrays vazios não há nada a perder — medido —, mas se algum dia
// chegar aqui um array com elementos, ou uma string, o original é guardado
// ANTES, numa chave de recuperação, e a consola di-lo. Uma só chave, escrita uma
// só vez: não se trocam escritas perdidas por chaves a crescer sem conta.
const JSC_CLASS_RECUPERAR = 'jsc_recuperar_fpf_sync_config';

function jscVazio(v) {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function loadClassConfig() {
  let bruto = null;
  let cru = null;
  try {
    bruto = localStorage.getItem(CLASS_CONFIG_KEY);
    cru = JSON.parse(bruto || '{}');
  } catch (e) { return {}; }

  // O que seria perdido pela conversão, se alguma coisa fosse.
  const perdas = [];
  const olhar = (onde, v) => {
    if (jscMapa(v) !== v && !jscVazio(v)) perdas.push(onde);
  };
  olhar('(raiz)', cru);
  if (jscMapa(cru) === cru) {
    Object.keys(cru).forEach((esc) => {
      olhar(esc, cru[esc]);
      if (jscMapa(cru[esc]) === cru[esc]
          && Object.prototype.hasOwnProperty.call(cru[esc], 'teams')) {
        olhar(esc + '.teams', cru[esc].teams);
      }
    });
  }
  if (perdas.length && bruto !== null) {
    try {
      if (localStorage.getItem(JSC_CLASS_RECUPERAR) === null) {
        localStorage.setItem(JSC_CLASS_RECUPERAR, bruto);
      }
    } catch (e) {}
    try {
      console.warn('[JSC] fpf_sync_config tinha valores que não são mapas em '
        + perdas.join(', ') + '. O original ficou em ' + JSC_CLASS_RECUPERAR + '.');
    } catch (e) {}
  }

  const cfg = jscMapa(cru);
  Object.keys(cfg).forEach((esc) => {
    cfg[esc] = jscMapa(cfg[esc]);
    // O teams só é normalizado se existir: criá-lo aqui punha um {} novo em
    // cada escalão, e um {} é exactamente o que volta do servidor como [].
    if (Object.prototype.hasOwnProperty.call(cfg[esc], 'teams')) {
      cfg[esc].teams = jscMapa(cfg[esc].teams);
    }
  });
  return cfg;
}

// Grava e CONFIRMA, relendo. Devolve true só quando o armazém ficou de facto
// com o que se quis gravar — e, se quem chama passar um 'confirmar', só quando
// esse teste também passa sobre o que se consegue voltar a ler.
//
// As duas verificações respondem a coisas diferentes. A releitura dos bytes
// apanha o armazém cheio e o armazém que não grava. O 'confirmar' apanha o que
// a releitura nunca apanharia: uma escrita descartada ANTES de chegar ao disco,
// como a das propriedades num array — aí os bytes relidos são iguais aos
// escritos, e o que falta é o dado.
function saveClassConfig(cfg, confirmar) {
  let bytes;
  try { bytes = JSON.stringify(cfg); } catch (e) { return false; }
  try { localStorage.setItem(CLASS_CONFIG_KEY, bytes); } catch (e) { return false; }
  try { if (localStorage.getItem(CLASS_CONFIG_KEY) !== bytes) return false; } catch (e) { return false; }
  if (typeof confirmar !== 'function') return true;
  try { return !!confirmar(loadClassConfig()); } catch (e) { return false; }
}

// A série existe na configuração relida?
function jscTemSerie(cfg, escalao, tk) {
  return !!(cfg && cfg[escalao] && cfg[escalao].teams && cfg[escalao].teams[tk]);
}

// Um escalão sem nada lá dentro não fica como mapa vazio: um {} volta da
// publicação como [], e um [] engole todas as escritas seguintes. Também se
// aplica ao teams, um nível mais fundo.
function jscArrumarEscalao(cfg, escalao) {
  const esc = cfg[escalao];
  if (!esc || jscMapa(esc) !== esc) return;
  if (Object.prototype.hasOwnProperty.call(esc, 'teams') && jscVazio(esc.teams)) delete esc.teams;
  if (Object.keys(esc).length === 0) delete cfg[escalao];
}

function teamStorageKey(escalao, teamKey, tipo) {
  // tipo: 'class' or 'jogos'
  const prefix = tipo === 'class' ? 'fpf_class_' : 'fpf_jogos_';
  return teamKey ? `${prefix}${escalao}__${teamKey}` : `${prefix}${escalao}`;
}

// ── Render sync rows ──────────────────────────────
// O botão «✎ Manual» do cabeçalho passava sempre a série vazia, escrita no
// markup, e abria fpf_class_<escalao> mesmo quando o escalão tem séries
// configuradas. Mas a página pública lê a série: o renderTeamSelector() põe o
// teamActivo na única série e esconde a barra, pelo que a resultados.html lê
// fpf_class_<escalao>__<série> e nada na interface o diz. Medido em produção e
// reproduzido: com uma série configurada, escrever a forma por este botão
// criava fpf_class_Sub-17 com uma linha "Sport Campinense" — um array paralelo
// que a página nunca lê — e a classificação pública continuava com 12 equipas
// e zero círculos de forma.
//
// Agora o botão segue a configuração: sem séries abre o escalão, com uma série
// abre essa série, e com várias não aparece — aí cada linha tem o seu «✎», e
// editar "o escalão" não quer dizer nada quando há duas tabelas. O
// abrirEditorClass(), o salvarEditorClass() e o teamStorageKey() ficam como
// estavam: a chave certa chega-lhes por aqui.
function renderClassSyncRows() {
  // A colagem, o editor manual e o apagar acabam todos aqui. O resumo da
  // Equipa Sénior lê a mesma chave fpf_class_Seniores, por isso refresca-se no
  // mesmo sítio, em vez de cada caminho se ter de lembrar dele. A função
  // devolve logo se a página sénior não estiver montada.
  if (typeof renderClassSeniorResumo === 'function') renderClassSeniorResumo();

  const tbody = document.getElementById('fpfSyncRows');
  if (!tbody) return;
  const cfg = loadClassConfig();

  let html = '';
  for (const escalao of CLASS_ESCALOES) {
    const escCfg   = cfg[escalao] || {};
    const teams    = escCfg.teams  || {};
    const teamKeys = Object.keys(teams);

    // Linhas da classificação do escalão — a que se cola sem escolher série.
    // Serve para decidir se o botão de apagar aparece: sem linhas não há nada
    // para apagar, e depois de apagar o botão desaparece sozinho.
    let nBase = 0;
    try {
      const b = JSON.parse(localStorage.getItem(teamStorageKey(escalao, '', 'class')) || '[]');
      nBase = Array.isArray(b) ? b.length : 0;
    } catch (e) {}

    const escLast = escCfg.lastSync
      ? `<span style="font-weight:400;font-size:0.7rem;opacity:0.8;margin-left:10px">últ. atualização: ${jscEsc(new Date(escCfg.lastSync).toLocaleDateString('pt-PT'))}${jscEsc(escCfg.nTeams ? ' ('+escCfg.nTeams+' eq.)' : '')}</span>`
      : '';
    html += `<tr style="background:var(--blue);color:#fff">
      <td colspan="4" style="padding:8px 14px;font-weight:700;letter-spacing:0.5px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span>${jscEsc(escalao)}${escLast}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" style="background:var(--yellow);color:#001b4d;border:none;font-weight:700"
            onclick="abrirColar('${escalao}','class','')">&#128203; Colar classificação</button>
          <button class="btn-sm" style="background:var(--yellow);color:#001b4d;border:none;font-weight:700"
            onclick="abrirColar('${escalao}','jogos','')">&#128197; Colar jogos</button>
          ${teamKeys.length <= 1 ? `<button class="btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)"
            onclick="abrirEditorClass('${escalao}','${teamKeys[0] || ''}')">&#9998; Manual</button>` : ''}
          ${nBase ? `<button class="btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3)"
            title="Apaga apenas a classificação do escalão (${jscEsc(teamStorageKey(escalao, '', 'class'))}), a que foi colada sem série. As séries, os jogos e os outros escalões não são afetados."
            onclick="apagarClassBase('${escalao}')">&#128465; Apagar classificação</button>` : ''}
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
          <td style="padding:8px 14px 8px 24px;font-weight:700">${jscEsc(t.nome || tk)}
            ${t.compLabel ? `<div style="font-size:0.72rem;color:#888;font-weight:400">${jscEsc(t.compLabel)}</div>` : ''}
          </td>
          <td style="padding:8px 14px;font-size:0.8rem;color:#555">
            <span style="color:#999;font-size:0.7rem">Classificação</span><br>${jscEsc(lastClass)}
          </td>
          <td style="padding:8px 14px;font-size:0.8rem;color:#555">
            <span style="color:#999;font-size:0.7rem">Jogos</span><br>${jscEsc(lastJogos)}
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
  const key = teamStorageKey(escalao, teamKey, 'class');
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
  if (!rows.length) rows = [{ equipa: 'Sport Campinense', j:0, v:0, e:0, d:0, gm:0, gs:0, forma:'' }];
  // As linhas tal como foram abertas ficam guardadas: o formulário só tem oito
  // campos, e o salvarEditorClass() funde o que se escreveu por cima delas. Sem
  // isto, o que não está no formulário era apagado — medido: abrir e guardar
  // sem tocar em nada perdia o logo, o pts, o pts1fase, o dg e qualquer campo
  // futuro, e na classificação pública o clube caía de 29 para 23 pontos, do
  // primeiro para o segundo lugar.
  _edClassCtx = { escalao, teamKey, originais: rows };

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

// Havia aqui um esc() local que trocava as aspas por &quot;, e o seu resultado
// ia depois pelo jscEsc() — que volta a escapar o & dessa entidade. Escape a
// dobrar, e só para nomes com aspas duplas: um & sozinho passava uma única vez e
// voltava bem, mas o &quot; introduzido pelo esc() virava &amp;quot;.
//
// E não era cosmético. O salvarEditorClass() lê o .value destes inputs e grava-o
// tal e qual; o browser descodifica as entidades do atributo, pelo que
//     Sporting "B"   ->  aparecia e ficava gravado como   Sporting &quot;B&quot;
// Medido em Chromium: com o escape a dobrar o campo mostrava a entidade à vista;
// com o jscEsc sozinho mostra as aspas.
//
// O jscEsc() faz tudo o que o esc() fazia e mais — escapa & < > " ' —, pelo que
// isto é mais seguro, não menos. O || '' mantém o que o esc() fazia com null e
// undefined: um campo vazio continua vazio.
// O segundo argumento vem de graça do rows.map(_edClassRowHTML) lá acima: é o
// índice da linha em _edClassCtx.originais, e é por ele que o guardar reencontra
// a linha de origem. Pelo índice e não pelo nome, porque o nome é justamente o
// que se edita neste formulário. As linhas criadas pelo botão "+ Adicionar
// equipa" chamam sem índice e ficam sem o atributo: não têm origem nenhuma.
// O campo Forma tinha placeholder="VVEDV" — uma sequência de forma válida. Um
// campo vazio aparecia com "VVEDV" em cinzento e lia-se como valor gravado: foi
// isto que nos levou três diagnósticos a perseguir uma perda de dados que não
// existia, até medir que input.value era "" e o VVEDV era a sugestão. O mesmo
// valia para o "0" da caixa dos pontos da 1ª fase. As sugestões passaram a ser
// inconfundíveis com um valor: "ex: VVEDV" e "—".
function _edClassRowHTML(t, i) {
  const num = (v) => v == null ? 0 : v;
  return `<tr${typeof i === 'number' ? ` data-idx="${jscEsc(i)}"` : ''}>
    <td><input class="form-input ed-equipa" value="${jscEsc(t.equipa || '')}" placeholder="Nome da equipa" style="min-width:170px"></td>
    <td><input class="form-input ed-j"  type="number" min="0" value="${jscEsc(num(t.j))}"  style="width:56px"></td>
    <td><input class="form-input ed-v"  type="number" min="0" value="${jscEsc(num(t.v))}"  style="width:56px"></td>
    <td><input class="form-input ed-e"  type="number" min="0" value="${jscEsc(num(t.e))}"  style="width:56px"></td>
    <td><input class="form-input ed-d"  type="number" min="0" value="${jscEsc(num(t.d))}"  style="width:56px"></td>
    <td><input class="form-input ed-gm" type="number" min="0" value="${jscEsc(num(t.gm))}" style="width:56px"></td>
    <td><input class="form-input ed-gs" type="number" min="0" value="${jscEsc(num(t.gs))}" style="width:56px"></td>
    <td><input class="form-input ed-forma" value="${jscEsc(t.forma || '')}" placeholder="ex: VVEDV" maxlength="5" style="width:76px;text-transform:uppercase"></td>
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

  const originais = _edClassCtx.originais || [];

  const rows = [];
  document.querySelectorAll('#edClassTable tbody tr').forEach(tr => {
    const g = (cls) => tr.querySelector('.' + cls);
    const equipa = g('ed-equipa').value.trim();
    if (!equipa) return;
    const n = (cls) => Math.max(0, parseInt(g(cls).value, 10) || 0);
    const forma = g('ed-forma').value.trim().toUpperCase().replace(/[^VED]/g, '').slice(0, 5);
    // A linha de origem, pelo data-idx. Apagar linhas não desalinha nada: o
    // índice vem do atributo, não da posição. Uma linha nova não tem origem,
    // e o base fica vazio — exactamente o que acontecia antes a todas.
    const idx  = tr.dataset.idx;
    const base = idx !== undefined && originais[idx] ? originais[idx] : {};
    // O logo, o pts1fase e qualquer campo que o formulário não edite passam
    // intactos por aqui.
    const linha = Object.assign({}, base, {
      equipa,
      j: n('ed-j'), v: n('ed-v'), e: n('ed-e'), d: n('ed-d'),
      gm: n('ed-gm'), gs: n('ed-gs'),
      forma,
      sc: /campinense/i.test(equipa),
    });
    // O abrev deriva do nome: só se recalcula se o nome mudou. Assim um "J.S"
    // vindo da colagem não passa a "JC" só por se abrir o editor.
    if (!base.abrev || base.equipa !== equipa) linha.abrev = _abrevEquipa(equipa);
    // O dg e o pts também derivam de campos que o formulário edita, e guardá-los
    // como estavam seria pior do que perdê-los: um pts antigo continuaria a
    // valer na página pública, que prefere o pts guardado quando é maior do que
    // V×3+E. Recalculam-se, e só nas linhas que já os usavam, para não
    // acrescentar campos a quem não os tinha. O pts1fase, esse, é dado próprio:
    // vem do base e é ele que entra na soma.
    if ('dg' in base)  linha.dg  = linha.gm - linha.gs;
    if ('pts' in base) linha.pts = linha.v * 3 + linha.e + (base.pts1fase || 0);
    rows.push(linha);
  });

  if (!rows.length) { showToast('Adicione pelo menos uma equipa', 'red'); return; }

  const key = teamStorageKey(escalao, teamKey, 'class');
  localStorage.setItem(key, JSON.stringify(rows));

  // Registar data de atualização para o badge "última sincronização"
  const cfg = loadClassConfig();
  const marca = new Date().toISOString();
  if (teamKey) {
    cfg[escalao] = cfg[escalao] || {};
    cfg[escalao].teams = cfg[escalao].teams || {};
    cfg[escalao].teams[teamKey] = cfg[escalao].teams[teamKey] || { nome: teamKey };
    cfg[escalao].teams[teamKey].lastSync = marca;
    cfg[escalao].teams[teamKey].nTeams   = rows.length;
  } else {
    cfg[escalao] = cfg[escalao] || {};
    cfg[escalao].lastSync = marca;
    cfg[escalao].nTeams   = rows.length;
  }
  // A classificação em si já está gravada na sua própria chave, acima: o que
  // pode faltar é a marca de data. Por isso a mensagem distingue as duas
  // coisas, em vez de dizer verde a tudo ou vermelho a tudo.
  const marcou = saveClassConfig(cfg, (c) => (teamKey
    ? c[escalao] && c[escalao].teams && c[escalao].teams[teamKey]
      && c[escalao].teams[teamKey].lastSync === marca
    : c[escalao] && c[escalao].lastSync === marca));

  closeModal();
  renderClassSyncRows();
  showToast(`Classificação de ${escalao} guardada (${rows.length} equipas)`
    + (marcou ? '' : ' — a data de atualização não ficou registada'),
    marcou ? 'green' : 'red');
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
  // O verde só sai se a série estiver lá quando se volta a ler. Antes saía
  // sempre que não houvesse excepção, e era isso que tornava invisível a perda
  // dos Sub-15: mensagem de sucesso, armazém igual.
  const gravou = saveClassConfig(cfg, (c) => jscTemSerie(c, escalao, tk));
  renderClassSyncRows();
  if (!gravou) {
    showToast(`${escalao}: NÃO foi possível guardar "${nome.trim()}" — nada foi alterado`, 'red');
    alert(`A série "${nome.trim()}" não ficou guardada em ${escalao}.\n\n`
      + `O armazém deste browser está como estava. Pode ser falta de espaço, ou a\n`
      + `configuração das séries estar num formato que o painel não consegue escrever.\n`
      + `Nada foi apagado: as classificações e os jogos não foram tocados.`);
    return;
  }
  showToast(`${escalao}: "${nome.trim()}" adicionada`, 'green');
};

window.limparEquipa = function(escalao, tk) {
  const cfg  = loadClassConfig();
  const nome = cfg[escalao]?.teams?.[tk]?.nome || tk;
  if (!confirm(`Remover "${nome}" (${escalao})? Todos os dados serão apagados.`)) return;

  // A configuração primeiro, e só se ela ficou gravada é que os dados saem.
  // Ao contrário era possível apagar a classificação e os jogos da série e a
  // linha continuar na lista, por a gravação da configuração não ter pegado:
  // dados apagados, nada removido, e um verde a dizer que correu bem.
  if (cfg[escalao]?.teams) delete cfg[escalao].teams[tk];
  jscArrumarEscalao(cfg, escalao);
  const gravou = saveClassConfig(cfg, (c) => !jscTemSerie(c, escalao, tk));
  if (!gravou) {
    renderClassSyncRows();
    showToast(`${escalao}: NÃO foi possível remover "${nome}" — nada foi apagado`, 'red');
    return;
  }
  localStorage.removeItem(teamStorageKey(escalao, tk, 'class'));
  localStorage.removeItem(teamStorageKey(escalao, tk, 'jogos'));
  renderClassSyncRows();
  showToast(`${escalao}: "${nome}" removida`, 'green');
};

// ── Apagar a classificação do escalão (a que se cola sem série) ──────────
//
// O ✕ de apagar só existia dentro do ciclo das séries: com zero séries o ciclo
// não corre, sai a linha «Nenhuma equipa configurada» e não havia caminho
// nenhum na interface para apagar uma classificação de escalão. Medido no
// painel: o Sub-15 mostrava «últ. atualização: 12/10/2026 (11 eq.)» de uma
// colagem antiga, e nada que a tirasse de lá.
//
// Grava-se [] em vez de remover a chave, e isto é deliberado. O js/sync.js
// escreve as chaves que vêm no classData da publicação e nunca remove as que
// deixaram de vir: uma chave removida desaparece do data/db.json, os visitantes
// novos ficam limpos, mas quem já visitou o site fica com a tabela antiga no
// localStorage para sempre. Com [] a chave viaja na publicação e substitui a
// cópia de todos. O preço é uma chave vazia residual no db.json, que o
// getDados() da resultados.html lê como zero linhas.
//
// A alternativa — o js/sync.js apagar o que não vem na publicação — é o espelho
// dos defeitos corrigidos em 12b0b76 e 677c74b: um painel que publique sem uma
// chave passaria a apagá-la a todos. Fica de fora.
//
// Ao contrário do limparEquipa(), isto não toca nos jogos: só na chave da
// classificação do escalão.
window.apagarClassBase = function (escalao) {
  const key = teamStorageKey(escalao, '', 'class');
  let n = 0;
  try {
    const atual = JSON.parse(localStorage.getItem(key) || '[]');
    n = Array.isArray(atual) ? atual.length : 0;
  } catch (e) {}
  if (!n) { showToast(`${escalao}: não há classificação de escalão para apagar`, 'red'); return; }

  const cfg    = loadClassConfig();
  const series = Object.keys(cfg[escalao]?.teams || {});
  if (!confirm(
    `Apagar a classificação de ${escalao} (${n} equipas), a que foi colada sem série?\n\n`
    + `Só é apagada a chave ${key}.\n`
    + (series.length ? `As séries configuradas (${series.length}) NÃO são afetadas.\n` : '')
    + `Os jogos NÃO são afetados.\n`
    + `Os outros escalões NÃO são afetados.\n\n`
    + `A eliminação só chega ao site público depois de Publicar.`
  )) return;

  localStorage.setItem(key, '[]');
  const escCfg = cfg[escalao] || (cfg[escalao] = {});
  delete escCfg.lastSync;   // só o nível base: o teams e cada série ficam intactos
  delete escCfg.nTeams;
  // E o escalão não fica como mapa vazio. Era isto que punha "Sub-15": {} na
  // publicação; o PHP devolvia-o como [] e o painel passava a perder em
  // silêncio tudo o que se escrevesse nesse escalão.
  jscArrumarEscalao(cfg, escalao);
  const gravou = saveClassConfig(cfg,
    (c) => !(c[escalao] && (c[escalao].lastSync || c[escalao].nTeams)));
  renderClassSyncRows();
  if (!gravou) {
    showToast(`${escalao}: a classificação foi apagada, mas a configuração não ficou gravada`, 'red');
    return;
  }
  showToast(`${escalao}: classificação apagada — publique para o site público`, 'green');
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
  if (seq.length >= 8 && seq[0] === rowCount + 1) {
    seq = seq.slice(1);
  } else if (!ptsFirst && seq.length >= 8 && seq[0] >= 1 && seq[0] <= 30) {
    // A posição só era retirada quando coincidia com "as linhas aceites até
    // agora + 1". Perdida uma linha — a AABV —, a seguinte trazia a posição 8
    // com o contador em 6, a posição ficava na sequência, a leitura J-primeiro
    // falhava a sanidade e o recurso "Pts primeiro" lia a POSIÇÃO como pontos.
    // Medido: AEF Faro com 8 pontos, Ginásio de Tavira com 9, Montenegro com
    // 10, Ferreiras com 11 — as posições de cada uma.
    //
    // Agora decide-se pelo próprio conteúdo: retira-se o primeiro número
    // quando a leitura SEM ele é coerente (J = V+E+D) e a leitura COM ele não
    // é. Se as duas forem plausíveis, não se mexe — sem heurística a decidir
    // por nós. E não se aplica quando o cabeçalho disse "Pts primeiro", onde o
    // primeiro número é mesmo os pontos.
    const coerente = (x) => x.length >= 7 && Math.abs(x[0] - (x[1] + x[2] + x[3])) <= 2;
    const semPosicao = seq.slice(1);
    if (coerente(semPosicao) && !coerente(seq)) seq = semPosicao;
  }
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

// O mesmo, mas sem recusar duas a quatro maiúsculas.
//
// O _isNameWord() recusa-as porque na forma em bloco a sigla da coluna vem ao
// lado do nome — "OLH  Olhanense" — e sem essa recusa o nome sairia "OLH
// Olhanense". Mas há clubes cujo nome É quatro maiúsculas: a AABV, 7.ª da Liga
// 1 do Algarve, desaparecia da colagem. Medido: a pré-visualização dizia 11
// equipas em 12, e a partir daí os pontos de todas as seguintes passavam a ser
// a POSIÇÃO delas, porque a posição deixava de ser retirada da sequência.
//
// Este ajudante usa-se só onde o contexto já provou que não há outro candidato
// a nome: numa linha tabular sem nenhuma palavra de nome, ou numa linha
// isolada de maiúsculas que não é seguida por um nome.
function _isNameWordSozinho(p) {
  if (!p) return false;
  if (/^[-+]?\d+$/.test(p)) return false;
  if (/^[\u{1F1E0}-\u{1F1FF}]{2}/u.test(p)) return false;
  if (/^\[img:/.test(p)) return false;
  return p.replace(/[^a-zA-ZÀ-ž0-9\s\-\.]/g, '').trim().length > 1;
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
  for (let iLinha = 0; iLinha < lines.length; iLinha++) {
    const line = lines[iLinha];
    // Standalone position number (1–30) → hold for the next team line
    if (/^\d{1,2}$/.test(line) && parseInt(line) <= 30) {
      pendingPos = parseInt(line); pendingName = ''; continue;
    }
    // Standalone [img:...] → hold logo for the next team line
    if (/^\[img:https?:\/\//.test(line)) {
      pendingLogo = line.slice(5, -1); continue;
    }
    // Standalone team abbreviation (SLB, SCP...) → ignore, keep pendings
    //
    // Só é sigla se o contexto o provar: a seguir tem de vir o nome, numa
    // linha de texto. Sem essa prova, estas maiúsculas são o próprio nome —
    // é o caso da AABV — e saltá-las fazia desaparecer a equipa.
    if (/^[A-ZÁÉÍÓÚ]{2,4}$/.test(line)) {
      const seguinte = lines[iLinha + 1] || '';
      if (_isNameWord(seguinte) && !/^\[img:/.test(seguinte)) continue;
      if (pendingPos !== null && !pendingName) pendingName = line;
      continue;
    }

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

    let nameIdx = parts.findIndex(_isNameWord);
    // Nenhuma palavra de nome, mas uma única parte textual na linha? Então é
    // ela o nome: é assim que a AABV entra, sem tocar nas linhas onde a sigla
    // vem ao lado do nome, que têm duas partes textuais e já encontram nome.
    if (nameIdx < 0 && !pendingName) {
      const textuais = parts.filter(_isNameWordSozinho);
      if (textuais.length === 1) nameIdx = parts.indexOf(textuais[0]);
    }
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
    // TODO: a mesma armadilha da sigla que se corrigiu na Estratégia 1 continua
    // aqui, e esta estratégia tem ainda a sua própria exigência de posições
    // sequenciais (lines[i] === rows.length + 1), pelo que uma linha perdida
    // dessincroniza o resto. Medido: a tabela de 12 equipas colada um valor por
    // linha dá 6 equipas, perdendo tudo a partir da AABV. Fica para bloco
    // próprio, por decisão do Nélio: a forma tabular é a que ele usa.
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
  const junkRe = /^(jogos|calendário|resultados|jornada|época|competição|equipa|©|filtrar|anterior|próximo|zerozero|h2h)/i;
  // Onde acabou o último bloco aceite. É a terceira prova de que uma data
  // abre um bloco — ver o comentário das provas, mais abaixo: numa lista do
  // ZeroZero sem resultado (jogos por disputar) não há separador nenhum, e a
  // linha antes da data é a última linha do jogo anterior, que não é data,
  // hora nem resultado. Medido: numa lista de cinco jogos por disputar só o
  // primeiro era reconhecido, e os outros quatro desapareciam em silêncio.
  let fimAnterior = -1;
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
    // O resultado ou o separador entre as duas equipas é a primeira das duas
    // provas de que esta data abre um bloco deste formato. Guarda-se.
    let separador = false;
    if (j < lines.length) {
      const sc = parseScore(lines[j]);
      if (sc) { score = sc; separador = true; j++; }
      else if (/^[-–]$/.test(lines[j].trim())) { separador = true; j++; } // separator
    }
    // away team
    if (j < lines.length && !parseDate(lines[j]) && !parseScore(lines[j]) && !parseTime(lines[j]) && !junkRe.test(lines[j])) {
      fora = lines[j].trim(); j++;
    }
    if (!casa || !fora || casa === fora) continue;

    // ---- O bloco é mesmo deste formato? --------------------------------
    // Este parser assume que a data ABRE o bloco: data, [hora], casa,
    // resultado ou «–», fora. O despacho oferece-lhe sempre a colagem
    // primeiro, e o passo do resultado era opcional — bastava a linha
    // seguinte não ser data, hora nem resultado para ser aceite como equipa.
    //
    // Resultado, medido: numa colagem do AF Algarve, que tem a casa ANTES da
    // data (casa, data, hora, fora, recinto), este parser lia a visitante como
    // casa e o RECINTO como visitante — "casa=TESTE SILVES,
    // fora=Estádio Municipal de Silves" — e a equipa da casa desaparecia. Sem
    // recinto não havia linha para ler e o bloco era recusado, pelo que só as
    // colagens COM recinto eram roubadas. O parseMultiLineJogos() lê essas
    // formas corretamente, incluindo o recinto.
    //
    // Exige-se agora uma de duas provas, e chega uma:
    //   1. houve resultado ou separador entre as duas equipas — existe sempre
    //      numa linha do ZeroZero e nunca na forma do AF Algarve;
    //   2. a data abre o bloco: não tem nada antes, ou o que tem é data, hora,
    //      resultado ou um cabeçalho já reconhecido pelo junkRe.
    //
    // Medido nas treze formas de colagem da matriz: as seis do ZeroZero
    // continuam aceites — incluindo a que não tem separador, que a segunda
    // prova salva — e as sete do AF Algarve passam todas para o
    // parseMultiLineJogos(). Sem as duas provas, a forma sem separador deixava
    // de ser reconhecida por ninguém.
    const antes = i > 0 ? lines[i - 1].trim() : '';
    const abreBloco = !antes || !!parseDate(antes) || !!parseTime(antes)
                   || !!parseScore(antes) || junkRe.test(antes);
    // A terceira prova: esta data é a linha logo a seguir ao fim do bloco
    // anterior deste mesmo parser. É estrutural e não se confunde com a forma
    // do AF Algarve, onde a primeira data nunca é aceite e portanto nunca há
    // bloco anterior de onde continuar.
    const continuaDoAnterior = (i === fimAnterior);
    if (!separador && !abreBloco && !continuaDoAnterior) continue;

    jogos.push({ id: next(), casa, fora, gcasa: score?.gcasa ?? null, gfora: score?.gfora ?? null,
      data: d, hora, local: '', estado: score ? 'Realizado' : 'Agendado' });
    fimAnterior = j;
  }
  return jogos;
}

// Uma equipa que a colagem não conseguiu nomear.
//
// O token [img:...] de um escudo desconhecido era substituído por NADA, a
// linha ficava vazia, desaparecia no filtro, e a primeira linha utilizável a
// seguir passava a ser a equipa. Medido na página de jogos do ZeroZero, onde
// essa linha é o «h2h» da ligação aos confrontos directos: 24 dos 29 jogos
// dos seniores ficaram com casa="h2h" ou fora="h2h".
//
// Passa a ficar esta marca, que ocupa o lugar e não se confunde com um clube:
// o jogo entra com o lado certo, fica assinalado em revisao e a ferramenta de
// revisão dos seniores põe-lhe o nome verdadeiro. As páginas públicas não a
// desenham, como já não desenhavam o «h2h».
const JSC_POR_IDENTIFICAR = 'Adversário por identificar';

// Etiquetas de ligação das tabelas do ZeroZero. Não são equipas, não são
// recintos, e saem antes de qualquer parser as ver — como as linhas de
// competição. O «h2h» é o caso medido; os outros acompanham-no porque são a
// mesma coisa noutra coluna.
const JSC_LINHA_LIGACAO = /^(h2h|ficha|ficha do jogo|ver ficha|detalhes|comparar|estat[íi]sticas)$/i;

// Um nome que não identifica ninguém: o «h2h» que ficou gravado nos 24 jogos
// e a marca que o importador passa a usar no lugar dele.
function _jscPorIdentificar(nome) {
  const t = String(nome == null ? '' : nome).trim().toLowerCase();
  return t === 'h2h' || t === JSC_POR_IDENTIFICAR.toLowerCase();
}

function _jscEhClube(nome) {
  return /campinense/i.test(String(nome == null ? '' : nome));
}

// O adversário de um jogo do clube. Devolve vazio quando os dois lados são o
// clube ou nenhum o é — aí não há «o adversário» e nada se decide por ele.
function _jscAdversarioDe(j) {
  if (!j) return '';
  const casa = String(j.casa || '').trim(), fora = String(j.fora || '').trim();
  const cCasa = _jscEhClube(casa), cFora = _jscEhClube(fora);
  if (cCasa === cFora) return '';
  return cCasa ? fora : casa;
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
    return JSC_POR_IDENTIFICAR;
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

// ── Linhas de competição: nunca são equipas nem recintos ─────────────────
//
// O AF Algarve escreve o nome da competição em linha própria no meio da lista
// — "AF Algarve Juniores C 1ª Divisão 1ª Fase 2026/27" — e nenhum parser a
// conhecia. O junkRe do parseZZJogos só recusa linhas que COMECEM por
// "jornada", "competição" e companhia, e esta começa por "AF Algarve"; o
// parseMultiLineJogos lê a linha pela posição relativa à data e não filtra
// nada. Medido: o texto da competição ficava em fora, e noutra forma em local.
//
// E o "C" de "Juniores C" não é um marcador de casa: o _marcaLadoDe() exige
// parênteses, pelo que já não o lia, e esta função garante que a linha também
// nunca chega lá.
//
// Reconhece-se por duas provas independentes, para um nome de clube nunca
// entrar aqui por acidente. "Juventude Sport Campinense" não tem nenhuma.
const JSC_PROVAS_COMPETICAO = [
  /\baf\s+algarve\b/i,
  /\bassocia[çc][ãa]o\s+de\s+futebol\b/i,
  /\b\d+\s*[ªaº°]?\s*(divis[ãa]o|fase)\b/i,
  /\b(campeonato|ta[çc]a|superta[çc]a|liga)\b/i,
  /\b20\d{2}\s*\/\s*\d{2,4}\b/,
  /\b(juniores|juvenis|iniciados|infantis|benjamins|traquinas|petizes)\b/i,
  /\bs[ée]rie\s+[A-Z0-9]\b/i,
  /\bdistrital|nacional\b/i,
];

// Um CAMPO que é texto de competição: "AF Algarve Juniores C 1ª Divisão 1ª
// Fase 2026/27". Duas provas independentes, para um nome de clube nunca entrar
// aqui por acidente.
function _ehTextoDeCompeticao(valor) {
  const t = String(valor == null ? '' : valor).trim();
  if (t.length < 8) return false;                       // "Liga" sozinho não é
  if (parseDate(t) || parseTime(t) || parseScore(t)) return false;
  let provas = 0;
  for (const re of JSC_PROVAS_COMPETICAO) if (re.test(t)) provas++;
  return provas >= 2;
}

// Uma LINHA inteira que é só o título da competição, e por isso pode sair da
// colagem antes de qualquer parser a ver.
//
// Tem de ser mais exigente do que o campo: a linha de um jogo do ZeroZero
// traz a competição lá dentro — "D  2026-10-11  11:00  (F)  Ginásio de Tavira
// Ginásio de Tavira  4-2  AF Algarve Juniores C 1ª Divisão 1ª Fase 2026/27
// J3" — e a primeira versão desta função apagava a linha do jogo inteira.
// Medido com as três linhas reais: nenhum jogo era reconhecido. Uma linha que
// tenha em si uma data, uma hora ou um resultado é uma linha de dados, não um
// cabeçalho.
function _ehLinhaDeCompeticao(linha) {
  const t = String(linha == null ? '' : linha).trim();
  if (!_ehTextoDeCompeticao(t)) return false;
  const campos = _camposDaLinha(t);
  if (campos.length > 2) return false;                  // linha com estrutura de dados
  for (const c of campos) if (parseDate(c) || parseTime(c) || parseScore(c)) return false;
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(t)) return false;     // data ISO em qualquer sítio
  if (/\b\d{1,2}[h:]\d{2}\b/.test(t)) return false;       // hora em qualquer sítio
  if (/(^|\s)\d{1,3}\s*[-–]\s*\d{1,3}(\s|$)/.test(t)) return false;  // resultado
  return true;
}

// Os campos de uma linha colada: tabulações, ou " | " quando a fonte usa
// barras, ou dois espaços ou mais.
function _camposDaLinha(linha) {
  const t = String(linha == null ? '' : linha);
  if (t.indexOf('\t') !== -1) return t.split('\t').map((p) => p.trim());
  if ((t.match(/\|/g) || []).length >= 2) return t.split('|').map((p) => p.trim());
  return t.split(/\s{2,}/).map((p) => p.trim());
}

// ── (C) e (F): a marca do lado em que o clube joga ───────────────────────
//
// O AF Algarve publica o calendário do clube com (C) quando o clube joga em
// casa e (F) quando joga fora, colado ao nome. Nenhum dos quatro parsers a
// tratava, e medido na sonda das dez formas o estrago era triplo:
//   1. a marca ficava no nome — "Silves (F)" nunca bate com a chave do
//      db_logos e é isso que o visitante lê;
//   2. com (F) na casa, os lados ficavam trocados: o clube jogava fora e era
//      gravado como equipa da casa;
//   3. nos realizados o resultado invertia-se com eles — um 0-2 fora passava a
//      ler-se como derrota em casa.
// E quando a fonte escreve só a marca, sem repetir o nome, o campo ficava
// "(F)" e o nome do clube desaparecia: são os 19 registos de Classe B que
// medimos nos 22 jogos sem série.
//
// A marca diz o lado da equipa do campo onde está: (C) na casa confirma, (F)
// na casa quer dizer que essa equipa joga fora. Serve para as duas leituras da
// fonte — a marca no clube e a marca em cada uma das duas equipas — porque em
// ambas descreve o lado de quem a traz. Duas marcas iguais são contraditórias
// e não decidem nada: tiram-se e os lados ficam como vieram.
//
// Nada se inventa: o nome só se reconstrói onde a marca estava sozinha, e o
// adversário, a data, a hora e o recinto vêm intactos da colagem.
const JSC_MARCA_LADO = /\(\s*[CF]\s*\)/ig;

function _nomeDoClube() {
  try {
    const d = JSON.parse(localStorage.getItem('dados_clube') || '{}');
    if (d && typeof d.nome === 'string' && d.nome.trim()) return d.nome.trim();
  } catch (e) {}
  return 'Juventude Sport Campinense';
}

function _semMarcaLado(s) {
  return String(s == null ? '' : s).replace(JSC_MARCA_LADO, '').replace(/\s{2,}/g, ' ').trim();
}

function _marcaLadoDe(s) {
  const m = String(s == null ? '' : s).match(/\(\s*([CF])\s*\)/i);
  return m ? m[1].toUpperCase() : '';
}

function _aplicarMarcasCasaFora(jogos) {
  const clube  = _nomeDoClube();
  const ehClube = (x) => /campinense/i.test(x || '');
  const saida = [];
  for (const j of jogos) {
    // Rede de segurança: o filtro do parsePastedJogos já tirou as linhas de
    // competição, mas se alguma chegar aqui num campo de equipa o jogo não é
    // de confiança — guardá-lo punha o nome de uma competição onde devia
    // estar um clube, à vista do visitante. No recinto limpa-se e segue.
    if (_ehTextoDeCompeticao(j.casa) || _ehTextoDeCompeticao(j.fora)) continue;
    if (_ehTextoDeCompeticao(j.local)) j.local = '';
    const mCasa = _marcaLadoDe(j.casa), mFora = _marcaLadoDe(j.fora);
    // A marca pode ter vindo sozinha na linha do recinto, e aí o
    // _localDeJogo() já a descartou — e bem, porque não é um recinto. O parser
    // guarda-a neste campo transitório para não se perder o lado, e ele morre
    // aqui: nunca chega ao db_jogos.
    const mLocal = _marcaLadoDe(j.local) || j._marcaLocal || '';
    delete j._marcaLocal;
    if (!mCasa && !mFora && !mLocal) { saida.push(j); continue; }

    // A marca nunca fica em casa, fora ou local.
    j.casa  = _semMarcaLado(j.casa);
    j.fora  = _semMarcaLado(j.fora);
    j.local = _semMarcaLado(j.local);

    // Campo que era só a marca: a marca diz que a linha é a do clube.
    if (!j.casa && mCasa) j.casa = clube;
    if (!j.fora && mFora) j.fora = clube;

    let trocar = false;
    if (mCasa && mFora) {
      if (mCasa === 'F' && mFora === 'C') trocar = true;    // os dois concordam: estão trocados
    } else if (mCasa) {
      trocar = mCasa === 'F';
    } else if (mFora) {
      trocar = mFora === 'C';
    } else if (mLocal) {
      // A marca ficou no recinto. Refere-se ao clube, e só decide quando o
      // clube está identificado por nome num dos dois campos e no outro não.
      if (ehClube(j.casa) && !ehClube(j.fora))      trocar = mLocal === 'F';
      else if (ehClube(j.fora) && !ehClube(j.casa)) trocar = mLocal === 'C';
    }

    if (trocar) {
      const c = j.casa; j.casa = j.fora; j.fora = c;
      if (j.estado === 'Realizado') { const g = j.gcasa; j.gcasa = j.gfora; j.gfora = g; }
    }

    // Sem os dois nomes não há jogo: acontece quando os dois campos eram só a
    // marca, e aí não há nada por onde reconstruir o adversário.
    if (!j.casa || !j.fora || j.casa.toLowerCase() === j.fora.toLowerCase()) continue;
    // Um lado por identificar não impede o jogo de entrar — a data, a hora e
    // o lado do clube são bons e perdê-los seria pior. Fica a marca, e é por
    // ela que a ferramenta de revisão o encontra.
    if (j.casa === JSC_POR_IDENTIFICAR || j.fora === JSC_POR_IDENTIFICAR) j.revisao = true;
    saida.push(j);
  }
  return saida;
}

function parsePastedJogos(text) {
  // Substituir tokens [img:...] pelos nomes das equipas (via classificação importada)
  text = _resolveImgTeamTokens(text);
  // As linhas de competição saem aqui, antes de qualquer parser as ver: assim
  // não são consumidas como equipa nem como recinto, e os blocos ficam com a
  // forma que os parsers esperam — o adversário, o clube, o resultado, a hora
  // e o recinto continuam todos lá.
  const raw = text.split('\n').map(l=>l.trim()).filter(Boolean)
    .filter(l => !_ehLinhaDeCompeticao(l))
    // E as etiquetas de ligação, pela mesma razão: o «h2h» era lido como o
    // nome da equipa visitante sempre que a linha do adversário não tinha
    // texto. Sai aqui, uma vez, para os quatro parsers.
    .filter(l => !JSC_LINHA_LIGACAO.test(l));
  const idBase = { v: Date.now() };
  const next = () => idBase.v++;
  // ZeroZero detection: date lines (DD/MM/YYYY or "22 mar 2026") followed by team names on separate lines
  const dateFirstLines = raw.filter((l,i) => parseDate(l) && !parseScore(l) && /^\d{1,2}/.test(l) && i+1<raw.length && !parseDate(raw[i+1]) && !parseScore(raw[i+1]));
  if (dateFirstLines.length > 0) {
    const zzResult = parseZZJogos(raw, next);
    if (zzResult.length > 0) return _attachJogoLogos(_aplicarMarcasCasaFora(zzResult));
  }
  const dateOnlyLines = raw.filter(l=>/^\d{1,2}\s+[A-Za-zÀ-ž]{3,}(\s+\d{4})?$/.test(l)&&parseDate(l));
  if (dateOnlyLines.length > 0) return _attachJogoLogos(_aplicarMarcasCasaFora(parseMultiLineJogos(raw, next)));
  return _attachJogoLogos(_aplicarMarcasCasaFora(parseSingleLineJogos(raw, next)));
}

// Cabeçalhos e rodapés que aparecem no meio de uma lista de jogos colada.
const JSC_CABECALHO_LISTA = /^(jornada|jorn\.|classificação|classificacao|calendário|calendario|resultados|época|epoca|competição|competicao|fase|série|serie|grupo)\b/i;
// Palavras por que um recinto começa. Serve só onde não há estrutura para
// validar — no último jogo da colagem —, e nunca para recusar no meio da lista.
const JSC_PALAVRA_RECINTO = /^(estádio|estadio|campo|complexo|parque|pavilhão|pavilhao|polidesportivo|centro|zona|municipal|relvado|sintético|sintetico)\b/i;

// O local de um jogo só se grava com evidência de que a linha é um recinto.
//
// O parseMultiLineJogos() tomava lines[d+3] sempre que não conseguia provar que
// essa linha pertencia ao jogo seguinte. Medido, gravava três classes de lixo:
// o nome da equipa do próprio jogo (o "Silves … Silves" que se via nos
// cartões), um cabeçalho de jornada ou um rodapé, e — a pior — o nome da equipa
// do jogo SEGUINTE, que não é uma repetição visível, é o nome de outro clube
// atribuído a este jogo.
//
// Em caso de dúvida fica vazio: a página não mostra nada e ninguém é induzido
// em erro. O campo local do db_jogos e o parser dos jogos ficam como estão.
function _localDeJogo(bruto, casa, fora, nomesDeEquipa, ehUltimoDaLista) {
  const local = (bruto || '').trim();
  // As rejeições de sempre, agora também aqui e não só na apresentação.
  if (local.length <= 2) return '';
  if (/^[A-ZÁÉÍÓÚ]{2,4}$/.test(local)) return '';
  if (parseDate(local) || parseTime(local) || parseScore(local)) return '';
  // As comparações correm sem a marca do lado: nesta altura os nomes ainda a
  // trazem, e "Silves" contra "Silves (C)" não batia — o nome da equipa voltava
  // a entrar como recinto, que é exatamente o que este guarda existe para
  // impedir. Medido na sonda das marcas.
  const baixo = _semMarcaLado(local).toLowerCase();
  // Igual a uma das equipas deste jogo.
  if (baixo === _semMarcaLado(casa).toLowerCase()) return '';
  if (baixo === _semMarcaLado(fora).toLowerCase()) return '';
  // Igual ao nome de qualquer equipa desta colagem — resolve a casa do jogo
  // seguinte, que entrava quando havia uma linha a mais entre blocos.
  if (nomesDeEquipa && nomesDeEquipa.has(baixo)) return '';
  // Cabeçalho ou rodapé da lista.
  if (JSC_CABECALHO_LISTA.test(local)) return '';
  // No último jogo não há próxima data para provar que a linha sobra deste
  // bloco: aí exige-se que pareça um recinto. No meio da lista a estrutura já
  // prova, e mantém-se permissivo — um recinto com nome fora desta lista de
  // palavras continua a entrar.
  if (ehUltimoDaLista && !JSC_PALAVRA_RECINTO.test(local)) return '';
  return local;
}

function parseMultiLineJogos(lines, next) {
  const jogos = [];
  const dateIdxs = [];
  for (let i=0;i<lines.length;i++) { if(parseDate(lines[i])&&/^\d{1,2}[\s\/\-]/.test(lines[i])) dateIdxs.push(i); }
  // Primeira passagem: todos os nomes de equipa desta colagem. A casa é a linha
  // antes da data e a visitante a segunda depois.
  const nomesDeEquipa = new Set();
  for (const d of dateIdxs) {
    if (d < 1 || d + 2 >= lines.length) continue;
    // Com e sem a marca do lado: o _localDeJogo() compara sem ela, e uma
    // equipa que venha como "Silves (C)" tem de ser reconhecida quando a linha
    // do recinto diz só "Silves".
    nomesDeEquipa.add(lines[d-1].trim().toLowerCase());
    nomesDeEquipa.add(lines[d+2].trim().toLowerCase());
    nomesDeEquipa.add(_semMarcaLado(lines[d-1]).toLowerCase());
    nomesDeEquipa.add(_semMarcaLado(lines[d+2]).toLowerCase());
  }
  for (const d of dateIdxs) {
    if(d<1||d+2>=lines.length) continue;
    const home=lines[d-1].trim(), dateStr=parseDate(lines[d]), mid=lines[d+1].trim(), away=lines[d+2].trim(), venueRaw=lines[d+3]||'';
    const timeObj=parseTime(mid), scoreObj=!timeObj?parseScore(mid):null;
    if(parseDate(home)||parseDate(away)||parseTime(home)||parseScore(home)) continue;
    const nextDateIdx=dateIdxs.find(i=>i>d);
    const venueIsGame=nextDateIdx!==undefined&&nextDateIdx<=d+4;
    const local = venueIsGame ? '' : _localDeJogo(venueRaw, home, away, nomesDeEquipa, nextDateIdx === undefined);
    const marcaLocal = _marcaLadoDe(venueRaw);
    const jogo = { id:next(),casa:home,fora:away,gcasa:scoreObj?scoreObj.gcasa:null,gfora:scoreObj?scoreObj.gfora:null,data:dateStr,hora:timeObj||'15:00',local,estado:scoreObj?'Realizado':'Agendado' };
    if (marcaLocal) jogo._marcaLocal = marcaLocal;
    jogos.push(jogo);
  }
  return jogos;
}

// ── A linha de jogo do ZeroZero, com o marcador do lado ──────────────────
//
// Forma real, medida na colagem do ZeroZero (campos separados por tabulação):
//
//   D  2026-10-11  11:00  (F)  Ginásio de Tavira  Ginásio de Tavira  4-2
//   AF Algarve Juniores C 1ª Divisão 1ª Fase 2026/27  J3
//
// Nove campos: a letra da forma (V/E/D), a data, a hora, o marcador do lado,
// o adversário, o adversário outra vez normalizado, o resultado, a competição
// e a jornada. O parseSingleLineJogos genérico lia o adversário como casa e a
// COMPETIÇÃO como visitante — é a origem dos 3 registos de Classe C dos 22
// jogos Sub-17 sem série —, e nos agendados punha o adversário no local.
//
// Aqui o lado não se troca: atribui-se. (C) é o clube em casa, (F) é o clube
// fora, e o resultado do ZeroZero já vem na ordem casa-fora, pelo que NÃO é
// invertido. Isto é diferente da forma do AF Algarve, em que o marcador vem
// colado ao nome de cada equipa e a troca de lados arrasta os golos.
//
// A competição e a jornada saem; o adversário repetido conta uma vez; e o
// local só se grava se houver um recinto explícito — o adversário nunca serve
// de local, e em dúvida fica vazio.
function _jogoDeLinhaZZ(parts, next) {
  const soMarca = (x) => /^\(\s*([CF])\s*\)$/i.exec(String(x == null ? '' : x).trim());
  let marca = '';
  const restantes = [];
  let dataStr = null, horaStr = null, score = null;
  for (const p of parts) {
    const m = soMarca(p);
    if (m && !marca) { marca = m[1].toUpperCase(); continue; }
    if (!dataStr && parseDate(p) && !parseScore(p)) { dataStr = parseDate(p); continue; }
    if (!horaStr && parseTime(p)) { horaStr = parseTime(p); continue; }
    if (!score && parseScore(p)) { score = parseScore(p); continue; }
    if (/^[VED]$/i.test(p)) continue;                       // letra da forma
    if (/^J\s*\d{1,3}$/i.test(p)) continue;                 // jornada: J1, J2, J3
    if (/^[-–—]$/.test(p)) continue;
    if (_ehTextoDeCompeticao(p)) continue;                  // competição
    if (p) restantes.push(p);
  }
  if (!marca || !dataStr) return null;                      // não é esta forma

  // O adversário vem repetido; conta uma vez, sem distinguir maiúsculas.
  const vistos = {}, unicos = [];
  for (const r of restantes) {
    const k = r.toLowerCase();
    if (vistos[k]) continue;
    vistos[k] = true; unicos.push(r);
  }
  const recintos = unicos.filter((x) => JSC_PALAVRA_RECINTO.test(x));
  const equipas  = unicos.filter((x) => !JSC_PALAVRA_RECINTO.test(x));
  const adversario = equipas[0] || '';
  if (!adversario) return null;

  const clube = _nomeDoClube();
  const casa = marca === 'C' ? clube : adversario;
  const fora = marca === 'C' ? adversario : clube;
  return {
    id: next(), casa, fora,
    gcasa: score ? score.gcasa : null,
    gfora: score ? score.gfora : null,
    data: dataStr, hora: horaStr || '15:00',
    local: recintos[0] || '',
    estado: score ? 'Realizado' : 'Agendado',
  };
}

function parseSingleLineJogos(lines, next) {
  const jogos = [];
  for (const line of lines) {
    let parts=_camposDaLinha(line);
    // A forma do ZeroZero com o marcador do lado tem regras próprias: o lado
    // atribui-se pelo marcador e o resultado não se inverte.
    const zz = _jogoDeLinhaZZ(parts, next);
    if (zz) { jogos.push(zz); continue; }
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
        &#9888; <strong>Não foi possível reconhecer dados de classificação</strong> (${jscEsc(nLines)} linhas, ${jscEsc(nNums)} números detetados).<br>
        Dicas:<br>
        &bull; Seleciona a tabela <strong>inteira</strong> no site — do "1º" até à última equipa, incluindo todas as colunas de números (J, V, E, D, golos, pontos)<br>
        &bull; Cola diretamente com <strong>Ctrl+V</strong> (não uses "colar sem formatação")<br>
        &bull; No telemóvel pode não funcionar — usa um computador ou o botão <strong>&#9998; Editar manualmente</strong><br>
        &bull; Se continuar a falhar, o <strong>&#9998; Editar manualmente</strong> permite inserir a tabela à mão em 2 minutos</div>`;
      return;
    }
    const marked = markSCRows(rows);
    const hasLogos = rows.some(r => r.logo);
    div.innerHTML = `<p style="color:#22a75e;font-size:0.85rem;margin-bottom:8px">&#10003; ${jscEsc(rows.length)} equipas reconhecidas${jscEsc(hasLogos?' · logos detectados':'')}</p>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8rem">
      <thead><tr style="background:#001b4d;color:#fff">
        <th style="padding:5px 8px">#</th>
        ${hasLogos?'<th style="padding:5px 8px">Logo</th>':''}
        <th style="padding:5px 8px;text-align:left">Equipa</th>
        <th style="padding:5px 8px">J</th><th style="padding:5px 8px">V</th><th style="padding:5px 8px">E</th><th style="padding:5px 8px">D</th>
        <th style="padding:5px 8px">GM</th><th style="padding:5px 8px">GS</th>
        <th style="padding:5px 8px" title="Pontos armazenados (inclui 1ª fase se copiado do ZeroZero)">Pts</th>
      </tr></thead>
      <tbody>${marked.map((r,i)=>`<tr style="background:${jscEsc(r.sc?'rgba(255,209,0,0.12)':i%2===0?'#f9f9f9':'#fff')};${jscEsc(r.sc?'font-weight:700':'')}">
        <td style="padding:4px 8px;text-align:center">${i+1}</td>
        ${hasLogos?`<td style="padding:4px 8px;text-align:center">${r.logo?`<img src="${jscEscUrl(r.logo)}" style="width:22px;height:22px;object-fit:contain" onerror="this.style.opacity=0.2">`:'—'}</td>`:''}
        <td style="padding:4px 8px">${jscEsc(r.equipa)}${r.sc ? ' &#11088;' : ''}</td>
        <td style="padding:4px 8px;text-align:center">${jscEsc(r.j)}</td><td style="padding:4px 8px;text-align:center">${jscEsc(r.v)}</td>
        <td style="padding:4px 8px;text-align:center">${jscEsc(r.e)}</td><td style="padding:4px 8px;text-align:center">${jscEsc(r.d)}</td>
        <td style="padding:4px 8px;text-align:center">${jscEsc(r.gm)}</td><td style="padding:4px 8px;text-align:center">${jscEsc(r.gs)}</td>
        <td style="padding:4px 8px;text-align:center;font-weight:700;color:#001b4d">${jscEsc(r.pts)}</td>
      </tr>`).join('')}</tbody></table></div>
    <div style="margin-top:14px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:12px">
      <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px;color:#7a5700">&#43; Pontos da 1ª Fase (carregados para a 2ª fase)</div>
      <p style="font-size:0.75rem;color:#888;margin:0 0 10px">Se este for a 2ª fase de uma competição, insere os pontos carregados de cada equipa. Deixa em branco se não aplicável.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px">
        ${marked.map((r)=>`<label style="display:flex;align-items:center;gap:6px;font-size:0.8rem">
          <span style="flex:1;font-weight:${jscEsc(r.sc?700:400)}">${jscEsc(r.equipa)}</span>
          <input type="number" min="0" max="99" placeholder="—"
            style="width:52px;padding:3px 6px;border:1px solid #ddd;border-radius:4px;font-size:0.8rem;text-align:center"
            data-pts1fase="${jscEsc(r.equipa)}" value="${jscEsc(r.pts1fase||'')}">
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
    // Devolve MARKUP, e por isso é inserido directamente lá em baixo, sem
    // jscEsc() à volta — envolvê-lo escapava os < e os > e a pré-visualização
    // mostrava o código da imagem em texto, em vez do logótipo. O endereço já vai
    // tratado aqui pelo jscEscUrl(), que escapa as aspas e recusa javascript:,
    // vbscript: e data: que não seja de imagem; uma URL recusada dá src="" e o
    // onerror esconde a imagem. Sem logótipo não há tag nenhuma.
    const logoImg = (url) => url ? `<img src="${jscEscUrl(url)}" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;margin-right:5px" onerror="this.style.display='none'">` : '';
    const unresolvedHint = _lastJogosUnresolved > 0
      ? `<p style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:10px;font-size:0.78rem;color:#7a5700;margin:0 0 10px">
          &#9888; ${jscEsc(_lastJogosUnresolved)} equipas vinham só com logo (sem nome) e não foram reconhecidas.
          <strong>Importa primeiro a classificação deste escalão</strong> — assim fico a conhecer as equipas pelos logos e os nomes aparecem automaticamente.</p>`
      : '';
    div.innerHTML = `${unresolvedHint}
    <p style="color:#22a75e;font-size:0.85rem;margin-bottom:8px">&#10003; ${jscEsc(jogos.length)} jogos reconhecidos (${jscEsc(r)} realizados · ${jscEsc(a)} agendados)</p>
    ${nSC > 0 && nSC < jogos.length ? `
      <label style="display:flex;align-items:center;gap:8px;background:#e8f4fd;border:1px solid #b3d9f7;border-radius:8px;padding:10px;font-size:0.82rem;margin-bottom:10px;cursor:pointer">
        <input type="checkbox" id="colarSoSC" checked style="width:16px;height:16px">
        <span>Guardar apenas os <strong>${jscEsc(nSC)} jogos do Campinense</strong> (ignorar os restantes ${jscEsc(jogos.length - nSC)})</span>
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
        return `<tr style="background:${jscEsc(sc?'rgba(255,209,0,0.1)':i%2===0?'#f9f9f9':'#fff')}">
          <td style="padding:4px 8px;white-space:nowrap">${jscEsc(j.data)}</td>
          <td style="padding:4px 8px">${logoImg(j.logoCasa)}${jscEsc(j.casa)}</td>
          <td style="padding:4px 8px;text-align:center;font-weight:700">${jscEsc(j.gcasa!=null?j.gcasa+'–'+j.gfora:'–')}</td>
          <td style="padding:4px 8px">${logoImg(j.logoFora)}${jscEsc(j.fora)}</td>
          <td style="padding:4px 8px;text-align:center">${jscEsc(j.hora)}</td>
          <td style="padding:4px 8px;font-size:0.75rem">${jscEsc(j.local)}</td>
          <td style="padding:4px 8px;text-align:center;font-size:0.75rem;color:${jscEsc(j.estado==='Realizado'?'#22a75e':'#888')}">${jscEsc(j.estado)}</td>
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

    // Correspondência pelo nome da equipa, em minúsculas, e nada mais: sem
    // aproximações. Uma equipa cuja grafia mude conta como nova.
    const chaveEquipa = (n) => (n || '').toLowerCase();

    // Pontos da 1ª fase escritos na pré-visualização.
    //
    // O input era identificado pela posição na pré-visualização, e o guardar
    // reinterpreta o texto da área de colagem: bastava o texto mudar entre
    // Pré-visualizar e Guardar — e muda, porque a pré-visualização é manual,
    // o textarea não tem oninput — para os números irem para outra equipa.
    // Medido: pré-visualizado [Louletano, Quarteirense, Campinense] com
    // [6, 3, 9] e guardado na ordem inversa, os 6 do Louletano ficaram no
    // Campinense e os 9 do Campinense no Louletano. Passa pelo nome, e cada
    // linha recebe no máximo um valor do formulário.
    const comValorDoFormulario = new Set();
    document.querySelectorAll('[data-pts1fase]').forEach(inp => {
      const val = parseInt(inp.value, 10);
      if (isNaN(val) || val <= 0) return;
      const nome = chaveEquipa(inp.dataset.pts1fase);
      const alvo = rows.findIndex((r, i) => !comValorDoFormulario.has(i) && chaveEquipa(r.equipa) === nome);
      if (alvo !== -1) { rows[alvo].pts1fase = val; comValorDoFormulario.add(alvo); }
    });

    // Herdar da classificação guardada o que esta colagem não traz.
    //
    // A colagem reconstruía as linhas de raiz e gravava por cima: o pts1fase
    // desaparecia e o forma ficava vazio, porque o _makeClassRow() escreve
    // sempre forma: '' — o ZeroZero não dá a forma, e ela só pode ter vindo do
    // editor manual. São os dois únicos campos que a colagem não sabe produzir,
    // e por isso os únicos que se herdam. O pts, o dg, o j, o v, o e, o d, o
    // gm, o gs e o logo continuam a vir da colagem, que é a fonte de verdade
    // para eles.
    //
    // Cada linha antiga é consumida uma só vez: se a colagem trouxer duas
    // linhas com o mesmo nome, a segunda não recebe o que já foi para a
    // primeira.
    let guardadas = [];
    try {
      guardadas = JSON.parse(
        localStorage.getItem(teamStorageKey(_colarEscalao, _colarTeam, 'class')) || '[]');
    } catch (e) {}
    const porNome = {};
    guardadas.forEach(g => {
      const k = chaveEquipa(g.equipa);
      (porNome[k] || (porNome[k] = [])).push(g);
    });
    rows.forEach(r => {
      const fila   = porNome[chaveEquipa(r.equipa)];
      const antiga = fila && fila.length ? fila.shift() : null;
      if (!antiga) return;   // equipa nova: entra sem herdar nada
      if (r.pts1fase == null && antiga.pts1fase != null) r.pts1fase = antiga.pts1fase;
      if (!r.forma && antiga.forma) r.forma = antiga.forma;
    });

    const final = markSCRows(rows);

    // Save logos to db_logos (team name → logo URL)
    //
    // Só se grava quando esta colagem traz algo de novo. A gravação era
    // incondicional, e uma colagem sem imagens — um copiar de texto simples, ou
    // o AF Algarve — deixava a chave como "{}" num painel onde ela nem existia.
    // Um "{}" não é inofensivo: a publicação entrega-o, e o js/sync.js
    // substituía por ele o mapa dos visitantes. Medido: os logótipos de todas as
    // equipas de terceiros desapareciam da classificação pública.
    const logos = JSON.parse(localStorage.getItem('db_logos') || '{}');
    let novosLogos = 0;
    final.forEach(r => {
      const chave = r.equipa.toLowerCase();
      if (r.logo && logos[chave] !== r.logo) { logos[chave] = r.logo; novosLogos++; }
    });
    if (novosLogos) localStorage.setItem('db_logos', JSON.stringify(logos));

    localStorage.setItem(teamStorageKey(_colarEscalao, _colarTeam, 'class'), JSON.stringify(final));
    teamCfg.lastSync = now;
    teamCfg.nTeams   = final.length;
    // Como no editor manual: as linhas já estão gravadas na sua chave; aqui
    // confirma-se a marca de data, que é o que o escalão-array engolia — o
    // «últ. atualização» dos Sub-15 nunca mudava, e ninguém sabia porquê.
    const esc = _colarEscalao, ser = _colarTeam;
    const marcou = saveClassConfig(cfg, (c) => (ser
      ? c[esc] && c[esc].teams && c[esc].teams[ser] && c[esc].teams[ser].lastSync === now
      : c[esc] && c[esc].lastSync === now));
    fecharColarClass();
    renderClassSyncRows();
    showToast(`${_colarEscalao}${teamCfg.nome && _colarTeam ? ' · ' + teamCfg.nome : ''}: ${final.length} equipas guardadas`
      + (marcou ? '' : ' — a data de atualização não ficou registada'),
      marcou ? 'green' : 'red');
  } else {
    let jogos = parsePastedJogos(ta.value);
    if (!jogos.length) { showToast('Nenhum jogo válido para guardar', 'red'); return; }
    // Equipas que a colagem não conseguiu nomear: a gravação pára e pergunta.
    // O aviso já existia na pré-visualização e passava despercebido — foi
    // assim que 24 jogos ficaram com «h2h» no lugar do adversário.
    const porNomear = jogos.filter(j => j.revisao).length;
    if (porNomear && !confirm(
        porNomear + ' de ' + jogos.length + ' jogos vêm com o adversário por identificar '
        + '(a fonte deu o escudo e não o nome).\n\n'
        + 'Pode guardar assim e corrigir depois na Equipa Sénior → «Corrigir adversários», '
        + 'ou cancelar, importar primeiro a classificação deste escalão — que ensina os '
        + 'escudos ao painel — e colar os jogos outra vez.\n\nGuardar mesmo assim?')) {
      return;
    }
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
    let added=0, updated=0, porRever=0;
    const kc = s => (s||'').toLowerCase().trim();
    for (const j of jogos) {
      // Primeiro a correspondência de sempre: mesma data e os dois nomes iguais.
      let ex = DB.jogos.find(e => e.data===j.data && kc(e.casa)===kc(j.casa) && kc(e.fora)===kc(j.fora));
      // Depois, a mesma data no mesmo escalão com o mesmo adversário, seja de
      // que lado for. Sem isto, um nome escrito de outra maneira — ou um lado
      // corrigido entretanto — entrava como jogo novo e ficava o mesmo jogo
      // duas vezes. Um clube não joga duas vezes contra o mesmo adversário no
      // mesmo dia, pelo que a data e o adversário bastam.
      if (!ex) {
        const advNovo = kc(_jscAdversarioDe(j));
        if (advNovo && !_jscPorIdentificar(advNovo)) {
          ex = DB.jogos.find(e => e.data===j.data && e.escalao===escalao
                               && kc(_jscAdversarioDe(e)) === advNovo);
        }
      }
      // E, antes de criar, o caso desta correcção: já existe um jogo nesta
      // data com o adversário por identificar. Criar outro era duplicá-lo.
      // Não se lhe toca aqui — quem o corrige é a ferramenta de revisão, que
      // mostra o antes e o depois e só escreve depois de confirmado.
      if (!ex && DB.jogos.some(e => e.data===j.data && e.escalao===escalao
                                 && (_jscPorIdentificar(e.casa) || _jscPorIdentificar(e.fora)))) {
        porRever++;
        continue;
      }
      if (ex) {
        if (j.estado==='Realizado' && ex.estado==='Agendado') { ex.gcasa=j.gcasa; ex.gfora=j.gfora; ex.estado='Realizado'; updated++; }
      } else {
        const novo = { id:Date.now()+Math.floor(Math.random()*10000), escalao, equipa:teamLabel,
          casa:j.casa, fora:j.fora, gcasa:j.gcasa, gfora:j.gfora, data:j.data, hora:j.hora, local:j.local, estado:j.estado };
        if (j.revisao) novo.revisao = true;
        DB.jogos.push(novo);
        added++;
      }
    }
    saveDB();
    renderJogos();

    teamCfg.lastJogos = now;
    teamCfg.nJogos    = jogos.length;
    const serJ = _colarTeam;
    const marcouJ = saveClassConfig(cfg, (c) => (serJ
      ? c[escalao] && c[escalao].teams && c[escalao].teams[serJ]
        && c[escalao].teams[serJ].lastJogos === now
      : c[escalao] && c[escalao].lastJogos === now));
    fecharColarClass();
    renderClassSyncRows();
    showToast(`${escalao}${teamLabel ? ' · ' + teamLabel : ''}: ${added} jogos adicionados${updated?', '+updated+' actualizados':''}`
      + (porRever ? `, ${porRever} já existem por corrigir (use «Corrigir adversários»)` : '')
      + (marcouJ ? '' : ' — a data de atualização não ficou registada'),
      marcouJ ? 'green' : 'red');
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
    const imgStyle  = p.imagem ? `background-image:url('${jscEscUrl(p.imagem)}')` : '';
    return `
    <div class="fb-posts-admin-card">
      <div class="fb-posts-admin-card__img" style="${imgStyle}">
        ${!p.imagem ? `<span>${tipoIcon}</span>` : ''}
      </div>
      <div class="fb-posts-admin-card__body">
        <div class="fb-posts-admin-card__meta">
          <span class="badge">${jscEsc(tipoLabel)}</span>
          <time>${jscEsc(dataStr)}</time>
        </div>
        <p class="fb-posts-admin-card__text">${jscEsc((p.texto || '').slice(0, 120))}${jscEsc((p.texto || '').length > 120 ? '…' : '')}</p>
        ${p.url ? `<a href="${jscEscUrl(p.url)}" target="_blank" rel="noopener" class="fb-posts-admin-card__link">Ver publicação →</a>` : ''}
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
        <h3>${jscEsc(idx >= 0 ? 'Editar' : 'Adicionar')} Publicação</h3>
        <button class="modal-close" onclick="document.getElementById('fbPostModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Tipo</label>
        <select id="fbPostTipo" class="form-input" style="margin-bottom:12px">
          ${tipos.map(t => `<option value="${jscEsc(t)}" ${jscEsc(post.tipo===t?'selected':'')}>${jscEsc(t.charAt(0).toUpperCase()+t.slice(1))}</option>`).join('')}
        </select>
        <label class="form-label">Texto da publicação</label>
        <textarea id="fbPostTexto" class="form-input" rows="4" style="margin-bottom:12px">${jscEsc(post.texto||'')}</textarea>
        <label class="form-label">URL da imagem (opcional)</label>
        <input id="fbPostImagem" class="form-input" type="url" placeholder="https://…" value="${jscEsc(post.imagem||'')}" style="margin-bottom:12px">
        <label class="form-label">URL da publicação</label>
        <input id="fbPostUrl" class="form-input" type="url" placeholder="https://facebook.com/…" value="${jscEsc(post.url||'')}" style="margin-bottom:12px">
        <label class="form-label">Data</label>
        <input id="fbPostData" class="form-input" type="date" value="${jscEsc(post.data ? post.data.slice(0,10) : '')}" style="margin-bottom:12px">
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
  heroTag:   'Formando Campeões desde 1947 →',
  heroTitle: 'Juventude<br /><span>Sport Campinense</span>',
  heroDesc:  'Desenvolvendo talentos, construindo carácter e cultivando a paixão pelo futebol em Loulé, Algarve.',
  // Os valores por omissão de duas das quatro estatísticas saíram: "300+
  // Atletas" e "80+ Títulos" não têm fonte confirmada, e o clube decidiu não os
  // publicar enquanto não tiverem. Ficar aqui como valor por omissão era
  // publicá-los por outra via — estes textos são o que o painel mostra quando
  // não há nada guardado, e é o que é enviado ao publicar. Não foram
  // substituídos por outros números.
  stat1Num: '', stat1Label: '',
  stat2Num: '8',    stat2Label: 'Escalões',
  stat3Num: '75+', stat3Label: 'Anos de história',
  stat4Num: '', stat4Label: '',
  aboutText1: 'Fundado a 12 de dezembro de 1947, o Juventude Sport Campinense é um dos clubes mais históricos e emblemáticos do concelho de Loulé e do distrito de Faro. Ao longo de mais de sete décadas de existência, tem desempenhado um papel fundamental na promoção do desporto, na formação de jovens atletas e na dinamização da comunidade local.',
  aboutText2: 'Desde a sua fundação, o clube construiu uma identidade assente em valores como o respeito, a dedicação, o espírito de equipa, a formação humana e a paixão pelo desporto. Mais do que competir, o Juventude Sport Campinense tem como missão educar através do futebol, formando atletas e cidadãos preparados para os desafios da vida.',
  aboutEst:   'EST. 1947',
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
  // Sem valor guardado, o texto por omissão passa a SUGESTÃO (placeholder) e não
  // a conteúdo do campo.
  //
  // Antes era escrito no campo, e o guardar gravava o que estivesse no campo:
  // qualquer texto por omissão tornava-se conteúdo oficial do site no primeiro
  // save, sem ninguém o ter escrito. Foi por esta via que "80+ Títulos" e "300+
  // Atletas" continuariam a ser publicados depois de terem sido retirados do
  // HTML, e é a mesma via para as três referências a 1947 do heroTag, do
  // aboutEst e do aboutText1.
  //
  // Agora o campo vazio grava vazio, e quem quiser o texto por omissão escreve-o.
  for (const [elId, cfgKey] of Object.entries(fields)) {
    const el = document.getElementById(elId);
    if (!el) continue;
    if (cfg[cfgKey] !== undefined && cfg[cfgKey] !== '') {
      el.value = cfg[cfgKey];
    } else {
      el.value = '';
      if (SITE_DEFAULTS[cfgKey] !== undefined && SITE_DEFAULTS[cfgKey] !== ''
          && !el.getAttribute('data-exemplo-fixo')) {
        el.placeholder = SITE_DEFAULTS[cfgKey];
      }
    }
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
      if (status) { status.innerHTML = `✓ Localizado: <strong>${jscEsc(lat)}, ${jscEsc(lon)}</strong><br><small>${jscEsc(label)}</small>`; status.style.color = '#2e7d32'; }
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
    local: 'Campo Municipal N.º 2 - Loulé',
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
    local: 'Campo Municipal N.º 2 - Loulé',
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
    <div class="galeria-card ${jscEsc(f.ativo === false ? 'galeria-card--inativa' : '')}">
      ${f.ativo === false ? '<span class="galeria-card__estado">Não publicada</span>' : ''}
      <div class="galeria-card__img" ${f.url ? `style="background-image:url('${jscEscUrlCss(f.url)}')"` : ''}>
        ${!f.url ? `<span>${jscEsc(catIcons[f.categoria] || '📷')}</span>` : ''}
        <span class="galeria-card__cat">${jscEsc(f.categoria)}</span>
      </div>
      <div class="galeria-card__body">
        <p class="galeria-card__title">${jscEsc(f.titulo)}</p>
        <p class="galeria-card__date">${jscEsc(fmtDate(f.data))}</p>
      </div>
      <div class="galeria-card__actions">
        <button class="btn btn-sm" onclick="editFoto(${DB.galeria.indexOf(f)})">✏️ Editar</button>
        <button class="btn btn-sm" onclick="toggleFoto(${DB.galeria.indexOf(f)})">${f.ativo === false ? '✅ Publicar' : '⛔ Despublicar'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFoto(${DB.galeria.indexOf(f)})">🗑️</button>
      </div>
    </div>`).join('') :
    '<p style="padding:24px;color:#999;text-align:center">Sem fotos nesta categoria.</p>';
}

function editFoto(idx) {
  const f = idx >= 0 ? DB.galeria[idx] : { titulo:'', categoria:'Treino', data:'', url:'', descricao:'', imgPos:'center', imgSize:'cover', ativo:true };
  const pos = f.imgPos  || 'center';
  const sz  = f.imgSize || 'cover';
  openModal(idx >= 0 ? 'Editar Foto' : 'Adicionar Foto', `
    <div class="modal-row">
      <div class="modal-field"><label>Título</label>
        <input class="form-input" id="mFotoTitulo" value="${jscEsc(f.titulo)}" /></div>
      <div class="modal-field"><label>Categoria</label>
        <select class="form-input" id="mFotoCat">
          ${['Treino','Jogo','Evento','Conquista'].map(c => `<option ${jscEsc(f.categoria===c?'selected':'')}>${jscEsc(c)}</option>`).join('')}
        </select></div>
    </div>
    <div class="modal-field"><label>Data</label>
      <input class="form-input" type="date" id="mFotoData" value="${jscEsc(f.data)}" /></div>
    <div class="modal-field">
      <label>Imagem</label>
      <div class="img-upload-box">
        <label class="img-upload-btn" for="mFotoFicheiro">📁 Escolher ficheiro</label>
        <input type="file" id="mFotoFicheiro" accept="image/*" style="display:none">
        <input class="form-input" type="text" id="mFotoUrl" placeholder="ou cole URL da imagem..." value="${jscEsc(f.url)}" />
      </div>
      <small style="color:#888;font-size:11px;margin-top:4px;display:block">JPG, PNG, WebP — máx. 5MB</small>
    </div>
    <div id="mFotoPreview" style="margin-top:8px;${jscEsc(f.url?'':'display:none')}">
      <img src="${jscEscUrl(f.url)}" style="max-width:100%;max-height:160px;border-radius:8px;object-fit:cover" onerror="this.parentElement.style.display='none'" />
    </div>
    <div class="modal-row" style="margin-top:8px">
      <div class="modal-field"><label>Posição</label>
        <select class="form-input" id="mFotoPos">
          <option value="center" ${jscEsc(pos==='center'?'selected':'')}>Centro</option>
          <option value="top" ${jscEsc(pos==='top'?'selected':'')}>Topo</option>
          <option value="bottom" ${jscEsc(pos==='bottom'?'selected':'')}>Baixo</option>
          <option value="left center" ${jscEsc(pos==='left center'?'selected':'')}>Esquerda</option>
          <option value="right center" ${jscEsc(pos==='right center'?'selected':'')}>Direita</option>
        </select>
      </div>
      <div class="modal-field"><label>Tamanho</label>
        <select class="form-input" id="mFotoSize">
          <option value="cover"   ${jscEsc(sz==='cover'?'selected':'')}>Preencher — recortar bordas</option>
          <option value="contain" ${jscEsc(sz==='contain'?'selected':'')}>Mostrar tudo — com margens</option>
          <option value="110%"    ${jscEsc(sz==='110%'?'selected':'')}>Zoom 110%</option>
          <option value="140%"    ${jscEsc(sz==='140%'?'selected':'')}>Zoom 140%</option>
        </select>
      </div>
    </div>
    <div class="modal-field"><label>Descrição</label>
      <textarea class="form-input" id="mFotoDesc" rows="2">${jscEsc(f.descricao)}</textarea></div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 12px;margin-top:10px">
      <strong style="font-size:12px;color:#9a3412">&#9888; Dados pessoais</strong>
      <p style="font-size:11.5px;color:#9a3412;margin:4px 0 0;line-height:1.5">
        O título e a descrição são publicados no site. Não inclua nomes nem
        outros dados pessoais de menores sem autorização adequada.
      </p>
    </div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-top:10px">
      <input type="checkbox" id="mFotoAtivo" ${jscEsc(f.ativo !== false ? 'checked' : '')} style="width:16px;height:16px" />
      Fotografia publicada (visível no site)
    </label>
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
    // Uma fotografia pode ter de sair do site de imediato — um pedido de um
    // encarregado de educação, por exemplo — sem se apagar o registo. Um
    // registo sem este campo conta como publicado, para não esconder o que já
    // esteja lá.
    ativo:     document.getElementById('mFotoAtivo')?.checked !== false,
  };
  if (!item.titulo) { showToast('Preencha o título', 'red'); return; }
  if (idx >= 0) DB.galeria[idx] = { ...DB.galeria[idx], ...item };
  else DB.galeria.unshift({ id: Date.now(), ...item });
  saveDB(); closeModal(); renderGaleria();
  showToast(idx >= 0 ? 'Foto atualizada' : 'Foto adicionada', 'green');
}

// Despublicar em vez de apagar: o registo fica, e a fotografia sai do site.
function toggleFoto(idx) {
  const f = DB.galeria[idx];
  if (!f) return;
  f.ativo = f.ativo === false;
  saveDB(); renderGaleria();
  showToast(f.ativo ? 'Fotografia publicada' : 'Fotografia despublicada', f.ativo ? 'green' : '');
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

// O id do YouTube vem do jscVideoId() do js/html.js, que o painel também
// carrega. Era a mesma expressão escrita aqui e no js/videos.js.
function _ytIdAdmin(url) {
  return typeof jscVideoId === 'function' ? jscVideoId(url) : '';
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
    const thumb = id ? `https://img.youtube.com/vi/${jscEsc(id)}/mqdefault.jpg` : '';
    return `
    <div class="galeria-card ${jscEsc(v.ativo === false ? 'galeria-card--inativa' : '')}">
      ${v.ativo === false ? '<span class="galeria-card__estado">Não publicado</span>' : ''}
      <div class="galeria-card__img" ${thumb ? `style="background-image:url('${jscEscUrlCss(thumb)}')"` : 'style="background:#001f4d"'}>
        ${!thumb ? '<span style="font-size:2rem">🎬</span>' : ''}
        <span class="galeria-card__cat">${jscEsc(v.categoria || 'Outro')}</span>
      </div>
      <div class="galeria-card__body">
        <p class="galeria-card__title">${jscEsc(v.titulo)}</p>
        <p class="galeria-card__date">${jscEsc(fmtDate(v.data))}</p>
      </div>
      <div class="galeria-card__actions">
        <button class="btn btn-sm" onclick="editVideo(${(DB.videos||[]).indexOf(v)})">✏️ Editar</button>
        <button class="btn btn-sm" onclick="toggleVideo(${(DB.videos||[]).indexOf(v)})">${v.ativo === false ? '✅ Publicar' : '⛔ Despublicar'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteVideo(${(DB.videos||[]).indexOf(v)})">🗑️</button>
      </div>
    </div>`; }).join('') :
    '<p style="padding:24px;color:#999;text-align:center">Nenhum vídeo nesta categoria.</p>';
}

function editVideo(idx) {
  if (!DB.videos) DB.videos = [];
  const v = idx >= 0 ? DB.videos[idx] : { titulo:'', categoria:'Golos', data:'', url:'', descricao:'', ativo:true };
  const id = _ytIdAdmin(v.url);
  openModal(idx >= 0 ? 'Editar Vídeo' : 'Adicionar Vídeo', `
    <div class="modal-row">
      <div class="modal-field"><label>Título</label>
        <input class="form-input" id="mVidTitulo" value="${jscEsc(v.titulo)}" placeholder="Ex: Sub-17 — Golo de Pedro Costa vs Tavira" /></div>
      <div class="modal-field"><label>Categoria</label>
        <select class="form-input" id="mVidCat">
          ${['Golos','Melhores Momentos','Entrevistas','Treino','Jogo','Outro'].map(c => `<option ${jscEsc(v.categoria===c?'selected':'')}>${jscEsc(c)}</option>`).join('')}
        </select></div>
    </div>
    <div class="modal-field"><label>Data</label>
      <input class="form-input" type="date" id="mVidData" value="${jscEsc(v.data)}" /></div>
    <div class="modal-field">
      <label>URL do YouTube</label>
      <input class="form-input" type="url" id="mVidUrl" value="${jscEsc(v.url)}" placeholder="https://www.youtube.com/watch?v=..." />
      <small style="color:#888;font-size:11px;margin-top:4px;display:block">Cole o link de qualquer vídeo do YouTube (incluindo Shorts)</small>
    </div>
    ${id ? `<div id="mVidPreview" style="margin-top:8px"><img src="https://img.youtube.com/vi/${jscEscUrl(id)}/mqdefault.jpg" style="max-width:100%;border-radius:8px" /></div>` : ''}
    <div class="modal-field"><label>Descrição (opcional)</label>
      <textarea class="form-input" id="mVidDesc" rows="2">${jscEsc(v.descricao)}</textarea></div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-top:10px">
      <input type="checkbox" id="mVidAtivo" ${jscEsc(v.ativo !== false ? 'checked' : '')} style="width:16px;height:16px" />
      Vídeo publicado (visível no site)
    </label>
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
    ativo:     document.getElementById('mVidAtivo')?.checked !== false,
  };
  if (!item.titulo) { showToast('Preencha o título', 'red'); return; }
  if (!item.url)    { showToast('Cole o URL do YouTube', 'red'); return; }
  // Antes bastava o campo não estar vazio: um endereço de outro sítio gravava
  // sem aviso, e o erro só se descobria no site — cartão sem miniatura e um
  // iframe vazio. Agora não passa daqui.
  if (!_ytIdAdmin(item.url)) {
    showToast('O URL não é de um vídeo do YouTube reconhecido.', 'red');
    return;
  }
  if (idx >= 0) DB.videos[idx] = { ...DB.videos[idx], ...item };
  else DB.videos.unshift({ id: Date.now(), ...item });
  saveDB(); closeModal(); renderVideos();
  showToast(idx >= 0 ? 'Vídeo atualizado' : 'Vídeo adicionado', 'green');
}

function toggleVideo(idx) {
  const v = (DB.videos || [])[idx];
  if (!v) return;
  v.ativo = v.ativo === false;
  saveDB(); renderVideos();
  showToast(v.ativo ? 'Vídeo publicado' : 'Vídeo despublicado', v.ativo ? 'green' : '');
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
      ? ` style="background-image:url('${jscEscUrl(t.foto)}');background-size:cover;background-position:center;color:transparent"`
      : '';
    return `<div class="staff-card ${jscEsc(t.ativo ? '' : 'inactive')}">
      <div class="staff-avatar"${fotoStyle}>${jscEsc(iniciais)}</div>
      <div class="staff-info">
        <p class="staff-name">${jscEsc(t.nome)} ${t.ativo ? '' : '<span style="font-size:11px;color:#999">(inactivo)</span>'}</p>
        <p class="staff-cargo">${jscEsc(t.cargo)}</p>
        <p class="staff-meta">📋 ${jscEsc(t.escalao)} · Desde ${jscEsc(t.desde)}</p>
        <p class="staff-meta">📞 ${jscEsc(t.telefone)}</p>
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
        <input class="form-input" id="mTNome" value="${jscEsc(t.nome)}" /></div>
      <div class="modal-field"><label>Cargo</label>
        <input class="form-input" id="mTCargo" value="${jscEsc(t.cargo)}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mTEscalao">${_escOpts(t.escalao, true)}</select></div>
      <div class="modal-field"><label>Desde (ano)</label>
        <input class="form-input" id="mTDesde" value="${jscEsc(t.desde)}" /></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Telefone</label>
        <input class="form-input" id="mTTel" value="${jscEsc(t.telefone)}" /></div>
      <div class="modal-field"><label>E-mail</label>
        <input class="form-input" id="mTEmail" value="${jscEsc(t.email)}" /></div>
    </div>
    <div class="modal-field"><label>Foto (URL ou upload)</label>
      <input class="form-input" type="text" id="mTFoto" value="${jscEsc(t.foto||'')}" placeholder="https://... ou carregar ficheiro" />
      <input type="file" id="mTFotoFile" accept="image/*" style="display:none" />
      <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mTFotoFile').click()">&#128190; Carregar foto</button>
      <div id="mTFotoPreview" style="${jscEsc(t.foto?'':'display:none')};margin-top:8px">
        <img src="${jscEscUrl(t.foto||'')}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #003B8E" />
      </div>
    </div>
    <div class="modal-field"><label>Estado</label>
      <select class="form-input" id="mTAtivo">
        <option value="1" ${jscEsc(t.ativo?'selected':'')}>Activo</option>
        <option value="0" ${jscEsc(!t.ativo?'selected':'')}>Inactivo</option>
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
    return `<div class="agenda-list-item" style="${jscEsc(passado ? 'opacity:0.6' : '')}">
      <div class="agenda-date-box">
        <span class="day">${jscEsc(d.getDate())}</span>
        <span class="month">${jscEsc(d.toLocaleDateString('pt-PT',{month:'short'}))}</span>
        <span class="time">${jscEsc(e.hora)}</span>
      </div>
      <div class="agenda-body">
        <span class="agenda-tipo-badge ${jscEsc(e.tipo)}">${jscEsc(e.tipo)}</span>
        <p class="agenda-title">${jscEsc(e.titulo)}</p>
        <p class="agenda-meta">📍 ${jscEsc(e.local)} · 👥 ${jscEsc(e.escalao)}</p>
        ${e.descricao ? `<p class="agenda-meta">${jscEsc(e.descricao)}</p>` : ''}
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
      <input class="form-input" id="mEvTitulo" value="${jscEsc(e.titulo)}" /></div>
    <div class="modal-row">
      <div class="modal-field"><label>Tipo</label>
        <select class="form-input" id="mEvTipo">
          ${['Jogo','Torneio','Treino','Reunião','Outro'].map(t => `<option ${jscEsc(e.tipo===t?'selected':'')}>${jscEsc(t)}</option>`).join('')}
        </select></div>
      <div class="modal-field"><label>Escalão</label>
        <select class="form-input" id="mEvEscalao">${_escOpts(e.escalao, true)}</select></div>
    </div>
    <div class="modal-row">
      <div class="modal-field"><label>Data</label>
        <input class="form-input" type="date" id="mEvData" value="${jscEsc(e.data)}" /></div>
      <div class="modal-field"><label>Hora</label>
        <input class="form-input" type="time" id="mEvHora" value="${jscEsc(e.hora)}" /></div>
    </div>
    <div class="modal-field"><label>Local</label>
      <input class="form-input" id="mEvLocal" value="${jscEsc(e.local)}" /></div>
    <div class="modal-field"><label>Descrição</label>
      <textarea class="form-input" id="mEvDesc" rows="2">${jscEsc(e.descricao)}</textarea></div>
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

  // Última publicação
  const ultimaPub = localStorage.getItem('jsc_ultima_publicacao');
  const ultimaPubEl = document.getElementById('ultimaPublicacao');
  if (ultimaPubEl && ultimaPub) ultimaPubEl.textContent = 'Última publicação: ' + ultimaPub;

  // Quem está autenticado, segundo o servidor.
  const campoUser = document.getElementById('cfgAdminUser');
  if (campoUser && SESSAO) campoUser.value = SESSAO.utilizador + ' (' + SESSAO.perfil + ')';
  renderAdminUsers();

  // Carregar cores guardadas + grelha de templates
  const cores = JSON.parse(localStorage.getItem('site_cores') || '{}');
  if (cores.azul)    document.getElementById('cfgCorAzul').value    = cores.azul;
  if (cores.amarelo) document.getElementById('cfgCorAmarelo').value = cores.amarelo;
  renderTemaTemplates();

  // Carregar dados do clube. Sem nada guardado, semeia-se a partir do
  // DB.dadosClube (admin/js/data.js) — a identidade é configuração verdadeira do
  // clube, como os escalões e as modalidades, e o rodapé gerado depende dela.
  let clube = JSON.parse(localStorage.getItem('dados_clube') || '{}');
  if (!clube.nome && typeof DB !== 'undefined' && DB.dadosClube) {
    clube = JSON.parse(JSON.stringify(DB.dadosClube));
    localStorage.setItem('dados_clube', JSON.stringify(clube));
  }
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
  if (MODO_LOCAL) {
    showToast('Modo local: a palavra-passe é do servidor e precisa de PHP.', 'red');
    return;
  }
  const atual = document.getElementById('cfgAdminPwAtual').value;
  const pw    = document.getElementById('cfgAdminPw').value;
  const conf  = document.getElementById('cfgAdminPwConf').value;
  if (!atual) { showToast('Introduza a palavra-passe atual', 'red'); return; }
  if (!pw)    { showToast('Introduza a nova palavra-passe', 'red'); return; }
  if (pw !== conf) { showToast('As palavras-passe não coincidem', 'red'); return; }

  const r = await apiAuth('mudar-password', { atual, nova: pw }).catch(() => ({ ok: false, error: 'Sem ligação ao servidor.' }));
  if (!r.ok) { showToast(r.error || 'Não foi possível alterar.', 'red'); return; }

  ['cfgAdminPwAtual', 'cfgAdminPw', 'cfgAdminPwConf'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  showToast('\u2713 Palavra-passe alterada.', 'green');
}

// ---- UTILIZADORES ADICIONAIS ----
let _perfisDisponiveis = {};

async function renderAdminUsers() {
  const el = document.getElementById('adminUsersList');
  if (!el) return;
  if (MODO_LOCAL) {
    el.innerHTML = '<p style="font-size:0.78rem;color:#aaa;margin:0">As contas do painel vivem no servidor. Em modo local não há contas para mostrar.</p>';
    return;
  }

  const est = await apiAuth('estado').catch(() => null);
  if (est && est.perfis) {
    _perfisDisponiveis = est.perfis;
    const sel = document.getElementById('novoUserPerfil');
    if (sel && !sel.options.length) {
      sel.innerHTML = Object.entries(est.perfis).map(([k, p]) =>
        `<option value="${jscEsc(k)}"${p.definido ? '' : ' disabled'}>${jscEsc(p.nome)}${p.definido ? '' : ' — permissões por definir'}</option>`
      ).join('');
    }
  }

  const r = await apiAuth('utilizadores').catch(() => null);
  if (!r || !r.ok) {
    el.innerHTML = '<p style="font-size:0.78rem;color:#aaa;margin:0">' +
      (r && r.estado === 403 ? 'Só o Super Admin pode ver as contas.' : 'Não foi possível ler as contas.') + '</p>';
    return;
  }
  const nomes = _perfisDisponiveis;
  el.innerHTML = r.utilizadores.map(u => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:#f5f7fa;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px">
      <span style="font-size:0.85rem;font-weight:600">&#128100; ${jscEsc(u.nome)}
        <span style="font-weight:400;color:#888">(${jscEsc(u.utilizador)} · ${jscEsc(nomes[u.perfil] ? nomes[u.perfil].nome : u.perfil)})</span>
      </span>
      <button class="btn-sm" style="color:#c00" title="Remover conta" data-remover-user="${jscEsc(u.utilizador)}">&#x2715;</button>
    </div>`).join('');
  el.querySelectorAll('[data-remover-user]').forEach(b => {
    b.addEventListener('click', () => removerAdminUser(b.getAttribute('data-remover-user')));
  });
}

window.adicionarAdminUser = async function () {
  const nome   = (document.getElementById('novoUserNome') || {}).value;
  const perfil = (document.getElementById('novoUserPerfil') || {}).value;
  const pw     = (document.getElementById('novoUserPw') || {}).value || '';
  const conf   = (document.getElementById('novoUserPwConf') || {}).value || '';
  if (!nome || !nome.trim()) { showToast('Introduza o nome de utilizador', 'red'); return; }
  if (pw !== conf) { showToast('As palavras-passe não coincidem', 'red'); return; }

  const r = await apiAuth('criar-utilizador', {
    utilizador: nome.trim(), nome: nome.trim(), perfil, password: pw,
  }).catch(() => ({ ok: false, error: 'Sem ligação ao servidor.' }));
  if (!r.ok) { showToast(r.error || 'Não foi possível criar a conta.', 'red'); return; }

  ['novoUserNome', 'novoUserPw', 'novoUserPwConf'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderAdminUsers();
  showToast('\u2713 Conta criada.', 'green');
};

window.removerAdminUser = async function (utilizador) {
  if (!confirm('Remover a conta "' + utilizador + '"?')) return;
  const r = await apiAuth('apagar-utilizador', { utilizador })
    .catch(() => ({ ok: false, error: 'Sem ligação ao servidor.' }));
  if (!r.ok) { showToast(r.error || 'Não foi possível remover.', 'red'); return; }
  renderAdminUsers();
  showToast('Conta removida.', 'green');
};


// ---- PUBLICAR NO SERVIDOR ----
// ---- Orçamento do conteúdo publicado --------------------------------
// O post_max_size do alojamento é 8 MB. Guarda-se margem para o envelope do
// pedido e para o JSON crescer entre a medição e o envio.
const JSC_PAYLOAD_RECUSAR = 6 * 1024 * 1024;   // acima disto não se tenta
const JSC_PAYLOAD_AVISAR  = 4 * 1024 * 1024;   // acima disto avisa-se
// Uma página gerada acima disto é má para quem a abre em rede móvel, muito
// antes de qualquer limite do servidor: a lista de notícias embute as imagens
// de TODAS as notícias. Medido: 25 imagens de 120 KB dão 4,14 MB de HTML.
const JSC_PAGINA_AVISAR   = 2 * 1024 * 1024;

function jscTamanhoLegivel(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB';
}

// Quanto pesa cada área, e quantas imagens embutidas tem. É isto que torna a
// mensagem útil: diz onde está o peso, não só que há peso.
function avaliarTamanhoDoPayload(corpo, dados) {
  const n = corpo.length;
  const areas = Object.keys(dados)
    .map(function (k) {
      let txt = '';
      try { txt = JSON.stringify(dados[k]) || ''; } catch (_) { txt = ''; }
      return { chave: k, bytes: txt.length, imagens: (txt.match(/data:image\//g) || []).length };
    })
    .filter(function (a) { return a.bytes > 32 * 1024; })
    .sort(function (a, b) { return b.bytes - a.bytes; })
    .slice(0, 3);

  const detalhe = areas.map(function (a) {
    return a.chave + ' ' + jscTamanhoLegivel(a.bytes)
         + (a.imagens ? ' em ' + a.imagens + ' imagem(ns)' : '');
  }).join(' · ');

  if (n > JSC_PAYLOAD_RECUSAR) {
    return {
      recusar: true,
      mensagem: 'Não publiquei: o conteúdo tem ' + jscTamanhoLegivel(n) + ' e o servidor aceita '
        + 'no máximo 8 MB por pedido (post_max_size).\n\nO que pesa mais: ' + (detalhe || '—')
        + '\n\nAs imagens ficam guardadas dentro do conteúdo. Remova ou substitua as mais '
        + 'pesadas — ou peça ao alojamento para aumentar o limite — e publique outra vez.',
    };
  }
  // O peso de UMA notícia multiplica-se: a lista embute todas.
  const noticias = areas.find(function (a) { return a.chave === 'noticias'; });
  if (noticias && noticias.bytes > JSC_PAGINA_AVISAR) {
    return {
      avisar: true,
      mensagem: '⚠ As notícias ocupam ' + jscTamanhoLegivel(noticias.bytes) + ' em '
        + noticias.imagens + ' imagem(ns). A página de notícias embute todas, '
        + 'e fica pesada em rede móvel.',
    };
  }
  if (n > JSC_PAYLOAD_AVISAR) {
    return {
      avisar: true,
      mensagem: '⚠ O conteúdo já tem ' + jscTamanhoLegivel(n) + ' de 8 MB. ' + (detalhe || ''),
    };
  }
  return {};
}

// ---- Nunca publicar o vazio por cima do que o site tem --------------
// O painel é a fonte: guarda o conteúdo no localStorage deste browser e
// publica o que lá estiver. Quando esse armazém se perde — limpeza de dados
// do site, despejo do browser por falta de espaço, outro perfil — o painel
// arranca vazio e tem tudo o que precisa para publicar nada por cima de tudo.
// Medido: 34 chaves reduzidas a três, e as três que ficaram são as que o
// próprio painel recria sem dados (jsc_painel_local, jsc_noticias, jsc_theme).
//
// Duas guardas, e nenhuma delas é um confirm() de uma linha: aqui exige-se uma
// palavra escrita, e no api/save.php exige-se que o pedido repita as áreas e as
// contagens que o servidor tem gravadas. Falhar uma das duas recusa a
// publicação inteira: o data/db.json não chega a ser tocado.
const JSC_AREAS_CRITICAS = ['noticias', 'jogos', 'atletas', 'escaloes', 'treinadores',
  'modalidades', 'patrocinadores', 'galeria', 'videos', 'agenda'];
const JSC_PALAVRA_APAGAR = 'APAGAR';

function jscConteudoVazio(v) {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function jscAreasCriticasVazias(dados) {
  return JSC_AREAS_CRITICAS.filter(function (a) { return jscConteudoVazio(dados[a]); });
}

// A confirmação escrita. Um confirm() aceita-se com Enter sem ler; isto obriga
// a escrever a palavra, e qualquer outra coisa — incluindo cancelar — recusa.
function jscConfirmarEsvaziamento(titulo, linhas) {
  const resposta = prompt(
    titulo + '\n\n' + linhas.join('\n')
    + '\n\nO site público passa a não ter este conteúdo.'
    + '\nSe foi este browser que perdeu os dados, cancela:'
    + '\no servidor ainda os tem e nada aqui os recupera.'
    + '\n\nPara publicar mesmo assim, escreve ' + JSC_PALAVRA_APAGAR + ' em maiúsculas:', '');
  return resposta !== null && resposta.trim() === JSC_PALAVRA_APAGAR;
}

async function publicarNoServidor() {
  if (MODO_LOCAL) {
    showToast('Modo local: publicar precisa de PHP a correr no servidor.', 'red');
    return;
  }
  // Publicar torna tudo isto conteúdo oficial do site. Se ainda houver
  // registos que vieram dos dados de exemplo, convém saber antes.
  if (typeof contarRegistosDeExemplo === 'function') {
    const demo = contarRegistosDeExemplo();
    if (demo.length) {
      const total = demo.reduce(function (n, d) { return n + d.n; }, 0);
      const lista = demo.map(function (d) { return '  \u2022 ' + d.seccao + ': ' + d.n + ' (' + d.exemplos.join(', ') + ')'; }).join('\n');
      if (!confirm(
        'Encontrei ' + total + ' registo(s) que parecem ser dos dados de exemplo:\n\n' + lista +
        '\n\nPublicar torna-os conteúdo oficial do site.\n\nPublicar mesmo assim?'
      )) return;
    }
  }
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
    jogos:          DB.jogos,
  };

  // As áreas que vivem directamente no localStorage só entram no pedido quando
  // este browser as tem — a mesma regra que o classData já seguia, e pela mesma
  // razão. O ls() devolve null tanto para "está vazio" como para "não existe
  // aqui", e esse null ia no pedido: publicar de outro computador, do telemóvel
  // ou de um perfil novo apagava do site os logótipos, a história, o palmarés e
  // a ficha do clube. Uma chave ausente significa "inalterada" para o servidor.
  const JSC_CAMPOS_DO_ARMAZEM = {
    modPosts:     'db_mod_posts',
    historia:     'db_historia',
    palmares:     'db_palmares',
    seniores:     'db_seniores',
    senioresInfo: 'db_seniores_info',
    siteConfig:   'site_config',
    dadosClube:   'dados_clube',
    sitePopup:    'site_popup',
    siteBanner:   'site_banner',
    siteAviso:    'site_aviso',
    siteCores:    'site_cores',
    siteLegal:    'site_legal',
    emailConfig:  'email_config',
    fbPosts:      'fb_posts',
    logos:        'db_logos',
    classConfig:  'fpf_sync_config',
  };
  Object.keys(JSC_CAMPOS_DO_ARMAZEM).forEach(function (campo) {
    const v = ls(JSC_CAMPOS_DO_ARMAZEM[campo]);
    if (v !== null && v !== undefined) dados[campo] = v;
  });
  // As classificações só entram no pedido quando este browser as tem.
  //
  // Iam sempre, e iam como null quando não havia nenhuma chave fpf_class_* —
  // publicar de outro computador, do telemóvel ou de outro perfil do browser.
  // O api/save.php funde o que recebe com o que está gravado, pelo que esse
  // null substituía a classificação publicada por nada: a projeção pública
  // deixava de levar classData, o js/sync.js não escrevia, e os visitantes
  // ficavam para sempre com as linhas que já tinham. Medido: coluna Forma
  // vazia em todas as equipas, sem cache pelo meio, e a publicar outra vez não
  // resolvia. Uma chave ausente significa "inalterada" para o servidor, que é
  // exactamente o que se quer aqui.
  if (Object.keys(classData).length) dados.classData = classData;

  // ---- Pré-voo: um painel inteiro vazio é um armazém perdido ---------
  // Não há razão legítima para publicar um site sem notícias, sem jogos, sem
  // atletas, sem escalões e sem modalidades, todos ao mesmo tempo. Numa
  // instalação nova o servidor também não tem nada e não há nada a perder,
  // mas a palavra escrita fica pedida igual: é uma vez, e é o caso em que o
  // erro custa o conteúdo todo.
  const criticasVazias = jscAreasCriticasVazias(dados);
  if (criticasVazias.length === JSC_AREAS_CRITICAS.length) {
    if (!jscConfirmarEsvaziamento(
      'Este painel não tem conteúdo nenhum: as ' + JSC_AREAS_CRITICAS.length
        + ' áreas principais estão todas vazias.',
      ['  • ' + criticasVazias.join(', ')]
    )) {
      showToast('Publicação cancelada. O site ficou exactamente como estava.', 'red');
      return;
    }
  }

  // ---- O payload cabe no que o servidor aceita? ---------------------
  // As imagens não são enviadas como ficheiros: o compressImage() reduz-as no
  // browser e guarda-as como data: URI DENTRO deste JSON. Por isso o limite que
  // manda não é o upload_max_filesize — não há upload de ficheiro nenhum — é o
  // post_max_size, aplicado a este corpo inteiro.
  //
  // Medido: um db.json com 50 imagens de 120 KB chega a 7,96 MB. Com
  // post_max_size = 8M o POST é recusado, o corpo chega vazio, e sem esta
  // verificação o painel dizia só "corpo vazio" — sem dizer porquê, nem o que
  // remover. Verifica-se aqui, antes de enviar, e nomeia-se o que pesa.
  const corpo = JSON.stringify(dados);
  const limite = avaliarTamanhoDoPayload(corpo, dados);
  if (limite.recusar) {
    showToast(limite.mensagem, 'red');
    alert(limite.mensagem);
    return;
  }
  if (limite.avisar) showToast(limite.mensagem);

  const btn = document.querySelector('[onclick="publicarNoServidor()"]');
  const ocupado = (sim) => {
    if (!btn) return;
    btn.disabled = sim;
    if (sim) btn.textContent = '⏳ A publicar...';
    else btn.innerHTML = '&#128640; Publicar agora';
  };
  const enviar = async (confirmacao) => {
    const resp = await fetch('../api/save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: confirmacao
        ? JSON.stringify(Object.assign({}, dados, { confirmarEsvaziar: confirmacao }))
        : corpo,
    });
    let json = {};
    try { json = await resp.json(); } catch (_) {}
    return { resp, json };
  };

  try {
    ocupado(true);
    let { resp, json } = await enviar(null);

    // O servidor recusou porque esta publicação deixava vazio conteúdo que ele
    // tem gravado, e disse quais as áreas e quantos registos. Só avança com a
    // palavra escrita, e o segundo pedido leva essas contagens de volta: o
    // servidor confere-as outra vez contra o data/db.json antes de gravar.
    if (resp.status === 409 && json && json.codigo === 'esvaziamento'
        && Array.isArray(json.esvaziamentos) && json.esvaziamentos.length) {
      ocupado(false);
      const linhas = json.esvaziamentos.map(function (e) {
        return '  • ' + e.area + ': ' + e.antes + ' → ' + e.depois;
      });
      if (!jscConfirmarEsvaziamento(
        'O site tem conteúdo que esta publicação deixaria vazio:', linhas)) {
        showToast('Publicação cancelada. O site ficou exactamente como estava.', 'red');
        return;
      }
      ocupado(true);
      ({ resp, json } = await enviar(json.esvaziamentos));
    }

    ocupado(false);
    if (resp.ok && json.ok) {
      const ts = new Date().toLocaleString('pt-PT');
      localStorage.setItem('jsc_ultima_publicacao', ts);
      const el = document.getElementById('ultimaPublicacao');
      if (el) el.textContent = 'Última publicação: ' + ts;
      const geradas = Array.isArray(json.gerados) ? json.gerados.filter(f => f.endsWith('.html')) : [];
      showToast('✓ Site atualizado! Visitantes já veem o novo conteúdo.'
        + (geradas.length ? ' Páginas escritas: ' + geradas.join(', ') + '.' : ''), 'green');
      (json.avisos || []).forEach(a => showToast('⚠ ' + a));
    } else if (resp.status === 401) {
      showToast('❌ Token inválido. Verifique em Configurações > Segurança.', 'red');
    } else {
      showToast('❌ Erro ao publicar: ' + (json.error || resp.status), 'red');
    }
  } catch (e) {
    ocupado(false);
    showToast('❌ Sem ligação ao servidor: ' + e.message, 'red');
  }
}
window.publicarNoServidor = publicarNoServidor;
// ---- REGENERAR AS PÁGINAS ----
// Escreve outra vez o conteúdo já publicado dentro das páginas do site, sem
// publicar nada de novo. Precisa-se disto depois de enviar ficheiros para o
// alojamento: o index.html que vem do repositório traz o bloco das notícias
// vazio, e é esta operação que o volta a encher.
async function regenerarPaginas() {
  if (MODO_LOCAL) {
    showToast('Modo local: regenerar precisa de PHP a correr no servidor.', 'red');
    return;
  }
  const btn = document.querySelector('[onclick="regenerarPaginas()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ A gerar...'; }
  try {
    const resp = await fetch('../api/gerar.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ acao: 'gerar' }),
    });
    const json = await resp.json();
    if (resp.ok && json.ok) {
      showToast('✓ Páginas geradas: ' + (json.ficheiros || []).join(', '), 'green');
      (json.avisos || []).forEach(a => showToast('⚠ ' + a));
    } else if (resp.status === 401) {
      showToast('❌ Sessão expirada. Entre outra vez.', 'red');
    } else if (resp.status === 403) {
      showToast('❌ Este perfil não pode gerar as notícias.', 'red');
    } else {
      showToast('❌ Não gerou: ' + (json.error || resp.status)
        + (json.revertido ? ' (versão anterior restaurada)' : ' (site inalterado)'), 'red');
    }
  } catch (e) {
    showToast('❌ Sem ligação ao servidor: ' + e.message, 'red');
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '&#128260; Regenerar páginas'; }
}
window.regenerarPaginas = regenerarPaginas;


// ---- REGISTOS DO SERVIDOR (base de dados MySQL) ----
// Inscrições e mensagens submetidas pelos visitantes chegam à BD via
// api/submit.php; aqui puxamo-las para o admin e empurramos mudanças
// de estado. Silencioso quando a BD não está configurada.
// Sem token configurado devolve vazio: o servidor responde 401, em vez de
// enviarmos um valor por omissão que qualquer pessoa conheceria.

function _regPush(tipo, id, estado) {
  fetch('../api/registos.php?tipo=' + tipo, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ acao: 'estado', id, estado }),
  }).catch(() => {});
}

function _regDelete(tipo, id) {
  fetch('../api/registos.php?tipo=' + tipo, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
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
  if (MODO_LOCAL) return;   // não há servidor de onde sincronizar
  const headers = {};
  const puxar = async (tipo) => {
    const r = await fetch('../api/registos.php?tipo=' + tipo, { headers });
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

// ---- TEMPLATES DE CORES ----
const TEMA_TEMPLATES = [
  { nome: 'Clássico',        azul: '#003B8E', amarelo: '#FFD100' },
  { nome: 'Verde Esperança', azul: '#0B6E4F', amarelo: '#FFC845' },
  { nome: 'Vermelho Força',  azul: '#A31621', amarelo: '#FFD100' },
  { nome: 'Vinho & Ouro',    azul: '#6E1423', amarelo: '#F2C94C' },
  { nome: 'Preto & Dourado', azul: '#1C1C1C', amarelo: '#D4AF37' },
  { nome: 'Azul Atlântico',  azul: '#0077C8', amarelo: '#FFE033' },
  { nome: 'Roxo Real',       azul: '#4A2377', amarelo: '#FFB81C' },
  { nome: 'Laranja Algarve', azul: '#1F3A5F', amarelo: '#FF8C42' },
];

function renderTemaTemplates() {
  const grid = document.getElementById('temaTemplatesGrid');
  if (!grid) return;
  const atual = JSON.parse(localStorage.getItem('site_cores') || '{}');
  grid.innerHTML = TEMA_TEMPLATES.map((t, i) => {
    const ativo = atual.azul === t.azul && atual.amarelo === t.amarelo;
    const ativoDefault = !atual.azul && t.nome === 'Clássico';
    return `
    <button type="button" onclick="aplicarTemplate(${i})"
      style="display:flex;flex-direction:column;gap:0;border:2px solid ${jscEsc(ativo || ativoDefault ? t.azul : '#e0e0e0')};border-radius:10px;overflow:hidden;cursor:pointer;background:#fff;padding:0;${jscEsc(ativo || ativoDefault ? 'box-shadow:0 0 0 2px ' + t.azul + '33' : '')}">
      <span style="display:flex;height:34px">
        <span style="flex:2;background:${jscEsc(t.azul)}"></span>
        <span style="flex:1;background:${jscEsc(t.amarelo)}"></span>
      </span>
      <span style="padding:6px 8px;font-size:0.72rem;font-weight:700;color:#333;display:flex;align-items:center;justify-content:center;gap:4px">
        ${jscEsc(t.nome)}${ativo || ativoDefault ? ' &#10003;' : ''}
      </span>
    </button>`;
  }).join('');
}

window.aplicarTemplate = function (idx) {
  const t = TEMA_TEMPLATES[idx];
  if (!t) return;
  document.getElementById('cfgCorAzul').value    = t.azul;
  document.getElementById('cfgCorAmarelo').value = t.amarelo;
  localStorage.setItem('site_cores', JSON.stringify({ azul: t.azul, amarelo: t.amarelo, template: t.nome }));
  renderTemaTemplates();
  showToast(`✓ Template "${t.nome}" aplicado! Abre o site para ver e "Publicar agora" para os visitantes.`, 'green');
};

function guardarAparencia() {
  const azul    = document.getElementById('cfgCorAzul').value;
  const amarelo = document.getElementById('cfgCorAmarelo').value;
  localStorage.setItem('site_cores', JSON.stringify({ azul, amarelo }));
  renderTemaTemplates();
  showToast('Cores aplicadas! Abre o site para ver e "Publicar agora" para os visitantes.', 'green');
}

function resetarCores() {
  localStorage.removeItem('site_cores');
  document.getElementById('cfgCorAzul').value    = '#003B8E';
  document.getElementById('cfgCorAmarelo').value = '#FFD100';
  renderTemaTemplates();
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
    historia:       ls('db_historia'),
    palmares:       ls('db_palmares'),
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
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `backup-campinense-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('✓ Backup completo exportado!', 'green');
}

// ==================================================
// LOGÓTIPOS DAS EQUIPAS
// ==================================================
// O db_logos é a única fonte da associação nome da equipa -> escudo, e
// continua a ser: isto é um editor dele, não uma segunda lista. Nenhum clube
// está escrito em código — a tabela é o que o mapa tiver, e uma equipa nova
// entra por uma linha nova no mapa.
//
// O slug e o nome do ficheiro são responsabilidade exclusiva do servidor: o
// painel envia o nome da equipa e o ficheiro, e usa o caminho que o
// api/logo.php devolver. Não monta caminhos.
const JSC_LOGO_PREFIXO_LOCAL = 'uploads/logos/';
const JSC_LOGO_TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/webp'];
const JSC_LOGO_EXT_ACEITAS   = ['png', 'jpg', 'jpeg', 'webp'];

function carregarLogos() {
  try {
    const d = JSON.parse(localStorage.getItem('db_logos') || '{}');
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  } catch (e) { return {}; }
}

// Grava o mapa e diz se conseguiu. Nunca finge sucesso: quem chama tem de
// olhar para o retorno, porque um localStorage cheio falha aqui e o painel
// não pode dizer que guardou.
function guardarLogos(mapa) {
  try {
    localStorage.setItem('db_logos', JSON.stringify(mapa));
    return true;
  } catch (e) {
    showToast('❌ NÃO foi possível guardar (' + e.name + '). O mapa ficou como estava.', 'red');
    alert('O navegador recusou gravar o mapa de logótipos: ' + e.name + '.\n\n'
      + 'Nada foi alterado. Liberte espaço — as imagens das notícias guardadas\n'
      + 'como ficheiro são o que costuma encher o armazém — e tente outra vez.');
    return false;
  }
}

// O caminho guardado é relativo à RAIZ do site — "uploads/logos/x.png" —
// porque é da raiz que as páginas públicas o pedem, e é esse valor que tem de
// ficar no db_logos. Mas o painel vive em /admin/, e aí o browser resolve o
// mesmo caminho como /admin/uploads/logos/x.png, que não existe: medido em
// produção, as duas únicas entradas LOCAL apareciam FALHOU enquanto todas as
// EXTERNO, que são absolutas, apareciam OK.
//
// Isto sobe um nível SÓ para a pré-visualização. O valor guardado não muda.
function jscLogoUrlPreview(valor) {
  const v = String(valor == null ? '' : valor).trim();
  if (!v) return '';
  if (/^(https?:)?\/\//i.test(v) || v.charAt(0) === '/') return v;
  return '../' + v;
}

function jscLogoOrigem(valor) {
  const v = String(valor == null ? '' : valor).trim();
  if (!v) return 'VAZIO';
  if (v.indexOf(JSC_LOGO_PREFIXO_LOCAL) === 0) return 'LOCAL';
  if (/^https?:\/\//i.test(v)) return 'EXTERNO';
  return 'OUTRO';
}

function renderLogos() {
  const tbody = document.getElementById('logosRows');
  if (!tbody) return;
  const mapa = carregarLogos();
  const chaves = Object.keys(mapa).sort();

  const resumo = document.getElementById('logosResumo');
  if (resumo) {
    const externos = chaves.filter((k) => jscLogoOrigem(mapa[k]) === 'EXTERNO').length;
    const locais   = chaves.filter((k) => jscLogoOrigem(mapa[k]) === 'LOCAL').length;
    resumo.textContent = chaves.length + ' equipa(s) no mapa — ' + locais + ' com ficheiro nosso, '
      + externos + ' ainda em endereço externo.';
  }

  if (!chaves.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;padding:24px">'
      + 'O mapa está vazio. Os escudos aparecem aqui quando se cola uma classificação, '
      + 'ou podem ser acrescentados em baixo.</td></tr>';
    return;
  }

  tbody.innerHTML = chaves.map(function (chave, i) {
    const valor  = String(mapa[chave] == null ? '' : mapa[chave]);
    const origem = jscLogoOrigem(valor);
    const cor = origem === 'LOCAL' ? '#16a34a' : (origem === 'EXTERNO' ? '#d97706' : '#64748b');
    // O estado "FALHOU" não se adivinha do valor: mede-se a carregar a
    // imagem. O onerror escreve na célula do estado desta linha.
    const img = valor
      ? '<img src="' + jscEscUrl(jscLogoUrlPreview(valor)) + '" alt="" style="width:34px;height:34px;object-fit:contain"'
        + ' onload="document.getElementById(\'logoEstado' + i + '\').textContent=\'OK\';'
        + 'document.getElementById(\'logoEstado' + i + '\').style.color=\'#16a34a\'"'
        + ' onerror="this.style.visibility=\'hidden\';'
        + 'document.getElementById(\'logoEstado' + i + '\').textContent=\'FALHOU\';'
        + 'document.getElementById(\'logoEstado' + i + '\').style.color=\'#dc2626\'">'
      : '<span style="color:#999;font-size:11px">sem escudo</span>';
    return '<tr>'
      + '<td><input type="text" id="logoChave' + i + '" value="' + jscEsc(chave) + '"'
        + ' style="width:100%;min-width:150px;font-weight:700">'
        + '<br><button class="btn-sm" style="margin-top:4px;font-size:10px"'
        + ' onclick="renomearLogo(' + i + ', \'' + jscEsc(chave) + '\')">Renomear</button></td>'
      + '<td style="text-align:center">' + img + '</td>'
      + '<td><span style="font-weight:700;font-size:11px;color:' + cor + '">' + origem + '</span></td>'
      + '<td id="logoEstado' + i + '" style="font-size:11px;color:#64748b">'
        + (valor ? 'a carregar…' : '—') + '</td>'
      + '<td style="min-width:260px">'
        + '<input type="text" id="logoValor' + i + '" value="' + jscEsc(valor) + '"'
          + ' placeholder="https://... ou uploads/logos/x.png" style="width:100%">'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">'
        + '<button class="btn-sm" style="font-size:10px"'
          + ' onclick="guardarLogoUrl(' + i + ', \'' + jscEsc(chave) + '\')">Guardar endereço</button>'
        + '<input type="file" id="logoFich' + i + '" accept="image/png,image/jpeg,image/webp"'
          + ' style="display:none" onchange="enviarLogo(' + i + ', \'' + jscEsc(chave) + '\')">'
        + '<button class="btn-sm" style="font-size:10px"'
          + ' onclick="document.getElementById(\'logoFich' + i + '\').click()">Carregar ficheiro</button>'
        + '<button class="btn-sm" style="font-size:10px"'
          + ' onclick="removerLogo(\'' + jscEsc(chave) + '\')">Remover do mapa</button>'
        + '</div></td>'
      + '</tr>';
  }).join('');
}

function _jscLogoAviso(texto) {
  const el = document.getElementById('logosAviso');
  if (!el) return;
  if (!texto) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = '';
  el.textContent = texto;
}

window.renderLogos = renderLogos;

window.adicionarLogo = function () {
  const nome  = (document.getElementById('logoNovaEquipa') || {}).value || '';
  const valor = (document.getElementById('logoNovoValor')  || {}).value || '';
  const chave = nome.trim().toLowerCase();
  if (!chave) { showToast('Escreva o nome da equipa.', 'red'); return; }
  const mapa = carregarLogos();
  if (Object.prototype.hasOwnProperty.call(mapa, chave)) {
    showToast('Já existe uma linha para "' + chave + '".', 'red');
    return;
  }
  mapa[chave] = valor.trim();
  if (!guardarLogos(mapa)) return;
  document.getElementById('logoNovaEquipa').value = '';
  document.getElementById('logoNovoValor').value = '';
  renderLogos();
  showToast('Equipa "' + chave + '" acrescentada ao mapa.', 'green');
};

window.guardarLogoUrl = function (i, chave) {
  const valor = ((document.getElementById('logoValor' + i) || {}).value || '').trim();
  if (/^\s*data\s*:/i.test(valor)) {
    showToast('Endereços data: não são aceites aqui. Use um ficheiro.', 'red');
    return;
  }
  if (/\.svg(\?|$)/i.test(valor)) {
    showToast('SVG não é aceite: um SVG pode executar script.', 'red');
    return;
  }
  const mapa = carregarLogos();
  if (!Object.prototype.hasOwnProperty.call(mapa, chave)) {
    showToast('Essa equipa já não está no mapa. Recarregue a lista.', 'red');
    return;
  }
  mapa[chave] = valor;                 // só esta entrada
  if (!guardarLogos(mapa)) return;
  renderLogos();
  showToast('Endereço de "' + chave + '" guardado. Não foi publicado.', 'green');
};

// Renomear uma equipa. Se o escudo for LOCAL, o ficheiro no servidor continua
// com o nome antigo e o registo de donos com o dono antigo — e o upload
// seguinte dessa equipa bateria contra o seu próprio ficheiro, dando conflito.
// Por isso pede-se primeiro a transferência de propriedade ao servidor, e a
// chave do db_logos só muda se ela correr bem. Num escudo EXTERNO não há
// ficheiro nosso nem dono a transferir: muda só o mapa.
window.renomearLogo = async function (i, chaveAntiga) {
  const nova = ((document.getElementById('logoChave' + i) || {}).value || '').trim().toLowerCase();
  if (!nova) { showToast('O nome não pode ficar vazio.', 'red'); return; }
  if (nova === chaveAntiga) { showToast('O nome é o mesmo.'); return; }
  const mapa = carregarLogos();
  if (Object.prototype.hasOwnProperty.call(mapa, nova)) {
    showToast('Já existe uma linha para "' + nova + '".', 'red');
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(mapa, chaveAntiga)) {
    showToast('Essa equipa já não está no mapa. Recarregue a lista.', 'red');
    return;
  }

  const valor = String(mapa[chaveAntiga] == null ? '' : mapa[chaveAntiga]);
  _jscLogoAviso('');

  if (jscLogoOrigem(valor) === 'LOCAL') {
    let resp = null, json = {};
    try {
      const fd = new FormData();
      fd.append('acao', 'transferir');
      fd.append('dono_antigo', chaveAntiga);
      fd.append('dono_novo', nova);
      fd.append('caminho', valor);
      resp = await fetch('../api/logo.php', {
        method: 'POST',
        headers: { 'X-JSC-Painel': '1' },
        credentials: 'same-origin',
        body: fd,
      });
      try { json = await resp.json(); } catch (_) { json = {}; }
    } catch (e) {
      showToast('\u274c Sem ligação ao servidor: ' + e.message
        + '. O nome ficou como estava.', 'red');
      return;
    }
    if (!resp.ok || !json || json.ok !== true) {
      const c = json && json.conflito ? json.conflito : {};
      _jscLogoAviso('A TRANSFERÊNCIA DE DONO FALHOU — o nome NÃO foi alterado. '
        + ((json && json.error) || ('erro ' + resp.status))
        + (c.dono ? ' O ficheiro "' + c.slug + '" está registado a "' + c.dono + '".' : '')
        + ' O db_logos ficou exactamente como estava.');
      showToast('\u274c ' + ((json && json.error) || ('erro ' + resp.status))
        + '. Nada foi alterado.', 'red');
      return;
    }
  }

  // Só agora, e só estas duas entradas.
  mapa[nova] = mapa[chaveAntiga];
  delete mapa[chaveAntiga];
  if (!guardarLogos(mapa)) return;
  renderLogos();
  showToast('"' + chaveAntiga + '" passou a "' + nova + '".'
    + (jscLogoOrigem(valor) === 'LOCAL'
      ? ' O dono do ficheiro no servidor foi transferido; o nome do ficheiro não muda.'
      : ''), 'green');
};

window.removerLogo = function (chave) {
  if (!confirm('Remover "' + chave + '" do mapa de logótipos?\n\n'
    + 'A equipa passa a aparecer com as iniciais. O ficheiro no servidor NÃO é apagado.')) return;
  const mapa = carregarLogos();
  if (!Object.prototype.hasOwnProperty.call(mapa, chave)) { renderLogos(); return; }
  delete mapa[chave];
  if (!guardarLogos(mapa)) return;
  renderLogos();
  showToast('"' + chave + '" removida do mapa. O ficheiro ficou no servidor.', 'green');
};

// Envia o ficheiro ao api/logo.php e, só com resposta válida, escreve no
// db_logos o caminho QUE O SERVIDOR DEVOLVEU. O painel não monta caminhos e
// não calcula slugs.
window.enviarLogo = async function (i, chave) {
  const input = document.getElementById('logoFich' + i);
  const f = input && input.files && input.files[0];
  if (!f) return;
  const limpar = () => { try { input.value = ''; } catch (_) {} };

  // Primeira peneira, no browser: o servidor volta a validar tudo, e é a dele
  // que conta. Isto é só para não enviar o que já se sabe que não serve.
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (/svg/i.test(f.type) || ext === 'svg') {
    showToast('SVG não é aceite: um SVG pode executar script.', 'red');
    limpar(); return;
  }
  if (JSC_LOGO_EXT_ACEITAS.indexOf(ext) === -1
      || (f.type && JSC_LOGO_TIPOS_ACEITOS.indexOf(f.type) === -1)) {
    showToast('Só PNG, JPEG ou WebP. Este ficheiro é "' + (f.type || ext) + '".', 'red');
    limpar(); return;
  }

  _jscLogoAviso('');
  showToast('A enviar o escudo de "' + chave + '"…');
  let resp = null, json = {};
  try {
    const fd = new FormData();
    fd.append('equipa', chave);
    fd.append('ficheiro', f, f.name);
    resp = await fetch('../api/logo.php', {
      method: 'POST',
      headers: { 'X-JSC-Painel': '1' },
      credentials: 'same-origin',
      body: fd,
    });
    try { json = await resp.json(); } catch (_) { json = {}; }
  } catch (e) {
    showToast('❌ Sem ligação ao servidor: ' + e.message + '. O mapa ficou como estava.', 'red');
    limpar(); return;
  }

  // Conflito de slug: o servidor não substituiu nada, e o painel mostra-o por
  // inteiro em vez de o esconder atrás de "erro ao carregar".
  if (resp.status === 409 && json && json.codigo === 'conflito') {
    const c = json.conflito || {};
    _jscLogoAviso('CONFLITO DE NOME DE FICHEIRO — nada foi alterado. O nome "' + c.slug
      + '" já pertence a ' + (c.dono ? '"' + c.dono + '"' : 'um ficheiro sem registo de dono')
      + ', e "' + c.pedido + '" daria o mesmo nome. Para resolver: renomeie uma das equipas de'
      + ' forma a que os nomes deixem de coincidir, ou apague o ficheiro antigo no servidor.');
    showToast('❌ Conflito de nome: nada foi alterado.', 'red');
    limpar(); return;
  }
  if (!resp.ok || !json || json.ok !== true || typeof json.caminho !== 'string' || !json.caminho) {
    showToast('❌ ' + ((json && json.error) || ('erro ' + resp.status))
      + '. O mapa ficou como estava.', 'red');
    limpar(); return;
  }

  // Só agora se toca no mapa, e só nesta entrada.
  const mapa = carregarLogos();
  const antes = JSON.stringify(mapa);
  const chaveFinal = typeof json.chave === 'string' && json.chave ? json.chave : chave;
  mapa[chaveFinal] = json.caminho;
  if (!guardarLogos(mapa)) { limpar(); return; }
  const depois = carregarLogos();
  const mudadas = Object.keys(JSON.parse(antes)).filter(function (k) {
    return JSON.parse(antes)[k] !== depois[k];
  });

  if (Array.isArray(json.restos) && json.restos.length) {
    _jscLogoAviso('Ficou no servidor um ficheiro de formato anterior desta equipa: '
      + json.restos.join(', ') + '. Não é apagado por esta operação — o db_logos aponta para o'
      + ' novo, e o antigo pode ser removido à mão no alojamento.');
  }
  limpar();
  renderLogos();
  showToast('✓ Escudo de "' + chaveFinal + '" guardado em ' + json.caminho
    + ' (' + json.largura + '×' + json.altura + ', ' + json.bytes + ' bytes). '
    + mudadas.length + ' entrada(s) alterada(s). Não foi publicado.', 'green');
};

// ==================================================
// REPOR DO SERVIDOR
// ==================================================
// Recuperar o armazém deste browser a partir do que está publicado, quando o
// localStorage se perdeu — limpeza de dados do site, despejo do browser, outro
// perfil. Medido em produção: 34 chaves reduzidas a três.
//
// O js/sync.js, que normalmente traria isto, está proibido de o fazer num
// browser-painel: a guarda ehPainel() existe para não sobrepor rascunhos (ver
// o comentário em js/sync.js:48). Logo, num painel que perca os dados não há
// caminho automático de volta — é este botão.
//
// Só lê do servidor. Não publica, não faz POST, não chama o
// publicarNoServidor(), não altera o data/db.json.
//
// IMPORTANTE, e dito ao utilizador antes de escrever: o /api/load.php devolve a
// PROJEÇÃO PÚBLICA, não o ficheiro do servidor. Rascunhos e notícias agendadas,
// campos privados dos atletas e dos treinadores, inscrições e mensagens não
// estão lá e não voltam por aqui.
const JSC_REPOR_AREAS = [
  { campo: 'noticias',       chave: 'jsc_noticias',      nome: 'Notícias (só as publicadas)' },
  { campo: 'jogos',          chave: 'db_jogos',          nome: 'Jogos' },
  { campo: 'atletas',        chave: 'db_atletas',        nome: 'Atletas (só campos públicos)' },
  { campo: 'escaloes',       chave: 'db_escaloes',       nome: 'Escalões' },
  { campo: 'treinadores',    chave: 'db_treinadores',    nome: 'Treinadores (só campos públicos)' },
  { campo: 'modalidades',    chave: 'db_modalidades',    nome: 'Modalidades (só activas)' },
  { campo: 'modPosts',       chave: 'db_mod_posts',      nome: 'Publicações de modalidades' },
  { campo: 'patrocinadores', chave: 'db_patrocinadores', nome: 'Patrocinadores (só activos)' },
  { campo: 'galeria',        chave: 'db_galeria',        nome: 'Galeria (só activa)' },
  { campo: 'videos',         chave: 'db_videos',         nome: 'Vídeos (só activos)' },
  { campo: 'agenda',         chave: 'db_agenda',         nome: 'Agenda' },
  { campo: 'historia',       chave: 'db_historia',       nome: 'História' },
  { campo: 'palmares',       chave: 'db_palmares',       nome: 'Palmarés' },
  { campo: 'seniores',       chave: 'db_seniores',       nome: 'Seniores' },
  { campo: 'senioresInfo',   chave: 'db_seniores_info',  nome: 'Seniores (ficha)' },
  { campo: 'siteConfig',     chave: 'site_config',       nome: 'Configuração do site' },
  { campo: 'dadosClube',     chave: 'dados_clube',       nome: 'Dados do clube' },
  { campo: 'sitePopup',      chave: 'site_popup',        nome: 'Popup' },
  { campo: 'siteBanner',     chave: 'site_banner',       nome: 'Banner' },
  { campo: 'siteAviso',      chave: 'site_aviso',        nome: 'Aviso' },
  { campo: 'siteCores',      chave: 'site_cores',        nome: 'Cores' },
  { campo: 'siteLegal',      chave: 'site_legal',        nome: 'Textos legais' },
  { campo: 'siteManutencao', chave: 'site_manutencao',   nome: 'Manutenção' },
  { campo: 'fbPosts',        chave: 'fb_posts',          nome: 'Publicações Facebook' },
  { campo: 'logos',          chave: 'db_logos',          nome: 'Logótipos das equipas' },
  { campo: 'classConfig',    chave: 'fpf_sync_config',   nome: 'Séries das classificações' },
];

// O que esta função não escreve, nunca, e porquê. Fica em código e não só em
// comentário para a bateria o poder verificar.
const JSC_REPOR_NAO_TOCAR = [
  { chave: 'email_config',
    porque: 'a projeção pública não traz o segredo — repor deixava a configuração sem ele' },
  { chave: 'fpf_class_* / fpf_jogos_*',
    porque: 'dados auxiliares das colagens; ficam exactamente como estão' },
  { chave: 'jsc_publicado_em',
    porque: 'não é conteúdo, é a marca de actualidade dos blocos gerados' },
];

const JSC_PALAVRA_SUBSTITUIR = 'SUBSTITUIR';

function _jscReporDimensao(v) {
  if (Array.isArray(v)) return v.length + ' registo(s)';
  if (v && typeof v === 'object') return Object.keys(v).length + ' campo(s)';
  if (v === null || v === undefined || v === '') return 'vazio';
  return '1 valor';
}

function _jscReporParse(bruto) {
  try { return JSON.parse(bruto); } catch (_) { return bruto; }
}

// Comparar o que o servidor tem com o que este browser tem, área a área.
// Separada da acção de propósito: a bateria mede-a sem tocar em nada.
function jscCompararComServidor(dados) {
  const criar = [], diferentes = [], iguais = [], soLocal = [], semNenhum = [];
  JSC_REPOR_AREAS.forEach(function (a) {
    const temServidor = Object.prototype.hasOwnProperty.call(dados, a.campo)
      && dados[a.campo] !== null && dados[a.campo] !== undefined;
    const bruto = localStorage.getItem(a.chave);
    const linha = {
      campo: a.campo, chave: a.chave, nome: a.nome,
      servidor: temServidor ? _jscReporDimensao(dados[a.campo]) : '—',
      local: bruto === null ? '(ausente)' : _jscReporDimensao(_jscReporParse(bruto)),
      valorNovo: temServidor ? JSON.stringify(dados[a.campo]) : null,
      valorAntigo: bruto,
    };
    if (!temServidor) { (bruto === null ? semNenhum : soLocal).push(linha); return; }
    if (bruto === null) { criar.push(linha); return; }
    if (bruto === linha.valorNovo) { iguais.push(linha); return; }
    diferentes.push(linha);
  });
  return { criar: criar, diferentes: diferentes, iguais: iguais, soLocal: soLocal, semNenhum: semNenhum };
}

async function reporDoServidor() {
  if (MODO_LOCAL) {
    showToast('Modo local: repor precisa de PHP a correr no servidor.', 'red');
    return;
  }

  let dados = null;
  try {
    const r = await fetch('../api/load.php', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    dados = await r.json();
  } catch (e) {
    showToast('❌ Não foi possível ler o servidor: ' + e.message, 'red');
    return;
  }
  if (!dados || typeof dados !== 'object' || !Object.keys(dados).length) {
    showToast('O servidor não tem conteúdo publicado — não há nada para repor.', 'red');
    return;
  }

  const c = jscCompararComServidor(dados);
  const linha = function (x, acao) {
    return '  • ' + x.nome + ': servidor ' + x.servidor + ', aqui ' + x.local + '  → ' + acao;
  };
  const partes = [];
  if (c.criar.length)      partes.push('A CRIAR (não existem aqui):\n' + c.criar.map(function (x) { return linha(x, 'CRIAR'); }).join('\n'));
  if (c.diferentes.length) partes.push('DIFERENTES (ficam como estão nesta passagem):\n' + c.diferentes.map(function (x) { return linha(x, 'MANTER'); }).join('\n'));
  if (c.iguais.length)     partes.push('IGUAIS: ' + c.iguais.length + ' área(s) — nada a fazer');
  if (c.soLocal.length)    partes.push('SÓ AQUI (o servidor não as tem): ' + c.soLocal.map(function (x) { return x.nome; }).join(', '));

  if (!c.criar.length && !c.diferentes.length) {
    alert('Comparação com o servidor\n\n' + partes.join('\n\n')
      + '\n\nNão há nada para repor: tudo o que o servidor tem já existe aqui.');
    showToast('Nada para repor — o armazém deste browser já tem o que o servidor tem.');
    return;
  }

  const aviso = 'O que esta operação NÃO recupera, porque o servidor não o entrega:\n'
    + '  • rascunhos e notícias agendadas — só voltam as publicadas\n'
    + '  • campos privados dos atletas e treinadores (datas de nascimento, contactos,\n'
    + '    encarregados de educação)\n'
    + '  • registos inactivos da galeria, vídeos, modalidades e patrocinadores\n'
    + '  • inscrições, mensagens e a configuração de e-mail\n\n'
    + 'Não toca em: ' + JSC_REPOR_NAO_TOCAR.map(function (x) { return x.chave; }).join(', ') + '.\n'
    + 'Não publica nada e não altera o servidor.';

  if (!confirm('REPOR DO SERVIDOR\n\n' + partes.join('\n\n') + '\n\n' + aviso
      + '\n\nCriar as ' + c.criar.length + ' área(s) que não existem aqui?\n'
      + 'Nada do que já existe neste browser é substituído.')) {
    showToast('Reposição cancelada. Nada foi alterado.', 'red');
    return;
  }

  // Substituir o que já existe é outra decisão, e mais difícil de tomar por
  // engano: a chave local pode ter rascunhos que o servidor não devolve.
  let substituir = [];
  if (c.diferentes.length) {
    const resposta = prompt(
      'Estas ' + c.diferentes.length + ' área(s) existem aqui com conteúdo DIFERENTE do servidor:\n\n'
      + c.diferentes.map(function (x) { return linha(x, 'substituir?'); }).join('\n')
      + '\n\nSubstituir apaga o que este browser tem, rascunhos incluídos, e põe a\n'
      + 'versão publicada. Deixar em branco ou cancelar mantém-nas intactas.\n\n'
      + 'Para substituir, escreve ' + JSC_PALAVRA_SUBSTITUIR + ' em maiúsculas:', '');
    if (resposta !== null && resposta.trim() === JSC_PALAVRA_SUBSTITUIR) substituir = c.diferentes;
  }

  const aEscrever = c.criar.concat(substituir);
  if (!aEscrever.length) {
    showToast('Nada foi escrito.', 'red');
    return;
  }

  // Backup primeiro, e de tudo o que vai ser tocado. Se não couber, aborta-se
  // sem escrever nada: uma reposição sem rede de volta não se faz.
  const marca = 'jsc_reposicao_' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const antes = {};
  aEscrever.forEach(function (x) { antes[x.chave] = x.valorAntigo; });
  try {
    localStorage.setItem(marca, JSON.stringify({ quando: new Date().toISOString(), chaves: antes }));
  } catch (e) {
    showToast('❌ Não foi possível gravar o backup (' + e.name + '). Nada foi reposto.', 'red');
    alert('A reposição foi abortada antes de escrever qualquer coisa: não houve espaço para\n'
      + 'guardar o estado anterior em ' + marca + '.\n\nO armazém deste browser está como estava.');
    return;
  }

  const falhas = [];
  let feitas = 0;
  aEscrever.forEach(function (x) {
    try { localStorage.setItem(x.chave, x.valorNovo); feitas++; }
    catch (e) { falhas.push(x.chave + ' (' + e.name + ')'); }
  });

  const resumo = feitas + ' área(s) reposta(s): ' + c.criar.length + ' criada(s), '
    + substituir.length + ' substituída(s). Estado anterior guardado em ' + marca + '.';
  showToast('✓ ' + resumo + (falhas.length ? ' Falharam: ' + falhas.join(', ') + '.' : ''),
    falhas.length ? 'red' : 'green');
  alert(resumo + (falhas.length ? '\n\nFalharam: ' + falhas.join(', ') : '')
    + '\n\nNada foi publicado e o servidor não foi alterado.\n'
    + 'A página vai recarregar para o painel ler o que foi reposto.');
  setTimeout(function () { location.reload(); }, 800);
}
window.reporDoServidor = reporDoServidor;

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
      lsSet('db_historia',      d.historia);
      lsSet('db_palmares',      d.palmares);
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
      <td><strong>${jscEsc(m.nome)}</strong></td>
      <td style="font-size:0.85rem">${jscEsc(m.treinos || '—')}</td>
      <td style="font-size:0.85rem">${jscEsc(m.local || '—')}</td>
      <td style="font-size:0.85rem">${jscEsc(m.responsavel || '—')}</td>
      <td>${m.ativo !== false ? '<span class="status status--aprovado">Ativa</span>' : '<span class="status status--rejeitado">Inativa</span>'}</td>
      <td>
        <button class="btn-sm" onclick="gerirPostsMod(${m.id})">&#128196; Posts${jscEsc(nPosts ? ' ('+nPosts+')' : '')}</button>
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
        <input class="form-input" type="text" id="mNome" value="${jscEsc(m.nome)}" placeholder="Ex: Kickboxing, Judo, Natação..." />
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
        <textarea class="form-input" id="mDesc" rows="3" placeholder="Breve descrição da modalidade...">${jscEsc(m.descricao || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="modal-field">
          <label class="form-label">Horários de treino</label>
          <input class="form-input" type="text" id="mTreinos" value="${jscEsc(m.treinos || '')}" placeholder="Dias e hora dos treinos" />
        </div>
        <div class="modal-field">
          <label class="form-label">Local</label>
          <input class="form-input" type="text" id="mLocal" value="${jscEsc(m.local || '')}" placeholder="Local dos treinos" />
        </div>
      </div>
      <div class="modal-field">
        <label class="form-label">Responsável / Treinador</label>
        <input class="form-input" type="text" id="mResponsavel" value="${jscEsc(m.responsavel || '')}" placeholder="Nome do responsável" />
      </div>
      <div class="modal-field">
        <label class="form-label">Imagem de fundo (URL ou upload)</label>
        <input class="form-input" type="text" id="mImagem" value="${jscEsc(m.imagem || '')}" placeholder="https://..." />
        <input type="file" id="mFicheiro" accept="image/*" style="display:none" />
        <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mFicheiro').click()">&#128190; Carregar imagem</button>
        <div id="mPreview" style="${jscEsc(m.imagem ? '' : 'display:none')};margin-top:8px;position:relative;display:${jscEsc(m.imagem?'':'none')}">
          <img src="${jscEscUrl(m.imagem || '')}" style="max-height:100px;border-radius:6px;object-fit:cover" />
          <button type="button" class="btn-sm btn-sm--danger" style="margin-left:8px;vertical-align:top" onclick="document.getElementById('mImagem').value='';document.getElementById('mPreview').style.display='none'">Remover</button>
        </div>
      </div>
      <div class="modal-field">
        <label class="form-label">Posição da imagem</label>
        <select class="form-input" id="mImgPos">
          <option value="center" ${jscEsc((m.imagemPos||'center')==='center'?'selected':'')}>Centro</option>
          <option value="top" ${jscEsc(m.imagemPos==='top'?'selected':'')}>Topo</option>
          <option value="bottom" ${jscEsc(m.imagemPos==='bottom'?'selected':'')}>Base</option>
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="mAtivo" ${jscEsc(m.ativo !== false ? 'checked' : '')} style="width:16px;height:16px" />
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
  // O nome é procurado a partir do id. Antes vinha interpolado dentro do
  // atributo onclick, e um nome com uma plica escapava da string e passava
  // a ser código executado ao carregar no botão.
  if (modNome === undefined) {
    const _m = (DB.modalidades || []).find(x => String(x.id) === String(modId));
    modNome = _m ? _m.nome : '';
  }
  function buildList() {
    const posts = loadModPosts().filter(p => p.modalidadeId == modId)
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const rows = posts.length
      ? posts.map(p => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:0.93rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${jscEsc(p.titulo)}</div>
              <div style="font-size:0.78rem;color:#888">${jscEsc(p.data || '')} · ${p.publicada ? '<span style="color:#22a75e">Publicado</span>' : '<span style="color:#e05">Rascunho</span>'}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn-sm" onclick="abrirFormPostMod(${modId},'${modNome.replace(/'/g,"\\'")}',${jscEsc(p.id)})">Editar</button>
              <button class="btn-sm btn-sm--danger" onclick="deletePostMod(${modId},'${modNome.replace(/'/g,"\\'")}',${jscEsc(p.id)})">&#128465;</button>
            </div>
          </div>`).join('')
      : `<p style="color:#999;text-align:center;padding:24px 0">Sem publicações. Crie a primeira!</p>`;
    return `<div style="max-height:320px;overflow-y:auto">${rows}</div>`;
  }

  openModal(
    `Publicações — ${modNome}`,
    buildList(),
    `<button class="btn-save" onclick="abrirFormPostMod(${modId},'${modNome.replace(/'/g,"\\'")}',null)">+ Nova publicação</button>
     <a href="../modalidade.html?id=${jscEscUrl(modId)}" target="_blank" class="btn-cancel" style="text-decoration:none">Ver página &#8599;</a>
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
        <input class="form-input" type="text" id="mpTitulo" value="${jscEsc(p.titulo || '')}" placeholder="Título da publicação" />
      </div>
      <div class="modal-field">
        <label class="form-label">Texto / Conteúdo</label>
        <textarea class="form-input" id="mpTexto" rows="5" placeholder="Conteúdo da publicação...">${jscEsc(p.texto || '')}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="modal-field">
          <label class="form-label">Data</label>
          <input class="form-input" type="date" id="mpData" value="${jscEsc(p.data || new Date().toISOString().slice(0,10))}" />
        </div>
        <div class="modal-field">
          <label class="form-label">Estado</label>
          <select class="form-input" id="mpPublicada">
            <option value="1" ${jscEsc(p.publicada ? 'selected' : '')}>Publicado</option>
            <option value="0" ${jscEsc(!p.publicada && postId ? 'selected' : '')}>Rascunho</option>
          </select>
        </div>
      </div>
      <div class="modal-field">
        <label class="form-label">Imagem (URL ou upload)</label>
        <input class="form-input" type="text" id="mpImagem" value="${jscEsc(p.imagem || '')}" placeholder="https://..." oninput="previewModPostImg(this.value)" />
        <input type="file" id="mpFicheiro" accept="image/*" style="display:none" onchange="uploadModPostImg(this)" />
        <button type="button" class="btn-sm" style="margin-top:6px" onclick="document.getElementById('mpFicheiro').click()">&#128190; Carregar</button>
      </div>
      <div class="modal-field">
        <label class="form-label">Tamanho</label>
        <select class="form-input" id="mpImagemSize" onchange="updateModPostPreview()">
          <option value="cover"   ${jscEsc(curSize==='cover'   ?'selected':'')}>Preencher (recortar)</option>
          <option value="contain" ${jscEsc(curSize==='contain' ?'selected':'')}>Completa (sem recorte)</option>
        </select>
      </div>
      <input type="hidden" id="mpImagemPos" value="${jscEsc(curPos)}" />
      <div id="mpPreview" style="${jscEsc(p.imagem ? '' : 'display:none')}">
        <label class="form-label" style="margin-bottom:4px;display:block">
          Pré-visualização
          <small style="color:#888;font-weight:400;margin-left:6px">— clique na imagem para definir o ponto focal</small>
        </label>
        <div id="mpPreviewWrap" style="position:relative;border-radius:8px;overflow:hidden;background:#1a3a80;height:220px;cursor:crosshair">
          <img id="mpPreviewImg" src="${jscEscUrl(p.imagem || '')}"
            style="width:100%;height:100%;object-fit:${jscEsc(curSize==='contain'?'contain':'cover')};object-position:${jscEsc(curPos)};pointer-events:none;display:block" />
          <div id="mpFocalPin" style="position:absolute;left:${jscEsc(pct[0])}%;top:${jscEsc(pct[1])}%;transform:translate(-50%,-50%);pointer-events:none;z-index:3;display:${jscEsc(p.imagem?'block':'none')}">
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
    `<button class="btn-save" onclick="savePostMod(${modId},'${modNome.replace(/'/g,"\\'")}',${jscEsc(postId||null)})">Guardar</button>
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
          nome: 'Teste Admin', email: cfg.dest || 'admin@campinense.pt',
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

  // ---- Jogos, resultados e classificação da Equipa Sénior ----
  // Os cinco botões chamam funções que já existem. As de colar e a do editor
  // manual são as mesmas da Formação, com o escalão 'Seniores' e sem série —
  // é por isso que o modal de colagem teve de sair de dentro do #page-jogos:
  // o goToPage() esconde essa secção, e lá dentro ele não aparecia.
  const ligar = (id, fn) => {
    const el = document.getElementById(id);
    if (el && !el._bound) { el._bound = true; el.addEventListener('click', fn); }
  };
  ligar('btnNovoJogoSenior',    () => novoJogoSenior());
  ligar('btnColarJogosSenior',  () => abrirColar(JSC_SENIOR_ESCALAO, 'jogos', ''));
  ligar('btnColarClassSenior',  () => abrirColar(JSC_SENIOR_ESCALAO, 'class', ''));
  ligar('btnEditarClassSenior', () => abrirEditorClass(JSC_SENIOR_ESCALAO, ''));
  ligar('btnApagarClassSenior', () => apagarClassSenior());
  ligar('btnRevisaoSenior',     () => abrirRevisaoSenior());

  renderJogosSenior();
  renderClassSeniorResumo();
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
    <tr data-id="${jscEsc(j.id)}">
      <td><strong>${jscEsc(j.numero || '—')}</strong></td>
      <td>${jscEsc(j.nome)}</td>
      <td><span class="badge" style="${posBadgeStyle(j.posicao)}">${jscEsc(j.posicaoFull || j.posicao)}</span></td>
      <td>${j.foto ? `<img src="${jscEscUrl(j.foto)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : '<span style="color:#aaa">—</span>'}</td>
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
          <input class="form-control" id="fldJNome" value="${jscEsc(j.nome)}">
        </div>
        <div class="form-group">
          <label class="form-label">Número</label>
          <input class="form-control" id="fldJNumero" type="number" min="1" max="99" value="${jscEsc(j.numero)}">
        </div>
        <div class="form-group">
          <label class="form-label">Posição</label>
          <select class="form-control" id="fldJPosicao">
            ${posicoes.map(p => `<option value="${jscEsc(p.val)}" ${jscEsc(j.posicao===p.val?'selected':'')}>${jscEsc(p.label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado</label>
          <select class="form-control" id="fldJAtivo">
            <option value="1" ${jscEsc(j.ativo!==false?'selected':'')}>Ativo</option>
            <option value="0" ${jscEsc(j.ativo===false?'selected':'')}>Inativo</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">Foto (URL ou upload)</label>
        <div style="display:flex;gap:12px;align-items:center">
          <input class="form-control" id="fldJFotoUrl" placeholder="https://..." value="${jscEsc(j.foto||'')}" style="flex:1">
          <label class="btn-icon" style="cursor:pointer;padding:8px 12px;background:#f0f0f0;border-radius:8px">
            &#128247;
            <input type="file" accept="image/*" id="fldJFotoFile" style="display:none">
          </label>
        </div>
        <div id="fldJFotoPreview" style="margin-top:10px;${jscEsc(j.foto?'':'display:none')}">
          <img id="fldJFotoImg" src="${jscEscUrl(j.foto||'')}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #e0e0e0">
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
      <strong>${jscEsc(players.length)}</strong> jogadores reconhecidos
      · <span style="color:#16a34a">${jscEsc(novos)} novos</span>
      ${dups ? `· <span style="color:#d97706">${jscEsc(dups)} duplicados</span>` : ''}
      ${comFoto ? `· <span style="color:#2563eb">${jscEsc(comFoto)} com foto</span>` : ''}
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
          ? `<img src="${jscEscUrl(p.foto)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'">`
          : `<div style="width:32px;height:32px;border-radius:50%;background:#003B8E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700">${p.nome.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>`;
        return `<tr style="border-bottom:1px solid #eee${jscEsc(dup?';opacity:0.55':'')}">
          <td style="padding:4px 8px">${avatar}</td>
          <td style="padding:4px 10px;color:#888">${jscEsc(p.numero || '—')}</td>
          <td style="padding:4px 10px;font-weight:600">${jscEsc(p.nome)}</td>
          <td style="padding:4px 10px"><span style="${posBadgeStyle(p.posicao)}">${jscEsc(p.posicaoFull)}</span></td>
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
      Modo: <strong>${jscEsc(hasZZ ? 'ZeroZero (grupos por posição detectados)' : 'Genérico')}</strong>
      &nbsp;·&nbsp; ${jscEsc(text.split('\n').filter(l=>l.trim()).length)} linhas
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
      `<button class="tab-filter${jscEsc(e === _formacaoEscalao ? ' active' : '')}" data-ef="${jscEsc(e)}">${jscEsc(e)}</button>`
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
      <strong>${jscEsc(players.length)}</strong> jogadores · <span style="color:#16a34a">${jscEsc(novos)} novos</span>
      ${dups ? `· <span style="color:#d97706">${jscEsc(dups)} duplicados</span>` : ''}
      ${comFoto ? `· <span style="color:#2563eb">${jscEsc(comFoto)} com foto</span>` : ''}
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
          ? `<img src="${jscEscUrl(p.foto)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'">`
          : `<div style="width:32px;height:32px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700">${p.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>`;
        return `<tr style="border-bottom:1px solid #eee${jscEsc(dup?';opacity:0.55':'')}">
          <td style="padding:4px 8px">${avatar}</td>
          <td style="padding:4px 10px;color:#888">${jscEsc(p.numero||'—')}</td>
          <td style="padding:4px 10px;font-weight:600">${jscEsc(p.nome)}</td>
          <td style="padding:4px 10px">${jscEsc(p.posicao||'—')}</td>
          <td style="padding:4px 10px;color:#888;font-size:0.8rem">${jscEsc(p.dataNascimento||'—')}</td>
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
    <div style="font-size:0.8rem;color:#555;margin-bottom:6px">Modo: <strong>${jscEsc(modo)}</strong> · ${jscEsc(text.split('\n').filter(l=>l.trim()).length)} linhas</div>
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
      <span style="color:#16a34a;font-weight:600">${jscEsc(matched.length)} datas novas</span>
      ${updated.length ? `· <span style="color:#d97706;font-weight:600">${jscEsc(updated.length)} a atualizar</span>` : ''}
      ${already.length ? `· <span style="color:#888">${jscEsc(already.length)} já tinham data</span>` : ''}
      ${noMatch.length ? `· <span style="color:#c00">${jscEsc(noMatch.length)} sem correspondência</span>` : ''}
      · ${jscEsc(fpfList.length)} jogadores na FPF
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
        else { status = `Atualizar (era ${jscEsc(m.atleta.dataNascimento)})`; statusColor = '#d97706'; }
        return `<tr style="border-bottom:1px solid #eee">
          <td style="padding:5px 10px">${jscEsc(m.fpf.nome)}</td>
          <td style="padding:5px 10px;color:#7c3aed;font-weight:600">${jscEsc(m.fpf.dataNascimento)}</td>
          <td style="padding:5px 10px;color:#555">${jscEsc(m.atleta ? m.atleta.nome : '—')}</td>
          <td style="padding:5px 10px;color:${jscEsc(statusColor)};font-size:0.78rem;font-weight:600">${jscEsc(status)}</td>
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
          <input class="form-control" id="fmInfoDesig" value="${jscEsc(e.designacao || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Faixa Etária</label>
          <input class="form-control" id="fmInfoFaixa" value="${jscEsc(e.faixa || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Treinador Principal</label>
          <input class="form-control" id="fmInfoTreinador" value="${jscEsc(e.treinador || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Horários de Treino</label>
          <input class="form-control" id="fmInfoTreinos" value="${jscEsc(e.treinos || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Competição / Liga</label>
          <input class="form-control" id="fmInfoComp" value="${jscEsc(e.competicao || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Local de Treino</label>
          <input class="form-control" id="fmInfoLocal" value="${jscEsc(e.local || '')}">
        </div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">Descrição</label>
        <textarea class="form-control" id="fmInfoDesc" rows="2">${jscEsc(e.descricao || '')}</textarea>
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
      ? `<img src="${jscEscUrl(a.foto)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e5e7eb" onerror="this.style.display='none'">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700">${a.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>`;
    const dateFmt = a.dataNascimento ? new Date(a.dataNascimento+'T00:00:00').toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `<tr${isAniv?' style="background:#fffbeb"':''}>
      <td style="padding:6px 8px">${avatar}</td>
      <td><strong>${jscEsc(a.numero || '—')}</strong></td>
      <td>${jscEsc(a.nome)}${jscEsc(isAniv?' 🎂':'')}</td>
      <td>${jscEsc(a.posicao || '—')}</td>
      <td style="font-size:0.82rem;color:#666">${jscEsc(dateFmt)}</td>
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
        <input class="form-control" id="fmANome" value="${jscEsc(a.nome)}">
      </div>
      <div class="form-group">
        <label class="form-label">Nº Camisola</label>
        <input class="form-control" id="fmANumero" type="number" min="1" max="99" value="${jscEsc(a.numero || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Posição</label>
        <select class="form-control" id="fmAPosicao">
          <option value="">—</option>
          ${posicoes.map(p => `<option${jscEsc(p===a.posicao?' selected':'')}>${jscEsc(p)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Data de Nascimento</label>
        <input class="form-control" id="fmADataNasc" type="date" value="${jscEsc(a.dataNascimento || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Encarregado</label>
        <input class="form-control" id="fmAEnc" value="${jscEsc(a.encarregado || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-control" id="fmAEstado">
          <option${jscEsc(a.estado==='Activo'?' selected':'')}>Activo</option>
          <option${jscEsc(a.estado==='Inactivo'?' selected':'')}>Inactivo</option>
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-top:12px">
      <label class="form-label">Foto (URL ou upload)</label>
      <div style="display:flex;gap:12px;align-items:center">
        <input class="form-control" id="fmAFotoUrl" placeholder="https://... ou colar da FPF" value="${jscEsc(a.foto||'')}" style="flex:1">
        <label class="btn-icon" style="cursor:pointer;padding:8px 12px;background:#f0f0f0;border-radius:8px" title="Carregar ficheiro">
          📷 <input type="file" accept="image/*" id="fmAFotoFile" style="display:none">
        </label>
      </div>
      <div id="fmAFotoPreview" style="margin-top:10px;${jscEsc(a.foto?'':'display:none')}">
        <img id="fmAFotoImg" src="${jscEscUrl(a.foto||'')}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #e0e0e0">
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
        ${CATS.map((c,i) => `<button class="emoji-picker__tab${jscEsc(i===0?' active':'')}" data-cat="${i}">${jscEsc(c.label.split(' ')[0])}</button>`).join('')}
      </div>
      <div class="emoji-picker__grid" id="emojiGrid"></div>`;
    return el;
  }

  function renderGrid(emojis) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;
    grid.innerHTML = emojis.map(e =>
      `<button type="button" class="emoji-picker__emoji" title="${jscEsc(e)}">${jscEsc(e)}</button>`
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

// A cronologia e o palmarés são factos históricos do clube, e a sua semente
// única está em admin/js/data.js (DB.historia e DB.palmares), ao lado dos
// escalões e das modalidades.
//
// Estavam aqui cópias completas dos 22 marcos e dos 16 títulos — as segundas,
// iguais às de js/historia.js e de js/pesquisa.js. Saíram as três. Nenhum
// facto foi perdido: mudaram de sítio para um só.

function loadHistoria()  {
  try {
    const raw = localStorage.getItem(HISTORIA_KEY);
    if (raw) { const l = JSON.parse(raw); if (Array.isArray(l) && l.length) return l; }
  } catch(e) {}
  const semente = (typeof DB !== 'undefined' && Array.isArray(DB.historia)) ? DB.historia : [];
  if (semente.length) saveHistoria(semente);
  return JSON.parse(JSON.stringify(semente));
}
function saveHistoria(a) { localStorage.setItem(HISTORIA_KEY,  JSON.stringify(a)); }
function loadPalmares()  {
  try {
    const raw = localStorage.getItem(PALMARES_KEY);
    if (raw) { const l = JSON.parse(raw); if (Array.isArray(l) && l.length) return l; }
  } catch(e) {}
  const semente = (typeof DB !== 'undefined' && Array.isArray(DB.palmares)) ? DB.palmares : [];
  if (semente.length) savePalmares(semente);
  return JSON.parse(JSON.stringify(semente));
}
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
      <th style="padding:10px 12px;text-align:center">Publicado</th>
      <th style="padding:10px 12px;text-align:right">Ações</th>
    </tr></thead>
    <tbody>
      ${lista.map(h => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px;font-weight:700;color:var(--blue);font-size:1.05rem">${jscEsc(h.ano)}</td>
          <td style="padding:12px;font-size:0.9rem">${jscEsc(h.titulo)}</td>
          <td style="padding:12px;text-align:center">${jscEsc(h.destaque ? '⭐' : '—')}</td>
          <td style="padding:12px;text-align:center">${h.ativo === false
            ? '<span class="galeria-card__estado">Não publicado</span>' : '✅'}</td>
          <td style="padding:12px;text-align:right;white-space:nowrap">
            <button class="btn-icon" onclick="toggleHistoria(${h.id})" title="${h.ativo === false ? 'Publicar' : 'Despublicar'}">${h.ativo === false ? '&#9989;' : '&#9940;'}</button>
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
      <th style="padding:10px 12px;text-align:left">Escalão / atleta</th>
      <th style="padding:10px 12px;text-align:center">Publicado</th>
      <th style="padding:10px 12px;text-align:right">Ações</th>
    </tr></thead>
    <tbody>
      ${lista.map(t => `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px;font-weight:700;color:var(--blue)">${jscEsc(t.ano)}</td>
          <td style="padding:12px;font-size:0.9rem">${jscEsc(t.competicao)}${t.observacao ? ' <span style="color:#888;font-size:0.8rem">· ' + jscEsc(t.observacao) + '</span>' : ''}</td>
          <td style="padding:12px"><span style="background:var(--yellow);color:var(--blue-dark);font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px">${jscEsc(t.escalao || '—')}</span></td>
          <td style="padding:12px;text-align:center">${t.ativo === false
            ? '<span class="galeria-card__estado">Não publicado</span>' : '✅'}</td>
          <td style="padding:12px;text-align:right;white-space:nowrap">
            <button class="btn-icon" onclick="togglePalmares(${t.id})" title="${t.ativo === false ? 'Publicar' : 'Despublicar'}">${t.ativo === false ? '&#9989;' : '&#9940;'}</button>
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
        <input type="number" class="form-input" id="hAno" value="${jscEsc(h?.ano || new Date().getFullYear())}" min="1900" max="2100" />
      </div>
      <div class="modal-field">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:26px">
          <input type="checkbox" id="hDestaque" ${h?.destaque ? 'checked' : ''} />
          Destaque (evento marcante)
        </label>
      </div>
    </div>
    <div class="modal-field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="hAtivo" ${h && h.ativo === false ? '' : 'checked'} />
        Publicado no site
      </label>
      <small style="color:#888;font-size:11px">Despublicar retira o marco da página de História e da pesquisa, sem o eliminar.</small>
    </div>
    <div class="modal-field">
      <label>Título *</label>
      <input type="text" class="form-input" id="hTitulo" value="${jscEsc(h?.titulo || '')}" placeholder="Título curto do acontecimento" />
    </div>
    <div class="modal-field">
      <label>Descrição</label>
      <textarea class="form-input" id="hDescricao" rows="4" placeholder="Conte o que aconteceu neste marco histórico...">${jscEsc(h?.descricao || '')}</textarea>
    </div>
    <div class="modal-field">
      <label>Imagem (URL)</label>
      <input type="url" class="form-input" id="hImagem" value="${jscEsc(h?.imagem || '')}" placeholder="https://..." />
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
    ativo:     document.getElementById('hAtivo')?.checked !== false,
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

// Publicar / despublicar sem eliminar. Um registo sem o campo conta como
// publicado, e é por isso que o interruptor escreve sempre um booleano
// explícito em vez de apagar o campo.
window.toggleHistoria = function(id) {
  const lista = loadHistoria();
  const h = lista.find(x => x.id === id);
  if (!h) return;
  h.ativo = h.ativo === false;
  saveHistoria(lista);
  showToast(h.ativo ? 'Marco publicado.' : 'Marco despublicado.', 'green');
  renderHistoriaList();
};

window.deleteHistoria = function(id) {
  if (!confirm('Eliminar esta entrada da linha do tempo?')) return;
  saveHistoria(loadHistoria().filter(x => x.id !== id));
  renderHistoriaList();
};

window.abrirModalPalmares = function(t) {
  const isNew = !t;
  // O escalão era um <select> com 14 opções fixas. Nenhum dos 16 títulos do
  // clube usava uma delas: 'Seniores', 'Iniciados', 'Traquinas A', 'Juvenis
  // (Sub-17)', 'Sen. Femininos', 'Equipa' e quatro nomes de atletas não
  // existiam na lista. Abrir e gravar qualquer título apagava-lhe o escalão.
  //
  // Passa a ser texto livre, com os valores em uso oferecidos como sugestão
  // por um <datalist>: sugerir não apaga nada, ao contrário de escolher.
  const sugestoes = ['Sub-5','Sub-7','Sub-9','Sub-11','Sub-13','Sub-15','Sub-17','Sub-19','Sub-21','Sénior','Seniores','Futsal','Kickboxing','Judo','Geral'];
  openModal(isNew ? 'Novo Título / Conquista' : 'Editar Título', `
    <div class="modal-field">
      <label>Competição / Torneio *</label>
      <input type="text" class="form-input" id="pComp" value="${jscEsc(t?.competicao || '')}" placeholder="Ex: Campeonato Distrital AF Algarve" />
    </div>
    <div class="modal-row">
      <div class="modal-field">
        <label>Ano *</label>
        <input type="number" class="form-input" id="pAno" value="${jscEsc(t?.ano || new Date().getFullYear())}" min="1900" max="2100" />
      </div>
      <div class="modal-field">
        <label>Escalão / atleta</label>
        <input type="text" class="form-input" id="pEscalao" list="pEscalaoSugestoes"
               value="${jscEsc(t?.escalao || '')}" placeholder="Ex: Sub-17, Seniores, Traquinas A" />
        <datalist id="pEscalaoSugestoes">
          ${sugestoes.map(e => `<option value="${jscEsc(e)}"></option>`).join('')}
        </datalist>
      </div>
    </div>
    <div class="modal-field">
      <label>Observação (opcional)</label>
      <input type="text" class="form-input" id="pObs" value="${jscEsc(t?.observacao || '')}" placeholder="Ex: 1.º lugar, Campeão..." />
    </div>
    <div class="modal-field">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="pAtivo" ${t && t.ativo === false ? '' : 'checked'} />
        Publicado no site
      </label>
      <small style="color:#888;font-size:11px">Despublicar retira o título do palmarés e da pesquisa, sem o eliminar.</small>
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
    escalao:    document.getElementById('pEscalao')?.value.trim() || '',
    observacao: document.getElementById('pObs')?.value.trim()    || '',
    ativo:      document.getElementById('pAtivo')?.checked !== false,
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

window.togglePalmares = function(id) {
  const lista = loadPalmares();
  const t = lista.find(x => x.id === id);
  if (!t) return;
  t.ativo = t.ativo === false;
  savePalmares(lista);
  showToast(t.ativo ? 'Título publicado.' : 'Título despublicado.', 'green');
  renderPalmaresList();
};

window.deletePalmares = function(id) {
  if (!confirm('Eliminar este título do palmarés?')) return;
  savePalmares(loadPalmares().filter(x => x.id !== id));
  renderPalmaresList();
};
