#!/usr/bin/env node
'use strict';

// =====================================================================
// TESTAR SEM JAVASCRIPT — bloco das notícias da página inicial
// =====================================================================
// Este projeto não tem framework de testes. Este guião faz o que um teste
// de integração faria: gera o bloco das notícias a sério, com o PHP, e
// abre a página inicial num browser com o JavaScript desligado para ver se
// o conteúdo está lá.
//
// Nada disto toca no projeto. Trabalha sempre sobre uma cópia temporária,
// e os dados vêm de tools/teste/noticias-EXEMPLO-TESTE.json — notícias
// inventadas de propósito, TESTE A/B/C, que nunca entram no site.
//
// Uso:
//     node tools/testar-sem-js.js
//
// Código de saída: 0 se tudo passar, 1 se algo falhar.
// =====================================================================

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { carregarPlaywright, caminhoChromium, arrancarServidor, RAIZ_PROJETO } = require('./ambiente');

const FIXTURE = path.join(__dirname, 'teste', 'noticias-EXEMPLO-TESTE.json');

// As regiões geradas, por ficheiro. Cada uma é um par de marcas.
const BLOCOS = {
  'index.html':    { ini: '<!-- JSC:noticias:inicio -->',        fim: '<!-- JSC:noticias:fim -->' },
  'noticias.html': { ini: '<!-- JSC:noticias-pagina:inicio -->', fim: '<!-- JSC:noticias-pagina:fim -->' },
};

// Ruído conhecido e inofensivo: os recursos externos que este teste corta de
// propósito (tipos de letra, mapas) aparecem na consola como falha de rede.
// A mesma lista do tools/validar.js.
const RUIDO = [
  /favicon\.ico/i,
  /ERR_INTERNET_DISCONNECTED/i,
  /net::ERR_(FAILED|BLOCKED_BY_CLIENT|NAME_NOT_RESOLVED|CERT_AUTHORITY_INVALID)/i,
];

const resultados = [];
function verificar(nome, ok, detalhe = '') {
  resultados.push({ nome, ok: !!ok, detalhe });
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${ok || !detalhe ? '' : '\n      ' + detalhe}`);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// O que está fora das marcas — o HTML escrito à mão, que a geração não pode
// tocar. Calculado aqui, sem passar pelo código que gera.
function foraDasMarcas(html, ficheiro) {
  const b = BLOCOS[ficheiro];
  const pi = html.indexOf(b.ini);
  const pf = html.indexOf(b.fim);
  if (pi < 0 || pf < 0) return null;
  return html.slice(0, pi + b.ini.length) + '\u0000' + html.slice(pf);
}

// Só a região gerada, para contar o que lá está dentro sem apanhar o resto
// da página.
function dentroDasMarcas(html, ficheiro) {
  const b = BLOCOS[ficheiro];
  const pi = html.indexOf(b.ini);
  const pf = html.indexOf(b.fim);
  if (pi < 0 || pf < 0) return '';
  return html.slice(pi + b.ini.length, pf);
}

// ---------------------------------------------------------------------
// Cópia de trabalho
// ---------------------------------------------------------------------
function copiarProjeto() {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-semjs-'));
  // mkdtemp cria a pasta com 0700. O Apache do teste corre como www-data e
  // sem poder entrar na pasta responde 403 a tudo, incluindo ao index.html.
  fs.chmodSync(dest, 0o755);
  for (const item of fs.readdirSync(RAIZ_PROJETO)) {
    if (item === '.git' || item === 'node_modules') continue;
    const r = spawnSync('cp', ['-a', path.join(RAIZ_PROJETO, item), dest]);
    if (r.status !== 0) { console.error('cp falhou em ' + item); process.exit(2); }
  }
  // O browser do Playwright não tem de vir na cópia.
  fs.rmSync(path.join(dest, 'tools', 'node_modules'), { recursive: true, force: true });
  return dest;
}

function escreverDados(raiz, dados) {
  fs.mkdirSync(path.join(raiz, 'data'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'data', 'db.json'), JSON.stringify(dados));
}

function gerar(raiz, argumentos = []) {
  const r = spawnSync('php', ['api/gerar.php', ...argumentos], { cwd: raiz, encoding: 'utf8' });
  return { estado: r.status, saida: (r.stdout || '') + (r.stderr || '') };
}

// ---------------------------------------------------------------------
// Testes que não precisam de browser
// ---------------------------------------------------------------------
function testesDeGeracao(raiz, dados) {
  const idx = path.join(raiz, 'index.html');
  const not = path.join(raiz, 'noticias.html');
  const db  = path.join(raiz, 'data', 'db.json');

  // Quantas notícias cada página deve mostrar, contado a partir da fixture e
  // não a partir do que o gerador produziu.
  const agora = new Date().toISOString();
  const publicadas = dados.noticias.filter((n) => n.publicada);
  const daPagina = dados.noticias.filter((n) => n.publicada
    || (n.scheduledAt && n.scheduledAt <= agora));
  const PREVIA = 9;
  const extras = Math.max(0, daPagina.length - PREVIA);

  // ---- 1. Geração com a fixture ----------------------------------
  const antesIdx = fs.readFileSync(idx, 'utf8');
  const antesNot = fs.readFileSync(not, 'utf8');
  verificar('index.html tem as duas marcas', foraDasMarcas(antesIdx, 'index.html') !== null);
  verificar('noticias.html tem as duas marcas', foraDasMarcas(antesNot, 'noticias.html') !== null);

  escreverDados(raiz, dados);
  let g = gerar(raiz);
  verificar('geração corre sem erro', g.estado === 0, g.saida.trim());
  verificar('a geração escreveu as duas páginas',
    /index\.html/.test(g.saida) && /noticias\.html/.test(g.saida), g.saida.trim());

  const depoisHtml = fs.readFileSync(idx, 'utf8');
  const depoisNot  = fs.readFileSync(not, 'utf8');

  // ---- 9. Comparação byte a byte do HTML exterior às marcas -------
  for (const [nome, antes, depois] of [
    ['index.html', antesIdx, depoisHtml],
    ['noticias.html', antesNot, depoisNot],
  ]) {
    const a = foraDasMarcas(antes, nome);
    const d = foraDasMarcas(depois, nome);
    verificar(nome + ': HTML fora das marcas igual byte a byte',
      a !== null && d !== null && sha(a) === sha(d),
      'sha256 antes ' + (a && sha(a).slice(0, 16)) + ' / depois ' + (d && sha(d).slice(0, 16)));
  }

  verificar('o bloco gerado mudou de facto', antesIdx !== depoisHtml);
  verificar('3 cartões no HTML gerado',
    (depoisHtml.match(/<article class="news-card/g) || []).length === 3);
  verificar('a notícia não publicada não foi escrita',
    !depoisHtml.includes('TESTE D NAO PUBLICADA'));
  verificar('o título com & e <b> foi escapado',
    depoisHtml.includes('TESTE C &amp; &lt;b&gt;escape&lt;/b&gt;'));
  verificar('a marca data-gerado ficou com a data da publicação',
    depoisHtml.includes('data-gerado="' + dados.publicadoEm + '"'));
  verificar('o estilo da imagem é um atributo a sério',
    depoisHtml.includes("style=\"background-image:url('images/logo.png')")
    && !depoisHtml.includes('style=&quot;background-image'));

  // ---- noticias.html: lista completa, destaque, filtros ----------
  const bloco = dentroDasMarcas(depoisNot, 'noticias.html');
  verificar('noticias.html: ' + daPagina.length + ' cartões (publicadas + agendadas devidas)',
    (bloco.match(/<article class="news-card news-page__card/g) || []).length === daPagina.length,
    'obtive ' + (bloco.match(/<article class="news-card news-page__card/g) || []).length);
  verificar('noticias.html: ' + extras + ' cartões marcados como extra',
    (bloco.match(/news-page__card--extra/g) || []).length === extras);
  verificar('noticias.html: uma ligação "Ler mais" por cartão, mais a do destaque',
    (bloco.match(/<a class="news-card__link" href="noticias\.html\?id=/g) || []).length === daPagina.length + 1);
  verificar('noticias.html: cartão de destaque com a notícia marcada no painel',
    bloco.includes('class="news-hero-card"') && bloco.includes('TESTE N DESTAQUE'));
  verificar('noticias.html: a notícia agendada para o passado aparece',
    bloco.includes('TESTE P AGENDADA PASSADO'));
  verificar('noticias.html: a notícia agendada para 2099 não aparece',
    !bloco.includes('TESTE Q AGENDADA FUTURO'));
  verificar('noticias.html: a notícia não publicada não aparece',
    !bloco.includes('TESTE D NAO PUBLICADA'));
  verificar('noticias.html: a agendada devida NÃO entra na página inicial',
    !dentroDasMarcas(depoisHtml, 'index.html').includes('TESTE P AGENDADA PASSADO'));
  verificar('noticias.html: data-itens igual ao número de cartões',
    bloco.includes('data-itens="' + daPagina.length + '"'));
  verificar('noticias.html: data-gerado com a data da publicação',
    bloco.includes('data-gerado="' + dados.publicadoEm + '"'));
  verificar('noticias.html: botão "Ver mais" com as (' + extras + ' restantes)',
    bloco.includes('Ver mais notícias (' + extras + ' restantes)'));
  verificar('noticias.html: o estado vazio fica escondido',
    bloco.includes('id="notEmpty" hidden'));
  verificar('noticias.html: sem resumo não há parágrafo de resumo vazio',
    !bloco.includes('<p class="news-card__excerpt"></p>'));
  verificar('noticias.html: sem categoria não há etiqueta vazia',
    !bloco.includes('<span class="news-card__cat"></span>'));
  verificar('noticias.html: URL com apóstrofo e parêntesis vem percent-encoded',
    bloco.includes("url('images/logo.png?x=a%27b%281%29')"),
    (bloco.match(/url\('images\/logo\.png[^']*'\)/) || ['(não encontrei)'])[0]);
  verificar('noticias.html: os três filtros gerados, com a categoria em data-cat',
    bloco.includes('data-cat="">Todas<') && bloco.includes('data-cat="TESTE">')
    && bloco.includes('data-cat="TESTE-2">'));
  verificar('noticias.html: partilha com o endereço público do canonical',
    bloco.includes('https%3A%2F%2Fcampinense.pt%2Fnoticias.html%3Fid%3D'));
  verificar('publicadas na fixture: ' + publicadas.length + ', na página inicial mostram-se 3',
    (dentroDasMarcas(depoisHtml, 'index.html').match(/<article class="news-card/g) || []).length === 3);

  // ---- 8a. Corrupção: o modelo rebenta ---------------------------
  // A transação cobre o conjunto: um erro num dos modelos não pode deixar a
  // outra página publicada. Por isso cada ensaio compara os TRÊS ficheiros.
  const modeloInicio = path.join(raiz, 'modelos', 'noticias-inicio.php');
  const modeloPagina = path.join(raiz, 'modelos', 'noticias-pagina.php');
  const bomInicio = fs.readFileSync(modeloInicio, 'utf8');
  const bomPagina = fs.readFileSync(modeloPagina, 'utf8');
  const htmlBom   = fs.readFileSync(idx, 'utf8');
  const notBom    = fs.readFileSync(not, 'utf8');
  const dbBom     = fs.readFileSync(db, 'utf8');

  const nadaMudou = (etiqueta) => {
    verificar(etiqueta + ': index.html intacto byte a byte',
      fs.readFileSync(idx, 'utf8') === htmlBom);
    verificar(etiqueta + ': noticias.html intacto byte a byte',
      fs.readFileSync(not, 'utf8') === notBom);
    verificar(etiqueta + ': data/db.json intacto byte a byte',
      fs.readFileSync(db, 'utf8') === dbBom);
  };

  for (const [etiqueta, ficheiro, bom] of [
    ['modelo da página inicial que rebenta', modeloInicio, bomInicio],
    ['modelo da página de notícias que rebenta', modeloPagina, bomPagina],
  ]) {
    fs.writeFileSync(ficheiro, bom + "\n<?php throw new RuntimeException('corrupção de teste'); ?>\n");
    g = gerar(raiz);
    verificar(etiqueta + ': a geração falha', g.estado !== 0, g.saida.trim().slice(0, 200));
    nadaMudou(etiqueta);
    fs.writeFileSync(ficheiro, bom);
  }

  // ---- 8b. Corrupção: HTML desequilibrado ------------------------
  fs.writeFileSync(modeloPagina, bomPagina.replace('      </div>\n', '      <div>\n'));
  g = gerar(raiz);
  verificar('HTML desequilibrado: a validação recusa', g.estado !== 0, g.saida.trim().slice(0, 200));
  nadaMudou('HTML desequilibrado');
  fs.writeFileSync(modeloPagina, bomPagina);

  // ---- 8b2. Contagem de cartões errada ---------------------------
  // Um modelo que escreva menos cartões do que os dados têm não passa: é a
  // validação própria do bloco, não a genérica.
  fs.writeFileSync(modeloPagina, bomPagina.replace(
    '<?php foreach ($noticias as $i => $n):',
    '<?php foreach (array_slice($noticias, 0, 2) as $i => $n):'));
  g = gerar(raiz);
  verificar('menos cartões do que os dados: a validação recusa',
    g.estado !== 0 && /cartões/.test(g.saida), g.saida.trim().slice(0, 200));
  nadaMudou('contagem errada');
  fs.writeFileSync(modeloPagina, bomPagina);

  // ---- 8c. Corrupção: marca em falta no HTML ---------------------
  for (const [etiqueta, ficheiro, bom, marca] of [
    ['marca em falta na página inicial', idx, htmlBom, BLOCOS['index.html'].fim],
    ['marca em falta na página de notícias', not, notBom, BLOCOS['noticias.html'].fim],
  ]) {
    fs.writeFileSync(ficheiro, bom.replace(marca, '<!-- marca apagada de propósito -->'));
    g = gerar(raiz);
    verificar(etiqueta + ': a geração aborta', g.estado !== 0, g.saida.trim().slice(0, 200));
    fs.writeFileSync(ficheiro, bom);
  }

  // ---- 8d. Transação interrompida: o diário repara ---------------
  // Simula o que ficaria em disco se o processo morresse a meio da
  // promoção: um backup da versão anterior e um diário sem fechar.
  const ant = path.join(raiz, 'data', 'publicacao', 'anterior');
  fs.mkdirSync(ant, { recursive: true });
  const versaoAnterior = htmlBom.replace(
    /<!-- JSC:noticias:inicio -->[\s\S]*<!-- JSC:noticias:fim -->/,
    BLOCOS['index.html'].ini
      + '\n      <div class="news__grid" id="newsGrid" data-gerado="1999-01-01T00:00:00.000Z"></div>\n      '
      + BLOCOS['index.html'].fim);
  fs.writeFileSync(path.join(ant, 'index.html'), versaoAnterior);
  fs.writeFileSync(path.join(ant, 'noticias.html'), notBom);
  fs.writeFileSync(path.join(raiz, 'data', 'publicacao', 'transacao.json'),
    JSON.stringify({ iniciada: '2020-01-01T00:00:00+00:00', por: 'teste',
                     ficheiros: [{ destino: 'index.html' }, { destino: 'noticias.html' }] }));
  fs.writeFileSync(idx, htmlBom.replace('</body>', '<!-- estado a meio --></body>'));
  fs.writeFileSync(not, notBom.replace('</body>', '<!-- estado a meio --></body>'));
  g = gerar(raiz);
  verificar('diário pendente: a publicação seguinte restaura e avisa',
    g.estado === 0 && /não tinha terminado/.test(g.saida), g.saida.trim().slice(0, 200));
  verificar('diário pendente: as duas páginas foram repostas',
    !fs.readFileSync(idx, 'utf8').includes('estado a meio')
    && !fs.readFileSync(not, 'utf8').includes('estado a meio'));
  verificar('diário pendente: o diário foi fechado',
    !fs.existsSync(path.join(raiz, 'data', 'publicacao', 'transacao.json')));

  // ---- Reverter a pedido ----------------------------------------
  const antesReverter = fs.readFileSync(not, 'utf8');
  g = gerar(raiz, ['--reverter']);
  verificar('reverter: corre sem erro e nomeia as duas páginas',
    g.estado === 0 && /noticias\.html/.test(g.saida), g.saida.trim().slice(0, 200));
  verificar('reverter: a noticias.html voltou ao backup',
    fs.readFileSync(not, 'utf8') !== antesReverter || antesReverter === notBom);

  // ---- Deixar a cópia no estado bom, com a fixture gerada --------
  fs.writeFileSync(idx, htmlBom);
  fs.writeFileSync(not, notBom);
  escreverDados(raiz, dados);
  g = gerar(raiz);
  verificar('geração final para os testes de browser', g.estado === 0, g.saida.trim());
}

// ---------------------------------------------------------------------
// Testes no browser
// ---------------------------------------------------------------------
async function testarPagina(browser, url, comJs, largura) {
  const ctx = await browser.newContext({
    javaScriptEnabled: comJs,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: largura, height: 900 });

  const erros = [];
  const ruido = (t) => RUIDO.some((r) => r.test(t));
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text()); });
  pg.on('response', (r) => {
    const t = r.status() + ' ' + r.url().replace(url, '');
    if (r.status() >= 400 && !ruido(t)) erros.push(t);
  });

  // Recursos externos cortados, como no validar.js.
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  const resp = await pg.goto(url + '/index.html', { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });
  const estado = resp ? resp.status() : 0;
  const inicioDoCorpo = estado === 200 ? '' : (await pg.content()).slice(0, 300);

  const d = await pg.evaluate(() => {
    const grid = document.getElementById('newsGrid');
    const cartoes = grid ? grid.querySelectorAll('article.news-card') : [];
    const doc = document.documentElement;
    return {
      cartoes: cartoes.length,
      titulos: Array.from(cartoes).map((c) => (c.querySelector('.news-card__title') || {}).textContent || ''),
      links: Array.from(cartoes).map((c) => {
        const a = c.querySelector('a.news-card__link');
        return a ? a.getAttribute('href') : '';
      }),
      vazio: !!(grid && grid.querySelector('.jsc-vazio')),
      botao: (() => {
        const b = document.getElementById('btnVerTodasNoticias');
        if (!b) return 'ausente';
        return getComputedStyle(b).display === 'none' ? 'escondido' : 'visivel';
      })(),
      transbordo: doc.scrollWidth - doc.clientWidth,
      temTagB: !!(grid && grid.querySelector('.news-card__title b')),
      textoBody: document.body.innerText.length,
    };
  });
  await ctx.close();
  return { ...d, estado, inicioDoCorpo, erros };
}

// Sonda da página de notícias. Devolve o que se vê, não o que está escrito:
// a diferença entre estar no DOM e estar visível é o centro deste bloco.
async function testarNoticias(browser, url, comJs, largura, opcoes = {}) {
  const ctx = await browser.newContext({
    javaScriptEnabled: comJs,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  if (opcoes.preview) {
    await ctx.addInitScript((rascunho) => {
      try { sessionStorage.setItem('news_preview', JSON.stringify(rascunho)); } catch (_) {}
    }, opcoes.preview);
  }
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: largura, height: 900 });

  const erros = [];
  const ruido = (t) => RUIDO.some((r) => r.test(t));
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text()); });
  pg.on('response', (r) => {
    const t = r.status() + ' ' + r.url().replace(url, '');
    if (r.status() >= 400 && !ruido(t)) erros.push(t);
  });
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  const resp = await pg.goto(url + '/noticias.html' + (opcoes.query || ''),
    { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });
  const estado = resp ? resp.status() : 0;

  if (opcoes.clicar) await pg.click(opcoes.clicar);

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const cartoes = Array.from(document.querySelectorAll('#notGrid article.news-page__card'));
    const doc = document.documentElement;
    const mais = document.getElementById('notMoreWrap');
    const artigo = document.getElementById('notArticle');
    return {
      cartoes: cartoes.length,
      visiveis: cartoes.filter(visivel).length,
      titulos: cartoes.map((c) => (c.querySelector('.news-card__title') || {}).textContent || ''),
      ligacoes: cartoes.map((c) => {
        const a = c.querySelector('a.news-card__link');
        return a ? a.getAttribute('href') : '';
      }),
      destaque: (() => {
        const a = document.querySelector('#notFeatured .news-hero-card');
        if (!a) return '';
        const t = a.querySelector('.news-hero-card__title');
        return t ? t.textContent : '(sem título)';
      })(),
      destaqueLigacao: (() => {
        const a = document.querySelector('#notFeatured a.news-card__link');
        return a ? a.getAttribute('href') : '';
      })(),
      filtros: visivel(document.getElementById('notFilters')),
      nFiltros: document.querySelectorAll('#notFilters .news-filter-btn').length,
      mais: visivel(mais),
      maisTexto: (document.getElementById('notMoreBtn') || {}).textContent || '',
      vazio: visivel(document.getElementById('notEmpty')),
      artigo: visivel(artigo),
      artigoTexto: artigo ? (artigo.textContent || '').slice(0, 400) : '',
      copiar: document.querySelectorAll('#notGrid .news-share-btn').length,
      copiarVisivel: Array.from(document.querySelectorAll('#notGrid button.news-share-btn')).filter(visivel).length,
      banner: (document.body.innerText || '').includes('Pré-visualização'),
      transbordo: doc.scrollWidth - doc.clientWidth,
      focaveis: cartoes.filter((c) => c.querySelector('a.news-card__link')).length,
    };
  });
  const inicioDoCorpo = estado === 200 ? '' : (await pg.content()).slice(0, 300);
  await ctx.close();
  return { ...d, estado, inicioDoCorpo, erros };
}

// ---------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------
(async () => {
  if (!fs.existsSync(FIXTURE)) { console.error('fixture em falta: ' + FIXTURE); process.exit(2); }
  const dados = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

  const raiz = copiarProjeto();
  console.log('\ncópia de trabalho: ' + raiz);
  console.log('dados de teste:    tools/teste/noticias-EXEMPLO-TESTE.json (TESTE A/B/C)\n');

  console.log('geração e transação');
  testesDeGeracao(raiz, dados);

  const playwright = carregarPlaywright();
  const srv = await arrancarServidor({ raiz, portaHttp: 8097, portaPhp: 8096 });
  // JSC_DEBUG=1 mantém a cópia de trabalho, para diagnóstico.
  const limpar = () => {
    srv.parar();
    if (process.env.JSC_DEBUG) { console.error('cópia de trabalho mantida em ' + raiz); return; }
    try { fs.rmSync(raiz, { recursive: true, force: true }); } catch (_) {}
  };
  process.on('exit', limpar);
  process.on('SIGINT', () => { limpar(); process.exit(130); });

  console.log('\nservidor: ' + srv.modo + '  ' + srv.url);
  srv.avisos.forEach((a) => console.log('  aviso: ' + a));

  const exe = caminhoChromium(playwright);
  const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});

  try {
    // ---- 2. Sem JavaScript ---------------------------------------
    console.log('\npágina inicial SEM JavaScript (1440px)');
    let r = await testarPagina(browser, srv.url, false, 1440);
    verificar('a página inicial responde 200', r.estado === 200,
      'respondeu ' + r.estado + ' — ' + r.inicioDoCorpo.replace(/\s+/g, ' '));
    verificar('3 cartões de notícias', r.cartoes === 3, 'obtive ' + r.cartoes);
    verificar('títulos pela ordem certa (mais recente primeiro)',
      r.titulos.join(' | ') === 'TESTE A | TESTE B | TESTE C & <b>escape</b>',
      r.titulos.join(' | '));
    verificar('o & e o <b> ficaram texto, não HTML', !r.temTagB);
    verificar('cada cartão tem um link navegável sem JavaScript',
      r.links.length === 3 && r.links.every((h) => /^noticias\.html\?id=\d+$/.test(h)),
      r.links.join(' | '));
    verificar('a mensagem de lista vazia desapareceu', !r.vazio);
    verificar('o botão Ver todas está visível (mais publicadas do que as mostradas)',
      r.botao === 'visivel', r.botao);
    verificar('sem transbordo horizontal', r.transbordo <= 0, '+' + r.transbordo + 'px');

    // ---- 6. 320 px, sem JavaScript -------------------------------
    console.log('\npágina inicial SEM JavaScript (320px)');
    r = await testarPagina(browser, srv.url, false, 320);
    verificar('3 cartões a 320px', r.cartoes === 3, 'obtive ' + r.cartoes);
    verificar('sem transbordo horizontal a 320px', r.transbordo <= 0, '+' + r.transbordo + 'px');

    // ---- 3 e 5. Com JavaScript, sem duplicações ------------------
    console.log('\npágina inicial COM JavaScript (1440px)');
    r = await testarPagina(browser, srv.url, true, 1440);
    verificar('continuam 3 cartões — o JavaScript não duplicou nada',
      r.cartoes === 3, 'obtive ' + r.cartoes);
    verificar('os mesmos títulos, na mesma ordem',
      r.titulos.join(' | ') === 'TESTE A | TESTE B | TESTE C & <b>escape</b>',
      r.titulos.join(' | '));
    verificar('sem erros de JavaScript', r.erros.length === 0, r.erros.join(' / '));
    verificar('sem transbordo horizontal', r.transbordo <= 0, '+' + r.transbordo + 'px');

    console.log('\npágina inicial COM JavaScript (320px)');
    r = await testarPagina(browser, srv.url, true, 320);
    verificar('3 cartões a 320px com JavaScript', r.cartoes === 3, 'obtive ' + r.cartoes);
    verificar('sem transbordo horizontal a 320px', r.transbordo <= 0, '+' + r.transbordo + 'px');

    // ---- Página de notícias -------------------------------------
    const agora = new Date().toISOString();
    const N = dados.noticias.filter((n) => n.publicada
      || (n.scheduledAt && n.scheduledAt <= agora)).length;
    const EXTRAS = N - 9;

    console.log('\npágina de notícias SEM JavaScript (1440px)');
    let p = await testarNoticias(browser, srv.url, false, 1440);
    verificar('responde 200', p.estado === 200,
      'respondeu ' + p.estado + ' — ' + p.inicioDoCorpo.replace(/\s+/g, ' '));
    verificar('os ' + N + ' cartões estão no HTML', p.cartoes === N, 'obtive ' + p.cartoes);
    verificar('e TODOS estão visíveis — a lista completa sem JavaScript',
      p.visiveis === N, 'visíveis ' + p.visiveis + ' de ' + p.cartoes);
    verificar('ordem por data descendente',
      p.titulos.slice(0, 3).join(' | ') === 'TESTE A | TESTE B | TESTE C & <b>escape</b>',
      p.titulos.slice(0, 3).join(' | '));
    verificar('cada cartão tem uma ligação navegável',
      p.ligacoes.length === N && p.ligacoes.every((h) => /^noticias\.html\?id=\d+$/.test(h)),
      p.ligacoes.slice(0, 3).join(' | '));
    verificar('o cartão de destaque está lá, com ligação',
      p.destaque === 'TESTE N DESTAQUE' && /^noticias\.html\?id=\d+$/.test(p.destaqueLigacao),
      p.destaque + ' / ' + p.destaqueLigacao);
    verificar('a barra de filtros NÃO aparece sem JavaScript', !p.filtros);
    verificar('o botão "Ver mais" NÃO aparece sem JavaScript', !p.mais);
    verificar('o botão de copiar ligação NÃO aparece sem JavaScript',
      p.copiarVisivel === 0, 'visíveis ' + p.copiarVisivel);
    verificar('o estado vazio não aparece', !p.vazio);
    verificar('a vista de artigo não aparece', !p.artigo);
    verificar('sem transbordo horizontal', p.transbordo <= 0, '+' + p.transbordo + 'px');

    console.log('\npágina de notícias SEM JavaScript (320px)');
    p = await testarNoticias(browser, srv.url, false, 320);
    verificar('os ' + N + ' cartões visíveis a 320px', p.visiveis === N, 'visíveis ' + p.visiveis);
    verificar('sem transbordo horizontal a 320px', p.transbordo <= 0, '+' + p.transbordo + 'px');

    console.log('\npágina de notícias COM JavaScript (1440px)');
    p = await testarNoticias(browser, srv.url, true, 1440);
    verificar('os ' + N + ' cartões continuam no HTML — sem duplicação',
      p.cartoes === N, 'obtive ' + p.cartoes);
    verificar('só 9 visíveis, como hoje', p.visiveis === 9, 'visíveis ' + p.visiveis);
    verificar('a barra de filtros aparece, com "Todas" mais as 2 categorias',
      p.filtros && p.nFiltros === 3, 'visível=' + p.filtros + ' botões=' + p.nFiltros);
    verificar('o botão "Ver mais" aparece com as (' + EXTRAS + ' restantes)',
      p.mais && p.maisTexto.includes('(' + EXTRAS + ' restantes)'), p.maisTexto);
    verificar('o botão de copiar ligação aparece', p.copiarVisivel > 0);
    verificar('sem erros de JavaScript', p.erros.length === 0, p.erros.join(' / '));
    verificar('sem transbordo horizontal', p.transbordo <= 0, '+' + p.transbordo + 'px');

    console.log('\npágina de notícias COM JavaScript (320px)');
    p = await testarNoticias(browser, srv.url, true, 320);
    verificar('9 visíveis a 320px', p.visiveis === 9, 'visíveis ' + p.visiveis);
    verificar('sem transbordo horizontal a 320px', p.transbordo <= 0, '+' + p.transbordo + 'px');

    console.log('\ninteração (só faz sentido com JavaScript)');
    p = await testarNoticias(browser, srv.url, true, 1440, { clicar: '#notMoreBtn' });
    verificar('"Ver mais": passam a estar visíveis os ' + N,
      p.visiveis === N, 'visíveis ' + p.visiveis + ' de ' + p.cartoes);
    verificar('"Ver mais": sem duplicação depois de o JavaScript redesenhar',
      p.cartoes === N, 'cartões ' + p.cartoes);
    verificar('"Ver mais": o botão desaparece quando já está tudo à vista', !p.mais);

    const nCat2 = dados.noticias.filter((n) => n.categoria === 'TESTE-2'
      && (n.publicada || (n.scheduledAt && n.scheduledAt <= agora))).length;
    p = await testarNoticias(browser, srv.url, true, 1440, { clicar: '[data-cat="TESTE-2"]' });
    verificar('filtro por categoria: mostra as ' + nCat2 + ' dessa categoria',
      p.visiveis === nCat2 && p.cartoes === nCat2, 'visíveis ' + p.visiveis + ' / no DOM ' + p.cartoes);

    p = await testarNoticias(browser, srv.url, true, 1440, { query: '?id=1001' });
    verificar('?id= continua a abrir o artigo, como antes',
      p.artigo && p.artigoTexto.includes('TESTE A'), 'artigo visível=' + p.artigo);

    p = await testarNoticias(browser, srv.url, true, 1440, {
      query: '?preview=1',
      preview: { id: '__preview__', titulo: 'TESTE RASCUNHO', data: '2020-01-09',
                 categoria: 'TESTE', resumo: 'Rascunho de pré-visualização.' },
    });
    verificar('?preview=1 continua a mostrar a faixa de pré-visualização',
      p.banner && p.artigoTexto.includes('TESTE RASCUNHO'),
      'faixa=' + p.banner);

    // ---- Divergência de data-itens ------------------------------
    // É assim que uma notícia agendada que venceu depois da publicação
    // chega ao visitante: a contagem do JavaScript deixa de bater com a do
    // gerador, e o JavaScript desenha. Aqui força-se a divergência à mão
    // para o ensaio não depender do relógio.
    console.log('\ndivergência entre o gerado e o que o JavaScript conta');
    const notPath = path.join(raiz, 'noticias.html');
    const notGerado = fs.readFileSync(notPath, 'utf8');
    fs.writeFileSync(notPath, notGerado.replace('data-itens="' + N + '"', 'data-itens="999"'));
    p = await testarNoticias(browser, srv.url, true, 1440);
    verificar('data-itens errado: o JavaScript volta a desenhar',
      p.cartoes === 9, 'cartões no DOM ' + p.cartoes + ' (9 = redesenhou, ' + N + ' = não mexeu)');
    verificar('data-itens errado: continua sem duplicações', p.visiveis === 9,
      'visíveis ' + p.visiveis);
    fs.writeFileSync(notPath, notGerado);
    p = await testarNoticias(browser, srv.url, true, 1440);
    verificar('reposto o data-itens: o JavaScript volta a não mexer',
      p.cartoes === N, 'cartões no DOM ' + p.cartoes);

    // ---- 7. Bloqueios do .htaccess ------------------------------
    console.log('\nproteções');
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
    for (const [caminho, esperado] of [
      ['/modelos/noticias-inicio.php', 403],
      ['/modelos/noticias-pagina.php', 403],
      ['/data/publicacao/anterior/index.html', 403],
      ['/data/publicacao/transacao.json', 403],
      ['/data/db.json', 403],
    ]) {
      const resp = await ctx.request.get(srv.url + caminho, { maxRedirects: 0 }).catch(() => null);
      const obtido = resp ? resp.status() : 0;
      verificar(caminho + ' responde ' + esperado, obtido === esperado, 'respondeu ' + obtido);
    }
    await ctx.close();

    // ---- 4. Estado sem notícias ---------------------------------
    console.log('\nestado sem notícias publicadas');
    const semNoticias = JSON.parse(JSON.stringify(dados));
    // Nem publicadas nem agendadas: senão a agendada devida continuaria a
    // aparecer na página de notícias, que também as mostra.
    semNoticias.noticias.forEach((n) => { n.publicada = false; delete n.scheduledAt; });
    semNoticias.publicadoEm = '2020-02-01T10:00:00.000Z';
    escreverDados(raiz, semNoticias);
    const g = gerar(raiz);
    verificar('geração corre sem erro', g.estado === 0, g.saida.trim());
    r = await testarPagina(browser, srv.url, false, 1440);
    verificar('nenhum cartão', r.cartoes === 0, 'obtive ' + r.cartoes);
    verificar('aparece a mensagem de lista vazia', r.vazio);
    verificar('o botão Ver todas está escondido', r.botao === 'escondido', r.botao);
    const pv = await testarNoticias(browser, srv.url, false, 1440);
    verificar('noticias.html sem notícias: nenhum cartão', pv.cartoes === 0, 'obtive ' + pv.cartoes);
    verificar('noticias.html sem notícias: aparece o estado vazio', pv.vazio);
    verificar('noticias.html sem notícias: sem cartão de destaque', pv.destaque === '', pv.destaque);
    verificar('noticias.html sem notícias: sem barra de filtros', !pv.filtros);
    verificar('noticias.html sem notícias: sem botão "Ver mais"', !pv.mais);
    verificar('noticias.html sem notícias: sem transbordo', pv.transbordo <= 0, '+' + pv.transbordo + 'px');

    verificar('nenhum texto de teste na página', !(await (async () => {
      const ctx2 = await browser.newContext({ javaScriptEnabled: false });
      const pg2 = await ctx2.newPage();
      await pg2.goto(srv.url + '/index.html', { waitUntil: 'load' });
      const html = await pg2.content();
      await ctx2.close();
      return html.includes('TESTE A');
    })()));
  } finally {
    await browser.close();
    limpar();
  }

  const falhas = resultados.filter((r) => !r.ok);
  console.log('\n' + '─'.repeat(64));
  console.log(`${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);
  if (falhas.length) {
    falhas.forEach((f) => console.log('  ✗ ' + f.nome + (f.detalhe ? ' — ' + f.detalhe : '')));
  }
  console.log('─'.repeat(64));
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
