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

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    // Simulate async send
    setTimeout(() => {
      form.reset();
      btn.textContent = 'Enviar mensagem';
      btn.disabled = false;
      if (formSuccess) {
        formSuccess.style.display = 'block';
        setTimeout(() => { formSuccess.style.display = 'none'; }, 5000);
      }
    }, 1200);
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

  // Notícias
  try {
    const raw = localStorage.getItem('db_noticias');
    if (raw) {
      const lista = JSON.parse(raw).filter(n => n.publicada);
      if (lista.length) {
        const grid = document.getElementById('newsGrid');
        if (grid) {
          grid.innerHTML = lista.slice(0, 3).map((n, i) => `
            <article class="news-card${i === 0 ? ' news-card--featured' : ''}">
              <div class="news-card__img${n.imagem ? '' : ` news-card__img--${n.img || 1}`}"
                   ${n.imagem ? `style="background-image:url('${n.imagem}');background-size:${(n.imagemSize||'cover').replace('auto ','')};background-position:${n.imagemPos||'center'}"` : ''}>
                <span class="news-card__cat">${n.categoria || ''}</span>
              </div>
              <div class="news-card__body">
                <time class="news-card__date">${ptDate(n.data)}</time>
                <h3 class="news-card__title">${n.titulo}</h3>
                ${n.resumo ? `<p class="news-card__excerpt">${n.resumo}</p>` : ''}
                <a href="#" class="news-card__link">Ler mais &rarr;</a>
              </div>
            </article>`).join('');
        }
      }
    }
  } catch(e) {}

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
      const MESES_CURTOS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
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
