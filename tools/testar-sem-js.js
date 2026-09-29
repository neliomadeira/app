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
// Cada ficheiro pode ter mais do que uma região: a página inicial tem as
// notícias e a agenda. A ordem aqui é a ordem em que aparecem no ficheiro.
const BLOCOS = {
  'index.html': [
    { nome: 'agenda',   ini: '<!-- JSC:agenda:inicio -->',   fim: '<!-- JSC:agenda:fim -->' },
    { nome: 'noticias', ini: '<!-- JSC:noticias:inicio -->', fim: '<!-- JSC:noticias:fim -->' },
  ],
  'noticias.html': [
    { nome: 'noticias-pagina', ini: '<!-- JSC:noticias-pagina:inicio -->', fim: '<!-- JSC:noticias-pagina:fim -->' },
  ],
  'agenda.html': [
    { nome: 'agenda-pagina', ini: '<!-- JSC:agenda-pagina:inicio -->', fim: '<!-- JSC:agenda-pagina:fim -->' },
  ],
  'equipa-principal.html': [
    { nome: 'seniores-info',    ini: '<!-- JSC:seniores-info:inicio -->',    fim: '<!-- JSC:seniores-info:fim -->' },
    { nome: 'seniores-plantel', ini: '<!-- JSC:seniores-plantel:inicio -->', fim: '<!-- JSC:seniores-plantel:fim -->' },
    { nome: 'seniores-posts',   ini: '<!-- JSC:seniores-posts:inicio -->',   fim: '<!-- JSC:seniores-posts:fim -->' },
  ],
};

// Datas da agenda a partir dos offsets da fixture: 0 = hoje. Devolve uma
// cópia, com o _offsetDias fora — o site nunca vê esse campo.
function comDatas(dados) {
  const d = JSON.parse(JSON.stringify(dados));
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  (d.agenda || []).forEach((e) => {
    const dia = new Date(base.getTime() + (e._offsetDias || 0) * 86400000);
    e.data = dia.getFullYear() + '-'
      + String(dia.getMonth() + 1).padStart(2, '0') + '-'
      + String(dia.getDate()).padStart(2, '0');
    delete e._offsetDias;
  });
  return d;
}

const hojeISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
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
  let saida = '';
  let cursor = 0;
  for (const b of BLOCOS[ficheiro]) {
    const pi = html.indexOf(b.ini);
    const pf = html.indexOf(b.fim);
    if (pi < 0 || pf < 0 || pf < pi) return null;
    saida += html.slice(cursor, pi + b.ini.length) + '\u0000';
    cursor = pf;
  }
  return saida + html.slice(cursor);
}

// Só uma região, para contar o que lá está dentro sem apanhar o resto da
// página. Sem nome, devolve a primeira região do ficheiro.
function dentroDasMarcas(html, ficheiro, nome) {
  const b = nome ? BLOCOS[ficheiro].find((x) => x.nome === nome) : BLOCOS[ficheiro][0];
  if (!b) return '';
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
  const age = path.join(raiz, 'agenda.html');
  const eqp = path.join(raiz, 'equipa-principal.html');
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
  const antesAge = fs.readFileSync(age, 'utf8');
  const antesEqp = fs.readFileSync(eqp, 'utf8');
  verificar('index.html tem as marcas das DUAS regiões — agenda e notícias',
    foraDasMarcas(antesIdx, 'index.html') !== null
    && antesIdx.indexOf(BLOCOS['index.html'][0].ini) < antesIdx.indexOf(BLOCOS['index.html'][1].ini));
  verificar('noticias.html tem as duas marcas', foraDasMarcas(antesNot, 'noticias.html') !== null);
  verificar('agenda.html tem as duas marcas', foraDasMarcas(antesAge, 'agenda.html') !== null);
  verificar('equipa-principal.html tem as marcas das TRÊS regiões',
    foraDasMarcas(antesEqp, 'equipa-principal.html') !== null
    && BLOCOS['equipa-principal.html'].every((b) => antesEqp.includes(b.ini) && antesEqp.includes(b.fim)));

  // ---- Guarda da fonte única da barra de informação ----------------
  // Competição, temporada, treinos e local vêm só do db_seniores_info. Em
  // 7d38e40 saíram do HTML os valores que lá estavam escritos à mão, e esta
  // verificação existe para não voltarem: um valor aqui reapareceria em
  // qualquer visita anterior à primeira geração, e ficaria a mostrar o que o
  // painel já tinha mudado.
  //
  // Olha só para dentro da região seniores-info da equipa-principal.html, e
  // não pelo projeto: os mesmos textos existem legitimamente como placeholder
  // das caixas do painel, como dados iniciais do Admin e como conteúdo de
  // outras páginas.
  //
  // Também não procura textos concretos — procura a *forma* de um valor
  // publicado: o item, o sítio onde o valor é escrito (o id de cada campo,
  // a classe do valor) e qualquer texto visível. Assim apanha um fallback
  // novo, com um valor que hoje ainda não existe.
  {
    const base = dentroDasMarcas(antesEqp, 'equipa-principal.html', 'seniores-info')
      .replace(/<!--[\s\S]*?-->/g, '');          // comentários não são conteúdo
    const texto = base.replace(/<[^>]*>/g, '').trim();
    const idsDosCampos = ['seniorLiga', 'seniorTemporada', 'seniorTreinos', 'seniorEstadio']
      .filter((id) => base.includes(id));

    verificar('barra-base: a região no repositório é só a barra, vazia',
      /^\s*<div class="senior-info" id="seniorInfoBar"[^>]*><\/div>\s*$/.test(base),
      'obtive: ' + JSON.stringify(base.trim().slice(0, 160)));
    verificar('barra-base: a barra vazia está hidden',
      /<div class="senior-info" id="seniorInfoBar"[^>]*\shidden[\s>]/.test(base));
    verificar('barra-base: nenhum item escrito à mão',
      !base.includes('senior-info__item') && !base.includes('senior-info__val'),
      'a região não pode trazer itens: o bloco é escrito pela geração ou pelo js/main.js');
    verificar('barra-base: nenhum campo com valor fixo (competição, temporada, treinos, local)',
      idsDosCampos.length === 0,
      'campos escritos à mão na região: ' + idsDosCampos.join(', '));
    verificar('barra-base: nenhum texto visível antes da geração',
      texto === '', 'texto encontrado: ' + JSON.stringify(texto.slice(0, 160)));
  }

  escreverDados(raiz, dados);
  let g = gerar(raiz);
  verificar('geração corre sem erro', g.estado === 0, g.saida.trim());
  verificar('a geração escreveu as quatro páginas',
    /index\.html/.test(g.saida) && /noticias\.html/.test(g.saida) && /agenda\.html/.test(g.saida)
    && /equipa-principal\.html/.test(g.saida), g.saida.trim());

  const depoisHtml = fs.readFileSync(idx, 'utf8');
  const depoisNot  = fs.readFileSync(not, 'utf8');
  const depoisAge  = fs.readFileSync(age, 'utf8');
  const depoisEqp  = fs.readFileSync(eqp, 'utf8');

  // ---- 9 / E1-8. Comparação byte a byte do exterior a TODAS as marcas ----
  for (const [nome, antes, depois] of [
    ['index.html', antesIdx, depoisHtml],
    ['noticias.html', antesNot, depoisNot],
    ['agenda.html', antesAge, depoisAge],
    ['equipa-principal.html', antesEqp, depoisEqp],
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
    !dentroDasMarcas(depoisHtml, 'index.html', 'noticias').includes('TESTE P AGENDADA PASSADO'));
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
    (dentroDasMarcas(depoisHtml, 'index.html', 'noticias').match(/<article class="news-card/g) || []).length === 3);

  // ---- agenda: as duas listas ------------------------------------
  const futuros = dados.agenda.filter((e) => e.data >= hojeISO() && e.estado !== 'Cancelado');
  const naInicial = Math.min(6, futuros.length);
  const blocoAgI = dentroDasMarcas(depoisHtml, 'index.html', 'agenda');
  const blocoAgP = dentroDasMarcas(depoisAge, 'agenda.html');

  verificar(`agenda da página inicial: ${naInicial} cartões (máximo 6)`,
    (blocoAgI.match(/<div class="agenda-card">/g) || []).length === naInicial,
    'obtive ' + (blocoAgI.match(/<div class="agenda-card">/g) || []).length);
  verificar(`agenda.html: ${futuros.length} eventos (todos os futuros)`,
    (blocoAgP.match(/<div class="agenda-pub-item"/g) || []).length === futuros.length,
    'obtive ' + (blocoAgP.match(/<div class="agenda-pub-item"/g) || []).length);
  verificar('agenda: o evento de hoje aparece nas duas',
    blocoAgI.includes('TESTE EVENTO HOJE') && blocoAgP.includes('TESTE EVENTO HOJE'));
  verificar('agenda: os eventos passados não aparecem',
    !blocoAgI.includes('ONTEM') && !blocoAgP.includes('ONTEM')
    && !blocoAgI.includes('ANTEONTEM') && !blocoAgP.includes('ANTEONTEM'));
  verificar('agenda: o evento cancelado não aparece',
    !blocoAgI.includes('CANCELADO') && !blocoAgP.includes('CANCELADO'));
  verificar('agenda: mesma data mantém a ordem original (B antes de A)',
    blocoAgP.indexOf('TESTE EVENTO B MESMO DIA') < blocoAgP.indexOf('TESTE EVENTO A MESMO DIA'));
  const titulosGerados = (blocoAgP.match(/<p class="agenda-pub-title">([^<]*)<\/p>/g) || [])
    .map((m) => m.replace(/<[^>]+>/g, ''));
  const titulosEsperados = futuros
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.data < b.e.data ? -1 : a.e.data > b.e.data ? 1 : a.i - b.i))
    .map((x) => x.e.titulo);
  verificar('agenda: ordem por data ascendente, com a ordem original a desempatar',
    titulosGerados.join(' | ') === titulosEsperados.join(' | '),
    titulosGerados.join(' | '));
  verificar('agenda: data-desde é hoje nas duas regiões',
    blocoAgI.includes('data-desde="' + hojeISO() + '"')
    && blocoAgP.includes('data-desde="' + hojeISO() + '"'));
  verificar('agenda: data-itens igual ao número de eventos',
    blocoAgI.includes('data-itens="' + naInicial + '"')
    && blocoAgP.includes('data-itens="' + futuros.length + '"'));
  verificar('agenda: sem hora não há o ícone da hora',
    !/&#128337; *<\/span>/.test(blocoAgP) && !/&#128337; *&nbsp;/.test(blocoAgI));
  verificar('agenda: sem hora nem local não há linha de meta vazia',
    !/<p class="agenda-pub-meta">\s*<\/p>/.test(blocoAgP)
    && !/<p class="agenda-card__meta">\s*<\/p>/.test(blocoAgI));
  verificar('agenda: escalão "Todos" não produz linha',
    !blocoAgP.includes('&#127942; Todos') && !blocoAgI.includes('&#127942; Todos'));
  verificar('agenda: escalão real aparece',
    blocoAgP.includes('&#127942; Sub-15') && blocoAgI.includes('&#127942; Sub-15'));
  verificar('agenda: as cinco cores/classes por tipo',
    blocoAgI.includes('agenda-card__tipo--jogo') && blocoAgI.includes('agenda-card__tipo--torneio')
    && blocoAgI.includes('agenda-card__tipo--outro') && blocoAgI.includes('agenda-card__tipo--reuniao')
    && blocoAgP.includes('background:#22a75e') && blocoAgP.includes('background:#3b82f6'));
  verificar('agenda: um botão de calendário por evento, todos jsc-so-com-js',
    (blocoAgP.match(/class="agenda-ics-btn jsc-so-com-js"/g) || []).length === futuros.length);
  verificar('agenda: o data-ics traz o evento em JSON percent-encoded',
    blocoAgP.includes('data-ics="%7B%22titulo%22%3A%22TESTE%20EVENTO%20HOJE%22'));

  // ---- equipa principal: as três regiões --------------------------
  const infoEsperados = ['liga', 'temporada', 'treinos', 'estadio']
    .filter((k) => (dados.senioresInfo[k] || '').trim() !== '').length;
  const ativos = dados.seniores.filter((j) => j.ativo !== false);
  const porPos = (p) => ativos.filter((j) => j.posicao === p).length;
  const gruposEsperados = ['GR', 'DEF', 'MEI', 'AVA'].filter((p) => porPos(p) > 0);
  const postsSeniores = dados.noticias.filter((n) => n.publicada && n.categoria === 'Seniores');

  const bInfo = dentroDasMarcas(depoisEqp, 'equipa-principal.html', 'seniores-info');
  const bPlantel = dentroDasMarcas(depoisEqp, 'equipa-principal.html', 'seniores-plantel');
  const bPosts = dentroDasMarcas(depoisEqp, 'equipa-principal.html', 'seniores-posts');

  verificar(`barra de informação: ${infoEsperados} campos (o vazio não produz item)`,
    (bInfo.match(/<div class="senior-info__item">/g) || []).length === infoEsperados,
    'obtive ' + (bInfo.match(/<div class="senior-info__item">/g) || []).length);
  verificar('barra: os campos preenchidos aparecem com o valor do painel',
    bInfo.includes('TESTE COMPETICAO') && bInfo.includes('TESTE EPOCA 1999/2000')
    && bInfo.includes('TESTE LOCAL DOS JOGOS'));
  verificar('barra: o campo de treinos vazio não produz item',
    !bInfo.includes('Treinos'));
  verificar('barra: o treinador guardado no painel NÃO é publicado',
    !bInfo.includes('TESTE TREINADOR QUE NAO APARECE')
    && !depoisEqp.includes('TESTE TREINADOR QUE NAO APARECE'));
  verificar('barra: os ids mantêm-se, para o JavaScript os encontrar',
    bInfo.includes('id="seniorLiga"') && bInfo.includes('id="seniorTemporada"')
    && bInfo.includes('id="seniorEstadio"'));

  verificar(`plantel: ${gruposEsperados.length} grupos de posição (${gruposEsperados.join(', ')})`,
    (bPlantel.match(/<div class="squad-group">/g) || []).length === gruposEsperados.length,
    'obtive ' + (bPlantel.match(/<div class="squad-group">/g) || []).length);
  verificar('plantel: o grupo sem jogadores NÃO é escrito',
    !bPlantel.includes('id="sgMEI"') && !bPlantel.includes('Médios'));
  verificar(`plantel: ${ativos.length} cartões de jogador`,
    (bPlantel.match(/<div class="player-card">/g) || []).length === ativos.length,
    'obtive ' + (bPlantel.match(/<div class="player-card">/g) || []).length);
  verificar('plantel: o jogador inativo não aparece',
    !bPlantel.includes('TESTE JOGADOR INATIVO'));
  verificar('plantel: sem número aparece o travessão',
    /<span class="player-card__num">—<\/span>/.test(bPlantel));
  verificar('plantel: sem fotografia aparecem as iniciais e não há atributo style',
    bPlantel.includes('<div class="player-card__avatar">TD</div>'));
  verificar('plantel: URL de fotografia com apóstrofo e parêntesis vem percent-encoded',
    bPlantel.includes("url('images/logo.png?x=a%27b%281%29')"),
    (bPlantel.match(/url\('images\/logo\.png[^']*'\)/g) || []).join(' | '));
  verificar('plantel: posicaoFull vazio cai para a posição',
    bPlantel.includes('player-card__pos--AVA">AVA<'));
  verificar('plantel: a mensagem de plantel vazio sai quando há jogadores',
    !bPlantel.includes('id="plantelVazio"'));
  verificar('plantel: nenhum dado pessoal além de nome, número, posição e foto',
    !/nascimento|idade|telefone|email/i.test(bPlantel));

  verificar(`publicações: 4 cartões de ${postsSeniores.length} publicadas`,
    (bPosts.match(/<article class="senior-post-card/g) || []).length === 4,
    'obtive ' + (bPosts.match(/<article class="senior-post-card/g) || []).length);
  verificar('publicações: uma ligação real "Ler mais" por cartão',
    (bPosts.match(/<a class="senior-post-card__more" href="noticias\.html\?id=\d+"/g) || []).length === 4);
  verificar('publicações: o primeiro cartão é o grande',
    bPosts.includes('senior-post-card senior-post-card--featured'));
  verificar('publicações: a não publicada não aparece',
    !bPosts.includes('NAO PUBLICADO'));
  verificar('publicações: sem resumo não há parágrafo de resumo vazio',
    !bPosts.includes('<p class="senior-post-card__excerpt"></p>'));
  verificar('publicações: o estado vazio fica escondido',
    bPosts.includes('id="seniorPostsEmpty" hidden'));
  verificar('publicações: o botão "Ver todas" aparece (5 publicadas, 4 mostradas)',
    bPosts.includes('id="btnVerTodosPosts"') && !/id="btnVerTodosPosts" hidden/.test(bPosts));
  verificar('publicações: o botão leva a classe que o tira sem JavaScript',
    bPosts.includes('btn-outline jsc-so-com-js'));

  // ---- E1/1, E1/2 e E1/3: as duas regiões do index.html ----------
  verificar('E1: as duas regiões do index.html vêm preenchidas',
    blocoAgI.includes('agenda-card') && dentroDasMarcas(depoisHtml, 'index.html', 'noticias').includes('news-card'));

  const regiaoNoticiasAntes = dentroDasMarcas(depoisHtml, 'index.html', 'noticias');
  const regiaoAgendaAntes   = blocoAgI;

  // Mexer só na agenda.
  const soAgenda = JSON.parse(JSON.stringify(dados));
  soAgenda.agenda = soAgenda.agenda.filter((e) => e.titulo !== 'TESTE EVENTO HOJE');
  escreverDados(raiz, soAgenda);
  g = gerar(raiz);
  let idxAgora = fs.readFileSync(idx, 'utf8');
  verificar('E1/2: alterar a agenda não toca na região das notícias',
    g.estado === 0 && dentroDasMarcas(idxAgora, 'index.html', 'noticias') === regiaoNoticiasAntes,
    g.saida.trim().slice(0, 160));
  verificar('E1/2: e a região da agenda mudou de facto',
    dentroDasMarcas(idxAgora, 'index.html', 'agenda') !== regiaoAgendaAntes);

  // Mexer só nas notícias.
  const soNoticias = JSON.parse(JSON.stringify(dados));
  soNoticias.noticias = soNoticias.noticias.filter((n) => n.titulo !== 'TESTE A');
  escreverDados(raiz, soNoticias);
  g = gerar(raiz);
  idxAgora = fs.readFileSync(idx, 'utf8');
  verificar('E1/3: alterar as notícias não toca na região da agenda',
    g.estado === 0 && dentroDasMarcas(idxAgora, 'index.html', 'agenda') === regiaoAgendaAntes,
    g.saida.trim().slice(0, 160));
  verificar('E1/3: e a região das notícias mudou de facto',
    dentroDasMarcas(idxAgora, 'index.html', 'noticias') !== regiaoNoticiasAntes);

  // Voltar ao estado bom para os ensaios de corrupção.
  escreverDados(raiz, dados);
  g = gerar(raiz);
  verificar('E1: regeneração com os dados completos', g.estado === 0, g.saida.trim());

  // ---- 8a. Corrupção: o modelo rebenta ---------------------------
  // A transação cobre o conjunto: um erro num dos modelos não pode deixar a
  // outra página publicada. Por isso cada ensaio compara os TRÊS ficheiros.
  const modeloInicio = path.join(raiz, 'modelos', 'noticias-inicio.php');
  const modeloPagina = path.join(raiz, 'modelos', 'noticias-pagina.php');
  const modeloAgenda = path.join(raiz, 'modelos', 'agenda-inicio.php');
  const modeloAgPag  = path.join(raiz, 'modelos', 'agenda-pagina.php');
  const bomInicio = fs.readFileSync(modeloInicio, 'utf8');
  const bomPagina = fs.readFileSync(modeloPagina, 'utf8');
  const bomAgenda = fs.readFileSync(modeloAgenda, 'utf8');
  const modeloSenInfo = path.join(raiz, 'modelos', 'seniores-info.php');
  const modeloSenPlan = path.join(raiz, 'modelos', 'seniores-plantel.php');
  const modeloSenPost = path.join(raiz, 'modelos', 'seniores-posts.php');
  const bomAgPag  = fs.readFileSync(modeloAgPag, 'utf8');
  const bomSenInfo = fs.readFileSync(modeloSenInfo, 'utf8');
  const bomSenPlan = fs.readFileSync(modeloSenPlan, 'utf8');
  const bomSenPost = fs.readFileSync(modeloSenPost, 'utf8');
  const htmlBom   = fs.readFileSync(idx, 'utf8');
  const notBom    = fs.readFileSync(not, 'utf8');
  const ageBom    = fs.readFileSync(age, 'utf8');
  const eqpBom    = fs.readFileSync(eqp, 'utf8');
  const dbBom     = fs.readFileSync(db, 'utf8');

  // Quando é o próprio teste que estraga o index.html, o que se verifica é
  // que a geração não escreveu NADA: o ficheiro fica como o teste o deixou, e
  // os outros ficam intactos.
  const naoEscreveuNada = (etiqueta, comoFicou) => {
    verificar(etiqueta + ': a geração não escreveu no index.html',
      fs.readFileSync(idx, 'utf8') === comoFicou);
    verificar(etiqueta + ': noticias.html intacto byte a byte',
      fs.readFileSync(not, 'utf8') === notBom);
    verificar(etiqueta + ': agenda.html intacto byte a byte',
      fs.readFileSync(age, 'utf8') === ageBom);
    verificar(etiqueta + ': equipa-principal.html intacto byte a byte',
      fs.readFileSync(eqp, 'utf8') === eqpBom);
    verificar(etiqueta + ': data/db.json intacto byte a byte',
      fs.readFileSync(db, 'utf8') === dbBom);
  };

  const nadaMudou = (etiqueta) => {
    verificar(etiqueta + ': index.html intacto byte a byte',
      fs.readFileSync(idx, 'utf8') === htmlBom);
    verificar(etiqueta + ': noticias.html intacto byte a byte',
      fs.readFileSync(not, 'utf8') === notBom);
    verificar(etiqueta + ': agenda.html intacto byte a byte',
      fs.readFileSync(age, 'utf8') === ageBom);
    verificar(etiqueta + ': equipa-principal.html intacto byte a byte',
      fs.readFileSync(eqp, 'utf8') === eqpBom);
    verificar(etiqueta + ': data/db.json intacto byte a byte',
      fs.readFileSync(db, 'utf8') === dbBom);
  };

  for (const [etiqueta, ficheiro, bom] of [
    ['modelo das notícias da página inicial que rebenta', modeloInicio, bomInicio],
    ['modelo da página de notícias que rebenta', modeloPagina, bomPagina],
    // E1/4: o segundo bloco do index.html a falhar não pode deixar o
    // primeiro publicado — nem a página inteira meio escrita.
    ['modelo da agenda da página inicial que rebenta', modeloAgenda, bomAgenda],
    ['modelo da lista da agenda que rebenta', modeloAgPag, bomAgPag],
    // Três regiões no mesmo ficheiro: qualquer uma a falhar não pode deixar
    // as outras duas publicadas.
    ['modelo da barra de informação que rebenta', modeloSenInfo, bomSenInfo],
    ['modelo do plantel que rebenta', modeloSenPlan, bomSenPlan],
    ['modelo das publicações da equipa que rebenta', modeloSenPost, bomSenPost],
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

  // ---- 8c. E1/7: marca em falta aborta ---------------------------
  // Cada marca de cada região, uma a uma: quatro no total, duas delas na
  // página inicial, que tem dois blocos.
  for (const [nomeFich, ficheiro, bom] of [
    ['index.html', idx, htmlBom],
    ['noticias.html', not, notBom],
    ['agenda.html', age, ageBom],
    ['equipa-principal.html', eqp, eqpBom],
  ]) {
    for (const b of BLOCOS[nomeFich]) {
      for (const [qual, marca] of [['início', b.ini], ['fim', b.fim]]) {
        fs.writeFileSync(ficheiro, bom.replace(marca, '<!-- marca apagada de propósito -->'));
        g = gerar(raiz);
        verificar(`marca de ${qual} de ${b.nome} em falta: a geração aborta`,
          g.estado !== 0, g.saida.trim().slice(0, 200));
        fs.writeFileSync(ficheiro, bom);
      }
    }
  }

  // ---- 8c2. E1/5: marca duplicada aborta ------------------------
  for (const b of BLOCOS['index.html']) {
    const estragado = htmlBom.replace(b.ini, b.ini + '\n      ' + b.ini);
    fs.writeFileSync(idx, estragado);
    g = gerar(raiz);
    verificar(`marca de ${b.nome} duplicada: a geração aborta`,
      g.estado !== 0 && /aparece 2 vez/.test(g.saida), g.saida.trim().slice(0, 200));
    naoEscreveuNada(`marca de ${b.nome} duplicada`, estragado);
    fs.writeFileSync(idx, htmlBom);
  }

  // ---- 8c3. E1/6: marcas sobrepostas e encaixadas abortam -------
  // Sobrepostas: o fim da agenda passa para depois do início das notícias,
  // e as duas regiões ficam entrelaçadas.
  const A = BLOCOS['index.html'].find((b) => b.nome === 'agenda');
  const N = BLOCOS['index.html'].find((b) => b.nome === 'noticias');
  const sobrepostas = htmlBom.replace(A.fim, '').replace(N.ini, N.ini + '\n      ' + A.fim);
  fs.writeFileSync(idx, sobrepostas);
  g = gerar(raiz);
  verificar('marcas sobrepostas: a geração aborta',
    g.estado !== 0 && /sobrep|encaix/.test(g.saida), g.saida.trim().slice(0, 200));
  naoEscreveuNada('marcas sobrepostas', sobrepostas);

  // Encaixadas: a região das notícias inteira dentro da região da agenda.
  const encaixadas = htmlBom.replace(A.fim, '').replace('</body>', A.fim + '\n</body>');
  fs.writeFileSync(idx, encaixadas);
  g = gerar(raiz);
  verificar('marcas encaixadas: a geração aborta',
    g.estado !== 0 && /sobrep|encaix/.test(g.saida), g.saida.trim().slice(0, 200));
  naoEscreveuNada('marcas encaixadas', encaixadas);
  fs.writeFileSync(idx, htmlBom);

  // ---- 8d. Transação interrompida: o diário repara ---------------
  // Simula o que ficaria em disco se o processo morresse a meio da
  // promoção: um backup da versão anterior e um diário sem fechar.
  const ant = path.join(raiz, 'data', 'publicacao', 'anterior');
  fs.mkdirSync(ant, { recursive: true });
  // A versão "anterior" do index.html é o ficheiro bom com uma marca de água
  // que se reconhece — as marcas ficam todas de pé, senão a geração seguinte
  // falhava por outra razão.
  const versaoAnterior = htmlBom.replace('</body>', '<!-- versão anterior --></body>');
  fs.writeFileSync(path.join(ant, 'index.html'), versaoAnterior);
  fs.writeFileSync(path.join(ant, 'noticias.html'), notBom);
  fs.writeFileSync(path.join(ant, 'agenda.html'), ageBom);
  fs.writeFileSync(path.join(ant, 'equipa-principal.html'), eqpBom);
  fs.writeFileSync(path.join(raiz, 'data', 'publicacao', 'transacao.json'),
    JSON.stringify({ iniciada: '2020-01-01T00:00:00+00:00', por: 'teste',
                     ficheiros: [{ destino: 'index.html' }, { destino: 'noticias.html' },
                                 { destino: 'agenda.html' },
                                 { destino: 'equipa-principal.html' }] }));
  fs.writeFileSync(idx, htmlBom.replace('</body>', '<!-- estado a meio --></body>'));
  fs.writeFileSync(not, notBom.replace('</body>', '<!-- estado a meio --></body>'));
  fs.writeFileSync(age, ageBom.replace('</body>', '<!-- estado a meio --></body>'));
  fs.writeFileSync(eqp, eqpBom.replace('</body>', '<!-- estado a meio --></body>'));
  g = gerar(raiz);
  verificar('diário pendente: a publicação seguinte restaura e avisa',
    g.estado === 0 && /não tinha terminado/.test(g.saida), g.saida.trim().slice(0, 200));
  verificar('diário pendente: as quatro páginas foram repostas',
    !fs.readFileSync(idx, 'utf8').includes('estado a meio')
    && !fs.readFileSync(not, 'utf8').includes('estado a meio')
    && !fs.readFileSync(age, 'utf8').includes('estado a meio')
    && !fs.readFileSync(eqp, 'utf8').includes('estado a meio'));
  verificar('diário pendente: o diário foi fechado',
    !fs.existsSync(path.join(raiz, 'data', 'publicacao', 'transacao.json')));

  // ---- E1/9. Reverter restaura o ficheiro completo ---------------
  // Antes de reverter, deixa-se o index.html com as duas regiões geradas e
  // uma marca de água: o que se exige é que o ficheiro INTEIRO volte ao
  // backup, com as duas regiões, e não só uma delas.
  escreverDados(raiz, dados);
  g = gerar(raiz);
  const idxGerado = fs.readFileSync(idx, 'utf8');
  verificar('reverter: o ponto de partida tem as duas regiões preenchidas',
    g.estado === 0
    && dentroDasMarcas(idxGerado, 'index.html', 'agenda').includes('agenda-card')
    && dentroDasMarcas(idxGerado, 'index.html', 'noticias').includes('news-card'));

  fs.writeFileSync(idx, idxGerado.replace('</body>', '<!-- rabisco --></body>'));
  fs.writeFileSync(not, notBom.replace('</body>', '<!-- rabisco --></body>'));
  fs.writeFileSync(age, ageBom.replace('</body>', '<!-- rabisco --></body>'));
  const eqpGerado = fs.readFileSync(eqp, 'utf8');
  fs.writeFileSync(eqp, eqpGerado.replace('</body>', '<!-- rabisco --></body>'));
  g = gerar(raiz, ['--reverter']);
  verificar('reverter: corre sem erro e nomeia as quatro páginas',
    g.estado === 0 && /index\.html/.test(g.saida) && /noticias\.html/.test(g.saida)
    && /agenda\.html/.test(g.saida) && /equipa-principal\.html/.test(g.saida),
    g.saida.trim().slice(0, 200));
  verificar('reverter: a equipa-principal.html voltou inteira, com as três regiões',
    !fs.readFileSync(eqp, 'utf8').includes('rabisco')
    && BLOCOS['equipa-principal.html'].every((b) => {
      const c = fs.readFileSync(eqp, 'utf8');
      return c.includes(b.ini) && c.includes(b.fim);
    }));
  const idxRevertido = fs.readFileSync(idx, 'utf8');
  verificar('reverter: o index.html voltou inteiro, sem o rabisco',
    !idxRevertido.includes('rabisco')
    && !fs.readFileSync(not, 'utf8').includes('rabisco')
    && !fs.readFileSync(age, 'utf8').includes('rabisco'));
  verificar('reverter: e as duas regiões do index.html continuam de pé',
    foraDasMarcas(idxRevertido, 'index.html') !== null
    && BLOCOS['index.html'].every((b) => idxRevertido.includes(b.ini) && idxRevertido.includes(b.fim)));

  // ---- Deixar a cópia no estado bom, com a fixture gerada --------
  fs.writeFileSync(idx, htmlBom);
  fs.writeFileSync(not, notBom);
  fs.writeFileSync(age, ageBom);
  fs.writeFileSync(eqp, eqpBom);
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
      agendaCartoes: document.querySelectorAll('#agendaPublicGrid .agenda-card').length,
      agendaTitulos: Array.from(document.querySelectorAll('#agendaPublicGrid .agenda-card__title'))
        .map((el) => el.textContent),
      agendaVazio: !!document.querySelector('#agendaPublicGrid .jsc-vazio'),
      agendaMetaVazio: Array.from(document.querySelectorAll('#agendaPublicGrid .agenda-card__meta'))
        .filter((el) => !el.textContent.trim()).length,
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

// Sonda da agenda.html. O calendário e os filtros são controlos: existem só
// com JavaScript, e é isso que se verifica.
async function testarAgenda(browser, url, comJs, largura, opcoes = {}) {
  const ctx = await browser.newContext({
    javaScriptEnabled: comJs,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    acceptDownloads: true,
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
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  const resp = await pg.goto(url + '/agenda.html',
    { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });
  const estado = resp ? resp.status() : 0;

  // Descarregar o .ics é a prova de que o botão gerado continua ligado ao
  // js/ics.js, agora por um ouvinte no contentor.
  let descarregou = '';
  if (opcoes.descarregarIcs) {
    const [download] = await Promise.all([
      pg.waitForEvent('download', { timeout: 8000 }).catch(() => null),
      pg.click('#agendaList .agenda-ics-btn'),
    ]);
    descarregou = download ? download.suggestedFilename() : '';
  }
  if (opcoes.clicar) await pg.click(opcoes.clicar);

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const itens = Array.from(document.querySelectorAll('#agendaList .agenda-pub-item'));
    const doc = document.documentElement;
    return {
      eventos: itens.length,
      visiveis: itens.filter(visivel).length,
      titulos: itens.map((el) => (el.querySelector('.agenda-pub-title') || {}).textContent || ''),
      vazio: !!document.querySelector('#agendaList .agenda-pub-empty'),
      metaVazio: Array.from(document.querySelectorAll('#agendaList .agenda-pub-meta'))
        .filter((el) => !el.textContent.trim()).length,
      ics: document.querySelectorAll('#agendaList .agenda-ics-btn').length,
      icsVisiveis: Array.from(document.querySelectorAll('#agendaList .agenda-ics-btn')).filter(visivel).length,
      diasCalendario: document.querySelectorAll('#agendaCal .cal-day[data-date]').length,
      pontosCalendario: document.querySelectorAll('#agendaCal .cal-dot').length,
      calendarioTemTexto: (document.getElementById('agendaCal') || {}).textContent
        ? document.getElementById('agendaCal').textContent.trim().length : 0,
      filtros: document.querySelectorAll('#agendaFilters .news-filter-btn').length,
      titulo: (document.querySelector('.agenda-list-title') || {}).textContent || '',
      transbordo: doc.scrollWidth - doc.clientWidth,
    };
  });
  const inicioDoCorpo = estado === 200 ? '' : (await pg.content()).slice(0, 300);
  await ctx.close();
  return { ...d, estado, inicioDoCorpo, descarregou, erros };
}

// Sonda da equipa-principal.html. Mede o que se vê: a barra, o plantel
// agrupado, as publicações, e as interações que só existem com JavaScript.
async function testarEquipa(browser, url, comJs, largura, opcoes = {}) {
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
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  const resp = await pg.goto(url + '/equipa-principal.html',
    { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });
  const estado = resp ? resp.status() : 0;

  if (opcoes.clicar) await pg.click(opcoes.clicar);
  if (opcoes.teclado) {
    await pg.focus(opcoes.teclado);
    await pg.keyboard.press('Enter');
    await pg.waitForTimeout(150);
  }

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const cartoes = Array.from(document.querySelectorAll('#seniorPlantel .player-card'));
    const posts = Array.from(document.querySelectorAll('#seniorPostsGrid .senior-post-card'));
    const grupos = Array.from(document.querySelectorAll('#seniorPlantel .squad-group'));
    const doc = document.documentElement;
    const modal = document.getElementById('newsArchive');
    return {
      infoItens: document.querySelectorAll('#seniorInfoBar .senior-info__item').length,
      infoVisivel: visivel(document.getElementById('seniorInfoBar')),
      infoRotulos: Array.from(document.querySelectorAll('#seniorInfoBar .senior-info__label'))
        .map((el) => el.textContent),
      infoValores: Array.from(document.querySelectorAll('#seniorInfoBar .senior-info__val'))
        .map((el) => el.textContent),
      grupos: grupos.filter(visivel).length,
      gruposTitulos: grupos.filter(visivel).map((g) => (g.querySelector('.squad-group__title') || {}).textContent || ''),
      jogadores: cartoes.length,
      jogadoresVisiveis: cartoes.filter(visivel).length,
      nomes: cartoes.map((c) => (c.querySelector('.player-card__name') || {}).textContent || ''),
      numeros: cartoes.map((c) => (c.querySelector('.player-card__num') || {}).textContent || ''),
      avataresComFoto: cartoes.filter((c) => {
        const a = c.querySelector('.player-card__avatar');
        return a && a.getAttribute('style');
      }).length,
      plantelVazio: visivel(document.getElementById('plantelVazio')),
      posts: posts.length,
      postsVisiveis: posts.filter(visivel).length,
      postsTitulos: posts.map((c) => (c.querySelector('.senior-post-card__title') || {}).textContent || ''),
      ligacoes: Array.from(document.querySelectorAll('#seniorPostsGrid .senior-post-card__more'))
        .map((a) => a.tagName.toLowerCase() + ':' + (a.getAttribute('href') || '')),
      postsVazio: visivel(document.getElementById('seniorPostsEmpty')),
      botao: visivel(document.getElementById('btnVerTodosPosts')),
      modalAberto: !!(modal && modal.classList.contains('open')),
      modalTexto: modal ? (modal.textContent || '').slice(0, 300) : '',
      modalItens: document.querySelectorAll('#newsArchiveBody .news-archive__item').length,
      transbordo: doc.scrollWidth - doc.clientWidth,
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
  // As datas da agenda são resolvidas uma vez, aqui: 0 = hoje.
  const dados = comDatas(JSON.parse(fs.readFileSync(FIXTURE, 'utf8')));

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

    // ---- Agenda ------------------------------------------------
    const futurosB = dados.agenda.filter((e) => e.data >= hojeISO() && e.estado !== 'Cancelado');
    const NA = Math.min(6, futurosB.length);

    console.log('\nagenda da página inicial');
    let a = await testarPagina(browser, srv.url, false, 1440);
    verificar(`SEM JavaScript: ${NA} cartões de agenda`, a.agendaCartoes === NA, 'obtive ' + a.agendaCartoes);
    verificar('SEM JavaScript: o evento de hoje está lá',
      a.agendaTitulos.includes('TESTE EVENTO HOJE'), a.agendaTitulos.join(' | '));
    verificar('SEM JavaScript: nenhum passado e nenhum cancelado',
      !a.agendaTitulos.some((t) => /ONTEM|CANCELADO/.test(t)), a.agendaTitulos.join(' | '));
    verificar('SEM JavaScript: sem linha de meta vazia', a.agendaMetaVazio === 0);
    verificar('SEM JavaScript: sem mensagem de lista vazia', !a.agendaVazio);
    a = await testarPagina(browser, srv.url, false, 320);
    verificar(`SEM JavaScript a 320px: ${NA} cartões`, a.agendaCartoes === NA, 'obtive ' + a.agendaCartoes);
    verificar('SEM JavaScript a 320px: sem transbordo', a.transbordo <= 0, '+' + a.transbordo + 'px');
    a = await testarPagina(browser, srv.url, true, 1440);
    verificar(`COM JavaScript: continuam ${NA} cartões — sem duplicação`,
      a.agendaCartoes === NA, 'obtive ' + a.agendaCartoes);
    verificar('COM JavaScript: sem erros de consola', a.erros.length === 0, a.erros.join(' / '));
    a = await testarPagina(browser, srv.url, true, 320);
    verificar(`COM JavaScript a 320px: ${NA} cartões`, a.agendaCartoes === NA, 'obtive ' + a.agendaCartoes);
    verificar('COM JavaScript a 320px: sem transbordo', a.transbordo <= 0, '+' + a.transbordo + 'px');

    console.log('\nagenda.html SEM JavaScript');
    let ag = await testarAgenda(browser, srv.url, false, 1440);
    verificar('responde 200', ag.estado === 200,
      'respondeu ' + ag.estado + ' — ' + ag.inicioDoCorpo.replace(/\s+/g, ' '));
    verificar(`os ${futurosB.length} eventos futuros estão no HTML e visíveis`,
      ag.eventos === futurosB.length && ag.visiveis === futurosB.length,
      'no DOM ' + ag.eventos + ', visíveis ' + ag.visiveis);
    verificar('ordem por data ascendente',
      ag.titulos[0] === 'TESTE EVENTO HOJE', ag.titulos.slice(0, 3).join(' | '));
    verificar('nenhum passado e nenhum cancelado',
      !ag.titulos.some((t) => /ONTEM|CANCELADO/.test(t)));
    verificar('sem linha de meta vazia', ag.metaVazio === 0);
    verificar('o botão de calendário NÃO aparece sem JavaScript',
      ag.icsVisiveis === 0, 'visíveis ' + ag.icsVisiveis);
    verificar('o calendário fica vazio sem JavaScript', ag.calendarioTemTexto === 0);
    verificar('a barra de filtros fica vazia sem JavaScript', ag.filtros === 0);
    verificar('sem transbordo horizontal', ag.transbordo <= 0, '+' + ag.transbordo + 'px');

    ag = await testarAgenda(browser, srv.url, false, 320);
    verificar(`a 320px: os ${futurosB.length} eventos visíveis`,
      ag.visiveis === futurosB.length, 'visíveis ' + ag.visiveis);
    verificar('a 320px: sem transbordo', ag.transbordo <= 0, '+' + ag.transbordo + 'px');

    console.log('\nagenda.html COM JavaScript');
    ag = await testarAgenda(browser, srv.url, true, 1440);
    verificar(`continuam ${futurosB.length} eventos — sem duplicação`,
      ag.eventos === futurosB.length, 'obtive ' + ag.eventos);
    verificar('o calendário mensal foi desenhado', ag.diasCalendario >= 28,
      'dias ' + ag.diasCalendario);
    verificar('o calendário tem pontos nos dias com eventos', ag.pontosCalendario > 0,
      'pontos ' + ag.pontosCalendario);
    verificar('a barra de filtros tem os seis tipos', ag.filtros === 6, 'botões ' + ag.filtros);
    verificar('o botão de calendário aparece, um por evento',
      ag.icsVisiveis === futurosB.length, 'visíveis ' + ag.icsVisiveis);
    verificar('sem erros de consola', ag.erros.length === 0, ag.erros.join(' / '));
    verificar('sem transbordo horizontal', ag.transbordo <= 0, '+' + ag.transbordo + 'px');

    ag = await testarAgenda(browser, srv.url, true, 320);
    verificar('a 320px com JavaScript: sem transbordo', ag.transbordo <= 0, '+' + ag.transbordo + 'px');

    console.log('\nagenda.html: o que continua a ser do JavaScript');
    const nJogos = futurosB.filter((e) => e.tipo === 'Jogo').length;
    ag = await testarAgenda(browser, srv.url, true, 1440, { clicar: '[data-tipo="Jogo"]' });
    verificar(`filtro por tipo: mostra os ${nJogos} do tipo Jogo`,
      ag.eventos === nJogos, 'obtive ' + ag.eventos);

    ag = await testarAgenda(browser, srv.url, true, 1440, { clicar: `.cal-day[data-date="${hojeISO()}"]` });
    verificar('clicar no dia de hoje no calendário mostra o evento desse dia',
      ag.eventos === 1 && ag.titulos[0] === 'TESTE EVENTO HOJE',
      ag.eventos + ' evento(s): ' + ag.titulos.join(' | '));
    verificar('e o título da lista muda para esse dia',
      /Eventos — /.test(ag.titulo), ag.titulo);

    ag = await testarAgenda(browser, srv.url, true, 1440, { descarregarIcs: true });
    verificar('o botão gerado descarrega o .ics',
      /\.ics$/.test(ag.descarregou), ag.descarregou || '(não descarregou)');

    // ---- data-desde: a passagem de um dia ------------------------
    // Para provar que o JavaScript redesenhou — e não que o bloco gerado já
    // estava certo — põe-se uma marca de água no HTML gerado: se ela
    // desaparecer, foi reescrito.
    console.log('\nagenda: passagem de um dia depois da geração');
    const agePath = path.join(raiz, 'agenda.html');
    const ageGerado = fs.readFileSync(agePath, 'utf8');
    const comMarca = ageGerado.replace('TESTE EVENTO HOJE', 'MARCA DE AGUA GERADA');

    fs.writeFileSync(agePath, comMarca);
    ag = await testarAgenda(browser, srv.url, true, 1440);
    verificar('data-desde de hoje: o JavaScript NÃO mexe no que foi gerado',
      ag.titulos.includes('MARCA DE AGUA GERADA'), ag.titulos.slice(0, 2).join(' | '));

    fs.writeFileSync(agePath, comMarca.replace('data-desde="' + hojeISO() + '"', 'data-desde="2020-01-01"'));
    ag = await testarAgenda(browser, srv.url, true, 1440);
    verificar('data-desde de outro dia: o JavaScript volta a desenhar a lista',
      !ag.titulos.includes('MARCA DE AGUA GERADA') && ag.eventos === futurosB.length,
      'eventos ' + ag.eventos + ' | ' + ag.titulos.slice(0, 2).join(' | '));

    fs.writeFileSync(agePath, comMarca.replace('data-itens="' + futurosB.length + '"', 'data-itens="999"'));
    ag = await testarAgenda(browser, srv.url, true, 1440);
    verificar('data-itens errado: o JavaScript volta a desenhar a lista',
      !ag.titulos.includes('MARCA DE AGUA GERADA') && ag.eventos === futurosB.length,
      'eventos ' + ag.eventos);
    fs.writeFileSync(agePath, ageGerado);

    // O mesmo par para a grelha da página inicial.
    const idxPath = path.join(raiz, 'index.html');
    const idxGeradoB = fs.readFileSync(idxPath, 'utf8');
    const idxComMarca = idxGeradoB.replace('TESTE EVENTO HOJE', 'MARCA DE AGUA GERADA');
    fs.writeFileSync(idxPath, idxComMarca);
    a = await testarPagina(browser, srv.url, true, 1440);
    verificar('página inicial, data-desde de hoje: o JavaScript não mexe na grelha',
      a.agendaTitulos.includes('MARCA DE AGUA GERADA'), a.agendaTitulos.join(' | '));
    fs.writeFileSync(idxPath, idxComMarca.replace('data-desde="' + hojeISO() + '"', 'data-desde="2020-01-01"'));
    a = await testarPagina(browser, srv.url, true, 1440);
    verificar('página inicial, data-desde de outro dia: o JavaScript redesenha',
      !a.agendaTitulos.includes('MARCA DE AGUA GERADA') && a.agendaCartoes === NA,
      a.agendaTitulos.join(' | '));
    fs.writeFileSync(idxPath, idxGeradoB);

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
    // "Todas" mais uma por categoria existente na lista — contado a partir
    // dos dados, não fixado no teste.
    const agoraISO = new Date().toISOString();
    const categorias = [...new Set(dados.noticias
      .filter((n) => n.publicada || (n.scheduledAt && n.scheduledAt <= agoraISO))
      .map((n) => n.categoria).filter(Boolean))];
    verificar(`a barra de filtros aparece, com "Todas" mais as ${categorias.length} categorias`,
      p.filtros && p.nFiltros === categorias.length + 1,
      'visível=' + p.filtros + ' botões=' + p.nFiltros + ' esperados=' + (categorias.length + 1));
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

    // ---- Equipa principal ---------------------------------------
    const ativosB = dados.seniores.filter((j) => j.ativo !== false);
    const gruposB = ['GR', 'DEF', 'MEI', 'AVA']
      .filter((pos) => ativosB.some((j) => j.posicao === pos));
    const infoB = ['liga', 'temporada', 'treinos', 'estadio']
      .filter((k) => (dados.senioresInfo[k] || '').trim() !== '').length;
    const postsB = dados.noticias.filter((n) => n.publicada && n.categoria === 'Seniores');

    console.log('\nequipa principal SEM JavaScript (1440px)');
    let q = await testarEquipa(browser, srv.url, false, 1440);
    verificar('responde 200', q.estado === 200,
      'respondeu ' + q.estado + ' — ' + q.inicioDoCorpo.replace(/\s+/g, ' '));
    verificar(`barra de informação com ${infoB} campos`, q.infoItens === infoB, 'obtive ' + q.infoItens);
    verificar('barra: sem o campo de treinos, que está vazio',
      !q.infoRotulos.includes('Treinos'), q.infoRotulos.join(' | '));
    verificar(`plantel: ${gruposB.length} grupos visíveis (${gruposB.join(', ')})`,
      q.grupos === gruposB.length, 'obtive ' + q.grupos + ': ' + q.gruposTitulos.join(' | '));
    verificar('plantel: o grupo dos médios não existe na página',
      !q.gruposTitulos.some((t) => /Médios/.test(t)));
    verificar(`plantel: ${ativosB.length} jogadores, todos visíveis`,
      q.jogadores === ativosB.length && q.jogadoresVisiveis === ativosB.length,
      'no DOM ' + q.jogadores + ', visíveis ' + q.jogadoresVisiveis);
    verificar('plantel: o inativo não aparece',
      !q.nomes.some((n) => /INATIVO/.test(n)), q.nomes.join(' | '));
    verificar('plantel: o jogador sem número mostra o travessão',
      q.numeros.includes('—'), q.numeros.join(' | '));
    verificar('plantel: só os jogadores com foto têm imagem de fundo',
      q.avataresComFoto === ativosB.filter((j) => (j.foto || '') !== '').length,
      'com foto ' + q.avataresComFoto);
    verificar('plantel: a mensagem de plantel vazio não aparece', !q.plantelVazio);
    verificar('publicações: 4 cartões visíveis',
      q.posts === 4 && q.postsVisiveis === 4, 'no DOM ' + q.posts);
    verificar('publicações: cada "Ler mais" é uma ligação <a> a sério',
      q.ligacoes.length === 4 && q.ligacoes.every((l) => /^a:noticias\.html\?id=\d+$/.test(l)),
      q.ligacoes.join(' | '));
    verificar('publicações: o estado vazio não aparece', !q.postsVazio);
    verificar('o botão "Ver todas" NÃO aparece sem JavaScript', !q.botao);
    verificar('sem transbordo horizontal', q.transbordo <= 0, '+' + q.transbordo + 'px');

    console.log('\nequipa principal SEM JavaScript (320px)');
    q = await testarEquipa(browser, srv.url, false, 320);
    verificar(`os ${ativosB.length} jogadores visíveis a 320px`,
      q.jogadoresVisiveis === ativosB.length, 'visíveis ' + q.jogadoresVisiveis);
    verificar('4 publicações visíveis a 320px', q.postsVisiveis === 4, 'visíveis ' + q.postsVisiveis);
    verificar('sem transbordo horizontal a 320px', q.transbordo <= 0, '+' + q.transbordo + 'px');

    console.log('\nequipa principal COM JavaScript (1440px)');
    q = await testarEquipa(browser, srv.url, true, 1440);
    verificar(`barra: continuam ${infoB} campos — sem duplicação`, q.infoItens === infoB, 'obtive ' + q.infoItens);
    verificar(`plantel: continuam ${ativosB.length} jogadores e ${gruposB.length} grupos — sem duplicação`,
      q.jogadores === ativosB.length && q.grupos === gruposB.length,
      'jogadores ' + q.jogadores + ', grupos ' + q.grupos);
    verificar('publicações: continuam 4 cartões — sem duplicação', q.posts === 4, 'obtive ' + q.posts);
    verificar(`o botão "Ver todas" aparece (${postsB.length} publicadas, 4 mostradas)`, q.botao);
    verificar('sem erros de consola', q.erros.length === 0, q.erros.join(' / '));
    verificar('sem transbordo horizontal', q.transbordo <= 0, '+' + q.transbordo + 'px');

    q = await testarEquipa(browser, srv.url, true, 320);
    verificar('a 320px com JavaScript: sem transbordo', q.transbordo <= 0, '+' + q.transbordo + 'px');

    console.log('\nequipa principal: interações do JavaScript');
    q = await testarEquipa(browser, srv.url, true, 1440,
      { clicar: '#seniorPostsGrid .senior-post-card .senior-post-card__more' });
    verificar('clicar no "Ler mais" abre o modal em vez de navegar',
      q.modalAberto && /TESTE POST SENIORES A/.test(q.modalTexto),
      'modal aberto=' + q.modalAberto);

    q = await testarEquipa(browser, srv.url, true, 1440,
      { teclado: '#seniorPostsGrid .senior-post-card .senior-post-card__more' });
    verificar('a mesma ligação é alcançável e acionável com o teclado (Enter)',
      q.modalAberto && /TESTE POST SENIORES A/.test(q.modalTexto),
      'modal aberto=' + q.modalAberto);

    // ---- divergência de contagem: o JavaScript reconstrói os blocos ----
    // Com o data-itens errado, o JavaScript tem de voltar a desenhar — e a
    // desenhar o bloco TODO, não só o interior. É isso que a marca de água
    // prova: se desaparecer, foi reescrito. Sem isto, um campo ou um grupo
    // que o gerador não escreveu nunca poderia ser acrescentado.
    const eqpPath = path.join(raiz, 'equipa-principal.html');
    const eqpGeradoB = fs.readFileSync(eqpPath, 'utf8');
    const comAgua = eqpGeradoB
      .replace('TESTE COMPETICAO', 'MARCA DE AGUA NA BARRA')
      .replace('TESTE GUARDIAO UM', 'MARCA DE AGUA NO PLANTEL');

    fs.writeFileSync(eqpPath, comAgua);
    q = await testarEquipa(browser, srv.url, true, 1440);
    verificar('contagens certas: o JavaScript não mexe no que foi gerado',
      q.infoItens === infoB && q.jogadores === ativosB.length
      && q.infoValores.includes('MARCA DE AGUA NA BARRA')
      && q.nomes.includes('MARCA DE AGUA NO PLANTEL'),
      'itens ' + q.infoItens + ', jogadores ' + q.jogadores
      + ', barra: ' + q.infoValores.join(' | '));

    fs.writeFileSync(eqpPath, comAgua.replace(`data-itens="${ativosB.length}"`, 'data-itens="99"'));
    q = await testarEquipa(browser, srv.url, true, 1440);
    verificar('data-itens do plantel errado: o JavaScript reconstrói o bloco todo',
      !q.nomes.includes('MARCA DE AGUA NO PLANTEL')
      && q.jogadores === ativosB.length && q.grupos === gruposB.length,
      'jogadores ' + q.jogadores + ', grupos ' + q.grupos);

    fs.writeFileSync(eqpPath, comAgua.replace(`data-itens="${infoB}"`, 'data-itens="98"'));
    q = await testarEquipa(browser, srv.url, true, 1440);
    verificar('data-itens da barra errado: o JavaScript reconstrói a barra toda',
      q.infoItens === infoB && !q.infoRotulos.includes('Treinos')
      && !q.infoValores.includes('MARCA DE AGUA NA BARRA'),
      'itens ' + q.infoItens + ': ' + q.infoValores.join(' | '));
    fs.writeFileSync(eqpPath, eqpGeradoB);

    q = await testarEquipa(browser, srv.url, true, 1440, { clicar: '#btnVerTodosPosts' });
    verificar(`o botão "Ver todas" abre o arquivo com as ${postsB.length} publicações`,
      q.modalAberto && q.modalItens === postsB.length,
      'modal aberto=' + q.modalAberto + ', itens ' + q.modalItens);

    // ---- 7. Bloqueios do .htaccess ------------------------------
    console.log('\nproteções');
    const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
    for (const [caminho, esperado] of [
      ['/modelos/noticias-inicio.php', 403],
      ['/modelos/noticias-pagina.php', 403],
      ['/modelos/agenda-inicio.php', 403],
      ['/modelos/agenda-pagina.php', 403],
      ['/modelos/seniores-info.php', 403],
      ['/modelos/seniores-plantel.php', 403],
      ['/modelos/seniores-posts.php', 403],
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
    // Sem eventos nenhuns: a agenda tem de mostrar a sua mensagem própria.
    semNoticias.agenda = [];
    // E a equipa principal sem nada: barra vazia, plantel vazio, e as
    // publicações desaparecem com as notícias todas despublicadas.
    semNoticias.seniores = [];
    semNoticias.senioresInfo = { temporada: '', liga: '', treinador: '', treinos: '', estadio: '' };
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

    const av = await testarAgenda(browser, srv.url, false, 1440);
    verificar('agenda.html sem eventos: nenhum evento', av.eventos === 0, 'obtive ' + av.eventos);
    verificar('agenda.html sem eventos: aparece a mensagem de lista vazia', av.vazio);
    verificar('agenda.html sem eventos: sem botões de calendário', av.ics === 0);
    verificar('agenda.html sem eventos: sem transbordo', av.transbordo <= 0, '+' + av.transbordo + 'px');
    const ai = await testarPagina(browser, srv.url, false, 1440);
    verificar('página inicial sem eventos: nenhum cartão de agenda', ai.agendaCartoes === 0);
    verificar('página inicial sem eventos: aparece a mensagem de lista vazia', ai.agendaVazio);

    const qv = await testarEquipa(browser, srv.url, false, 1440);
    verificar('equipa: barra totalmente vazia não aparece',
      qv.infoItens === 0 && !qv.infoVisivel, 'itens ' + qv.infoItens + ', visível=' + qv.infoVisivel);
    verificar('equipa: plantel vazio mostra a mensagem e nenhum grupo',
      qv.jogadores === 0 && qv.grupos === 0 && qv.plantelVazio,
      'jogadores ' + qv.jogadores + ', grupos ' + qv.grupos + ', mensagem=' + qv.plantelVazio);
    verificar('equipa: sem publicações aparece o estado vazio e o botão sai',
      qv.posts === 0 && qv.postsVazio && !qv.botao,
      'publicações ' + qv.posts + ', vazio=' + qv.postsVazio + ', botão=' + qv.botao);
    verificar('equipa: sem transbordo no estado vazio', qv.transbordo <= 0, '+' + qv.transbordo + 'px');
    const qvJs = await testarEquipa(browser, srv.url, true, 1440);
    verificar('equipa: com JavaScript o estado vazio mantém-se, sem duplicar',
      qvJs.jogadores === 0 && qvJs.posts === 0 && qvJs.plantelVazio && qvJs.postsVazio
      && qvJs.infoItens === 0, 'jogadores ' + qvJs.jogadores + ', publicações ' + qvJs.posts);
    verificar('equipa: sem erros de consola no estado vazio',
      qvJs.erros.length === 0, qvJs.erros.join(' / '));

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
