// =============================================
// SITE CONFIG — aplica configurações do admin
// =============================================
(function () {
  // ---- MODO MANUTENÇÃO ----
  const path = window.location.pathname;
  const isAdmin = path.includes('/admin');
  const isManu  = path.includes('manutencao');
  if (!isAdmin && !isManu) {
    const manu = JSON.parse(localStorage.getItem('site_manutencao') || '{}');
    if (manu.ativo) {
      window.location.replace('manutencao.html');
      return;
    }
  }

  function set(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== '') el.textContent = val;
  }
  function setHtml(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== '') el.innerHTML = val;
  }
  function setHref(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.href = val;
  }
  function setAttr(id, attr, val) {
    const el = document.getElementById(id);
    if (el && val) el.setAttribute(attr, val);
  }

  // Club identity — independente de site_config, corre sempre
  const clube = JSON.parse(localStorage.getItem('dados_clube') || '{}');
  if (clube.logo && clube.logo.length > 10) {
    document.querySelectorAll('.logo__img').forEach(function(el) {
      el.onerror = function() { this.src = 'images/logo.png'; this.onerror = null; };
      el.src = clube.logo;
    });
    const emblem = document.querySelector('.about__emblem-large');
    if (emblem) {
      emblem.onerror = function() { this.src = 'images/logo.png'; this.onerror = null; };
      emblem.src = clube.logo;
    }
  }
  if (clube.navNome) document.querySelectorAll('.logo__name').forEach(el => { el.textContent = clube.navNome; });
  if (clube.navSub)  document.querySelectorAll('.logo__sub').forEach(el => { el.textContent = clube.navSub; });

  const cfg = JSON.parse(localStorage.getItem('site_config') || '{}');
  if (!Object.keys(cfg).length) return;

  // Hero
  set('heroTag',  cfg.heroTag);
  setHtml('heroTitle', cfg.heroTitle);
  set('heroDesc', cfg.heroDesc);

  // Hero background image (ignorado se slideshow ativo — main.js trata disso)
  if (cfg.heroImagem && !cfg.heroSlideshow) {
    const hero = document.querySelector('.hero');
    if (hero) {
      const opacity = cfg.heroOverlay !== undefined && cfg.heroOverlay !== '' ? cfg.heroOverlay : '0.7';
      const pos     = cfg.heroImgPos || 'center';
      hero.style.backgroundImage    = `linear-gradient(rgba(0,27,77,${opacity}),rgba(0,27,77,${opacity})),url('${cfg.heroImagem}')`;
      hero.style.backgroundSize     = 'cover';
      hero.style.backgroundPosition = pos;
      hero.style.backgroundRepeat   = 'no-repeat';
    }
  }

  // Stats
  set('stat1Num',   cfg.stat1Num);   set('stat1Label', cfg.stat1Label);
  set('stat2Num',   cfg.stat2Num);   set('stat2Label', cfg.stat2Label);
  set('stat3Num',   cfg.stat3Num);   set('stat3Label', cfg.stat3Label);
  set('stat4Num',   cfg.stat4Num);   set('stat4Label', cfg.stat4Label);

  // Sobre
  set('aboutText1', cfg.aboutText1);
  set('aboutText2', cfg.aboutText2);
  set('aboutEst',   cfg.aboutEst);
  set('aboutMotto', cfg.aboutMotto);
  set('aboutVal1Title', cfg.aboutVal1Title);
  set('aboutVal1Desc',  cfg.aboutVal1Desc);
  set('aboutVal2Title', cfg.aboutVal2Title);
  set('aboutVal2Desc',  cfg.aboutVal2Desc);
  set('aboutVal3Title', cfg.aboutVal3Title);
  set('aboutVal3Desc',  cfg.aboutVal3Desc);

  // Contacto
  setHtml('contactAddress', cfg.contactAddress);
  set('contactPhone',   cfg.contactPhone);
  set('contactEmail',   cfg.contactEmail);
  set('contactHours',   cfg.contactHours);

  // Redes sociais — abre em nova tab, popula contact section + footer
  function setSocial(id, url) {
    const el = document.getElementById(id);
    if (!el || !url) return;
    el.href = url;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  }
  const waUrl = cfg.socialWhatsappUrl ? 'https://wa.me/' + cfg.socialWhatsappUrl.replace(/\D/g,'') : null;
  setSocial('socialInstagram',       cfg.socialInstagramUrl);
  setSocial('socialFacebook',        cfg.socialFacebookUrl);
  setSocial('socialWhatsapp',        waUrl);
  setSocial('footerSocialInstagram', cfg.socialInstagramUrl);
  setSocial('footerSocialFacebook',  cfg.socialFacebookUrl);
  setSocial('footerSocialWhatsapp',  waUrl);
  // Botão "Ver página no Facebook" na secção de feed
  if (cfg.socialFacebookUrl) {
    setSocial('fbSectionLink', cfg.socialFacebookUrl);
  }

  // Footer
  set('footerEmail', cfg.footerEmail);
  if (cfg.footerTagline) {
    document.querySelectorAll('.footer__tagline').forEach(el => { el.textContent = cfg.footerTagline; });
  }

  // Hero buttons
  if (cfg.heroBtn1Text) {
    const bt1 = document.getElementById('heroBt1');
    if (bt1) bt1.textContent = cfg.heroBtn1Text;
  }
  if (cfg.heroBtn1Url) {
    const bt1 = document.getElementById('heroBt1');
    if (bt1) bt1.href = cfg.heroBtn1Url;
  }
  if (cfg.heroBtn2Text) {
    const bt2 = document.getElementById('heroBt2');
    if (bt2) bt2.textContent = cfg.heroBtn2Text;
  }
  if (cfg.heroBtn2Url) {
    const bt2 = document.getElementById('heroBt2');
    if (bt2) bt2.href = cfg.heroBtn2Url;
  }

  // SEO
  if (cfg.seoTitle) document.title = cfg.seoTitle;
  if (cfg.seoDesc) {
    let meta = document.getElementById('metaDesc');
    if (!meta) {
      meta = document.querySelector('meta[name="description"]');
    }
    if (meta) meta.setAttribute('content', cfg.seoDesc);
  }


  // ---- ANNOUNCEMENT BANNER ----
  (function () {
    const banner = JSON.parse(localStorage.getItem('site_banner') || '{}');
    if (!banner.ativo || !banner.texto) return;
    const sessKey = 'banner_dismissed_' + (banner.texto || '').slice(0, 20);
    if (sessionStorage.getItem(sessKey)) return;
    const tipo = banner.tipo || 'info';
    const el = document.createElement('div');
    el.className = `site-banner site-banner--${tipo}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `<p class="site-banner__text">${banner.texto}${
      banner.link && banner.linkTexto
        ? ` <a class="site-banner__link" href="${banner.link}">${banner.linkTexto}</a>`
        : ''
    }</p><button class="site-banner__close" aria-label="Fechar" onclick="
      this.closest('.site-banner').classList.remove('site-banner--visible');
      document.body.classList.remove('has-banner');
      sessionStorage.setItem('${sessKey}', '1');
    ">&times;</button>`;
    document.body.insertAdjacentElement('afterbegin', el);
    document.body.classList.add('has-banner');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('site-banner--visible')));
  })();

  // Map — update iframe from stored coordinates or geocode address on the fly
  function applyMapCoords(lat, lon) {
    const d   = 0.015;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${(lon-d).toFixed(4)}%2C${(lat-d).toFixed(4)}%2C${(lon+d).toFixed(4)}%2C${(lat+d).toFixed(4)}&layer=mapnik&marker=${lat}%2C${lon}`;
    setAttr('contactMapIframe', 'src', src);
    const link = document.getElementById('contactMapLink');
    if (link) link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
  }

  if (cfg.contactLat && cfg.contactLon) {
    const lat = parseFloat(cfg.contactLat);
    const lon = parseFloat(cfg.contactLon);
    if (!isNaN(lat) && !isNaN(lon)) applyMapCoords(lat, lon);
  } else if (cfg.contactAddress && document.getElementById('contactMapIframe')) {
    // No stored coordinates — geocode address from the browser
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cfg.contactAddress)}&format=json&limit=1&countrycodes=pt`,
      { headers: { 'Accept': 'application/json' } })
      .then(r => r.json())
      .then(data => {
        if (data && data.length) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          applyMapCoords(lat, lon);
          // Cache coordinates so next load is instant
          try {
            const stored = JSON.parse(localStorage.getItem('site_config') || '{}');
            stored.contactLat = lat.toFixed(6);
            stored.contactLon = lon.toFixed(6);
            localStorage.setItem('site_config', JSON.stringify(stored));
          } catch(_) {}
        }
      })
      .catch(() => {});
  }

  // Staff cards — dynamic from db_treinadores if admin has been used
  (function() {
    const grid = document.getElementById('treinadoresPublicGrid');
    if (!grid) return;
    const raw = localStorage.getItem('db_treinadores');
    if (!raw) return; // keep hardcoded HTML as fallback
    let staff;
    try { staff = JSON.parse(raw); } catch(_) { return; }
    const active = (staff || []).filter(function(t) { return t.ativo !== false; });
    if (!active.length) return;
    grid.innerHTML = active.map(function(t) {
      const initials = (t.nome || '').split(' ')
        .filter(function(w) { return w.length > 1; })
        .slice(0, 2)
        .map(function(w) { return w[0].toUpperCase(); })
        .join('') || '?';
      return '<div class="staff-card">' +
        '<div class="staff-card__avatar">' + initials + '</div>' +
        '<div class="staff-card__body">' +
          '<h3 class="staff-card__name">' + (t.nome || '') + '</h3>' +
          '<span class="staff-card__role">' + (t.cargo || '') + '</span>' +
          '<span class="staff-card__team">' + (t.escalao || '') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  })();
})();
