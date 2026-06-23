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

  const cfg = JSON.parse(localStorage.getItem('site_config') || '{}');
  if (!Object.keys(cfg).length) return;

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

  // Contacto
  setHtml('contactAddress', cfg.contactAddress);
  set('contactPhone',   cfg.contactPhone);
  set('contactEmail',   cfg.contactEmail);
  set('contactHours',   cfg.contactHours);

  // Redes sociais
  setHref('socialInstagram', cfg.socialInstagramUrl);
  setHref('socialFacebook',  cfg.socialFacebookUrl);
  setHref('socialWhatsapp',  cfg.socialWhatsappUrl ? 'https://wa.me/' + cfg.socialWhatsappUrl.replace(/\D/g,'') : null);

  // Footer
  set('footerEmail', cfg.footerEmail);

  // Club identity — logo, nav name, nav subtitle
  const clube = JSON.parse(localStorage.getItem('dados_clube') || '{}');
  if (clube.logo) {
    document.querySelectorAll('.logo__img').forEach(el => { el.src = clube.logo; });
    const emblem = document.querySelector('.about__emblem-large');
    if (emblem) emblem.src = clube.logo;
  }
  if (clube.navNome) document.querySelectorAll('.logo__name').forEach(el => { el.textContent = clube.navNome; });
  if (clube.navSub)  document.querySelectorAll('.logo__sub').forEach(el => { el.textContent = clube.navSub; });

  // Map — update iframe when coordinates configured
  if (cfg.contactLat && cfg.contactLon) {
    const lat = parseFloat(cfg.contactLat);
    const lon = parseFloat(cfg.contactLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      const d   = 0.02;
      const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-d}%2C${lat-d}%2C${lon+d}%2C${lat+d}&layer=mapnik&marker=${lat}%2C${lon}`;
      setAttr('contactMapIframe', 'src', src);
      const link = document.getElementById('contactMapLink');
      if (link) link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    }
  }
})();
