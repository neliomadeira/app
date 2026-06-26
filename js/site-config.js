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

  // Redes sociais
  setHref('socialInstagram', cfg.socialInstagramUrl);
  setHref('socialFacebook',  cfg.socialFacebookUrl);
  setHref('socialWhatsapp',  cfg.socialWhatsappUrl ? 'https://wa.me/' + cfg.socialWhatsappUrl.replace(/\D/g,'') : null);

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

  // Aviso bar
  const aviso = JSON.parse(localStorage.getItem('site_aviso') || '{}');
  if (aviso.ativo && aviso.texto) {
    const bar = document.getElementById('avisoBar');
    if (bar) {
      const tipoColors = {
        info:    { bg: '#003B8E', color: '#fff' },
        averto:  { bg: '#d97706', color: '#fff' },
        sucesso: { bg: '#15803d', color: '#fff' },
        urgente: { bg: '#dc2626', color: '#fff' },
      };
      const t = tipoColors[aviso.tipo] || tipoColors.info;
      bar.style.background = t.bg;
      bar.style.color = t.color;
      bar.style.display = '';
      const span = document.getElementById('avisoTexto');
      if (span) span.textContent = aviso.texto;
      const lnk = document.getElementById('avisoLink');
      if (lnk) {
        if (aviso.link) { lnk.href = aviso.link; lnk.style.display = ''; }
        else lnk.style.display = 'none';
      }
    }
  }

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
