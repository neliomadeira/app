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

});
