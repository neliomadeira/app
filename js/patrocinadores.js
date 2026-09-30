// =============================================
// PATROCINADORES — página completa
// =============================================
// Isto vivia num <script> inline de 134 linhas dentro do patrocinadores.html.
// Saiu para aqui, como em todas as outras páginas: a página passa a poder
// existir sem JavaScript, e o HTML deixa de trazer código.
//
// Zona única: todos os patrocinadores ativos numa grelha só, pela ordem do
// array. Havia três grelhas, uma por nível de patrocínio, e um patrocinador
// ativo com um nível fora dos conhecidos desaparecia enquanto a página
// anunciava que não havia patrocinadores. O campo tier continua nos dados já
// guardados, por compatibilidade histórica, e é aqui completamente ignorado.
//
// O que era duplicado e saiu: um esc() local que não escapava o apóstrofo, um
// initials() que estourava com um registo sem nome (e deixava a página inteira
// em branco), e o texto do estado vazio escrito duas vezes. Passa tudo pelos
// ajudantes partilhados do js/html.js, que são réplica exacta dos do
// api/conteudo.php — o cartão gerado no servidor e o cartão desenhado aqui são
// o mesmo cartão.
// =============================================
(function () {
  'use strict';

  function lista() {
    try {
      return JSON.parse(localStorage.getItem('db_patrocinadores') || '[]')
        .filter(function (p) { return p && jscPatrocinadorAtivo(p.ativo); })
        .filter(function (p) { return String(p.nome || '').trim() !== ''; });
    } catch (e) { return []; }
  }

  function cartaoHtml(p) {
    var nome   = String(p.nome || '').trim();
    var sector = jscPatrocinadorSector(p.sector);
    var desde  = jscPatrocinadorDesde(p.desde);
    var url    = jscPatrocinadorUrl(p.website);
    var logo   = String(p.logo || '').trim();

    var cabeca = logo
      ? '<img src="' + jscEscUrl(logo) + '" alt="' + jscEsc(nome) + '" class="sp-card__logo-img" loading="lazy" />'
      : '<div class="sp-card__initials">' + jscEsc(jscIniciais(nome)) + '</div>';

    return [
      '<div class="sp-card">',
        '<div class="sp-card__logo-wrap">', cabeca, '</div>',
        '<div class="sp-card__body">',
          '<h3 class="sp-card__name">' + jscEsc(nome) + '</h3>',
          // Campo vazio não produz elemento: sem sector não há <span>, sem ano
          // não há linha, e sem website não há <a>. Um <a> sem href não recebe
          // foco nem é anunciado como ligação.
          sector ? '<span class="sp-card__sector">' + jscEsc(sector) + '</span>' : '',
          desde ? '<span class="sp-card__since">Parceiro desde ' + jscEsc(desde) + '</span>' : '',
          url ? '<a href="' + jscEsc(url) + '" target="_blank" rel="noopener noreferrer" class="sp-card__website">Visitar site &#8599;</a>' : '',
        '</div>',
      '</div>',
    ].join('');
  }

  // O convite final aparece sempre, com ou sem patrocinadores.
  var CTA = [
    '<div class="sp-cta">',
      '<span class="sp-cta__tag">Junte-se a nós</span>',
      '<h2 class="sp-cta__title">Quer ser patrocinador?</h2>',
      '<p class="sp-cta__desc">Associe a sua marca a um clube com mais de 100 anos de história e faça parte do futuro do desporto jovem algarvio.</p>',
      '<a href="contacto.html" class="btn btn--primary">Contacte-nos</a>',
    '</div>',
  ].join('');

  var VAZIO = [
    '<div class="sp-empty">',
      '<div class="sp-empty__icon">&#129309;</div>',
      '<p class="sp-empty__title">Seja o primeiro patrocinador</p>',
      '<p class="sp-empty__text">Ainda não temos patrocinadores registados. Se a sua empresa quer apoiar o desenvolvimento do futebol jovem em Loulé, entre em contacto connosco.</p>',
      '<a href="contacto.html" class="btn btn--primary">Torne-se patrocinador &rarr;</a>',
    '</div>',
  ].join('');

  function desenhar() {
    var caixa = document.getElementById('sponsorsContent');
    if (!caixa) return;
    var itens = lista();

    // A zona pode já vir escrita no HTML pelo servidor. Quando vem e está
    // atual, não se toca.
    if (jscBlocoAtual(caixa, itens.length)) return;

    caixa.innerHTML = (itens.length
      ? '<div class="sp-grid">' + itens.map(cartaoHtml).join('') + '</div>'
      : VAZIO) + CTA;
  }

  document.addEventListener('DOMContentLoaded', desenhar);
  document.addEventListener('jsc:synced', desenhar);
  window.addEventListener('storage', function (e) {
    if (e.key === 'db_patrocinadores') desenhar();
  });
})();
