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

const FIXTURE   = path.join(__dirname, 'teste', 'noticias-EXEMPLO-TESTE.json');
const MARCA_INI = '<!-- JSC:noticias:inicio -->';
const MARCA_FIM = '<!-- JSC:noticias:fim -->';

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
function foraDasMarcas(html) {
  const pi = html.indexOf(MARCA_INI);
  const pf = html.indexOf(MARCA_FIM);
  if (pi < 0 || pf < 0) return null;
  return html.slice(0, pi + MARCA_INI.length) + '\u0000' + html.slice(pf);
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
  const db  = path.join(raiz, 'data', 'db.json');

  // ---- 1. Geração com a fixture ----------------------------------
  const antesHtml = fs.readFileSync(idx, 'utf8');
  const antesFora = foraDasMarcas(antesHtml);
  verificar('index.html tem as duas marcas', antesFora !== null);

  escreverDados(raiz, dados);
  let g = gerar(raiz);
  verificar('geração corre sem erro', g.estado === 0, g.saida.trim());

  const depoisHtml = fs.readFileSync(idx, 'utf8');
  const depoisFora = foraDasMarcas(depoisHtml);

  // ---- 9. Comparação byte a byte do HTML exterior às marcas -------
  verificar('HTML fora das marcas igual byte a byte',
    antesFora !== null && depoisFora !== null && sha(antesFora) === sha(depoisFora),
    'sha256 antes ' + (antesFora && sha(antesFora).slice(0, 16)) +
    ' / depois ' + (depoisFora && sha(depoisFora).slice(0, 16)));

  verificar('o bloco gerado mudou de facto', antesHtml !== depoisHtml);
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

  // ---- 8a. Corrupção: o modelo rebenta ---------------------------
  const modelo = path.join(raiz, 'modelos', 'noticias-inicio.php');
  const modeloBom = fs.readFileSync(modelo, 'utf8');
  const htmlBom   = fs.readFileSync(idx, 'utf8');
  const dbBom     = fs.readFileSync(db, 'utf8');

  fs.writeFileSync(modelo, modeloBom + "\n<?php throw new RuntimeException('corrupção de teste'); ?>\n");
  g = gerar(raiz);
  verificar('modelo que rebenta: a geração falha', g.estado !== 0, g.saida.trim().slice(0, 200));
  verificar('modelo que rebenta: index.html intacto byte a byte',
    fs.readFileSync(idx, 'utf8') === htmlBom);
  verificar('modelo que rebenta: data/db.json intacto byte a byte',
    fs.readFileSync(db, 'utf8') === dbBom);

  // ---- 8b. Corrupção: HTML desequilibrado ------------------------
  fs.writeFileSync(modelo, modeloBom.replace('      </div>\n', '      <div>\n'));
  g = gerar(raiz);
  verificar('HTML desequilibrado: a validação recusa', g.estado !== 0, g.saida.trim().slice(0, 200));
  verificar('HTML desequilibrado: index.html intacto byte a byte',
    fs.readFileSync(idx, 'utf8') === htmlBom);

  fs.writeFileSync(modelo, modeloBom);

  // ---- 8c. Corrupção: marca em falta no HTML ---------------------
  fs.writeFileSync(idx, htmlBom.replace(MARCA_FIM, '<!-- marca apagada de propósito -->'));
  g = gerar(raiz);
  verificar('marca em falta: a geração aborta', g.estado !== 0, g.saida.trim().slice(0, 200));
  fs.writeFileSync(idx, htmlBom);

  // ---- 8d. Transação interrompida: o diário repara ---------------
  // Simula o que ficaria em disco se o processo morresse a meio da
  // promoção: um backup da versão anterior e um diário sem fechar.
  const ant = path.join(raiz, 'data', 'publicacao', 'anterior');
  fs.mkdirSync(ant, { recursive: true });
  const versaoAnterior = htmlBom.replace(
    /<!-- JSC:noticias:inicio -->[\s\S]*<!-- JSC:noticias:fim -->/,
    MARCA_INI + '\n      <div class="news__grid" id="newsGrid" data-gerado="1999-01-01T00:00:00.000Z"></div>\n      ' + MARCA_FIM);
  fs.writeFileSync(path.join(ant, 'index.html'), versaoAnterior);
  fs.writeFileSync(path.join(raiz, 'data', 'publicacao', 'transacao.json'),
    JSON.stringify({ iniciada: '2020-01-01T00:00:00+00:00', por: 'teste',
                     ficheiros: [{ destino: 'index.html' }] }));
  fs.writeFileSync(idx, htmlBom.replace('</body>', '<!-- estado a meio --></body>'));
  g = gerar(raiz);
  verificar('diário pendente: a publicação seguinte restaura e avisa',
    g.estado === 0 && /não tinha terminado/.test(g.saida), g.saida.trim().slice(0, 200));
  verificar('diário pendente: o diário foi fechado',
    !fs.existsSync(path.join(raiz, 'data', 'publicacao', 'transacao.json')));

  // ---- Deixar a cópia no estado bom, com a fixture gerada --------
  fs.writeFileSync(idx, htmlBom);
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
    verificar('o botão Ver todas está visível (4 publicadas, 3 mostradas)',
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

    // ---- 7. Bloqueios do .htaccess ------------------------------
    console.log('\nproteções');
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
    for (const [caminho, esperado] of [
      ['/modelos/noticias-inicio.php', 403],
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
    semNoticias.noticias.forEach((n) => { n.publicada = false; });
    semNoticias.publicadoEm = '2020-02-01T10:00:00.000Z';
    escreverDados(raiz, semNoticias);
    const g = gerar(raiz);
    verificar('geração corre sem erro', g.estado === 0, g.saida.trim());
    r = await testarPagina(browser, srv.url, false, 1440);
    verificar('nenhum cartão', r.cartoes === 0, 'obtive ' + r.cartoes);
    verificar('aparece a mensagem de lista vazia', r.vazio);
    verificar('o botão Ver todas está escondido', r.botao === 'escondido', r.botao);
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
