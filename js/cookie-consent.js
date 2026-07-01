// RGPD / Cookie Consent — auto-injects banner on first visit
(function () {
  var CONSENT_KEY = 'jsc_cookie_consent';
  var VERSION     = '1';

  var stored = null;
  try { stored = JSON.parse(localStorage.getItem(CONSENT_KEY)); } catch (e) {}

  // Já consentiu nesta versão — nada a fazer
  if (stored && stored.v === VERSION) return;

  function setConsent(analytics) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: VERSION, analytics: analytics, ts: new Date().toISOString() })); } catch (e) {}
    removeBanner();
  }

  function removeBanner() {
    var el = document.getElementById('cookieBanner');
    if (!el) return;
    el.style.transform = 'translateY(100%)';
    el.style.opacity   = '0';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }

  function buildBanner() {
    var banner = document.createElement('div');
    banner.id = 'cookieBanner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Aviso de cookies');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:99999',
      'background:#001f4d',
      'color:#fff',
      'padding:16px 24px',
      'display:flex',
      'align-items:center',
      'gap:20px',
      'flex-wrap:wrap',
      'justify-content:space-between',
      'font-family:Roboto,sans-serif',
      'font-size:0.875rem',
      'line-height:1.5',
      'box-shadow:0 -4px 24px rgba(0,0,0,0.25)',
      'transform:translateY(100%)',
      'opacity:0',
      'transition:transform 0.4s cubic-bezier(0.4,0,0.2,1),opacity 0.4s ease',
    ].join(';');

    var text = document.createElement('p');
    text.style.cssText = 'margin:0;flex:1;min-width:220px';
    text.innerHTML = '&#127850; Este site utiliza cookies essenciais para o seu funcionamento e fontes do Google Fonts (que podem processar dados nos EUA). '
      + 'Ao continuar, aceita a nossa <a href="privacidade.html" style="color:#fbbf24;text-underline-offset:3px">Política de Privacidade</a>.';

    var btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:10px;flex-shrink:0;flex-wrap:wrap';

    var btnEssential = document.createElement('button');
    btnEssential.textContent = 'Só essenciais';
    btnEssential.style.cssText = 'padding:8px 18px;border-radius:8px;border:2px solid rgba(255,255,255,0.4);background:transparent;color:#fff;cursor:pointer;font-size:0.85rem;font-weight:600;transition:border-color 0.2s';
    btnEssential.addEventListener('mouseover', function () { this.style.borderColor = '#fff'; });
    btnEssential.addEventListener('mouseout',  function () { this.style.borderColor = 'rgba(255,255,255,0.4)'; });
    btnEssential.addEventListener('click', function () { setConsent(false); });

    var btnAccept = document.createElement('button');
    btnAccept.textContent = 'Aceitar todos';
    btnAccept.style.cssText = 'padding:8px 18px;border-radius:8px;border:none;background:#fbbf24;color:#001f4d;cursor:pointer;font-size:0.85rem;font-weight:700;transition:background 0.2s';
    btnAccept.addEventListener('mouseover', function () { this.style.background = '#f59e0b'; });
    btnAccept.addEventListener('mouseout',  function () { this.style.background = '#fbbf24'; });
    btnAccept.addEventListener('click', function () { setConsent(true); });

    btns.appendChild(btnEssential);
    btns.appendChild(btnAccept);
    banner.appendChild(text);
    banner.appendChild(btns);
    return banner;
  }

  function showBanner() {
    var banner = buildBanner();
    document.body.appendChild(banner);
    // Trigger animation after paint
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.transform = 'translateY(0)';
        banner.style.opacity   = '1';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
