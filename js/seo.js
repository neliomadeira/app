// =============================================
// DADOS ESTRUTURADOS (JSON-LD) — melhoria progressiva
// =============================================
// Os dados estruturados passaram a ser escritos no HTML pela geração
// (modelos/rodape-base.php), a partir do dados_clube e do siteConfig. Este
// ficheiro deixou de os construir: 14 das suas 15 propriedades estavam escritas
// à mão aqui, e sem JavaScript não existia nenhum.
//
// O que fica: reescrever os blocos quando o que está na página deixou de servir
// — o mesmo papel que o js/historia.js e os outros têm nas suas zonas. Se o
// bloco gerado continuar actual, não se toca nele.
//
// Réplica do jsc_dados_estruturados() do api/conteudo.php. Uma propriedade sem
// valor NÃO é escrita: uma morada incompleta ou um sameAs vazio nos dados
// estruturados é pior do que a ausência, porque os motores de busca citam-nos
// como se fossem do clube.
// =============================================
(function () {
  'use strict';

  var SITE = 'https://campinense.pt';

  function ler(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || '{}'); } catch (e) { return {}; }
  }
  function texto(o, chave) {
    return (o && typeof o[chave] === 'string') ? o[chave].trim() : '';
  }

  // Réplica exacta do jsc_clube_ano(): quatro dígitos, ou nada. Um campo vazio
  // não inventa 1947.
  function anoDeFundacao(clube) {
    var ano = String(clube.ano === null || clube.ano === undefined ? '' : clube.ano).trim();
    return /^\d{4}$/.test(ano) ? ano : '';
  }

  // Réplica exacta do jsc_redes(): só endereços com esquema aceite, e o
  // WhatsApp montado a partir dos dígitos que o painel guarda.
  function redes(cfg) {
    var wa = texto(cfg, 'socialWhatsappUrl');
    var bruto = [
      texto(cfg, 'socialInstagramUrl'),
      texto(cfg, 'socialFacebookUrl'),
      wa !== '' ? 'https://wa.me/' + wa.replace(/\D/g, '') : '',
    ];
    var fora = [];
    bruto.forEach(function (u) {
      if (u === '') return;
      var seguro = jscHrefSeguro(u);
      if (seguro) fora.push(seguro);
    });
    return fora;
  }

  function construir() {
    var clube = ler('dados_clube');
    var cfg   = ler('site_config');
    var nome  = texto(clube, 'nome');
    var sigla = texto(clube, 'sigla');
    var ano   = anoDeFundacao(clube);
    var morada   = texto(cfg, 'contactAddress');
    var telefone = texto(cfg, 'contactPhone');
    var email    = texto(cfg, 'contactEmail');

    var org = { '@context': 'https://schema.org', '@type': 'SportsOrganization' };
    if (nome) org.name = nome;
    if (sigla && sigla !== nome) org.alternateName = sigla;
    org.url = SITE;
    org.logo = SITE + '/images/logo.png';
    org.sport = 'Football';
    org.description = 'Clube desportivo de Loulé, Algarve, com escalões de formação de Sub-5 a Sub-19.';
    if (ano) org.foundingDate = ano;

    // A morada vem de um campo só, com um <br> a separar a rua do código
    // postal. Sem uma segunda linha reconhecível não se parte em campos.
    if (morada) {
      var linhas = morada.split(/\s*<br\s*\/?>\s*/i)
        .map(function (l) { return l.replace(/<[^>]*>/g, '').trim(); })
        .filter(function (l) { return l !== ''; });
      var end = { '@type': 'PostalAddress', streetAddress: linhas[0] };
      if (linhas.length > 1) {
        var m = linhas[1].match(/^(\d{4}-\d{3})\s+(.+?)(?:,.*)?$/);
        if (m) { end.postalCode = m[1]; end.addressLocality = m[2].trim(); }
        else   { end.addressLocality = linhas[1]; }
      }
      end.addressCountry = 'PT';
      org.address = end;
    }

    if (telefone || email) {
      var ponto = { '@type': 'ContactPoint', contactType: 'customer service',
                    availableLanguage: 'Portuguese' };
      if (telefone) ponto.telephone = telefone;
      if (email)    ponto.email = email;
      org.contactPoint = ponto;
    }

    var sameAs = redes(cfg);
    if (sameAs.length) org.sameAs = sameAs;

    var site = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url: SITE,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint',
                  urlTemplate: SITE + '/pesquisa.html?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    };
    if (nome) site.name = nome;

    return [org, site];
  }

  function sincronizar() {
    var existentes = document.querySelectorAll('script[data-jsc-schema]');
    var schemas = construir();

    // O bloco escrito pelo servidor continua a servir? A comparação é o próprio
    // conteúdo: se o que se construiria agora é igual ao que lá está, não se
    // toca. É o mesmo princípio do jscBlocoAtual(), aplicado a JSON.
    if (existentes.length === schemas.length) {
      var igual = true;
      for (var i = 0; i < existentes.length; i++) {
        // Comparam-se os objectos, não os textos: o json_encode() do PHP escapa
        // < e & como \u003C e \u0026, e o JSON.stringify() não. Comparar texto
        // dava sempre diferente, e o bloco do servidor era reescrito em todas as
        // páginas sem necessidade.
        var lido = null;
        try { lido = JSON.parse(existentes[i].textContent); } catch (e) { lido = null; }
        if (!lido || JSON.stringify(lido) !== JSON.stringify(schemas[i])) { igual = false; break; }
      }
      if (igual) return;
    }

    for (var j = existentes.length - 1; j >= 0; j--) {
      existentes[j].parentNode.removeChild(existentes[j]);
    }
    // Onde estavam, se lá estavam; senão no <head>.
    var onde = document.querySelector('.footer__bottom') || document.head;
    schemas.forEach(function (o) {
      var s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-jsc-schema', '1');
      // O < escapado impede que um valor do painel feche o <script>. É o
      // mesmo que o JSON_HEX_TAG faz do lado do PHP.
      s.textContent = JSON.stringify(o).replace(/</g, '\\u003C');
      onde.appendChild(s);
    });
  }

  sincronizar();
  document.addEventListener('jsc:synced', sincronizar);
})();
