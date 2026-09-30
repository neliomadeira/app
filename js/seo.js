// Structured data (JSON-LD) — Organization + WebSite injected on every page
(function () {
  function inject(obj) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  // O ano de fundação tem uma fonte única administrável: o campo "Ano de
  // fundação" do painel (dados_clube.ano). Estava aqui escrito à mão, o que
  // fazia deste ficheiro mais uma fonte independente do mesmo facto.
  //
  // Campo vazio não produz foundingDate: 1947 não volta como valor por
  // omissão. Uma data estruturada errada é pior do que uma data ausente,
  // porque os motores de busca a citam como se fosse do clube.
  function anoDeFundacao() {
    try {
      var clube = JSON.parse(localStorage.getItem('dados_clube') || '{}');
      var ano = String(clube.ano === null || clube.ano === undefined ? '' : clube.ano).trim();
      return /^\d{4}$/.test(ano) ? ano : '';
    } catch (e) { return ''; }
  }

  var organizacao = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    'name': 'Juventude Sport Campinense',
    'alternateName': 'JS Campinense',
    'url': 'https://campinense.pt',
    'logo': 'https://campinense.pt/images/logo.png',
    'sport': 'Football',
    'description': 'Clube desportivo de Loulé, Algarve, com escalões de formação de Sub-5 a Sub-19.',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Rua Nuno A. de Mascarenhas, Lote 16',
      'addressLocality': 'Loulé',
      'postalCode': '8100-610',
      'addressCountry': 'PT'
    },
    'contactPoint': {
      '@type': 'ContactPoint',
      'telephone': '+351-937-952-710',
      'contactType': 'customer service',
      'availableLanguage': 'Portuguese'
    }
  };
  var _ano = anoDeFundacao();
  if (_ano) organizacao.foundingDate = _ano;
  inject(organizacao);

  inject({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Juventude Sport Campinense',
    'url': 'https://campinense.pt',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': 'https://campinense.pt/pesquisa.html?q={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    }
  });
})();
