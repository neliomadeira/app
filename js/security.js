// =============================================
// AVISO DE CONSOLA — Juventude Sport Campinense
// =============================================
// Este ficheiro bloqueava o clique direito, o F12, o Ctrl+U, o Ctrl+S, o
// Ctrl+P e a impressão, e escondia a página dentro de um iframe.
//
// Nada disso protegia nada: o código de um site estático está sempre
// acessível a quem o queira ver, e qualquer das teclas se contorna pelo
// menu do browser. O custo, esse, era real — um encarregado de educação
// não conseguia imprimir o formulário de inscrição nem o calendário de
// jogos, nem guardar a fotografia do filho, e vários dos atalhos
// bloqueados são atalhos de acessibilidade.
//
// O enquadramento em iframe continua impedido, mas pelo cabeçalho
// X-Frame-Options do .htaccess, que é onde isso se faz.
//
// Fica o aviso na consola, que serve para uma coisa concreta: as burlas
// em que alguém convence a vítima a colar código na consola do browser.
// =============================================
(function () {
  'use strict';

  var CSS_TITULO = 'color:#e53e3e;font-size:40px;font-weight:bold;line-height:1.4';
  var CSS_TEXTO  = 'color:#1a1a1a;font-size:13px;line-height:1.6';
  var CSS_CLUBE  = 'color:#003B8E;font-size:12px;font-weight:600';

  setTimeout(function () {
    // Sem console.clear(): apagava mensagens de erro que fazem falta a
    // quem esteja a resolver um problema no site.
    console.log('%c⚠️ ATENÇÃO', CSS_TITULO);
    console.log('%cEsta consola é uma ferramenta de desenvolvimento do browser.\nSe alguém lhe pediu para colar código ou comandos aqui,\npode ser uma tentativa de fraude ou pirataria. Feche esta janela.', CSS_TEXTO);
    console.log('%c\n© 2026 Juventude Sport Campinense de Loulé — Todos os direitos reservados.', CSS_CLUBE);
  }, 500);

  // As fotografias continuam a não se arrastar para fora da página, que é
  // um travão simbólico e não estorva ninguém. Guardar continua possível.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('img').forEach(function (img) {
      img.setAttribute('draggable', 'false');
    });
  });
})();
