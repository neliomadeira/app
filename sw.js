// Service Worker — Juventude Sport Campinense
// A subida de versão apaga as caches antigas no activate, lá em baixo. É o que
// desencrava os dispositivos que ficaram com uma página HTML velha guardada
// pela regra cache-first — ver o comentário do ramo das páginas.
const CACHE_NAME = 'jsc-v21';
const PRECACHE = [
  '/',
  '/index.html',
  '/noticias.html',
  '/resultados.html',
  '/historia.html',
  '/formacao.html',
  '/escalao.html',
  '/equipa-principal.html',
  '/inscricao.html',
  '/modalidade.html',
  '/agenda.html',
  '/galeria.html',
  '/patrocinadores.html',
  '/contacto.html',
  '/manutencao.html',
  '/privacidade.html',
  '/404.html',
  '/videos.html',
  '/js/html.js',
  '/js/videos.js',
  '/css/styles.css',
  '/css/resultados.css',
  '/js/site-config.js',
  '/js/security.js',
  '/js/noticias.js',
  '/js/resultados.js',
  '/js/historia.js',
  '/js/agenda.js',
  '/js/ics.js',
  '/offline.html',
  '/js/escalao.js',
  '/js/galeria.js',
  '/atleta.html',
  '/pesquisa.html',
  '/js/atleta.js',
  '/js/pesquisa.js',
  '/js/pwa.js',
  '/images/logo.svg',
  '/images/logo.png',
  '/favicon.ico',
  '/images/favicon-32.png',
  '/images/apple-touch-icon.png',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept admin routes or non-GET requests
  if (url.pathname.startsWith('/admin') || e.request.method !== 'GET') return;

  // Nem os endpoints. O /api/ responde o estado da sessão e o conteúdo
  // publicado: são respostas de agora, não ficheiros. Estavam a cair na
  // regra do "cache primeiro", cá em baixo, e ficavam guardadas — depois
  // de entrar no painel, recarregar a página devolvia a resposta antiga,
  // "sem sessão", e o painel mandava entrar outra vez. A sessão no
  // servidor estava boa o tempo todo.
  if (url.pathname.includes('/api/')) return;

  // ---- Nada de outra origem passa por aqui --------------------------
  // Esta foi a causa das fotografias dos atletas que só apareciam com
  // Ctrl+F5, e custou a encontrar porque não é cache nenhuma.
  //
  // O .htaccess envia uma Content-Security-Policy com
  //     img-src     'self' data: https:
  //     connect-src 'self' <uma lista curta de endpoints>
  //
  // Uma fotografia alojada noutra origem, pedida pela página, é julgada pelo
  // img-src e passa. A MESMA fotografia, quando este ficheiro a vai buscar
  // com fetch(), deixa de ser uma imagem e passa a ser uma ligação: dentro de
  // um service worker é o connect-src que manda, e essa origem não está lá.
  // O fetch() é recusado, a promessa do respondWith() fica rejeitada, e o
  // browser escreve net::ERR_FAILED na imagem.
  //
  // Daí os sintomas: com "Bypass for network" ligado — ou com Ctrl+F5, que
  // salta o service worker — as fotografias aparecem, porque o pedido deixa
  // de passar por aqui e volta a ser julgado pelo img-src. Num carregamento
  // normal, não.
  //
  // Medido: com o connect-src alargado à origem das fotografias, as mesmas
  // seis imagens passaram a 6/6 em quatro visitas seguidas. Não é esse o
  // caminho que se segue — alargar o connect-src é abrir a política a toda a
  // origem, e obriga a mantê-la a par de cada sítio onde uma fotografia
  // esteja. O caminho é este: o que não é nosso não se intercepta.
  //
  // Também é o que se deve fazer por si só. Uma resposta de outra origem
  // chega aqui opaca — sem estado e sem corpo legível —, não se sabe se é
  // boa, e guardá-la é guardar algo que não se pode inspecionar. O browser
  // trata estes pedidos sozinho, como tratava antes de haver service worker.
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML pages so content stays fresh
  //
  // Só as respostas boas entram na cache. A falta desta verificação era
  // inofensiva enquanto todas as páginas eram ficheiros estáticos: o Apache
  // respondia 200 a tudo o que existia. Deixou de o ser com o E2: o
  // noticias.html?id=N responde 404 a sério quando a notícia não existe, e uma
  // 404 guardada aqui passava a ser servida no lugar da página — inclusive
  // depois de a notícia ser publicada, e inclusive offline, onde a resposta
  // guardada é a única que há.
  //
  // A resposta é devolvida sempre, 404 incluída: um erro verdadeiro tem de
  // chegar ao visitante e ao motor de busca. O que não acontece é ficar
  // guardado.
  //
  // COMO SE RECONHECE UMA PÁGINA. Isto era só
  //     e.request.destination === 'document'
  // e o Request.destination só existe a partir do Safari 16.4 / iOS 16.4. Num
  // iPhone mais antigo vinha undefined, este ramo nunca corria, e a navegação
  // caía na regra cache-first do fim do ficheiro — onde uma página guardada é
  // devolvida para sempre e nunca mais é pedida ao servidor. Depois de
  // Publicar no painel, esses telemóveis ficavam na versão antiga até a cache
  // mudar de nome, e só um endereço diferente (um ?v=… à mão) os tirava de lá.
  //
  // O request.mode === 'navigate' existe no Safari desde a 11.1, muito antes
  // do destination. O cabeçalho Accept é a terceira rede, para o caso de um
  // browser que não dê nenhum dos dois.
  const aceita = e.request.headers.get('accept') || '';
  const ehPagina = e.request.mode === 'navigate'
    || e.request.destination === 'document'
    || aceita.indexOf('text/html') !== -1;

  if (ehPagina) {
    // Guardar só o que vale a pena guardar.
    const guardar = res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    };
    e.respondWith(
      // cache: 'no-store' para este pedido não ser servido pela cache HTTP do
      // próprio browser. Sem isto, uma cópia velha que o browser tenha
      // guardado — o HTML não traz Cache-Control, e o Safari aplica frescura
      // heurística — era devolvida aqui e voltava a entrar na cache do service
      // worker: a cache reenvenenava-se a si mesma a cada navegação, e o
      // "network-first" era primeiro-a-cache-do-browser.
      fetch(e.request, { cache: 'no-store' })
        .then(guardar)
        // Um browser que recuse o init num pedido de navegação não fica sem
        // página: tenta-se o pedido simples antes de desistir da rede.
        .catch(() => fetch(e.request).then(guardar))
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/offline.html')))
    );
    return;
  }

  // Network-first for JS and CSS — always get the latest code
  //
  // O cache: 'no-store' é o que torna isto verdade. Sem ele, o fetch() passava
  // pela cache HTTP do browser, e "network-first" era na prática
  // cache-do-browser-primeiro: o .js sai do servidor sem Cache-Control, pelo que
  // cada motor lhe aplica a sua frescura heurística, e um ↻ normal não revalida
  // subrecursos que o browser considere frescos. Medido num telemóvel: depois do
  // deploy, o Chrome continuou a executar o js/sync.js antigo — o que tinha a
  // marca definitiva jsc_sync_done — e por isso nunca voltou a pedir os dados.
  // Pior: a cópia velha era depois escrita aqui, e o service worker
  // reenvenenava-se a si mesmo. O Safari, com outra heurística, buscou o
  // ficheiro novo e funcionou. Era a mesma armadilha já corrigida no ramo das
  // páginas, que tinha ficado de pé neste.
  //
  // O .catch devolve a cópia guardada: offline, é ela que serve o site.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for images and other static assets
  //
  // O .catch no fim é a segunda rede, e faltava: era o único dos três ramos
  // sem ele. Sem .catch, QUALQUER falha do fetch — a recusa da CSP que está
  // explicada lá em cima, a rede que cai a meio, um pedido abortado — rejeita
  // a promessa do respondWith() e o browser dá net::ERR_FAILED à imagem, em
  // vez de a ir buscar sozinho. Com ele, tenta-se primeiro a cópia guardada;
  // só quando não há nenhuma é que o erro chega ao visitante, e aí é um erro
  // verdadeiro.
  //
  // O caches.open().put() também passa a ter o seu: a cache tem limite, e um
  // disco cheio rejeitava esta promessa sem ninguém a ouvir. A imagem já
  // tinha sido devolvida, mas a rejeição ficava por tratar.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      });
    }).catch(() => caches.match(e.request).then(cached => cached || Response.error()))
  );
});
