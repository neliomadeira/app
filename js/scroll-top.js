// Floating scroll-to-top button
(function () {
  function init() {
    var btn = document.createElement('button');
    btn.id = 'scrollTopBtn';
    btn.setAttribute('aria-label', 'Voltar ao topo');
    btn.innerHTML = '&#8679;';
    btn.style.cssText = [
      'position:fixed',
      'bottom:76px',
      'right:18px',
      'width:42px',
      'height:42px',
      'border-radius:50%',
      'background:#003B8E',
      'color:#fff',
      'border:none',
      'cursor:pointer',
      'font-size:1.5rem',
      'line-height:1',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 4px 16px rgba(0,59,142,0.35)',
      'opacity:0',
      'transform:translateY(12px)',
      'transition:opacity 0.3s,transform 0.3s',
      'pointer-events:none',
      'z-index:9997',
    ].join(';');
    document.body.appendChild(btn);

    function update() {
      var show = window.scrollY > 320;
      btn.style.opacity       = show ? '1' : '0';
      btn.style.transform     = show ? 'translateY(0)' : 'translateY(12px)';
      btn.style.pointerEvents = show ? 'auto' : 'none';
    }
    window.addEventListener('scroll', update, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
