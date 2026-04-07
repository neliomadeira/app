// =============================================
// SITE CONFIG — aplica configurações do admin
// =============================================
(function () {
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
})();
