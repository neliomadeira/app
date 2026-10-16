#!/usr/bin/env node
// =====================================================================
// COMPARAR O .htaccess DO SERVIDOR COM O DO REPOSITÓRIO
// =====================================================================
// O .htaccess da raiz é o único ficheiro do projeto que tem duas donas: as
// regras de segurança e de reescrita são nossas, e os dois blocos do fim —
// as directivas php ini e o handler do PHP — são escritos pelo cPanel e
// reescritos por ele sempre que se mexe na versão de PHP ou nos limites.
//
// Medido uma vez à mão: o ficheiro do servidor tinha 112 directivas
// efectivas e o do repositório 81. As 31 em falta eram exactamente os dois
// blocos do cPanel, e sem eles um envio por cima do que está no ar apagava o
// handler do PHP 8.3 e derrubava todo o PHP do site. Esta ferramenta existe
// para essa verificação deixar de depender de alguém se lembrar de a fazer.
//
// SÓ LÊ. Não escreve, não renomeia, não apaga, não toca no servidor e não
// altera nenhum dos dois ficheiros. O que faz é ler dois ficheiros e
// imprimir o que difere.
//
// USO
//   1. Descarregue o .htaccess da raiz pelo gestor de ficheiros do cPanel.
//   2. node tools/comparar-htaccess.js <ficheiro-descarregado>
//
// Código de saída: 0 quando não há divergências, 1 quando há, 2 quando não
// foi possível ler um dos ficheiros. Serve para encadear com outro comando.
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DO_REPOSITORIO = path.join(RAIZ, '.htaccess');

// As regras que não podem desaparecer de nenhum dos lados. Não é a lista de
// tudo o que o ficheiro tem — é a lista do que, faltando, deixa o site
// desprotegido. Cada uma tem o seu porquê ao lado.
const REGRAS_DE_SEGURANCA = [
  { nome: 'executáveis bloqueados em uploads/',
    teste: /RewriteRule\s+\^uploads\/\.\*\\\.\(php\|phtml/ },
  { nome: 'só imagens servidas em uploads/logos/',
    teste: /RewriteRule\s+\^uploads\/logos\/\.\+\s+-\s+\[F,L\]/ },
  { nome: 'ficheiros sensíveis negados (.env .json .log .sql .bak .sh .bat .md)',
    teste: /<FilesMatch\s+"\\\.\(env\|json\|log\|sql\|bak\|sh\|bat\|md\)\$">/ },
  { nome: 'manifest.json com excepção explícita',
    teste: /<Files\s+"manifest\.json">/ },
  { nome: 'pasta scraper/ negada',
    teste: /RedirectMatch\s+403\s+\^\/scraper/ },
  { nome: 'Content-Security-Policy',
    teste: /Header\s+always\s+set\s+Content-Security-Policy/ },
  { nome: 'X-Content-Type-Options: nosniff',
    teste: /Header\s+always\s+set\s+X-Content-Type-Options/ },
  { nome: 'X-Frame-Options',
    teste: /Header\s+always\s+set\s+X-Frame-Options/ },
  { nome: 'noindex fora do domínio oficial',
    teste: /X-Robots-Tag/ },
  { nome: 'listagem de directórios desligada',
    teste: /^\s*Options\s+-Indexes/m },
  { nome: 'www -> domínio único',
    teste: /RewriteCond\s+%\{HTTP_HOST\}\s+\^www\\\./ },
  { nome: 'http -> https',
    teste: /RewriteCond\s+%\{HTTPS\}\s+!=on/ },
];

const BLOCOS_CPANEL = [
  { nome: 'directivas php ini',
    inicio: '# BEGIN cPanel-generated php ini directives, do not edit',
    fim:    '# END cPanel-generated php ini directives, do not edit' },
  { nome: 'handler do PHP',
    inicio: '# php -- BEGIN cPanel-generated handler, do not edit',
    fim:    '# php -- END cPanel-generated handler, do not edit' },
];

// As directivas efectivas: sem comentários, sem linhas em branco, sem a
// indentação. É assim que se compara o que o Apache lê, e não a forma como
// está escrito — a indentação das regras dos uploads difere entre os dois
// ficheiros sem que isso mude coisa nenhuma.
function directivas(texto) {
  return texto.split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && l.charAt(0) !== '#');
}

function contar(lista) {
  const m = new Map();
  lista.forEach((l) => m.set(l, (m.get(l) || 0) + 1));
  return m;
}

// Diferença que respeita repetições: as doze php_value aparecem duas vezes
// cada, uma por IfModule, e perder uma delas tem de aparecer aqui.
function soEmA(a, b) {
  const cb = contar(b), fora = [];
  contar(a).forEach((n, linha) => {
    const faltam = n - (cb.get(linha) || 0);
    for (let i = 0; i < faltam; i++) fora.push(linha);
  });
  return fora;
}

function extrairBloco(texto, bloco) {
  const i = texto.indexOf(bloco.inicio);
  if (i === -1) return null;
  const j = texto.indexOf(bloco.fim, i);
  if (j === -1) return null;
  return texto.slice(i, j + bloco.fim.length);
}

function versaoPhp(texto) {
  const m = texto.match(/AddHandler\s+application\/x-httpd-(ea-php\d+)/);
  return m ? m[1] : null;
}

function comparar(textoServidor, textoRepositorio) {
  const achados = [];
  const nota = (nivel, assunto, detalhe) => achados.push({ nivel, assunto, detalhe });

  // ---- 1. Blocos do cPanel -----------------------------------------
  BLOCOS_CPANEL.forEach((bloco) => {
    const noServidor = extrairBloco(textoServidor, bloco);
    const noRepositorio = extrairBloco(textoRepositorio, bloco);
    if (noServidor === null && noRepositorio === null) {
      nota('ERRO', 'bloco cPanel: ' + bloco.nome, 'ausente nos DOIS ficheiros');
    } else if (noRepositorio === null) {
      nota('ERRO', 'bloco cPanel: ' + bloco.nome,
        'existe no servidor e FALTA no repositório — enviar o ficheiro do '
        + 'repositório apagaria este bloco');
    } else if (noServidor === null) {
      nota('AVISO', 'bloco cPanel: ' + bloco.nome,
        'existe no repositório e não no servidor — o cPanel pode tê-lo removido');
    } else if (noServidor !== noRepositorio) {
      nota('ERRO', 'bloco cPanel: ' + bloco.nome,
        'existe nos dois mas com conteúdo DIFERENTE: o do repositório está '
        + 'desactualizado e um envio reverteria a alteração feita no cPanel');
    } else {
      nota('OK', 'bloco cPanel: ' + bloco.nome, 'igual byte a byte');
    }
  });

  // ---- 2. Versão de PHP --------------------------------------------
  const vS = versaoPhp(textoServidor), vR = versaoPhp(textoRepositorio);
  if (vS && vR && vS === vR)      nota('OK', 'versão de PHP', vS + ' nos dois');
  else if (vS && vR)              nota('ERRO', 'versão de PHP',
    'servidor ' + vS + ', repositório ' + vR + ' — um envio mudaria a versão de PHP do site');
  else if (vS && !vR)             nota('ERRO', 'versão de PHP',
    'servidor ' + vS + ', repositório sem AddHandler nenhum');
  else if (!vS && vR)             nota('AVISO', 'versão de PHP',
    'repositório ' + vR + ', servidor sem AddHandler — confirmar no MultiPHP Manager');
  else                            nota('AVISO', 'versão de PHP',
    'nenhum dos ficheiros declara AddHandler: o PHP pode vir por PHP-FPM');

  // ---- 3. Regras de segurança --------------------------------------
  REGRAS_DE_SEGURANCA.forEach((r) => {
    const s = r.teste.test(textoServidor), p = r.teste.test(textoRepositorio);
    if (s && p)       nota('OK', 'regra: ' + r.nome, 'presente nos dois');
    else if (!s && p) nota('ERRO', 'regra: ' + r.nome,
      'FALTA NO SERVIDOR — o site está sem esta protecção neste momento');
    else if (s && !p) nota('ERRO', 'regra: ' + r.nome,
      'falta no repositório — um envio removeria esta protecção do servidor');
    else              nota('ERRO', 'regra: ' + r.nome, 'ausente nos DOIS ficheiros');
  });

  // ---- 4. Directivas, uma a uma ------------------------------------
  const dS = directivas(textoServidor), dR = directivas(textoRepositorio);
  const soServidor = soEmA(dS, dR), soRepositorio = soEmA(dR, dS);
  if (!soServidor.length && !soRepositorio.length) {
    nota('OK', 'directivas efectivas', dS.length + ' de cada lado, sem divergências');
  } else {
    if (soServidor.length) nota('ERRO', 'directivas só no servidor',
      soServidor.length + ': ' + soServidor.join(' | '));
    if (soRepositorio.length) nota('ERRO', 'directivas só no repositório',
      soRepositorio.length + ': ' + soRepositorio.join(' | '));
  }

  return achados;
}

function principal(argv) {
  const alvo = argv[2];
  if (!alvo || alvo === '--ajuda' || alvo === '-h') {
    console.log('Uso: node tools/comparar-htaccess.js <.htaccess-descarregado-do-servidor>');
    console.log('');
    console.log('Descarregue o .htaccess da raiz pelo gestor de ficheiros do cPanel e');
    console.log('passe aqui o caminho. A ferramenta só lê: não altera nenhum ficheiro,');
    console.log('não toca no servidor e não faz deploy.');
    return 2;
  }
  let textoServidor, textoRepositorio;
  try {
    textoServidor = fs.readFileSync(alvo, 'utf8');
  } catch (e) {
    console.error('Não foi possível ler o ficheiro do servidor: ' + e.message);
    return 2;
  }
  try {
    textoRepositorio = fs.readFileSync(DO_REPOSITORIO, 'utf8');
  } catch (e) {
    console.error('Não foi possível ler o .htaccess do repositório: ' + e.message);
    return 2;
  }

  const achados = comparar(textoServidor, textoRepositorio);
  const erros  = achados.filter((a) => a.nivel === 'ERRO');
  const avisos = achados.filter((a) => a.nivel === 'AVISO');

  console.log('=== .htaccess: servidor vs repositório ===');
  console.log('servidor ....: ' + alvo);
  console.log('repositório .: ' + DO_REPOSITORIO);
  console.log('');
  achados.forEach((a) => {
    console.log(a.nivel.padEnd(6) + a.assunto + ' — ' + a.detalhe);
  });
  console.log('');
  if (!erros.length && !avisos.length) {
    console.log('SEM DIVERGÊNCIAS: os dois ficheiros dizem o mesmo ao Apache.');
    console.log('O do repositório pode ser enviado sem perder configuração do alojamento.');
  } else {
    console.log(erros.length + ' divergência(s) e ' + avisos.length + ' aviso(s).');
    if (erros.length) {
      console.log('');
      console.log('NÃO ENVIAR o .htaccess do repositório enquanto houver divergências:');
      console.log('actualize-o a partir do ficheiro do servidor e volte a comparar.');
    }
  }
  return erros.length ? 1 : 0;
}

if (require.main === module) process.exit(principal(process.argv));
module.exports = { comparar, directivas, versaoPhp, extrairBloco,
  REGRAS_DE_SEGURANCA, BLOCOS_CPANEL };
