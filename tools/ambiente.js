'use strict';

// =====================================================================
// AMBIENTE DE TESTE — Juventude Sport Campinense
// =====================================================================
// Arranca o site num servidor local a sério e encontra o Chromium. Está
// aqui, fora do validar.js, porque há mais do que um teste a precisar do
// mesmo ambiente: o validar.js corre o site do projeto, e o
// testar-sem-js.js corre uma cópia à parte, noutra porta, com dados de
// teste que nunca entram no projeto.
//
// Preferência: Apache com o .htaccess real do projeto (é o que o alojamento
// usa, e é o único modo em que as regras de bloqueio existem), com os .php a
// passarem por um `php -S` por trás. Sem Apache, usa-se só o `php -S`.
// =====================================================================

const { spawn, spawnSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const net  = require('net');
const path = require('path');

const RAIZ_PROJETO = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------
// Playwright
// ---------------------------------------------------------------------
function carregarPlaywright() {
  const tentativas = [
    'playwright',
    path.join(__dirname, 'node_modules', 'playwright'),
    path.join(RAIZ_PROJETO, 'node_modules', 'playwright'),
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
//   raiz       pasta a servir (por omissão, o projeto)
//   portaHttp  porta do Apache (ou do php -S, quando não há Apache)
//   portaPhp   porta do php -S por trás do Apache
async function arrancarServidor(opcoes = {}) {
  const raiz      = opcoes.raiz      || RAIZ_PROJETO;
  const portaHttp = opcoes.portaHttp || 8099;
  const portaPhp  = opcoes.portaPhp  || 8098;

  // Uma porta já ocupada é o engano mais perigoso deste guião: o servidor
  // novo não consegue ficar com a porta, mas o teste falava com o que já lá
  // estava — de outra corrida, a servir outra pasta — e o resultado não
  // dizia nada sobre o que se queria medir. Por isso para aqui.
  for (const [porta, quem] of [[portaHttp, 'HTTP'], [portaPhp, 'PHP']]) {
    if (await portaAberta(porta)) {
      console.error(`A porta ${porta} (${quem}) já está ocupada — provavelmente por um servidor `
        + 'de um teste anterior que não fechou.\n'
        + `Feche-o primeiro:  fuser -k ${porta}/tcp   (ou   pkill -f "apache2 -f /tmp/jsc-")`);
      process.exit(2);
    }
  }

  const avisos  = [];
  const filhos  = [];
  const tmp     = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-validar-'));
  const parar   = () => {
    // Fechar isto bem é mais delicado do que parece:
    //
    //  • o Apache sai do grupo de processos que lhe demos, por isso matar
    //    só o grupo (-pid) deixava-o a correr e a segurar a porta;
    //  • e um SIGKILL ao processo principal deixa os seus processos filhos
    //    órfãos, ainda à escuta na porta. Com SIGTERM é ele que os fecha.
    //
    // Daí a ordem: SIGTERM a todos, meio segundo para fecharem, e só depois
    // SIGKILL ao que ainda restar.
    const alvos = [];
    const pidFile = path.join(tmp, 'apache.pid');
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      if (pid > 0) alvos.push(pid);
    }
    for (const f of filhos) alvos.push(f.pid, -f.pid);

    for (const a of alvos) { try { process.kill(a, 'SIGTERM'); } catch (_) {} }
    spawnSync('sleep', ['0.5']);
    for (const a of alvos) { try { process.kill(a, 'SIGKILL'); } catch (_) {} }

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
      const php = spawn('php', ['-S', `127.0.0.1:${portaPhp}`, '-t', raiz],
        { detached: true, stdio: 'ignore' });
      filhos.push(php);
      if (await esperarPorta(portaPhp, 10)) {
        proxyPhp = `ProxyPassMatch ^/(.*\\.php)$ http://127.0.0.1:${portaPhp}/$1\n  ProxyPreserveHost On`;
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
Listen ${portaHttp}
DirectoryIndex index.html index.php
DocumentRoot "${raiz}"
<Directory "${raiz}">
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

    if (await esperarPorta(portaHttp, 15)) {
      return { url: `http://127.0.0.1:${portaHttp}`, modo: 'apache', avisos, parar };
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
    const php = spawn('php', ['-S', `127.0.0.1:${portaHttp}`, '-t', raiz],
      { detached: true, stdio: 'ignore' });
    filhos.push(php);
    if (await esperarPorta(portaHttp, 10)) {
      return { url: `http://127.0.0.1:${portaHttp}`, modo: 'php', avisos, parar };
    }
  }

  parar();
  console.error('Não foi possível arrancar nenhum servidor local (Apache ou PHP).');
  process.exit(2);
}

module.exports = {
  RAIZ_PROJETO,
  carregarPlaywright,
  caminhoChromium,
  arrancarServidor,
  existe,
  esperarPorta,
};
