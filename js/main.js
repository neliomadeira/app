// =============================================
// JUVENTUDE SPORT CAMPINENSE — MAIN JS
// =============================================

// ---- STAT COUNTER ANIMATION ----
(function () {
  if (!window.IntersectionObserver) return;
  const stats = document.querySelectorAll('.stat__num');
  if (!stats.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      const el = entry.target;
      const raw = el.textContent.trim();
      const suffix = raw.replace(/[\d,]/g, '');
      const target = parseInt(raw.replace(/\D/g, ''), 10);
      if (!target) return;
      el.closest('.stat')?.classList.add('stat--animated');
      const duration = 900;
      const start = performance.now();
      function step(now) {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(ease * target) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  stats.forEach(s => obs.observe(s));
})();

// ---- BUTTON RIPPLE ----
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const r = document.createElement('span');
  r.className = 'btn__ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove(), { once: true });
}, true);

document.addEventListener('DOMContentLoaded', () => {

  // Nav (hamburger, dropdowns, active indicators) is handled by nav.js

  // ---- CONTACT FORM ----
  const form = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    const params = {
      nome:     document.getElementById('nome')?.value || '',
      email:    document.getElementById('email')?.value || '',
      telefone: document.getElementById('telefone')?.value || '',
      assunto:  document.getElementById('assunto')?.value || '',
      mensagem: document.getElementById('mensagem')?.value || '',
    };

    let sent = false;
    if (typeof sendEmail === 'function') {
      sent = await sendEmail('tplContacto', params);
    }

    // Guardar mensagem em localStorage independentemente
    try {
      const msgs = JSON.parse(localStorage.getItem('db_contact_msgs') || '[]');
      msgs.unshift({ ...params, data: new Date().toISOString().slice(0,10), estado: 'Não lida', id: Date.now() });
      localStorage.setItem('db_contact_msgs', JSON.stringify(msgs));
    } catch(_) {}

    form.reset();
    btn.textContent = 'Enviar mensagem';
    btn.disabled = false;
    if (formSuccess) {
      formSuccess.textContent = sent
        ? '✓ Mensagem enviada com sucesso! Entraremos em contacto em breve.'
        : '✓ Mensagem recebida! Entraremos em contacto em breve.';
      formSuccess.style.display = 'block';
      setTimeout(() => { formSuccess.style.display = 'none'; }, 5000);
    }
  });

  // ---- PHONE MASK (Portuguese: 9XX XXX XXX or +351 9XX XXX XXX) ----
  const telefone = document.getElementById('telefone');
  if (telefone) {
    telefone.addEventListener('input', (e) => {
      let v = e.target.value;
      const hasPrefix = v.startsWith('+351') || v.startsWith('00351');
      let digits = v.replace(/\D/g, '');
      if (digits.startsWith('351')) digits = digits.slice(3);
      digits = digits.slice(0, 9);
      let formatted = digits.replace(/^(\d{3})(\d{0,3})(\d{0,3})/, (_, a, b, c) =>
        b ? (c ? `${a} ${b} ${c}` : `${a} ${b}`) : a
      );
      e.target.value = hasPrefix ? '+351 ' + formatted : formatted;
    });
  }

  // ---- SCROLL REVEAL ANIMATION ----
  const revealElements = document.querySelectorAll(
    '.category-card, .news-card, .about__text, .about__visual, .contact__info, .contact__form, .gallery__item, .stat'
  );

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealElements.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s ease ${i * 0.07}s, transform 0.6s ease ${i * 0.07}s`;
    revealObserver.observe(el);
  });

  document.head.insertAdjacentHTML('beforeend', `
    <style>
      .revealed { opacity: 1 !important; transform: translateY(0) !important; }
      .header--scrolled { background: rgba(13,13,13,0.98) !important; }
      .nav__link.active { color: var(--white); }
      .nav__link.active::after { transform: scaleX(1); }
    </style>
  `);

  // ---- SMOOTH SCROLL for older browsers ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---- CONTEÚDO DINÂMICO DO ADMIN ----
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function ptDate(str) {
    if (!str) return '';
    const d = new Date(str + 'T00:00:00');
    return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;
  }

  const MESES_CURTOS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

  function newsCardImg(n) {
    if (n.imagem) {
      const size = (n.imagemSize || 'cover').replace('auto ', '');
      return `style="background-image:url('${n.imagem}');background-size:${size};background-position:center;background-repeat:no-repeat"`;
    }
    return '';
  }

  function renderNoticias() {
    try {
      const raw = localStorage.getItem('jsc_noticias');
      if (!raw) return;
      const lista = JSON.parse(raw).filter(n => n.publicada)
                      .sort((a,b) => (b.data||'').localeCompare(a.data||''));
      const grid = document.getElementById('newsGrid');
      if (!grid) return;
      if (!lista.length) {
        // Sem artigos publicados — mantém HTML estático como fallback
        const btn = document.getElementById('btnVerTodasNoticias');
        if (btn) btn.style.display = 'none';
        return;
      }
      const cfg = JSON.parse(localStorage.getItem('site_config') || '{}');
      const newsCount = parseInt(cfg.homepageNewsCount) || 3;
      grid.innerHTML = lista.slice(0, newsCount).map((n, i) => `
        <article class="news-card${i === 0 ? ' news-card--featured' : ''}" style="cursor:pointer" onclick="window.location='noticias.html?id=${n.id}'">
          <div class="news-card__img${n.imagem ? '' : ` news-card__img--${(i % 3) + 1}`}" ${newsCardImg(n)}>
            <span class="news-card__cat">${n.categoria || ''}</span>
          </div>
          <div class="news-card__body">
            <time class="news-card__date">${ptDate(n.data)}</time>
            <h3 class="news-card__title">${n.titulo}</h3>
            ${n.resumo ? `<p class="news-card__excerpt">${n.resumo.replace(/<[^>]+>/g,'').slice(0,160)}</p>` : ''}
            <span class="news-card__link">Ler mais &rarr;</span>
          </div>
        </article>`).join('');

      const btn = document.getElementById('btnVerTodasNoticias');
      if (btn) btn.style.display = lista.length > newsCount ? '' : 'none';
    } catch(e) {
      // Erro ao renderizar noticias — mantém HTML estático
    }
  }

  // ---- News archive overlay ----
  function getNoticiasLista() {
    try {
      const raw = localStorage.getItem('jsc_noticias');
      return raw ? JSON.parse(raw).filter(n => n.publicada)
                    .sort((a,b) => (b.data||'').localeCompare(a.data||'')) : [];
    } catch(e) { return []; }
  }

  function archiveDateBox(data) {
    if (!data) return '<div class="news-archive__date-box"></div>';
    const d = new Date(data + 'T00:00:00');
    return `<div class="news-archive__date-box">
      <span class="news-archive__day">${d.getDate()}</span>
      <span class="news-archive__month">${MESES_CURTOS[d.getMonth()]}</span>
    </div>`;
  }

  function showArchiveList() {
    const lista = getNoticiasLista();
    const body  = document.getElementById('newsArchiveBody');
    document.getElementById('newsArchiveTitle').textContent = 'Todas as Notícias';
    body.innerHTML = `<div class="news-archive__list">${
      lista.map((n, i) => `
        <div class="news-archive__item" onclick="openNewsArticle(${n.id})">
          ${archiveDateBox(n.data)}
          <div class="news-archive__img${n.imagem ? '' : ` news-card__img--${(i % 3) + 1}`}"
               ${n.imagem ? `style="background-image:url('${n.imagem}');background-size:cover;background-position:center;background-repeat:no-repeat"` : ''}></div>
          <div class="news-archive__info">
            <span class="news-archive__cat">${n.categoria || ''}</span>
            <div class="news-archive__heading">${n.titulo}</div>
            ${n.resumo ? `<p class="news-archive__excerpt">${n.resumo}</p>` : ''}
          </div>
        </div>`).join('')
    }</div>`;
  }

  window.showArchiveList = showArchiveList;

  window.openNewsArchive = function() {
    showArchiveList();
    document.getElementById('newsArchive').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.openNewsArticle = function(id) {
    const lista = getNoticiasLista();
    const n = lista.find(x => x.id == id);
    if (!n) return;

    const archive = document.getElementById('newsArchive');
    const body    = document.getElementById('newsArchiveBody');
    document.getElementById('newsArchiveTitle').textContent = n.categoria || 'Notícia';

    const imgPos  = n.imagemPos  || 'top';
    const imgSize = (n.imagemSize || 'cover').replace('auto ', '');
    const imgStyle = n.imagem
      ? `background-image:url('${n.imagem}');background-size:${imgSize};background-position:center;background-repeat:no-repeat`
      : '';
    const imgHtml = n.imagem
      ? `<div class="news-article__img news-article__img--${imgPos}" style="${imgStyle}"></div>`
      : '';
    const topImg  = imgHtml && (imgPos === 'top'  )  ? imgHtml : '';
    const midImg  = imgHtml && (imgPos === 'center') ? imgHtml : '';
    const bodyImg = imgHtml && (imgPos === 'left' || imgPos === 'right') ? imgHtml : '';

    body.innerHTML = `
      <button class="news-archive__back" onclick="showArchiveList();document.getElementById('newsArchiveTitle').textContent='Todas as Notícias'">
        &#8592; Voltar à lista
      </button>
      <div class="news-article">
        ${topImg}
        <h2 class="news-article__title">${n.titulo}</h2>
        <div class="news-article__meta">
          <span class="news-article__cat-badge">${n.categoria || ''}</span>
          <time>${ptDate(n.data)}</time>
        </div>
        ${midImg}
        <div class="news-article__body">
          ${bodyImg}${n.resumo || '<em style="color:#aaa">Sem texto disponível.</em>'}
        </div>
        <div style="clear:both"></div>
      </div>`;

    archive.classList.add('open');
    document.body.style.overflow = 'hidden';
    body.scrollTop = 0;
  };

  // Close archive
  function closeNewsArchive() {
    document.getElementById('newsArchive').classList.remove('open');
    document.body.style.overflow = '';
  }
  document.getElementById('newsArchiveClose')?.addEventListener('click', closeNewsArchive);
  document.getElementById('newsArchive')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('newsArchive')) closeNewsArchive();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNewsArchive();
  });

  renderNoticias();
  renderAniversarios();

  // Re-render when admin saves in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'jsc_noticias') renderNoticias();
    if (e.key === 'db_atletas')   renderAniversarios();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'site_aviso') location.reload();
  });

  // Re-render após sincronização com o servidor
  document.addEventListener('jsc:synced', () => {
    renderNoticias();
    renderAniversarios();
  });

  // Aniversariantes do mês (os de hoje aparecem primeiro, destacados)
  function renderAniversarios() {
    try {
      const atletas = JSON.parse(localStorage.getItem('db_atletas') || '[]');
      const hoje    = new Date();
      const dia     = hoje.getDate();
      const mes     = hoje.getMonth(); // 0-11
      const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

      const lista = atletas
        .filter(a => {
          if (!a.dataNascimento || a.estado === 'Inactivo') return false;
          const n = new Date(a.dataNascimento + 'T00:00:00');
          return n.getMonth() === mes;
        })
        .map(a => {
          const n = new Date(a.dataNascimento + 'T00:00:00');
          return { ...a, _dia: n.getDate(), _idade: hoje.getFullYear() - n.getFullYear(), _hoje: n.getDate() === dia };
        })
        .sort((a, b) => (b._hoje - a._hoje) || (a._dia - b._dia));

      const section = document.getElementById('aniversariosSection');
      if (!section) return;

      if (!lista.length) { section.style.display = 'none'; return; }

      const tag   = section.querySelector('.section__tag');
      const title = section.querySelector('.section__title');
      if (tag)   tag.textContent   = MESES_PT[mes];
      if (title) title.textContent = 'Aniversariantes do Mês';

      section.style.display = '';
      document.getElementById('aniversariosLista').innerHTML = lista.map(a => {
        const detalhe = a._hoje
          ? `${a.escalao} &middot; faz ${a._idade} anos <strong>hoje</strong> 🎉`
          : `${a.escalao} &middot; dia ${a._dia} &middot; faz ${a._idade} anos`;
        return `
          <div class="birthday__card${a._hoje ? ' birthday__card--today' : ''}">
            <div class="birthday__icon">🎂</div>
            <div class="birthday__info">
              <strong class="birthday__nome">${a.nome}</strong>
              <span class="birthday__detalhe">${detalhe}</span>
            </div>
          </div>`;
      }).join('');
    } catch(e) {}
  }

  // Escalões
  try {
    const raw = localStorage.getItem('db_escaloes');
    if (raw) {
      const lista = JSON.parse(raw);
      if (lista.length) {
        const grid = document.getElementById('categoriesGrid');
        if (grid) {
          grid.innerHTML = lista.map(e => `
            <div class="category-card${e.destaque ? ' category-card--featured' : ''}">
              ${e.destaque ? '<div class="category-card__badge">Destaque</div>' : ''}
              <div class="category-card__age">${e.nome}</div>
              <h3 class="category-card__name">${e.designacao || ''}</h3>
              <p class="category-card__age-range">${e.faixa || ''}</p>
              ${e.descricao ? `<p class="category-card__desc">${e.descricao}</p>` : ''}
              <ul class="category-card__list">
                ${e.treinos ? `<li>${e.treinos}</li>` : ''}
                ${e.treinador ? `<li>Treinador: ${e.treinador}</li>` : ''}
                ${e.atletas ? `<li>${e.atletas} atletas inscritos</li>` : ''}
              </ul>
              <a href="escalao.html?escalao=${e.nome}" class="esc-link">Ver plantel →</a>
            </div>`).join('');
        }
      }
    }
  } catch(e) {}

  // Agenda pública
  try {
    const raw = localStorage.getItem('db_agenda');
    if (raw) {
      const TIPO_CLS = { Jogo:'jogo', Torneio:'torneio', Treino:'treino', 'Reunião':'reuniao', Outro:'outro' };
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const lista = JSON.parse(raw)
        .filter(e => new Date(e.data + 'T00:00:00') >= hoje)
        .sort((a,b) => new Date(a.data) - new Date(b.data))
        .slice(0, 6);
      if (lista.length) {
        const grid = document.getElementById('agendaPublicGrid');
        if (grid) {
          grid.innerHTML = lista.map(e => {
            const d = new Date(e.data + 'T00:00:00');
            const cls = TIPO_CLS[e.tipo] || 'outro';
            return `<div class="agenda-card">
              <div class="agenda-card__date-box">
                <span class="agenda-card__day">${d.getDate()}</span>
                <span class="agenda-card__month">${MESES_CURTOS[d.getMonth()]}</span>
              </div>
              <div class="agenda-card__body">
                <span class="agenda-card__tipo agenda-card__tipo--${cls}">${e.tipo}</span>
                <h4 class="agenda-card__title">${e.titulo}</h4>
                <p class="agenda-card__meta">&#128337; ${e.hora} &nbsp;·&nbsp; &#128205; ${e.local}</p>
                ${e.escalao && e.escalao !== 'Todos' ? `<p class="agenda-card__meta">&#127942; ${e.escalao}</p>` : ''}
              </div>
            </div>`;
          }).join('');
        }
      }
    }
  } catch(e) {}

  // Jogo em destaque
  try {
    const cfgJogo = JSON.parse(localStorage.getItem('site_config') || '{}');
    if (cfgJogo.jogoDestaqueAtivo) {
      const agRaw = localStorage.getItem('db_agenda');
      const hoje2 = new Date(); hoje2.setHours(0,0,0,0);
      const jogos = agRaw
        ? JSON.parse(agRaw)
            .filter(e => e.tipo === 'Jogo' && e.estado !== 'Cancelado' && new Date(e.data + 'T00:00:00') >= hoje2)
            .sort((a,b) => new Date(a.data + 'T' + (a.hora||'00:00')) - new Date(b.data + 'T' + (b.hora||'00:00')))
        : [];
      const jogo = jogos[0];
      const section = document.getElementById('jogoDestaqueSection');
      const widget  = document.getElementById('jogoDestaqueWidget');
      if (jogo && section && widget) {
        const d = new Date(jogo.data + 'T00:00:00');
        const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const alvo = new Date(jogo.data + 'T' + (jogo.hora || '00:00'));
        const cdBox = (id, label) => `
          <div style="display:flex;flex-direction:column;align-items:center;min-width:52px;background:rgba(255,255,255,0.06);border-radius:8px;padding:8px 6px">
            <span id="${id}" style="font-size:1.7rem;font-weight:900;color:#FFD700;font-family:'Bebas Neue',sans-serif;line-height:1">--</span>
            <span style="color:rgba(255,255,255,0.5);font-size:0.62rem;letter-spacing:1px;text-transform:uppercase">${label}</span>
          </div>`;
        widget.innerHTML = `
          <div style="color:rgba(255,255,255,0.55);font-size:0.78rem;letter-spacing:1px;text-transform:uppercase;font-weight:700">Próximo Jogo</div>
          <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;justify-content:center">
            <div style="color:#fff;font-size:1.1rem;font-weight:700;max-width:220px">${jogo.titulo}</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
              <span style="font-size:2rem;font-weight:900;color:#FFD700;font-family:'Bebas Neue',sans-serif;letter-spacing:1px">${d.getDate()} ${MESES_PT[d.getMonth()]}</span>
              <span style="color:rgba(255,255,255,0.6);font-size:0.82rem">${jogo.hora || ''} &nbsp;·&nbsp; ${jogo.local || ''}</span>
            </div>
            <div style="display:flex;gap:8px" aria-label="Contagem decrescente para o jogo">
              ${cdBox('jdDias','Dias')}${cdBox('jdHoras','Horas')}${cdBox('jdMin','Min')}${cdBox('jdSeg','Seg')}
            </div>
            ${jogo.escalao && jogo.escalao !== 'Todos' ? `<span style="background:rgba(255,215,0,0.15);color:#FFD700;padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:700">${jogo.escalao}</span>` : ''}
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
              <button id="jdIcsBtn" style="background:transparent;color:#FFD700;border:1px solid rgba(255,215,0,0.5);padding:8px 14px;border-radius:6px;font-size:0.82rem;font-weight:700;cursor:pointer">&#128197; Calendário</button>
              <a href="agenda.html" style="background:#FFD700;color:#001f4d;padding:8px 18px;border-radius:6px;font-size:0.82rem;font-weight:700;text-decoration:none">Ver agenda →</a>
            </div>
          </div>`;
        section.style.display = '';

        // Contagem decrescente ao segundo
        const cdTick = () => {
          let diff = alvo - new Date();
          if (diff < 0) diff = 0;
          const dias  = Math.floor(diff / 86400000);
          const horas = Math.floor(diff % 86400000 / 3600000);
          const min   = Math.floor(diff % 3600000 / 60000);
          const seg   = Math.floor(diff % 60000 / 1000);
          const setN = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v).padStart(2, '0'); };
          setN('jdDias', dias); setN('jdHoras', horas); setN('jdMin', min); setN('jdSeg', seg);
          if (diff === 0) clearInterval(cdTimer);
        };
        const cdTimer = setInterval(cdTick, 1000);
        cdTick();

        document.getElementById('jdIcsBtn')?.addEventListener('click', () => {
          if (window.JSC_ICS) window.JSC_ICS.download({
            titulo: jogo.titulo, data: jogo.data, hora: jogo.hora,
            local: jogo.local, descricao: jogo.descricao, tipo: 'Jogo',
          });
        });
      }
    }
  } catch(e) {}

  // Equipa Sénior
  try {
    const rawInfo = localStorage.getItem('db_seniores_info');
    if (rawInfo) {
      const info = JSON.parse(rawInfo);
      const fields = { seniorLiga: 'liga', seniorTemporada: 'temporada', seniorTreinos: 'treinos', seniorEstadio: 'estadio' };
      Object.entries(fields).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el && info[key]) el.textContent = info[key];
      });
    }
    const rawPlantel = localStorage.getItem('db_seniores');
    if (rawPlantel) {
      const plantel = JSON.parse(rawPlantel).filter(j => j.ativo !== false);
      if (plantel.length) {
        const grupos = [
          { pos: 'GR',  label: 'Guarda-Redes' },
          { pos: 'DEF', label: 'Defesas' },
          { pos: 'MEI', label: 'Médios' },
          { pos: 'AVA', label: 'Avançados' },
        ];
        grupos.forEach(({ pos, label }) => {
          const container = document.getElementById('sg' + pos);
          if (!container) return;
          const jogadores = plantel.filter(j => j.posicao === pos);
          if (!jogadores.length) { container.closest('.squad-group').style.display = 'none'; return; }
          const initStr = j => j.nome.split(' ').slice(0,2).map(p => p[0]).join('').toUpperCase();
          const avatarStyle = j => j.foto
            ? `style="background-image:url('${j.foto}');background-size:cover;background-position:center;font-size:0"`
            : '';
          container.innerHTML = jogadores.map(j => `
            <div class="player-card">
              <span class="player-card__num">${j.numero || '—'}</span>
              <div class="player-card__avatar" ${avatarStyle(j)}>${j.foto ? '' : initStr(j)}</div>
              <span class="player-card__name">${j.nome}</span>
              <span class="player-card__pos player-card__pos--${j.posicao}">${j.posicaoFull || j.posicao}</span>
            </div>`).join('');
        });
      }
    }
  } catch(e) {}

  // Treinadores públicos
  try {
    const raw = localStorage.getItem('db_treinadores');
    if (raw) {
      const lista = JSON.parse(raw).filter(t => t.ativo !== false);
      if (lista.length) {
        const grid = document.getElementById('treinadoresPublicGrid');
        if (grid) {
          grid.innerHTML = lista.map(t => {
            const initials = t.nome.split(' ').slice(0,2).map(p => p[0]).join('').toUpperCase();
            const bgStyle = t.foto ? `style="background-image:url('${t.foto}');background-size:cover;background-position:center;font-size:0"` : '';
            return `<div class="staff-card">
              <div class="staff-card__avatar" ${bgStyle}>${t.foto ? '' : initials}</div>
              <div class="staff-card__body">
                <h3 class="staff-card__name">${t.nome}</h3>
                <span class="staff-card__role">${t.cargo}</span>
                <span class="staff-card__team">${t.escalao}</span>
              </div>
            </div>`;
          }).join('');
        }
      }
    }
  } catch(e) {}

  // Patrocinadores dinâmicos
  try {
    const raw = localStorage.getItem('db_patrocinadores');
    if (raw) {
      const lista = JSON.parse(raw).filter(p => p.ativo);
      if (lista.length) {
        const tiers = ['Ouro','Prata','Bronze'];
        tiers.forEach(tier => {
          const grupo = lista.filter(p => p.tier === tier);
          const row = document.getElementById(`sponsorsRow${tier}`);
          if (row && grupo.length) {
            row.innerHTML = grupo.map(p => {
              const logo = p.logo
                ? `<div class="sponsor-card__logo" style="background-image:url('${p.logo}');background-size:contain;background-repeat:no-repeat;background-position:center"></div>`
                : `<div class="sponsor-card__logo">${p.nome}</div>`;
              const link = p.website ? `href="${p.website}" target="_blank" rel="noopener"` : '';
              return `<a class="sponsor-card sponsor-card--${tier.toLowerCase()}" ${link} style="${link?'cursor:pointer':''}">
                ${logo}
                <span class="sponsor-card__name">${p.sector || ''}</span>
              </a>`;
            }).join('');
          }
        });
      }
    }
  } catch(e) {}

  // Modalidades
  try {
    const raw = localStorage.getItem('db_modalidades');
    if (raw) {
      const lista = JSON.parse(raw).filter(m => m.ativo !== false);
      if (lista.length) {
        const grid = document.getElementById('modalidadesGrid');
        if (grid) {
          grid.innerHTML = lista.map(m => {
            const bgStyle = m.imagem
              ? `style="background-image:url('${m.imagem}');background-size:cover;background-position:${m.imagemPos||'center'}"` : '';
            return `
              <div class="modality-card">
                <div class="modality-card__icon-wrap" ${bgStyle}>
                  <span class="modality-card__icon">${m.icone || '🏅'}</span>
                </div>
                <div class="modality-card__body">
                  <h3 class="modality-card__name">${m.nome}</h3>
                  ${m.descricao ? `<p class="modality-card__desc">${m.descricao}</p>` : ''}
                  <div class="modality-card__info">
                    ${m.treinos   ? `<span class="modality-card__info-item">&#128337; ${m.treinos}</span>` : ''}
                    ${m.local     ? `<span class="modality-card__info-item">&#128205; ${m.local}</span>` : ''}
                    ${m.responsavel ? `<span class="modality-card__info-item">&#128100; ${m.responsavel}</span>` : ''}
                  </div>
                  <a href="modalidade.html?id=${m.id}" class="modality-card__link">Ver mais &rarr;</a>
                </div>
              </div>`;
          }).join('');
        }
      }
    }
  } catch(e) {}

  // Galeria
  try {
    const raw = localStorage.getItem('db_galeria');
    if (raw) {
      const allFotos = JSON.parse(raw).filter(f => f.url);
      if (allFotos.length) initGaleria(allFotos);
    }
  } catch(e) {}

});

// ---- GALERIA PÚBLICA + LIGHTBOX ---- //
(function() {
  let _fotos = [];      // filtered list currently shown
  _allFotos = [];   // full list
  let _curIdx = 0;
  let _expanded = false;
  const PREVIEW = 6;

  function initGaleria(lista) {
    _allFotos = lista;
    const grid    = document.getElementById('galleryGrid');
    const filters = document.getElementById('galleryFilters');
    const moreWrap = document.getElementById('galleryMore');
    const moreBtn  = document.getElementById('galleryMoreBtn');
    if (!grid) return;

    // Build category filters
    const cats = [...new Set(lista.map(f => f.categoria).filter(Boolean))];
    if (cats.length > 1 && filters) {
      const extra = cats.map(c =>
        `<button class="gallery__filter-btn" data-cat="${c}">${c}</button>`
      ).join('');
      filters.innerHTML = `<button class="gallery__filter-btn active" data-cat="">Todas</button>${extra}`;
      filters.style.display = 'flex';
      filters.addEventListener('click', e => {
        const btn = e.target.closest('.gallery__filter-btn');
        if (!btn) return;
        filters.querySelectorAll('.gallery__filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _expanded = false;
        renderGrid(btn.dataset.cat);
      });
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        _expanded = true;
        renderGrid(filters?.querySelector('.active')?.dataset.cat || '');
      });
    }

    renderGrid('');

    function renderGrid(cat) {
      _fotos = cat ? lista.filter(f => f.categoria === cat) : lista;
      const shown = _expanded ? _fotos : _fotos.slice(0, PREVIEW);

      grid.className = `gallery__grid${_expanded ? ' gallery__grid--expanded' : ''}`;
      grid.innerHTML = shown.map((f, i) => {
        const tall = i === 0 ? ' gallery__item--tall' : '';
        const wide = !_expanded && i === shown.length - 1 && shown.length >= 4
          ? ' gallery__item--wide' : '';
        return `<div class="gallery__item--img${tall}${wide}" data-idx="${i}"
                     style="background-image:url('${f.url}');background-size:${f.imgSize||'cover'};background-position:${f.imgPos||'center'}"
                     tabindex="0" role="button" aria-label="Abrir foto: ${f.titulo}">
                  <span class="gallery__caption">${f.titulo}</span>
                </div>`;
      }).join('');

      // Show/hide "Ver mais" button
      if (moreWrap) {
        moreWrap.style.display = (!_expanded && _fotos.length > PREVIEW) ? 'block' : 'none';
        if (moreBtn) moreBtn.textContent = `Ver mais fotos (${_fotos.length - shown.length} restantes)`;
      }

      // Click on items → open lightbox
      grid.querySelectorAll('[data-idx]').forEach(el => {
        el.addEventListener('click', () => openLightbox(parseInt(el.dataset.idx)));
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openLightbox(parseInt(el.dataset.idx)); });
      });
    }
  }
  window.initGaleria = initGaleria;

  // Lightbox
  const lb      = document.getElementById('lightbox');
  const lbImg   = document.getElementById('lightboxImg');
  const lbTitle = document.getElementById('lightboxTitle');
  const lbDesc  = document.getElementById('lightboxDesc');
  const lbCat   = document.getElementById('lightboxCat');
  const lbCount = document.getElementById('lightboxCounter');
  const lbClose = document.getElementById('lightboxClose');
  const lbPrev  = document.getElementById('lightboxPrev');
  const lbNext  = document.getElementById('lightboxNext');

  function openLightbox(idx) {
    _curIdx = idx;
    showSlide(_curIdx);
    if (lb) lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (lb) lb.style.display = 'none';
    document.body.style.overflow = '';
  }

  function showSlide(idx) {
    const f = _fotos[idx];
    if (!f || !lbImg) return;
    lbImg.src = f.url;
    lbImg.alt = f.titulo || '';
    if (lbTitle) lbTitle.textContent = f.titulo || '';
    if (lbDesc)  lbDesc.textContent  = f.descricao || '';
    if (lbCat)   { lbCat.textContent = f.categoria || ''; lbCat.style.display = f.categoria ? '' : 'none'; }
    if (lbCount) lbCount.textContent = `${idx + 1} / ${_fotos.length}`;
    if (lbPrev)  lbPrev.style.display = _fotos.length > 1 ? '' : 'none';
    if (lbNext)  lbNext.style.display = _fotos.length > 1 ? '' : 'none';
  }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lb) lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  if (lbPrev) lbPrev.addEventListener('click', () => { _curIdx = (_curIdx - 1 + _fotos.length) % _fotos.length; showSlide(_curIdx); });
  if (lbNext) lbNext.addEventListener('click', () => { _curIdx = (_curIdx + 1) % _fotos.length; showSlide(_curIdx); });

  document.addEventListener('keydown', e => {
    if (!lb || lb.style.display === 'none') return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  { _curIdx = (_curIdx - 1 + _fotos.length) % _fotos.length; showSlide(_curIdx); }
    if (e.key === 'ArrowRight') { _curIdx = (_curIdx + 1) % _fotos.length; showSlide(_curIdx); }
  });

  // Touch swipe on lightbox
  let _touchX = null;
  if (lb) {
    lb.addEventListener('touchstart', e => { _touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (_touchX === null) return;
      const dx = e.changedTouches[0].clientX - _touchX;
      _touchX = null;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) { _curIdx = (_curIdx + 1) % _fotos.length; showSlide(_curIdx); }
      else         { _curIdx = (_curIdx - 1 + _fotos.length) % _fotos.length; showSlide(_curIdx); }
    }, { passive: true });
  }
})();

// ---- HERO SLIDESHOW ----
(function() {
  try {
    const cfg  = JSON.parse(localStorage.getItem('site_config') || '{}');
    if (!cfg.heroSlideshow) return;

    const noticias = JSON.parse(localStorage.getItem('jsc_noticias') || '[]')
      .filter(n => n.publicada && n.imagem);
    if (noticias.length < 1) return;

    const hero    = document.querySelector('.hero');
    const slideBg = document.getElementById('heroSlideBg');
    if (!hero || !slideBg) return;

    const overlay = cfg.heroOverlay !== undefined && cfg.heroOverlay !== '' ? cfg.heroOverlay : '0.65';
    const speed   = parseInt(cfg.heroSlideSpeed) || 6000;
    let   idx     = 0;

    function applySlide(n) {
      slideBg.style.backgroundImage = `linear-gradient(rgba(0,27,77,${overlay}),rgba(0,27,77,${overlay})),url('${n.imagem}')`;
      slideBg.style.backgroundPosition = n.imagemPos || 'center';
    }

    function showSlide(n) {
      slideBg.classList.remove('visible');
      setTimeout(() => {
        applySlide(n);
        slideBg.classList.add('visible');
      }, 400);
    }

    // Aplicar primeiro slide imediatamente
    applySlide(noticias[0]);
    slideBg.classList.add('visible');

    if (noticias.length > 1) {
      setInterval(() => {
        idx = (idx + 1) % noticias.length;
        showSlide(noticias[idx]);
      }, speed);
    }
  } catch(e) {}
})();
