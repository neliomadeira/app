#!/usr/bin/env node
'use strict';

// =====================================================================
// VALIDAR — Juventude Sport Campinense
// =====================================================================
// Este projeto não tem build, lint, testes nem TypeScript, por isso as
// verificações habituais não se aplicam. Este guião faz o equivalente:
// levanta o site num Apache local com o .htaccess real, abre todas as
// páginas num browser a sério, nas larguras que o site tem de suportar,
// e falha se encontrar erro de JavaScript, recurso em falta, resposta
// HTTP errada ou scroll horizontal.
//
// Uso:
//   node tools/validar.js                    tudo
//   node tools/validar.js --pagina index.html
//   node tools/validar.js --largura 320
//   node tools/validar.js --gravar-base      grava tools/estado-inicial.json
//   node tools/validar.js --comparar         compara com o estado gravado
//   node tools/validar.js --json             saída em JSON
//
// Código de saída: 0 sem problemas, 1 com problemas.
// =====================================================================

const { spawn, spawnSync } = require('child_process');
const fs   = require('fs');
const net  = require('net');
const os   = require('os');
const path = require('path');

const RAIZ       = path.resolve(__dirname, '..');
const BASE_FICH  = path.join(__dirname, 'estado-inicial.json');
const PORTA_HTTP = 8099;   // Apache
const PORTA_PHP  = 8098;   // php -S por trás, só para os .php
const LARGURAS   = [320, 375, 390, 430, 768, 1024, 1440];

// Páginas com parâmetros, que não se descobrem só pela lista de ficheiros.
const ROTAS_EXTRA = [
  'escalao.html?escalao=Sub-13',
  'modalidade.html?id=1',
  'noticias.html?id=1',
];

// Respostas que o .htaccess tem de garantir. Verificadas uma vez.
const ROTAS_HTTP = [
  { caminho: '/data/db.json',   esperado: 403, porque: 'o conteúdo publicado não pode ser lido diretamente' },
  { caminho: '/api/schema.sql', esperado: 403, porque: 'ficheiros .sql estão bloqueados' },
  { caminho: '/manifest.json',  esperado: 200, porque: 'o manifest tem de ficar público ou o service worker não instala' },
  { caminho: '/api/load.php',   esperado: 200, porque: 'as páginas leem daqui o conteúdo publicado' },
  { caminho: '/images/',        esperado: [403, 404], porque: 'a listagem de diretórios não pode ser exposta' },
  { caminho: '/nao-existe-xyz', esperado: 404, porque: 'um endereço inexistente não pode devolver 200' },
];

// Erros de consola conhecidos e inofensivos no ambiente local.
const RUIDO = [
  /favicon\.ico/i,
  /ERR_INTERNET_DISCONNECTED/i,
  /net::ERR_(FAILED|BLOCKED_BY_CLIENT|NAME_NOT_RESOLVED|CERT_AUTHORITY_INVALID)/i,  // recursos externos cortados por nós
];

const args     = process.argv.slice(2);
const opcao    = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const temOpcao = (n) => args.includes(n);
const SO_JSON  = temOpcao('--json');

const log = (...m) => { if (!SO_JSON) console.log(...m); };

// ---------------------------------------------------------------------
// Playwright
// ---------------------------------------------------------------------
function carregarPlaywright() {
  const tentativas = [
    'playwright',
    path.join(__dirname, 'node_modules', 'playwright'),
    path.join(RAIZ, 'node_modules', 'playwright'),
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
  ];
  for (const t of tentativas) {
    try { return require(t); } catch (_) { /* segue */ }
  }
  console.error(
    'Playwright não encontrado.\n' +
    'Instale-o dentro de tools/:\n\n' +
    '    cd tools && npm install\n'
  );
  process.exit(2);
}

function caminhoChromium(playwright) {
  // Em alguns ambientes o browser está fora do sítio onde o Playwright o
  // procura. Se o executável por omissão não existir, tenta os conhecidos.
  try {
    const p = playwright.chromium.executablePath();
    if (fs.existsSync(p)) return undefined;   // undefined = usa o por omissão
  } catch (_) { /* segue */ }
  const alternativas = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ];
  for (const a of alternativas) if (fs.existsSync(a)) return a;
  return undefined;
}

// ---------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------
function existe(cmd) {
  return spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function portaAberta(porta) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: porta });
    const fim = (ok) => { s.destroy(); resolve(ok); };
    s.once('connect', () => fim(true));
    s.once('error',   () => fim(false));
    s.setTimeout(700, () => fim(false));
  });
}

async function esperarPorta(porta, segundos = 15) {
  const fim = Date.now() + segundos * 1000;
  while (Date.now() < fim) {
    if (await portaAberta(porta)) return true;
    await dormir(250);
  }
  return false;
}

function modulosApache() {
  const dirs = ['/usr/lib/apache2/modules', '/usr/libexec/apache2', '/usr/lib64/httpd/modules'];
  const dir  = dirs.find((d) => fs.existsSync(d));
  if (!dir) return null;
  // Nome do módulo → ficheiro. Só se carrega o que existir.
  const querer = {
    mpm_event: 'mod_mpm_event.so', unixd: 'mod_unixd.so', authz_core: 'mod_authz_core.so',
    authz_host: 'mod_authz_host.so', log_config: 'mod_log_config.so', mime: 'mod_mime.so',
    access_compat: 'mod_access_compat.so', autoindex: 'mod_autoindex.so',
    dir: 'mod_dir.so', alias: 'mod_alias.so', filter: 'mod_filter.so',
    headers: 'mod_headers.so', setenvif: 'mod_setenvif.so', rewrite: 'mod_rewrite.so',
    deflate: 'mod_deflate.so', expires: 'mod_expires.so',
    proxy: 'mod_proxy.so', proxy_http: 'mod_proxy_http.so',
  };
  const linhas = [];
  for (const [nome, fich] of Object.entries(querer)) {
    if (fs.existsSync(path.join(dir, fich))) {
      linhas.push(`LoadModule ${nome}_module ${path.join(dir, fich)}`);
    }
  }
  return { dir, linhas, temProxy: linhas.some((l) => l.includes('mod_proxy_http.so')) };
}

// Arranca o servidor. Devolve { url, modo, avisos, parar() }.
async function arrancarServidor() {
  const avisos  = [];
  const filhos  = [];
  const tmp     = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-validar-'));
  const parar   = () => {
    for (const f of filhos) { try { process.kill(-f.pid, 'SIGTERM'); } catch (_) {} }
    if (process.env.JSC_DEBUG) { console.error('configuração do teste mantida em ' + tmp); return; }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  };

  const mods = existe('apache2') || existe('httpd') ? modulosApache() : null;
  const temPhp = existe('php');

  // --- Apache com o .htaccess real ---------------------------------
  if (mods && mods.linhas.length) {
    let proxyPhp = '';
    if (temPhp && mods.temProxy) {
      // O Apache aqui não traz módulo de PHP. Os .php vão por proxy para
      // um `php -S`, para os endpoints funcionarem a sério em vez de
      // serem servidos como texto.
      const php = spawn('php', ['-S', `127.0.0.1:${PORTA_PHP}`, '-t', RAIZ],
        { detached: true, stdio: 'ignore' });
      filhos.push(php);
      if (await esperarPorta(PORTA_PHP, 10)) {
        proxyPhp = `ProxyPassMatch ^/(.*\\.php)$ http://127.0.0.1:${PORTA_PHP}/$1\n  ProxyPreserveHost On`;
      } else {
        avisos.push('php -S não arrancou: os endpoints .php não são executados.');
      }
    } else if (!temPhp) {
      avisos.push('PHP não está instalado: os endpoints .php não são executados.');
    }

    const conf = path.join(tmp, 'apache.conf');
    // JSC_DEBUG=1 mantém a configuração gerada, para diagnóstico.
    fs.writeFileSync(conf, `
ServerName localhost
ServerRoot ${tmp}
PidFile ${tmp}/apache.pid
ErrorLog ${tmp}/erro.log
${process.getuid && process.getuid() === 0 ? 'User www-data\nGroup www-data' : ''}
${mods.linhas.join('\n')}
TypesConfig ${fs.existsSync('/etc/mime.types') ? '/etc/mime.types' : path.join(tmp, 'mime.types')}
Listen ${PORTA_HTTP}
DirectoryIndex index.html index.php
DocumentRoot "${RAIZ}"
<Directory "${RAIZ}">
  AllowOverride All
  Require all granted
</Directory>
# O .htaccess força https. Aqui o pedido é local, por isso diz-se-lhe que já vem seguro.
# Tem de ser no servidor: os pedidos do service worker não levam cabeçalhos do contexto.
<IfModule mod_headers.c>
  RequestHeader set X-Forwarded-Proto "https" early
</IfModule>
${proxyPhp}
`.trim() + '\n');
    if (!fs.existsSync('/etc/mime.types')) fs.writeFileSync(path.join(tmp, 'mime.types'), 'text/html html\ntext/css css\napplication/javascript js\n');

    const bin = existe('apache2') ? 'apache2' : 'httpd';
    const ap  = spawn(bin, ['-f', conf, '-D', 'FOREGROUND'], { detached: true, stdio: 'ignore' });
    filhos.push(ap);

    if (await esperarPorta(PORTA_HTTP, 15)) {
      return { url: `http://127.0.0.1:${PORTA_HTTP}`, modo: 'apache', avisos, parar };
    }
    const erro = fs.existsSync(path.join(tmp, 'erro.log'))
      ? fs.readFileSync(path.join(tmp, 'erro.log'), 'utf8').trim().split('\n').slice(-3).join('\n') : '';
    avisos.push('Apache não arrancou' + (erro ? ': ' + erro : '') + '. A usar php -S, sem as regras do .htaccess.');
    for (const f of filhos) { try { process.kill(-f.pid, 'SIGTERM'); } catch (_) {} }
    filhos.length = 0;
  } else {
    avisos.push('Apache não está instalado. A usar php -S, sem as regras do .htaccess.');
  }

  // --- Alternativa: php -S -----------------------------------------
  if (temPhp) {
    const php = spawn('php', ['-S', `127.0.0.1:${PORTA_HTTP}`, '-t', RAIZ],
      { detached: true, stdio: 'ignore' });
    filhos.push(php);
    if (await esperarPorta(PORTA_HTTP, 10)) {
      return { url: `http://127.0.0.1:${PORTA_HTTP}`, modo: 'php', avisos, parar };
    }
  }

  parar();
  console.error('Não foi possível arrancar nenhum servidor local (Apache ou PHP).');
  process.exit(2);
}

// ---------------------------------------------------------------------
// Páginas a testar
// ---------------------------------------------------------------------
function descobrirPaginas() {
  const publicas = fs.readdirSync(RAIZ)
    .filter((f) => f.endsWith('.html'))
    .sort();
  return [...publicas, ...ROTAS_EXTRA, 'admin/index.html'];
}

// ---------------------------------------------------------------------
// Verificação
// ---------------------------------------------------------------------
async function verificarRotas(ctx, url, modo) {
  const problemas = [];
  for (const r of ROTAS_HTTP) {
    // Em php -S o .htaccess não é lido: estas regras não existem.
    if (modo !== 'apache' && String(r.esperado).includes('403')) continue;
    const resp = await ctx.request.get(url + r.caminho, { maxRedirects: 0 }).catch(() => null);
    const obtido = resp ? resp.status() : 0;
    const aceites = Array.isArray(r.esperado) ? r.esperado : [r.esperado];
    if (!aceites.includes(obtido)) {
      problemas.push({
        tipo: 'rota', pagina: r.caminho, largura: null,
        detalhe: `devolveu ${obtido || 'sem resposta'}, esperado ${aceites.join(' ou ')} — ${r.porque}`,
      });
    }
  }
  return problemas;
}

async function verificarPagina(ctx, url, pagina, largura) {
  const problemas = [];
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: largura, height: 900 });

  const erros = [];
  const falhas = [];
  const externos = [];

  // Tudo o que não é do servidor local fica de fora: tipos de letra, mapas,
  // vídeos. Não são do site, e sem rede o resultado deixaria de ser igual.
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    externos.push(alvo.replace(/^(https?:\/\/[^/]+).*$/, '$1'));
    return rota.abort();
  });
  pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  pg.on('response', (r) => {
    if (r.status() >= 400) falhas.push(`${r.status()} ${r.url().replace(url, '')}`);
  });

  let resp = null;
  try {
    resp = await pg.goto(url + '/' + pagina, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) {
    problemas.push({ tipo: 'carregamento', pagina, largura, detalhe: 'não carregou: ' + e.message.split('\n')[0] });
    await pg.close();
    return problemas;
  }

  if (!resp || resp.status() !== 200) {
    problemas.push({ tipo: 'http', pagina, largura, detalhe: `resposta ${resp ? resp.status() : 'nenhuma'}` });
  }

  // A página tem de ter conteúdo visível.
  const vazia = await pg.evaluate(() => !document.body || document.body.innerText.trim().length < 20);
  if (vazia) problemas.push({ tipo: 'vazia', pagina, largura, detalhe: 'sem texto visível no body' });

  // Overflow horizontal, com o elemento responsável.
  const ov = await pg.evaluate(() => {
    const d = document.documentElement;
    const transbordo = d.scrollWidth - d.clientWidth;
    if (transbordo <= 0) return { transbordo: 0, culpados: [] };
    const culpados = [];
    document.querySelectorAll('*').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.right > d.clientWidth + 1) {
        const cls = typeof el.className === 'string' && el.className
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        culpados.push(el.tagName.toLowerCase() + cls + ' (+' + Math.round(b.right - d.clientWidth) + 'px)');
      }
    });
    return { transbordo, culpados: [...new Set(culpados)].slice(0, 3) };
  });
  if (ov.transbordo > 0) {
    problemas.push({
      tipo: 'overflow', pagina, largura,
      detalhe: `+${ov.transbordo}px` + (ov.culpados.length ? ' — ' + ov.culpados.join(' | ') : ''),
    });
  }

  const errosReais = erros.filter((e) => !RUIDO.some((r) => r.test(e)));
  for (const e of [...new Set(errosReais)]) {
    problemas.push({ tipo: 'consola', pagina, largura, detalhe: e.slice(0, 160) });
  }

  const falhasReais = [...new Set(falhas)].filter((f) => !RUIDO.some((r) => r.test(f)));
  for (const f of falhasReais) {
    problemas.push({ tipo: 'recurso', pagina, largura, detalhe: f });
  }

  await pg.close();
  problemas.externos = [...new Set(externos)];
  return problemas;
}

// ---------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------
function resumir(problemas) {
  const porTipo = {};
  for (const p of problemas) porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1;
  return porTipo;
}

function assinatura(p) {
  return [p.tipo, p.pagina, p.largura, p.detalhe].join(' :: ');
}

// ---------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------
(async () => {
  const playwright = carregarPlaywright();
  const paginas = opcao('--pagina') ? [opcao('--pagina')] : descobrirPaginas();
  const larguras = opcao('--largura') ? [Number(opcao('--largura'))] : LARGURAS;

  const srv = await arrancarServidor();
  process.on('exit', srv.parar);
  process.on('SIGINT', () => { srv.parar(); process.exit(130); });

  log(`\nservidor: ${srv.modo}  ${srv.url}`);
  if (srv.modo === 'apache') log('          com o .htaccess real do projeto');
  srv.avisos.forEach((a) => log('  aviso:  ' + a));
  log(`páginas:  ${paginas.length}   larguras: ${larguras.join(', ')}   total: ${paginas.length * larguras.length} combinações\n`);

  const exe = caminhoChromium(playwright);
  const browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {});
  // O .htaccess força https; este cabeçalho diz-lhe que o pedido já vem seguro.
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });

  const problemas = [];
  problemas.push(...await verificarRotas(ctx, srv.url, srv.modo));

  for (const pagina of paginas) {
    const marcas = [];
    for (const largura of larguras) {
      const p = await verificarPagina(ctx, srv.url, pagina, largura);
      problemas.push(...p);
      marcas.push(p.length === 0 ? '·' : String(p.length));
    }
    log('  ' + pagina.padEnd(34) + marcas.map((m) => m.padStart(5)).join(''));
  }
  log('  ' + ' '.repeat(34) + larguras.map((l) => String(l).padStart(5)).join(''));

  await browser.close();
  srv.parar();

  const resultado = {
    commit: spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ, encoding: 'utf8' }).stdout.trim(),
    data: new Date().toISOString(),
    modo: srv.modo,
    paginas: paginas.length,
    larguras,
    combinacoes: paginas.length * larguras.length,
    total: problemas.length,
    porTipo: resumir(problemas),
    problemas,
  };

  if (SO_JSON) { console.log(JSON.stringify(resultado, null, 2)); }
  else {
    console.log('\n' + '─'.repeat(64));
    if (!problemas.length) {
      console.log('Sem problemas em ' + resultado.combinacoes + ' combinações.');
    } else {
      console.log(`${problemas.length} problema(s):`);
      for (const [t, n] of Object.entries(resultado.porTipo)) console.log(`  ${t}: ${n}`);
      console.log();
      for (const p of problemas) {
        console.log(`  [${p.tipo}] ${p.pagina}${p.largura ? ' @' + p.largura + 'px' : ''}\n      ${p.detalhe}`);
      }
    }
    console.log('─'.repeat(64));
  }

  if (temOpcao('--gravar-base')) {
    fs.writeFileSync(BASE_FICH, JSON.stringify(resultado, null, 2) + '\n');
    log('\nEstado gravado em tools/estado-inicial.json');
  }

  if (temOpcao('--comparar')) {
    if (!fs.existsSync(BASE_FICH)) {
      console.error('\nNão há estado gravado. Corra primeiro com --gravar-base.');
      process.exit(2);
    }
    const base = JSON.parse(fs.readFileSync(BASE_FICH, 'utf8'));
    const antes = new Set(base.problemas.map(assinatura));
    const agora = new Set(problemas.map(assinatura));
    const novos      = [...agora].filter((a) => !antes.has(a));
    const resolvidos = [...antes].filter((a) => !agora.has(a));
    console.log(`\nComparação com ${base.commit} (${base.data.slice(0, 10)}):`);
    console.log(`  resolvidos: ${resolvidos.length}`);
    resolvidos.forEach((r) => console.log('    - ' + r));
    console.log(`  novos:      ${novos.length}`);
    novos.forEach((n) => console.log('    + ' + n));
    if (novos.length) { console.log('\nRegressão: há problemas que não existiam antes.'); process.exit(1); }
  }

  process.exit(problemas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
