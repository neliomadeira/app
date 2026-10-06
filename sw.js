// Service Worker — Juventude Sport Campinense
// A subida de versão apaga as caches antigas no activate, lá em baixo. É o que
// desencrava os dispositivos que ficaram com uma página HTML velha guardada
// pela regra cache-first — ver o comentário do ramo das páginas.
const CACHE_NAME = 'jsc-v19';
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
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request).then(res => {
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
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
