// =============================================
// JUVENTUDE SPORT CAMPINENSE — MAIN JS
// =============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- HAMBURGER MENU ----
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  hamburger?.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    nav.classList.toggle('open');
  });

  // Close nav on link click (mobile)
  nav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      nav.classList.remove('open');
    });
  });

  // ---- HEADER SCROLL EFFECT ----
  const header = document.getElementById('header');

  const onScroll = () => {
    if (window.scrollY > 60) {
      header?.classList.add('header--scrolled');
    } else {
      header?.classList.remove('header--scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- ACTIVE NAV LINK (Intersection Observer) ----
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${entry.target.id}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(section => sectionObserver.observe(section));

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

  // ---- PHONE MASK ----
  const telefone = document.getElementById('telefone');
  if (telefone) {
    telefone.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length <= 10) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else {
        v = v.replace(/^(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4');
      }
      e.target.value = v;
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
      return `style="background-image:url('${n.imagem}');background-size:${(n.imagemSize||'cover').replace('auto ','')};background-position:${n.imagemPos||'center'}"`;
    }
    return '';
  }

  function renderNoticias() {
    try {
      const raw = localStorage.getItem('db_noticias');
      if (!raw) return;
      const lista = JSON.parse(raw).filter(n => n.publicada)
                      .sort((a,b) => (b.data||'').localeCompare(a.data||''));
      const grid = document.getElementById('newsGrid');
      if (!grid) return;
      if (!lista.length) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:40px 0">Sem notícias publicadas de momento.</p>';
        document.getElementById('btnVerTodasNoticias').style.display = 'none';
        return;
      }
      grid.innerHTML = lista.slice(0, 3).map((n, i) => `
        <article class="news-card${i === 0 ? ' news-card--featured' : ''}" style="cursor:pointer" onclick="openNewsArticle(${n.id})">
          <div class="news-card__img${n.imagem ? '' : ` news-card__img--${n.img || 1}`}" ${newsCardImg(n)}>
            <span class="news-card__cat">${n.categoria || ''}</span>
          </div>
          <div class="news-card__body">
            <time class="news-card__date">${ptDate(n.data)}</time>
            <h3 class="news-card__title">${n.titulo}</h3>
            ${n.resumo ? `<p class="news-card__excerpt">${n.resumo}</p>` : ''}
            <span class="news-card__link">Ler mais &rarr;</span>
          </div>
        </article>`).join('');

      const btn = document.getElementById('btnVerTodasNoticias');
      if (btn) btn.style.display = lista.length > 3 ? '' : 'none';
    } catch(e) {}
  }

  // ---- News archive overlay ----
  function getNoticiasLista() {
    try {
      const raw = localStorage.getItem('db_noticias');
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
      lista.map(n => `
        <div class="news-archive__item" onclick="openNewsArticle(${n.id})">
          ${archiveDateBox(n.data)}
          <div class="news-archive__img news-card__img--${n.img||1}"
               ${n.imagem ? `style="background-image:url('${n.imagem}');background-size:cover;background-position:${n.imagemPos||'center'}"` : ''}></div>
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

    body.innerHTML = `
      <button class="news-archive__back" onclick="showArchiveList();document.getElementById('newsArchiveTitle').textContent='Todas as Notícias'">
        &#8592; Voltar à lista
      </button>
      <div class="news-article">
        ${n.imagem ? `<div class="news-article__img" style="background-image:url('${n.imagem}');background-size:${(n.imagemSize||'cover').replace('auto ','')};background-position:${n.imagemPos||'center'}"></div>` : ''}
        <h2 class="news-article__title">${n.titulo}</h2>
        <div class="news-article__meta">
          <span class="news-article__cat-badge">${n.categoria || ''}</span>
          <time>${ptDate(n.data)}</time>
        </div>
        <div class="news-article__body">${n.resumo || '<em style="color:#aaa">Sem texto disponível.</em>'}</div>
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

  // Re-render when admin saves in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'db_noticias') renderNoticias();
  });

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
      const lista = JSON.parse(raw).filter(f => f.url);
      if (lista.length) {
        const grid = document.getElementById('galleryGrid');
        if (grid) {
          grid.innerHTML = lista.slice(0, 5).map((f, i) => {
            const tall = i === 0 ? ' gallery__item--tall' : '';
            const wide = i === lista.length - 1 && lista.length >= 4 ? ' gallery__item--wide' : '';
            return `<div class="gallery__item--img${tall}${wide}"
                         style="background-image:url('${f.url}');background-size:${f.imgSize||'cover'};background-position:${f.imgPos||'center'}">
                      <span class="gallery__caption">${f.titulo}</span>
                    </div>`;
          }).join('');
        }
      }
    }
  } catch(e) {}

});

// ---- HERO SLIDESHOW ----
(function() {
  try {
    const cfg  = JSON.parse(localStorage.getItem('site_config') || '{}');
    if (!cfg.heroSlideshow) return;

    const noticias = JSON.parse(localStorage.getItem('db_noticias') || '[]')
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
