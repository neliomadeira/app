// =============================================
// FORMAÇÃO PÚBLICA — plantel dinâmico
// =============================================

(function () {
  const ESCALOES = ['Sub-9', 'Sub-11', 'Sub-13', 'Sub-15', 'Sub-17', 'Sub-19'];
  let _esc = ESCALOES[0];

  // Normalise free-text position to short group code
  function normPos(pos) {
    const p = (pos || '').toLowerCase().trim();
    if (!p) return 'DEF';
    if (/^gr$|guarda/.test(p))                          return 'GR';
    if (/^def$|defes|central|lateral|stopper/.test(p))  return 'DEF';
    if (/^mei$|m[eé]dio|meio|extremo/.test(p))          return 'MEI';
    if (/^ava$|avan|ponta|lan[cç]a/.test(p))            return 'AVA';
    return 'DEF';
  }

  function initStr(nome) {
    return (nome || '').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  }

  function avatarEl(a) {
    if (a.foto) {
      return `<div class="player-card__avatar" style="background-image:url('${a.foto}');background-size:cover;background-position:center;font-size:0"></div>`;
    }
    return `<div class="player-card__avatar">${initStr(a.nome)}</div>`;
  }

  function renderInfoBar(info, escalao) {
    const bar = document.getElementById('formacaoInfoBar');
    if (!bar) return;
    const items = [
      { icon: '&#9917;',  label: 'Escalão',    val: escalao },
      { icon: '&#128100;',label: 'Treinador',   val: info.treinador   || '—' },
      { icon: '&#127942;',label: 'Competição',  val: info.competicao  || '—' },
      { icon: '&#128337;',label: 'Treinos',     val: info.treinos     || '—' },
      { icon: '&#128205;',label: 'Local',       val: info.local       || '—' },
    ].filter((item, i) => i === 0 || item.val !== '—');

    bar.innerHTML = items.map(it => `
      <div class="senior-info__item">
        <span class="senior-info__icon">${it.icon}</span>
        <div>
          <span class="senior-info__label">${it.label}</span>
          <span class="senior-info__val">${it.val}</span>
        </div>
      </div>`).join('');
  }

  const GRUPOS = [
    { pos: 'GR',  code: 'gr',  label: 'Guarda-Redes' },
    { pos: 'DEF', code: 'def', label: 'Defesas' },
    { pos: 'MEI', code: 'mei', label: 'Médios' },
    { pos: 'AVA', code: 'ava', label: 'Avançados' },
  ];

  function renderSquad(atletas) {
    const plantel = document.getElementById('formacaoPlantel');
    if (!plantel) return;

    if (!atletas.length) {
      plantel.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4)">
          <div style="font-size:3rem;margin-bottom:12px">&#128100;</div>
          <p style="font-size:1rem">Plantel ainda não publicado para este escalão.</p>
        </div>`;
      return;
    }

    plantel.innerHTML = GRUPOS.map(({ pos, code, label }) => {
      const jogadores = atletas.filter(a => normPos(a.posicao) === pos);
      if (!jogadores.length) return '';
      return `
        <div class="squad-group">
          <h3 class="squad-group__title">
            <span class="squad-pos-badge squad-pos-badge--${code}">${pos}</span>${label}
          </h3>
          <div class="squad-grid">
            ${jogadores.map(a => `
              <div class="player-card">
                ${a.numero ? `<span class="player-card__num">${a.numero}</span>` : ''}
                ${avatarEl(a)}
                <span class="player-card__name">${a.nome}</span>
                <span class="player-card__pos player-card__pos--${pos}">${a.posicao || label}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderEscalao(escalao) {
    _esc = escalao;

    // Update tab highlight
    document.querySelectorAll('.formacao-tab').forEach(btn => {
      btn.classList.toggle('formacao-tab--active', btn.dataset.esc === escalao);
    });

    // Update section title
    const title = document.getElementById('formacaoEscalaoTitle');
    if (title) title.textContent = escalao;

    try {
      const escaloes = JSON.parse(localStorage.getItem('db_escaloes') || '[]');
      const info = escaloes.find(e => e.nome === escalao) || {};
      renderInfoBar(info, escalao);

      const atletas = JSON.parse(localStorage.getItem('db_atletas') || '[]')
        .filter(a => a.escalao === escalao && a.estado !== 'Inactivo');
      renderSquad(atletas);
    } catch (e) {
      // localStorage unavailable — squad stays empty
    }
  }

  function buildTabs() {
    const tabBar = document.getElementById('formacaoTabs');
    if (!tabBar) return;
    tabBar.innerHTML = ESCALOES.map(e => `
      <button class="formacao-tab${e === _esc ? ' formacao-tab--active' : ''}" data-esc="${e}">${e}</button>
    `).join('');
    tabBar.querySelectorAll('.formacao-tab').forEach(btn => {
      btn.addEventListener('click', () => renderEscalao(btn.dataset.esc));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildTabs();

    // Pick the first escalão that has atletas, otherwise default to first
    try {
      const atletas = JSON.parse(localStorage.getItem('db_atletas') || '[]');
      const first = ESCALOES.find(e => atletas.some(a => a.escalao === e && a.estado !== 'Inactivo'));
      renderEscalao(first || ESCALOES[0]);
    } catch (e) {
      renderEscalao(ESCALOES[0]);
    }
  });

  // Live update when admin saves in another tab
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'db_atletas' || ev.key === 'db_escaloes') renderEscalao(_esc);
  });
})();
