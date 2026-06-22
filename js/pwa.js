(function () {
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  // Install banner
  let deferredPrompt = null;
  let bannerEl = null;

  function createBanner() {
    if (bannerEl) return;
    bannerEl = document.createElement('div');
    bannerEl.className = 'pwa-banner';
    bannerEl.innerHTML = `
      <div class="pwa-banner__inner">
        <img src="/images/logo.png" class="pwa-banner__logo" alt="" aria-hidden="true" />
        <div class="pwa-banner__text">
          <strong>Juventude Sport Campinense</strong>
          <span>Instalar app para acesso rápido</span>
        </div>
        <button class="pwa-banner__install" id="pwaBannerInstall">Instalar</button>
        <button class="pwa-banner__close" id="pwaBannerClose" aria-label="Fechar">&#10005;</button>
      </div>`;
    document.body.appendChild(bannerEl);

    document.getElementById('pwaBannerInstall').addEventListener('click', () => {
      hideBanner();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
    });

    document.getElementById('pwaBannerClose').addEventListener('click', () => {
      hideBanner();
      try { sessionStorage.setItem('pwa_banner_dismissed', '1'); } catch (e) {}
    });

    // Animate in
    requestAnimationFrame(() => bannerEl.classList.add('pwa-banner--visible'));
  }

  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove('pwa-banner--visible');
    setTimeout(() => { bannerEl && bannerEl.remove(); bannerEl = null; }, 350);
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    try {
      if (sessionStorage.getItem('pwa_banner_dismissed')) return;
    } catch (e) {}
    // Small delay so banner doesn't flash immediately on page load
    setTimeout(createBanner, 2500);
  });

  window.addEventListener('appinstalled', hideBanner);
})();
