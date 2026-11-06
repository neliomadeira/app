(function () {
  // Register service worker
  if ('serviceWorker' in navigator) {
    // Quem já tinha um service worker antigo não fica a ver a página partida
    // até à visita seguinte.
    //
    // Quando se instala um sw.js novo, o antigo continua a controlar a página
    // que está aberta: o novo instala-se, activa-se e reclama os clientes, mas
    // os pedidos dessa página já foram feitos — e feitos pelo antigo. Medido:
    // na primeira visita depois da correção as fotografias ainda falhavam, e
    // só na segunda é que voltavam. Para o visitante isso é "continua na
    // mesma", e é exactamente o que esta correção tinha de evitar.
    //
    // O controllerchange dispara quando o service worker que manda nesta
    // página muda. Recarregar aí resolve a visita em curso.
    //
    // Duas guardas, e as duas são precisas:
    //   jaControlada  o evento também dispara na PRIMEIRA instalação, quando o
    //                 clients.claim() assume uma página que ainda não tinha
    //                 ninguém. Aí não há nada de velho para corrigir, e
    //                 recarregar era um carregamento a dobrar em cada
    //                 visitante novo. Só se recarrega quando já havia um
    //                 service worker a controlar, ou seja, numa actualização.
    //   recarregou    uma vez e nunca mais, que é o que fecha a porta a um
    //                 ciclo de recarregamentos.
    //   aEscrever     e a terceira: ninguém perde o que estava a escrever. A
    //                 ficha de inscrição é um formulário longo, e um
    //                 recarregamento a meio apagava-o. Na prática o
    //                 controllerchange chega poucos segundos depois de a
    //                 página abrir, antes de alguém ter escrito seja o que
    //                 for; mas "na prática" não chega para arriscar a
    //                 inscrição de uma criança. Quem já tocou num campo fica
    //                 onde está — a página seguinte que abrir já vem com o
    //                 service worker novo.
    var jaControlada = !!navigator.serviceWorker.controller;
    var recarregou = false;
    var aEscrever = false;
    document.addEventListener('input', function () { aEscrever = true; }, true);
    document.addEventListener('change', function () { aEscrever = true; }, true);
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!jaControlada || recarregou || aEscrever) return;
      recarregou = true;
      window.location.reload();
    });
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
        <img src="/images/logo.svg" class="pwa-banner__logo" alt="" aria-hidden="true" />
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
