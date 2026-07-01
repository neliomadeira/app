// Structured data (JSON-LD) — Organization + WebSite injected on every page
(function () {
  function inject(obj) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  inject({
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    'name': 'Juventude Sport Campinense',
    'alternateName': 'JS Campinense',
    'url': 'https://www.jscampinense.pt',
    'logo': 'https://www.jscampinense.pt/images/logo.png',
    'foundingDate': '1923',
    'sport': 'Football',
    'description': 'Clube desportivo de Loulé, Algarve, com escalões de formação de Sub-9 a Sub-19.',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': 'Rua Nuno A. de Mascarenhas, Lote 16',
      'addressLocality': 'Loulé',
      'postalCode': '8100-610',
      'addressCountry': 'PT'
    },
    'contactPoint': {
      '@type': 'ContactPoint',
      'telephone': '+351-289-000-000',
      'contactType': 'customer service',
      'availableLanguage': 'Portuguese'
    }
  });

  inject({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Juventude Sport Campinense',
    'url': 'https://www.jscampinense.pt',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': 'https://www.jscampinense.pt/pesquisa.html?q={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    }
  });
})();
