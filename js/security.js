// =============================================
// SEGURANÇA — Juventude Sport Campinense
// Proteção de conteúdo do site público
// =============================================
(function () {
  'use strict';

  // 1. Anti-iframe (protecção contra clickjacking)
  if (window.top !== window.self) {
    try { window.top.location.href = window.self.location.href; } catch (_) {}
    document.documentElement.style.display = 'none';
    return;
  }

  // 2. Bloquear clique direito
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  // 3. Bloquear atalhos de teclado (F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I, etc.)
  document.addEventListener('keydown', function (e) {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (e.key === 'F12')                         { e.preventDefault(); return false; }
    if (ctrl && e.key.toLowerCase() === 'u')     { e.preventDefault(); return false; }
    if (ctrl && e.key.toLowerCase() === 's')     { e.preventDefault(); return false; }
    if (ctrl && e.key.toLowerCase() === 'p')     { e.preventDefault(); return false; }
    if (ctrl && shift && e.key === 'I')          { e.preventDefault(); return false; }
    if (ctrl && shift && e.key === 'J')          { e.preventDefault(); return false; }
    if (ctrl && shift && e.key === 'C')          { e.preventDefault(); return false; }
    if (ctrl && shift && e.key === 'K')          { e.preventDefault(); return false; }
  }, true);

  // 4. Bloquear arrastar imagens
  document.addEventListener('dragstart', function (e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  });

  // 5. Bloquear impressão via CSS
  (function addPrintBlock() {
    const style = document.createElement('style');
    style.textContent = '@media print { body { display:none !important; } }';
    document.head.appendChild(style);
  })();

  // 6. Aviso na consola do browser
  const CSS_TITLE  = 'color:#e53e3e;font-size:40px;font-weight:bold;line-height:1.4';
  const CSS_TEXT   = 'color:#1a1a1a;font-size:13px;line-height:1.6';
  const CSS_BRAND  = 'color:#003B8E;font-size:12px;font-weight:600';

  setTimeout(function () {
    console.clear();
    console.log('%c⚠️ ATENÇÃO', CSS_TITLE);
    console.log('%cEsta consola é uma ferramenta de desenvolvimento do browser.\nSe alguém lhe pediu para colar código ou comandos aqui,\npode ser uma tentativa de fraude ou pirataria. Feche esta janela.', CSS_TEXT);
    console.log('%c\n© 2026 Juventude Sport Campinense de Loulé — Todos os direitos reservados.\nO conteúdo deste site é propriedade do clube. Reprodução não autorizada é proibida.', CSS_BRAND);
  }, 500);

  // 7. Proteger atributo de seleção de texto nas imagens
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('img').forEach(function (img) {
      img.setAttribute('draggable', 'false');
      img.style.userSelect = 'none';
      img.style.webkitUserSelect = 'none';
      img.style.pointerEvents = 'none'; // desativa clique direito em imagens
    });
  });

})();
