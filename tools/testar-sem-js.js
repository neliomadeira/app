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
    { nome: 'modalidades',    ini: '<!-- JSC:modalidades:inicio -->',    fim: '<!-- JSC:modalidades:fim -->' },
    { nome: 'agenda',         ini: '<!-- JSC:agenda:inicio -->',         fim: '<!-- JSC:agenda:fim -->' },
    { nome: 'noticias',       ini: '<!-- JSC:noticias:inicio -->',       fim: '<!-- JSC:noticias:fim -->' },
    { nome: 'galeria',        ini: '<!-- JSC:galeria:inicio -->',        fim: '<!-- JSC:galeria:fim -->' },
    { nome: 'patrocinadores', ini: '<!-- JSC:patrocinadores:inicio -->', fim: '<!-- JSC:patrocinadores:fim -->' },
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
  'formacao.html': [
    { nome: 'escaloes', ini: '<!-- JSC:escaloes:inicio -->', fim: '<!-- JSC:escaloes:fim -->' },
  ],
  'patrocinadores.html': [
    { nome: 'patrocinadores-pagina', ini: '<!-- JSC:patrocinadores-pagina:inicio -->', fim: '<!-- JSC:patrocinadores-pagina:fim -->' },
  ],
  'galeria.html': [
    { nome: 'galeria-pagina', ini: '<!-- JSC:galeria-pagina:inicio -->', fim: '<!-- JSC:galeria-pagina:fim -->' },
  ],
  'videos.html': [
    { nome: 'videos', ini: '<!-- JSC:videos:inicio -->', fim: '<!-- JSC:videos:fim -->' },
  ],
  'historia.html': [
    { nome: 'historia', ini: '<!-- JSC:historia:inicio -->', fim: '<!-- JSC:historia:fim -->' },
    { nome: 'palmares', ini: '<!-- JSC:palmares:inicio -->', fim: '<!-- JSC:palmares:fim -->' },
  ],
};

// ---- Rodapé institucional e sitemap, acrescentados por ciclo ----------
// O rodapé institucional tem três regiões estreitas por página — redes,
// contactos e a linha de baixo — e são 48 entradas. Como no api/geracao.php,
// não se escrevem à mão: a lista de páginas fica explícita e as entradas saem
// de um ciclo. Sem isto, o conteúdo gerado do rodapé contava como "fora das
// marcas" e a comparação byte a byte acusava-o.
{
  const comRedes = ['index.html', 'noticias.html', 'agenda.html', 'equipa-principal.html',
                    'formacao.html', 'escalao.html', 'patrocinadores.html', 'galeria.html',
                    'videos.html', 'historia.html', 'modalidade.html', 'contacto.html',
                    'pesquisa.html', 'privacidade.html', 'resultados.html', 'atleta.html'];
  const comContacto = comRedes.filter((p) => p !== 'atleta.html');
  const comBase     = comRedes.concat(['inscricao.html']);
  const juntar = (pagina, nome) => {
    if (!BLOCOS[pagina]) BLOCOS[pagina] = [];
    BLOCOS[pagina].push({ nome, ini: `<!-- JSC:${nome}:inicio -->`, fim: `<!-- JSC:${nome}:fim -->` });
  };
  comRedes.forEach((p) => juntar(p, 'rodape-redes'));
  comContacto.forEach((p) => juntar(p, 'rodape-contacto'));
  comBase.forEach((p) => juntar(p, 'rodape-base'));
  BLOCOS['sitemap.xml'] = [
    { nome: 'sitemap', ini: '<!-- JSC:sitemap:inicio -->', fim: '<!-- JSC:sitemap:fim -->' },
  ];
}

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

// Todas as referências executáveis ao js/sync.js nas páginas de uma cópia.
//
// O js/sync.js é o único script do site que decide se o visitante vê conteúdo
// publicado ou conteúdo velho, e era o único sem marca de versão. Num telemóvel
// real, depois de um deploy, o Chrome continuou a executar a versão antiga que
// tinha na cache HTTP. A marca ?v=… no endereço é o que garante que um browser
// nessas condições vai buscar o ficheiro novo.
//
// Procura a tag <script> onde ela esteja, com qualquer caminho, para uma página
// nova que se esqueça da versão fazer a bateria falhar.
function referenciasSync(raiz) {
  const paginas = fs.readdirSync(raiz).filter((f) => f.endsWith('.html'));
  const comTag = [];
  const semVersao = [];
  const versoes = new Set();
  for (const f of paginas) {
    const html = fs.readFileSync(path.join(raiz, f), 'utf8');
    const tags = html.match(/<script[^>]+src="[^"]*sync\.js[^"]*"[^>]*>/g) || [];
    if (!tags.length) continue;
    comTag.push(f);
    for (const t of tags) {
      const m = t.match(/src="([^"]*sync\.js[^"]*)"/);
      const url = m ? m[1] : '';
      const v = url.match(/\?v=([0-9]+)/);
      if (v) versoes.add(v[1]);
      else semVersao.push(f + ' -> ' + url);
    }
  }
  return { paginas: paginas.length, comTag, semVersao, versoes: [...versoes] };
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
  const fmc = path.join(raiz, 'formacao.html');
  const pat = path.join(raiz, 'patrocinadores.html');
  const gal = path.join(raiz, 'galeria.html');
  const vid = path.join(raiz, 'videos.html');
  const his = path.join(raiz, 'historia.html');
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
  const antesFmc = fs.readFileSync(fmc, 'utf8');
  const antesPat = fs.readFileSync(pat, 'utf8');
  const antesGal = fs.readFileSync(gal, 'utf8');
  const antesVid = fs.readFileSync(vid, 'utf8');
  const antesHis = fs.readFileSync(his, 'utf8');
  // A ordem declarada no BLOCOS tem de ser a ordem em que as marcas aparecem
  // no ficheiro: é dela que o foraDasMarcas() depende para cortar o HTML.
  verificar('index.html tem as marcas das CINCO regiões, pela ordem do ficheiro',
    foraDasMarcas(antesIdx, 'index.html') !== null
    && BLOCOS['index.html'].every((b, i, todos) => i === 0
      || antesIdx.indexOf(todos[i - 1].ini) < antesIdx.indexOf(b.ini)));
  verificar('noticias.html tem as duas marcas', foraDasMarcas(antesNot, 'noticias.html') !== null);
  verificar('agenda.html tem as duas marcas', foraDasMarcas(antesAge, 'agenda.html') !== null);
  verificar('equipa-principal.html tem as marcas das TRÊS regiões',
    foraDasMarcas(antesEqp, 'equipa-principal.html') !== null
    && BLOCOS['equipa-principal.html'].every((b) => antesEqp.includes(b.ini) && antesEqp.includes(b.fim)));
  verificar('formacao.html tem as marcas da região dos escalões',
    foraDasMarcas(antesFmc, 'formacao.html') !== null
    && BLOCOS['formacao.html'].every((b) => antesFmc.includes(b.ini) && antesFmc.includes(b.fim)));

  // ---- Guarda da fonte única dos cartões de escalão ----------------
  // A formacao.html tinha oito cartões escritos à mão, com descrições,
  // frequências de treino e nomes de competições sem campo nenhum no painel.
  // Saíram, e esta verificação existe para não voltarem: um cartão aqui seria
  // visto por quem abrisse a página antes da primeira geração, e ficaria a
  // mostrar o que o painel já tinha mudado.
  //
  // Olha só para dentro da região escaloes da formacao.html. Não procura
  // textos concretos — procura a forma de um cartão publicado: o cartão, o
  // sítio onde cada campo é escrito, a ligação, e qualquer texto que não seja
  // o do estado vazio. Assim apanha também um cartão novo, de um escalão que
  // hoje ainda não existe.
  {
    const base = dentroDasMarcas(antesFmc, 'formacao.html', 'escaloes')
      .replace(/<!--[\s\S]*?-->/g, '');
    const classes = ['category-card', 'category-card__age', 'category-card__name',
                     'category-card__age-range', 'category-card__desc',
                     'category-card__list', 'category-card__badge', 'esc-link']
      .filter((c) => base.includes(c));
    const texto = base.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    verificar('grelha-base: a região no repositório é só a grelha com o estado vazio',
      /^\s*<div class="categories__grid" id="categoriesGrid">\s*<p class="jsc-vazio">[^<]*<\/p>\s*<\/div>\s*$/.test(base),
      'obtive: ' + JSON.stringify(base.trim().slice(0, 200)));
    verificar('grelha-base: nenhum cartão de escalão escrito à mão',
      classes.length === 0,
      'classes de cartão encontradas na região: ' + classes.join(', '));
    verificar('grelha-base: nenhuma ligação para escalao.html escrita à mão',
      !base.includes('escalao.html'));
    verificar('grelha-base: o único texto é o do estado vazio',
      texto === 'Escalões a atualizar.', 'texto encontrado: ' + JSON.stringify(texto.slice(0, 200)));
  }

  // ---- Guardas da galeria e dos vídeos -----------------------------
  // A página inicial tinha cinco fotografias escritas à mão, com legendas
  // inventadas, uma delas a afirmar um título distrital que o clube pode não
  // ter conquistado. A galeria.html tinha seis esqueletos de carregamento
  // permanentes. A videos.html ficava em branco. Nada disso pode voltar.
  {
    const base = dentroDasMarcas(antesIdx, 'index.html', 'galeria')
      .replace(/<!--[\s\S]*?-->/g, '').trim();
    verificar('galeria-base: a região da galeria do index.html está vazia',
      base === '', 'obtive: ' + JSON.stringify(base.slice(0, 200)));
  }
  {
    const base = dentroDasMarcas(antesGal, 'galeria.html', 'galeria-pagina')
      .replace(/<!--[\s\S]*?-->/g, '');
    const texto = base.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    verificar('galeria-base: nenhum esqueleto de carregamento na região',
      !base.includes('skeleton'), 'os esqueletos ficavam lá para sempre sem JavaScript');
    verificar('galeria-base: nenhuma fotografia escrita à mão na região',
      !base.includes('galeria-item') && !base.includes('galeria-placeholder'));
    verificar('galeria-base: o único texto da região é o do estado vazio',
      texto === '&#128247; Ainda não há fotos na galeria.', 'texto: ' + JSON.stringify(texto.slice(0, 200)));
  }
  {
    const base = dentroDasMarcas(antesVid, 'videos.html', 'videos')
      .replace(/<!--[\s\S]*?-->/g, '');
    const texto = base.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    verificar('videos-base: nenhum cartão de vídeo escrito à mão na região',
      !base.includes('video-card'));
    verificar('videos-base: nenhum <iframe> dentro da região',
      !/<iframe/i.test(base), 'o iframe do modal fica fora da região');
    verificar('videos-base: nenhuma ligação externa escrita à mão na região',
      !/href="https?:\/\//i.test(base));
    verificar('videos-base: o único texto da região é o do estado vazio',
      texto === '&#127909; Ainda não há vídeos publicados.Volte em breve!', 'texto: ' + JSON.stringify(texto.slice(0, 200)));
  }
  // As cinco legendas fictícias não podem existir em código público nenhum, e
  // o _escHtml duplicado também não.
  {
    const publicos = ['index.html', 'galeria.html', 'videos.html',
                      'js/main.js', 'js/galeria.js', 'js/videos.js'];
    const comFicticios = publicos.filter((rel) => /Treino Sub-17|Jogo Sub-13|Treino Sub-9|Campeão Distrital/.test(
      fs.readFileSync(path.join(RAIZ_PROJETO, rel), 'utf8').replace(/<!--[\s\S]*?-->/g, '')));
    verificar('fonte única: nenhuma fotografia fictícia em código público',
      comFicticios.length === 0, 'ficheiros: ' + comFicticios.join(', '));
    // Sem comentários: um comentário que explique o que saiu não é código.
    const semComentarios = (rel) => fs.readFileSync(path.join(RAIZ_PROJETO, rel), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '');
    const comEsc = ['js/galeria.js', 'js/videos.js'].filter((rel) =>
      /_escHtml/.test(semComentarios(rel)));
    verificar('fonte única: o _escHtml duplicado desapareceu',
      comEsc.length === 0, 'ficheiros: ' + comEsc.join(', '));
    const comYt = ['js/videos.js'].filter((rel) => /\.match\(\/\(\?:youtube/.test(semComentarios(rel)));
    verificar('fonte única: a extração do id do YouTube está centralizada',
      comYt.length === 0 && /function jscVideoId/.test(
        fs.readFileSync(path.join(RAIZ_PROJETO, 'js/html.js'), 'utf8')));
  }


  // ---- Guarda dos nomes de variáveis dos modelos -------------------
  // O jsc_gerar_bloco() faz extract($vars, EXTR_SKIP) antes do include, e tem no
  // seu âmbito as variáveis $nome, $b, $conteudo, $gerado, $erro, $indent,
  // $modelo, $saida, $vars, $marca e $e. Um modelo que peça uma variável com um
  // desses nomes recebe SILENCIOSAMENTE o valor do motor: o rodapé saiu com
  // "© 2026 rodape-base@index.html" porque pedia $nome.
  //
  // O $gerado é a excepção legítima: é o motor que o passa.
  //
  // O que se verifica são as CHAVES que o motor passa, e não as variáveis que os
  // modelos usam por dentro: um $e de um foreach é atribuído antes de ser lido e
  // não corre risco nenhum. O perigo é só na entrada.
  {
    const reservadas = ['nome', 'b', 'conteudo', 'erro', 'indent', 'modelo',
                        'saida', 'vars', 'marca', 'e'];
    const php = fs.readFileSync(path.join(RAIZ_PROJETO, 'api/geracao.php'), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '');
    // As chaves de todos os arrays devolvidos pelos 'dados' => function.
    const chaves = new Set();
    for (const m of php.matchAll(/'dados'\s*=>\s*function[\s\S]*?return\s*\[([\s\S]*?)\];/g)) {
      for (const k of m[1].matchAll(/'(\w+)'\s*=>/g)) chaves.add(k[1]);
    }
    verificar('modelos: o motor passa pelo menos uma chave a cada bloco',
      chaves.size >= 8, chaves.size + ' chaves: ' + [...chaves].join(', '));
    const colisoes = [...chaves].filter((k) => reservadas.includes(k));
    verificar('modelos: nenhuma chave passada aos modelos colide com o motor',
      colisoes.length === 0, 'colidem: ' + colisoes.join(', '));

    // A mesma armadilha existe no E2: o jsc_e2_bloco() do api/noticia.php faz o
    // mesmo extract(). Lá as variáveis locais levam prefixo jscE2 de propósito,
    // e é isso que se verifica — nenhuma variável local sem prefixo, e nenhuma
    // chave passada aos modelos a colidir com as que há.
    const e2 = fs.readFileSync(path.join(RAIZ_PROJETO, 'api/noticia.php'), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '');
    const corpoE2 = (e2.match(/function jsc_e2_bloco[\s\S]*?\n\}/) || [''])[0];
    const locaisE2 = [...new Set([...corpoE2.matchAll(/\$(\w+)/g)].map((m) => m[1]))]
      .filter((v) => !/^jscE2/.test(v));
    verificar('E2: todas as variáveis do jsc_e2_bloco() levam o prefixo jscE2',
      locaisE2.length === 0, 'sem prefixo: ' + locaisE2.join(', '));
    const chavesE2 = new Set();
    for (const m of e2.matchAll(/jsc_e2_bloco\(\s*'[^']+'\s*,\s*\[([\s\S]*?)\]\)/g)) {
      for (const k of m[1].matchAll(/'(\w+)'\s*=>/g)) chavesE2.add(k[1]);
    }
    verificar('E2: o jsc_e2_bloco() recebe chaves, e nenhuma colide com as suas variáveis',
      chavesE2.size >= 4 && [...chavesE2].every((k) => !/^jscE2/.test(k)),
      chavesE2.size + ' chaves: ' + [...chavesE2].join(', '));
  }

  // ---- Guardas dos dois números sem fonte da página inicial --------
  // "300+ Atletas" e "80+ Títulos" saíram da faixa da página inicial, por
  // decisão do clube, enquanto não houver fonte confirmada. Podem voltar por
  // quatro caminhos: escritos no HTML, escritos em JavaScript, como valor por
  // omissão do siteConfig no painel, ou na semente do data.js. Esta guarda
  // fecha os quatro. Sem comentários: explicar o que saiu não é publicá-lo.
  {
    const limpo = (rel) => fs.readFileSync(path.join(RAIZ_PROJETO, rel), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
    const fontes = ['index.html', 'js/main.js', 'js/site-config.js',
                    'admin/js/admin.js', 'admin/js/data.js'];
    const comNumeros = fontes.filter((rel) => /300\+|80\+/.test(limpo(rel)));
    verificar('estatisticas-base: nem 300+ nem 80+ em código público ou no painel',
      comNumeros.length === 0, 'ficheiros: ' + comNumeros.join(', '));
    const comRotulos = fontes.filter((rel) =>
      /Atletas Formados|Títulos Conquistados/.test(limpo(rel)));
    verificar('estatisticas-base: nem "Atletas Formados" nem "Títulos Conquistados"',
      comRotulos.length === 0, 'ficheiros: ' + comRotulos.join(', '));
    // O valor por omissão do siteConfig é o que o painel envia ao publicar: um
    // número aqui é um número publicado.
    const adm = limpo('admin/js/admin.js');
    verificar('estatisticas-base: o siteConfig não semeia os dois valores',
      /stat1Num:\s*''/.test(adm) && /stat4Num:\s*''/.test(adm)
      && /stat1Label:\s*''/.test(adm) && /stat4Label:\s*''/.test(adm),
      'os valores por omissão de stat1 e stat4 têm de estar vazios');
    // Os dois lugares continuam a existir e continuam administráveis: o que
    // mudou foi o valor, não a capacidade.
    const ind = fs.readFileSync(path.join(RAIZ_PROJETO, 'index.html'), 'utf8');
    verificar('estatisticas-base: os dois lugares vazios vêm escondidos do HTML',
      /<div class="stat" id="stat1" hidden>/.test(ind)
      && /<div class="stat" id="stat4" hidden>/.test(ind),
      'sem JavaScript é o hidden que evita o cartão vazio');
    // O número de escalões passou de 6 para 8 por confirmação do clube: a
    // semente tem oito (Sub-5 a Sub-19), o rodapé lista oito, e a descrição dos
    // dados estruturados diz "Sub-5 a Sub-19".
    verificar('estatisticas-base: os escalões dizem 8, e os anos ficaram como estavam',
      />8<\/span>\s*<span class="stat__label" id="stat2Label">Escalões</.test(ind)
      && />75\+<\/span>\s*<span class="stat__label" id="stat3Label">Anos de história</.test(ind));
    // A regra de esconder um cartão sem número existe num sítio só.
    const sc = fs.readFileSync(path.join(RAIZ_PROJETO, 'js/site-config.js'), 'utf8');
    verificar('estatisticas-base: a regra de esconder existe e é uma só',
      /function estatistica\(n\)/.test(sc)
      && /estatistica\(1\); estatistica\(2\); estatistica\(3\); estatistica\(4\);/.test(sc));
  }

  // ---- Guardas da História -----------------------------------------
  // As duas zonas mostravam "A carregar..." para sempre sem JavaScript, e os
  // 22 marcos e 16 títulos da história do clube ficavam invisíveis. E havia
  // TRÊS cópias completas desses 38 factos no código. Estas verificações
  // existem para nenhuma das duas coisas voltar.
  {
    const base = dentroDasMarcas(antesHis, 'historia.html', 'historia')
      .replace(/<!--[\s\S]*?-->/g, '');
    const texto = base.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    verificar('historia-base: a região da cronologia é só o contentor com o estado vazio',
      /^\s*<div class="timeline" id="historiaTimeline">\s*<p class="historia-empty">[^<]*<\/p>\s*<\/div>\s*$/.test(base),
      'obtive: ' + JSON.stringify(base.trim().slice(0, 200)));
    verificar('historia-base: nenhum marco escrito à mão na região',
      !base.includes('timeline-item') && !base.includes('timeline-card'),
      'os marcos vêm dos dados, nunca do HTML');
    verificar('historia-base: nenhum "A carregar" na região',
      !/A carregar/i.test(base), 'era uma promessa que sem JavaScript nunca se cumpria');
    verificar('historia-base: o único texto da região é o do estado vazio',
      texto === 'Sem marcos históricos registados.', 'texto: ' + JSON.stringify(texto.slice(0, 200)));
  }
  {
    const base = dentroDasMarcas(antesHis, 'historia.html', 'palmares')
      .replace(/<!--[\s\S]*?-->/g, '');
    const texto = base.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    verificar('palmares-base: a região do palmarés é só o contentor com o estado vazio',
      /^\s*<div class="palmares__grid" id="historiaPalmares">\s*<p class="historia-empty"[^>]*>[^<]*<\/p>\s*<\/div>\s*$/.test(base),
      'obtive: ' + JSON.stringify(base.trim().slice(0, 200)));
    verificar('palmares-base: nenhum título escrito à mão na região',
      !base.includes('palmares-card'), 'os títulos vêm dos dados');
    verificar('palmares-base: nenhum "A carregar" na região',
      !/A carregar/i.test(base));
    verificar('palmares-base: o único texto da região é o do estado vazio',
      texto === 'Sem títulos registados.', 'texto: ' + JSON.stringify(texto.slice(0, 200)));
  }
  // Os 38 factos não podem voltar a existir escritos no código público nem no
  // painel. A semente única é o admin/js/data.js.
  {
    const semComentarios = (rel) => fs.readFileSync(path.join(RAIZ_PROJETO, rel), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
    const copias = ['js/historia.js', 'admin/js/admin.js', 'js/pesquisa.js'].filter((rel) =>
      /DEFAULT_TIMELINE|DEFAULT_PALMARES|DEFAULT_HISTORIA|HISTORIA_SEED|PALMARES_SEED/.test(semComentarios(rel)));
    verificar('fonte única: as três cópias da história desapareceram',
      copias.length === 0, 'ficheiros: ' + copias.join(', '));
    // Nem os factos em si, fora da semente.
    const comFactos = ['js/historia.js', 'admin/js/admin.js', 'js/pesquisa.js',
                       'historia.html', 'index.html'].filter((rel) =>
      /Fundação do Clube|Pedro Correia Bota|Medalha Municipal de Mérito|Entidade Formadora/.test(semComentarios(rel)));
    verificar('fonte única: nenhum marco histórico escrito em código público',
      comFactos.length === 0, 'ficheiros: ' + comFactos.join(', '));
    // A semente existe, e está onde deve estar.
    const semente = fs.readFileSync(path.join(RAIZ_PROJETO, 'admin/js/data.js'), 'utf8');
    verificar('fonte única: a semente da história está no admin/js/data.js',
      /historia:\s*DEMO_DB\.historia/.test(semente) && /palmares:\s*DEMO_DB\.palmares/.test(semente));
    // E a regra do "ativo" vive num sítio só, nos dois lados.
    const html = fs.readFileSync(path.join(RAIZ_PROJETO, 'js/html.js'), 'utf8');
    const php  = fs.readFileSync(path.join(RAIZ_PROJETO, 'api/conteudo.php'), 'utf8');
    verificar('fonte única: jscMediaAtivo delega em jscAtivo, sem repetir a regra',
      /function jscMediaAtivo\(valor\) \{\s*return jscAtivo\(valor\);/.test(html)
      && /function jsc_media_ativo\(\$valor\) \{\s*return jsc_ativo\(\$valor\);/.test(php));
  }
  // Os números que o clube não confirma, e a frase do século, não voltam à
  // página de História. A faixa de estatísticas saiu inteira.
  {
    const semComentarios = antesHis.replace(/<!--[\s\S]*?-->/g, '');
    verificar('historia-base: a faixa de estatísticas sem fonte saiu',
      !semComentarios.includes('historia-strip') && !/hStat\d/.test(semComentarios),
      'os oito ids não eram escritos por ficheiro nenhum');
    const proibidos = ['80+', '300+', 'Mais de um século', 'Atletas Formados',
                       'Títulos Conquistados'].filter((t) => semComentarios.includes(t));
    verificar('historia-base: nenhum número sem fonte na historia.html',
      proibidos.length === 0, 'encontrados: ' + proibidos.join(', '));
    verificar('historia-base: a frase da idade do clube é "mais de sete décadas"',
      semComentarios.includes('Mais de sete décadas a formar campeões dentro e fora do campo'));
  }
  // Os exemplos do painel deixam de sugerir 1923 — um ano de fundação que não
  // é o do clube — e deixam de sugerir os números que o clube não confirma.
  {
    const adm = fs.readFileSync(path.join(RAIZ_PROJETO, 'admin/index.html'), 'utf8');
    verificar('admin-base: nenhum exemplo com 1923',
      !adm.includes('1923'), 'estava em quatro campos, um deles o do ano de fundação');
    const sugestoes = [/placeholder="300\+"/, /placeholder="80\+"/, /placeholder="100\+"/]
      .filter((r) => r.test(adm));
    verificar('admin-base: nenhum exemplo sugere um número não confirmado',
      sugestoes.length === 0);
    // O ano de fundação tem uma fonte única, e o JSON-LD lê-a de lá.
    const seo = fs.readFileSync(path.join(RAIZ_PROJETO, 'js/seo.js'), 'utf8');
    const conteudoPhp = fs.readFileSync(path.join(RAIZ_PROJETO, 'api/conteudo.php'), 'utf8');
    // Sem comentários: explicar que 1947 não volta como valor por omissão não é
    // escrever 1947 no código, e é a regra que os outros guardas já seguem.
    const seoCodigo = seo.replace(/^\s*\/\/.*$/gm, '');
    verificar('fonte única: o foundingDate vem do dados_clube.ano, nos dois lados',
      !/1947/.test(seoCodigo) && /dados_clube/.test(seo) && /org\.foundingDate = ano/.test(seo)
      && /function jsc_clube_ano/.test(conteudoPhp)
      && /\$org\['foundingDate'\] = \$ano/.test(conteudoPhp));
  }

  // ---- Guarda da fonte única das modalidades -----------------------
  // A página inicial tinha três cartões escritos à mão — Kickboxing, Judo e
  // Futsal, com as descrições — e ficavam lá sempre que a base estivesse
  // vazia. Esta verificação existe para não voltarem: nem eles, nem quaisquer
  // outros. Procura a forma, não os nomes: as classes de cartão, a ligação e
  // qualquer texto que não seja o do estado vazio.
  {
    const base = dentroDasMarcas(antesIdx, 'index.html', 'modalidades')
      .replace(/<!--[\s\S]*?-->/g, '');
    const texto = base.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const classes = ['modality-card', 'modality-card__name', 'modality-card__desc',
                     'modality-card__info', 'modality-card__icon', 'modality-card__link']
      .filter((c) => base.includes(c));

    verificar('grelha-base: a região das modalidades é só a grelha com o estado vazio',
      /^\s*<div class="modalities__grid" id="modalidadesGrid">\s*<p class="jsc-vazio">[^<]*<\/p>\s*<\/div>\s*$/.test(base),
      'obtive: ' + JSON.stringify(base.trim().slice(0, 200)));
    verificar('grelha-base: nenhum cartão de modalidade escrito à mão',
      classes.length === 0, 'classes encontradas: ' + classes.join(', '));
    verificar('grelha-base: nenhuma ligação para modalidade.html escrita à mão',
      !base.includes('modalidade.html'));
    verificar('grelha-base: o único texto da região é o do estado vazio',
      texto === 'Modalidades a atualizar.', 'texto: ' + JSON.stringify(texto.slice(0, 200)));
  }
  // As três modalidades não podem voltar a existir escritas no código. Nos
  // dados persistentes continuam, e é lá que devem estar.
  {
    const fontes = ['index.html', 'js/main.js', 'js/modalidade.js'].filter((rel) => {
      const c = fs.readFileSync(path.join(RAIZ_PROJETO, rel), 'utf8')
        .replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
      return /Kickboxing|Judo|Futsal/.test(c);
    });
    verificar('fonte única: nenhuma modalidade escrita no código público',
      fontes.length === 0, 'ficheiros: ' + fontes.join(', '));
  }

  // ---- Guardas da zona única dos patrocinadores --------------------
  // A página inicial tinha doze cartões escritos à mão, com nomes de empresas
  // que não existem, divididos por três níveis, e apareciam sempre que a base
  // estivesse vazia ou que um nível ficasse sem ninguém. A patrocinadores.html
  // não tinha nada: a zona era construída por um <script> inline, e sem
  // JavaScript a página ficava em branco. Estas verificações existem para
  // nenhuma das duas coisas voltar.
  //
  // Procuram a forma, não textos concretos: as classes de cartão, as classes
  // de nível, as ligações externas e o <script>. Um patrocinador cujo nome
  // contenha "Bronze" é conteúdo legítimo e não é o que se proíbe aqui.
  {
    const base = dentroDasMarcas(antesIdx, 'index.html', 'patrocinadores')
      .replace(/<!--[\s\S]*?-->/g, '');
    const texto = base.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const niveis = ['sponsors-tier', 'sponsor-card--', 'tier-label', '--ouro', '--prata', '--bronze']
      .filter((c) => base.includes(c));

    verificar('zona-base: a região do index.html é só a grelha com o estado vazio',
      /^\s*<div class="sponsors-row" id="sponsorsGrid">\s*<p class="jsc-vazio">[^<]*<\/p>\s*<\/div>\s*$/.test(base),
      'obtive: ' + JSON.stringify(base.trim().slice(0, 200)));
    verificar('zona-base: nenhum cartão de patrocinador escrito à mão',
      !base.includes('sponsor-card'), 'a região não pode trazer cartões');
    verificar('zona-base: nenhuma classe de nível na região do index.html',
      niveis.length === 0, 'classes de nível encontradas: ' + niveis.join(', '));
    verificar('zona-base: o único texto da região do index.html é o do estado vazio',
      texto === 'Patrocinadores a atualizar.', 'texto: ' + JSON.stringify(texto.slice(0, 200)));
  }
  {
    const base = dentroDasMarcas(antesPat, 'patrocinadores.html', 'patrocinadores-pagina')
      .replace(/<!--[\s\S]*?-->/g, '');
    const niveis = ['sp-tier', 'sp-card--', 'tier-label', '--ouro', '--prata', '--bronze']
      .filter((c) => base.includes(c));
    // Sem os comentários: um comentário que explique o que saiu não é código.
    const patSemComentarios = antesPat.replace(/<!--[\s\S]*?-->/g, '');

    verificar('zona-base: a região da patrocinadores.html não tem cartões',
      !base.includes('class="sp-card"') && !base.includes('sp-grid'));
    verificar('zona-base: nenhuma classe de nível na região da patrocinadores.html',
      niveis.length === 0, 'classes de nível encontradas: ' + niveis.join(', '));
    verificar('zona-base: nenhuma ligação externa escrita à mão na região',
      !/href="https?:\/\//i.test(base));
    verificar('zona-base: nenhum <script> dentro da região', !/<script/i.test(base));
    verificar('zona-base: a região traz o estado vazio e o convite final',
      base.includes('sp-empty') && base.includes('sp-cta'));
    verificar('a patrocinadores.html deixou de ter <script> inline',
      !/<script>[\s\S]*db_patrocinadores/.test(patSemComentarios)
      && !/getElementById\(.sponsorsContent.\)/.test(patSemComentarios)
      && antesPat.includes('js/patrocinadores.js'));
  }

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
  verificar('a geração escreveu as oito páginas',
    ['index.html', 'noticias.html', 'agenda.html', 'equipa-principal.html',
     'formacao.html', 'patrocinadores.html', 'galeria.html', 'videos.html']
      .every((f) => g.saida.includes(f)), g.saida.trim());

  const depoisHtml = fs.readFileSync(idx, 'utf8');
  const depoisNot  = fs.readFileSync(not, 'utf8');
  const depoisAge  = fs.readFileSync(age, 'utf8');
  const depoisEqp  = fs.readFileSync(eqp, 'utf8');
  const depoisFmc  = fs.readFileSync(fmc, 'utf8');
  const depoisPat  = fs.readFileSync(pat, 'utf8');
  const depoisGal  = fs.readFileSync(gal, 'utf8');
  const depoisVid  = fs.readFileSync(vid, 'utf8');

  // ---- 9 / E1-8. Comparação byte a byte do exterior a TODAS as marcas ----
  for (const [nome, antes, depois] of [
    ['index.html', antesIdx, depoisHtml],
    ['noticias.html', antesNot, depoisNot],
    ['agenda.html', antesAge, depoisAge],
    ['equipa-principal.html', antesEqp, depoisEqp],
    ['formacao.html', antesFmc, depoisFmc],
    ['patrocinadores.html', antesPat, depoisPat],
    ['galeria.html', antesGal, depoisGal],
    ['videos.html', antesVid, depoisVid],
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

  // ---- Bloco 4: os cartões dos escalões --------------------------
  const bEsc = dentroDasMarcas(depoisFmc, 'formacao.html', 'escaloes');
  // Contado a partir da fixture, não do que o gerador produziu: um escalão
  // sem nome não pode dar cartão.
  const escComNome = dados.escaloes.filter((e) => (e.nome || '').trim() !== '');

  verificar(`escalões: ${escComNome.length} cartões (o escalão sem nome é descartado)`,
    (bEsc.match(/<div class="category-card[ "]/g) || []).length === escComNome.length,
    'obtive ' + (bEsc.match(/<div class="category-card[ "]/g) || []).length);
  verificar('escalões: o escalão sem nome não foi escrito',
    !bEsc.includes('TESTE SEM NOME NAO APARECE'));
  verificar('escalões: os campos preenchidos aparecem',
    bEsc.includes('TESTE DESIGNACAO') && bEsc.includes('TESTE FAIXA')
    && bEsc.includes('TESTE DESCRICAO DO ESCALAO')
    && bEsc.includes('TESTE HORARIO DE TREINOS')
    && bEsc.includes('Treinador: TESTE TREINADOR'));
  verificar('escalões: competição e local aparecem quando preenchidos',
    bEsc.includes('TESTE COMPETICAO DO ESCALAO') && bEsc.includes('TESTE LOCAL DO ESCALAO')
    && bEsc.includes('TESTE SO COMPETICAO') && bEsc.includes('TESTE SO LOCAL'));
  verificar('escalões: nenhum elemento vazio de designação, faixa ou descrição',
    !bEsc.includes('<h3 class="category-card__name"></h3>')
    && !bEsc.includes('<p class="category-card__age-range"></p>')
    && !bEsc.includes('<p class="category-card__desc"></p>'));
  verificar('escalões: sem itens não há <ul>',
    (bEsc.match(/<ul class="category-card__list">/g) || []).length
      === dados.escaloes.filter((e) => (e.nome || '').trim() !== '' && (
        (e.treinos || '').trim() || (e.treinador || '').trim() || (e.competicao || '').trim()
        || (e.local || '').trim() || /^[1-9]\d*$/.test(String(e.atletas).trim()))).length);
  verificar('escalões: nenhuma lista vazia',
    !/<ul class="category-card__list">\s*<\/ul>/.test(bEsc));
  verificar('escalões: atletas > 0 aparece',
    bEsc.includes('12 atletas inscritos') && bEsc.includes('7 atletas inscritos'));
  verificar('escalões: atletas 0, "0", negativo e inválido não aparecem',
    !/\b0 atletas inscritos/.test(bEsc) && !/-3 atletas inscritos/.test(bEsc)
    && !bEsc.includes('muitos atletas'));
  verificar('escalões: o destaque produz badge e a classe do cartão',
    bEsc.includes('<div class="category-card category-card--featured">')
    && bEsc.includes('<div class="category-card__badge">Destaque</div>')
    && (bEsc.match(/category-card--featured/g) || []).length === 1);
  verificar('escalões: uma ligação por cartão',
    (bEsc.match(/<a href="escalao\.html\?escalao=/g) || []).length === escComNome.length);
  verificar('escalões: o nome com &, espaço e / é percent-encoded na ligação',
    bEsc.includes('href="escalao.html?escalao=TESTE%20A%26B%2FC%201"'));
  verificar('escalões: e escapado como texto no cartão',
    bEsc.includes('>TESTE A&amp;B/C 1<'));
  verificar('escalões: o data-itens corresponde aos cartões',
    bEsc.includes('data-itens="' + escComNome.length + '"'));
  verificar('escalões: nenhum atleta no bloco gerado',
    !bEsc.includes('TESTE ATLETA UM') && !bEsc.includes('TESTE ATLETA DOIS'));
  // "idade" não entra nesta lista: é subcadeia de modalidade, qualidade e
  // intensidade, palavras que o clube escreve no cartão. O marcador é a forma
  // estrutural data-idade. Ver api/geracao.php, validador dos escalões.
  verificar('escalões: nenhum dado pessoal no bloco gerado',
    ['dataNascimento', 'nascimento', 'data-idade', 'telefone', 'email', 'encarregado',
     'TESTE ENCARREGADO', '000000000'].every((x) => !bEsc.toLowerCase().includes(x.toLowerCase())));
  verificar('escalões: nenhum atleta em toda a formacao.html gerada',
    !depoisFmc.includes('TESTE ATLETA') && !depoisFmc.includes('TESTE ENCARREGADO'));

  // ---- Bloco 7: galeria e vídeos ----------------------------------
  const bGalI = dentroDasMarcas(depoisHtml, 'index.html', 'galeria');
  const bGalP = dentroDasMarcas(depoisGal, 'galeria.html', 'galeria-pagina');
  const bVid  = dentroDasMarcas(depoisVid, 'videos.html', 'videos');
  // Contado a partir da fixture. ativo ausente conta como publicado.
  const galFix = dados.galeria.filter((f) => f.ativo !== false
    && String(f.titulo || '').trim() !== '');
  const semUrlFix = galFix.filter((f) => {
    const u = String(f.url || '').trim();
    return u === '' || /^javascript:/i.test(u) || (/^data:/i.test(u) && !/^data:image\//i.test(u));
  }).length;
  const idYt = (u) => {
    const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  };
  const vidFix = dados.videos.filter((v) => v.ativo !== false
    && String(v.titulo || '').trim() !== '' && idYt(v.url) !== '');
  const PREVIA_GAL = 6;

  // -- galeria da página inicial --
  verificar(`galeria (inicial): ${Math.min(galFix.length, PREVIA_GAL)} cartões de prévia`,
    (bGalI.match(/<div class="gallery__item--img/g) || []).length === Math.min(galFix.length, PREVIA_GAL),
    'obtive ' + (bGalI.match(/<div class="gallery__item--img/g) || []).length);
  verificar('galeria (inicial): o data-itens conta a galeria completa',
    bGalI.includes('data-itens="' + galFix.length + '"'));
  verificar('galeria (inicial): a secção existe quando há fotografias',
    bGalI.includes('id="galeria"') && bGalI.includes('id="galleryGrid"'));
  verificar('galeria (inicial): o botão "Ver mais" aparece e é só com JavaScript',
    bGalI.includes('id="galleryMore"') && bGalI.includes('gallery__more jsc-so-com-js'));
  verificar('galeria (inicial): os filtros são só com JavaScript',
    bGalI.includes('gallery__filters jsc-so-com-js'));

  // -- galeria completa --
  verificar(`galeria (página): ${galFix.length} cartões, a lista completa`,
    (bGalP.match(/<div class="galeria-item"/g) || []).length === galFix.length,
    'obtive ' + (bGalP.match(/<div class="galeria-item"/g) || []).length);
  verificar(`galeria (página): ${semUrlFix} cartões de categoria (sem endereço utilizável)`,
    (bGalP.match(/galeria-placeholder galeria-placeholder--/g) || []).length === semUrlFix,
    'obtive ' + (bGalP.match(/galeria-placeholder galeria-placeholder--/g) || []).length);
  verificar('galeria: a fotografia com o fundo é um elemento, não texto',
    bGalP.includes('<div class="galeria-item__bg" style="background-image:url(')
    && !bGalP.includes('&lt;div class=&quot;galeria-item__bg'));
  verificar('galeria: o endereço com apóstrofo e parêntesis é percent-encoded',
    bGalP.includes("url('images/logo.png?x=a%27b%281%29')"));
  // Sem comentários: uma frase como "Só com JavaScript: ..." num comentário do
  // modelo não é um esquema de URL.
  const semCom = (t) => t.replace(/<!--[\s\S]*?-->/g, '');
  verificar('galeria: javascript: e data:text/html não chegam a nenhuma imagem',
    !/javascript:/i.test(semCom(bGalP)) && !/url\('data:text/i.test(semCom(bGalP))
    && !/javascript:/i.test(semCom(bGalI)) && !/url\('data:text/i.test(semCom(bGalI)),
    JSON.stringify((semCom(bGalI + bGalP).match(/.{0,50}javascript:.{0,30}/i) || [''])[0]));
  verificar('galeria: imgPos e imgSize são respeitados na página completa',
    bGalP.includes('background-size:contain') && bGalP.includes('background-position:top')
    && bGalP.includes('background-size:110%') && bGalP.includes('background-position:bottom'));
  verificar('galeria: imgPos e imgSize são respeitados na página inicial',
    bGalI.includes('background-size:contain') && bGalI.includes('background-position:top'));
  verificar('galeria: o título com & e <b> é escapado uma vez só',
    bGalP.includes('TESTE ESCAPE FOTO &amp; &lt;b&gt;B&lt;/b&gt;')
    && !bGalP.includes('&amp;amp;'));
  verificar('galeria: a inativa e a sem título não foram escritas',
    !bGalP.includes('NAO APARECE') && !bGalI.includes('NAO APARECE'));
  verificar('galeria: o estado vazio fica escondido quando há fotografias',
    bGalP.includes('id="galeriaEmpty" hidden'));
  verificar('galeria: os filtros da página são só com JavaScript',
    bGalP.includes('galeria-filter-bar jsc-so-com-js'));
  verificar('galeria: nenhum esqueleto de carregamento no HTML gerado',
    !bGalP.includes('skeleton') && !depoisGal.includes('class="skeleton'));

  // -- vídeos --
  verificar(`vídeos: ${vidFix.length} cartões (sem título ou sem id do YouTube saem)`,
    (bVid.match(/<a class="video-card"/g) || []).length === vidFix.length,
    'obtive ' + (bVid.match(/<a class="video-card"/g) || []).length);
  verificar('vídeos: o que não é do YouTube, o sem URL, o inativo e o sem título saem',
    !bVid.includes('NAO APARECE'));
  verificar('vídeos: os quatro formatos de endereço dão o id certo',
    ['dQw4w9WgXcQ', 'aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']
      .every((id) => bVid.includes('watch?v=' + id)));
  verificar('vídeos: cada cartão é uma ligação a sério para o YouTube',
    (bVid.match(/href="https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}"/g) || []).length === vidFix.length);
  verificar('vídeos: toda a miniatura vem do id validado',
    (bVid.match(/https:\/\/img\.youtube\.com\/vi\/[a-zA-Z0-9_-]{11}\/hqdefault\.jpg/g) || []).length === vidFix.length);
  verificar('vídeos: nenhum <iframe> dentro da região gerada',
    !/<iframe/i.test(bVid));
  verificar('vídeos: toda a miniatura tem alt com o título',
    /<img[^>]+alt="TESTE VIDEO COMPLETO"/.test(bVid));
  verificar('vídeos: o título com & e <b> é escapado uma vez só',
    bVid.includes('TESTE ESCAPE VIDEO &amp; &lt;b&gt;B&lt;/b&gt;') && !bVid.includes('&amp;amp;'));
  verificar('vídeos: o estado vazio fica escondido quando há vídeos',
    bVid.includes('id="videosEmpty" hidden'));
  verificar('vídeos: nenhum cartão sem miniatura',
    (bVid.match(/class="video-card__img"/g) || []).length === vidFix.length);

  // -- nenhum elemento vazio nem dado pessoal nas três zonas --
  for (const [nome, bloco] of [['galeria inicial', bGalI], ['galeria página', bGalP], ['vídeos', bVid]]) {
    verificar(`${nome}: nenhum elemento vazio`,
      !/<(span|p|h3)[^>]*>\s*<\/(span|p|h3)>/.test(bloco));
    verificar(`${nome}: nenhum campo pessoal`,
      ['dataNascimento', 'telefone', 'email', 'encarregado']
        .every((x) => !bloco.toLowerCase().includes(x.toLowerCase())));
  }

  // -- base vazia: a secção da inicial desaparece, as páginas dizem que não há --
  const semMedia = JSON.parse(JSON.stringify(dados));
  semMedia.galeria = [];
  semMedia.videos = [];
  escreverDados(raiz, semMedia);
  g = gerar(raiz);
  const vGalI = dentroDasMarcas(fs.readFileSync(idx, 'utf8'), 'index.html', 'galeria');
  const vGalP = dentroDasMarcas(fs.readFileSync(gal, 'utf8'), 'galeria.html', 'galeria-pagina');
  const vVid  = dentroDasMarcas(fs.readFileSync(vid, 'utf8'), 'videos.html', 'videos');
  verificar('galeria: sem fotografias a secção da página inicial desaparece por inteiro',
    g.estado === 0 && !vGalI.includes('id="galeria"')
    && vGalI.replace(/<!--[\s\S]*?-->/g, '').trim() === '',
    'região: ' + JSON.stringify(vGalI.replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 120)));
  verificar('galeria: sem fotografias a página mostra o estado vazio',
    vGalP.includes('Ainda não há fotos na galeria.')
    && !vGalP.includes('id="galeriaEmpty" hidden')
    && !vGalP.includes('galeria-item'));
  verificar('vídeos: sem vídeos a página mostra o estado vazio',
    vVid.includes('Ainda não há vídeos publicados.')
    && !vVid.includes('id="videosEmpty" hidden')
    && !vVid.includes('video-card'));
  verificar('base vazia: nenhuma das cinco legendas fictícias reaparece',
    !/Treino Sub-17|Jogo Sub-13|Treino Sub-9|Campeão Distrital/.test(
      fs.readFileSync(idx, 'utf8').replace(/<!--[\s\S]*?-->/g, '')));
  // Todos inativos: o mesmo que nenhum.
  const mediaInativa = JSON.parse(JSON.stringify(dados));
  mediaInativa.galeria.forEach((f) => { f.ativo = false; });
  mediaInativa.videos.forEach((v) => { v.ativo = false; });
  escreverDados(raiz, mediaInativa);
  g = gerar(raiz);
  verificar('galeria e vídeos: todos inativos dá o mesmo que nenhum',
    g.estado === 0
    && dentroDasMarcas(fs.readFileSync(idx, 'utf8'), 'index.html', 'galeria')
       .replace(/<!--[\s\S]*?-->/g, '').trim() === ''
    && !dentroDasMarcas(fs.readFileSync(gal, 'utf8'), 'galeria.html', 'galeria-pagina').includes('galeria-item')
    && !dentroDasMarcas(fs.readFileSync(vid, 'utf8'), 'videos.html', 'videos').includes('video-card'),
    g.saida.trim().slice(0, 160));
  escreverDados(raiz, dados);
  g = gerar(raiz);
  verificar('galeria e vídeos: a fixture completa volta a gerar sem erro', g.estado === 0,
    g.saida.trim().slice(0, 160));

  // ---- Bloco 6: modalidades ---------------------------------------
  const bMod = dentroDasMarcas(depoisHtml, 'index.html', 'modalidades');
  // Contado a partir da fixture: ativa (ausente conta como ativa) e com nome.
  const modFix = dados.modalidades.filter((m) => m.ativo !== false
    && String(m.nome || '').trim() !== '');
  const nomesMod = modFix.map((m) => m.nome.trim());
  const comItensMod = modFix.filter((m) => String(m.treinos || '').trim()
    || String(m.local || '').trim() || String(m.responsavel || '').trim()).length;

  verificar(`modalidades: ${modFix.length} cartões (inativa e sem nome descartadas)`,
    (bMod.match(/<div class="modality-card">/g) || []).length === modFix.length,
    'obtive ' + (bMod.match(/<div class="modality-card">/g) || []).length);
  verificar('modalidades: a inativa não foi escrita',
    !bMod.includes('TESTE INATIVA NAO APARECE') && !bMod.includes('TESTE DESC INATIVA'));
  verificar('modalidades: a modalidade sem nome e a de espaços foram descartadas',
    !bMod.includes('TESTE SEM NOME NAO APARECE') && !bMod.includes('TESTE NOME SO ESPACOS'));
  verificar('modalidades: a modalidade completa tem os três itens, nesta ordem',
    /TESTE HORARIO[\s\S]*TESTE LOCAL[\s\S]*TESTE RESPONSAVEL/.test(bMod));
  verificar('modalidades: campo vazio não produz elemento',
    !/<p class="modality-card__desc"><\/p>/.test(bMod)
    && !/<h3 class="modality-card__name"><\/h3>/.test(bMod));
  verificar(`modalidades: ${comItensMod} caixas de informação (sem itens não há caixa)`,
    (bMod.match(/<div class="modality-card__info">/g) || []).length === comItensMod,
    'obtive ' + (bMod.match(/<div class="modality-card__info">/g) || []).length);
  verificar('modalidades: nenhuma caixa de informação vazia',
    !/<div class="modality-card__info">\s*<\/div>/.test(bMod));
  verificar('modalidades: o ícone é escapado e marcado como decorativo',
    bMod.includes('aria-hidden="true">&lt;b&gt;&amp;x&lt;/b&gt;<')
    && (bMod.match(/class="modality-card__icon" aria-hidden="true"/g) || []).length === modFix.length);
  verificar('modalidades: sem ícone fica o de omissão',
    bMod.includes('aria-hidden="true">🏅<'));
  verificar('modalidades: a imagem com apóstrofo e parêntesis é percent-encoded',
    bMod.includes("url('images/logo.png?x=a%27b%281%29')"));
  verificar('modalidades: a imagemPos é respeitada',
    bMod.includes('background-position:top') && bMod.includes('background-position:bottom'));
  verificar('modalidades: sem imagem não há atributo style',
    (bMod.match(/<div class="modality-card__icon-wrap" style=/g) || []).length
      === modFix.filter((m) => String(m.imagem || '').trim() !== '').length);
  verificar('modalidades: uma ligação por cartão',
    (bMod.match(/<a href="modalidade\.html\?id=/g) || []).length === modFix.length);
  verificar('modalidades: o id com espaço, & e / é percent-encoded na ligação',
    bMod.includes('href="modalidade.html?id=609%20a%26b%2Fc"'));
  verificar('modalidades: o data-itens corresponde aos cartões',
    bMod.includes('data-itens="' + modFix.length + '"'));
  verificar('modalidades: nenhum contacto no bloco gerado',
    ['telefone', 'email', 'contacto'].every((x) => !bMod.toLowerCase().includes(x)));
  verificar('modalidades: a ordem publicada é a ordem dos dados',
    JSON.stringify((bMod.match(/<h3 class="modality-card__name">([^<]*)<\/h3>/g) || [])
      .map((m) => m.replace(/<[^>]*>/g, ''))) === JSON.stringify(nomesMod));

  // Com o db_modalidades vazio a grelha volta ao estado vazio, e nenhuma das
  // três modalidades pode reaparecer de um fallback.
  const semMod = JSON.parse(JSON.stringify(dados));
  semMod.modalidades = [];
  escreverDados(raiz, semMod);
  g = gerar(raiz);
  const modVazio = dentroDasMarcas(fs.readFileSync(idx, 'utf8'), 'index.html', 'modalidades');
  verificar('modalidades: sem modalidades há estado vazio e nenhum cartão',
    g.estado === 0 && modVazio.includes('jsc-vazio') && !modVazio.includes('modality-card'),
    g.saida.trim().slice(0, 160));
  verificar('modalidades: sem modalidades nenhuma das três reaparece',
    !/Kickboxing|Judo|Futsal/.test(modVazio));
  verificar('modalidades: sem modalidades o data-itens é 0',
    modVazio.includes('data-itens="0"'));
  // Todas inativas: o mesmo que nenhuma.
  const modInativas = JSON.parse(JSON.stringify(dados));
  modInativas.modalidades.forEach((m) => { m.ativo = false; });
  escreverDados(raiz, modInativas);
  g = gerar(raiz);
  verificar('modalidades: todas inativas dá o mesmo que nenhuma',
    g.estado === 0
    && dentroDasMarcas(fs.readFileSync(idx, 'utf8'), 'index.html', 'modalidades').includes('jsc-vazio'),
    g.saida.trim().slice(0, 160));
  escreverDados(raiz, dados);
  g = gerar(raiz);
  verificar('modalidades: a fixture completa volta a gerar sem erro', g.estado === 0,
    g.saida.trim().slice(0, 160));

  // ---- Bloco 5: patrocinadores ------------------------------------
  const bPatI = dentroDasMarcas(depoisHtml, 'index.html', 'patrocinadores');
  const bPatP = dentroDasMarcas(depoisPat, 'patrocinadores.html', 'patrocinadores-pagina');
  // Contado a partir da fixture: ativo em qualquer das formas verdadeiras, e
  // com nome. O tier não entra na conta — não entra em nada.
  const ativoFix = (v) => v === true || v === 1
    || (typeof v === 'string' && ['true', '1'].indexOf(v.trim().toLowerCase()) !== -1);
  const patFix = dados.patrocinadores.filter((p) => ativoFix(p.ativo)
    && String(p.nome || '').trim() !== '');
  const nomesPat = patFix.map((p) => p.nome.trim());
  const escapado = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  for (const [pagina, bloco, cartao] of [
    ['index.html', bPatI, 'sponsor-card'],
    ['patrocinadores.html', bPatP, 'sp-card'],
  ]) {
    const re = new RegExp('<(?:a|div) class="' + cartao + '[ "]', 'g');
    verificar(`patrocinadores (${pagina}): ${patFix.length} cartões numa grelha só`,
      (bloco.match(re) || []).length === patFix.length,
      'obtive ' + (bloco.match(re) || []).length);
    verificar(`patrocinadores (${pagina}): os inativos não foram escritos`,
      !bloco.includes('NAO APARECE'));
    verificar(`patrocinadores (${pagina}): nenhuma classe de nível`,
      ['--ouro', '--prata', '--bronze', 'sponsors-tier', 'sp-tier', 'tier-label']
        .every((c) => !bloco.includes(c)));
    verificar(`patrocinadores (${pagina}): o tier não saiu para o HTML`,
      !/\stier=|data-tier|"tier"/.test(bloco));
    verificar(`patrocinadores (${pagina}): o travessão do sector não é publicado`,
      !/>\s*[-—–]\s*</.test(bloco));
    verificar(`patrocinadores (${pagina}): o website sem esquema fica https`,
      bloco.includes('href="https://exemplo.invalido"'));
    verificar(`patrocinadores (${pagina}): javascript: e data: não produzem ligação`,
      !/javascript:/i.test(bloco) && !/href="data:/i.test(bloco));
    verificar(`patrocinadores (${pagina}): nenhum <a> de cartão sem href`,
      !new RegExp('<a class="' + cartao + '[^"]*"\\s*>').test(bloco));
    verificar(`patrocinadores (${pagina}): o logótipo tem alt com o nome`,
      /<img[^>]+alt="TESTE PATROCINADOR COMPLETO"/.test(bloco));
    verificar(`patrocinadores (${pagina}): o URL do logótipo com apóstrofo é escapado`,
      bloco.includes("images/logo.png?x=a&#039;b(1)"));
    verificar(`patrocinadores (${pagina}): o nome com & e <b> foi escapado`,
      bloco.includes(escapado('TESTE ESCAPE & <b>B</b>')));
    verificar(`patrocinadores (${pagina}): nenhum elemento vazio`,
      !/<(span|h3)[^>]*>\s*<\/(span|h3)>/.test(bloco));
    verificar(`patrocinadores (${pagina}): o data-itens corresponde aos cartões`,
      bloco.includes('data-itens="' + patFix.length + '"'));
  }

  verificar('patrocinadores: a página completa mostra sector, ano e botão do site',
    bPatP.includes('TESTE SECTOR') && bPatP.includes('Parceiro desde 2019')
    && bPatP.includes('class="sp-card__website"'));
  verificar('patrocinadores: ano inválido e curto não produzem linha',
    !bPatP.includes('Parceiro desde abc') && !bPatP.includes('Parceiro desde 26'));
  verificar('patrocinadores: "2019-05" dá o ano 2019',
    (bPatP.match(/Parceiro desde 2019/g) || []).length === 2);
  verificar('patrocinadores: iniciais quando não há logótipo',
    bPatP.includes('class="sp-card__initials">TS<'));
  verificar('patrocinadores: uma grelha só na página completa',
    (bPatP.match(/<div class="sp-grid">/g) || []).length === 1);
  verificar('patrocinadores: o convite final é gerado',
    bPatP.includes('class="sp-cta"') && bPatP.includes('Quer ser patrocinador?'));
  // Sem os comentários: o que conta é o que o visitante lê.
  const idxSemComentarios = depoisHtml.replace(/<!--[\s\S]*?-->/g, '');
  verificar('patrocinadores: os doze cartões fictícios saíram do index.html',
    !idxSemComentarios.includes('Parceiro Principal')
    && !idxSemComentarios.includes('Patrocinador Oficial')
    && !idxSemComentarios.includes('Apoiante Prata'));
  verificar('patrocinadores: o index.html não tem rótulos de nível em sítio nenhum',
    !idxSemComentarios.includes('sponsors-tier'));
  verificar('patrocinadores: a ordem publicada é a ordem dos dados',
    JSON.stringify((bPatP.match(/<h3 class="sp-card__name">([^<]*)<\/h3>/g) || [])
      .map((m) => m.replace(/<[^>]*>/g, ''))) === JSON.stringify(nomesPat.map(escapado)),
    'obtive: ' + JSON.stringify((bPatP.match(/<h3 class="sp-card__name">([^<]*)<\/h3>/g) || []).slice(0, 4)));
  verificar('patrocinadores: um nome que contém "Bronze" é conteúdo e é publicado',
    bPatP.includes('TESTE TIER BRONZE ANTIGO'));

  // Com o db_patrocinadores vazio as duas zonas voltam ao estado vazio.
  const semPatroc = JSON.parse(JSON.stringify(dados));
  semPatroc.patrocinadores = [];
  escreverDados(raiz, semPatroc);
  g = gerar(raiz);
  const vazioI = dentroDasMarcas(fs.readFileSync(idx, 'utf8'), 'index.html', 'patrocinadores');
  const vazioP = dentroDasMarcas(fs.readFileSync(pat, 'utf8'), 'patrocinadores.html', 'patrocinadores-pagina');
  verificar('patrocinadores: sem patrocinadores o index.html mostra o estado vazio',
    g.estado === 0 && vazioI.includes('jsc-vazio') && !vazioI.includes('sponsor-card'),
    g.saida.trim().slice(0, 160));
  verificar('patrocinadores: sem patrocinadores a página mostra o vazio e mantém o convite',
    vazioP.includes('sp-empty') && vazioP.includes('sp-cta')
    && !vazioP.includes('class="sp-card"'));
  verificar('patrocinadores: sem patrocinadores o data-itens é 0 nas duas',
    vazioI.includes('data-itens="0"') && vazioP.includes('data-itens="0"'));
  // Todos inativos: o mesmo que nenhum.
  const todosInativos = JSON.parse(JSON.stringify(dados));
  todosInativos.patrocinadores.forEach((p) => { p.ativo = false; });
  escreverDados(raiz, todosInativos);
  g = gerar(raiz);
  verificar('patrocinadores: todos inativos dá o mesmo que nenhum',
    g.estado === 0
    && dentroDasMarcas(fs.readFileSync(idx, 'utf8'), 'index.html', 'patrocinadores').includes('jsc-vazio')
    && !dentroDasMarcas(fs.readFileSync(pat, 'utf8'), 'patrocinadores.html', 'patrocinadores-pagina').includes('class="sp-card"'),
    g.saida.trim().slice(0, 160));
  escreverDados(raiz, dados);
  g = gerar(raiz);
  verificar('patrocinadores: a fixture completa volta a gerar sem erro', g.estado === 0,
    g.saida.trim().slice(0, 160));

  // Com o db_escaloes vazio a grelha volta ao estado vazio.
  const semEscaloes = JSON.parse(JSON.stringify(dados));
  semEscaloes.escaloes = [];
  escreverDados(raiz, semEscaloes);
  g = gerar(raiz);
  const fmcVazio = dentroDasMarcas(fs.readFileSync(fmc, 'utf8'), 'formacao.html', 'escaloes');
  verificar('escalões: sem escalões há estado vazio e nenhum cartão',
    g.estado === 0 && fmcVazio.includes('jsc-vazio')
    && !/<div class="category-card[ "]/.test(fmcVazio), g.saida.trim().slice(0, 160));
  verificar('escalões: sem escalões o data-itens é 0',
    fmcVazio.includes('data-itens="0"'));
  // Texto legítimo com "idade" lá dentro. A sentinela de dados pessoais
  // procurava a subcadeia "idade", e por isso parava a publicação em
  // modalidade, qualidade, intensidade e em "Idades 11-12" — justamente o que
  // se escreve na faixa de um escalão. O erro era
  //   formacao.html [escaloes]: o cartão de escalão não pode conter "idade"
  // com dados corretos no painel.
  const escIdade = JSON.parse(JSON.stringify(dados));
  escIdade.escaloes[0].faixa = 'Idades 11-12';
  escIdade.escaloes[0].descricao = 'Pratica da modalidade com qualidade e intensidade.';
  escreverDados(raiz, escIdade);
  g = gerar(raiz);
  const fmcIdade = dentroDasMarcas(fs.readFileSync(fmc, 'utf8'), 'formacao.html', 'escaloes');
  verificar('escalões: "Idades", modalidade e qualidade no texto publicam',
    g.estado === 0 && fmcIdade.includes('Idades 11-12')
    && fmcIdade.includes('modalidade') && fmcIdade.includes('qualidade'),
    g.saida.trim().slice(0, 160));

  // E a sentinela continua a morder nos marcadores a sério.
  for (const marcador of ['dataNascimento', 'encarregado', 'data-idade']) {
    const escFuga = JSON.parse(JSON.stringify(dados));
    escFuga.escaloes[0].descricao = 'TESTE ' + marcador + ' no sítio errado';
    escreverDados(raiz, escFuga);
    g = gerar(raiz);
    verificar('escalões: um "' + marcador + '" no bloco aborta a publicação',
      g.estado !== 0 && g.saida.includes('não pode conter "' + marcador + '"'),
      g.saida.trim().slice(0, 160));
  }

  // Volta a pôr a fixture completa para o resto dos testes.
  escreverDados(raiz, dados);
  g = gerar(raiz);
  verificar('escalões: a fixture completa volta a gerar sem erro', g.estado === 0,
    g.saida.trim().slice(0, 160));

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

  // O reverter passa a cobrir DEZENOVE alvos: as 17 páginas com rodapé gerado,
  // o sitemap.xml e o data/db.json. Era nove antes do Bloco 9, e a atomicidade
  // com este número nunca tinha sido exercitada — é o que se faz aqui.
  //
  // Rabisca-se TODOS, e exige-se que TODOS voltem. Um reverter que devolva
  // dezoito ficheiros e esqueça um é pior do que um que falhe: fica um site
  // metade numa versão e metade noutra.
  const alvos = Object.keys(BLOCOS)
    .filter((f) => fs.existsSync(path.join(raiz, f)))
    .map((f) => ({ nome: f, caminho: path.join(raiz, f) }));
  verificar('reverter: a transação cobre os 19 alvos',
    alvos.length === 18, alvos.length + ' ficheiros com regiões + data/db.json');

  for (const a of alvos) {
    const c = fs.readFileSync(a.caminho, 'utf8');
    // O sitemap é XML: o rabisco vai antes do fecho do urlset.
    const alvoTexto = a.nome.endsWith('.xml') ? '</urlset>' : '</body>';
    fs.writeFileSync(a.caminho, c.replace(alvoTexto, '<!-- rabisco -->' + alvoTexto));
  }
  g = gerar(raiz, ['--reverter']);
  verificar('reverter: corre sem erro e nomeia os 18 ficheiros com regiões',
    g.estado === 0 && alvos.every((a) => g.saida.includes(a.nome)),
    g.saida.trim().slice(0, 300));
  {
    const comRabisco = alvos.filter((a) => fs.readFileSync(a.caminho, 'utf8').includes('rabisco'));
    verificar('reverter: nenhum dos 18 ficou com o rabisco',
      comRabisco.length === 0, 'ficaram: ' + comRabisco.map((a) => a.nome).join(', '));
    const semRegioes = alvos.filter((a) => {
      const c = fs.readFileSync(a.caminho, 'utf8');
      return !BLOCOS[a.nome].every((b) => c.includes(b.ini) && c.includes(b.fim));
    });
    verificar('reverter: os 18 voltaram com todas as suas regiões de pé',
      semRegioes.length === 0, 'sem regiões: ' + semRegioes.map((a) => a.nome).join(', '));
    verificar('reverter: o sitemap.xml voltou e continua XML válido',
      /^<\?xml/.test(fs.readFileSync(path.join(raiz, 'sitemap.xml'), 'utf8'))
      && fs.readFileSync(path.join(raiz, 'sitemap.xml'), 'utf8').includes('</urlset>'));
    verificar('reverter: o diário foi fechado',
      !fs.existsSync(path.join(raiz, 'data', 'publicacao', 'transacao.json')));
  }
  const idxRevertido = fs.readFileSync(idx, 'utf8');
  verificar('reverter: e as duas regiões do index.html continuam de pé',
    foraDasMarcas(idxRevertido, 'index.html') !== null
    && BLOCOS['index.html'].every((b) => idxRevertido.includes(b.ini) && idxRevertido.includes(b.fim)));

  // As marcas do E2 não são regiões do E1, mas vivem no mesmo ficheiro: fazem
  // parte do que está FORA das regiões, e é por isso que o reverter as tem de
  // devolver intactas. Sem elas o api/noticia.php não tem onde escrever, e a
  // notícia individual deixava de ser servida depois de um reverter.
  {
    const notRevertido = fs.readFileSync(not, 'utf8');
    const marcasE2 = ['<!-- JSC:noticia-head:inicio -->', '<!-- JSC:noticia-head:fim -->',
                      '<!-- JSC:noticia-artigo:inicio -->', '<!-- JSC:noticia-artigo:fim -->'];
    const faltam = marcasE2.filter((m) => !notRevertido.includes(m));
    verificar('reverter: as marcas do E2 na noticias.html voltaram todas',
      faltam.length === 0, 'faltam: ' + faltam.join(', '));
    verificar('reverter: o contentor do artigo voltou vazio e escondido',
      /<!-- JSC:noticia-artigo:inicio -->\s*<div id="notArticle" hidden><\/div>\s*<!-- JSC:noticia-artigo:fim -->/
        .test(notRevertido));
  }

  // O reverter devolve as páginas a partir das cópias em
  // data/publicacao/anterior/, e essas cópias trazem o que a página era antes.
  // A versão do js/sync.js vive FORA das regiões geradas, por isso faz parte do
  // que o reverter tem de devolver intacto. Medido num cenário real: um
  // reverter feito com cópias guardadas ANTES de um deploy traz de volta as
  // tags sem versão, e a publicação seguinte parte desse ficheiro — a versão
  // ficava perdida.
  {
    const r = referenciasSync(raiz);
    verificar('reverter: as páginas voltaram com o sync.js versionado',
      r.comTag.length >= 17 && r.semVersao.length === 0,
      r.comTag.length + ' páginas, sem versão: ' + (r.semVersao.join(' | ') || 'nenhuma'));
  }

  // ---- Deixar a cópia no estado bom, com a fixture gerada --------
  fs.writeFileSync(idx, htmlBom);
  fs.writeFileSync(not, notBom);
  fs.writeFileSync(age, ageBom);
  fs.writeFileSync(eqp, eqpBom);
  escreverDados(raiz, dados);
  g = gerar(raiz);
  verificar('geração final para os testes de browser', g.estado === 0, g.saida.trim());

  // ---- A versão do sync.js sobrevive a uma publicação completa ----
  // A tag não é escrita por nenhum modelo nem pelo gerador: vive no HTML, fora
  // das marcas, e a publicação substitui só as regiões entre marcas. Isto
  // mede-o depois do caminho real do botão Publicar agora.
  {
    const r = referenciasSync(raiz);
    verificar('publicar: as páginas que carregam o sync.js, depois de publicar',
      r.comTag.length >= 17, r.comTag.length + ' de ' + r.paginas + ' páginas');
    verificar('publicar: nenhuma referência executável ao sync.js sem versão',
      r.semVersao.length === 0, r.semVersao.join(' | ') || 'nenhuma');
    verificar('publicar: uma só versão do sync.js em todas as páginas',
      r.versoes.length === 1, r.versoes.join(' | ') || '(nenhuma)');
    // Donde vem a tag: do HTML, e de nenhum outro sítio. Nenhum modelo do E1
    // escreve um <script src=…>, por isso a geração não tem como recriar uma
    // referência a um ficheiro JS — com ou sem versão. Os dois <script> que
    // existem nos modelos são type="application/ld+json", dados estruturados
    // sem src. Um modelo que passasse a escrever um src faz isto falhar.
    const modelos = fs.readdirSync(path.join(raiz, 'modelos')).filter((f) => f.endsWith('.php'));
    const comSrc = modelos.filter((f) =>
      /<script[^>]*\ssrc\s*=/i.test(fs.readFileSync(path.join(raiz, 'modelos', f), 'utf8')));
    verificar('publicar: nenhum modelo do E1 escreve um <script src=…>',
      modelos.length > 0 && comSrc.length === 0,
      modelos.length + ' modelos, com src: ' + (comSrc.join(', ') || 'nenhum'));
    verificar('publicar: o api/noticia.php (E2) também não escreve um <script src=…>',
      !/<script[^>]*\ssrc\s*=/i.test(fs.readFileSync(path.join(raiz, 'api', 'noticia.php'), 'utf8')));
  }
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

// Sonda da notícia individual — o E2.
//
// O endereço é sempre o público, noticias.html?id=N: é o Apache que o reescreve
// para o api/noticia.php, e é essa reescrita que se quer medir. Pedir o
// api/noticia.php à mão mediria outra coisa.
//
// Com `semE2: true` acrescenta-se &preview=0 ao endereço. O .htaccess exclui
// qualquer query com preview=, por isso o pedido NÃO passa pelo E2 e a página
// vem estática — e é o js/noticias.js que desenha o artigo. É assim que se
// comparam as duas versões do mesmo artigo.
async function testarNoticiaE2(browser, url, id, comJs, largura, opcoes = {}) {
  const ctx = await browser.newContext({
    javaScriptEnabled: comJs,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: largura, height: 900 });

  const erros = [];
  const ruido = (t) => RUIDO.some((r) => r.test(t));
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  // O 404 da notícia que não existe é a resposta certa, não um erro — e o
  // browser escreve-o também na consola, como "Failed to load resource".
  const esperado404 = (t) => opcoes.esperar404 && /404|Failed to load resource/i.test(t);
  pg.on('console', (m) => {
    if (m.type() === 'error' && !ruido(m.text()) && !esperado404(m.text())) erros.push(m.text());
  });
  pg.on('response', (r) => {
    const t = r.status() + ' ' + r.url().replace(url, '');
    if (r.status() >= 400 && !ruido(t) && !esperado404(t)) erros.push(t);
  });
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  const endereco = url + '/noticias.html?id=' + id + (opcoes.semE2 ? '&preview=0' : '');
  const resp = await pg.goto(endereco, { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });
  const estado = resp ? resp.status() : 0;
  const cabecalhos = resp ? resp.headers() : {};

  const d = await pg.evaluate(() => {
    const meta = (n) => { const e = document.querySelector('meta[name="' + n + '"]'); return e ? e.getAttribute('content') : null; };
    const prop = (n) => { const e = document.querySelector('meta[property="' + n + '"]'); return e ? e.getAttribute('content') : null; };
    const can  = document.querySelector('link[rel="canonical"]');
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden
                            && el.getClientRects().length > 0;
    const artigo = document.getElementById('notArticle');
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const artigoLd = ld.filter((e) => {
      try { return JSON.parse(e.textContent)['@type'] === 'NewsArticle'; } catch (_) { return false; }
    });

    // O HTML do artigo, normalizado para comparar: espaços colapsados, e os
    // espaços entre etiquetas fora. O que sobra é a marcação e o texto.
    const normalizar = (h) => String(h || '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s+"/g, '"')
      .trim();

    return {
      titulo: document.title,
      descricao: meta('description'),
      robots: meta('robots'),
      canonical: can ? can.getAttribute('href') : null,
      ogType: prop('og:type'),
      ogUrl: prop('og:url'),
      ogTitle: prop('og:title'),
      ogDesc: prop('og:description'),
      ogImage: prop('og:image'),
      ogSite: prop('og:site_name'),
      twCard: meta('twitter:card'),
      twTitle: meta('twitter:title'),
      twImage: meta('twitter:image'),
      nLd: ld.length,
      nLdArtigo: artigoLd.length,
      ldArtigo: artigoLd.length ? (() => { try { return JSON.parse(artigoLd[0].textContent); } catch (_) { return null; } })() : null,

      h1: Array.from(document.querySelectorAll('h1')).filter(visivel).map((e) => e.textContent.trim()),
      h1Artigo: Array.from(document.querySelectorAll('.news-article__title')).filter(visivel).map((e) => e.textContent.trim()),

      artigoVisivel: visivel(artigo),
      artigoHtml: artigo ? normalizar(artigo.innerHTML) : '',
      artigoTexto: artigo ? (artigo.textContent || '').replace(/\s+/g, ' ').trim() : '',
      dataId: artigo ? artigo.getAttribute('data-id') : null,
      dataGerado: artigo ? artigo.getAttribute('data-gerado') : null,
      dataEstado: artigo ? artigo.getAttribute('data-estado') : null,
      // O <b> do título de teste tem de ficar texto, nunca etiqueta.
      temTagB: !!(artigo && artigo.querySelector('.news-article__title b')),
      temScript: !!(artigo && artigo.querySelector('script')),
      temOnerror: /onerror|onload=/i.test(artigo ? artigo.innerHTML : ''),
      corpoHtml: (() => { const e = document.querySelector('.news-article__body'); return e ? normalizar(e.innerHTML) : ''; })(),
      imagens: document.querySelectorAll('.news-article__img').length,
      imagemClasse: (() => { const e = document.querySelector('.news-article__img'); return e ? e.className : ''; })(),

      voltar: (() => { const e = document.getElementById('notBack'); return e ? (e.getAttribute('href') || '(sem href)') : null; })(),
      voltarEhLigacao: (() => { const e = document.getElementById('notBack'); return !!e && e.tagName === 'A'; })(),
      ligacaoNoticias: Array.from(artigo ? artigo.querySelectorAll('a[href]') : [])
        .map((a) => a.getAttribute('href')).filter((h) => /^noticias\.html/.test(h)),
      relacionadas: document.querySelectorAll('.not-related__card').length,
      relacionadasLigacoes: Array.from(document.querySelectorAll('.not-related__link'))
        .map((a) => a.getAttribute('href')),
      partilha: document.querySelectorAll('#notArticle .news-share-btn').length,

      grelhaVisivel: visivel(document.getElementById('notGrid')),
      destaqueVisivel: visivel(document.getElementById('notFeatured')),
      filtrosVisivel: visivel(document.getElementById('notFilters')),
      vazioVisivel: visivel(document.getElementById('notEmpty')),
      maisVisivel: visivel(document.getElementById('notMoreWrap')),
      cartoes: document.querySelectorAll('#notGrid article.news-page__card').length,
      grelhaGerado: (() => { const e = document.getElementById('notGrid'); return e ? e.getAttribute('data-gerado') : null; })(),

      transbordo: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Se algum dos vectores de XSS do ensaio tivesse corrido, deixava aqui a
      // sua marca. É a verificação directa: não é só o HTML que não tem o
      // <script>, é que nada se executou.
      xss: typeof window.__xss,
    };
  });
  await ctx.close();
  return { ...d, estado, cabecalhos, erros };
}

// Sonda da projeção pública — o /api/load.php depois do Bloco 10.1.
//
// Pede-se o endpoint a sério, por HTTP, e mede-se o que ele entrega. É isso que
// conta: as páginas sempre filtraram o que mostram, o problema era o endpoint
// entregar o data/db.json inteiro a quem pedisse.
async function testarProjecaoPublica(url) {
  const r = await fetch(url + '/api/load.php');
  const bruto = await r.text();
  let dados = null;
  try { dados = JSON.parse(bruto); } catch (_) { dados = null; }
  return {
    estado: r.status,
    tipo: r.headers.get('content-type') || '',
    cache: r.headers.get('cache-control') || '',
    bruto,
    dados,
    chaves: dados && typeof dados === 'object' ? Object.keys(dados) : [],
  };
}

// Sonda do armazém do painel — a guarda B5.
//
// Semeia o localStorage ANTES de a página correr, como se fosse o browser de
// quem escreve, e vê o que sobra depois de o js/sync.js ter tido a sua
// oportunidade. É o teste que impede o apagamento de rascunhos.
async function testarArmazemDoPainel(browser, url, opcoes = {}) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  // Semeia-se UMA vez. O addInitScript corre em cada navegação, e o js/sync.js
  // recarrega a página quando escreve algo novo: sem esta guarda, a semente
  // voltava a entrar depois do reload e o teste media a sua própria semente em
  // vez de medir o que o sync.js tinha feito.
  await ctx.addInitScript((o) => {
    try {
      if (sessionStorage.getItem('jsc_teste_semeado')) return;
      sessionStorage.setItem('jsc_teste_semeado', '1');
      if (o.marca) localStorage.setItem('jsc_painel_local', '1');
      if (o.noticias) localStorage.setItem('jsc_noticias', JSON.stringify(o.noticias));
    } catch (_) {}
  }, { marca: !!opcoes.marca, noticias: opcoes.noticias || null });

  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + (opcoes.pagina || '/noticias.html'),
    { waitUntil: 'networkidle', timeout: 20000 });
  // O js/sync.js recarrega a página uma vez quando escreve algo novo. Dá-se-lhe
  // tempo para isso acontecer, senão media-se o estado antes da escrita.
  await pg.waitForTimeout(1200);

  const d = await pg.evaluate(() => {
    const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
    const noticias = ler('jsc_noticias');
    return {
      marca: (() => { try { return localStorage.getItem('jsc_painel_local'); } catch (_) { return null; } })(),
      nNoticias: Array.isArray(noticias) ? noticias.length : -1,
      titulos: Array.isArray(noticias) ? noticias.map((n) => n.titulo) : [],
      publicadoEm: (() => { try { return localStorage.getItem('jsc_publicado_em'); } catch (_) { return null; } })(),
      cartoesVisiveis: Array.from(document.querySelectorAll('#notGrid article.news-page__card'))
        .filter((e) => e.getClientRects().length > 0).length,
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// Sonda do orçamento do payload — a função que o painel corre antes de publicar.
// Mede-se na própria página do painel, que é onde ela vive.
async function testarOrcamentoDoPayload(browser, url) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate(() => {
    if (typeof avaliarTamanhoDoPayload !== 'function') return { existe: false };
    const imagem = (kb) => 'data:image/jpeg;base64,' + 'A'.repeat(kb * 1024);
    const comImagens = (n, kb) => Array.from({ length: n }, (_, i) =>
      ({ id: i, titulo: 'T' + i, publicada: true, imagem: imagem(kb) }));

    const pequeno = { noticias: comImagens(2, 20), agenda: [] };
    const medio   = { noticias: comImagens(20, 120), agenda: [] };
    const grande  = { noticias: comImagens(55, 120), agenda: [] };

    const avaliar = (d) => {
      const c = JSON.stringify(d);
      return { bytes: c.length, ...avaliarTamanhoDoPayload(c, d) };
    };
    return { existe: true, pequeno: avaliar(pequeno), medio: avaliar(medio), grande: avaliar(grande) };
  });
  await ctx.close();
  return { ...d, erros };
}

// Sonda dos selects de Escalão do painel.
//
// Os sete selects de escalão eram construídos com o markup do _escOpts()
// envolvido em jscEsc(): os < e os > ficavam escapados, o browser via texto, e um
// <select> não mostra texto — o campo Escalão abria VAZIO. E num select sem
// opções o .value é "", pelo que guardar um registo existente apagava o escalão
// que lá estava, mesmo sem tocar no campo.
//
// Mede-se no painel a sério, abrindo cada formulário e contando as opções.
async function testarSelectsDeEscalao(browser, url) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate(() => {
    const ler = (id) => {
      const el = document.getElementById(id);
      if (!el) return { existe: false, n: -1, nomes: [], valor: null };
      return {
        existe: true,
        n: el.options.length,
        nomes: Array.from(el.options).map((o) => o.textContent),
        valor: el.value,
        comMarkupVisivel: /&lt;option|<option/.test(el.textContent),
      };
    };
    const r = { noDB: (DB.escaloes || []).map((e) => e.nome) };

    document.getElementById('btnNovoAtleta').click();
    r.novoAtleta = ler('mEscalao');
    closeModal();

    DB.atletas.unshift({ id: 99001, nome: 'TESTE ATLETA SELECT', escalao: 'Sub-13' });
    editAtleta(99001);
    r.editarAtleta = ler('mEscalao');
    closeModal();

    _refreshEscalaoSelects();
    r.filtroJogos = ler('filterJogoEscalao');

    document.getElementById('btnNovoJogo').click();
    r.novoJogo = ler('mJEscalao');
    closeModal();

    DB.jogos.unshift({ id: 99002, escalao: 'Sub-15', data: '2026-01-01', casa: 'A', fora: 'B' });
    editJogo(99002);
    r.editarJogo = ler('mJEscalao');
    closeModal();

    editTreinador(-1);
    r.novoMembro = ler('mTEscalao');
    closeModal();

    DB.treinadores.unshift({ id: 99003, nome: 'TESTE MEMBRO SELECT', cargo: 'Treinador',
      escalao: 'Sub-17', desde: '2026', telefone: '', email: '', foto: '', ativo: true });
    editTreinador(0);
    r.editarMembro = ler('mTEscalao');
    // Guardar sem tocar no campo: o escalão não pode desaparecer.
    salvarTreinador(0);
    r.escalaoDepoisDeGuardar = DB.treinadores[0].escalao;

    editEvento(-1);
    r.novoEvento = ler('mEvEscalao');
    closeModal();

    DB.agenda.unshift({ id: 99004, titulo: 'TESTE EVENTO SELECT', escalao: 'Sub-19',
      data: '2026-01-01', tipo: 'Jogo' });
    editEvento(0);
    r.editarEvento = ler('mEvEscalao');
    closeModal();

    // Um nome de escalão com & : o escape passou a ser no texto da opção, e o
    // valor devolvido tem de continuar a ser o nome tal como está nos dados.
    DB.escaloes.unshift({ nome: 'TESTE A & B', designacao: '' });
    editTreinador(-1);
    const sel = document.getElementById('mTEscalao');
    const opt = Array.from(sel.options).find((o) => o.textContent.indexOf('&') !== -1);
    r.comAmp = opt ? { texto: opt.textContent, html: opt.innerHTML } : null;
    sel.value = 'TESTE A & B';
    r.valorComAmp = sel.value;
    closeModal();

    return r;
  });
  await ctx.close();
  return { ...d, erros };
}

// Sonda dos logótipos das equipas no resultados.html.
//
// O jogoLogo() devolve uma tag <img> já construída, com o endereço tratado pelo
// jscEscUrl(). Nos Próximos Jogos e nos Últimos Resultados o resultado ia
// envolvido em jscEsc(), e a tag aparecia como texto na página — mas só nas
// linhas onde nenhuma das equipas é o Campinense, porque o ramo do Campinense
// insere o markup directamente. Era por isso que a classificação à esquerda
// aparecia bem e a lista de jogos não.
async function testarLogotiposDeJogos(browser, url) {
  const LOGO = 'https://exemplo.test/logos/equipa.png';
  const MAU  = 'javascript:alert(1)';
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  // A marca do painel impede o js/sync.js de sobrepor a semente.
  await ctx.addInitScript((d) => {
    try {
      if (sessionStorage.getItem('jsc_semeado_jogos')) return;
      sessionStorage.setItem('jsc_semeado_jogos', '1');
      localStorage.setItem('jsc_painel_local', '1');
      localStorage.setItem('db_jogos', JSON.stringify(d.jogos));
    } catch (_) {}
  }, { jogos: [
    // Próximos: entre terceiros (com logótipo nos dois), com o Campinense,
    // entre terceiros sem logótipo nenhum, e um com endereço malicioso.
    { id:1, escalao:'Sub-17', data:'2099-03-01', hora:'15:00', casa:'TESTE LOULETANO', fora:'TESTE QUARTEIRENSE', estado:'Agendado', logoCasa:LOGO, logoFora:LOGO },
    { id:2, escalao:'Sub-17', data:'2099-03-02', hora:'16:00', casa:'Sport Campinense', fora:'TESTE LAGOS',       estado:'Agendado', logoCasa:'',   logoFora:LOGO },
    { id:3, escalao:'Sub-17', data:'2099-03-03', hora:'17:00', casa:'TESTE OLHANENSE',  fora:'TESTE FARENSE',      estado:'Agendado', logoCasa:'',   logoFora:'' },
    { id:4, escalao:'Sub-17', data:'2099-03-04', hora:'18:00', casa:'TESTE MAU',        fora:'TESTE PIOR',         estado:'Agendado', logoCasa:MAU,  logoFora:MAU },
    // Últimos: o mesmo padrão, já realizados.
    { id:5, escalao:'Sub-17', data:'2020-02-01', hora:'15:00', casa:'TESTE LOULETANO', fora:'TESTE QUARTEIRENSE', estado:'Realizado', gcasa:2, gfora:1, logoCasa:LOGO, logoFora:LOGO },
    { id:6, escalao:'Sub-17', data:'2020-02-02', hora:'16:00', casa:'Sport Campinense', fora:'TESTE LAGOS',       estado:'Realizado', gcasa:3, gfora:0, logoCasa:'', logoFora:LOGO },
  ] });

  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
  await pg.waitForTimeout(900);

  const d = await pg.evaluate(() => {
    const ver = (id) => {
      const el = document.getElementById(id);
      if (!el) return { existe: false };
      const imgs = Array.from(el.querySelectorAll('img.jogo-team-logo'));
      return {
        existe: true,
        linhas: el.querySelectorAll('.jogo-item').length,
        imgs: imgs.length,
        srcs: imgs.map((i) => i.getAttribute('src')),
        markupVisivel: /<img|&lt;img/.test(el.textContent),
        texto: el.textContent.replace(/\s+/g, ' ').trim(),
      };
    };
    return { prox: ver('proximosJogos'), ultimos: ver('resultadosJogos') };
  });
  await ctx.close();
  return { LOGO, MAU, ...d, erros };
}

// Sonda da contagem decrescente do "Próximo Jogo" na página inicial.
//
// As quatro caixas vinham do cdBox(), que devolve markup, e iam envolvidas em
// jscEsc(): apareciam como texto, e os <span id="jdDias"> nunca existiam — o
// setN() do temporizador não encontrava nada e a contagem nunca contava, em
// silêncio, porque tem um if (el).
async function testarContagemDecrescente(browser, url) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  await ctx.addInitScript(() => {
    try {
      if (sessionStorage.getItem('jsc_semeado_cd')) return;
      sessionStorage.setItem('jsc_semeado_cd', '1');
      localStorage.setItem('jsc_painel_local', '1');
      const cfg = JSON.parse(localStorage.getItem('site_config') || '{}');
      cfg.jogoDestaqueAtivo = true;
      localStorage.setItem('site_config', JSON.stringify(cfg));
      localStorage.setItem('db_agenda', JSON.stringify([{
        id: 97001, titulo: 'TESTE JOGO DESTAQUE', tipo: 'Jogo', estado: 'Agendado',
        data: '2099-05-04', hora: '20:30', local: 'TESTE CAMPO', escalao: 'Sub-17',
      }]));
    } catch (_) {}
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/index.html', { waitUntil: 'load', timeout: 20000 });
  await pg.waitForTimeout(600);

  const ler = () => pg.evaluate(() => {
    const w = document.getElementById('jogoDestaqueWidget');
    const val = (id) => { const e = document.getElementById(id); return e ? e.textContent : null; };
    return {
      caixas: w ? w.querySelectorAll('div[style*="min-width:52px"]').length : -1,
      markupVisivel: w ? /<div|&lt;div/.test(w.textContent) : false,
      dias: val('jdDias'), horas: val('jdHoras'), min: val('jdMin'), seg: val('jdSeg'),
    };
  });
  const antes = await ler();
  await pg.waitForTimeout(1400);
  const depois = await ler();
  await ctx.close();
  return { antes, depois, erros };
}

// Sonda da ordem dos escalões na resultados.html.
//
// Os separadores estavam na ordem Sub-17, Sub-15, Sub-13, Sub-19, Sub-11, que
// não é ordem nenhuma. Passam a estar por idade, do mais velho para o mais
// novo. Mede-se em desktop e em telemóvel, e confirma-se que o escalão
// selecionado continua a ser o que o js/resultados.js abre por omissão e que
// clicar num separador continua a mudar de escalão.
async function testarOrdemDosEscaloes(browser, url, largura) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    viewport: { width: largura, height: 900 },
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('jsc_painel_local', '1'); } catch (_) {}
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
  await pg.waitForTimeout(500);

  const ler = () => pg.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.tabs-inner .tab'));
    return {
      ordem: tabs.map((b) => b.dataset.escalao),
      textos: tabs.map((b) => b.textContent.trim()),
      ativo: (tabs.find((b) => b.classList.contains('active')) || {}).dataset
        ? tabs.find((b) => b.classList.contains('active')).dataset.escalao : null,
      escalaoActivo: typeof escalaoActivo !== 'undefined' ? escalaoActivo : null,
      // Nenhum separador pode ficar escondido ou com altura zero.
      visiveis: tabs.filter((b) => b.offsetWidth > 0 && b.offsetHeight > 0).length,
    };
  });

  const inicial = await ler();
  // Clicar no primeiro separador e ver se a navegação continua a funcionar.
  await pg.click('.tabs-inner .tab[data-escalao="Sub-19"]');
  await pg.waitForTimeout(300);
  const depoisDoClique = await ler();
  await ctx.close();
  return { inicial, depoisDoClique, erros };
}

// Sonda do parser da classificação: o caso AABV.
//
// A tabela da Liga 1 do Algarve tem 12 equipas e a pré-visualização dizia 11:
// a AABV desaparecia, porque são quatro maiúsculas e o parser recusava-as como
// se fossem a sigla da coluna. E, perdida essa linha, a posição da seguinte
// deixava de ser retirada da sequência — o corte dependia de "linhas aceites
// até agora + 1" — a leitura J-primeiro falhava a sanidade e o recurso
// "Pts primeiro" lia a POSIÇÃO como pontos: AEF Faro com 8, Ginásio de Tavira
// com 9, Montenegro com 10, Ferreiras com 11.
async function testarClassificacaoColada(browser, url, casos) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
  const lidos = await pg.evaluate((cs) => {
    localStorage.setItem('jsc_painel_local', '1');
    return cs.map((c) => {
      try {
        return parsePastedTable(c.texto).map((x) => ({
          equipa: x.equipa, j: x.j, v: x.v, e: x.e, d: x.d, gm: x.gm, gs: x.gs, pts: x.pts,
        }));
      } catch (e) { return [{ erro: e.message }]; }
    });
  }, casos);
  await ctx.close();
  return { lidos, erros };
}

// Sonda do despacho dos parsers de jogos.
//
// O parsePastedJogos() oferece a colagem ao parseZZJogos() primeiro, e este
// assumia que a data abre o bloco — data, [hora], casa, resultado ou «–», fora
// — com o passo do resultado opcional. Numa colagem do AF Algarve, que tem a
// casa ANTES da data (casa, data, hora, fora, recinto), lia a visitante como
// casa e o RECINTO como visitante, e a equipa da casa desaparecia. Medido em
// sete formas; o parseMultiLineJogos() lia-as todas bem, incluindo o recinto.
//
// Passou a exigir uma de duas provas: resultado ou separador entre as equipas,
// ou a data a abrir o bloco. Mede-se pelo despacho, que é o que o painel usa.
async function testarColagemDeJogos(browser, url, casos) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
  const lidos = await pg.evaluate((cs) => {
    localStorage.setItem('jsc_painel_local', '1');
    return cs.map((c) => {
      try {
        return parsePastedJogos(c.texto).map((j) => ({
          casa: j.casa, fora: j.fora, local: j.local || '', estado: j.estado,
          gcasa: j.gcasa, gfora: j.gfora, hora: j.hora,
        }));
      } catch (e) { return [{ erro: e.message }]; }
    });
  }, casos);
  await ctx.close();
  return { lidos, erros };
}

// Sonda das marcas (C) e (F) na colagem de jogos.
//
// O AF Algarve publica o calendário do clube com (C) quando o clube joga em
// casa e (F) quando joga fora, colado ao nome. Nenhum dos quatro parsers a
// tratava: a marca ficava no nome — e "Silves (F)" nunca bate com a chave do
// db_logos —, com (F) na casa os lados ficavam trocados, e nos realizados o
// resultado invertia-se com eles. Quando a fonte escreve só a marca, o campo
// ficava "(F)" e o nome do clube desaparecia.
//
// Mede-se pelo despacho, que é o que o painel usa, e com o dados_clube semeado
// para provar de onde vem o nome reconstruído.
async function testarMarcasCasaFora(browser, url, casos) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
  const lidos = await pg.evaluate((cs) => {
    localStorage.setItem('jsc_painel_local', '1');
    return cs.map((c) => {
      if (c.clube === null) localStorage.removeItem('dados_clube');
      else localStorage.setItem('dados_clube', JSON.stringify({ nome: c.clube || 'Juventude Sport Campinense' }));
      try {
        return parsePastedJogos(c.texto).map((j) => ({
          casa: j.casa, fora: j.fora, local: j.local || '', estado: j.estado,
          gcasa: j.gcasa, gfora: j.gfora, hora: j.hora, data: j.data,
          campos: Object.keys(j).sort().join(','),
        }));
      } catch (e) { return [{ erro: e.message }]; }
    });
  }, casos);
  await ctx.close();
  return { lidos, erros };
}

// Sonda do local no cartão de jogo.
//
// Cada cartão mostrava o nome da equipa duas vezes — "Silves … Silves",
// "Portimonense B … Portimonense B" —, uma do jogoEquipasHtml() e outra do
// .jogo-meta, que mostra o j.local. O local vinha com o nome de uma equipa do
// parseMultiLineJogos(), que toma a linha seguinte à equipa visitante como
// recinto quando não consegue provar que ela é do jogo seguinte. Medido com um
// db_jogos em que casa e fora são sempre diferentes: a repetição era toda do
// local. A correcção é de apresentação — o jogoLocalHtml() não desenha o local
// quando ele é igual a uma das equipas — e o parser e os dados ficam como estão.
async function testarLocalDosJogos(browser, url, jogos) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  await ctx.addInitScript((d) => {
    try {
      if (sessionStorage.getItem('jsc_semeado_local')) return;
      sessionStorage.setItem('jsc_semeado_local', '1');
      localStorage.setItem('jsc_painel_local', '1');
      localStorage.setItem('db_jogos', JSON.stringify(d));
    } catch (_) {}
  }, jogos);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
  await pg.waitForTimeout(700);
  const d = await pg.evaluate(() => {
    const ler = (id) => Array.from(document.querySelectorAll('#' + id + ' .jogo-item')).map((it) => {
      const meta = it.querySelector('.jogo-meta');
      const lado = it.querySelector('.jogo-lado');
      return {
        equipas: Array.from(it.querySelectorAll('.jogo-equipa')).map((e) => e.textContent.trim()),
        meta: meta ? meta.textContent.trim() : null,
        texto: it.textContent.replace(/\s+/g, ' ').trim(),
        etiqueta: lado ? lado.textContent.trim() : '',
        temVS: !!it.querySelector('.vs'),
      };
    });
    return { prox: ler('proximosJogos'), ultimos: ler('resultadosJogos') };
  });
  await ctx.close();
  return { ...d, erros };
}

// Sonda das sugestões dos campos do editor e da colagem.
//
// O campo Forma tinha placeholder="VVEDV" — uma sequência de forma válida. Um
// campo vazio aparecia com "VVEDV" em cinzento e lia-se como valor gravado: a
// coluna Forma do site parecia estar preenchida no painel e vazia na página, e
// foram três diagnósticos a perseguir uma perda de dados que não existia, até
// medir que input.value era "" e o VVEDV era a sugestão. O mesmo valia para o
// "0" da caixa dos pontos da 1ª fase.
//
// A regra que isto fixa: nenhuma sugestão destes campos pode ser um valor
// válido para o campo onde está.
async function testarSugestoesDosCampos(browser, url) {
  const SERIE = 'Liga_1_Algarve_Futeb';
  const LINHAS = [
    { equipa: 'TESTE SEM FORMA', abrev: 'TSF', j: 10, v: 8, e: 1, d: 1, gm: 25, gs: 8, dg: 17, pts: 25, forma: '' },
    { equipa: 'TESTE COM FORMA', abrev: 'TCF', j: 10, v: 6, e: 2, d: 2, gm: 20, gs: 12, dg: 8, pts: 20, forma: 'VVEDV' },
  ];
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate((a) => {
    localStorage.setItem('jsc_painel_local', '1');
    localStorage.setItem('fpf_class_Sub-17__' + a.serie, JSON.stringify(a.linhas));
    localStorage.setItem('fpf_sync_config', JSON.stringify({
      'Sub-17': { teams: { [a.serie]: { nome: 'Liga 1 Algarve Futebol Juvenis' } } },
    }));

    // 1. O campo Forma do editor manual.
    abrirEditorClass('Sub-17', a.serie);
    const ler = (i) => ({
      valor: i.value,
      placeholder: i.getAttribute('placeholder'),
      // O que uma pessoa vê: o valor, ou a sugestão quando o campo está vazio.
      oQueSeVe: i.value === '' ? i.getAttribute('placeholder') : i.value,
    });
    const forma = Array.from(document.querySelectorAll('#edClassTable .ed-forma')).map(ler);
    closeModal();

    // 2. A caixa dos pontos da 1ª fase, na pré-visualização da colagem.
    abrirColar('Sub-17', 'class', a.serie);
    document.getElementById('colarClassTA').value =
      'TESTE SEM FORMA\t10\t8\t1\t1\t25\t8\t17\t25\n'
      + 'TESTE COM FORMA\t10\t6\t2\t2\t20\t12\t8\t20\n';
    previewColarClass();
    const inputs = Array.from(document.querySelectorAll('[data-pts1fase]'));
    if (inputs[1]) inputs[1].value = '6';   // um preenchido, para comparar
    const pts1 = inputs.map(ler);

    return { forma, pts1 };
  }, { serie: SERIE, linhas: LINHAS });

  await ctx.close();
  return { ...d, erros };
}

// Sonda do botão «✎ Manual» do cabeçalho do escalão.
//
// Passava sempre a série vazia, escrita no markup, e abria fpf_class_<escalao>
// mesmo com séries configuradas. A página pública lê a série: o
// renderTeamSelector() põe o teamActivo na única série e esconde a barra.
// Medido em produção e reproduzido aqui: escrever a forma por este botão criava
// um fpf_class_Sub-17 paralelo com uma linha "Sport Campinense", a série ficava
// intacta, e a classificação pública continuava com zero círculos de forma.
//
// Clica-se no botão a sério, encontrado pelo rótulo, para a medição ser do que
// o painel oferece a quem o usa — e não da função que lhe está por baixo.
async function testarBotaoManual(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

    const noPainel = await pg.evaluate((a) => {
      localStorage.setItem('jsc_painel_local', '1');
      Object.keys(localStorage).filter((k) => k.indexOf('fpf_class_') === 0)
        .forEach((k) => localStorage.removeItem(k));
      Object.entries(a.chaves).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
      localStorage.setItem('fpf_sync_config', JSON.stringify(a.cfg));
      renderClassSyncRows();

      // O cabeçalho do escalão é a linha azul; o «Manual» é o único botão com
      // esse rótulo, e os «✎» das séries estão nas linhas de baixo.
      // Só os botões do Sub-17: a tabela lista todos os escalões, e os outros
      // — sem séries — também têm o seu «Manual». Sem este filtro a sonda
      // contava quatro "Manual" e media outra coisa; medido ao falhar.
      const doSub17 = (b) => /abrirEditorClass\('Sub-17'/.test(b.getAttribute('onclick') || '');
      const botoes = Array.from(document.querySelectorAll('#fpfSyncRows button')).filter(doSub17);
      const manual = botoes.filter((b) => /Manual/.test(b.textContent));
      const porSerie = botoes.filter((b) => !/Manual/.test(b.textContent)
        && /abrirEditorClass\('Sub-17','.+'\)/.test(b.getAttribute('onclick') || ''));
      const r = {
        temManual: manual.length === 1,
        nManual: manual.length,
        onclickManual: manual.length ? manual[0].getAttribute('onclick') : null,
        nBotoesPorSerie: porSerie.length,
      };
      if (!manual.length) return r;

      manual[0].click();
      r.ctxEditor = { escalao: _edClassCtx.escalao, teamKey: _edClassCtx.teamKey };
      r.chaveDoEditor = _edClassCtx.teamKey
        ? 'fpf_class_' + _edClassCtx.escalao + '__' + _edClassCtx.teamKey
        : 'fpf_class_' + _edClassCtx.escalao;
      r.nomesNoEditor = Array.from(document.querySelectorAll('#edClassTable .ed-equipa')).map((i) => i.value);
      const campo = document.querySelector('#edClassTable .ed-forma');
      if (campo) campo.value = 'VVEDV';
      salvarEditorClass();
      r.chavesDepois = {};
      Object.keys(localStorage).filter((k) => k.indexOf('fpf_class_') === 0).sort().forEach((k) => {
        try {
          r.chavesDepois[k] = JSON.parse(localStorage.getItem(k)).map((x) => x.equipa + '=' + JSON.stringify(x.forma));
        } catch (_) { r.chavesDepois[k] = '(ilegível)'; }
      });
      return r;
    }, c);

    let publico = null;
    await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
    await pg.waitForTimeout(700);
    publico = await pg.evaluate(() => ({
      teamActivo: typeof teamActivo !== 'undefined' ? teamActivo : '(?)',
      chaveDaPagina: typeof teamActivo !== 'undefined' && teamActivo
        ? 'fpf_class_' + escalaoActivo + '__' + teamActivo
        : 'fpf_class_' + escalaoActivo,
      linhas: document.querySelectorAll('#classTable tr').length,
      pontos: document.querySelectorAll('#classTable .forma-dot').length,
    }));
    await ctx.close();
    saida[c.nome] = { ...noPainel, publico, erros };
  }
  return saida;
}

// Sonda do botão «Apagar classificação» do cabeçalho do escalão.
//
// Mede o caminho inteiro: o botão existe ou não existe conforme há linhas na
// classificação do escalão; cancelar não toca em nada; confirmar grava [] e só
// nessa chave; a publicação leva o [] no classData; e a página pública fica sem
// linhas. Clica-se no botão a sério, encontrado pelo onclick, para medir o que
// o painel oferece a quem o usa.
async function testarApagarClassBase(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    let corpo = null;
    await ctx.route('**/api/save.php*', (rota) => {
      corpo = rota.request().postData();
      return rota.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, savedAt: '2026-10-12T12:00:00Z',
          alteradas: [], gerados: [], avisos: [] }) });
    });
    const pg = await ctx.newPage();
    const erros = [];
    const dialogos = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    pg.on('dialog', (d) => {
      dialogos.push(d.message());
      // O confirm do apagar segue o cenário; os outros (publicar) aceitam-se.
      if (/Apagar a classificação/.test(d.message()) && c.cancelar) return d.dismiss();
      return d.accept();
    });
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

    const noPainel = await pg.evaluate((a) => {
      localStorage.setItem('jsc_painel_local', '1');
      Object.keys(localStorage).filter((k) => k.indexOf('fpf_') === 0)
        .forEach((k) => localStorage.removeItem(k));
      Object.entries(a.chaves).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
      localStorage.setItem('fpf_sync_config', JSON.stringify(a.cfg));
      if (a.jogos) localStorage.setItem('db_jogos', JSON.stringify(a.jogos));
      renderClassSyncRows();

      const doEscalao = (esc) => Array.from(document.querySelectorAll('#fpfSyncRows button'))
        .filter((b) => new RegExp("apagarClassBase\\('" + esc + "'\\)").test(b.getAttribute('onclick') || ''));
      const cabecalho = () => {
        const tr = Array.from(document.querySelectorAll('#fpfSyncRows tr'))
          .find((t) => new RegExp("'" + a.escalao + "'").test(t.innerHTML) && /Colar classificação/.test(t.textContent));
        return tr ? tr.textContent.replace(/\s+/g, ' ').trim() : '(não encontrado)';
      };
      const fotografia = () => {
        const m = {};
        Object.keys(localStorage).filter((k) => k.indexOf('fpf_') === 0).sort().forEach((k) => {
          if (k === 'fpf_sync_config') { m[k] = localStorage.getItem(k); return; }
          try { m[k] = JSON.parse(localStorage.getItem(k)).length; } catch (_) { m[k] = '(ilegível)'; }
        });
        m['db_jogos'] = JSON.parse(localStorage.getItem('db_jogos') || '[]').length;
        return m;
      };

      const r = {
        nBotoes: doEscalao(a.escalao).length,
        nBotoesOutro: doEscalao(a.outroEscalao).length,
        cabecalhoAntes: cabecalho(),
        antes: fotografia(),
      };
      // Sem botão não há clique, e os campos do "depois" ficam explícitos em
      // vez de ausentes: uma asserção que leia depois[...] falha em vez de
      // lançar, e nenhuma passa por o clique nunca ter acontecido. Medido na
      // verificação negativa: a bateria morria com um TypeError, e o teste do
      // cabeçalho passava porque !/11 eq./.test(undefined) é verdadeiro.
      r.clicou = false;
      if (!r.nBotoes) { r.depois = null; r.cabecalhoDepois = '(sem clique)'; r.botaoFicou = 0; return r; }
      doEscalao(a.escalao)[0].click();
      r.clicou = true;
      r.depois = fotografia();
      r.cabecalhoDepois = cabecalho();
      r.botaoFicou = doEscalao(a.escalao).length;
      return r;
    }, c);

    // O que o Publicar envia depois da operação.
    await pg.evaluate(() => publicarNoServidor());
    await pg.waitForTimeout(1200);
    const payload = corpo ? JSON.parse(corpo) : null;

    // E o que a página pública mostra.
    await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
    await pg.waitForTimeout(600);
    const publico = await pg.evaluate(async (a) => {
      const ver = async (esc) => {
        const tab = document.querySelector('.tab[data-escalao="' + esc + '"]');
        if (tab) tab.click();
        await new Promise((r) => setTimeout(r, 200));
        return {
          escalao: esc,
          teamActivo: typeof teamActivo !== 'undefined' ? teamActivo : '(?)',
          chave: typeof teamActivo !== 'undefined' && teamActivo
            ? 'fpf_class_' + esc + '__' + teamActivo : 'fpf_class_' + esc,
          linhas: document.querySelectorAll('#classTable tr').length,
        };
      };
      return { alvo: await ver(a.escalao), outro: await ver(a.outroEscalao) };
    }, c);

    await ctx.close();
    saida[c.nome] = { ...noPainel, dialogos, payloadClassData: payload ? payload.classData : null, publico, erros };
  }
  return saida;
}

// Sondas do classData na publicação, e da coluna Forma.
//
// O payload do Publicar levava sempre classData, e levava null quando o
// browser não tinha nenhuma chave fpf_class_* — publicar de outro computador,
// do telemóvel ou de outro perfil. O api/save.php funde o que recebe com o que
// está gravado, pelo que esse null substituía a classificação publicada por
// nada: a projeção pública deixava de levar classData, o js/sync.js não
// escrevia, e os visitantes ficavam para sempre com as linhas antigas.
//
// E no outro extremo da cadeia, uma linha sem a chave forma fazia o
// formaHTML() lançar no split e a classificação pública ficava sem nenhuma
// linha — a tabela inteira, por uma letra que faltava.

// O que o botão Publicar envia de facto: intercepta-se o POST.
async function testarPayloadClassData(browser, url, casos) {
  const saida = {};
  for (const c of casos) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    let corpo = null;
    await ctx.route('**/api/save.php*', (rota) => {
      corpo = rota.request().postData();
      return rota.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, savedAt: '2026-10-11T12:00:00Z',
          alteradas: [], gerados: [], avisos: [] }) });
    });
    const pg = await ctx.newPage();
    pg.on('dialog', (d) => d.accept());
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
    await pg.evaluate((a) => {
      localStorage.setItem('jsc_painel_local', '1');
      Object.keys(localStorage).filter((k) => k.indexOf('fpf_class_') === 0)
        .forEach((k) => localStorage.removeItem(k));
      if (a.linhas) localStorage.setItem('fpf_class_Sub-17', JSON.stringify(a.linhas));
    }, c);
    await pg.evaluate(() => publicarNoServidor());
    await pg.waitForTimeout(1200);
    await ctx.close();
    const d = corpo ? JSON.parse(corpo) : null;
    saida[c.nome] = {
      houvePost: !!corpo,
      temChave: !!d && ('classData' in d),
      valor: d ? d.classData : undefined,
      erros,
    };
  }
  return saida;
}

// E do outro lado: o servidor preserva a classificação quando o pedido não
// menciona o classData? Mede-se contra o api/save.php a sério, com sessão.
//
// Em cópia e servidor próprios, não no do resto da bateria: este caminho cria
// uma conta de Admin e PUBLICA — reescreve o data/db.json e regenera as páginas
// —, e isso tirava o chão aos testes seguintes. Medido: a sonda do
// api/proxy.php passou a falhar, porque contava com o criar-primeiro a poder
// correr do zero.
async function testarSavePreservaClassData(raizOriginal) {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-save-'));
  fs.cpSync(raizOriginal, copia, {
    recursive: true,
    filter: (origem) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(origem),
  });
  const srvProprio = await arrancarServidor({ raiz: copia, portaHttp: 8095, portaPhp: 8094 });
  if (srvProprio.modo !== 'apache') {
    if (srvProprio.parar) await srvProprio.parar();
    fs.rmSync(copia, { recursive: true, force: true });
    return { semApache: true };
  }
  try {
    return await _medirSaveClassData(srvProprio.url);
  } finally {
    if (srvProprio.parar) await srvProprio.parar();
    fs.rmSync(copia, { recursive: true, force: true });
  }
}

async function _medirSaveClassData(url) {
  const cookieDe = (res) => {
    const m = (res.headers.get('set-cookie') || '').match(/JSCSESSAO=([^;]+)/);
    return m ? 'JSCSESSAO=' + m[1] : null;
  };
  const pedir = async (caminho, opcoes = {}) => {
    const h = { 'X-Forwarded-Proto': 'https' };
    if (opcoes.cookie) h['Cookie'] = opcoes.cookie;
    if (opcoes.corpo) { h['Content-Type'] = 'application/json'; h['X-JSC-Painel'] = '1'; }
    const res = await fetch(url + caminho, {
      method: opcoes.corpo ? 'POST' : 'GET', headers: h,
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined, redirect: 'manual',
    });
    return { estado: res.status, texto: await res.text(), cookie: cookieDe(res) };
  };

  const CREDENCIAIS = { utilizador: 'Admin', password: 'Teste12345ab' };
  let sessao = await pedir('/api/auth.php?acao=criar-primeiro',
    { corpo: { ...CREDENCIAIS, nome: 'Admin' } });
  if (!/"ok":true/.test(sessao.texto)) {
    sessao = await pedir('/api/auth.php?acao=entrar', { corpo: CREDENCIAIS });
  }
  const cookie = sessao.cookie;
  const r = { entrou: !!cookie && /"ok":true/.test(sessao.texto) };

  const LINHAS = [
    { equipa: 'TESTE SAVE A', abrev: 'TSA', j: 1, v: 1, e: 0, d: 0, gm: 2, gs: 0, dg: 2, pts: 3, forma: 'V' },
    { equipa: 'TESTE SAVE B', abrev: 'TSB', j: 1, v: 0, e: 0, d: 1, gm: 0, gs: 2, dg: -2, pts: 0, forma: 'D' },
  ];
  const formas = (corpo) => {
    try {
      const d = JSON.parse(corpo);
      const c = (d.classData || {})['fpf_class_Sub-17'];
      return c ? c.map((x) => x.equipa + '=' + JSON.stringify(x.forma)) : null;
    } catch (_) { return null; }
  };

  // 1. Publicar com a classificação.
  r.comClassData = await pedir('/api/save.php',
    { cookie, corpo: { publicadoEm: new Date().toISOString(), classData: { 'fpf_class_Sub-17': LINHAS } } });
  r.depoisDeGravar = formas((await pedir('/api/load.php')).texto);

  // 2. Publicar sem mencionar o classData: tem de ficar como está.
  r.semClassData = await pedir('/api/save.php',
    { cookie, corpo: { publicadoEm: new Date().toISOString() } });
  r.depoisDeOmitir = formas((await pedir('/api/load.php')).texto);

  // 3. E com null, que é o que se deixou de enviar: fica registado o que o
  //    servidor faz com ele, para a propriedade não depender só do painel.
  r.comNull = await pedir('/api/save.php',
    { cookie, corpo: { publicadoEm: new Date().toISOString(), classData: null } });
  r.depoisDoNull = formas((await pedir('/api/load.php')).texto);

  return r;
}

// ---- A gestão de logótipos no painel ------------------------------
// O api/logo.php é interceptado: o que se mede é o painel — o que mostra, o
// que escreve no db_logos, e sobretudo o que NÃO escreve quando o servidor
// recusa. Qualquer pedido à api é registado, para se provar que o Publicar
// não é chamado e que nada vai para o save.php.
async function testarPainelLogos(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pedidos = [];
    await ctx.route('**/api/**', (rota) => {
      const req = rota.request();
      const caminho = new URL(req.url()).pathname;
      pedidos.push(req.method() + ' ' + caminho);
      if (/logo\.php$/.test(caminho) && c.resposta) {
        return rota.fulfill({ status: c.resposta.estado, contentType: 'application/json',
          body: JSON.stringify(c.resposta.corpo) });
      }
      if (/save\.php$/.test(caminho)) {
        return rota.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: true }) });
      }
      return rota.continue();
    });
    const pg = await ctx.newPage();
    const erros = [], dialogos = [];
    pg.on('pageerror', (e) => erros.push('exce\u00e7\u00e3o: ' + e.message));
    pg.on('dialog', (d) => { dialogos.push(d.message().replace(/\s+/g, ' ')); return d.accept(); });
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

    const r = await pg.evaluate(async (a) => {
      const ler = () => { try { return JSON.parse(localStorage.getItem('db_logos') || '{}'); } catch (_) { return null; } };
      Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem('db_logos', JSON.stringify(a.mapa));
      // Sentinelas: nada disto pode mudar.
      localStorage.setItem('db_jogos', JSON.stringify(a.jogos));
      localStorage.setItem('fpf_class_Sub-17', JSON.stringify(a.classificacao));
      const antes = { logos: ler(), jogos: localStorage.getItem('db_jogos'),
        classe: localStorage.getItem('fpf_class_Sub-17') };

      renderLogos();
      const linhas = Array.from(document.querySelectorAll('#logosRows tr')).map((tr) => ({
        texto: (tr.textContent || '').replace(/\s+/g, ' ').trim(),
        origem: ((tr.querySelectorAll('td')[2] || {}).textContent || '').trim(),
        estado: ((tr.querySelectorAll('td')[3] || {}).textContent || '').trim(),
        valor: ((tr.querySelector('input[id^=logoValor]') || {}).value || ''),
        src: ((tr.querySelector('img') || {}).getAttribute
          ? tr.querySelector('img').getAttribute('src') : ''),
        chave: ((tr.querySelector('input[id^=logoChave]') || {}).value || ''),
      }));
      const resumo = (document.getElementById('logosResumo') || {}).textContent || '';

      // A acção do cenário.
      if (a.acao === 'adicionar') {
        document.getElementById('logoNovaEquipa').value = a.nomeNovo;
        document.getElementById('logoNovoValor').value  = a.valor;
        adicionarLogo();
      } else if (a.acao === 'url') {
        const i = linhas.findIndex((l) => l.chave === a.chave);
        document.getElementById('logoValor' + i).value = a.valor;
        guardarLogoUrl(i, a.chave);
      } else if (a.acao === 'rename') {
        const i = linhas.findIndex((l) => l.chave === a.chave);
        document.getElementById('logoChave' + i).value = a.nomeNovo;
        await renomearLogo(i, a.chave);
      } else if (a.acao === 'upload') {
        const i = linhas.findIndex((l) => l.chave === a.chave);
        const input = document.getElementById('logoFich' + i);
        // Um ficheiro a sério, do tipo certo: o que se mede é a resposta do
        // endpoint, que está interceptada.
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], 'e.png', { type: 'image/png' }));
        input.files = dt.files;
        await enviarLogo(i, a.chave);
      }
      await new Promise((res) => setTimeout(res, 300));

      const depois = { logos: ler(), jogos: localStorage.getItem('db_jogos'),
        classe: localStorage.getItem('fpf_class_Sub-17') };
      return {
        linhas, resumo, antes, depois,
        aviso: (document.getElementById('logosAviso') || {}).textContent || '',
        avisoVisivel: !!(document.getElementById('logosAviso')
          && document.getElementById('logosAviso').style.display !== 'none'),
        mudadas: Object.keys(Object.assign({}, antes.logos, depois.logos))
          .filter((k) => JSON.stringify((antes.logos || {})[k]) !== JSON.stringify((depois.logos || {})[k])),
      };
    }, c);

    // O estado FALHOU/OK vem de um onload/onerror: medir depois de assentar.
    await pg.waitForTimeout(700);
    r.estadosFinais = await pg.evaluate(() =>
      Array.from(document.querySelectorAll('#logosRows tr')).map((tr) => ({
        chave: ((tr.querySelector('input[id^=logoChave]') || {}).value || ''),
        estado: ((tr.querySelectorAll('td')[3] || {}).textContent || '').trim(),
      })));

    await ctx.close();
    saida[c.nome] = { ...r, pedidos, dialogos, erros };
  }
  return saida;
}

// ---- Nada dentro de uploads/ é executável -------------------------
// Planta ficheiros com extensões de executável na pasta e mede o que o
// servidor responde a cada um, mais os controlos: as imagens continuam a
// abrir, e o PHP legítimo fora de uploads/ continua a correr.
//
// LIMITE DESTA MEDIÇÃO, e está aqui escrito para não se confundir com uma
// garantia: o servidor desta bateria liga o PHP por ProxyPassMatch
// ^/(.*\.php)$ (tools/ambiente.js), que tira o pedido do sistema de ficheiros
// na fase de translate — antes de qualquer .htaccess. Por isso um pedido a
// *.php exacto nunca chega cá e o 403 não é observável aqui. Todas as outras
// extensões SÃO observáveis, incluindo .phtml e .php8, que são executáveis no
// alojamento real (o AddHandler do cPanel cobre .php .php8 .phtml).
async function testarUploadsSemExecucao(raizOriginal) {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-exec-'));
  fs.cpSync(raizOriginal, copia, {
    recursive: true,
    filter: (origem) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(origem),
  });
  fs.chmodSync(copia, 0o755);
  const pasta = path.join(copia, 'uploads', 'logos');
  fs.mkdirSync(pasta, { recursive: true });

  // Um PNG real, para o controlo positivo.
  const zlib = require('zlib');
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const pedaco = (t, d) => { const corpo = Buffer.concat([Buffer.from(t), d]); const a = Buffer.alloc(4); a.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(corpo)); return Buffer.concat([a, corpo, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(16, 0); ihdr.writeUInt32BE(16, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pedaco('IHDR', ihdr), pedaco('IDAT', zlib.deflateSync(Buffer.alloc(16 * (1 + 16 * 4)))),
    pedaco('IEND', Buffer.alloc(0))]);

  const PLANTADOS = [
    'sonda.php', 'sonda.phtml', 'sonda.phps', 'sonda.php3', 'sonda.php5',
    'sonda.php7', 'sonda.php8', 'sonda.pl', 'sonda.py', 'sonda.cgi',
    'sonda.shtml', 'sonda.sh', 'sonda.php.png', 'sonda.PhP', 'sonda.txt',
  ];
  PLANTADOS.forEach((n) => fs.writeFileSync(path.join(pasta, n), '<?php echo "PHP_EXECUTOU"; ?>'));
  fs.writeFileSync(path.join(pasta, 'escudo.png'), png);
  fs.writeFileSync(path.join(pasta, 'escudo.webp'), png);   // conteúdo não importa: mede-se o acesso
  fs.writeFileSync(path.join(copia, 'uploads', 'raiz.php'), '<?php echo "PHP_EXECUTOU"; ?>');

  const srv = await arrancarServidor({ raiz: copia, portaHttp: 8083, portaPhp: 8082 });
  if (srv.modo !== 'apache') {
    if (srv.parar) await srv.parar();
    fs.rmSync(copia, { recursive: true, force: true });
    return { semApache: true };
  }
  try {
    const ver = async (caminho) => {
      try {
        const res = await fetch(srv.url + caminho, {
          headers: { 'X-Forwarded-Proto': 'https' }, redirect: 'manual',
        });
        const texto = await res.text();
        return {
          estado: res.status,
          // Servido em bruto, o corpo tem a marca E o <?php da fonte.
          // Executado, tem a marca e NAO tem o <?php. Sem esta distinção o
          // detector dava "executou" a um ficheiro apenas servido — medido
          // no sonda.php.png.
          executou: texto.indexOf('PHP_EXECUTOU') !== -1 && texto.indexOf('<?php') === -1,
          servidoEmBruto: texto.indexOf('<?php') !== -1,
          // Um AddHandler que nomeie um pacote inexistente faz o Apache cair
          // no handler por omissão e servir o .php como texto. É o modo
          // catastrófico de o bloco do cPanel ficar desactualizado, e é por
          // aqui que se apanha, nos endpoints a sério.
          temFontePhp: texto.indexOf('<?php') !== -1 || texto.indexOf('<?=') !== -1,
          tipo: (res.headers.get('content-type') || '').split(';')[0],
        };
      } catch (e) { return { estado: -1, executou: false, tipo: 'ERRO ' + e.message }; }
    };
    const r = { bloqueados: {}, proxiado: null };
    for (const n of PLANTADOS) r.bloqueados[n] = await ver('/uploads/logos/' + n);
    r.bloqueados['../raiz.php'] = await ver('/uploads/raiz.php');
    // Controlos positivos: as imagens.
    r.png  = await ver('/uploads/logos/escudo.png');
    r.webp = await ver('/uploads/logos/escudo.webp');
    // Controlos de não-regressão: o PHP legítimo, fora de uploads/.
    r.apiLoad  = await ver('/api/load.php');
    r.apiAuth  = await ver('/api/auth.php?acao=estado');
    r.indexHtml = await ver('/index.html');
    return r;
  } finally {
    if (srv.parar) await srv.parar();
    fs.rmSync(copia, { recursive: true, force: true });
  }
}

// ---- O endpoint dos logótipos, contra o PHP a sério ------------------
// É o único endpoint do projeto que grava ficheiros, portanto mede-se o que
// ele recusa antes do que ele aceita. Em cópia e servidor próprios: este
// caminho cria conta e escreve em uploads/logos/.
//
// Os ficheiros de teste são construídos aqui, byte a byte, para que o tipo
// real seja mesmo aquele — um PNG verdadeiro, um JPEG verdadeiro, e um .png
// que por dentro é outra coisa.
function _jscPngMinimo(largura, altura) {
  // PNG válido, com o IHDR a declarar as dimensões pedidas. Basta para o
  // getimagesize(), que lê o cabeçalho.
  const crc = (buf) => {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const pedaco = (tipo, dados) => {
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
    const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length, 0);
    const c = Buffer.alloc(4);   c.writeUInt32BE(crc(corpo), 0);
    return Buffer.concat([tam, corpo, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const zlib = require('zlib');
  const linha = Buffer.alloc(1 + largura * 4);
  const bruto = Buffer.concat(Array.from({ length: altura }, () => linha));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', zlib.deflateSync(bruto)),
    pedaco('IEND', Buffer.alloc(0)),
  ]);
}

function _jscJpegMinimo() {
  // JPEG válido de 32x32, cinzento, escrito à mão: SOI, APP0, SOF0 com as
  // dimensões, DHT/DQT mínimos, SOS e EOI. O getimagesize() só precisa do
  // SOF0, mas o ficheiro fica bem formado.
  const sof0 = Buffer.from([0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x20, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00]);
  return Buffer.concat([
    Buffer.from([0xFF, 0xD8]),
    Buffer.from([0xFF, 0xE0, 0x00, 0x10]), Buffer.from('JFIF\0', 'binary'),
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
    sof0,
    Buffer.from([0xFF, 0xD9]),
  ]);
}

async function testarEndpointLogo(raizOriginal) {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-logo-'));
  fs.cpSync(raizOriginal, copia, {
    recursive: true,
    filter: (origem) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(origem),
  });
  // O mkdtempSync cria a pasta com 0700 e o Apache corre com outro
  // utilizador: sem isto, NENHUM ficheiro estático é legível e todos os
  // pedidos dão 403 — medido, incluindo /index.html e /images/logo.svg. As
  // outras sondas que usam cópias nunca apanharam isto porque só falam com o
  // PHP, que vai por proxy e corre com o utilizador desta bateria.
  fs.chmodSync(copia, 0o755);
  const srv = await arrancarServidor({ raiz: copia, portaHttp: 8089, portaPhp: 8088 });
  if (srv.modo !== 'apache') {
    if (srv.parar) await srv.parar();
    fs.rmSync(copia, { recursive: true, force: true });
    return { semApache: true };
  }
  try {
    return await _medirEndpointLogo(srv.url, copia);
  } finally {
    if (srv.parar) await srv.parar();
    fs.rmSync(copia, { recursive: true, force: true });
  }
}

async function _medirEndpointLogo(url, raizCopia) {
  const cookieDe = (res) => {
    const m = (res.headers.get('set-cookie') || '').match(/JSCSESSAO=([^;]+)/);
    return m ? 'JSCSESSAO=' + m[1] : null;
  };
  const json = async (res) => {
    const texto = await res.text();
    let d = null;
    try { d = JSON.parse(texto); } catch (_) {}
    return { estado: res.status, texto, json: d };
  };
  const entrar = async (caminho, corpo) => {
    const res = await fetch(url + caminho, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-JSC-Painel': '1', 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify(corpo), redirect: 'manual',
    });
    const r = await json(res);
    r.cookie = cookieDe(res);
    return r;
  };

  const CREDENCIAIS = { utilizador: 'Admin', password: 'Teste12345ab' };
  let sessao = await entrar('/api/auth.php?acao=criar-primeiro', { ...CREDENCIAIS, nome: 'Admin' });
  if (!/"ok":true/.test(sessao.texto)) sessao = await entrar('/api/auth.php?acao=entrar', CREDENCIAIS);
  const cookie = sessao.cookie;
  const r = { entrou: !!cookie && /"ok":true/.test(sessao.texto) };

  // Envio multipart construído à mão: o FormData do Node não deixa controlar
  // o nome do ficheiro byte a byte, e é justamente isso que se quer medir.
  const enviar = async (opcoes) => {
    const limite = '----jscteste' + Date.now();
    const partes = [];
    if (opcoes.equipa !== undefined) {
      partes.push(Buffer.from('--' + limite + '\r\n'
        + 'Content-Disposition: form-data; name="equipa"\r\n\r\n'
        + opcoes.equipa + '\r\n', 'utf8'));
    }
    if (opcoes.conteudo !== undefined) {
      partes.push(Buffer.from('--' + limite + '\r\n'
        + 'Content-Disposition: form-data; name="' + (opcoes.campo || 'ficheiro')
        + '"; filename="' + (opcoes.nome || 'escudo.png') + '"\r\n'
        + 'Content-Type: ' + (opcoes.tipo || 'image/png') + '\r\n\r\n', 'utf8'));
      partes.push(opcoes.conteudo);
      partes.push(Buffer.from('\r\n', 'utf8'));
    }
    partes.push(Buffer.from('--' + limite + '--\r\n', 'utf8'));
    const corpo = Buffer.concat(partes);
    const cabecalhos = {
      'Content-Type': 'multipart/form-data; boundary=' + limite,
      'X-Forwarded-Proto': 'https',
    };
    if (opcoes.comCookie !== false && cookie) cabecalhos['Cookie'] = cookie;
    if (opcoes.comCabecalhoPainel !== false) cabecalhos['X-JSC-Painel'] = '1';
    const res = await fetch(url + '/api/logo.php', {
      method: opcoes.metodo || 'POST', headers: cabecalhos,
      body: opcoes.metodo === 'GET' ? undefined : corpo, redirect: 'manual',
    });
    return await json(res);
  };

  const PNG = _jscPngMinimo(64, 64);
  const naPasta = () => {
    const d = path.join(raizCopia, 'uploads', 'logos');
    try { return fs.readdirSync(d).filter((f) => !/^\.|README/.test(f)).sort(); }
    catch (_) { return []; }
  };

  // ---- O que tem de ser recusado -------------------------------------
  r.semCabecalho = await enviar({ equipa: 'Ferreiras', conteudo: PNG, comCabecalhoPainel: false });
  r.semSessao    = await enviar({ equipa: 'Ferreiras', conteudo: PNG, comCookie: false });
  r.metodoGet    = await enviar({ equipa: 'Ferreiras', conteudo: PNG, metodo: 'GET' });
  r.semEquipa    = await enviar({ conteudo: PNG });
  r.equipaSoSimbolos = await enviar({ equipa: '///...///', conteudo: PNG });
  r.semFicheiro  = await enviar({ equipa: 'Ferreiras' });
  r.campoErrado  = await enviar({ equipa: 'Ferreiras', conteudo: PNG, campo: 'outro' });
  r.extensaoMa   = await enviar({ equipa: 'Ferreiras', conteudo: PNG, nome: 'escudo.svg' });
  r.extensaoPhp  = await enviar({ equipa: 'Ferreiras', conteudo: PNG, nome: 'escudo.php' });
  r.tipoTrocado  = await enviar({ equipa: 'Ferreiras', conteudo: _jscJpegMinimo(), nome: 'escudo.png' });
  r.naoEImagem   = await enviar({ equipa: 'Ferreiras', conteudo: Buffer.from('<?php echo 1; ?>', 'utf8'), nome: 'escudo.png' });
  r.vazio        = await enviar({ equipa: 'Ferreiras', conteudo: Buffer.alloc(0), nome: 'escudo.png' });
  r.pequeno      = await enviar({ equipa: 'Ferreiras', conteudo: _jscPngMinimo(8, 8), nome: 'escudo.png' });
  r.grande       = await enviar({ equipa: 'Ferreiras', conteudo: _jscPngMinimo(1200, 40), nome: 'escudo.png' });
  r.travessia    = await enviar({ equipa: '../../../etc/passwd', conteudo: PNG, nome: 'escudo.png' });
  r.nomeMalicioso = await enviar({ equipa: 'Ferreiras', conteudo: PNG, nome: '../../../atacante.php' });
  r.depoisDasRecusas = naPasta();

  // ---- O que tem de ser aceite ---------------------------------------
  r.bom          = await enviar({ equipa: 'Ferreiras', conteudo: PNG, nome: 'escudo.png' });
  r.depoisDoBom  = naPasta();
  r.acentos      = await enviar({ equipa: 'Associa\u00e7\u00e3o Desportiva S\u00e3o Br\u00e1s', conteudo: PNG, nome: 'x.png' });
  r.jpegReal     = await enviar({ equipa: 'Quarteira', conteudo: _jscJpegMinimo(), nome: 'escudo.jpg', tipo: 'image/jpeg' });
  r.substituir   = await enviar({ equipa: 'Ferreiras', conteudo: _jscPngMinimo(80, 80), nome: 'outro-nome-qualquer.png' });
  r.noFim        = naPasta();

  // ---- Colisão de slug: Louletano B vs Louletano-B ------------------
  // Dois nomes diferentes, o mesmo slug. O primeiro grava; o segundo tem de
  // dar 409 e não tocar no ficheiro do primeiro.
  r.louletanoB  = await enviar({ equipa: 'Louletano B', conteudo: _jscPngMinimo(48, 48), nome: 'b.png' });
  const antesColisao = (function () {
    try { return fs.readFileSync(path.join(raizCopia, 'uploads', 'logos', 'louletano-b.png')); }
    catch (_) { return null; }
  })();
  r.louletanoHifen = await enviar({ equipa: 'Louletano-B', conteudo: _jscPngMinimo(96, 96), nome: 'c.png' });
  const depoisColisao = (function () {
    try { return fs.readFileSync(path.join(raizCopia, 'uploads', 'logos', 'louletano-b.png')); }
    catch (_) { return null; }
  })();
  r.colisaoIntacto = !!(antesColisao && depoisColisao && antesColisao.equals(depoisColisao));
  // E o mesmo dono a substituir o seu próprio escudo continua a poder.
  r.mesmoDono = await enviar({ equipa: 'louletano b', conteudo: _jscPngMinimo(64, 64), nome: 'd.png' });
  // O registo de donos não é servido pela web.
  // ---- Transferência de propriedade -------------------------------
  // O caso do rename: o ficheiro fica com o nome antigo, e o dono tem de
  // passar para o nome novo, senão o upload seguinte bate contra o próprio
  // ficheiro.
  const transferir = async (de, para, caminho) => {
    const limite = '----jsctr' + Date.now() + Math.random();
    const campo = (n, v) => Buffer.from('--' + limite + '\r\n'
      + 'Content-Disposition: form-data; name="' + n + '"\r\n\r\n' + v + '\r\n', 'utf8');
    const corpo = Buffer.concat([
      campo('acao', 'transferir'), campo('dono_antigo', de),
      campo('dono_novo', para), campo('caminho', caminho),
      Buffer.from('--' + limite + '--\r\n', 'utf8'),
    ]);
    const res = await fetch(url + '/api/logo.php', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + limite,
        'X-JSC-Painel': '1', 'X-Forwarded-Proto': 'https', 'Cookie': cookie },
      body: corpo, redirect: 'manual',
    });
    return await json(res);
  };
  const donoDe = (slug) => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(raizCopia, 'uploads', 'logos', '.donos.json'), 'utf8'));
      return d[slug] === undefined ? null : d[slug];
    } catch (_) { return null; }
  };

  // Dono errado: nada muda.
  r.trDonoErrado = await transferir('nao-e-o-dono', 'novo nome', 'uploads/logos/louletano-b.png');
  r.donoAposErrado = donoDe('louletano-b');
  // Caminho forjado: nada muda.
  r.trForjado = await transferir('louletano b', 'novo nome', '../../../etc/passwd');
  r.trForjado2 = await transferir('louletano b', 'novo nome', 'uploads/logos/../../api/logo.php');
  r.trForjado3 = await transferir('louletano b', 'novo nome', 'uploads/logos/nao-existe.png');
  r.donoAposForjado = donoDe('louletano-b');
  // A transferência legítima.
  r.trBoa = await transferir('louletano b', 'louletano reserva', 'uploads/logos/louletano-b.png');
  r.donoApos = donoDe('louletano-b');
  // E depois dela, o upload do clube renomeado funciona em vez de dar 409.
  r.uploadAposTr = await enviar({ equipa: 'louletano reserva', conteudo: _jscPngMinimo(50, 50), nome: 'r.png' });
  // O dono antigo já não pode substituir.
  r.antigoJaNao = await enviar({ equipa: 'louletano b', conteudo: _jscPngMinimo(52, 52), nome: 's.png' });

  // ---- Concorrência: oito uploads ao mesmo tempo ------------------
  // Sem flock, a leitura e a escrita separadas perdiam donos: cada pedido
  // lia o registo antigo e escrevia por cima. Com flock, os oito sobrevivem.
  // A medição é determinista: conta-se quantos dos oito ficaram no registo.
  const equipasParalelas = ['Par Um', 'Par Dois', 'Par Tres', 'Par Quatro',
    'Par Cinco', 'Par Seis', 'Par Sete', 'Par Oito'];
  r.paralelos = await Promise.all(equipasParalelas.map((nome) =>
    enviar({ equipa: nome, conteudo: _jscPngMinimo(40, 40), nome: 'p.png' })));
  r.registoFinal = (function () {
    try {
      const cru = fs.readFileSync(path.join(raizCopia, 'uploads', 'logos', '.donos.json'), 'utf8');
      const d = JSON.parse(cru);
      return { valido: true, n: Object.keys(d).length,
        presentes: equipasParalelas.filter((nome) =>
          d[nome.toLowerCase().replace(/ /g, '-')] === nome.toLowerCase()).length };
    } catch (e) { return { valido: false, erro: String(e.message), n: 0, presentes: 0 }; }
  })();

  r.registoServido = await (async () => {
    const res = await fetch(url + '/uploads/logos/.donos.json',
      { headers: { 'X-Forwarded-Proto': 'https' }, redirect: 'manual' });
    return { estado: res.status, corpo: (await res.text()).slice(0, 40) };
  })();

  // O ficheiro gravado é mesmo uma imagem, e é a que foi enviada.
  try {
    const bytes = fs.readFileSync(path.join(raizCopia, 'uploads', 'logos', 'ferreiras.png'));
    r.ferreirasBytes = bytes.length;
    r.ferreirasPng = bytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  } catch (_) { r.ferreirasBytes = null; r.ferreirasPng = false; }

  // ---- A pasta serve imagens e não executa nada --------------------
  const pedirPasta = async (caminho) => {
    const res = await fetch(url + caminho, { headers: { 'X-Forwarded-Proto': 'https' }, redirect: 'manual' });
    return { estado: res.status, tipo: res.headers.get('content-type') || '', corpo: (await res.text()).slice(0, 80) };
  };
  // Tentativas de obter um nome executável, por qualquer das duas vias.
  r.forjados = [];
  for (const caso of [
    { equipa: 'sonda.php',        nome: 'escudo.png' },
    { equipa: 'x',                nome: 'escudo.php.png' },
    { equipa: 'x',                nome: 'escudo.png.php' },
    { equipa: '../../sonda.php',  nome: 'escudo.png' },
    { equipa: 'a/../../b.php',    nome: 'escudo.png' },
    { equipa: 'sonda%00.php',     nome: 'escudo.png' },
  ]) {
    const x = await enviar({ equipa: caso.equipa, conteudo: PNG, nome: caso.nome });
    r.forjados.push({
      equipa: caso.equipa, nome: caso.nome,
      ok: !!(x.json && x.json.ok), caminho: (x.json && x.json.caminho) || null, estado: x.estado,
    });
  }
  r.depoisDosForjados = naPasta();

  r.servePng = await pedirPasta('/uploads/logos/ferreiras.png');
  // Um .php posto à mão na pasta — como se tivesse entrado por outra via —
  // não pode ser executado nem servido.
  fs.writeFileSync(path.join(raizCopia, 'uploads', 'logos', 'sonda.php'), '<?php echo "EXECUTOU"; ?>');
  r.phpNaPasta = await pedirPasta('/uploads/logos/sonda.php');
  r.listagem   = await pedirPasta('/uploads/logos/');
  r.htaccess   = await pedirPasta('/uploads/logos/.htaccess');

  return r;
}

// ---- Repor do servidor ----------------------------------------------
// Mede o botão inteiro, com o /api/load.php a devolver um conteúdo controlado.
// Tudo acontece dentro de UM evaluate que espera pelo reporDoServidor(): a
// função acaba com um location.reload() a 800 ms, e a fotografia tem de ser
// tirada antes disso.
//
// O cenário 'servidor-real' não intercepta o load.php: fala com o PHP a sério,
// e o data/db.json é lido do disco antes e depois para provar que não mexeu.
//
// Em todos, qualquer pedido à api que não seja um GET ao load.php é registado:
// é assim que se prova que o Publicar não é chamado.
async function testarReporDoServidor(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pedidos = [];
    await ctx.route('**/api/**', (rota) => {
      const req = rota.request();
      const caminho = new URL(req.url()).pathname;
      pedidos.push(req.method() + ' ' + caminho);
      if (/load\.php$/.test(caminho) && c.servidor) {
        return rota.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(c.servidor) });
      }
      if (/save\.php$/.test(caminho)) {
        return rota.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: true, alteradas: [], gerados: [], avisos: [] }) });
      }
      return rota.continue();
    });
    const pg = await ctx.newPage();
    const erros = [], dialogos = [];
    pg.on('pageerror', (e) => erros.push('exce\u00e7\u00e3o: ' + e.message));
    pg.on('dialog', (d) => {
      dialogos.push({ tipo: d.type(), texto: d.message().replace(/\s+/g, ' ') });
      if (d.type() === 'prompt') {
        if (c.palavra === null || c.palavra === undefined) return d.dismiss();
        return d.accept(c.palavra);
      }
      // O confirm da comparação segue o cenário; os alerts aceitam-se.
      if (d.type() === 'confirm' && c.cancelar) return d.dismiss();
      return d.accept();
    });
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

    const r = await pg.evaluate(async (a) => {
      const foto = () => Object.keys(localStorage).sort().reduce(function (o, k) {
        o[k] = localStorage.getItem(k); return o;
      }, {});
      Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
      Object.keys(a.semente).forEach((k) => localStorage.setItem(k, a.semente[k]));
      const antes = foto();
      let erro = null;
      try { await reporDoServidor(); } catch (e) { erro = String(e && e.message || e); }
      const depois = foto();
      const chavesAntes = Object.keys(antes).sort();
      const chavesDepois = Object.keys(depois).sort();
      const backup = chavesDepois.filter((k) => k.indexOf('jsc_reposicao_') === 0);
      return {
        antes, depois, erro, backup,
        criadas: chavesDepois.filter((k) => chavesAntes.indexOf(k) === -1
          && k.indexOf('jsc_reposicao_') !== 0),
        removidas: chavesAntes.filter((k) => chavesDepois.indexOf(k) === -1),
        alteradas: chavesAntes.filter((k) => chavesDepois.indexOf(k) !== -1 && antes[k] !== depois[k]),
        conteudoBackup: backup.length ? depois[backup[0]] : null,
      };
    }, c);

    await ctx.close();
    saida[c.nome] = { ...r, pedidos, dialogos, erros };
  }
  return saida;
}

// ---- A migração da db_noticias ------------------------------------
// O bloco do data.js corre ao carregar o ficheiro, portanto a semente tem de
// entrar antes: addInitScript, não evaluate.
//
// Mede-se o armazém inteiro antes e depois, chave a chave, para responder a
// três coisas de uma vez: a db_noticias sobreviveu ou não; nenhuma outra
// chave desapareceu; e nada foi escrito sem ser pedido.
async function testarMigracaoNoticias(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    await ctx.addInitScript((a) => {
      try {
        if (sessionStorage.getItem('jsc_semeado_migr')) return;
        sessionStorage.setItem('jsc_semeado_migr', '1');
        Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
        Object.keys(a.semente).forEach((k) => localStorage.setItem(k, a.semente[k]));
        // A fotografia do que ficou semeado, para a comparação depois do
        // arranque ser contra o estado real e não contra o que eu acho que é.
        sessionStorage.setItem('jsc_foto_antes', JSON.stringify(
          Object.keys(localStorage).sort().reduce(function (o, k) {
            o[k] = localStorage.getItem(k); return o;
          }, {})));
      } catch (_) {}
    }, c);

    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exce\u00e7\u00e3o: ' + e.message));
    pg.on('dialog', (d) => d.accept());
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
    await pg.waitForTimeout(600);

    const r = await pg.evaluate(() => {
      let antes = {};
      try { antes = JSON.parse(sessionStorage.getItem('jsc_foto_antes') || '{}'); } catch (_) {}
      const depois = Object.keys(localStorage).sort().reduce(function (o, k) {
        o[k] = localStorage.getItem(k); return o;
      }, {});
      const chavesAntes = Object.keys(antes).sort();
      const chavesDepois = Object.keys(depois).sort();
      return {
        antes, depois, chavesAntes, chavesDepois,
        removidas: chavesAntes.filter((k) => chavesDepois.indexOf(k) === -1),
        acrescentadas: chavesDepois.filter((k) => chavesAntes.indexOf(k) === -1),
        alteradas: chavesAntes.filter((k) => chavesDepois.indexOf(k) !== -1 && antes[k] !== depois[k]),
        temAntiga: Object.prototype.hasOwnProperty.call(depois, 'db_noticias'),
        valorAntiga: depois.db_noticias === undefined ? null : depois.db_noticias,
      };
    });

    await ctx.close();
    saida[c.nome] = { ...r, erros };
  }
  return saida;
}

// ---- A chave das notícias não nasce vazia -------------------------
// Chama-se o initAdmin() directamente: é a função em causa, e assim não se
// cria conta nem se entra com sessão, o que mudaria o estado do servidor
// partilhado pela bateria.
//
// Mede-se duas vezes: logo a seguir ao initAdmin(), e outra vez passado um
// instante. O initAdmin() acaba a chamar o sincronizarRegistosServidor(), que
// é assíncrono e pode gravar — sem a segunda leitura, uma escrita que chegasse
// tarde passava ao lado da medição.
async function testarNoticiasSemChave(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exce\u00e7\u00e3o: ' + e.message));
    pg.on('dialog', (d) => d.accept());
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

    const r = await pg.evaluate((a) => {
      const foto = () => ({
        presente: localStorage.getItem('jsc_noticias') !== null,
        valor:    localStorage.getItem('jsc_noticias'),
        nChaves:  localStorage.length,
        chaves:   Object.keys(localStorage).sort(),
      });
      // Armazém no estado do cenário: ou sem chave nenhuma, ou com notícias
      // a sério já lá dentro.
      Object.keys(localStorage).forEach((k) => localStorage.removeItem(k));
      if (a.semear) localStorage.setItem('jsc_noticias', JSON.stringify(a.semear));
      const antes = foto();
      initAdmin();
      const depois = foto();
      const cartoes = Array.from(document.querySelectorAll('#newsAdminGrid .news-admin-card'));
      return {
        antes, depois,
        lidas: typeof loadNoticias === 'function' ? loadNoticias().length : -1,
        nCartoes: cartoes.length,
        cartoes: cartoes.map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)),
      };
    }, c);

    await pg.waitForTimeout(900);
    r.depoisDeEsperar = await pg.evaluate(() => ({
      presente: localStorage.getItem('jsc_noticias') !== null,
      valor:    localStorage.getItem('jsc_noticias'),
      nChaves:  localStorage.length,
      chaves:   Object.keys(localStorage).sort(),
    }));

    await ctx.close();
    saida[c.nome] = { ...r, erros };
  }
  return saida;
}

// ---- As duas guardas do Publicar, no painel a sério -----------------
// O save.php é interceptado para não publicar nada: o que se mede aqui é o que
// o painel faz — quantos pedidos saíram, se o segundo leva a confirmação, e se
// uma palavra errada ou um cancelar travam tudo.
async function testarPublicarVazio(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pedidos = [];
    await ctx.route('**/api/save.php*', (rota) => {
      const corpo = rota.request().postData();
      let conf = null;
      try { conf = JSON.parse(corpo).confirmarEsvaziar || null; } catch (_) {}
      pedidos.push({ corpo, confirmacao: conf });
      if (c.servidorRecusa && !conf) {
        return rota.fulfill({ status: 409, contentType: 'application/json',
          body: JSON.stringify({ ok: false, codigo: 'esvaziamento', palavra: 'APAGAR',
            error: 'recusado pela sonda',
            esvaziamentos: [{ area: 'jogos', antes: 7, depois: 0 }] }) });
      }
      return rota.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, savedAt: '2026-10-14T12:00:00Z',
          alteradas: [], gerados: [], avisos: [] }) });
    });
    const pg = await ctx.newPage();
    const erros = [], dialogos = [];
    pg.on('pageerror', (e) => erros.push('exce\u00e7\u00e3o: ' + e.message));
    pg.on('dialog', (d) => {
      dialogos.push({ tipo: d.type(), texto: d.message().replace(/\s+/g, ' ').slice(0, 400) });
      if (d.type() !== 'prompt') return d.accept();
      if (c.palavra === null) return d.dismiss();
      return d.accept(c.palavra);
    });
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

    await pg.evaluate((a) => {
      localStorage.setItem('jsc_painel_local', '1');
      Object.keys(localStorage)
        .filter((k) => k.indexOf('db_') === 0 || k.indexOf('fpf_') === 0 || k.indexOf('site_') === 0)
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem('jsc_noticias', JSON.stringify(a.comDados ? a.noticias : []));
      const vazio = [];
      DB.jogos          = a.comDados ? a.jogos : vazio;
      DB.atletas        = a.comDados ? a.atletas : vazio;
      DB.escaloes       = a.comDados ? a.escaloes : vazio;
      DB.treinadores    = a.comDados ? a.treinadores : vazio;
      DB.modalidades    = a.comDados ? a.modalidades : vazio;
      DB.patrocinadores = a.comDados ? a.patrocinadores : vazio;
      DB.galeria        = a.comDados ? a.galeria : vazio;
      DB.videos         = a.comDados ? a.videos : vazio;
      DB.agenda         = a.comDados ? a.agenda : vazio;
    }, c);

    await pg.evaluate(() => publicarNoServidor());
    await pg.waitForTimeout(1500);
    await ctx.close();

    const primeiro = pedidos.length ? JSON.parse(pedidos[0].corpo) : null;
    saida[c.nome] = {
      nPedidos:   pedidos.length,
      prompts:    dialogos.filter((d) => d.tipo === 'prompt'),
      confirmacoes: pedidos.map((x) => x.confirmacao),
      // O campo ausente não vai no pedido: db_logos foi removido acima.
      temLogos:   primeiro ? Object.prototype.hasOwnProperty.call(primeiro, 'logos') : null,
      temNoticias: primeiro ? Object.prototype.hasOwnProperty.call(primeiro, 'noticias') : null,
      erros,
    };
  }
  return saida;
}

// ---- A guarda do esvaziamento, contra o api/save.php a sério ---------
// Mede o caminho inteiro: publicar conteúdo, tentar publicar vazio por cima,
// tentar com uma confirmação que não corresponde, confirmar como é devido, e
// dois controlos de trabalho normal que têm de passar sem pergunta nenhuma.
//
// Lê-se o data/db.json do disco em cada passo, e não a projeção pública do
// /api/load.php, que filtra: o que está em causa é o ficheiro.
//
// Em cópia e servidor próprios, como a sonda do classData e pela mesma razão:
// este caminho cria conta e PUBLICA.
async function testarSaveEsvaziamento(raizOriginal) {
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-vazio-'));
  fs.cpSync(raizOriginal, copia, {
    recursive: true,
    filter: (origem) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(origem),
  });
  const srv = await arrancarServidor({ raiz: copia, portaHttp: 8093, portaPhp: 8092 });
  if (srv.modo !== 'apache') {
    if (srv.parar) await srv.parar();
    fs.rmSync(copia, { recursive: true, force: true });
    return { semApache: true };
  }
  try {
    return await _medirSaveEsvaziamento(srv.url, copia);
  } finally {
    if (srv.parar) await srv.parar();
    fs.rmSync(copia, { recursive: true, force: true });
  }
}

async function _medirSaveEsvaziamento(url, raizCopia) {
  const cookieDe = (res) => {
    const m = (res.headers.get('set-cookie') || '').match(/JSCSESSAO=([^;]+)/);
    return m ? 'JSCSESSAO=' + m[1] : null;
  };
  const pedir = async (caminho, opcoes = {}) => {
    const h = { 'X-Forwarded-Proto': 'https' };
    if (opcoes.cookie) h['Cookie'] = opcoes.cookie;
    if (opcoes.corpo) { h['Content-Type'] = 'application/json'; h['X-JSC-Painel'] = '1'; }
    const res = await fetch(url + caminho, {
      method: opcoes.corpo ? 'POST' : 'GET', headers: h,
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined, redirect: 'manual',
    });
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch (_) {}
    return { estado: res.status, texto, json, cookie: cookieDe(res) };
  };

  const CREDENCIAIS = { utilizador: 'Admin', password: 'Teste12345ab' };
  let sessao = await pedir('/api/auth.php?acao=criar-primeiro',
    { corpo: { ...CREDENCIAIS, nome: 'Admin' } });
  if (!/"ok":true/.test(sessao.texto)) {
    sessao = await pedir('/api/auth.php?acao=entrar', { corpo: CREDENCIAIS });
  }
  const cookie = sessao.cookie;
  const r = { entrou: !!cookie && /"ok":true/.test(sessao.texto) };

  const ficheiro = path.join(raizCopia, 'data', 'db.json');
  const noDisco = () => {
    try {
      const d = JSON.parse(fs.readFileSync(ficheiro, 'utf8'));
      return {
        jogos:          Array.isArray(d.jogos) ? d.jogos.length : null,
        patrocinadores: Array.isArray(d.patrocinadores) ? d.patrocinadores.length : null,
        temConfirmacao: Object.prototype.hasOwnProperty.call(d, 'confirmarEsvaziar'),
      };
    } catch (_) { return { jogos: '(sem ficheiro)', patrocinadores: '(sem ficheiro)', temConfirmacao: false }; }
  };
  const agora = () => new Date().toISOString();

  const JOGOS = [
    { id: 801, escalao: 'Sub-17', data: '2026-01-10', hora: '15:00', casa: 'Equipa Um', fora: 'Equipa Dois', estado: 'Agendado', local: '' },
    { id: 802, escalao: 'Sub-17', data: '2026-01-17', hora: '15:00', casa: 'Equipa Tres', fora: 'Equipa Quatro', estado: 'Agendado', local: '' },
  ];
  const PATROCINADORES = [
    { id: 701, nome: 'Apoio Um', nivel: 'Ouro', url: '', logo: '', ativo: true },
    { id: 702, nome: 'Apoio Dois', nivel: 'Prata', url: '', logo: '', ativo: true },
    { id: 703, nome: 'Apoio Tres', nivel: 'Prata', url: '', logo: '', ativo: true },
  ];

  // 1. Semear conteúdo a sério.
  r.semear = await pedir('/api/save.php',
    { cookie, corpo: { publicadoEm: agora(), jogos: JOGOS, patrocinadores: PATROCINADORES } });
  r.depoisDeSemear = noDisco();

  // 2. Publicar vazio por cima, sem confirmação: tem de recusar e não tocar no ficheiro.
  r.semConfirmar = await pedir('/api/save.php',
    { cookie, corpo: { publicadoEm: agora(), jogos: [], patrocinadores: [] } });
  r.depoisDeRecusar = noDisco();

  // 3. Confirmações que não correspondem: contagem errada, área a menos, área trocada.
  r.contagemErrada = await pedir('/api/save.php', { cookie, corpo: { publicadoEm: agora(),
    jogos: [], patrocinadores: [], confirmarEsvaziar: [{ area: 'jogos', antes: 99 }, { area: 'patrocinadores', antes: 3 }] } });
  r.areaAMenos = await pedir('/api/save.php', { cookie, corpo: { publicadoEm: agora(),
    jogos: [], patrocinadores: [], confirmarEsvaziar: [{ area: 'jogos', antes: 2 }] } });
  r.areaTrocada = await pedir('/api/save.php', { cookie, corpo: { publicadoEm: agora(),
    jogos: [], patrocinadores: [], confirmarEsvaziar: [{ area: 'atletas', antes: 2 }, { area: 'patrocinadores', antes: 3 }] } });
  r.depoisDasErradas = noDisco();

  // 4. A confirmação certa — exactamente as áreas e as contagens que o servidor devolveu.
  r.confirmada = await pedir('/api/save.php', { cookie, corpo: { publicadoEm: agora(),
    jogos: [], patrocinadores: [],
    confirmarEsvaziar: (r.semConfirmar.json || {}).esvaziamentos || [] } });
  r.depoisDeConfirmar = noDisco();

  // 5. Controlo: escrever conteúdo novo passa sem pergunta nenhuma.
  r.normal = await pedir('/api/save.php', { cookie, corpo: { publicadoEm: agora(), jogos: JOGOS } });
  r.depoisDoNormal = noDisco();

  // 6. Controlo: omitir uma área continua a querer dizer "inalterada".
  r.omitindo = await pedir('/api/save.php', { cookie, corpo: { publicadoEm: agora() } });
  r.depoisDeOmitir = noDisco();

  return r;
}

// A ferramenta que compara o .htaccess do servidor com o do repositório.
//
// Corre o comando a sério, em processo próprio, contra pares de ficheiros
// feitos para o efeito — não contra o .htaccess do projeto nem o da cópia
// do site. A ferramenta compara sempre com o .htaccess que estiver ao lado
// da pasta tools/, e por isso a sonda monta uma árvore mínima só sua: uma
// pasta tools/ com a ferramenta copiada lá para dentro e um .htaccess ao
// lado, que é o lado "repositório" de cada caso.
//
// Cada caso mede o código de saída e confirma que nenhum dos dois ficheiros
// de entrada foi alterado pela execução: a ferramenta tem de ser só de
// leitura, e isso prova-se por sha256 antes e depois, não por palavra.
function testarCompararHtaccess(raizOriginal) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'jsc-htaccess-'));
  const r = { casos: {} };
  try {
    fs.mkdirSync(path.join(base, 'tools'));
    fs.mkdirSync(path.join(base, 'entradas'));
    const ferramenta = path.join(base, 'tools', 'comparar-htaccess.js');
    const origem = path.join(raizOriginal, 'tools', 'comparar-htaccess.js');
    fs.copyFileSync(origem, ferramenta);

    const real = fs.readFileSync(path.join(raizOriginal, '.htaccess'), 'utf8');
    const MARCA_INI = '# BEGIN cPanel-generated php ini directives, do not edit';
    const MARCA_HANDLER = '# php -- BEGIN cPanel-generated handler, do not edit';
    const corte = real.indexOf(MARCA_INI);
    r.ficheiroReal = {
      temBlocoIni: corte !== -1,
      temBlocoHandler: real.indexOf(MARCA_HANDLER) !== -1,
      temCabecalhoDeAviso: /ESTE FICHEIRO NÃO ENTRA NOS DEPLOYS DE ROTINA/.test(real),
    };
    const nosso = corte === -1 ? real : real.slice(0, corte);
    const doCpanel = corte === -1 ? '' : real.slice(corte);

    // Ruído que o Apache não vê: o cabeçalho de aviso fora, a indentação
    // dobrada e um comentário novo pelo meio. Só na nossa parte — mexer na
    // indentação dentro dos blocos do cPanel mudaria a comparação byte a
    // byte, que é de propósito exacta.
    const comRuido = nosso.split('\n')
      .filter((l) => !/ESTE FICHEIRO NÃO ENTRA|^# ={10}/.test(l))
      .map((l) => l.replace(/^(\s+)/, '$1$1'))
      .join('\n') + '\n# comentário acrescentado pela sonda\n' + doCpanel;

    // Variantes com uma divergência cada, do lado indicado no nome.
    const semHandler = (() => {
      const i = real.indexOf(MARCA_HANDLER);
      return i === -1 ? real : real.slice(0, i);
    })();
    const phpAntigo = real.replace(
      /(AddHandler\s+application\/x-httpd-ea-php)83/, '$182');
    const semRegraDeUploads = real.split('\n')
      .filter((l) => !/RewriteRule\s+\^uploads\/\.\*\\\.\(php\|phtml/.test(l))
      .join('\n');
    const semCsp = real.split('\n')
      .filter((l) => !/Header always set Content-Security-Policy/.test(l))
      .join('\n');
    const umPhpValueAMenos = real.replace('   php_value memory_limit 128M\n', '');

    const casos = [
      { nome: 'identico',             repo: real,                servidor: real, saida: 0 },
      { nome: 'so-comentarios',       repo: comRuido,            servidor: real, saida: 0 },
      { nome: 'repo-sem-handler',     repo: semHandler,          servidor: real, saida: 1 },
      { nome: 'versao-php-diferente', repo: phpAntigo,           servidor: real, saida: 1 },
      { nome: 'repo-sem-regra',       repo: semRegraDeUploads,   servidor: real, saida: 1 },
      { nome: 'servidor-sem-regra',   repo: real,          servidor: semCsp,     saida: 1 },
      { nome: 'php-value-a-menos',    repo: umPhpValueAMenos,    servidor: real, saida: 1 },
    ];

    casos.forEach((caso) => {
      const doServidor = path.join(base, 'entradas', caso.nome + '.htaccess');
      fs.writeFileSync(doServidor, caso.servidor);
      fs.writeFileSync(path.join(base, '.htaccess'), caso.repo);
      const antes = {
        servidor: sha(fs.readFileSync(doServidor, 'utf8')),
        repo: sha(fs.readFileSync(path.join(base, '.htaccess'), 'utf8')),
        ferramenta: sha(fs.readFileSync(ferramenta, 'utf8')),
      };
      const res = spawnSync(process.execPath, [ferramenta, doServidor],
        { encoding: 'utf8' });
      const depois = {
        servidor: sha(fs.readFileSync(doServidor, 'utf8')),
        repo: sha(fs.readFileSync(path.join(base, '.htaccess'), 'utf8')),
        ferramenta: sha(fs.readFileSync(ferramenta, 'utf8')),
      };
      r.casos[caso.nome] = {
        esperado: caso.saida,
        saida: res.status,
        texto: (res.stdout || '') + (res.stderr || ''),
        intactos: antes.servidor === depois.servidor && antes.repo === depois.repo
          && antes.ferramenta === depois.ferramenta,
        erros: ((res.stdout || '').match(/^ERRO\s+.*$/gm) || []),
        avisos: ((res.stdout || '').match(/^AVISO\s+.*$/gm) || []),
      };
    });

    // Entradas impossíveis: ficheiro que não existe, e sem argumento nenhum.
    const inexistente = path.join(base, 'entradas', 'nao-existe-xyz');
    const semFicheiro = spawnSync(process.execPath, [ferramenta, inexistente],
      { encoding: 'utf8' });
    r.semFicheiro = {
      saida: semFicheiro.status,
      texto: (semFicheiro.stdout || '') + (semFicheiro.stderr || ''),
      criou: fs.existsSync(inexistente),
    };
    const semArgumento = spawnSync(process.execPath, [ferramenta], { encoding: 'utf8' });
    r.semArgumento = {
      saida: semArgumento.status,
      texto: (semArgumento.stdout || '') + (semArgumento.stderr || ''),
    };

    // O número que o comando imprime tem de ser o mesmo que a função
    // exportada conta — se divergirem, uma das duas está a mentir.
    const mod = require(origem);
    r.directivasContadas = mod.directivas(real).length;
    const m = (r.casos.identico.texto || '').match(/directivas efectivas — (\d+) de cada lado/);
    r.directivasImpressas = m ? Number(m[1]) : null;
    r.nRegras = mod.REGRAS_DE_SEGURANCA.length;
    r.nBlocos = mod.BLOCOS_CPANEL.length;

    // A ferramenta não tem como escrever: a prova é no código, sem comentários.
    const fonte = fs.readFileSync(origem, 'utf8')
      .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    r.escritasNaFonte = (fonte.match(
      /writeFileSync|appendFileSync|createWriteStream|renameSync|unlinkSync|rmSync|mkdirSync|chmodSync|\bexec\b|spawn/g
    ) || []);

    // Nada foi criado nem apagado na árvore da sonda além do previsto.
    r.ficheirosNaArvore = fs.readdirSync(path.join(base, 'entradas')).sort();
    return r;
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

// A coluna Forma, no browser.
async function testarColunaForma(browser, url, linhas) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  await ctx.addInitScript((d) => {
    try {
      if (sessionStorage.getItem('jsc_semeado_forma')) return;
      sessionStorage.setItem('jsc_semeado_forma', '1');
      localStorage.setItem('jsc_painel_local', '1');
      localStorage.setItem('fpf_class_Sub-17', JSON.stringify(d));
    } catch (_) {}
  }, linhas);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
  await pg.waitForTimeout(700);
  const d = await pg.evaluate(() => Array.from(document.querySelectorAll('#classTable tr')).map((tr) => {
    const cel = tr.querySelector('td .forma');
    const pontos = cel ? Array.from(cel.querySelectorAll('.forma-dot')) : [];
    return {
      equipa: ((tr.querySelector('.team-cell span:last-child') || {}).textContent || '').replace(' ★', '').trim(),
      pontos: pontos.length,
      letras: pontos.map((p) => p.textContent).join(''),
      classes: pontos.map((p) => p.className.replace('forma-dot ', '')),
      altura: pontos.length ? pontos[0].offsetHeight : 0,
    };
  }));
  await ctx.close();
  return { linhas: d, erros };
}

// Sonda da colagem da classificação: o pts1fase e o forma.
//
// A colagem reconstruía as linhas de raiz e gravava por cima das guardadas: o
// pts1fase desaparecia e o forma ficava vazio — o _makeClassRow() escreve
// sempre forma: '', porque o ZeroZero não a dá e ela só pode ter vindo do
// editor manual. São os dois campos que a colagem não sabe produzir, e passaram
// a ser herdados da linha guardada com o mesmo nome.
//
// E os pontos da 1ª fase escritos na pré-visualização iam para a equipa errada
// se o texto mudasse entre Pré-visualizar e Guardar: o input era identificado
// pela posição e o guardar reinterpreta o texto. Passou a ser pelo nome.
//
// Conduz-se o painel a sério: abrirColar, previewColarClass, escrever nos
// inputs, trocar o texto se o cenário o pedir, guardarColarClass.
async function testarColagemPreserva(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
    const d = await pg.evaluate((a) => {
      localStorage.setItem('jsc_painel_local', '1');
      localStorage.setItem('fpf_class_Sub-17', JSON.stringify(a.guardadas));
      abrirColar('Sub-17', 'class', '');
      const ta = document.getElementById('colarClassTA');
      ta.value = a.texto;
      previewColarClass();
      const inputs = Array.from(document.querySelectorAll('[data-pts1fase]'));
      const ordemPrevisao = inputs.map((i) => i.closest('label').querySelector('span').textContent.trim());
      const atributos     = inputs.map((i) => i.dataset.pts1fase);
      if (a.pts1) inputs.forEach((inp, i) => { if (a.pts1[i] != null) inp.value = String(a.pts1[i]); });
      if (a.textoAntesDeGuardar) ta.value = a.textoAntesDeGuardar;
      guardarColarClass();
      let linhas = [];
      try { linhas = JSON.parse(localStorage.getItem('fpf_class_Sub-17') || '[]'); } catch (_) {}
      return { ordemPrevisao, atributos, linhas };
    }, c);
    await ctx.close();
    saida[c.nome] = { ...d, erros };
  }
  return saida;
}

// Sondas do mapa de logótipos das equipas — o db_logos.
//
// Os logótipos de todas as equipas de terceiros desapareceram da classificação
// pública depois de uma publicação. A cadeia, medida de ponta a ponta: uma
// colagem de classificação sem imagens gravava db_logos = "{}" num painel onde
// a chave não existia; o api/conteudo.php publicava essa chave vazia, que em
// JSON vira "logos": []; e o js/sync.js, cujo teste era só "if (data.logos)",
// aceitava o [] — verdadeiro em JavaScript — e substituía por ele o mapa do
// visitante. O emblema do clube continuava a aparecer, por ter recurso próprio,
// e os terceiros ficavam com o escudo das iniciais.
//
// Três guardas, uma por elo, e uma sonda por elo.

// Elo 1: a colagem da classificação, conduzida a sério no painel.
async function testarColagemLogos(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
    const d = await pg.evaluate((a) => {
      localStorage.setItem('jsc_painel_local', '1');
      if (a.logosAntes === null) localStorage.removeItem('db_logos');
      else localStorage.setItem('db_logos', JSON.stringify(a.logosAntes));
      const antes = localStorage.getItem('db_logos');
      abrirColar('Sub-17', 'class', '');
      document.getElementById('colarClassTA').value = a.texto;
      previewColarClass();
      const reconhecidas = document.querySelectorAll('[data-pts1fase]').length;
      guardarColarClass();
      let linhas = [];
      try { linhas = JSON.parse(localStorage.getItem('fpf_class_Sub-17') || '[]'); } catch (_) {}
      return { antes, depois: localStorage.getItem('db_logos'), reconhecidas,
        logosNasLinhas: linhas.map((r) => r.equipa + '=' + (r.logo || '(sem)')) };
    }, c);
    await ctx.close();
    saida[c.nome] = { ...d, erros };
  }
  return saida;
}

// Elo 2: a projeção pública, calculada pelo PHP do próprio pacote.
async function testarPublicacaoLogos(raiz) {
  const execFile = require('util').promisify(require('child_process').execFile);
  const casos = {
    ausente:      'null',
    vazio:        '[]',
    comEntradas:  "['teste louletano' => 'https://exemplo.test/logos/tl.png']",
  };
  const saida = {};
  for (const [nome, valor] of Object.entries(casos)) {
    const php = "require 'api/conteudo.php';"
      + '$c = [' + "'publicadoEm' => '2026-10-09T12:00:00Z', 'agenda' => [['id'=>1,'titulo'=>'T']]"
      + (valor === 'null' ? '' : ", 'logos' => " + valor) + '];'
      + '$p = jsc_conteudo_publico($c);'
      + "echo json_encode(['tem' => array_key_exists('logos', \$p), 'chaves' => array_keys(\$p), 'corpo' => \$p]);";
    const { stdout } = await execFile('php', ['-r', php], { cwd: raiz, timeout: 60000 });
    saida[nome] = JSON.parse(stdout);
  }
  return saida;
}

// Elo 3: o que o js/sync.js escreve no visitante, dado o corpo que o servidor
// entrega. O corpo é o que o PHP produziu de facto, não uma imitação.
async function testarSyncLogos(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    // Guarda de uma vez: o sync recarrega a página quando há conteúdo novo, e
    // sem isto o initScript voltava a semear — a sonda media a sua semente.
    await ctx.addInitScript((d) => {
      try {
        if (sessionStorage.getItem('jsc_semente_logos')) return;
        sessionStorage.setItem('jsc_semente_logos', '1');
        if (d === null) localStorage.removeItem('db_logos');
        else localStorage.setItem('db_logos', JSON.stringify(d));
      } catch (_) {}
    }, c.logosAntes);
    await ctx.route('**/api/load.php*', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: c.corpo,
    }));
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
    await pg.waitForTimeout(1500);
    const d = await pg.evaluate(() => ({
      logos: localStorage.getItem('db_logos'),
      agenda: localStorage.getItem('db_agenda'),
    }));
    await ctx.close();
    saida[c.nome] = { ...d, erros };
  }
  return saida;
}

// Sondas do editor manual de classificação.
//
// O formulário tem oito campos, e o guardar reconstruía a linha só a partir
// deles: tudo o que não estava no formulário era apagado. Medido numa gravação
// sem tocar em nada: perdiam-se o logo, o pts, o pts1fase, o dg e um campo
// inventado (serie), e o abrev era reescrito ("J.S" → "JC"). Na classificação
// pública o clube caía de 29 para 23 pontos e do primeiro para o segundo lugar.
//
// Passou a fundir sobre a linha de origem, reencontrada pelo data-idx do <tr> —
// pelo índice e não pelo nome, que é justamente o que se edita ali.
//
// Mede-se a conduzir o painel a sério: abrirEditorClass(), mexer nos inputs
// como uma pessoa mexe, salvarEditorClass(), e ler o que ficou no localStorage.
async function testarEditorPreservaCampos(browser, url, semente, modos) {
  const saida = {};
  for (const modo of modos) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
    const d = await pg.evaluate((a) => {
      const CHAVE = 'fpf_class_Sub-17';
      localStorage.setItem('jsc_painel_local', '1');
      localStorage.setItem(CHAVE, JSON.stringify(a.semente));
      abrirEditorClass('Sub-17', null);
      const trs = () => Array.from(document.querySelectorAll('#edClassTable tbody tr'));
      const idxAbertura = trs().map((tr) => tr.dataset.idx === undefined ? '(sem)' : tr.dataset.idx);

      if (a.modo === 'renomear') {
        trs()[0].querySelector('.ed-equipa').value = 'Juventude Sport Campinense';
      }
      if (a.modo === 'numeros') {
        // Clube: uma vitória passa a derrota e menos cinco golos marcados.
        const t0 = trs()[0];
        t0.querySelector('.ed-v').value  = '6';
        t0.querySelector('.ed-d').value  = '2';
        t0.querySelector('.ed-gm').value = '20';
        // E uma linha que nunca teve dg nem pts.
        trs()[2].querySelector('.ed-gm').value = '7';
      }
      if (a.modo === 'remover-meio') trs()[1].remove();
      if (a.modo === 'adicionar') {
        edClassAddRow();
        const novo = trs()[3];
        novo.querySelector('.ed-equipa').value = 'TESTE NOVA';
        novo.querySelector('.ed-j').value  = '4';
        novo.querySelector('.ed-v').value  = '3';
        novo.querySelector('.ed-e').value  = '1';
        novo.querySelector('.ed-gm').value = '9';
        novo.querySelector('.ed-gs').value = '2';
      }
      salvarEditorClass();
      let linhas = [];
      try { linhas = JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (_) {}
      return { idxAbertura, linhas };
    }, { modo, semente });
    await ctx.close();
    saida[modo] = { ...d, erros };
  }
  return saida;
}

// A consequência pública, medida de ponta a ponta: pontos e posição na
// classificação de resultados.html, antes e depois de abrir e guardar o editor
// sem tocar em nada.
async function testarEditorNaoPerdePontos(browser, url, semente) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  await ctx.addInitScript((d) => {
    try {
      if (sessionStorage.getItem('jsc_semeado_editor')) return;
      sessionStorage.setItem('jsc_semeado_editor', '1');
      localStorage.setItem('jsc_painel_local', '1');
      localStorage.setItem('fpf_class_Sub-17', JSON.stringify(d));
    } catch (_) {}
  }, semente);
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));

  const lerTabela = async () => {
    await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
    await pg.waitForTimeout(600);
    return pg.evaluate(() => Array.from(document.querySelectorAll('#classTable tr')).map((tr, i) => {
      const td = tr.querySelectorAll('td');
      return {
        pos: i + 1,
        equipa: ((tr.querySelector('.team-cell span:last-child') || {}).textContent || '').replace(' ★', '').trim(),
        pts: td[td.length - 2].textContent.trim(),
      };
    }));
  };

  const antes = await lerTabela();
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });
  await pg.evaluate(() => { abrirEditorClass('Sub-17', null); salvarEditorClass(); });
  const depois = await lerTabela();
  await ctx.close();
  return { antes, depois, erros };
}

// Sonda do emblema do clube na classificação de resultados.html.
//
// A linha do Campinense aparecia com o escudo amarelo "JC" em vez do logótipo.
// O db_logos só tem as chaves com a grafia que o ZeroZero escreveu na colagem
// ("js campinense"), e o nome do clube é justamente o que se renomeia no painel
// ("J.S. Campinense"): a procura é por igualdade exacta de string, logo não
// batia. As outras equipas, que ninguém renomeia, continuavam a resolver.
//
// Mede-se no browser, por cenário, cada um com o seu contexto limpo. As linhas
// são semeadas como o editor de classificação as grava: sem campo logo.
// O endereço local images/logo.svg existe de verdade no servidor de teste, pelo
// que o escudo tem de ficar escondido — é isso que prova que a imagem carregou.
async function testarEmblemaDoClube(browser, url, cenarios) {
  const saida = {};
  for (const c of cenarios) {
    const ctx = await browser.newContext({
      javaScriptEnabled: true,
      extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    });
    await ctx.addInitScript((d) => {
      try {
        if (sessionStorage.getItem('jsc_semeado_emblema')) return;
        sessionStorage.setItem('jsc_semeado_emblema', '1');
        localStorage.setItem('jsc_painel_local', '1');
        localStorage.setItem('fpf_class_Sub-17', JSON.stringify(d.linhas));
        localStorage.setItem('db_logos', JSON.stringify(d.logos));
        if (d.clube) localStorage.setItem('dados_clube', JSON.stringify(d.clube));
        else localStorage.removeItem('dados_clube');
      } catch (_) {}
    }, c);
    const pg = await ctx.newPage();
    const erros = [];
    pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
    await pg.goto(url + '/resultados.html', { waitUntil: 'load', timeout: 20000 });
    await pg.waitForTimeout(700);
    const linhas = await pg.evaluate(() => Array.from(document.querySelectorAll('#classTable tr')).map((tr) => {
      const img = tr.querySelector('img.team-logo');
      const badge = tr.querySelector('span.team-badge');
      return {
        equipa: (tr.querySelector('.team-cell span:last-child') || {}).textContent || '',
        src: img ? img.getAttribute('src') : null,
        // O onerror do <img> revela o escudo quando a imagem não carrega: é
        // por isto que "tem src" não basta para dizer que o emblema aparece.
        escudoVisivel: !!badge && badge.style.display !== 'none',
        escudoTexto: badge ? badge.textContent.trim() : null,
        escudoSC: !!badge && / team-badge--sc/.test(' ' + badge.className),
      };
    }));
    await ctx.close();
    saida[c.nome] = { linhas, erros };
  }
  return saida;
}

// Sonda do transporte do proxy — o api/buscar.php.
//
// No alojamento real o proxy respondia "Nao foi possivel obter o endereco":
// allow_url_fopen desligado e sem a extensão cURL, o PHP não tinha nenhum meio
// de fazer o pedido. Passou a usar cURL quando existe, com o stream como
// alternativa.
//
// Mede-se contra um servidor local, porque através do api/proxy.php não é
// possível: a allowlist desse endpoint só aceita domínios reais. O caminho sem
// cURL mede-se a sério, com -d disable_functions=curl_init.
async function testarTransporteDoProxy(raiz) {
  const http = require('http');
  const GRANDE = 5 * 1024 * 1024;
  const servidor = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ok') {
      const corpo = 'INICIO-OK...' + 'x'.repeat(600);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(corpo);
    } else if (u === '/redir') {
      res.writeHead(302, { Location: '/ok' }); res.end();
    } else if (u === '/redir-fora') {
      res.writeHead(302, { Location: 'https://exemplo.test/x' }); res.end();
    } else if (u === '/grande') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('INICIO-GRANDE'.padEnd(GRANDE, 'y'));
    } else if (u === '/erro') {
      res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('nao existe');
    } else {
      res.writeHead(500); res.end('?');
    }
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + servidor.address().port;

  // execFile e NÃO spawnSync: o spawnSync bloqueia o event loop do Node, e com
  // ele bloqueado este servidor não consegue responder ao PHP — as duas vias
  // esperavam o tempo limite e desistiam. O teste media o seu próprio bloqueio.
  const execFile = require('util').promisify(require('child_process').execFile);
  const correr = async (args) => {
    try {
      const { stdout } = await execFile('php', args, { cwd: raiz, timeout: 60000 });
      return JSON.parse((stdout || '').trim().split('\n').pop());
    } catch (e) {
      try { return JSON.parse(((e.stdout || '')).trim().split('\n').pop()); }
      catch (_) { return { erroDoHarness: ((e.stdout || '') + (e.stderr || e.message || '')).slice(0, 200) }; }
    }
  };
  const buscar = (caminho, ini = []) =>
    correr([...ini, 'tools/teste-buscar.php', base + caminho]);
  const dominio = (url, lista) =>
    correr(['tools/teste-buscar.php', '--dominio', url, lista]);

  // O cURL do PHP honra as variáveis http_proxy do ambiente, e este contentor
  // tem um proxy de saída: sem isto, um pedido a 127.0.0.1 seria entregue a ele.
  const LOCAL = ['-d', 'disable_functions='];
  const SEM_CURL = ['-d', 'disable_functions=curl_init'];
  const LISTA = 'zerozero.pt,afalgarve.pt';
  const r = {
    comCurl:         await buscar('/ok'),
    semCurl:         await buscar('/ok', SEM_CURL),
    semNada:         await buscar('/ok', [...SEM_CURL, '-d', 'allow_url_fopen=0']),
    redirect:        await buscar('/redir'),
    redirectSemCurl: await buscar('/redir', SEM_CURL),
    redirectFora:    await buscar('/redir-fora'),
    grande:          await buscar('/grande'),
    grandeSemCurl:   await buscar('/grande', SEM_CURL),
    erro404:         await buscar('/erro'),
    dominios: {
      zz:         await dominio('https://www.zerozero.pt/equipa/x', LISTA),
      zzRaiz:     await dominio('https://zerozero.pt/x', LISTA),
      af:         await dominio('https://www.afalgarve.pt/x', LISTA),
      fpf:        await dominio('https://www.fpf.pt/x', LISTA),
      parecido:   await dominio('https://naozerozero.pt/x', LISTA),
      sufixo:     await dominio('https://zerozero.pt.mau.test/x', LISTA),
      esquema:    await dominio('file:///etc/passwd', LISTA),
      porta:      await dominio('https://www.zerozero.pt:8080/x', LISTA),
      utilizador: await dominio('https://u:p@www.zerozero.pt/x', LISTA),
    },
  };
  await new Promise((ok) => servidor.close(ok));
  return r;
}

// Sonda do api/proxy.php — a sessão do painel tem de ser reconhecida.
//
// O endpoint estava na raiz do site, o único dos catorze endpoints autenticados
// fora de api/. No alojamento real a raiz não via a sessão: com o Admin
// autenticado no mesmo browser, o /api/auth.php?acao=estado devolvia a sessão e
// o /proxy.php respondia "Precisa de sessao no painel". Mudou de pasta, e isto
// fixa a propriedade que importa — a sessão criada pelo api/auth.php é a mesma
// que o api/proxy.php lê — mais o portão que o protege.
//
// Sem browser: cookies tratados à mão, de propósito, para a partilha do
// JSCSESSAO entre os dois endpoints ficar explícita no teste.
async function testarProxyAutenticado(url) {
  const r = { passos: [] };
  const cookieDe = (res) => {
    const sc = res.headers.get('set-cookie') || '';
    const m = sc.match(/JSCSESSAO=([^;]+)/);
    return m ? 'JSCSESSAO=' + m[1] : null;
  };
  const pedir = async (caminho, opcoes = {}) => {
    const h = { 'X-Forwarded-Proto': 'https' };
    if (opcoes.cookie) h['Cookie'] = opcoes.cookie;
    if (opcoes.corpo) { h['Content-Type'] = 'application/json'; h['X-JSC-Painel'] = '1'; }
    const res = await fetch(url + caminho, {
      method: opcoes.corpo ? 'POST' : 'GET',
      headers: h,
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      redirect: 'manual',
    });
    const texto = await res.text();
    return { estado: res.status, texto, cookie: cookieDe(res) };
  };
  const ZZ = '/api/proxy.php?url=' + encodeURIComponent('https://www.zerozero.pt/equipa/x');

  // 1. Sem sessão nenhuma.
  r.semSessao = await pedir(ZZ);

  // 2. Super Admin: criar a conta e guardar o cookie.
  const criar = await pedir('/api/auth.php?acao=criar-primeiro',
    { corpo: { utilizador: 'Admin', password: 'Teste12345ab', nome: 'Admin' } });
  r.criou = criar.estado === 200 && /"ok":true/.test(criar.texto);
  const cookieAdmin = criar.cookie;
  r.cookieAdmin = !!cookieAdmin;

  // 3. O painel vê a sessão (o controlo: é a medição de referência).
  const estado = await pedir('/api/auth.php?acao=estado', { cookie: cookieAdmin });
  r.painelVeSessao = /"sessao":\{/.test(estado.texto) && /super-admin/.test(estado.texto);

  // 4. O MESMO cookie no api/proxy.php: tem de passar o portão.
  r.comAdmin = await pedir(ZZ, { cookie: cookieAdmin });

  // 5. Domínio fora da allowlist, já com sessão válida.
  r.foraDaLista = await pedir('/api/proxy.php?url=' + encodeURIComponent('https://exemplo.test/x'),
    { cookie: cookieAdmin });

  // 6. Um perfil sem a capacidade importar.
  const criarCom = await pedir('/api/auth.php?acao=criar-utilizador',
    { cookie: cookieAdmin,
      corpo: { utilizador: 'ComunicaTeste', password: 'Teste12345ab', nome: 'Com', perfil: 'comunicacao' } });
  r.criouComunicacao = /"ok":true/.test(criarCom.texto);
  const entrar = await pedir('/api/auth.php?acao=entrar',
    { corpo: { utilizador: 'ComunicaTeste', password: 'Teste12345ab' } });
  r.entrouComunicacao = /"ok":true/.test(entrar.texto);
  r.semCapacidade = await pedir(ZZ, { cookie: entrar.cookie });

  return r;
}

// Sonda da pré-visualização da importação de jogos — o logótipo das equipas.
//
// O logoImg() devolve uma tag <img> já construída, com o endereço tratado pelo
// jscEscUrl(). O resultado ia envolvido em jscEsc(), que escapa os < e os >: a
// pré-visualização mostrava o código da imagem em texto em vez do logótipo.
//
// Mede-se com a colagem a sério: semeiam-se logótipos no db_logos, cola-se o
// texto dos jogos, chama-se o previewColarClass() e olha-se para o DOM.
async function testarPreviaDeJogos(browser, url) {
  const URL_BOA = 'https://exemplo.test/logos/equipa-casa.png';
  const URL_MA  = 'javascript:alert(1)';
  const URL_XSS = 'https://exemplo.test/y.png" onerror="window.__JSC_XSS=1';
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate((u) => {
    // teste equipa fora fica DE PROPÓSITO sem logótipo.
    localStorage.setItem('db_logos', JSON.stringify({
      'teste equipa casa': u.boa,
      'teste equipa mau': u.ma,
      'teste equipa xss': u.xss,
    }));
    // Pelo caminho real do painel: é o abrirColar() que põe o modo em 'jogos'.
    abrirColar('Sub-13', 'jogos', '');
    const ta = document.getElementById('colarClassTA');
    ta.value = [
      'TESTE EQUIPA CASA', '01 mar 2026', '2-1', 'TESTE EQUIPA FORA', 'Campo Teste',
      'TESTE EQUIPA MAU',  '02 mar 2026', '1-0', 'TESTE EQUIPA XSS',  'Campo Teste',
    ].join('\n');
    previewColarClass();

    const div = document.getElementById('colarClassPreview');
    const imgs = Array.from(div.querySelectorAll('img'));
    const linhas = Array.from(div.querySelectorAll('tbody tr')).map((tr) => ({
      texto: tr.textContent.replace(/\s+/g, ' ').trim(),
      imgs: tr.querySelectorAll('img').length,
      srcs: Array.from(tr.querySelectorAll('img')).map((i) => i.getAttribute('src')),
    }));
    return {
      markupComoTexto: /<img|&lt;img/.test(div.textContent),
      nImgs: imgs.length,
      srcs: imgs.map((i) => i.getAttribute('src')),
      onerros: imgs.map((i) => i.getAttribute('onerror')),
      linhas,
      xssDisparou: typeof window.__JSC_XSS !== 'undefined',
      preview: div.textContent.replace(/\s+/g, ' ').trim().slice(0, 240),
    };
  }, { boa: URL_BOA, ma: URL_MA, xss: URL_XSS });

  await ctx.close();
  return { URL_BOA, URL_MA, URL_XSS, ...d, erros };
}

// Sonda do editor de classificações.
//
// O nome da equipa passava por um esc() local que trocava " por &quot;, e o
// resultado ia depois pelo jscEsc(), que volta a escapar o & dessa entidade.
// Escape a dobrar, e só em nomes com aspas duplas — um & sozinho passava uma vez
// e voltava bem. E não era cosmético: o salvarEditorClass() lê o .value do input
// e grava-o tal e qual, pelo que Sporting "B" ficava gravado como
// Sporting &quot;B&quot;. Os outros casos — & , acentos, texto normal — já
// estavam certos antes, e estão aqui para garantir que continuam.
//
// Mede-se o que importa: o que aparece no campo, o que fica gravado depois de
// Guardar, e se o atributo continua escapado no HTML.
async function testarEditorClassificacoes(browser, url) {
  const nomes = [
    'Sporting "B"',
    'Loulé & Quarteira',
    'Associação União Atlético',
    'Sport Campinense',
    '<img src=x onerror=alert(1)>',
  ];
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.goto(url + '/admin/', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate((nomes) => {
    const CHAVE = 'fpf_class_Sub-13';
    localStorage.setItem(CHAVE, JSON.stringify(nomes.map((n, i) => ({
      equipa: n, j: 1, v: 1, e: 0, d: 0, gm: 2, gs: 1, forma: 'V',
    }))));
    abrirEditorClass('Sub-13', null);

    const inputs = Array.from(document.querySelectorAll('#edClassTable .ed-equipa'));
    const mostrado = inputs.map((i) => i.value);
    const atributo = inputs.map((i) => (i.outerHTML.match(/value="([^"]*)"/) || [])[1]);
    // Uma injeção de HTML não pode ter criado elementos dentro da tabela.
    const tabela = document.getElementById('edClassTable');
    const injetou = !!tabela.querySelector('img');

    salvarEditorClass();
    let gravado = [];
    try { gravado = JSON.parse(localStorage.getItem(CHAVE) || '[]').map((r) => r.equipa); } catch (_) {}
    return { mostrado, atributo, injetou, gravado };
  }, nomes);

  await ctx.close();
  return { nomes, ...d, erros };
}

// Sonda do service worker — a correcção J2 do Bloco 10.
//
// Antes, o ramo dos documentos guardava na cache tudo o que o servidor
// respondesse, sem olhar ao estado. Enquanto todas as páginas eram ficheiros
// estáticos isso era inofensivo. Com o E2 deixou de ser: o noticias.html?id=N
// responde 404 a sério, e uma 404 guardada passava a ser servida no lugar da
// página — inclusive depois de a notícia ser publicada.
//
// Mede-se com navegações a sério, e não com fetch(): o service worker decide
// pelo request.destination, e só uma navegação tem destination 'document'.
// ---- Navegação esperada vs erro a sério -----------------------------
// As sondas do service worker abriam uma página em contexto novo e avaliavam
// logo a seguir. Em contexto novo o localStorage está vazio, portanto o
// js/sync.js pede o /api/load.php no arranque (js/sync.js:202), recebe
// conteúdo que é todo novo para este contexto, e chama location.reload()
// (js/sync.js:192). Essa navegação chega quando o servidor responder — o
// waitUntil:'load' do goto não espera por ela — e se aterra a meio de um
// pg.evaluate() o contexto morre: "Execution context was destroyed". Medido
// nove vezes, nas três sondas, sempre no evaluate logo após o primeiro goto.
//
// A navegação é do próprio site e é esperada. Espera-se por ela com o sinal
// que o próprio código escreve, e não com um sleep: o js/sync.js marca
// jsc_sync_em no sessionStorage quando termina de decidir, em qualquer dos
// caminhos — sucesso (js/sync.js:182) ou falha (js/sync.js:118 e :195).
async function assentarSync(pg) {
  await pg.waitForFunction(() => {
    try { return sessionStorage.getItem('jsc_sync_em') !== null; } catch (_) { return true; }
  }, null, { timeout: 8000 }).catch(() => {});
  // Se ele decidiu recarregar, a marca já está escrita e o recarregamento vem
  // a seguir: esperar que a página volte a estar completa cobre-o.
  await pg.waitForLoadState('load').catch(() => {});
  await pg.waitForFunction(() => document.readyState === 'complete',
    null, { timeout: 8000 }).catch(() => {});
}

// A rede de segurança, e só para esta mensagem. Um TypeError, uma assertion
// falsa, um timeout de goto ou um erro de página continuam a subir e a falhar
// a bateria — nada aqui mascara uma falha real.
const JSC_CONTEXTO_PERDIDO = /Execution context was destroyed|Most likely the page has been closed/;

async function avaliarEstavel(pg, fn, arg) {
  try {
    return await pg.evaluate(fn, arg);
  } catch (e) {
    if (!JSC_CONTEXTO_PERDIDO.test(String((e && e.message) || e))) throw e;
    await assentarSync(pg);
    return await pg.evaluate(fn, arg);   // uma única repetição, já reatachada
  }
}

async function testarServiceWorker(browser, url) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  await pg.goto(url + '/noticias.html', { waitUntil: 'load', timeout: 20000 });
  await assentarSync(pg);
  await avaliarEstavel(pg, async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await pg.goto(url + '/noticias.html', { waitUntil: 'load', timeout: 20000 });
  await assentarSync(pg);
  const controlado = await avaliarEstavel(pg, () => !!navigator.serviceWorker.controller);

  const e200 = await pg.goto(url + '/noticias.html?id=1001', { waitUntil: 'load', timeout: 20000 });
  const e404 = await pg.goto(url + '/noticias.html?id=9999', { waitUntil: 'load', timeout: 20000 });
  await assentarSync(pg);

  const naCache = await avaliarEstavel(pg, async () => {
    const onde = {};
    for (const nome of await caches.keys()) {
      const c = await caches.open(nome);
      for (const p of ['/noticias.html', '/noticias.html?id=1001', '/noticias.html?id=9999']) {
        const r = await c.match(p);
        if (r) onde[p] = nome + ' (' + r.status + ')';
      }
    }
    return onde;
  });
  const versao = await avaliarEstavel(pg, () => caches.keys());
  await ctx.close();
  return {
    controlado,
    estado200: e200 ? e200.status() : 0,
    estado404: e404 ? e404.status() : 0,
    naCache, versao,
  };
}

// Sonda da sincronização com a página aberta — o separador que não se fecha.
//
// Reproduz o caso real que deu origem a isto: a página fica aberta, publica-se
// no painel, e o visitante não fecha o separador, não limpa cache e não
// acrescenta ?v=… ao endereço. O js/sync.js marcava jsc_sync_done no
// sessionStorage e isso era definitivo — o sessionStorage sobrevive a
// recarregamentos, a navegações e, no iOS, ao restauro de separadores. Um
// telemóvel com o separador aberto há dias nunca voltava a pedir o
// /api/load.php e ficava para sempre na versão antiga.
//
// A marca do último sync é envelhecida à mão em vez de se esperar o minuto de
// validade: é a mesma marca que o código consulta, por isso o caminho
// exercitado é o verdadeiro.
async function testarSincronizacaoAoVivo(browser, url, publicar, opcoes = {}) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    ...(opcoes.contexto || {}),
  });
  const pg = await ctx.newPage();
  const pedidos = [];
  const navegacoes = [];
  const erros = [];
  pg.on('request', (r) => { if (r.url().indexOf('/api/load.php') !== -1) pedidos.push(r.url()); });
  pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) navegacoes.push(f.url()); });
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));

  const alvo = opcoes.pagina || '/modalidade.html?id=601';
  await pg.goto(url + alvo, { waitUntil: 'load', timeout: 20000 });
  let controlado = false;
  if (opcoes.sw) {
    await pg.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await pg.goto(url + alvo, { waitUntil: 'load', timeout: 20000 });
    controlado = await pg.evaluate(() => !!navigator.serviceWorker.controller);
  }
  // Arranque: sync inicial e, se escreveu algo novo, o recarregamento único.
  await pg.waitForTimeout(1800);
  const antes = await pg.evaluate(() => document.body.innerText);
  const pedidosNoArranque = pedidos.length;
  const navegacoesNoArranque = navegacoes.length;

  // Publicar com a página aberta, sem lhe tocar.
  publicar();

  // O separador volta a ficar à frente.
  await pg.evaluate(() => {
    try { sessionStorage.setItem('jsc_sync_em', String(Date.now() - 120000)); } catch (_) {}
  });
  await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pg.waitForTimeout(2500);
  const depois = await pg.evaluate(() => document.body.innerText);
  const marcas = await pg.evaluate(() => {
    const ler = (f) => { try { return f(); } catch (_) { return null; } };
    return {
      sync: ler(() => sessionStorage.getItem('jsc_sync_em')),
      recarga: ler(() => sessionStorage.getItem('jsc_sync_recarregado')),
      done: ler(() => sessionStorage.getItem('jsc_sync_done')),
      publicado: ler(() => localStorage.getItem('jsc_publicado_em')),
    };
  });

  // Período de calma: é aqui que um ciclo de recarregamentos ou de pedidos se
  // denunciaria.
  const navegacoesAteAqui = navegacoes.length;
  const pedidosAteAqui = pedidos.length;
  await pg.waitForTimeout(3000);
  const estavel = navegacoes.length === navegacoesAteAqui && pedidos.length === pedidosAteAqui;

  await ctx.close();
  return {
    antes, depois, marcas, estavel, controlado, erros,
    pedidosNoArranque, pedidosTotal: pedidos.length,
    navegacoesNoArranque, navegacoesTotal: navegacoes.length,
  };
}

// Sonda do deploy de um script — a regressão medida num telemóvel real.
//
// Depois de um deploy, o Chrome continuou a executar o js/sync.js antigo da sua
// própria cache HTTP: o .js saía sem Cache-Control, o ↻ normal não revalida
// subrecursos frescos, e o ramo de JS do service worker fazia fetch() sem
// cache: 'no-store' — pelo que o "network-first" passava pela cache do browser
// e ainda guardava a cópia velha na cache do service worker. O Safari, com
// outra heurística, buscou o ficheiro novo e funcionou.
//
// Mede-se o que interessa: com o service worker a controlar, um js/sync.js
// alterado no servidor chega à página na navegação seguinte, pelo mesmo
// endereço. A marca é acrescentada ao fim do ficheiro, que é um IIFE e continua
// a funcionar.
async function testarScriptNovoChega(browser, url, raiz) {
  const ficheiro = path.join(raiz, 'js', 'sync.js');
  const original = fs.readFileSync(ficheiro, 'utf8');
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  const resultado = { controlado: false, antes: null, depois: null, naCache: 'não medido' };
  try {
    await pg.goto(url + '/index.html', { waitUntil: 'load', timeout: 20000 });
    await assentarSync(pg);
    await avaliarEstavel(pg, async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await pg.goto(url + '/index.html', { waitUntil: 'load', timeout: 20000 });
    await assentarSync(pg);
    resultado.controlado = await avaliarEstavel(pg, () => !!navigator.serviceWorker.controller);
    resultado.antes = await avaliarEstavel(pg, () => window.JSC_MARCA_DO_TESTE || null);

    fs.writeFileSync(ficheiro, original + '\nwindow.JSC_MARCA_DO_TESTE = "CHEGOU";\n');
    await pg.goto(url + '/index.html', { waitUntil: 'load', timeout: 20000 });
    await assentarSync(pg);
    resultado.depois = await avaliarEstavel(pg, () => window.JSC_MARCA_DO_TESTE || null);
    resultado.naCache = await avaliarEstavel(pg, async () => {
      for (const n of await caches.keys()) {
        const c = await caches.open(n);
        for (const req of await c.keys()) {
          if (req.url.indexOf('/js/sync.js') !== -1) {
            const t = await (await c.match(req)).text();
            return t.indexOf('JSC_MARCA_DO_TESTE') !== -1 ? 'nova' : 'velha';
          }
        }
      }
      return 'ausente';
    });
  } finally {
    fs.writeFileSync(ficheiro, original);
    await ctx.close();
  }
  return resultado;
}

// Sonda do funcionamento offline. Mede-se com uma navegação a sério e com a
// rede cortada no contexto, que é o que o service worker vê.
//
// UMA só navegação offline por contexto, e de propósito: medido neste Chromium,
// a segunda navegação offline seguida já chega ao servidor, e a emulação deixa
// de valer. Com uma navegação por contexto a medição é determinista.
async function testarOffline(browser, url, alvo) {
  const ctx = await browser.newContext({
    javaScriptEnabled: true,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  await pg.goto(url + '/index.html', { waitUntil: 'load', timeout: 20000 });
  await assentarSync(pg);
  await avaliarEstavel(pg, async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await pg.goto(url + '/index.html', { waitUntil: 'load', timeout: 20000 });
  await assentarSync(pg);
  const controlado = await avaliarEstavel(pg, () => !!navigator.serviceWorker.controller);
  const nomes = await avaliarEstavel(pg, () => caches.keys());
  const temOffline = await avaliarEstavel(pg, async () => {
    for (const n of await caches.keys()) {
      const r = await (await caches.open(n)).match('/offline.html');
      if (r) return r.status;
    }
    return 0;
  });

  await ctx.setOffline(true);
  let texto = '';
  try {
    await pg.goto(url + alvo, { waitUntil: 'load', timeout: 20000 });
    texto = await avaliarEstavel(pg, () => document.body.innerText.slice(0, 300));
  } catch (e) { texto = 'ERRO: ' + e.message; }
  await ctx.setOffline(false);
  await ctx.close();
  return { controlado, nomes, temOffline, texto };
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

// A formacao.html: os cartões dos escalões.
async function testarFormacao(browser, url, comJs, largura) {
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

  await pg.goto(url + '/formacao.html',
    { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const grelha = document.getElementById('categoriesGrid');
    const cartoes = Array.from(document.querySelectorAll('#categoriesGrid .category-card'));
    const doc = document.documentElement;
    // Cada cartão reduzido ao que interessa comparar: assim o cartão gerado
    // pelo servidor e o cartão desenhado pelo JavaScript comparam-se pelo
    // conteúdo, e não pela indentação de cada modelo.
    const lido = (c) => ({
      nome: (c.querySelector('.category-card__age') || {}).textContent || '',
      designacao: c.querySelector('.category-card__name')
        ? c.querySelector('.category-card__name').textContent : null,
      faixa: c.querySelector('.category-card__age-range')
        ? c.querySelector('.category-card__age-range').textContent : null,
      descricao: c.querySelector('.category-card__desc')
        ? c.querySelector('.category-card__desc').textContent : null,
      // null quando não existe <ul>; [] nunca deve acontecer (lista vazia).
      itens: c.querySelector('.category-card__list')
        ? Array.from(c.querySelectorAll('.category-card__list li')).map((li) => li.textContent.trim())
        : null,
      destaque: c.classList.contains('category-card--featured'),
      badge: !!c.querySelector('.category-card__badge'),
      // O href como o browser o resolveu, e o nome que o URLSearchParams
      // devolve a partir dele: é este que o js/escalao.js compara com o
      // db_escaloes.
      href: (c.querySelector('.esc-link') || {}).getAttribute
        ? c.querySelector('.esc-link').getAttribute('href') : '',
      ligacaoTag: (c.querySelector('.esc-link') || {}).tagName || '',
      escalaoDoUrl: (function () {
        const a = c.querySelector('.esc-link');
        if (!a) return null;
        try { return new URL(a.href).searchParams.get('escalao'); } catch (_) { return null; }
      })(),
    });
    return {
      cartoes: cartoes.length,
      cartoesVisiveis: cartoes.filter(visivel).length,
      lidos: cartoes.map(lido),
      listasVazias: cartoes.filter((c) => {
        const ul = c.querySelector('.category-card__list');
        return ul && ul.querySelectorAll('li').length === 0;
      }).length,
      vazio: !!(grelha && grelha.querySelector('.jsc-vazio')),
      vazioVisivel: visivel(grelha && grelha.querySelector('.jsc-vazio')),
      itens: grelha ? grelha.getAttribute('data-itens') : null,
      gerado: grelha ? grelha.getAttribute('data-gerado') : null,
      texto: grelha ? (grelha.textContent || '') : '',
      // Nenhuma ligação alcançável por teclado pode faltar: um cartão sem
      // <a href> não tem destino nenhum sem JavaScript.
      focaveis: Array.from(document.querySelectorAll('#categoriesGrid a[href]')).length,
      transbordo: doc.scrollWidth - doc.clientWidth,
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// A escalao.html?escalao=... — continua em JavaScript neste bloco. A sonda
// serve para provar o que saiu: a idade do cartão de cada atleta e a secção
// dos aniversários.
async function testarEscalao(browser, url, escalao, comJs) {
  const ctx = await browser.newContext({
    javaScriptEnabled: comJs,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: 1440, height: 900 });

  const erros = [];
  const ruido = (t) => RUIDO.some((r) => r.test(t));
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text()); });
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  await pg.goto(url + '/escalao.html?escalao=' + encodeURIComponent(escalao),
    { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });

  const d = await pg.evaluate(() => {
    const jogadores = Array.from(document.querySelectorAll('#escPlantel .esc-player'));
    return {
      jogadores: jogadores.length,
      metas: jogadores.map((j) => (j.querySelector('.esc-player__meta') || {}).textContent || ''),
      nomes: jogadores.map((j) => (j.querySelector('.esc-player__name') || {}).textContent || ''),
      aniversarios: !!document.getElementById('escAniversarios'),
      aniversariosLista: !!document.getElementById('escAniversariosLista'),
      cartoesAniversario: document.querySelectorAll('.birthday__card').length,
      staff: Array.from(document.querySelectorAll('#escTechnical .esc-staff-card')).length,
      staffEstilos: Array.from(document.querySelectorAll('#escTechnical .esc-staff__avatar'))
        .map((el) => el.getAttribute('style') || ''),
      // A folha de estilo do avatar resolvida pelo browser: se o url('...')
      // tivesse sido fechado por um apóstrofo, não haveria imagem nenhuma.
      staffImagens: Array.from(document.querySelectorAll('#escTechnical .esc-staff__avatar'))
        .map((el) => getComputedStyle(el).backgroundImage),
      texto: document.body.textContent || '',
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// Patrocinadores: a zona da página inicial e a página completa. Uma sonda para
// as duas, porque o que interessa é o mesmo — os cartões, as ligações e a
// ausência de níveis.
async function testarPatrocinadores(browser, url, pagina, comJs, largura) {
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

  await pg.goto(url + '/' + pagina,
    { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const naInicial = !!document.getElementById('sponsorsGrid');
    const caixa = document.getElementById(naInicial ? 'sponsorsGrid' : 'sponsorsContent');
    const cartoes = Array.from(document.querySelectorAll('.sponsor-card, .sp-card'));
    const doc = document.documentElement;
    const lido = (c) => ({
      etiqueta: c.tagName,
      href: c.tagName === 'A' ? c.getAttribute('href') : (c.querySelector('.sp-card__website')
        ? c.querySelector('.sp-card__website').getAttribute('href') : null),
      // O nome como o visitante o lê, venha do <h3>, do título ou do logótipo.
      nome: (c.querySelector('.sp-card__name, .sponsor-card__title, .sponsor-card__logo') || {}).textContent || '',
      sector: c.querySelector('.sp-card__sector, .sponsor-card__name')
        ? c.querySelector('.sp-card__sector, .sponsor-card__name').textContent : null,
      desde: c.querySelector('.sp-card__since') ? c.querySelector('.sp-card__since').textContent : null,
      alt: c.querySelector('img') ? c.querySelector('img').getAttribute('alt') : null,
      // A imagem resolveu? Se o src tivesse ficado mal escapado, não havia.
      imagemOk: c.querySelector('img') ? c.querySelector('img').complete : null,
      classes: c.className,
    });
    return {
      cartoes: cartoes.length,
      cartoesVisiveis: cartoes.filter(visivel).length,
      lidos: cartoes.map(lido),
      grelhas: document.querySelectorAll('.sp-grid').length,
      // Um <a> de cartão sem href não recebe foco nem é anunciado como
      // ligação. Não pode existir nenhum.
      ancorasSemHref: Array.from(document.querySelectorAll('a.sponsor-card, a.sp-card'))
        .filter((a) => !a.getAttribute('href')).length,
      focaveis: Array.from(document.querySelectorAll(
        '#sponsorsGrid a[href], #sponsorsContent a.sp-card__website[href]')).length,
      vazioVisivel: visivel(caixa && caixa.querySelector('.jsc-vazio, .sp-empty')),
      cta: !!document.querySelector('.sp-cta'),
      itens: caixa ? caixa.getAttribute('data-itens') : null,
      texto: caixa ? (caixa.textContent || '') : '',
      // Nenhum vestígio de nível na zona pública, nem em classes nem em
      // cabeçalhos. O nome de um patrocinador não conta: é conteúdo.
      classesDeNivel: Array.from(document.querySelectorAll('[class]'))
        .map((el) => (typeof el.className === 'string' ? el.className : '')).join(' ')
        .split(/\s+/).filter((c) => /(--ouro|--prata|--bronze|tier)/i.test(c)),
      transbordo: doc.scrollWidth - doc.clientWidth,
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// O painel: o modal de patrocinador não pode voltar a ter selector de nível, e
// a lista não pode voltar a agrupar por nível.
async function testarAdminPatrocinadores(browser, url) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });
  await pg.goto(url + '/admin/index.html', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate(() => {
    // Abre o modal de "Novo Patrocinador": o que se verifica é o HTML do
    // modal, não o acesso ao painel.
    const abre = document.getElementById('btnNovoPatrocinador');
    if (abre) abre.click();
    return {
      abriu: !!abre,
      temSelectorNivel: !!document.getElementById('mPTier'),
      temCampoLogotipo: !!document.getElementById('mPLogo'),
      opcoesDeNivel: /<option[^>]*>\s*(Ouro|Prata|Bronze)\s*<\/option>/i.test(document.body.innerHTML),
      listaComNiveis: /tier-label|sponsor-admin-card__tier-dot|dot--ouro/.test(document.body.innerHTML),
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// Modalidades: a grelha da página inicial.
async function testarModalidades(browser, url, comJs, largura) {
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

  await pg.goto(url + '/index.html',
    { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const grelha = document.getElementById('modalidadesGrid');
    const cartoes = Array.from(document.querySelectorAll('#modalidadesGrid .modality-card'));
    const doc = document.documentElement;
    const lido = (c) => {
      const capa = c.querySelector('.modality-card__icon-wrap');
      const icone = c.querySelector('.modality-card__icon');
      const caixa = c.querySelector('.modality-card__info');
      const lig = c.querySelector('.modality-card__link');
      return {
        nome: (c.querySelector('.modality-card__name') || {}).textContent || '',
        // null quando o elemento não existe; '' nunca deve acontecer.
        descricao: c.querySelector('.modality-card__desc')
          ? c.querySelector('.modality-card__desc').textContent : null,
        // null quando não há caixa de informação; [] nunca deve acontecer.
        itens: caixa
          ? Array.from(caixa.querySelectorAll('.modality-card__info-item')).map((i) => i.textContent.trim())
          : null,
        // O ícone como o visitante o lê: um <b> no valor tem de aparecer como
        // texto, não como negrito.
        icone: icone ? icone.textContent : null,
        iconeHtml: icone ? icone.innerHTML : null,
        iconeEscondido: icone ? icone.getAttribute('aria-hidden') : null,
        // A imagem resolvida pelo browser: se o url('...') tivesse sido
        // fechado por um apóstrofo, não haveria imagem nenhuma.
        fundo: capa ? getComputedStyle(capa).backgroundImage : '',
        fundoPos: capa ? getComputedStyle(capa).backgroundPosition : '',
        temStyle: capa ? capa.hasAttribute('style') : false,
        href: lig ? lig.getAttribute('href') : null,
        ligacaoTag: lig ? lig.tagName : null,
        // O id que o URLSearchParams devolve a partir do href: é este que o
        // js/modalidade.js compara com o db_modalidades.
        idDoUrl: (function () {
          if (!lig) return null;
          try { return new URL(lig.href).searchParams.get('id'); } catch (_) { return null; }
        })(),
        classes: c.className,
      };
    };
    return {
      cartoes: cartoes.length,
      cartoesVisiveis: cartoes.filter(visivel).length,
      lidos: cartoes.map(lido),
      caixasVazias: cartoes.filter((c) => {
        const caixa = c.querySelector('.modality-card__info');
        return caixa && caixa.querySelectorAll('.modality-card__info-item').length === 0;
      }).length,
      ligacoes: document.querySelectorAll('#modalidadesGrid a[href]').length,
      vazioVisivel: visivel(grelha && grelha.querySelector('.jsc-vazio')),
      itens: grelha ? grelha.getAttribute('data-itens') : null,
      texto: grelha ? (grelha.textContent || '') : '',
      transbordo: doc.scrollWidth - doc.clientWidth,
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// A modalidade.html — continua em JavaScript neste bloco. A sonda serve para
// as cinco correcções pontuais: o menu móvel, a imagem do herói, a modalidade
// inativa e a ausência de fallback.
async function testarPaginaModalidade(browser, url, id, opcoes = {}) {
  const ctx = await browser.newContext({
    javaScriptEnabled: opcoes.comJs !== false,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: opcoes.largura || 1440, height: 900 });

  const erros = [];
  const ruido = (t) => RUIDO.some((r) => r.test(t));
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text()); });
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  await pg.goto(url + '/modalidade.html?id=' + encodeURIComponent(id),
    { waitUntil: opcoes.comJs === false ? 'load' : 'networkidle', timeout: 20000 });

  if (opcoes.tema) await pg.evaluate((t) => document.documentElement.setAttribute('data-theme', t), opcoes.tema);
  // Um clique só no hamburger: com o ouvinte duplicado, o menu abria e
  // fechava no mesmo instante e nunca aparecia.
  if (opcoes.hamburger) { await pg.click('#hamburger'); await pg.waitForTimeout(120); }

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const hero = document.getElementById('modHero');
    const nav = document.getElementById('nav');
    const ham = document.getElementById('hamburger');
    return {
      nome: (document.getElementById('modNome') || {}).textContent || '',
      desc: (document.getElementById('modDesc') || {}).textContent || '',
      infoVisivel: visivel(document.getElementById('modInfoSection')),
      postsVisivel: visivel(document.getElementById('modPostsSection')),
      posts: document.querySelectorAll('.mod-post-card').length,
      heroFundo: hero ? getComputedStyle(hero).backgroundImage : '',
      menuAberto: !!(nav && nav.classList.contains('open')),
      menuAria: ham ? ham.getAttribute('aria-expanded') : null,
      corDoNome: document.getElementById('modNome')
        ? getComputedStyle(document.getElementById('modNome')).color : '',
      texto: document.body.textContent || '',
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// Galeria e vídeos. Uma sonda para as três zonas: o que interessa é o mesmo —
// os cartões, as imagens, as ligações e a caixa que abre.
async function testarMedia(browser, url, pagina, comJs, largura, opcoes = {}) {
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
    // O YouTube não é contactado no teste: as miniaturas são externas, e o que
    // se verifica é o endereço, não a imagem.
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });

  await pg.goto(url + '/' + pagina, { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });

  // Abrir a caixa pelo teclado, para medir o foco e o scroll.
  let scrollAntes = 0, scrollDepois = 0;
  if (opcoes.teclado) {
    await pg.focus(opcoes.teclado);
    scrollAntes = await pg.evaluate(() => window.scrollY);
    await pg.keyboard.press(opcoes.tecla || 'Enter');
    await pg.waitForTimeout(150);
    scrollDepois = await pg.evaluate(() => window.scrollY);
  } else if (opcoes.clicar) {
    await pg.click(opcoes.clicar);
    await pg.waitForTimeout(150);
  }
  if (opcoes.tab) { await pg.keyboard.press('Tab'); await pg.waitForTimeout(80); }
  if (opcoes.escape) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); }
  if (opcoes.seta) { await pg.keyboard.press(opcoes.seta); await pg.waitForTimeout(120); }

  const d = await pg.evaluate(() => {
    const visivel = (el) => !!el && getComputedStyle(el).display !== 'none' && !el.hidden;
    const caixa = document.getElementById('lightbox') || document.getElementById('videoModal');
    const cartoes = Array.from(document.querySelectorAll(
      '#galleryGrid [data-idx], #galeriaGrid .galeria-item, #videosGrid .video-card'));
    const grelha = document.getElementById('galleryGrid')
      || document.getElementById('galeriaGrid') || document.getElementById('videosGrid');
    const doc = document.documentElement;
    const frame = document.getElementById('videoFrame');
    const lido = (c) => {
      const fundo = c.classList.contains('galeria-item')
        ? c.querySelector('.galeria-item__bg') : c;
      return {
        etiqueta: c.tagName,
        href: c.getAttribute('href'),
        rotulo: c.getAttribute('aria-label'),
        legenda: (c.querySelector('.gallery__caption, .galeria-item__overlay-title, .video-card__title') || {}).textContent || '',
        fundo: fundo ? getComputedStyle(fundo).backgroundImage : '',
        fundoPos: fundo ? getComputedStyle(fundo).backgroundPosition : '',
        fundoSize: fundo ? getComputedStyle(fundo).backgroundSize : '',
        alt: c.querySelector('img') ? c.querySelector('img').getAttribute('alt') : null,
        src: c.querySelector('img') ? c.querySelector('img').getAttribute('src') : null,
        classes: c.className,
      };
    };
    return {
      cartoes: cartoes.length,
      cartoesVisiveis: cartoes.filter(visivel).length,
      lidos: cartoes.map(lido),
      secaoGaleria: !!document.getElementById('galeria'),
      esqueletos: document.querySelectorAll('.skeleton').length,
      filtros: document.querySelectorAll(
        '#galleryFilters .gallery__filter-btn, #galeriaFilters .news-filter-btn, #videosFilters .news-filter-btn').length,
      // getClientRects() e não o display do próprio botão: o <noscript>
      // esconde o contentor, e um botão dentro de um pai escondido continua a
      // ter display:inline-block. O que conta é se ocupa espaço na página.
      filtrosVisiveis: Array.from(document.querySelectorAll(
        '#galleryFilters .gallery__filter-btn, #galeriaFilters .news-filter-btn, #videosFilters .news-filter-btn'))
        .filter((el) => el.getClientRects().length > 0).length,
      botaoMais: (function () {
        const el = document.getElementById('galleryMore');
        return !!el && el.getClientRects().length > 0;
      })(),
      vazioVisivel: visivel(document.getElementById('galeriaEmpty'))
        || visivel(document.getElementById('videosEmpty')),
      itens: grelha ? grelha.getAttribute('data-itens') : null,
      caixaAberta: visivel(caixa),
      // Quem tem o foco agora: é assim que se sabe se a caixa o recebeu, se o
      // prendeu e se o devolveu.
      focado: document.activeElement ? (document.activeElement.id
        || document.activeElement.getAttribute('aria-label')
        || document.activeElement.className || document.activeElement.tagName) : '',
      focoDentroDaCaixa: !!(caixa && document.activeElement && caixa.contains(document.activeElement)),
      lbTitulo: (document.getElementById('lbTitle') || document.getElementById('vmTitle') || {}).textContent || '',
      lbContador: (document.getElementById('lbCounter') || {}).textContent || '',
      lbImagem: document.querySelector('.lightbox__img') ? document.querySelector('.lightbox__img').getAttribute('src') : null,
      iframeSrc: frame ? frame.getAttribute('src') : null,
      iframeTitle: frame ? frame.getAttribute('title') : null,
      iframeLazy: frame ? frame.getAttribute('loading') : null,
      iframeAllow: frame ? frame.getAttribute('allow') : null,
      iframeFull: frame ? frame.hasAttribute('allowfullscreen') : null,
      texto: document.body.textContent || '',
      transbordo: doc.scrollWidth - doc.clientWidth,
    };
  });
  await ctx.close();
  return { ...d, scrollAntes, scrollDepois, erros };
}

// O painel: o aviso editorial, as caixas de publicado e o limite coerente.
async function testarAdminMedia(browser, url) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });
  await pg.goto(url + '/admin/index.html', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate(() => {
    const fora = { limites: [] };
    // Modal da fotografia.
    if (typeof editFoto === 'function') {
      editFoto(-1);
      fora.fotoAviso = /dados pessoais/i.test(document.body.textContent || '')
        && /menores/i.test(document.body.textContent || '');
      fora.fotoAtivo = !!document.getElementById('mFotoAtivo');
      fora.fotoAtivoMarcado = !!(document.getElementById('mFotoAtivo') || {}).checked;
      var m = (document.body.innerHTML || '').match(/máx\.?\s*(\d+)\s*MB/i);
      if (m) fora.limites.push(m[1]);
      if (typeof closeModal === 'function') closeModal();
    }
    // Modal do vídeo.
    if (typeof editVideo === 'function') {
      editVideo(-1);
      fora.videoAtivo = !!document.getElementById('mVidAtivo');
      fora.videoAtivoMarcado = !!(document.getElementById('mVidAtivo') || {}).checked;
      if (typeof closeModal === 'function') closeModal();
    }

    // O id do YouTube vem do ajudante partilhado.
    fora.ytPartilhado = typeof jscVideoId === 'function'
      && jscVideoId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ';
    return fora;
  });
  await ctx.close();
  // O limite que a validação aplica de facto vem do ficheiro: o admin.js é um
  // script externo, e no browser o seu textContent está vazio.
  const codigo = fs.readFileSync(path.join(RAIZ_PROJETO, 'admin/js/admin.js'), 'utf8');
  const m = codigo.match(/file\.size > (\d+) \* 1024 \* 1024/);
  return { ...d, limiteReal: m ? m[1] : '?', erros };
}


// Os dois números sem fonte confirmada — "300+ Atletas" e "80+ Títulos" —
// deixaram de ser publicados na faixa da página inicial. Esta sonda mede o que
// a barra mostra de facto, com e sem JavaScript, e se sobrou algum cartão vazio.
async function testarEstatisticas(browser, url, comJs) {
  const ctx = await browser.newContext({
    javaScriptEnabled: comJs,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
  });
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: 1440, height: 900 });
  const erros = [];
  const ruido = (t) => RUIDO.some((r) => r.test(t));
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !ruido(m.text())) erros.push(m.text()); });
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });
  await pg.goto(url + '/index.html', { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });
  // O js/main.js anima a contagem dos números durante 900 ms. Medir antes disso
  // lê "11" onde está "12", e acusaria um defeito que não existe.
  if (comJs) await pg.waitForTimeout(1100);

  const d = await pg.evaluate(() => {
    const cartoes = Array.from(document.querySelectorAll('.hero__stats .stat'));
    const visiveis = cartoes.filter((c) => c.getClientRects().length > 0);
    return {
      total: cartoes.length,
      visiveis: visiveis.length,
      // O que cada cartão visível diz, já normalizado.
      conteudo: visiveis.map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
      // Um cartão visível sem número, ou sem etiqueta, é um cartão vazio.
      vazios: visiveis.filter((c) => {
        const n = c.querySelector('.stat__num'), e = c.querySelector('.stat__label');
        return !n || !e || n.textContent.trim() === '' || e.textContent.trim() === '';
      }).length,
      barra: (document.querySelector('.hero__stats') || {}).textContent
        ? document.querySelector('.hero__stats').textContent.replace(/\s+/g, ' ').trim() : '',
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// ---------------------------------------------------------------------
// BLOCO 9 — Institucional e SEO
// ---------------------------------------------------------------------
async function testarInstitucional(browser, url, pagina, comJs, largura) {
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
  await pg.goto(url + '/' + pagina, { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });
  if (comJs) await pg.waitForTimeout(400);

  const d = await pg.evaluate(() => {
    const meta = (n) => { const e = document.querySelector(`meta[name="${n}"]`); return e ? e.content : null; };
    const prop = (n) => { const e = document.querySelector(`meta[property="${n}"]`); return e ? e.content : null; };
    const can = document.querySelector('link[rel="canonical"]');
    const vis = (e) => !!e && e.getClientRects().length > 0;

    const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => { try { return JSON.parse(s.textContent); } catch (e) { return { ERRO: s.textContent.slice(0, 80) }; } });

    // Propriedades vazias em qualquer nível do JSON-LD.
    const vazias = [];
    const varrer = (o, caminho) => {
      if (o === null || typeof o !== 'object') return;
      Object.keys(o).forEach((k) => {
        const v = o[k];
        if (v === '' || v === null || (Array.isArray(v) && v.length === 0)) vazias.push(caminho + k);
        else varrer(v, caminho + k + '.');
      });
    };
    schemas.forEach((o, i) => varrer(o, 'schema' + i + '.'));

    const sociais = Array.from(document.querySelectorAll('.footer__social-link'));
    const hero = document.querySelector('.hero');

    return {
      titulo: document.title,
      desc: meta('description'),
      robots: meta('robots'),
      canonical: can ? can.getAttribute('href') : null,
      ogUrl: prop('og:url'),
      h1n: document.querySelectorAll('h1').length,

      schemas: schemas.map((o) => o['@type'] || 'ERRO'),
      jsonld: schemas,
      // O primeiro schema, ou um objecto vazio. Sem isto, uma asserção que
      // leia jsonld[0].name rebenta quando o bloco não existe — e um teste
      // que rebenta esconde todas as verificações seguintes.
      org: schemas[0] || {},
      jsonldVazias: vazias,
      jsonldN: schemas.length,

      // Rodapé
      rodapeCopyright: (document.querySelector('.footer__bottom p') || {}).textContent || null,
      rodapeMoradaHtml: (document.querySelector('.footer__contact .js-morada') || {}).innerHTML || null,
      rodapeMoradaTexto: (document.querySelector('.footer__contact .js-morada') || {}).textContent || null,
      rodapeTelefone: (document.querySelector('.footer__contact .js-telefone') || {}).textContent || null,
      rodapeEmail: (document.querySelector('.footer__contact .js-email') || {}).textContent || null,
      sociaisTotal: sociais.length,
      sociaisVisiveis: sociais.filter(vis).length,
      sociaisHrefs: sociais.map((a) => a.getAttribute('href')),
      sociaisRel: sociais.map((a) => a.getAttribute('rel')),
      sociaisNome: sociais.map((a) => a.getAttribute('aria-label')),
      // Uma ligação morta em qualquer parte da página, e as que são sociais.
      hrefsMortos: Array.from(document.querySelectorAll('a[href="#"]')).length,
      // As sociais são as que a decisão D1 cobre: nenhuma pode ficar com
      // href="#", e nenhuma sem endereço pode ficar visível.
      sociaisMortas: Array.from(document.querySelectorAll(
        '.footer__social-link[href="#"], .social-btn[href="#"]')).length,
      sociaisBotoesVisiveis: Array.from(document.querySelectorAll('.social-btn'))
        .filter((e) => e.getClientRects().length > 0).length,
      sociaisBotoesHrefs: Array.from(document.querySelectorAll('.social-btn'))
        .map((a) => a.getAttribute('href')),
      // Esquemas recusados em qualquer href.
      hrefsMaus: Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((h) => /^(javascript|vbscript|data):/i.test(h || '')),

      // Herói: o que o painel conseguiu pôr no CSS e no HTML
      heroTitleHtml: (document.getElementById('heroTitle') || {}).innerHTML || null,
      heroBg: hero ? hero.style.backgroundImage : null,
      heroBgComputado: hero ? getComputedStyle(hero).backgroundImage.slice(0, 200) : null,
      heroPos: hero ? getComputedStyle(hero).backgroundPosition : null,
      heroBt1: (document.getElementById('heroBt1') || {}).getAttribute
        ? document.getElementById('heroBt1').getAttribute('href') : null,
      heroBt2: (document.getElementById('heroBt2') || {}).getAttribute
        ? document.getElementById('heroBt2').getAttribute('href') : null,
      // Algum payload do painel chegou a correr?
      xss: window.__XSS__ === 1,

      // Estatísticas
      stats: Array.from(document.querySelectorAll('.hero__stats .stat'))
        .filter(vis).map((e) => e.textContent.replace(/\s+/g, ' ').trim()),

      transbordo: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      textoTodo: (document.body.textContent || '').replace(/\s+/g, ' '),
    };
  });
  await ctx.close();
  return { ...d, erros };
}

// ---------------------------------------------------------------------
// BLOCO 8 — História: cronologia e palmarés
// ---------------------------------------------------------------------
async function testarHistoria(browser, url, comJs, largura, opcoes = {}) {
  const ctx = await browser.newContext({
    javaScriptEnabled: comJs,
    extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' },
    reducedMotion: opcoes.movimentoReduzido ? 'reduce' : 'no-preference',
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
  if (opcoes.imprimir) await pg.emulateMedia({ media: 'print' });

  await pg.goto(url + '/historia.html', { waitUntil: comJs ? 'networkidle' : 'load', timeout: 20000 });

  // Rolar até ao fim, para que a revelação tenha oportunidade de correr. O
  // IntersectionObserver só dispara entre fotogramas: um ciclo inteiro dentro
  // de um único evaluate() não lhe dá nenhum, e mediria zero revelados sempre.
  if (comJs && !opcoes.semRolar) {
    const altura = await pg.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < altura + 900; y += 600) {
      await pg.evaluate((v) => window.scrollTo(0, v), y);
      await pg.waitForTimeout(90);
    }
    await pg.evaluate(() => window.scrollTo(0, 0));
    // A transição da revelação dura 0,55 s: esperar menos do que isso mede
    // itens a meio caminho e acusaria um defeito que não existe.
    await pg.waitForTimeout(750);
  }

  const d = await pg.evaluate(() => {
    const vis = (el) => !!el && el.getClientRects().length > 0;
    const tl = document.getElementById('historiaTimeline');
    const pm = document.getElementById('historiaPalmares');
    const marcos = Array.from(document.querySelectorAll('.timeline-item'));
    const cartoes = Array.from(document.querySelectorAll('.palmares-card'));
    const doc = document.documentElement;
    const texto = document.body.textContent || '';
    const semComentarios = (document.body.innerHTML || '');

    return {
      // Cronologia
      marcos: marcos.length,
      marcosVisiveis: marcos.filter(vis).length,
      anos: Array.from(document.querySelectorAll('.timeline-year')).map((e) => e.textContent.trim()),
      anosMovel: Array.from(document.querySelectorAll('.timeline-card__year-mobile')).map((e) => e.textContent.trim()),
      titulos: Array.from(document.querySelectorAll('.timeline-card__title')).map((e) => e.textContent.trim()),
      descricoes: document.querySelectorAll('.timeline-card__desc').length,
      destaques: document.querySelectorAll('.timeline-item--destaque').length,
      tlGerado: tl ? tl.getAttribute('data-gerado') : null,
      tlItens: tl ? tl.getAttribute('data-itens') : null,
      tlVazio: !!(tl && tl.querySelector('.historia-empty')),

      // Palmarés
      cartoes: cartoes.length,
      cartoesVisiveis: cartoes.filter(vis).length,
      competicoes: Array.from(document.querySelectorAll('.palmares-card__title')).map((e) => e.textContent.trim()),
      metas: Array.from(document.querySelectorAll('.palmares-card__meta')).map((e) => e.textContent.trim()),
      escaloes: Array.from(document.querySelectorAll('.palmares-card__badge')).map((e) => e.textContent.trim()),
      pmGerado: pm ? pm.getAttribute('data-gerado') : null,
      pmItens: pm ? pm.getAttribute('data-itens') : null,
      pmVazio: !!(pm && pm.querySelector('.historia-empty')),

      // Imagens dos marcos: decorativas, e resolvidas pelo browser.
      imagens: Array.from(document.querySelectorAll('.timeline-card__img')).map((i) => ({
        src: i.getAttribute('src'),
        alt: i.getAttribute('alt'),
        ariaHidden: i.getAttribute('aria-hidden'),
        resolvida: i.currentSrc || '',
        completa: i.complete && i.naturalWidth > 0,
      })),
      imgSemSrc: Array.from(document.images).filter((i) => (i.getAttribute('src') || '') === '').length,

      // Acessibilidade e estrutura
      h1: Array.from(document.querySelectorAll('h1')).map((e) => e.textContent.trim()),
      h2: Array.from(document.querySelectorAll('main h2')).map((e) => e.textContent.trim()),
      h3: document.querySelectorAll('h3').length,
      anima: doc.classList.contains('jsc-anima'),
      naoRevelados: document.querySelectorAll('.tl-reveal:not(.tl-visible)').length,
      // O que está no ecrã não pode estar invisível: é esta a garantia que
      // interessa. Quantos itens estão dentro da janela e com opacidade 0?
      detalheInvisiveis: Array.from(document.querySelectorAll('.timeline-item, .palmares-card'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), op: getComputedStyle(el).opacity,
                   rev: el.classList.contains('tl-reveal'),
                   vis: el.classList.contains('tl-visible') };
        })
        .filter((x) => x.top < window.innerHeight && x.top > -200 && parseFloat(x.op) < 0.9)
        .slice(0, 5),
      invisiveisNoEcra: Array.from(document.querySelectorAll('.timeline-item, .palmares-card'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > window.innerHeight) return false;
          return parseFloat(getComputedStyle(el).opacity) < 0.9;
        }).length,
      opacidades: marcos.slice(0, 3).map((m) => getComputedStyle(m).opacity),
      transbordo: doc.scrollWidth - doc.clientWidth,

      // O que não pode voltar
      temCarregar: /A carregar/i.test(texto),
      temFaixa: !!document.querySelector('.historia-strip'),
      temHStat: /hStat\d/.test(semComentarios.replace(/<!--[\s\S]*?-->/g, '')),
      temSeculo: /Mais de um século/.test(texto),
      temTitulos80: /80\+/.test(texto),
      temAtletas300: /300\+/.test(texto),
      temLaranjeira: /Laranjeira/.test(texto),

      // Factos que têm de continuar lá
      textoTodo: texto.replace(/\s+/g, ' '),
    };
  });
  await ctx.close();
  return { ...d, erros };
}

async function testarAdminHistoria(browser, url) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push('exceção: ' + e.message));
  await pg.route('**', (rota) => {
    const alvo = rota.request().url();
    if (alvo.startsWith(url) || alvo.startsWith('data:') || alvo.startsWith('blob:')) return rota.continue();
    return rota.abort();
  });
  await pg.goto(url + '/admin/index.html', { waitUntil: 'networkidle', timeout: 20000 });

  const d = await pg.evaluate(() => {
    const fora = {};
    // A semente do painel vem do DB (admin/js/data.js), e é a única.
    fora.sementeDoDB = typeof DB !== 'undefined'
      && Array.isArray(DB.historia) && Array.isArray(DB.palmares);
    fora.sementeMarcos  = fora.sementeDoDB ? DB.historia.length : 0;
    fora.sementeTitulos = fora.sementeDoDB ? DB.palmares.length : 0;
    fora.sementeSemLaranjeira = fora.sementeDoDB
      && !JSON.stringify(DB.historia).includes('Laranjeira');
    fora.sementeComFaisca = fora.sementeDoDB
      && JSON.stringify(DB.historia).includes('Torneio Humberto Faísca');
    fora.sementeBoxe1994 = fora.sementeDoDB
      && DB.historia.some((h) => h.ano === 1994 && /boxe/i.test(h.titulo));
    fora.sementeTenisMesa2012 = fora.sementeDoDB
      && DB.palmares.some((t) => t.ano === 2012 && /Ténis de Mesa/.test(t.competicao));
    fora.sementeSemId8 = fora.sementeDoDB && !DB.historia.some((h) => h.id === 8);
    fora.sementeJuvenis2025 = fora.sementeDoDB
      && DB.palmares.some((t) => t.ano === 2025 && /Juvenis/.test(t.escalao || '')
                                 && /1\.ª Divisão Distrital/.test(t.observacao || ''));

    // Modal do marco: caixa de publicação marcada por omissão.
    if (typeof abrirModalHistoria === 'function') {
      abrirModalHistoria();
      fora.marcoAtivo = !!document.getElementById('hAtivo');
      fora.marcoAtivoMarcado = !!(document.getElementById('hAtivo') || {}).checked;
      if (typeof closeModal === 'function') closeModal();
    }
    // Modal do título: o escalão é texto livre, não um <select>.
    if (typeof abrirModalPalmares === 'function') {
      // Um título com um escalão que nenhuma lista fechada teria.
      abrirModalPalmares({ id: 1, competicao: 'X', escalao: 'Traquinas A', ano: 2019, observacao: '' });
      const campo = document.getElementById('pEscalao');
      fora.escalaoEtiqueta = campo ? campo.tagName : null;
      fora.escalaoPreservado = campo ? campo.value : null;
      fora.escalaoTemSugestoes = !!document.getElementById('pEscalaoSugestoes');
      fora.tituloAtivo = !!document.getElementById('pAtivo');
      fora.tituloAtivoMarcado = !!(document.getElementById('pAtivo') || {}).checked;
      if (typeof closeModal === 'function') closeModal();
    }
    // Os dois interruptores existem.
    fora.temToggles = typeof toggleHistoria === 'function' && typeof togglePalmares === 'function';
    return fora;
  });
  await ctx.close();
  return { ...d, erros };
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

    // ---- Notícia individual servida pelo servidor (E2) -----------
    // O endereço público é sempre o noticias.html?id=N. Quem responde é o
    // api/noticia.php, por reescrita interna do Apache. Sem Apache não há
    // .htaccess, e por isso não há E2 para medir.
    if (srv.modo !== 'apache') {
      console.log('\nnotícia individual (E2) — saltado: sem Apache não há .htaccess');
    } else {
      console.log('\nnotícia individual (E2) SEM JavaScript');
      const n1001 = dados.noticias.find((n) => String(n.id) === '1001');
      let e = await testarNoticiaE2(browser, srv.url, 1001, false, 1440);
      verificar('responde 200', e.estado === 200, 'respondeu ' + e.estado);
      verificar('o artigo está visível sem JavaScript',
        e.artigoVisivel && e.h1Artigo.length === 1 && e.h1Artigo[0] === 'TESTE A',
        'visível=' + e.artigoVisivel + ' títulos=' + JSON.stringify(e.h1Artigo));
      verificar('o corpo da notícia está no HTML',
        e.corpoHtml.includes('Resumo de <strong>teste</strong> A.'), e.corpoHtml.slice(0, 120));
      verificar('a data, a categoria e o tempo de leitura aparecem',
        /3 de Janeiro, 2020/.test(e.artigoTexto) && /TESTE/.test(e.artigoTexto)
        && /min de leitura/.test(e.artigoTexto), e.artigoTexto.slice(0, 160));
      verificar('a imagem aparece, na posição guardada',
        e.imagens === 1 && /news-article__img--top/.test(e.imagemClasse), e.imagemClasse);
      verificar('o caminho de volta é uma ligação a sério, não um botão morto',
        e.voltarEhLigacao && e.voltar === 'noticias.html',
        'ligação=' + e.voltarEhLigacao + ' href=' + e.voltar);
      verificar('a lista fica escondida: é a vista de artigo, não a de lista',
        !e.grelhaVisivel && !e.destaqueVisivel && !e.filtrosVisivel && !e.vazioVisivel && !e.maisVisivel,
        'grelha=' + e.grelhaVisivel + ' destaque=' + e.destaqueVisivel + ' filtros=' + e.filtrosVisivel
        + ' vazio=' + e.vazioVisivel + ' mais=' + e.maisVisivel);
      verificar('a lista servida não traz data-gerado — não é lista servida',
        e.grelhaGerado === null, String(e.grelhaGerado));
      verificar('as relacionadas aparecem, e cada uma com ligação a sério',
        e.relacionadas === 3 && e.relacionadasLigacoes.length === 3
        && e.relacionadasLigacoes.every((h) => /^noticias\.html\?id=\d+$/.test(h)),
        e.relacionadas + ' cartões, ligações ' + JSON.stringify(e.relacionadasLigacoes));
      verificar('sem transbordo horizontal', e.transbordo <= 0, '+' + e.transbordo + 'px');

      console.log('\nnotícia individual (E2): cabeça individual');
      verificar('o <title> é o da notícia, com o nome do clube',
        e.titulo === 'TESTE A – ' + dados.dadosClube.nome, JSON.stringify(e.titulo));
      verificar('a descrição é o texto da notícia, não a da lista',
        e.descricao === 'Resumo de teste A.', JSON.stringify(e.descricao));
      verificar('o canonical é o da notícia e o endereço oficial',
        e.canonical === 'https://campinense.pt/noticias.html?id=1001', String(e.canonical));
      verificar('o og:url é igual ao canonical',
        e.ogUrl === e.canonical, e.ogUrl + ' vs ' + e.canonical);
      verificar('nem o canonical nem o og:url deixam escapar o /api/noticia.php',
        !/api\/noticia\.php/.test(String(e.canonical) + String(e.ogUrl) + String(e.ldArtigo && e.ldArtigo.url)),
        String(e.canonical) + ' | ' + String(e.ogUrl));
      verificar('o og:type passa a article', e.ogType === 'article', String(e.ogType));
      verificar('o og:title e o twitter:title são os da notícia',
        e.ogTitle === e.titulo && e.twTitle === e.titulo, e.ogTitle + ' | ' + e.twTitle);
      verificar('a notícia com imagem leva og:image e twitter:card grande',
        e.ogImage === 'https://campinense.pt/' + n1001.imagem && e.twCard === 'summary_large_image',
        e.ogImage + ' | ' + e.twCard);
      verificar('há um e um só JSON-LD de artigo',
        e.nLdArtigo === 1, e.nLdArtigo + ' de ' + e.nLd + ' blocos');
      verificar('o JSON-LD do artigo tem headline, data e endereço da notícia',
        !!e.ldArtigo && e.ldArtigo.headline === 'TESTE A'
        && e.ldArtigo.datePublished === '2020-01-03T00:00:00+00:00'
        && e.ldArtigo.url === 'https://campinense.pt/noticias.html?id=1001',
        JSON.stringify(e.ldArtigo).slice(0, 180));
      verificar('o JSON-LD do artigo não tem propriedades vazias',
        !!e.ldArtigo && Object.values(e.ldArtigo).every((v) => v !== '' && v !== null),
        JSON.stringify(e.ldArtigo).slice(0, 180));
      verificar('o editor do JSON-LD vem do nome guardado, não de uma constante',
        !!e.ldArtigo && e.ldArtigo.publisher && e.ldArtigo.publisher.name === dados.dadosClube.nome,
        String(e.ldArtigo && e.ldArtigo.publisher && e.ldArtigo.publisher.name));
      verificar('a notícia individual não leva noindex', !e.robots, String(e.robots));

      // ---- Sem imagem, caracteres especiais, sem texto ----------
      console.log('\nnotícia individual (E2): casos de dados');
      e = await testarNoticiaE2(browser, srv.url, 1002, false, 1440);
      verificar('notícia sem imagem: nenhum og:image e nenhuma imagem no artigo',
        e.estado === 200 && e.ogImage === null && e.twImage === null && e.imagens === 0,
        'og:image=' + e.ogImage + ' imagens=' + e.imagens);
      verificar('notícia sem imagem: o twitter:card volta a summary',
        e.twCard === 'summary', String(e.twCard));

      e = await testarNoticiaE2(browser, srv.url, 1003, false, 1440);
      verificar('caracteres especiais: o & e o <b> ficam texto no título, não etiqueta',
        e.estado === 200 && e.h1Artigo[0] === 'TESTE C & <b>escape</b>' && !e.temTagB,
        JSON.stringify(e.h1Artigo) + ' tagB=' + e.temTagB);
      verificar('caracteres especiais: o <title> e o og:title saem escapados e legíveis',
        e.titulo === 'TESTE C & <b>escape</b> – ' + dados.dadosClube.nome
        && e.ogTitle === e.titulo, JSON.stringify(e.titulo));

      e = await testarNoticiaE2(browser, srv.url, 1023, false, 1440);
      verificar('notícia sem texto: diz que não há texto e não leva descrição inventada',
        e.estado === 200 && /Sem texto disponível/.test(e.artigoTexto) && e.descricao === null,
        'descrição=' + String(e.descricao));
      verificar('notícia sem texto: o JSON-LD sai sem description',
        !!e.ldArtigo && e.ldArtigo.description === undefined,
        String(e.ldArtigo && e.ldArtigo.description));

      e = await testarNoticiaE2(browser, srv.url, 1024, false, 1440);
      verificar('imagem com apóstrofo e parêntesis: o url() do CSS não fecha a meio',
        e.estado === 200 && e.imagens === 1
        && /logo\.png%3Fx%3Da%27b%281%29|logo\.png\?x=a%27b%281%29/.test(e.artigoHtml),
        (e.artigoHtml.match(/background-image:[^"]*/) || [''])[0].slice(0, 120));

      // ---- Notícia agendada que já venceu --------------------------
      e = await testarNoticiaE2(browser, srv.url, 1021, false, 1440);
      verificar('agendada cujo momento já passou: responde 200 e abre',
        e.estado === 200 && /TESTE P AGENDADA PASSADO/.test(e.artigoTexto), 'respondeu ' + e.estado);

      // ---- As três situações que dão 404 --------------------------
      console.log('\nnotícia individual (E2): 404');
      for (const [id, nota] of [[1004, 'não publicada'], [1022, 'agendada para o futuro'],
                                [9999, 'que não existe'], ['99999999999999999999', 'com id enorme']]) {
        e = await testarNoticiaE2(browser, srv.url, id, false, 1440, { esperar404: true });
        verificar(`notícia ${nota}: responde 404`, e.estado === 404, 'respondeu ' + e.estado);
        verificar(`notícia ${nota}: leva noindex no HTML e no cabeçalho`,
          e.robots === 'noindex, follow'
          && /noindex/.test(String(e.cabecalhos['x-robots-tag'] || '')),
          'meta=' + e.robots + ' cabeçalho=' + e.cabecalhos['x-robots-tag']);
        verificar(`notícia ${nota}: tem ligação a sério para as notícias`,
          e.ligacaoNoticias.includes('noticias.html'), JSON.stringify(e.ligacaoNoticias));
        verificar(`notícia ${nota}: não há canonical nem Open Graph num 404`,
          e.canonical === null && e.ogUrl === null && e.ogTitle === null && e.ogImage === null,
          'canonical=' + e.canonical + ' og:title=' + e.ogTitle);
        verificar(`notícia ${nota}: nenhum JSON-LD de artigo`,
          e.nLdArtigo === 0, e.nLdArtigo + ' blocos');
        verificar(`notícia ${nota}: nenhum vestígio do título da notícia`,
          !/TESTE D NAO PUBLICADA|TESTE Q AGENDADA FUTURO/.test(
            e.titulo + ' ' + e.artigoTexto + ' ' + String(e.descricao)),
          e.titulo);
        verificar(`notícia ${nota}: a lista não aparece por baixo do erro`,
          !e.grelhaVisivel && e.cartoes === 0, 'grelha=' + e.grelhaVisivel + ' cartões=' + e.cartoes);
      }

      // ---- Com JavaScript: não desenha por cima -------------------
      console.log('\nnotícia individual (E2) COM JavaScript');
      e = await testarNoticiaE2(browser, srv.url, 1001, true, 1440);
      verificar('com JavaScript o artigo continua um só, sem duplicação',
        e.h1Artigo.length === 1 && e.h1Artigo[0] === 'TESTE A' && e.relacionadas === 3,
        JSON.stringify(e.h1Artigo) + ' relacionadas=' + e.relacionadas);
      verificar('com JavaScript continua a haver um só JSON-LD de artigo',
        e.nLdArtigo === 1, e.nLdArtigo + ' blocos');
      verificar('com JavaScript o bloco servido é reconhecido e não é reescrito',
        e.dataId === '1001' && e.dataGerado === dados.publicadoEm,
        'data-id=' + e.dataId + ' data-gerado=' + e.dataGerado);
      verificar('com JavaScript a lista continua escondida',
        !e.grelhaVisivel && !e.destaqueVisivel, 'grelha=' + e.grelhaVisivel);
      verificar('sem erros de JavaScript', e.erros.length === 0, e.erros.join(' / '));
      verificar('sem transbordo horizontal', e.transbordo <= 0, '+' + e.transbordo + 'px');

      e = await testarNoticiaE2(browser, srv.url, 9999, true, 1440, { esperar404: true });
      verificar('404 com JavaScript: a mensagem fica, e a lista não é desenhada por cima',
        /não encontrada/i.test(e.artigoTexto) && e.cartoes === 0 && !e.grelhaVisivel,
        'cartões=' + e.cartoes + ' grelha=' + e.grelhaVisivel);
      verificar('404 com JavaScript: sem erros de consola', e.erros.length === 0, e.erros.join(' / '));

      // ---- Paridade: o que o servidor escreve e o que o JavaScript desenha
      // Pedir com &preview=0 faz o .htaccess não reescrever: a página vem
      // estática e é o js/noticias.js que desenha o artigo. Depois comparam-se
      // os dois HTML, com a origem normalizada — o JavaScript usa a origem a
      // sério do browser, e o servidor usa o endereço oficial do site.
      console.log('\nnotícia individual (E2): paridade PHP ↔ JavaScript');
      {
        const token = (h) => String(h)
          .split(encodeURIComponent(srv.url)).join('ORIGEM')
          .split(encodeURIComponent('https://campinense.pt')).join('ORIGEM')
          .split(srv.url).join('ORIGEM')
          .split('https://campinense.pt').join('ORIGEM');
        for (const id of [1001, 1002, 1003, 1023, 1024]) {
          const servidor = await testarNoticiaE2(browser, srv.url, id, false, 1440);
          const script   = await testarNoticiaE2(browser, srv.url, id, true, 1440, { semE2: true });
          verificar(`paridade do artigo ${id}: o servidor e o JavaScript escrevem o mesmo HTML`,
            token(servidor.artigoHtml) === token(script.artigoHtml),
            'servidor ' + servidor.artigoHtml.length + ' bytes, JavaScript ' + script.artigoHtml.length
            + '\n      servidor: ' + token(servidor.artigoHtml).slice(0, 400)
            + '\n      script:   ' + token(script.artigoHtml).slice(0, 400));
          verificar(`paridade do artigo ${id}: o mesmo JSON-LD`,
            JSON.stringify(servidor.ldArtigo) === JSON.stringify(script.ldArtigo),
            '\n      servidor: ' + JSON.stringify(servidor.ldArtigo)
            + '\n      script:   ' + JSON.stringify(script.ldArtigo));
        }
      }

      // ---- O ?preview=1 não passa pelo E2 ------------------------
      console.log('\nnotícia individual (E2): a pré-visualização fica de fora');
      {
        const pv = await testarNoticias(browser, srv.url, false, 1440, { query: '?id=1001&preview=1' });
        verificar('?preview=1 não é reescrito: a página vem estática, com a lista servida',
          pv.estado === 200 && pv.cartoes === N && !pv.artigo,
          'cartões=' + pv.cartoes + ' artigo=' + pv.artigo);
        const pv2 = await testarNoticias(browser, srv.url, true, 1440, {
          query: '?id=1001&preview=1',
          preview: { id: '__preview__', titulo: 'TESTE RASCUNHO E2', data: '2020-01-09',
                     categoria: 'TESTE', resumo: 'Rascunho que o servidor não conhece.' },
        });
        verificar('?preview=1 continua a ser o rascunho do browser, e só dele',
          pv2.banner && pv2.artigoTexto.includes('TESTE RASCUNHO E2'),
          'faixa=' + pv2.banner);
      }

      // ---- Guardas inversas: o que acontece quando o E2 não pode -----
      // Uma marca estragada não pode deixar a página de notícias em branco nem
      // devolver 500: serve-se a página como está, que é o que o visitante
      // receberia sem o E2.
      console.log('\nnotícia individual (E2): guardas inversas');
      {
        const notPath2 = path.join(raiz, 'noticias.html');
        const original = fs.readFileSync(notPath2, 'utf8');
        for (const [marca, nota] of [
          ['<!-- JSC:noticia-artigo:fim -->', 'sem a marca de fim do artigo'],
          ['<!-- JSC:noticia-head:inicio -->', 'sem a marca de início da cabeça'],
        ]) {
          fs.writeFileSync(notPath2, original.replace(marca, '<!-- ESTRAGADO -->'));
          const g = await testarNoticias(browser, srv.url, false, 1440, { query: '?id=1001' });
          verificar(`${nota}: responde 200 e a página de notícias continua de pé`,
            g.estado === 200 && g.cartoes === N,
            'estado=' + g.estado + ' cartões=' + g.cartoes);
          fs.writeFileSync(notPath2, original);
        }
        const reposto = await testarNoticiaE2(browser, srv.url, 1001, false, 1440);
        verificar('marcas repostas: o artigo volta a ser servido',
          reposto.estado === 200 && reposto.h1Artigo[0] === 'TESTE A', reposto.estado + '');
      }

      // Sem lista de notícias no conteúdo publicado — é o que acontece quando o
      // data/db.json ainda não foi enviado para o alojamento — não se decide
      // nada: serve-se a página como está. Uma lista que existe e está vazia é
      // outra coisa, e aí a resposta certa é 404.
      {
        const semChave = { ...dados };
        delete semChave.noticias;
        escreverDados(raiz, semChave);
        gerar(raiz);
        const g = await testarNoticias(browser, srv.url, false, 1440, { query: '?id=1001' });
        verificar('sem lista de notícias: responde 200 e serve a página, não 404',
          g.estado === 200 && !g.artigo, 'estado=' + g.estado + ' artigo=' + g.artigo);

        escreverDados(raiz, { ...dados, noticias: [] });
        gerar(raiz);
        const v = await testarNoticiaE2(browser, srv.url, 1001, false, 1440, { esperar404: true });
        verificar('lista vazia: aí sim, responde 404',
          v.estado === 404 && /não encontrada/i.test(v.artigoTexto), 'estado=' + v.estado);

        escreverDados(raiz, dados);
        gerar(raiz);
      }

      // ---- As sete larguras -------------------------------------
      console.log('\nnotícia individual (E2): as sete larguras');
      for (const largura of [320, 375, 414, 768, 1024, 1280, 1440]) {
        for (const comJs of [false, true]) {
          const w = await testarNoticiaE2(browser, srv.url, 1001, comJs, largura);
          verificar(`${largura}px ${comJs ? 'com' : 'sem'} JavaScript: artigo visível e sem transbordo`,
            w.artigoVisivel && w.h1Artigo.length === 1 && w.transbordo <= 0,
            'visível=' + w.artigoVisivel + ' títulos=' + w.h1Artigo.length + ' transbordo=+' + w.transbordo + 'px');
        }
      }

      // ---- As marcas novas não são regiões do E1 -----------------
      console.log('\nnotícia individual (E2): as marcas e o E1');
      {
        const not = fs.readFileSync(path.join(raiz, 'noticias.html'), 'utf8');
        for (const m of ['noticia-head', 'noticia-artigo']) {
          const ni = (not.match(new RegExp('<!-- JSC:' + m + ':inicio -->', 'g')) || []).length;
          const nf = (not.match(new RegExp('<!-- JSC:' + m + ':fim -->', 'g')) || []).length;
          verificar(`a marca ${m} aparece exactamente uma vez, em par`, ni === 1 && nf === 1,
            'início ' + ni + ', fim ' + nf);
        }
        // E o gerador não as conhece: o api/gerar.php não escreve lá dentro.
        const ger = fs.readFileSync(path.join(raiz, 'api', 'geracao.php'), 'utf8');
        verificar('o api/geracao.php não registou as marcas do E2 como blocos',
          !/JSC:noticia-head|JSC:noticia-artigo/.test(ger));
        // O conteúdo estático das duas regiões continua a ser o da lista: é o
        // que o visitante recebe quando pede o noticias.html sem id.
        const entre = (nome) => {
          const a = not.indexOf('<!-- JSC:' + nome + ':inicio -->');
          const b = not.indexOf('<!-- JSC:' + nome + ':fim -->');
          return a < 0 || b < a ? '' : not.slice(a, b);
        };
        verificar('depois de gerar, a cabeça da página continua a ser a da lista',
          /<title>Notícias –/.test(entre('noticia-head'))
          && /canonical" href="https:\/\/campinense\.pt\/noticias\.html"/.test(entre('noticia-head')),
          entre('noticia-head').slice(0, 120));
        verificar('depois de gerar, o contentor do artigo continua vazio e escondido',
          /<div id="notArticle" hidden><\/div>/.test(entre('noticia-artigo')),
          entre('noticia-artigo').slice(0, 160));
      }

      // ---- Service worker: a 404 não pode ficar na cache (J2) -----
      console.log('\nnotícia individual (E2): o service worker e as respostas de erro');
      {
        const sw = await testarServiceWorker(browser, srv.url);
        verificar('o service worker ficou a controlar a página — a medição é válida',
          sw.controlado, 'controlado=' + sw.controlado + ' caches=' + JSON.stringify(sw.versao));
        verificar('a notícia que existe responde 200 e é guardada',
          sw.estado200 === 200 && !!sw.naCache['/noticias.html?id=1001'],
          JSON.stringify(sw.naCache));
        verificar('a notícia que não existe responde 404 e NÃO é guardada',
          sw.estado404 === 404 && !sw.naCache['/noticias.html?id=9999'],
          'estado ' + sw.estado404 + ' ' + JSON.stringify(sw.naCache));
        verificar('o ramo das páginas do sw.js verifica o estado antes de guardar',
          /if \(ehPagina\)[\s\S]{0,900}?res\.status === 200[\s\S]{0,200}?c\.put/.test(
            fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8')));
      }

      // ---- Segurança -------------------------------------------
      console.log('\nnotícia individual (E2): segurança');
      {
        const antes = fs.readFileSync(path.join(raiz, 'data', 'db.json'), 'utf8');
        const r405 = await fetch(srv.url + '/noticias.html?id=1001', { method: 'POST' });
        verificar('POST ao endereço da notícia é recusado com 405', r405.status === 405,
          'respondeu ' + r405.status);
        const depois = fs.readFileSync(path.join(raiz, 'data', 'db.json'), 'utf8');
        verificar('nenhum pedido ao E2 alterou os dados publicados', antes === depois);
        verificar('o api/noticia.php não tem uma única instrução de escrita',
          !/file_put_contents|fwrite|rename\(|unlink\(|mkdir\(/.test(
            fs.readFileSync(path.join(raiz, 'api', 'noticia.php'), 'utf8')));
        verificar('o api/noticia.php não requer o api/sessao.php nem o api/geracao.php',
          !/^\s*(require|include)(_once)?[^\n]*(sessao|geracao)\.php/m.test(
            fs.readFileSync(path.join(raiz, 'api', 'noticia.php'), 'utf8')));
        for (const m of ['noticia-head', 'noticia-artigo', 'noticia-lista-oculta']) {
          const r = await fetch(srv.url + '/modelos/' + m + '.php');
          verificar(`/modelos/${m}.php responde 403`, r.status === 403, 'respondeu ' + r.status);
        }
      }

      // ---- XSS: um resumo com código não chega à página ----------
      console.log('\nnotícia individual (E2): o filtro de HTML aplica-se ao servir');
      {
        const sujos = JSON.parse(JSON.stringify(dados));
        sujos.noticias = sujos.noticias.map((n) => String(n.id) === '1001' ? {
          ...n,
          resumo: '<p>Texto bom</p><script>window.__xss=1</script>'
                + '<img src=x onerror="window.__xss=2">'
                + '<a href="javascript:window.__xss=3">ligação</a>'
                + '<p style="position:fixed;top:0">posicionado</p>',
        } : n);
        escreverDados(raiz, sujos);
        gerar(raiz);
        const x = await testarNoticiaE2(browser, srv.url, 1001, false, 1440);
        verificar('o <script> guardado não chega ao HTML servido',
          x.estado === 200 && !x.temScript && !/window\.__xss/.test(x.artigoHtml),
          x.corpoHtml.slice(0, 200));
        verificar('o onerror e o javascript: também não',
          !x.temOnerror && !/javascript:/i.test(x.artigoHtml), x.corpoHtml.slice(0, 200));
        verificar('o texto legítimo sobreviveu ao filtro',
          /Texto bom/.test(x.artigoTexto), x.artigoTexto.slice(0, 120));
        verificar('o position: do style foi retirado',
          !/position\s*:/i.test(x.corpoHtml), x.corpoHtml.slice(0, 200));
        const xjs = await testarNoticiaE2(browser, srv.url, 1001, true, 1440);
        // O src="x" do ensaio não existe de propósito: é o que faz o browser
        // tentar carregá-lo e falhar, que é quando um onerror correria. O 404
        // dele é esperado; qualquer outro erro de consola não é.
        const semRuidoDoEnsaio = xjs.erros.filter((t) => !/\/x\b|Failed to load resource/i.test(t));
        verificar('nada do que foi filtrado se executou, com ou sem JavaScript',
          x.xss === 'undefined' && xjs.xss === 'undefined' && semRuidoDoEnsaio.length === 0,
          'sem JS=' + x.xss + ' com JS=' + xjs.xss + ' ' + semRuidoDoEnsaio.join(' / '));
        verificar('a imagem do ensaio foi mesmo pedida e falhou — o onerror teria corrido',
          xjs.erros.some((t) => /\/x\b/.test(t)), xjs.erros.join(' / '));
        escreverDados(raiz, dados);
        gerar(raiz);
      }
    }

    // ---- Projeção pública do /api/load.php (Bloco 10.1) ----------
    // O endpoint é público e tem de continuar a ser: é a melhoria progressiva
    // de todas as páginas. O que não pode é entregar o data/db.json inteiro.
    console.log('\nprojeção pública do /api/load.php');
    {
      const pp = await testarProjecaoPublica(srv.url);
      verificar('responde 200 em JSON, sem ficar em cache',
        pp.estado === 200 && /application\/json/.test(pp.tipo) && /no-store/.test(pp.cache),
        pp.estado + ' · ' + pp.tipo + ' · ' + pp.cache);

      // ---- O que não pode sair --------------------------------------
      verificar('a notícia NÃO publicada não sai',
        !/TESTE D NAO PUBLICADA/.test(pp.bruto));
      verificar('a notícia agendada para o FUTURO não sai',
        !/TESTE Q AGENDADA FUTURO/.test(pp.bruto));
      verificar('a agendada JÁ VENCIDA sai — a política pública é exactamente a mesma',
        /TESTE P AGENDADA PASSADO/.test(pp.bruto));
      verificar(`a contagem é a da lista pública: ${N} notícias`,
        pp.dados && Array.isArray(pp.dados.noticias) && pp.dados.noticias.length === N,
        'obtive ' + (pp.dados && pp.dados.noticias ? pp.dados.noticias.length : '—'));

      for (const campo of ['encarregado', 'dataNascimento', 'serverToken', 'serverUrl']) {
        verificar(`o campo ${campo} nunca aparece`,
          !new RegExp('"' + campo + '"').test(pp.bruto));
      }
      verificar('o telefone e o e-mail de pessoas não aparecem',
        !/"telefone"/.test(pp.bruto) && !/"email"/.test(pp.bruto));
      verificar('o valor do segredo do mail.php não aparece em sítio nenhum',
        !/SEGREDO|serverToken/i.test(pp.bruto));

      // ---- Allowlist de campos, nas pessoas -------------------------
      const permitidosAtleta = ['id', 'nome', 'numero', 'posicao', 'escalao', 'estado', 'foto'];
      const atletas = (pp.dados && pp.dados.atletas) || [];
      verificar('os atletas da fixture saem, e só com os campos permitidos',
        atletas.length === dados.atletas.length
        && atletas.every((a) => Object.keys(a).every((k) => permitidosAtleta.includes(k))),
        atletas.length + ' atletas · campos: ' + JSON.stringify(atletas.length ? Object.keys(atletas[0]) : []));
      verificar('o nome do atleta continua lá — o que saiu foi o dado pessoal, não o registo',
        atletas.length > 0 && typeof atletas[0].nome === 'string' && atletas[0].nome !== '',
        JSON.stringify(atletas[0] || null));

      const permitidosTreinador = ['id', 'nome', 'cargo', 'foto', 'escalao', 'ativo'];
      const treinadores = (pp.dados && pp.dados.treinadores) || [];
      verificar('os treinadores saem sem telefone nem e-mail',
        treinadores.length === dados.treinadores.length
        && treinadores.every((t) => Object.keys(t).every((k) => permitidosTreinador.includes(k))),
        JSON.stringify(treinadores.length ? Object.keys(treinadores[0]) : []));

      // ---- Allowlist de chaves de topo ------------------------------
      const php = (expr) => spawnSync('php', ['-r',
        'require "api/conteudo.php"; ' + expr], { cwd: raiz, encoding: 'utf8' }).stdout.trim();
      const declaradas = JSON.parse(php('echo json_encode(jsc_chaves_publicas());'));
      const forasteiras = pp.chaves.filter((k) => !declaradas.includes(k));
      verificar('nenhuma chave entregue está fora da allowlist declarada',
        forasteiras.length === 0, 'fora: ' + forasteiras.join(', '));

      // ---- A guarda que importa: o que vier de novo fica privado -----
      // Acrescenta-se ao conteúdo publicado uma chave de topo e um campo de
      // atleta que ninguém declarou. Se aparecerem, a protecção é uma denylist
      // disfarçada e falha na primeira coisa que o painel ganhar.
      {
        const inventado = JSON.parse(JSON.stringify(dados));
        inventado.segredoInventado = 'ISTO NAO PODE SAIR';
        inventado.notasInternas = [{ id: 1, texto: 'ISTO TAMBEM NAO' }];
        inventado.atletas = inventado.atletas.map((a) => ({ ...a, nifInventado: '123456789' }));
        escreverDados(raiz, inventado);
        gerar(raiz);
        const inv = await testarProjecaoPublica(srv.url);
        verificar('chave de topo desconhecida NÃO aparece publicamente',
          !/segredoInventado|ISTO NAO PODE SAIR/.test(inv.bruto)
          && !/notasInternas|ISTO TAMBEM NAO/.test(inv.bruto));
        verificar('campo de atleta desconhecido NÃO aparece publicamente',
          !/nifInventado|123456789/.test(inv.bruto));
        verificar('e o resto continua a sair normalmente',
          inv.dados && Array.isArray(inv.dados.noticias) && inv.dados.noticias.length === N,
          'notícias: ' + (inv.dados && inv.dados.noticias ? inv.dados.noticias.length : '—'));
        escreverDados(raiz, dados);
        gerar(raiz);
      }

      // ---- O E1 e o E2 não passam pela projeção ----------------------
      const leitura = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('o api/geracao.php não conhece o load.php nem a projeção pública',
        !/load\.php|jsc_conteudo_publico/.test(leitura('api/geracao.php')));
      verificar('o api/noticia.php também não',
        !/load\.php|jsc_conteudo_publico/.test(leitura('api/noticia.php')));
      verificar('o api/load.php continua sem uma única instrução de escrita',
        !/file_put_contents|fwrite|rename\(|unlink\(|mkdir\(/.test(leitura('api/load.php')));
    }

    // ---- O armazém do painel não é sobreposto (B5) ----------------
    // O painel guarda o que está a ser escrito só no localStorage, e partilha-o
    // com o site público. Sem esta guarda, abrir uma página do site na aba do
    // painel trocava os rascunhos pela projeção pública — e o Publicar seguinte
    // apagava-os também do servidor.
    console.log('\no armazém do painel não é sobreposto (B5)');
    {
      // 24 notícias, como o painel as tem: as 21 públicas mais 3 por publicar.
      const comRascunhos = dados.noticias.slice();
      verificar('a fixture tem rascunhos para proteger',
        comRascunhos.length > N, comRascunhos.length + ' no painel, ' + N + ' públicas');

      const semMarca = await testarArmazemDoPainel(browser, srv.url,
        { noticias: comRascunhos, marca: false });
      verificar(`sem a marca do painel: o armazém é preenchido com as ${N} públicas`,
        semMarca.nNoticias === N, 'ficaram ' + semMarca.nNoticias);

      const comMarca = await testarArmazemDoPainel(browser, srv.url,
        { noticias: comRascunhos, marca: true });
      verificar(`com a marca do painel: os ${comRascunhos.length} registos ficam INTACTOS`,
        comMarca.nNoticias === comRascunhos.length,
        'ficaram ' + comMarca.nNoticias + ' de ' + comRascunhos.length);
      verificar('com a marca: nenhum rascunho desapareceu, nome a nome',
        ['TESTE D NAO PUBLICADA', 'TESTE Q AGENDADA FUTURO']
          .every((t) => comMarca.titulos.includes(t)),
        comMarca.titulos.filter((t) => /NAO PUBLICADA|FUTURO/.test(t)).join(' | '));
      verificar('com a marca: a página continua a mostrar as notícias publicadas',
        comMarca.cartoesVisiveis > 0, 'cartões visíveis: ' + comMarca.cartoesVisiveis);
      verificar('com a marca: sem erros de JavaScript',
        comMarca.erros.length === 0, comMarca.erros.join(' / '));

      const noPainel = await testarArmazemDoPainel(browser, srv.url, { pagina: '/admin/' });
      verificar('abrir o /admin/ escreve a marca do painel',
        noPainel.marca === '1', 'marca: ' + noPainel.marca);
    }

    // ---- Cache e sincronização depois de Publicar ------------------
    // O caso real: alterou-se uma modalidade, carregou-se em Publicar agora, e
    // o telemóvel continuou a mostrar a versão antiga — com o separador aberto,
    // sem limpar cache e sem ?v= no endereço. A modalidade.html não tem
    // conteúdo escrito pelo servidor: desenha-se toda a partir do localStorage,
    // e quem o enche é o js/sync.js.
    console.log('\ncache e sincronização depois de Publicar');
    {
      const fonteSync = fs.readFileSync(path.join(raiz, 'js', 'sync.js'), 'utf8');
      const fonteSw   = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
      // Sem comentários: o jsc_sync_done ainda é nomeado no comentário que
      // explica porque saiu, e o que interessa é que não haja código a lê-lo.
      const semComentarios = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
      const codigoSync = semComentarios(fonteSync);

      // -- R1: o js/sync.js --
      verificar('sync.js: já não há código a ler a marca definitiva jsc_sync_done',
        !/jsc_sync_done/.test(codigoSync),
        (codigoSync.match(/.*jsc_sync_done.*/) || [''])[0].trim());
      verificar('sync.js: a sincronização passou a ter validade de 60 segundos',
        /VALIDADE_MS = 60000/.test(fonteSync));
      verificar('sync.js: volta a verificar quando o separador fica visível',
        /addEventListener\('visibilitychange'/.test(fonteSync));
      verificar('sync.js: volta a verificar no pageshow, que cobre a bfcache',
        /addEventListener\('pageshow'/.test(fonteSync));
      verificar('sync.js: o pedido ao /api/load.php continua a ser no-store',
        /fetch\('\/api\/load\.php', \{ cache: 'no-store' \}\)/.test(fonteSync));
      verificar('sync.js: continua a anunciar jsc:synced para as páginas redesenharem',
        /dispatchEvent\(new CustomEvent\('jsc:synced'\)\)/.test(fonteSync));
      verificar('sync.js: um pedido de cada vez, com os três gatilhos',
        /if \(aCorrer \|\| ehPainel\(\) \|\| atual\(\)\) return;/.test(fonteSync)
        && /aCorrer = true;/.test(fonteSync));
      verificar('sync.js: o recarregamento é por publicação e não por sessão',
        /MARCA_RECARGA = 'jsc_sync_recarregado'/.test(fonteSync)
        && !/jsc_sync_reloaded/.test(codigoSync));
      verificar('sync.js: a guarda do armazém do painel (B5) ficou intacta',
        /jsc_painel_local/.test(fonteSync));

      // -- R3 e R4: o sw.js --
      verificar('sw.js: a cache subiu para jsc-v20',
        /CACHE_NAME = 'jsc-v20'/.test(fonteSw));
      verificar('sw.js: o activate apaga as caches antigas, com skipWaiting e clients.claim',
        /k !== CACHE_NAME[\s\S]{0,80}caches\.delete\(k\)/.test(fonteSw)
        && /self\.skipWaiting\(\)/.test(fonteSw) && /self\.clients\.claim\(\)/.test(fonteSw));
      verificar('sw.js: a navegação já não depende só do Request.destination',
        /e\.request\.mode === 'navigate'/.test(fonteSw));
      verificar('sw.js: o pedido das páginas recusa a cache HTTP do browser',
        /fetch\(e\.request, \{ cache: 'no-store' \}\)/.test(fonteSw));
      verificar('sw.js: o offline.html continua a ser o último recurso',
        /caches\.match\('\/offline\.html'\)/.test(fonteSw));

      // -- C1: o ramo de JS/CSS também recusa a cache HTTP do browser --
      verificar('sw.js: o ramo de JS/CSS pede com cache no-store',
        /endsWith\('\.js'\)[\s\S]{0,1400}?fetch\(e\.request, \{ cache: 'no-store' \}\)/.test(fonteSw));
      verificar('sw.js: o ramo de JS/CSS mantém a cópia guardada como recurso offline',
        /endsWith\('\.js'\)[\s\S]{0,1600}?\.catch\(\(\) => caches\.match\(e\.request\)\)/.test(fonteSw));
      // Ficam dois pedidos sem política, ambos de propósito: a rede de segurança
      // do ramo das páginas, para um browser que recuse o init, e o cache-first
      // das imagens, que não foi tocado. Um terceiro seria regressão.
      const semPolitica = (fonteSw.match(/fetch\(e\.request\)(?!,)/g) || []).length;
      verificar('sw.js: só dois pedidos sem política de cache, e ambos intencionais',
        semPolitica === 2, semPolitica + ' ocorrência(s)');
      verificar('sw.js: nenhum dos dois ramos network-first pede sem política',
        /fetch\(e\.request, \{ cache: 'no-store' \}\)/.test(fonteSw)
        && (fonteSw.match(/fetch\(e\.request, \{ cache: 'no-store' \}\)/g) || []).length === 2,
        (fonteSw.match(/fetch\(e\.request, \{ cache: 'no-store' \}\)/g) || []).length + ' com no-store');

      // -- C4: o sync.js versionado em todas as páginas que o carregam --
      const ref = referenciasSync(raiz);
      verificar('C4: há páginas a carregar o sync.js — a medição é válida',
        ref.comTag.length >= 17, ref.comTag.length + ' páginas');
      verificar('C4: nenhuma página carrega o sync.js sem versão',
        ref.semVersao.length === 0, 'sem versão: ' + (ref.semVersao.join(' | ') || 'nenhuma'));
      verificar('C4: a versão do sync.js é a mesma em todas as páginas',
        ref.versoes.length === 1, ref.versoes.join(' | ') || '(nenhuma)');

      // -- R2 no E2: a notícia individual não é um .html, logo o .htaccess não
      // a apanha. Declara o cabeçalho ela própria.
      const fonteNoticia = fs.readFileSync(path.join(raiz, 'api', 'noticia.php'), 'utf8');
      verificar('noticia.php: a notícia individual declara Cache-Control no-cache',
        /header\('Cache-Control: no-cache'\);/.test(fonteNoticia));
      verificar('noticia.php: é a única linha que toca no Cache-Control',
        (fonteNoticia.match(/header\('Cache-Control[^)]*\)/g) || []).length === 1,
        JSON.stringify(fonteNoticia.match(/header\('Cache-Control[^)]*\)/g) || []));

      // A condição é avaliada a partir da própria fonte do sw.js, com pedidos
      // falsos. O primeiro é o de um Safari anterior ao 16.4, onde o
      // Request.destination não existe: era aí que a navegação caía no
      // cache-first e a página nunca mais mudava.
      const expr = fonteSw.match(/const ehPagina = ([\s\S]*?);\n/);
      verificar('sw.js: a condição de página foi encontrada na fonte', !!expr);
      if (expr) {
        const avaliar = new Function('e',
          'const aceita = e.request.headers.get("accept") || "";\nreturn ' + expr[1] + ';');
        const pedido = (mode, destination, accept) => ({
          request: {
            mode, destination,
            headers: { get: (h) => (String(h).toLowerCase() === 'accept' ? accept : null) },
          },
        });
        verificar('deteção de página: navegação num Safari sem Request.destination',
          avaliar(pedido('navigate', undefined, 'text/html,application/xhtml+xml')) === true);
        verificar('deteção de página: navegação num browser moderno',
          avaliar(pedido('navigate', 'document', 'text/html')) === true);
        verificar('deteção de página: uma imagem não é página',
          avaliar(pedido('no-cors', 'image', 'image/avif,image/webp,*/*')) === false);
        verificar('deteção de página: um pedido de dados não é página',
          avaliar(pedido('cors', 'empty', '*/*')) === false);
      }

      // -- R2: os cabeçalhos HTTP --
      if (srv.modo !== 'apache') {
        console.log('  (cabeçalhos HTTP saltados: sem Apache não há .htaccess)');
      } else {
        // A fixture completa, publicada, para o ?id=1001 do E2 existir.
        escreverDados(raiz, dados);
        gerar(raiz);
        const cabecalhos = async (p) => {
          const r = await fetch(srv.url + p);
          await r.text();
          return {
            estado: r.status,
            cc: r.headers.get('cache-control') || '',
            etag: r.headers.get('etag') || '',
          };
        };
        const html = await cabecalhos('/modalidade.html');
        const raizHtml = await cabecalhos('/');
        const load = await cabecalhos('/api/load.php');
        const auth = await cabecalhos('/api/auth.php?acao=estado');
        const css  = await cabecalhos('/css/styles.css');
        const img  = await cabecalhos('/images/logo.png');
        verificar('R2: o HTML sai com Cache-Control no-cache',
          html.cc === 'no-cache', 'cache-control: ' + (html.cc || '(nenhum)'));
        verificar('R2: a raiz do site, que serve o index.html, também',
          raizHtml.cc === 'no-cache', 'cache-control: ' + (raizHtml.cc || '(nenhum)'));
        verificar('R2: o HTML continua a trazer ETag, para revalidar com um 304 vazio',
          html.etag !== '', 'etag: ' + (html.etag || '(nenhum)'));
        verificar('R2: o /api/load.php mantém o no-store que já tinha',
          /no-store/.test(load.cc), 'cache-control: ' + (load.cc || '(nenhum)'));
        verificar('R2: o /api/auth.php mantém o no-store — a regra não toca em .php',
          /no-store/.test(auth.cc), 'cache-control: ' + (auth.cc || '(nenhum)'));
        // C3: o JS e o CSS passam a revalidar. O "access plus 1 week" do
        // mod_expires deixa de valer para o CSS, de propósito; as imagens ficam
        // com o mês de cache.
        const js = await cabecalhos('/js/sync.js?v=20261006');
        const swjs = await cabecalhos('/sw.js');
        verificar('C3: o JS sai com Cache-Control no-cache',
          js.cc === 'no-cache', 'cache-control: ' + (js.cc || '(nenhum)'));
        verificar('C3: o CSS sai com Cache-Control no-cache',
          css.cc === 'no-cache', 'cache-control: ' + (css.cc || '(nenhum)'));
        verificar('C3: o próprio sw.js revalida',
          swjs.cc === 'no-cache', 'cache-control: ' + (swjs.cc || '(nenhum)'));
        verificar('C3: o JS continua a trazer ETag, para o 304 vazio',
          js.etag !== '', 'etag: ' + (js.etag || '(nenhum)'));
        verificar('C3: as imagens mantêm a política de sempre — um mês',
          /max-age=2592000/.test(img.cc), 'imagem: ' + (img.cc || '(nenhum)'));

        // A notícia individual, que vem do api/noticia.php por reescrita
        // interna. O <FilesMatch "\.html$"> não lhe chega: o ficheiro servido é
        // um .php. O cabeçalho vem do próprio endpoint.
        const e2ok  = await cabecalhos('/noticias.html?id=1001');
        const e2nao = await cabecalhos('/noticias.html?id=9999');
        verificar('R2: a notícia individual do E2 sai com no-cache',
          e2ok.cc === 'no-cache', 'estado ' + e2ok.estado + ' · cache-control: '
            + (e2ok.cc || '(nenhum)'));
        verificar('R2: e continua a responder 200, sem mudar de comportamento',
          e2ok.estado === 200, 'respondeu ' + e2ok.estado);
        verificar('R2: a notícia inexistente também revalida, e continua a dar 404',
          e2nao.cc === 'no-cache' && e2nao.estado === 404,
          'estado ' + e2nao.estado + ' · cache-control: ' + (e2nao.cc || '(nenhum)'));
      }

      // -- O comportamento, com a página aberta e sem lhe tocar --
      const correr = async (etiqueta, contexto) => {
        // Volta ao estado original antes de cada medição, para a página
        // arrancar com a descrição antiga.
        escreverDados(raiz, dados);
        gerar(raiz);
        const texto = 'DESCRICAO AO VIVO ' + etiqueta;
        const r = await testarSincronizacaoAoVivo(browser, srv.url, () => {
          const alterado = JSON.parse(JSON.stringify(dados));
          alterado.modalidades.find((x) => String(x.id) === '601').descricao = texto;
          escreverDados(raiz, alterado);
          const g = gerar(raiz);
          if (g.estado !== 0) throw new Error('publicação falhou: ' + g.saida.slice(0, 200));
        }, contexto);
        return { r, texto };
      };

      const ANTIGA = 'TESTE DESCRICAO DA MODALIDADE';
      const medir = (nome, { r, texto }) => {
        verificar(nome + ': o service worker controla a página — a medição é válida',
          r.controlado, 'controlado=' + r.controlado);
        verificar(nome + ': no arranque o /api/load.php é pedido uma vez, não uma por gatilho',
          r.pedidosNoArranque <= 2, 'pedidos no arranque: ' + r.pedidosNoArranque);
        verificar(nome + ': antes de publicar mostra a descrição antiga',
          r.antes.indexOf(ANTIGA) !== -1, r.antes.replace(/\s+/g, ' ').slice(0, 120));
        verificar(nome + ': com o separador aberto, sem ?v= e sem limpar cache, a nova aparece',
          r.depois.indexOf(texto) !== -1 && r.depois.indexOf(ANTIGA) === -1,
          r.depois.replace(/\s+/g, ' ').slice(0, 160));
        verificar(nome + ': a marca definitiva jsc_sync_done nunca é escrita',
          r.marcas.done === null, 'jsc_sync_done=' + r.marcas.done);
        verificar(nome + ': a marca de recarregamento guarda a publicação, não um "1"',
          !!r.marcas.recarga && r.marcas.recarga !== '1', 'marca: ' + r.marcas.recarga);
        verificar(nome + ': no máximo um recarregamento por publicação',
          r.navegacoesTotal - r.navegacoesNoArranque <= 1,
          'navegações: ' + r.navegacoesNoArranque + ' -> ' + r.navegacoesTotal);
        verificar(nome + ': sem ciclo de recarregamentos nem de pedidos',
          r.estavel, 'pedidos ' + r.pedidosTotal + ', navegações ' + r.navegacoesTotal);
        verificar(nome + ': sem erros de JavaScript',
          r.erros.length === 0, r.erros.join(' / '));
      };

      medir('separador aberto (desktop)', await correr('DESKTOP', { sw: true }));

      // O mesmo, num contexto com a forma de um iPhone. É Chromium, não Safari:
      // o que isto mede é o caminho do código, não o motor. A parte que depende
      // do motor — o Request.destination ausente — está medida acima, a partir
      // da fonte.
      medir('separador aberto (forma de iPhone)', await correr('TELEMOVEL', {
        sw: true,
        contexto: {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) '
            + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        },
      }));

      // -- O offline continua a funcionar --
      escreverDados(raiz, dados);
      gerar(raiz);
      // O script novo chega pelo mesmo endereço, com o service worker a controlar.
      const dep = await testarScriptNovoChega(browser, srv.url, raiz);
      verificar('deploy de script: o service worker controla a página — a medição é válida',
        dep.controlado, 'controlado=' + dep.controlado);
      verificar('deploy de script: antes da alteração a marca não existe',
        dep.antes === null, 'marca: ' + dep.antes);
      verificar('deploy de script: um js/sync.js alterado no servidor chega na navegação seguinte',
        dep.depois === 'CHEGOU', 'marca: ' + dep.depois);
      verificar('deploy de script: e é a versão nova que fica na cache do service worker',
        dep.naCache === 'nova', 'na cache: ' + dep.naCache);

      const offVisitada = await testarOffline(browser, srv.url, '/index.html');
      verificar('offline: o service worker controla a página',
        offVisitada.controlado, 'caches: ' + JSON.stringify(offVisitada.nomes));
      verificar('offline: só existe a cache jsc-v20 — as antigas foram apagadas',
        offVisitada.nomes.length === 1 && offVisitada.nomes[0] === 'jsc-v20',
        JSON.stringify(offVisitada.nomes));
      verificar('offline: o offline.html está na cache, pronto para o último recurso',
        offVisitada.temOffline === 200, 'estado na cache: ' + offVisitada.temOffline);
      // A página verdadeira, não o offline.html: é essa a diferença entre ter
      // cache e ter um aviso de que não há rede.
      verificar('offline: uma página já visitada abre da cache, e não o offline.html',
        offVisitada.texto.indexOf('ERRO:') !== 0
        && offVisitada.texto.trim().length > 50
        && offVisitada.texto.indexOf('Sem ligação à internet') === -1,
        offVisitada.texto.replace(/\s+/g, ' ').slice(0, 120));

      const offAusente = await testarOffline(browser, srv.url, '/nao-esta-na-cache.html');
      verificar('offline: uma página que não está na cache dá o offline.html',
        offAusente.texto.indexOf('Sem ligação à internet') !== -1,
        offAusente.texto.replace(/\s+/g, ' ').slice(0, 120));

      // Volta a pôr a fixture completa para o resto dos testes.
      escreverDados(raiz, dados);
      gerar(raiz);
    }

    // ---- Os selects de Escalão do painel ---------------------------
    console.log('\nselects de Escalão no painel');
    {
      const fonte = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8');
      verificar('admin.js: nenhuma chamada a _escOpts() vai escapada em jscEsc()',
        !/jscEsc\(_escOpts\(/.test(fonte),
        (fonte.match(/jscEsc\(_escOpts\(/g) || []).length + ' ocorrência(s)');
      verificar('admin.js: as sete chamadas a _escOpts() inserem markup directamente',
        (fonte.match(/\$\{_escOpts\(/g) || []).length === 7,
        (fonte.match(/\$\{_escOpts\(/g) || []).length + ' de 7');
      verificar('admin.js: o _escOpts escapa o nome do escalão, não o literal selected',
        /<option\$\{n===current\?' selected':''\}>\$\{jscEsc\(n\)\}<\/option>/.test(fonte));

      const e = await testarSelectsDeEscalao(browser, srv.url);
      const N = e.noDB.length;
      verificar(`o painel tem ${N} escalões para oferecer — a medição é válida`,
        N >= 8, e.noDB.join(', '));

      const checar = (nome, s, esperadas, selecionado) => {
        verificar(nome + ': o select existe e tem opções',
          s.existe && s.n === esperadas, 'opções: ' + s.n + ', esperava ' + esperadas);
        verificar(nome + ': nenhum markup de <option> visível como texto',
          s.existe && s.comMarkupVisivel === false, 'texto: ' + (s.nomes || []).join('|'));
        if (selecionado !== undefined) {
          verificar(nome + ': a opção certa vem selecionada',
            s.valor === selecionado, 'valor: ' + JSON.stringify(s.valor));
        }
      };

      checar('Novo Atleta',    e.novoAtleta,   N);
      checar('Editar Atleta',  e.editarAtleta, N, 'Sub-13');
      checar('filtro de Jogos', e.filtroJogos, N + 1, '');
      checar('Novo Jogo',      e.novoJogo,     N);
      checar('Editar Jogo',    e.editarJogo,   N, 'Sub-15');
      checar('Novo Membro',    e.novoMembro,   N + 1, 'Todos');
      checar('Editar Membro',  e.editarMembro, N + 1, 'Sub-17');
      checar('Novo Evento',    e.novoEvento,   N + 1);
      checar('Editar Evento',  e.editarEvento, N + 1, 'Sub-19');

      verificar('guardar um membro existente NÃO apaga o escalão',
        e.escalaoDepoisDeGuardar === 'Sub-17',
        'ficou: ' + JSON.stringify(e.escalaoDepoisDeGuardar));

      verificar('um escalão chamado "TESTE A & B" aparece com o & correcto',
        e.comAmp && e.comAmp.texto === 'TESTE A & B' && e.comAmp.html === 'TESTE A &amp; B',
        JSON.stringify(e.comAmp));
      verificar('e o valor devolvido pelo select é o nome tal como está nos dados',
        e.valorComAmp === 'TESTE A & B', JSON.stringify(e.valorComAmp));

      verificar('sem erros de JavaScript no painel durante a medição',
        e.erros.length === 0, e.erros.join(' / '));
    }

    // ---- Editor de classificações: o nome da equipa ----------------
    console.log('\neditor de classificações: o nome da equipa');
    {
      const fonte = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8');
      verificar('admin.js: o esc() local do editor de classificações desapareceu',
        !/const esc = \(s\) => String\(s \|\| ''\)\.replace/.test(fonte));
      verificar('admin.js: já não há jscEsc(esc(…)) — escape a dobrar',
        !/jscEsc\(esc\(/.test(fonte),
        (fonte.match(/jscEsc\(esc\(/g) || []).length + ' ocorrência(s)');
      verificar('admin.js: o nome e a forma continuam escapados, com o jscEsc sozinho',
        /class="form-input ed-equipa" value="\$\{jscEsc\(t\.equipa \|\| ''\)\}"/.test(fonte)
        && /class="form-input ed-forma" value="\$\{jscEsc\(t\.forma \|\| ''\)\}"/.test(fonte));

      const c = await testarEditorClassificacoes(browser, srv.url);
      const rotulos = ['aspas', '&', 'acentos', 'normal', 'injeção de HTML'];
      c.nomes.forEach((nome, i) => {
        verificar('editor (' + rotulos[i] + '): o campo mostra o nome tal como está nos dados',
          c.mostrado[i] === nome,
          'esperava ' + JSON.stringify(nome) + ', mostrou ' + JSON.stringify(c.mostrado[i]));
        verificar('editor (' + rotulos[i] + '): Guardar devolve o nome intacto aos dados',
          c.gravado[i] === nome,
          'esperava ' + JSON.stringify(nome) + ', gravou ' + JSON.stringify(c.gravado[i]));
      });
      // O atributo continua escapado no HTML — é isso que o mantém seguro.
      verificar('editor: as aspas vão escapadas no atributo value',
        /&quot;/.test(c.atributo[0]), 'atributo: ' + c.atributo[0]);
      verificar('editor: o & vai escapado no atributo value, uma vez e não duas',
        c.atributo[1] === 'Loulé &amp; Quarteira', 'atributo: ' + c.atributo[1]);
      verificar('editor: o < e o > vão escapados no atributo value',
        /&lt;img/.test(c.atributo[4]) && /&gt;/.test(c.atributo[4]),
        'atributo: ' + c.atributo[4]);
      verificar('editor: a injeção de HTML não criou nenhum elemento na tabela',
        c.injetou === false);
      verificar('editor: sem erros de JavaScript no painel durante a medição',
        c.erros.length === 0, c.erros.join(' / '));
    }

    // ---- Logótipos das equipas no resultados.html -------------------
    console.log('\nresultados.html: o logótipo das equipas nos jogos');
    {
      const fonteRes = fs.readFileSync(path.join(raiz, 'js', 'resultados.js'), 'utf8');
      verificar('resultados.js: o jogoLogo() já não vai envolvido em jscEsc()',
        !/jscEsc\(jogoLogo\(/.test(fonteRes),
        (fonteRes.match(/jscEsc\(jogoLogo\(/g) || []).length + ' ocorrência(s)');
      verificar('resultados.js: os três sítios inserem o markup directamente',
        (fonteRes.match(/\$\{jogoLogo\(/g) || []).length === 3);
      // O nome passou a ser mostrado sem a marca do lado, e por isso vai pelo
      // semMarca() antes do jscEsc(). O escape é o mesmo e continua fixado
      // aqui; o que mudou foi o que se escapa.
      verificar('resultados.js: o nome da equipa continua escapado ao lado do logótipo',
        /\$\{jogoLogo\(j\.logoCasa, semMarca\(j\.casa\)\)\}\$\{jscEsc\(semMarca\(j\.casa\)\)\}/.test(fonteRes)
        && /\$\{jogoLogo\(j\.logoFora, semMarca\(j\.fora\)\)\}\$\{jscEsc\(semMarca\(j\.fora\)\)\}/.test(fonteRes)
        && /\$\{jogoLogo\(advLogo, adversario\)\}\$\{jscEsc\(adversario\)\}/.test(fonteRes));
      verificar('resultados.js: o endereço do logótipo continua a passar pelo jscEscUrl',
        /<img src="\$\{jscEscUrl\(resolved\)\}"/.test(fonteRes));

      const g = await testarLogotiposDeJogos(browser, srv.url);
      // Próximos: 4 jogos. Logótipos esperados: 2 do jogo entre terceiros com
      // logo, 1 do jogo do Campinense (só o adversário), 0 do jogo sem logo,
      // 0 do jogo com endereço recusado pelo jscEscUrl.
      verificar('próximos: os quatro jogos foram desenhados — a medição é válida',
        g.prox.linhas === 4, 'linhas: ' + g.prox.linhas);
      verificar('próximos: nenhum markup aparece como texto',
        g.prox.markupVisivel === false, g.prox.texto.slice(0, 150));
      verificar('próximos: entre terceiros desenham-se os dois logótipos',
        g.prox.srcs.filter((x) => x === g.LOGO).length === 3,
        'srcs: ' + JSON.stringify(g.prox.srcs));
      verificar('próximos: um jogo sem logótipo não produz nenhuma imagem',
        g.prox.texto.indexOf('TESTE OLHANENSE') !== -1
        && g.prox.texto.indexOf('TESTE FARENSE') !== -1,
        g.prox.texto.slice(0, 150));
      verificar('próximos: um endereço javascript: é recusado e não gera imagem',
        g.prox.srcs.every((x) => !/^\s*javascript:/i.test(x || '')),
        'srcs: ' + JSON.stringify(g.prox.srcs));
      verificar('próximos: os nomes das equipas aparecem como texto normal',
        g.prox.texto.indexOf('TESTE LOULETANO') !== -1
        && g.prox.texto.indexOf('TESTE QUARTEIRENSE') !== -1);

      verificar('últimos: os dois resultados foram desenhados — a medição é válida',
        g.ultimos.linhas === 2, 'linhas: ' + g.ultimos.linhas);
      verificar('últimos: nenhum markup aparece como texto',
        g.ultimos.markupVisivel === false, g.ultimos.texto.slice(0, 150));
      verificar('últimos: entre terceiros desenham-se os dois logótipos, e um no do Campinense',
        g.ultimos.srcs.filter((x) => x === g.LOGO).length === 3,
        'srcs: ' + JSON.stringify(g.ultimos.srcs));
      verificar('resultados.html: sem erros de JavaScript',
        g.erros.length === 0, g.erros.join(' / '));
    }

    // ---- Contagem decrescente do Próximo Jogo -----------------------
    console.log('\npágina inicial: a contagem decrescente do Próximo Jogo');
    {
      const fonteMain = fs.readFileSync(path.join(raiz, 'js', 'main.js'), 'utf8');
      verificar('main.js: o cdBox() já não vai envolvido em jscEsc()',
        !/jscEsc\(cdBox\(/.test(fonteMain),
        (fonteMain.match(/jscEsc\(cdBox\(/g) || []).length + ' ocorrência(s)');
      verificar('main.js: as quatro caixas inserem o markup directamente',
        (fonteMain.match(/\$\{cdBox\('jd(Dias|Horas|Min|Seg)'/g) || []).length === 4);
      verificar('main.js: o id e a etiqueta continuam escapados dentro do cdBox',
        /<span id="\$\{jscEsc\(id\)\}"/.test(fonteMain)
        && /text-transform:uppercase">\$\{jscEsc\(label\)\}<\/span>/.test(fonteMain));

      const c = await testarContagemDecrescente(browser, srv.url);
      verificar('contagem: as quatro caixas existem no DOM',
        c.antes.caixas === 4, 'caixas: ' + c.antes.caixas);
      verificar('contagem: nenhum markup aparece como texto no widget',
        c.antes.markupVisivel === false);
      verificar('contagem: os quatro spans com id existem e já têm número',
        [c.antes.dias, c.antes.horas, c.antes.min, c.antes.seg]
          .every((v) => typeof v === 'string' && /^\d{2,}$/.test(v)),
        JSON.stringify(c.antes));
      verificar('contagem: os segundos mudam — o temporizador está a contar',
        c.depois.seg !== c.antes.seg,
        'antes=' + c.antes.seg + ' depois=' + c.depois.seg);
      verificar('página inicial: sem erros de JavaScript na contagem',
        c.erros.length === 0, c.erros.join(' / '));
    }

    // ---- A ordem dos escalões na resultados.html --------------------
    console.log('\nresultados.html: os escalões por idade, do mais velho ao mais novo');
    {
      const ORDEM = ['Sub-19', 'Sub-17', 'Sub-15', 'Sub-13', 'Sub-11'];
      const html = fs.readFileSync(path.join(raiz, 'resultados.html'), 'utf8');
      const noFicheiro = (html.match(/data-escalao="(Sub-\d+)"/g) || [])
        .map((x) => x.replace(/.*"(Sub-\d+)".*/, '$1'));
      verificar('resultados.html: os separadores estão por idade no ficheiro',
        JSON.stringify(noFicheiro) === JSON.stringify(ORDEM), JSON.stringify(noFicheiro));

      for (const largura of [1440, 390]) {
        const e = await testarOrdemDosEscaloes(browser, srv.url, largura);
        const onde = largura === 1440 ? 'desktop' : 'telemóvel';
        verificar(onde + ': a ordem desenhada é Sub-19 → Sub-17 → Sub-15 → Sub-13 → Sub-11',
          JSON.stringify(e.inicial.ordem) === JSON.stringify(ORDEM),
          JSON.stringify(e.inicial.ordem));
        verificar(onde + ': os cinco separadores estão visíveis',
          e.inicial.visiveis === 5, 'visíveis: ' + e.inicial.visiveis);
        verificar(onde + ': o selecionado é o que a página abre por omissão',
          e.inicial.ativo === e.inicial.escalaoActivo && e.inicial.ativo === 'Sub-17',
          'activo=' + e.inicial.ativo + ' escalaoActivo=' + e.inicial.escalaoActivo);
        verificar(onde + ': clicar no Sub-19 muda o escalão e a marca de selecionado',
          e.depoisDoClique.ativo === 'Sub-19' && e.depoisDoClique.escalaoActivo === 'Sub-19'
          && JSON.stringify(e.depoisDoClique.ordem) === JSON.stringify(ORDEM),
          JSON.stringify(e.depoisDoClique));
        verificar(onde + ': sem erros de JavaScript',
          e.erros.length === 0, e.erros.join(' | '));
      }
    }

    // ---- A classificação colada: o caso AABV ------------------------
    console.log('\na classificação colada: 12 equipas, e a AABV é uma delas');
    {
      const fonteCls = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: a linha de maiúsculas só é sigla se o nome vier a seguir',
        /if \(_isNameWord\(seguinte\) && !\/\^\\\[img:\/\.test\(seguinte\)\) continue;/.test(fonteCls));
      verificar('admin.js: a única parte textual de uma linha pode ser o nome',
        /const textuais = parts\.filter\(_isNameWordSozinho\);/.test(fonteCls)
        && /if \(textuais\.length === 1\) nameIdx = parts\.indexOf\(textuais\[0\]\);/.test(fonteCls));
      verificar('admin.js: a posição retira-se pelo conteúdo, não pelo contador de linhas',
        /const coerente = \(x\) => x\.length >= 7 && Math\.abs\(x\[0\] - \(x\[1\] \+ x\[2\] \+ x\[3\]\)\) <= 2;/.test(fonteCls)
        && /if \(coerente\(semPosicao\) && !coerente\(seq\)\) seq = semPosicao;/.test(fonteCls));

      // A tabela real da Liga 1 do Algarve: posição, nome, J, V, E, D, GM, GS,
      // DG e Pts, separados por tabulação — a forma que o Nélio cola.
      const TABELA = [
        [1,  'Portimonense B',       11, 8, 2, 1, 30,  8],
        [2,  'Imortal DC',           11, 8, 1, 2, 28, 10],
        [3,  'Louletano',            11, 7, 2, 2, 25, 12],
        [4,  'Quarteirense',         11, 6, 3, 2, 22, 13],
        [5,  'Farense B',            11, 6, 1, 4, 20, 15],
        [6,  'Silves',               11, 5, 2, 4, 18, 16],
        [7,  'AABV',                 11, 4, 3, 4, 16, 17],
        [8,  'AEF Faro',             11, 4, 1, 6, 14, 20],
        [9,  'Ginásio de Tavira',    11, 3, 2, 6, 12, 22],
        [10, 'Montenegro',           11, 2, 3, 6, 10, 24],
        [11, 'Ferreiras',            11, 2, 1, 8,  8, 26],
        [12, 'Juventude Campinense', 11, 1, 1, 9,  6, 30],
      ];
      const PTS = (r) => r[3] * 3 + r[4];
      const tabela = TABELA.map((r) =>
        [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[6] - r[7], PTS(r)].join('\t')).join('\n') + '\n';

      const cl = await testarClassificacaoColada(browser, srv.url, [
        { texto: tabela },
        // Controlo: aqui as maiúsculas SÃO a sigla da coluna, ao lado do nome.
        { texto: '1\tOLH\tOlhanense\t11\t8\t2\t1\t30\t8\t22\t26\n'
               + '2\tFAR\tFarense B\t11\t7\t2\t2\t25\t12\t13\t23\n' },
        // Controlo: a sigla em linha própria, seguida do nome.
        { texto: '1\nOLH\nOlhanense\t11\t8\t2\t1\t30\t8\t22\t26\n' },
        // Controlo: sem posição, e o primeiro número é um J pequeno legítimo.
        { texto: 'TESTE JOVEM\t3\t1\t1\t1\t5\t4\t1\t4\n' },
        // Controlo: cabeçalho "Pts primeiro" continua a ser respeitado.
        { texto: 'P\tJ\tV\tE\tD\tGM\tGS\tDG\n'
               + 'Portimonense B\t26\t11\t8\t2\t1\t30\t8\t22\n'
               + 'Imortal DC\t23\t11\t7\t2\t2\t25\t12\t13\n' },
      ]);
      const [doze, siglaAoLado, siglaEmLinha, jPequeno, ptsPrimeiro] = cl.lidos;

      verificar('a tabela real dá 12 equipas',
        doze.length === 12, 'deu ' + doze.length
        + ' · faltam ' + JSON.stringify(TABELA.map((t) => t[1]).filter((n) => !doze.some((x) => x.equipa === n))));
      verificar('a 7.ª equipa é a AABV',
        (doze[6] || {}).equipa === 'AABV', 'veio ' + JSON.stringify((doze[6] || {}).equipa));
      verificar('J = V + E + D em todas as 12',
        doze.length === 12 && doze.every((x) => x.j === x.v + x.e + x.d),
        JSON.stringify(doze.filter((x) => x.j !== x.v + x.e + x.d)));
      verificar('nenhuma equipa recebe a sua posição como pontos',
        doze.every((x) => {
          const origem = TABELA.find((t) => t[1] === x.equipa);
          return !origem || x.pts !== origem[0] || x.pts === PTS(origem);
        }),
        JSON.stringify(doze.filter((x) => {
          const origem = TABELA.find((t) => t[1] === x.equipa);
          return origem && x.pts === origem[0] && x.pts !== PTS(origem);
        }).map((x) => x.equipa + ' Pts=' + x.pts)));
      verificar('e as cinco do fim têm os pontos certos, não 8, 9, 10, 11 e 12',
        ['AEF Faro', 'Ginásio de Tavira', 'Montenegro', 'Ferreiras', 'Juventude Campinense']
          .every((nome) => {
            const x = doze.find((y) => y.equipa === nome);
            const origem = TABELA.find((t) => t[1] === nome);
            return x && x.pts === PTS(origem);
          }),
        JSON.stringify(doze.slice(7).map((x) => x.equipa + '=' + x.pts)));

      verificar('controlo: a sigla ao lado do nome não entra no nome',
        siglaAoLado.length === 2 && siglaAoLado[0].equipa === 'Olhanense'
        && siglaAoLado[1].equipa === 'Farense B' && siglaAoLado[0].pts === 26,
        JSON.stringify(siglaAoLado));
      verificar('controlo: a sigla em linha própria, seguida do nome, continua a ser saltada',
        siglaEmLinha.length === 1 && siglaEmLinha[0].equipa === 'Olhanense',
        JSON.stringify(siglaEmLinha));
      verificar('controlo: um primeiro número pequeno e legítimo não é retirado',
        jPequeno.length === 1 && jPequeno[0].j === 3 && jPequeno[0].v === 1
        && jPequeno[0].e === 1 && jPequeno[0].d === 1 && jPequeno[0].pts === 4,
        JSON.stringify(jPequeno));
      verificar('controlo: o cabeçalho "Pts primeiro" continua a ser respeitado',
        ptsPrimeiro.length === 2 && ptsPrimeiro[0].pts === 26 && ptsPrimeiro[0].j === 11
        && ptsPrimeiro[1].pts === 23 && ptsPrimeiro[1].j === 11,
        JSON.stringify(ptsPrimeiro));

      verificar('painel: sem erros de JavaScript nas colagens de classificação',
        cl.erros.length === 0, cl.erros.join(' | '));
    }

    // ---- O local no parseMultiLineJogos -----------------------------
    console.log('\no local de um jogo só se grava com evidência de recinto');
    {
      const fonteLoc = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: o local passa por um ajudante com as sete regras',
        /function _localDeJogo\(bruto, casa, fora, nomesDeEquipa, ehUltimoDaLista\)/.test(fonteLoc)
        && /const local = venueIsGame \? '' : _localDeJogo\(venueRaw, home, away, nomesDeEquipa, nextDateIdx === undefined\);/.test(fonteLoc));
      // As três recusas são as mesmas; o que mudou foi compararem-se sem a
      // marca do lado, porque nesta altura os nomes ainda a trazem e
      // "Silves" contra "Silves (C)" não batia. A comparação sem marca é
      // mais forte, não mais fraca, e fica aqui fixada.
      verificar('admin.js: recusa as equipas do jogo e as da colagem, sem a marca do lado',
        /const baixo = _semMarcaLado\(local\)\.toLowerCase\(\);/.test(fonteLoc)
        && /if \(baixo === _semMarcaLado\(casa\)\.toLowerCase\(\)\) return '';/.test(fonteLoc)
        && /if \(baixo === _semMarcaLado\(fora\)\.toLowerCase\(\)\) return '';/.test(fonteLoc)
        && /if \(nomesDeEquipa && nomesDeEquipa\.has\(baixo\)\) return '';/.test(fonteLoc));
      verificar('admin.js: a lista de nomes da colagem guarda-os com e sem a marca',
        /nomesDeEquipa\.add\(_semMarcaLado\(lines\[d-1\]\)\.toLowerCase\(\)\);/.test(fonteLoc)
        && /nomesDeEquipa\.add\(_semMarcaLado\(lines\[d\+2\]\)\.toLowerCase\(\)\);/.test(fonteLoc));
      verificar('admin.js: recusa cabeçalhos e exige palavra de recinto no último jogo',
        /if \(JSC_CABECALHO_LISTA\.test\(local\)\) return '';/.test(fonteLoc)
        && /if \(ehUltimoDaLista && !JSC_PALAVRA_RECINTO\.test\(local\)\) return '';/.test(fonteLoc));

      const t = (...l) => l.join('\n') + '\n';
      const SC = 'Sport Campinense', S = 'TESTE SILVES', G = 'TESTE GUIA FC', O = 'TESTE OLHANENSE';
      const E1 = 'Estádio Municipal de Silves', E2 = 'Campo Zona Verde', E3 = 'Estádio das Eiras';

      const CASOS = [
        { nome: 'local igual à equipa da casa fica vazio',
          texto: t(SC, '12 Out 2025', '15:00', S, SC, G, '19 Out 2025', '11:00', SC),
          espera: [{ casa: SC, fora: S, local: '' }, { casa: G, fora: SC, local: '' }] },
        { nome: 'local igual à equipa visitante fica vazio',
          texto: t(SC, '12 Out 2025', '15:00', S, S, G, '19 Out 2025', '11:00', SC),
          espera: [{ casa: SC, fora: S, local: '' }, { casa: G, fora: SC, local: '' }] },
        // Aqui a linha a mais é o nome de uma equipa que a colagem traz noutro
        // jogo: a estrutura não a distingue de um recinto, o nome é que a
        // denuncia.
        { nome: 'local igual a uma equipa de outro jogo fica vazio',
          texto: t(SC, '12 Out 2025', '15:00', S, G, O, '26 Out 2025', '15:00', G),
          espera: [{ casa: SC, fora: S, local: '' }, { casa: O, fora: G, local: '' }] },
        { nome: 'local "Jornada 5" fica vazio',
          texto: t(SC, '12 Out 2025', '15:00', S, 'Jornada 5', G, '19 Out 2025', '11:00', SC),
          espera: [{ casa: SC, fora: S, local: '' }, { casa: G, fora: SC, local: '' }] },
        { nome: 'recintos reais preservados nos três jogos',
          texto: t(SC, '12 Out 2025', '15:00', S, E1,
                   G,  '19 Out 2025', '11:00', SC, E2,
                   SC, '26 Out 2025', '15:00', O, E3),
          espera: [{ casa: SC, fora: S, local: E1 }, { casa: G, fora: SC, local: E2 },
                   { casa: SC, fora: O, local: E3 }] },
        { nome: 'último jogo com recinto real guarda o recinto',
          texto: t(SC, '12 Out 2025', '15:00', S, E1, G, '19 Out 2025', '11:00', SC, E3),
          espera: [{ casa: SC, fora: S, local: E1 }, { casa: G, fora: SC, local: E3 }] },
        { nome: 'último jogo sem recinto não inventa local',
          texto: t(SC, '12 Out 2025', '15:00', S, E1, G, '19 Out 2025', '11:00', SC),
          espera: [{ casa: SC, fora: S, local: E1 }, { casa: G, fora: SC, local: '' }] },
        { nome: 'rodapé no fim da colagem não vira local',
          texto: t(SC, '12 Out 2025', '15:00', S, E1, G, '19 Out 2025', '11:00', SC, 'Classificação'),
          espera: [{ casa: SC, fora: S, local: E1 }, { casa: G, fora: SC, local: '' }] },
      ];

      const lc = await testarColagemDeJogos(browser, srv.url, CASOS);
      CASOS.forEach((c, i) => {
        const obtido = lc.lidos[i] || [];
        const bate = obtido.length === c.espera.length && c.espera.every((e, k) => {
          const o = obtido[k] || {};
          return o.casa === e.casa && o.fora === e.fora && (o.local || '') === e.local;
        });
        verificar(c.nome, bate,
          'obtido: ' + JSON.stringify(obtido.map((o) => o.casa + ' vs ' + o.fora + ' | ' + (o.local || '(vazio)')))
          + ' esperado: ' + JSON.stringify(c.espera.map((e) => e.casa + ' vs ' + e.fora + ' | ' + (e.local || '(vazio)'))));
      });

      // Guarda: a regra do local não pode mexer nas equipas, datas nem horas.
      const tres = lc.lidos[4] || [];
      verificar('guarda: nos três jogos as datas e as horas ficam certas',
        tres.length === 3
        && tres[0].hora === '15:00' && tres[1].hora === '11:00' && tres[2].hora === '15:00'
        && tres.every((j) => j.estado === 'Agendado'),
        JSON.stringify(tres));
      verificar('painel: sem erros de JavaScript nas colagens de jogos com recinto',
        lc.erros.length === 0, lc.erros.join(' | '));
    }

    // ---- O despacho dos parsers de jogos ----------------------------
    console.log('\na colagem de jogos: a casa e a visitante nunca são deslocadas');
    {
      const fonteDesp = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: o parseZZJogos exige uma das duas provas',
        /const abreBloco = !antes \|\| !!parseDate\(antes\) \|\| !!parseTime\(antes\)/.test(fonteDesp)
        && /if \(!separador && !abreBloco\) continue;/.test(fonteDesp));
      verificar('admin.js: o resultado e o separador ficam registados como prova',
        /if \(sc\) \{ score = sc; separador = true; j\+\+; \}/.test(fonteDesp)
        && /else if \(\/\^\[-–\]\$\/\.test\(lines\[j\]\.trim\(\)\)\) \{ separador = true; j\+\+; \}/.test(fonteDesp));

      const t = (...l) => l.join('\n') + '\n';
      const SC = 'Sport Campinense', S = 'TESTE SILVES', G = 'TESTE GUIA FC', O = 'TESTE OLHANENSE';
      const E1 = 'Estádio Municipal de Silves', E2 = 'Campo Zona Verde', E3 = 'Estádio das Eiras';
      const RECINTOS = [E1, E2, E3];
      const EQUIPAS = [SC, S, G, O];

      // A matriz medida: sete formas do AF Algarve (casa antes da data) e
      // quatro do ZeroZero (data a abrir o bloco), que são os controlos.
      const CASOS = [
        { nome: 'AF: agendado sem recinto',
          texto: t(SC, '12 Out 2025', '15:00', S),
          espera: [{ casa: SC, fora: S, local: '', estado: 'Agendado' }] },
        { nome: 'AF: agendado com Estádio Municipal',
          texto: t(SC, '12 Out 2025', '15:00', S, E1),
          espera: [{ casa: SC, fora: S, local: E1, estado: 'Agendado' }] },
        { nome: 'AF: agendado com Campo Zona Verde',
          texto: t(G, '19 Out 2025', '11:00', SC, E2),
          espera: [{ casa: G, fora: SC, local: E2, estado: 'Agendado' }] },
        { nome: 'AF: realizado com resultado',
          texto: t(SC, '12 Out 2025', '2-1', S, E1),
          espera: [{ casa: SC, fora: S, local: E1, estado: 'Realizado' }] },
        { nome: 'AF: vários jogos seguidos',
          texto: t(SC, '12 Out 2025', '15:00', S, E1,
                   G,  '19 Out 2025', '11:00', SC, E2,
                   SC, '26 Out 2025', '15:00', O, E3),
          espera: [{ casa: SC, fora: S, local: E1, estado: 'Agendado' },
                   { casa: G, fora: SC, local: E2, estado: 'Agendado' },
                   { casa: SC, fora: O, local: E3, estado: 'Agendado' }] },
        { nome: 'AF: cabeçalho Jornada entre jogos',
          texto: t('Jornada 6', SC, '12 Out 2025', '15:00', S, E1,
                   'Jornada 7', G, '19 Out 2025', '11:00', SC, E2),
          espera: [{ casa: SC, fora: S, local: E1, estado: 'Agendado' },
                   { casa: G, fora: SC, local: E2, estado: 'Agendado' }] },
        { nome: 'AF: último jogo da colagem, sem recinto',
          texto: t(SC, '12 Out 2025', '15:00', S, E1,
                   G,  '19 Out 2025', '11:00', SC),
          espera: [{ casa: SC, fora: S, local: E1, estado: 'Agendado' },
                   { casa: G, fora: SC, local: '', estado: 'Agendado' }] },
        // Controlos do ZeroZero: já passavam antes da regra e não podem regredir.
        { nome: 'ZeroZero: agendado com separador',
          texto: t('12 Out 2025', '15:00', SC, '–', S),
          espera: [{ casa: SC, fora: S, estado: 'Agendado' }] },
        { nome: 'ZeroZero: realizado com resultado',
          texto: t('12 Out 2025', SC, '2-1', S),
          espera: [{ casa: SC, fora: S, estado: 'Realizado' }] },
        { nome: 'ZeroZero: três jogos seguidos',
          texto: t('12 Out 2025', '15:00', SC, '–', S,
                   '19 Out 2025', '11:00', G, '–', SC,
                   '26 Out 2025', '15:00', SC, '–', O),
          espera: [{ casa: SC, fora: S, estado: 'Agendado' },
                   { casa: G, fora: SC, estado: 'Agendado' },
                   { casa: SC, fora: O, estado: 'Agendado' }] },
        { nome: 'ZeroZero: sem separador, a data abre o bloco',
          texto: t('12 Out 2025', '15:00', SC, S),
          espera: [{ casa: SC, fora: S, estado: 'Agendado' }] },
      ];

      const cj = await testarColagemDeJogos(browser, srv.url, CASOS);
      const baixo = (x) => (x || '').trim().toLowerCase();
      const eRecinto = (x) => RECINTOS.some((r) => baixo(r) === baixo(x));
      const eEquipa = (x) => EQUIPAS.some((e) => baixo(e) === baixo(x));
      const todos = [];

      CASOS.forEach((c, i) => {
        const obtido = cj.lidos[i] || [];
        todos.push(...obtido);
        const bate = obtido.length === c.espera.length && c.espera.every((e, k) => {
          const o = obtido[k] || {};
          return o.casa === e.casa && o.fora === e.fora && o.estado === e.estado
            && (e.local === undefined || o.local === e.local);
        });
        verificar(c.nome, bate,
          'obtido: ' + JSON.stringify(obtido) + ' esperado: ' + JSON.stringify(c.espera));
      });

      verificar('medição válida: as onze formas deram jogos',
        CASOS.every((c, i) => (cj.lidos[i] || []).length > 0),
        JSON.stringify(CASOS.map((c, i) => c.nome + '=' + (cj.lidos[i] || []).length)));
      verificar('nenhum recinto virou equipa, em forma nenhuma',
        todos.every((j) => !eRecinto(j.casa) && !eRecinto(j.fora)),
        JSON.stringify(todos.filter((j) => eRecinto(j.casa) || eRecinto(j.fora))));
      verificar('nenhum nome de equipa virou local, em forma nenhuma',
        todos.every((j) => !eEquipa(j.local)),
        JSON.stringify(todos.filter((j) => eEquipa(j.local))));
      verificar('painel: sem erros de JavaScript nas colagens',
        cj.erros.length === 0, cj.erros.join(' | '));
    }

    // ---- As marcas (C) e (F) na colagem de jogos --------------------
    console.log('\na colagem trata (C) e (F) como o lado em que se joga');
    {
      const fonteMarcas = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: a normalização corre nos quatro parsers, pelo despacho',
        (fonteMarcas.match(/_aplicarMarcasCasaFora\(/g) || []).length >= 4
        && /_attachJogoLogos\(_aplicarMarcasCasaFora\(zzResult\)\)/.test(fonteMarcas)
        && /_attachJogoLogos\(_aplicarMarcasCasaFora\(parseMultiLineJogos\(raw, next\)\)\)/.test(fonteMarcas)
        && /_attachJogoLogos\(_aplicarMarcasCasaFora\(parseSingleLineJogos\(raw, next\)\)\)/.test(fonteMarcas));
      verificar('admin.js: ao trocar os lados troca também os golos',
        /if \(j\.estado === 'Realizado'\) \{ const g = j\.gcasa; j\.gcasa = j\.gfora; j\.gfora = g; \}/.test(fonteMarcas));
      verificar('admin.js: o nome do clube vem do dados_clube, não está escrito no parser',
        /function _nomeDoClube\(\)/.test(fonteMarcas)
        && /localStorage\.getItem\('dados_clube'\)/.test(fonteMarcas));

      const SC = 'Juventude Sport Campinense';
      const t = (...l) => l.join('\n');
      const CASOS = [
        { nome: '(C) agendado: o clube fica em casa, com hora e recinto',
          texto: t(SC + ' (C)', '18 out 2026', '11:00', 'TESTE SILVES (F)', 'Estádio Municipal de Loulé'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Agendado', hora: '11:00', local: 'Estádio Municipal de Loulé' }] },
        { nome: '(F) agendado: os lados trocam e o recinto fica',
          texto: t(SC + ' (F)', '25 out 2026', '10:30', 'TESTE SILVES (C)', 'Campo Zona Verde'),
          espera: [{ casa: 'TESTE SILVES', fora: SC, estado: 'Agendado', hora: '10:30', local: 'Campo Zona Verde' }] },
        { nome: '(C) realizado: o resultado fica como veio',
          texto: t(SC + ' (C)', '20 set 2026', '3-1', 'TESTE SILVES (F)', 'Estádio Municipal de Loulé'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Realizado', gcasa: 3, gfora: 1 }] },
        { nome: '(F) realizado: trocam os lados e os golos com eles',
          texto: t(SC + ' (F)', '27 set 2026', '0-2', 'TESTE FARO (C)', 'Campo de Faro'),
          espera: [{ casa: 'TESTE FARO', fora: SC, estado: 'Realizado', gcasa: 2, gfora: 0 }] },
        { nome: 'só a marca (F): o nome do clube é reconstruído, e joga fora',
          texto: t('(F)', '1 nov 2026', '15:00', 'TESTE QUARTEIRENSE', 'Campo do Quarteirense'),
          espera: [{ casa: 'TESTE QUARTEIRENSE', fora: SC, estado: 'Agendado', local: 'Campo do Quarteirense' }] },
        { nome: 'só a marca (C) num realizado: o clube em casa, resultado intacto',
          texto: t('(C)', '8 nov 2026', '2-0', 'TESTE LAGOA', 'Estádio Municipal de Loulé'),
          espera: [{ casa: SC, fora: 'TESTE LAGOA', estado: 'Realizado', gcasa: 2, gfora: 0 }] },
        { nome: 'três jogos seguidos com marcas alternadas',
          texto: t(SC + ' (C)', '18 out 2026', '11:00', 'TESTE SILVES (F)', 'Estádio Municipal de Loulé',
                   SC + ' (F)', '25 out 2026', '10:30', 'TESTE MESSINENSE (C)', 'Campo de Messines',
                   SC + ' (C)', '1 nov 2026', '4-0', 'TESTE LAGOA (F)', 'Estádio Municipal de Loulé'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Agendado' },
                   { casa: 'TESTE MESSINENSE', fora: SC, estado: 'Agendado' },
                   { casa: SC, fora: 'TESTE LAGOA', estado: 'Realizado', gcasa: 4, gfora: 0 }] },
        { nome: 'controlo: sem marcas, nada muda',
          texto: t('18/10/2026', '11:00', SC, '-', 'TESTE SILVES'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Agendado', hora: '11:00' }] },
        { nome: 'marca em minúsculas e com espaços conta igual',
          texto: t(SC + ' ( f )', '18 out 2026', '11:00', 'TESTE SILVES (c)', 'Campo Zona Verde'),
          espera: [{ casa: 'TESTE SILVES', fora: SC, estado: 'Agendado', local: 'Campo Zona Verde' }] },
        { nome: 'marcas contraditórias não decidem nada, e saem do nome',
          texto: t(SC + ' (C)', '18 out 2026', '11:00', 'TESTE SILVES (C)', 'Estádio Municipal de Loulé'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Agendado' }] },
        { nome: 'a marca sozinha na linha do recinto decide o lado',
          texto: t(SC, '27 set 2026', '1-3', 'TESTE FARO', '(F)'),
          espera: [{ casa: 'TESTE FARO', fora: SC, estado: 'Realizado', gcasa: 3, gfora: 1, local: '' }] },
        { nome: 'recinto igual ao nome de uma equipa marcada não entra como local',
          texto: t('TESTE SILVES (C)', '18 out 2026', '11:00', SC + ' (F)', 'TESTE SILVES'),
          espera: [{ casa: 'TESTE SILVES', fora: SC, estado: 'Agendado', local: '' }] },
        { nome: 'o nome reconstruído vem do dados_clube',
          clube: 'TESTE CLUBE DO PAINEL',
          texto: t('(C)', '8 nov 2026', '15:00', 'TESTE LAGOA', 'Estádio Municipal de Loulé'),
          espera: [{ casa: 'TESTE CLUBE DO PAINEL', fora: 'TESTE LAGOA', estado: 'Agendado' }] },
        { nome: 'sem dados_clube o nome cai no do clube, e não em vazio',
          clube: null,
          texto: t('(C)', '8 nov 2026', '15:00', 'TESTE LAGOA', 'Estádio Municipal de Loulé'),
          espera: [{ casa: SC, fora: 'TESTE LAGOA', estado: 'Agendado' }] },
        { nome: 'os dois campos só com marcas: não há jogo por onde o reconstruir',
          texto: t('(C)', '18 out 2026', '11:00', '(F)', 'Estádio Municipal de Loulé'),
          espera: [] },
      ];

      const mc = await testarMarcasCasaFora(browser, srv.url, CASOS);
      const todos = [];
      CASOS.forEach((c, i) => {
        const obtido = mc.lidos[i] || [];
        todos.push(...obtido);
        const bate = obtido.length === c.espera.length && c.espera.every((e, k) => {
          const o = obtido[k] || {};
          return Object.keys(e).every((campo) => o[campo] === e[campo]);
        });
        verificar(c.nome, bate,
          'obtido: ' + JSON.stringify(obtido) + ' esperado: ' + JSON.stringify(c.espera));
      });

      // ---- A linha da competição nunca é equipa nem recinto ----------
      //
      // O AF Algarve escreve o nome da competição em linha própria no meio da
      // lista — "AF Algarve Juniores C 1ª Divisão 1ª Fase 2026/27". Nenhum
      // parser a conhecia: o junkRe do parseZZJogos só recusa linhas que
      // COMECEM por "jornada" ou "competição", e esta começa por "AF Algarve".
      // Medido antes da correção: o título ficava em fora, e noutra forma em
      // local. O "C" de "Juniores C" não é marcador de casa — o _marcaLadoDe()
      // exige parênteses —, e há aqui um teste que o fixa.
      const COMP = 'AF Algarve Juniores C 1ª Divisão 1ª Fase 2026/27';
      verificar('admin.js: a linha de competição exige duas provas independentes',
        /function _ehLinhaDeCompeticao\(linha\)/.test(fonteMarcas)
        && /provas >= 2/.test(fonteMarcas)
        && /JSC_PROVAS_COMPETICAO/.test(fonteMarcas));
      verificar('admin.js: as linhas de competição saem antes do despacho',
        /\.filter\(l => !_ehLinhaDeCompeticao\(l\)\)/.test(fonteMarcas));
      // A rede de segurança usa a versão de CAMPO, não a de linha: a linha de
      // um jogo do ZeroZero traz a competição lá dentro, e a função de linha
      // tem de ser mais exigente para não apagar a linha inteira.
      verificar('admin.js: rede de segurança — competição num campo de equipa descarta o jogo',
        /if \(_ehTextoDeCompeticao\(j\.casa\) \|\| _ehTextoDeCompeticao\(j\.fora\)\) continue;/.test(fonteMarcas)
        && /if \(_ehTextoDeCompeticao\(j\.local\)\) j\.local = '';/.test(fonteMarcas)
        && /function _ehTextoDeCompeticao\(valor\)/.test(fonteMarcas)
        && /function _ehLinhaDeCompeticao\(linha\)/.test(fonteMarcas));

      const CASOS_COMP = [
        { nome: 'competição como cabeçalho: o jogo sai inteiro',
          texto: t(COMP, SC + ' (C)', '20 set 2026', '3-1', 'TESTE SILVES', 'Estádio Municipal de Loulé'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Realizado', gcasa: 3, gfora: 1, local: 'Estádio Municipal de Loulé' }] },
        { nome: 'competição entre dois jogos: os dois saem corretos',
          texto: t(SC + ' (C)', '20 set 2026', '3-1', 'TESTE SILVES (F)', COMP,
                   SC + ' (F)', '27 set 2026', '0-2', 'TESTE FARO (C)', 'Campo de Faro'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Realizado', gcasa: 3, gfora: 1 },
                   { casa: 'TESTE FARO', fora: SC, estado: 'Realizado', gcasa: 2, gfora: 0, local: 'Campo de Faro' }] },
        { nome: 'competição no ZeroZero: não entra em equipa nem em local',
          texto: t('20/09/2026', SC, '3-1', 'TESTE SILVES', COMP),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Realizado', local: '' }] },
        { nome: 'controlo: um recinto com o nome de uma cidade não é competição',
          texto: t(SC + ' (C)', '20 set 2026', '3-1', 'TESTE SILVES (F)', 'Estádio Municipal de Silves'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Realizado', local: 'Estádio Municipal de Silves' }] },
        { nome: 'controlo: o nome do clube não é lido como competição',
          texto: t(SC + ' (C)', '20 set 2026', '11:00', 'TESTE SILVES (F)', 'Campo Zona Verde'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', estado: 'Agendado', local: 'Campo Zona Verde' }] },
      ];
      const cp = await testarMarcasCasaFora(browser, srv.url, CASOS_COMP);
      const ehComp = (x) => /af\s*algarve|divis[ãa]o|juniores|20\d\d\s*\//i.test(String(x == null ? '' : x));
      const todosComp = [];
      CASOS_COMP.forEach((c, i) => {
        const obtido = cp.lidos[i] || [];
        todosComp.push(...obtido);
        const bate = obtido.length === c.espera.length && c.espera.every((e, k) => {
          const o = obtido[k] || {};
          return Object.keys(e).every((campo) => o[campo] === e[campo]);
        });
        verificar(c.nome, bate, 'obtido: ' + JSON.stringify(obtido) + ' esperado: ' + JSON.stringify(c.espera));
      });
      verificar('nenhuma competição ficou em casa, fora ou local',
        todosComp.length > 0 && todosComp.every((j) => !ehComp(j.casa) && !ehComp(j.fora) && !ehComp(j.local)),
        JSON.stringify(todosComp.filter((j) => ehComp(j.casa) || ehComp(j.fora) || ehComp(j.local))));
      verificar('o C de «Juniores C» não é lido como marcador de casa',
        todosComp.every((j) => j.casa !== '' && j.fora !== ''),
        JSON.stringify(todosComp.map((j) => j.casa + ' / ' + j.fora)));
      verificar('painel: sem erros de JavaScript nas formas com competição',
        cp.erros.length === 0, cp.erros.join(' | '));

      // ---- A linha de jogo do ZeroZero, com o marcador do lado -------
      //
      // Forma real medida na colagem (campos separados por tabulação):
      //   D \t 2026-10-11 \t 11:00 \t (F) \t Ginásio de Tavira \t
      //   Ginásio de Tavira \t 4-2 \t AF Algarve Juniores C 1ª Divisão 1ª
      //   Fase 2026/27 \t J3
      //
      // Antes: o parseSingleLineJogos lia o adversário como casa e a
      // COMPETIÇÃO como visitante — "casa=Ginásio de Tavira, fora=AF Algarve
      // Juniores C…" —, que é exactamente o que estava nos 3 registos de
      // Classe C medidos em produção; e nos agendados punha o adversário no
      // local. Depois do filtro de linha do cc8f7e7, a linha inteira deixou
      // de ser reconhecida: o filtro apanhava-a por conter a competição.
      //
      // Agora o lado atribui-se pelo marcador — (C) o clube em casa, (F) o
      // clube fora — e o resultado do ZeroZero NÃO é invertido, porque já vem
      // na ordem casa-fora.
      const lin = (...campos) => campos.join('\t');
      const linP = (...campos) => campos.join(' | ');
      const R1 = ['D', '2026-10-11', '11:00', '(F)', 'TESTE TAVIRA', 'TESTE TAVIRA', '4-2', COMP, 'J3'];
      const R2 = ['D', '2026-10-04', '09:00', '(C)', 'TESTE SILVES', 'TESTE SILVES', '0-2', COMP, 'J2'];
      const R3 = ['D', '2026-09-27', '11:00', '(F)', 'TESTE FARENSE B', 'TESTE FARENSE B', '4-0', COMP, 'J1'];

      verificar('admin.js: a forma do ZeroZero atribui o lado e não inverte o resultado',
        /function _jogoDeLinhaZZ\(parts, next\)/.test(fonteMarcas)
        && /const casa = marca === 'C' \? clube : adversario;/.test(fonteMarcas)
        && /const fora = marca === 'C' \? adversario : clube;/.test(fonteMarcas)
        && /gcasa: score \? score\.gcasa : null,/.test(fonteMarcas));
      verificar('admin.js: a jornada e a competição saem da linha',
        /if \(\/\^J\\s\*\\d\{1,3\}\$\/i\.test\(p\)\) continue;/.test(fonteMarcas)
        && /if \(_ehTextoDeCompeticao\(p\)\) continue;/.test(fonteMarcas));
      verificar('admin.js: o filtro de linha poupa linhas com data, hora ou resultado',
        /if \(campos\.length > 2\) return false;/.test(fonteMarcas)
        && /if \(\/\\b\\d\{4\}-\\d\{2\}-\\d\{2\}\\b\/\.test\(t\)\) return false;/.test(fonteMarcas));

      const CASOS_ZZ = [
        { nome: 'ZZ real, (F) com 4-2: o adversário em casa e o resultado intacto',
          texto: lin(...R1),
          espera: [{ casa: 'TESTE TAVIRA', fora: SC, gcasa: 4, gfora: 2, estado: 'Realizado', local: '', data: '2026-10-11', hora: '11:00' }] },
        { nome: 'ZZ real, (C) com 0-2: o clube em casa e o resultado intacto',
          texto: lin(...R2),
          espera: [{ casa: SC, fora: 'TESTE SILVES', gcasa: 0, gfora: 2, estado: 'Realizado', local: '', data: '2026-10-04' }] },
        { nome: 'ZZ real, (F) com 4-0: o adversário em casa e o resultado intacto',
          texto: lin(...R3),
          espera: [{ casa: 'TESTE FARENSE B', fora: SC, gcasa: 4, gfora: 0, estado: 'Realizado', local: '', data: '2026-09-27' }] },
        { nome: 'os três realizados na mesma colagem',
          texto: [lin(...R1), lin(...R2), lin(...R3)].join('\n'),
          espera: [{ casa: 'TESTE TAVIRA', fora: SC, gcasa: 4, gfora: 2 },
                   { casa: SC, fora: 'TESTE SILVES', gcasa: 0, gfora: 2 },
                   { casa: 'TESTE FARENSE B', fora: SC, gcasa: 4, gfora: 0 }] },
        { nome: 'a mesma forma separada por barras',
          texto: [linP(...R1), linP(...R2), linP(...R3)].join('\n'),
          espera: [{ casa: 'TESTE TAVIRA', fora: SC, gcasa: 4, gfora: 2 },
                   { casa: SC, fora: 'TESTE SILVES', gcasa: 0, gfora: 2 },
                   { casa: 'TESTE FARENSE B', fora: SC, gcasa: 4, gfora: 0 }] },
        { nome: 'agendado (C): o clube em casa, sem resultado e sem local',
          texto: lin('', '2026-10-18', '11:00', '(C)', 'TESTE QUARTEIRENSE', 'TESTE QUARTEIRENSE', '', COMP, 'J4'),
          espera: [{ casa: SC, fora: 'TESTE QUARTEIRENSE', estado: 'Agendado', hora: '11:00', local: '', gcasa: null, gfora: null }] },
        { nome: 'agendado (F): o adversário em casa, sem resultado e sem local',
          texto: lin('', '2026-10-25', '10:30', '(F)', 'TESTE MESSINENSE', 'TESTE MESSINENSE', '', COMP, 'J5'),
          espera: [{ casa: 'TESTE MESSINENSE', fora: SC, estado: 'Agendado', hora: '10:30', local: '' }] },
        { nome: 'recinto explícito na linha é preservado',
          texto: lin(...R1, 'Estádio Municipal de Tavira'),
          espera: [{ casa: 'TESTE TAVIRA', fora: SC, local: 'Estádio Municipal de Tavira' }] },
        { nome: 'o adversário repetido conta uma vez',
          texto: lin('D', '2026-10-04', '09:00', '(C)', 'TESTE SILVES', 'TESTE SILVES', 'TESTE SILVES', '0-2', COMP, 'J2'),
          espera: [{ casa: SC, fora: 'TESTE SILVES', gcasa: 0, gfora: 2, local: '' }] },
        { nome: 'controlo: sem marcador a linha cai no caminho genérico',
          texto: lin('2026-10-04', 'TESTE SILVES', '0-2', SC),
          espera: [{ casa: 'TESTE SILVES', fora: SC, gcasa: 0, gfora: 2 }] },
      ];
      const zz = await testarMarcasCasaFora(browser, srv.url, CASOS_ZZ);
      const todosZZ = [];
      CASOS_ZZ.forEach((c, i) => {
        const obtido = zz.lidos[i] || [];
        todosZZ.push(...obtido);
        const bate = obtido.length === c.espera.length && c.espera.every((e, k) => {
          const o = obtido[k] || {};
          return Object.keys(e).every((campo) => o[campo] === e[campo]);
        });
        verificar(c.nome, bate, 'obtido: ' + JSON.stringify(obtido) + ' esperado: ' + JSON.stringify(c.espera));
      });

      const ehCompZZ = (x) => /af\s*algarve|divis[ãa]o|juniores|20\d\d\s*\//i.test(String(x == null ? '' : x));
      verificar('nenhuma competição em casa, fora ou local na forma do ZeroZero',
        todosZZ.length > 0 && todosZZ.every((j) => !ehCompZZ(j.casa) && !ehCompZZ(j.fora) && !ehCompZZ(j.local)),
        JSON.stringify(todosZZ.filter((j) => ehCompZZ(j.casa) || ehCompZZ(j.fora) || ehCompZZ(j.local))));
      verificar('a jornada nunca é equipa nem local',
        todosZZ.every((j) => !/^J\s*\d{1,3}$/i.test((j.casa || '').trim())
          && !/^J\s*\d{1,3}$/i.test((j.fora || '').trim())
          && !/^J\s*\d{1,3}$/i.test((j.local || '').trim())),
        JSON.stringify(todosZZ.map((j) => [j.casa, j.fora, j.local])));
      verificar('o adversário nunca é usado como local',
        todosZZ.every((j) => !j.local
          || (j.local.toLowerCase() !== (j.casa || '').toLowerCase()
           && j.local.toLowerCase() !== (j.fora || '').toLowerCase())),
        JSON.stringify(todosZZ.filter((j) => j.local
          && (j.local.toLowerCase() === (j.casa || '').toLowerCase()
           || j.local.toLowerCase() === (j.fora || '').toLowerCase()))));

      // A letra V/E/D da fonte é uma testemunha independente da orientação do
      // resultado: se os lados ou os golos saíssem trocados, deixava de bater.
      const FORMA = [
        { letra: 'D', campos: R1 }, { letra: 'D', campos: R2 }, { letra: 'D', campos: R3 },
        { letra: 'V', campos: ['V', '2026-09-20', '11:00', '(C)', 'TESTE LAGOA', 'TESTE LAGOA', '3-1', COMP, 'J0'] },
        { letra: 'V', campos: ['V', '2026-09-13', '11:00', '(F)', 'TESTE GUIA', 'TESTE GUIA', '0-2', COMP, 'J0'] },
        { letra: 'E', campos: ['E', '2026-09-06', '11:00', '(C)', 'TESTE ALVOR', 'TESTE ALVOR', '2-2', COMP, 'J0'] },
      ];
      const fz = await testarMarcasCasaFora(browser, srv.url,
        FORMA.map((f) => ({ nome: f.letra, texto: lin(...f.campos) })));
      const coerentes = FORMA.map((f, i) => {
        const j = (fz.lidos[i] || [])[0];
        if (!j) return f.letra + '=(sem jogo)';
        const clubeEmCasa = /campinense/i.test(j.casa || '');
        const gc = clubeEmCasa ? j.gcasa : j.gfora;
        const go = clubeEmCasa ? j.gfora : j.gcasa;
        const calc = gc > go ? 'V' : gc === go ? 'E' : 'D';
        return calc === f.letra ? 'ok' : f.letra + '!=' + calc;
      });
      verificar('o resultado concorda com a letra V/E/D da fonte nas seis linhas',
        coerentes.every((x) => x === 'ok'), JSON.stringify(coerentes));
      verificar('painel: sem erros de JavaScript na forma do ZeroZero',
        zz.erros.length === 0 && fz.erros.length === 0, (zz.erros.concat(fz.erros)).join(' | '));

      const temMarca = (x) => /\(\s*[CF]\s*\)/i.test(String(x == null ? '' : x));
      verificar('a marca nunca fica em casa, fora ou local — em nenhuma das formas',
        todos.length > 0 && todos.every((j) => !temMarca(j.casa) && !temMarca(j.fora) && !temMarca(j.local)),
        JSON.stringify(todos.filter((j) => temMarca(j.casa) || temMarca(j.fora) || temMarca(j.local))));
      // Contam-se letras, não caracteres: "(F)" tem três caracteres e passava
      // por um nome. Medido na verificação negativa, onde este invariante
      // passava com casa="(F)" à vista no resultado.
      const letras = (x) => String(x == null ? '' : x).replace(/[^A-Za-zÀ-ÿ]/g, '').length;
      verificar('nenhum jogo fica sem nome em casa ou fora',
        todos.length > 0 && todos.every((j) => letras(j.casa) >= 3 && letras(j.fora) >= 3),
        JSON.stringify(todos.filter((j) => letras(j.casa) < 3 || letras(j.fora) < 3)));
      verificar('a data sobrevive em todas as formas',
        todos.every((j) => /^\d{4}-\d{2}-\d{2}$/.test(j.data || '')),
        JSON.stringify(todos.map((j) => j.data)));
      verificar('o campo transitório da marca do recinto não chega aos dados',
        todos.every((j) => !/_marcaLocal/.test(j.campos || '')),
        JSON.stringify(todos.map((j) => j.campos).filter((c) => /_marcaLocal/.test(c || ''))));
      verificar('painel: sem erros de JavaScript em nenhuma das quinze formas',
        mc.erros.length === 0, mc.erros.join(' | '));
    }

    // ---- O local no cartão de jogo ----------------------------------
    console.log('\nos cartões de jogo: o local não repete o nome da equipa');
    {
      const fonteLocal = fs.readFileSync(path.join(raiz, 'js', 'resultados.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('resultados.js: o local passa por um ajudante só dele',
        (fonteLocal.match(/\$\{jogoLocalHtml\(j\)\}/g) || []).length === 2
        && /function jogoLocalHtml\(j\) \{/.test(fonteLocal));
      verificar('resultados.js: as duas validações de sempre continuam lá',
        /local\.length <= 2 \|\| \/\^\[A-Z\]\{2,4\}\$\/\.test\(local\)/.test(fonteLocal));
      verificar('resultados.js: compara por igualdade, não por contenção',
        /=== local\.toLowerCase\(\)/.test(fonteLocal)
        && !/local\.indexOf|includes\(local\)|local\.includes/.test(fonteLocal));

      const JOGOS = [
        // 1. local igual à equipa visitante, num jogo do clube.
        { id: 1, escalao: 'Sub-17', data: '2099-03-01', hora: '15:00', casa: 'Sport Campinense',
          fora: 'TESTE SILVES', estado: 'Agendado', local: 'TESTE SILVES' },
        // 2. local igual à equipa da casa, entre terceiros.
        { id: 2, escalao: 'Sub-17', data: '2099-03-02', hora: '16:00', casa: 'TESTE PORTIMONENSE B',
          fora: 'TESTE GUIA FC', estado: 'Agendado', local: 'TESTE PORTIMONENSE B' },
        // 3. local a sério.
        { id: 3, escalao: 'Sub-17', data: '2099-03-03', hora: '17:00', casa: 'Sport Campinense',
          fora: 'TESTE OLHANENSE', estado: 'Agendado', local: 'Estádio Municipal de Loulé' },
        // 4. local que CONTÉM o nome da equipa: é um recinto, e fica.
        { id: 4, escalao: 'Sub-17', data: '2099-03-04', hora: '18:00', casa: 'Sport Campinense',
          fora: 'TESTE SILVES', estado: 'Agendado', local: 'Estádio Municipal de TESTE SILVES' },
        // 5 e 6. o mesmo nos Últimos Resultados.
        { id: 5, escalao: 'Sub-17', data: '2020-02-01', hora: '15:00', casa: 'Sport Campinense',
          fora: 'TESTE SILVES', estado: 'Realizado', gcasa: 2, gfora: 1, local: 'TESTE SILVES' },
        { id: 6, escalao: 'Sub-17', data: '2020-02-02', hora: '16:00', casa: 'TESTE PORTIMONENSE B',
          fora: 'TESTE GUIA FC', estado: 'Realizado', gcasa: 1, gfora: 1, local: 'Estádio da Mata' },
      ];

      const lj = await testarLocalDosJogos(browser, srv.url, JOGOS);
      const metas = (lista) => lista.map((l) => l.meta);
      const repetidos = (lista) => lista.filter((l) => l.meta
        && l.equipas.some((e) => e.trim().toLowerCase() === l.meta.trim().toLowerCase()));

      verificar('medição válida: quatro próximos e dois resultados desenhados',
        lj.prox.length === 4 && lj.ultimos.length === 2,
        JSON.stringify([lj.prox.length, lj.ultimos.length]));

      verificar('local igual à equipa visitante: o local não aparece',
        lj.prox[0].meta === null, JSON.stringify(lj.prox[0]));
      verificar('local igual à equipa da casa: o local não aparece',
        lj.prox[1].meta === null, JSON.stringify(lj.prox[1]));
      verificar('local a sério: continua visível',
        lj.prox[2].meta === 'Estádio Municipal de Loulé', JSON.stringify(lj.prox[2].meta));
      verificar('local que contém o nome da equipa: é um recinto, e continua visível',
        lj.prox[3].meta === 'Estádio Municipal de TESTE SILVES', JSON.stringify(lj.prox[3].meta));

      verificar('Próximos Jogos: nenhum cartão repete o nome da equipa',
        repetidos(lj.prox).length === 0, JSON.stringify(repetidos(lj.prox).map((l) => l.texto)));
      verificar('Últimos Resultados: igual — o repetido sai, o recinto fica',
        lj.ultimos.length === 2 && repetidos(lj.ultimos).length === 0
        && metas(lj.ultimos).indexOf('Estádio da Mata') !== -1,
        JSON.stringify(lj.ultimos.map((l) => l.texto)));

      verificar('e os nomes das equipas continuam todos visíveis',
        lj.prox[0].texto.indexOf('TESTE SILVES') !== -1
        && lj.prox[1].texto.indexOf('TESTE PORTIMONENSE B') !== -1
        && lj.prox[1].texto.indexOf('TESTE GUIA FC') !== -1
        && lj.ultimos.some((l) => l.texto.indexOf('TESTE SILVES') !== -1),
        JSON.stringify(lj.prox.map((l) => l.texto)));

      verificar('resultados.html: sem erros de JavaScript',
        lj.erros.length === 0, lj.erros.join(' | '));
    }

    // ---- Um só formato nos cartões de jogo -------------------------
    console.log('\nos cartões de jogo: um formato só, e nada que não seja um jogo');
    {
      const fonteUni = fs.readFileSync(path.join(raiz, 'js', 'resultados.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('resultados.js: o campo onde o clube está e o lado em que joga são coisas distintas',
        /function clubeNoJogo\(j\)/.test(fonteUni)
        && /return \{ campo: 'casa', emCasa: mCasa === 'C' \};/.test(fonteUni)
        && /return \{ campo: 'fora', emCasa: mFora !== 'C' \};/.test(fonteUni)
        && /const noCampoCasa = clube\.campo === 'casa';/.test(fonteUni));
      verificar('resultados.js: há um guarda do que é desenhável, aplicado às duas listas',
        /function jogoRenderavel\(j\)/.test(fonteUni)
        && /const jogos = dados\.jogos\.filter\(jogoRenderavel\);/.test(fonteUni)
        && /JSC_NAO_E_EQUIPA/.test(fonteUni));
      verificar('resultados.js: a marca sai dos nomes que se mostram',
        /function semMarca\(nome\)/.test(fonteUni)
        && /jscEsc\(semMarca\(j\.casa\)\)/.test(fonteUni)
        && /jscEsc\(semMarca\(j\.fora\)\)/.test(fonteUni));

      const SC = 'Sport Campinense';
      const g = (id, dia, casa, fora, extra) => Object.assign({
        id, escalao: 'Sub-17', data: '2099-04-' + String(dia).padStart(2, '0'), hora: '11:00',
        casa, fora, estado: 'Agendado', local: '',
      }, extra || {});
      const UNI = [
        g(1, 10, SC, 'TESTE SILVES'),                       // clube em casa
        g(2, 11, 'TESTE FARO', SC),                         // clube fora
        g(3, 12, '(C)', 'TESTE LAGOA'),                     // nome do clube perdido, joga em casa
        g(4, 13, '(F)', 'TESTE GUIA'),                      // nome do clube perdido, joga fora
        g(5, 14, SC + ' (C)', 'TESTE ALVOR (F)'),           // marca colada aos nomes
        g(6, 15, 'h2h', 'TESTE SILVES'),                    // h2h como equipa
        g(7, 16, 'TESTE SILVES', 'h2h'),                    // h2h do outro lado
        g(8, 17, 'TESTE OLHAO', 'TESTE QUARTEIRA'),         // jogo entre terceiros
        g(9, 18, SC, 'TESTE MESSINENSE', { estado: 'Realizado', gcasa: 2, gfora: 1 }),
        g(10, 19, 'h2h', 'TESTE BOLIQUEIME', { estado: 'Realizado', gcasa: 1, gfora: 1 }),
      ];
      const un = await testarLocalDosJogos(browser, srv.url, UNI);

      verificar('medição válida: os dois blocos foram desenhados',
        un.prox.length > 0 && un.ultimos.length > 0,
        JSON.stringify([un.prox.length, un.ultimos.length]));
      verificar('um cartão por jogo: os registos h2h não desenham nada',
        un.prox.length === 6 && un.ultimos.length === 1,
        JSON.stringify({ prox: un.prox.map((c) => c.texto), ultimos: un.ultimos.map((c) => c.texto) }));
      verificar('nenhum cartão mostra h2h',
        un.prox.concat(un.ultimos).every((c) => !/h2h/i.test(c.texto)),
        JSON.stringify(un.prox.concat(un.ultimos).filter((c) => /h2h/i.test(c.texto))));
      verificar('nenhum cartão mostra (C) ou (F)',
        un.prox.concat(un.ultimos).every((c) => !/\(\s*[CF]\s*\)/i.test(c.texto)),
        JSON.stringify(un.prox.concat(un.ultimos).filter((c) => /\(\s*[CF]\s*\)/i.test(c.texto))));
      verificar('(C) vira etiqueta CASA, com o adversário certo',
        un.prox[2].etiqueta === 'Casa' && un.prox[2].temVS === false
        && un.prox[2].texto.indexOf('TESTE LAGOA') !== -1,
        JSON.stringify(un.prox[2]));
      verificar('(F) vira etiqueta FORA, com o adversário certo',
        un.prox[3].etiqueta === 'Fora' && un.prox[3].temVS === false
        && un.prox[3].texto.indexOf('TESTE GUIA') !== -1,
        JSON.stringify(un.prox[3]));
      verificar('o clube em casa e o clube fora dão CASA e FORA',
        un.prox[0].etiqueta === 'Casa' && un.prox[1].etiqueta === 'Fora',
        JSON.stringify([un.prox[0].etiqueta, un.prox[1].etiqueta]));
      verificar('a marca colada ao nome sai, e a etiqueta fica',
        un.prox[4].etiqueta === 'Casa' && un.prox[4].texto.indexOf('TESTE ALVOR') !== -1
        && !/\(F\)/.test(un.prox[4].texto),
        JSON.stringify(un.prox[4]));
      verificar('com o clube no jogo nunca aparece vs',
        un.prox.filter((c) => c.etiqueta).every((c) => c.temVS === false),
        JSON.stringify(un.prox.filter((c) => c.etiqueta && c.temVS)));
      verificar('o jogo entre terceiros é o único com vs, e mostra as duas equipas',
        un.prox.filter((c) => c.temVS).length === 1
        && un.prox[5].temVS === true
        && un.prox[5].texto.indexOf('TESTE OLHAO') !== -1
        && un.prox[5].texto.indexOf('TESTE QUARTEIRA') !== -1,
        JSON.stringify(un.prox.filter((c) => c.temVS).map((c) => c.texto)));
      verificar('cada cartão com etiqueta mostra uma equipa só — a adversária',
        un.prox.filter((c) => c.etiqueta).every((c) => c.equipas.length === 1),
        JSON.stringify(un.prox.filter((c) => c.etiqueta).map((c) => c.equipas)));
      verificar('Últimos Resultados segue o mesmo formato',
        un.ultimos[0].etiqueta === 'Casa' && un.ultimos[0].temVS === false
        && un.ultimos[0].texto.indexOf('TESTE MESSINENSE') !== -1,
        JSON.stringify(un.ultimos[0]));
      verificar('resultados.html: sem erros de JavaScript no formato único',
        un.erros.length === 0, un.erros.join(' | '));
    }

    // ---- As sugestões dos campos: vazio tem de parecer vazio --------
    console.log('\nos campos do editor: uma sugestão não pode parecer um valor');
    {
      const fonteSug = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: a sugestão do campo Forma já não é uma forma válida',
        /class="form-input ed-forma"[^>]*placeholder="ex: VVEDV"/.test(fonteSug)
        && !/class="form-input ed-forma"[^>]*placeholder="VVEDV"/.test(fonteSug));
      verificar('admin.js: a sugestão dos pontos da 1ª fase já não é um número',
        /placeholder="—"\s*\n\s*style="width:52px/.test(fonteSug));

      const sg = await testarSugestoesDosCampos(browser, srv.url);
      const FORMA_VALIDA = /^[VED]{1,5}$/;
      const NUMERO = /^\d+$/;

      verificar('medição válida: dois campos de forma e dois de pontos da 1ª fase',
        sg.forma.length === 2 && sg.pts1.length === 2,
        JSON.stringify([sg.forma.length, sg.pts1.length]));

      verificar('Forma: a sugestão não é uma sequência de forma válida',
        !FORMA_VALIDA.test(sg.forma[0].placeholder || ''),
        'placeholder: ' + JSON.stringify(sg.forma[0].placeholder));
      verificar('Forma: um campo vazio não mostra nada que se leia como valor',
        sg.forma[0].valor === '' && !FORMA_VALIDA.test(sg.forma[0].oQueSeVe || ''),
        'vazio mostra ' + JSON.stringify(sg.forma[0].oQueSeVe));
      verificar('Forma: o vazio distingue-se do preenchido',
        sg.forma[1].valor === 'VVEDV' && sg.forma[0].oQueSeVe !== sg.forma[1].oQueSeVe,
        JSON.stringify(sg.forma.map((x) => x.oQueSeVe)));

      verificar('Pontos da 1ª fase: a sugestão não é um número',
        !NUMERO.test(sg.pts1[0].placeholder || ''),
        'placeholder: ' + JSON.stringify(sg.pts1[0].placeholder));
      verificar('Pontos da 1ª fase: um campo vazio não mostra nada que se leia como valor',
        sg.pts1[0].valor === '' && !NUMERO.test(sg.pts1[0].oQueSeVe || ''),
        'vazio mostra ' + JSON.stringify(sg.pts1[0].oQueSeVe));
      verificar('Pontos da 1ª fase: o vazio distingue-se do preenchido',
        sg.pts1[1].valor === '6' && sg.pts1[0].oQueSeVe !== sg.pts1[1].oQueSeVe,
        JSON.stringify(sg.pts1.map((x) => x.oQueSeVe)));

      verificar('painel: sem erros de JavaScript na medição das sugestões',
        sg.erros.length === 0, sg.erros.join(' | '));
    }

    // ---- O botão «✎ Manual» do cabeçalho do escalão -----------------
    console.log('\no «Manual» do escalão abre a classificação que a página lê');
    {
      const fonteManual = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: o botão do cabeçalho segue as séries configuradas',
        /\$\{teamKeys\.length <= 1 \? `<button/.test(fonteManual)
        && /abrirEditorClass\('\$\{escalao\}','\$\{teamKeys\[0\] \|\| ''\}'\)/.test(fonteManual)
        && !/abrirEditorClass\('\$\{escalao\}',''\)/.test(fonteManual));

      const linha = (nome, abrev, v, forma) => ({
        equipa: nome, abrev, j: 10, v, e: 0, d: 10 - v, gm: 20 + v, gs: 10, dg: 10 + v,
        pts: v * 3, forma, sc: /campinense/i.test(nome),
      });
      const TRES = [linha('J.S. Campinense', 'JC', 8, ''), linha('TESTE A', 'TA', 6, ''), linha('TESTE B', 'TB', 4, '')];
      const DOZE = Array.from({ length: 12 }, (_, i) =>
        linha(i === 0 ? 'J.S. Campinense' : 'TESTE EQUIPA ' + (i + 1), i === 0 ? 'JC' : 'T' + (i + 1), 12 - i, ''));
      const SERIE = 'Liga_1_Algarve_Futeb';

      const bm = await testarBotaoManual(browser, srv.url, [
        // Sem séries: o botão continua a abrir a classificação do escalão.
        { nome: 'zero-series', cfg: { 'Sub-17': {} },
          chaves: { 'fpf_class_Sub-17': TRES } },
        // Uma série: tem de abrir a série, que é o que a página lê.
        { nome: 'uma-serie', cfg: { 'Sub-17': { teams: { [SERIE]: { nome: 'Liga 1 Algarve Futebol 11' } } } },
          chaves: { ['fpf_class_Sub-17__' + SERIE]: DOZE } },
        // Várias séries: o botão do cabeçalho não aparece.
        { nome: 'duas-series', cfg: { 'Sub-17': { teams: { A: { nome: 'Série A' }, B: { nome: 'Série B' } } } },
          chaves: { 'fpf_class_Sub-17__A': TRES, 'fpf_class_Sub-17__B': TRES } },
      ]);

      // Zero séries
      verificar('zero séries: o «Manual» existe e abre fpf_class_<escalão>',
        bm['zero-series'].temManual === true
        && bm['zero-series'].chaveDoEditor === 'fpf_class_Sub-17'
        && bm['zero-series'].nomesNoEditor.length === 3,
        bm['zero-series'].onclickManual + ' · ' + bm['zero-series'].chaveDoEditor);
      verificar('zero séries: guardar escreve nessa chave e mais nenhuma',
        JSON.stringify(Object.keys(bm['zero-series'].chavesDepois)) === JSON.stringify(['fpf_class_Sub-17'])
        && bm['zero-series'].chavesDepois['fpf_class_Sub-17'][0] === 'J.S. Campinense="VVEDV"',
        JSON.stringify(bm['zero-series'].chavesDepois));
      verificar('zero séries: o botão abre a mesma chave que a página usa',
        bm['zero-series'].chaveDoEditor === bm['zero-series'].publico.chaveDaPagina,
        bm['zero-series'].chaveDoEditor + ' vs ' + bm['zero-series'].publico.chaveDaPagina);
      verificar('zero séries: a forma escrita aparece na classificação pública',
        bm['zero-series'].publico.pontos === 5,
        JSON.stringify(bm['zero-series'].publico));

      // Uma série
      verificar('uma série: o «Manual» existe e abre fpf_class_<escalão>__<série>',
        bm['uma-serie'].temManual === true
        && bm['uma-serie'].chaveDoEditor === 'fpf_class_Sub-17__' + SERIE
        && bm['uma-serie'].nomesNoEditor.length === 12,
        bm['uma-serie'].onclickManual + ' · ' + bm['uma-serie'].chaveDoEditor
        + ' · linhas: ' + bm['uma-serie'].nomesNoEditor.length);
      verificar('uma série: não se cria nenhuma classificação paralela',
        JSON.stringify(Object.keys(bm['uma-serie'].chavesDepois))
          === JSON.stringify(['fpf_class_Sub-17__' + SERIE]),
        JSON.stringify(Object.keys(bm['uma-serie'].chavesDepois)));
      verificar('uma série: o botão abre a mesma chave que a página usa',
        bm['uma-serie'].chaveDoEditor === bm['uma-serie'].publico.chaveDaPagina,
        bm['uma-serie'].chaveDoEditor + ' vs ' + bm['uma-serie'].publico.chaveDaPagina);
      verificar('uma série: a forma escrita aparece na classificação pública',
        bm['uma-serie'].publico.pontos === 5 && bm['uma-serie'].publico.linhas === 12,
        JSON.stringify(bm['uma-serie'].publico));

      // Várias séries
      verificar('duas séries: o «Manual» do cabeçalho não aparece',
        bm['duas-series'].temManual === false && bm['duas-series'].nManual === 0,
        'botões "Manual": ' + bm['duas-series'].nManual);
      verificar('duas séries: cada série continua a ter o seu «✎»',
        bm['duas-series'].nBotoesPorSerie === 2,
        'botões por série: ' + bm['duas-series'].nBotoesPorSerie);

      verificar('painel: sem erros de JavaScript em nenhum dos três cenários',
        Object.values(bm).every((c) => c.erros.length === 0),
        Object.values(bm).map((c) => c.erros.join(' ')).join(' | '));
    }

    // ---- Apagar a classificação do escalão --------------------------
    console.log('\no escalão com classificação base tem como a apagar');
    {
      const fonteApagar = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: o botão aparece em função das linhas da classificação do escalão',
        /\$\{nBase \? `<button/.test(fonteApagar)
        && /onclick="apagarClassBase\('\$\{escalao\}'\)"/.test(fonteApagar));
      verificar('admin.js: apagar grava [] e não remove a chave',
        /localStorage\.setItem\(key, '\[\]'\);/.test(fonteApagar)
        && !/removeItem\(teamStorageKey\(escalao, '', 'class'\)\)/.test(fonteApagar));
      verificar('admin.js: apagar pede confirmação antes de gravar',
        /if \(!confirm\(\s*`Apagar a classificação de/.test(fonteApagar));
      verificar('admin.js: apagar limpa só lastSync e nTeams do nível base',
        /delete escCfg\.lastSync;/.test(fonteApagar) && /delete escCfg\.nTeams;/.test(fonteApagar)
        && !/delete escCfg\.teams/.test(fonteApagar));

      const linha = (nome, v) => ({
        equipa: nome, abrev: nome.slice(0, 3).toUpperCase(), j: 10, v, e: 0, d: 10 - v,
        gm: 20 + v, gs: 10, dg: 10 + v, pts: v * 3, forma: '', sc: /campinense/i.test(nome),
      });
      const ONZE = Array.from({ length: 11 }, (_, i) => linha(i === 0 ? 'J.S. Campinense' : 'BASE ANTIGA ' + (i + 1), 11 - i));
      const DOZE = Array.from({ length: 12 }, (_, i) => linha(i === 0 ? 'J.S. Campinense' : 'SÉRIE NOVA ' + (i + 1), 12 - i));
      const SERIE  = 'LIga_1_Algarve_Futeb';
      const S17    = 'Liga_1_Algarve_Futeb';
      const JOGOS  = [{ id: 1, escalao: 'Sub-15', equipa: '', data: '2026-09-20', casa: 'A', fora: 'B', estado: 'Agendado' }];
      // O estado real medido no data__db.json: base antiga de 11 + série de 12.
      const cfgReal = {
        'Sub-15': { lastSync: '2026-10-12T10:00:00Z', nTeams: 11,
                    teams: { [SERIE]: { nome: 'Liga 1 Algarve Futebol Iniciados', lastSync: '2026-10-12T11:00:00Z', nTeams: 12 } } },
        'Sub-17': { teams: { [S17]: { nome: 'Liga 1 Algarve Futebol 11', nTeams: 12 } } },
      };
      const chavesReais = {
        'fpf_class_Sub-15': ONZE,
        ['fpf_class_Sub-15__' + SERIE]: DOZE,
        ['fpf_class_Sub-17__' + S17]: DOZE,
        'fpf_jogos_Sub-15': [{ casa: 'A', fora: 'B', data: '2026-09-20', estado: 'Agendado' }],
      };

      const ac = await testarApagarClassBase(browser, srv.url, [
        { nome: 'confirmar', escalao: 'Sub-15', outroEscalao: 'Sub-17', cfg: cfgReal, chaves: chavesReais, jogos: JOGOS },
        { nome: 'cancelar',  escalao: 'Sub-15', outroEscalao: 'Sub-17', cfg: cfgReal, chaves: chavesReais, jogos: JOGOS, cancelar: true },
        // Sem classificação de escalão não há o que apagar: o botão não existe.
        { nome: 'sem-base',  escalao: 'Sub-15', outroEscalao: 'Sub-17',
          cfg: { 'Sub-15': { teams: { [SERIE]: { nome: 'Série', nTeams: 12 } } } },
          chaves: { ['fpf_class_Sub-15__' + SERIE]: DOZE }, jogos: JOGOS },
        // Sem séries nenhumas: é aqui que a página pública lê a chave do escalão.
        // O Sub-17 entra sem série nenhuma para servir de controlo: a página
        // lê-lhe a chave do escalão, e ela tem de ficar com as 12 linhas.
        { nome: 'sem-series', escalao: 'Sub-15', outroEscalao: 'Sub-17',
          cfg: { 'Sub-15': { lastSync: '2026-10-12T10:00:00Z', nTeams: 11 } },
          chaves: { 'fpf_class_Sub-15': ONZE, 'fpf_class_Sub-17': DOZE }, jogos: JOGOS },
      ]);

      verificar('o botão existe no escalão com classificação base',
        ac.confirmar.nBotoes === 1, 'botões: ' + ac.confirmar.nBotoes);
      verificar('o botão não existe no escalão sem classificação base',
        ac['sem-base'].nBotoes === 0 && ac.confirmar.nBotoesOutro === 0,
        'sem-base: ' + ac['sem-base'].nBotoes + ' · Sub-17: ' + ac.confirmar.nBotoesOutro);
      verificar('o cabeçalho mostrava a contagem antiga e deixa de a mostrar',
        ac.confirmar.clicou === true
        && /11 eq\./.test(ac.confirmar.cabecalhoAntes)
        && /Sub-15/.test(ac.confirmar.cabecalhoDepois)
        && !/11 eq\./.test(ac.confirmar.cabecalhoDepois),
        ac.confirmar.cabecalhoAntes + ' -> ' + ac.confirmar.cabecalhoDepois);
      verificar('pede confirmação, e diz o que não é afetado',
        /Apagar a classificação de Sub-15 \(11 equipas\)/.test(ac.confirmar.dialogos[0] || '')
        && /séries configuradas \(1\) NÃO são afetadas/.test(ac.confirmar.dialogos[0] || '')
        && /Os jogos NÃO são afetados/.test(ac.confirmar.dialogos[0] || ''),
        JSON.stringify((ac.confirmar.dialogos[0] || '').slice(0, 200)));
      verificar('cancelar não altera nada',
        ac.cancelar.clicou === true
        && JSON.stringify(ac.cancelar.antes) === JSON.stringify(ac.cancelar.depois),
        JSON.stringify(ac.cancelar.antes) + ' vs ' + JSON.stringify(ac.cancelar.depois));
      verificar('confirmar deixa a classificação do escalão com zero linhas',
        ac.confirmar.clicou === true
        && ac.confirmar.antes['fpf_class_Sub-15'] === 11
        && (ac.confirmar.depois || {})['fpf_class_Sub-15'] === 0,
        'antes ' + ac.confirmar.antes['fpf_class_Sub-15'] + ' · depois ' + JSON.stringify((ac.confirmar.depois || {})['fpf_class_Sub-15']));
      verificar('confirmar não toca na série, no outro escalão, nos jogos nem no db_jogos',
        ac.confirmar.clicou === true
        && (ac.confirmar.depois || {})['fpf_class_Sub-15__' + SERIE] === 12
        && (ac.confirmar.depois || {})['fpf_class_Sub-17__' + S17] === 12
        && (ac.confirmar.depois || {})['fpf_jogos_Sub-15'] === 1
        && (ac.confirmar.depois || {})['db_jogos'] === 1,
        JSON.stringify(ac.confirmar.depois));
      verificar('confirmar mantém o teams e a série no fpf_sync_config',
        ac.confirmar.clicou === true
        && /LIga_1_Algarve_Futeb/.test((ac.confirmar.depois || {})['fpf_sync_config'] || '')
        && /"nTeams":12/.test(((ac.confirmar.depois || {})['fpf_sync_config'] || '').replace(/\s/g, ''))
        && !/"nTeams":11/.test(((ac.confirmar.depois || {})['fpf_sync_config'] || '').replace(/\s/g, '')),
        (ac.confirmar.depois || {})['fpf_sync_config']);
      verificar('o botão desaparece depois de apagar',
        ac.confirmar.clicou === true && ac.confirmar.botaoFicou === 0,
        'clicou: ' + ac.confirmar.clicou + ' · botões: ' + ac.confirmar.botaoFicou);
      verificar('a publicação leva fpf_class_Sub-15 como lista vazia',
        !!ac.confirmar.payloadClassData
        && Array.isArray(ac.confirmar.payloadClassData['fpf_class_Sub-15'])
        && ac.confirmar.payloadClassData['fpf_class_Sub-15'].length === 0
        && (ac.confirmar.payloadClassData['fpf_class_Sub-15__' + SERIE] || []).length === 12,
        JSON.stringify(Object.keys(ac.confirmar.payloadClassData || {})));
      verificar('sem séries: a página pública lê a chave do escalão e fica sem linhas',
        ac['sem-series'].publico.alvo.chave === 'fpf_class_Sub-15'
        && ac['sem-series'].publico.alvo.linhas === 0,
        JSON.stringify(ac['sem-series'].publico.alvo));
      verificar('sem séries: o Sub-17 continua intacto na página pública',
        ac['sem-series'].publico.outro.linhas === 12,
        JSON.stringify(ac['sem-series'].publico.outro));
      verificar('com série: a página pública continua a ler a série, com as 12 linhas',
        ac.confirmar.publico.alvo.chave === 'fpf_class_Sub-15__' + SERIE
        && ac.confirmar.publico.alvo.linhas === 12,
        JSON.stringify(ac.confirmar.publico.alvo));
      verificar('painel: sem erros de JavaScript em nenhum dos quatro cenários',
        Object.values(ac).every((c) => c.erros.length === 0),
        Object.values(ac).map((c) => c.erros.join(' ')).join(' | '));
    }

    // ---- O classData na publicação, e a coluna Forma ----------------
    console.log('\npublicar de um browser sem a classificação não a pode apagar');
    {
      const semComentAdm = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: o classData só entra no pedido quando este browser o tem',
        /if \(Object\.keys\(classData\)\.length\) dados\.classData = classData;/.test(semComentAdm)
        && !/classData:\s+Object\.keys\(classData\)\.length \? classData : null,\s*\n\s*\};/.test(semComentAdm));

      const LINHAS = [
        { equipa: 'TESTE PAYLOAD', abrev: 'TP', j: 1, v: 1, e: 0, d: 0, gm: 2, gs: 0, dg: 2, pts: 3, forma: 'V' },
      ];
      const pay = await testarPayloadClassData(browser, srv.url, [
        { nome: 'com-chaves', linhas: LINHAS },
        { nome: 'sem-chaves', linhas: null },
      ]);
      verificar('medição válida: as duas publicações enviaram o pedido',
        pay['com-chaves'].houvePost && pay['sem-chaves'].houvePost,
        JSON.stringify([pay['com-chaves'].houvePost, pay['sem-chaves'].houvePost]));
      verificar('browser com a classificação: o classData vai no pedido com as linhas',
        pay['com-chaves'].temChave
        && pay['com-chaves'].valor['fpf_class_Sub-17'][0].forma === 'V',
        JSON.stringify(pay['com-chaves'].valor));
      verificar('browser sem chaves fpf_class_: o campo é omitido, não vai como null',
        pay['sem-chaves'].temChave === false && pay['sem-chaves'].valor === undefined,
        'temChave: ' + pay['sem-chaves'].temChave + ' valor: ' + JSON.stringify(pay['sem-chaves'].valor));
      verificar('painel: sem erros de JavaScript nas publicações',
        Object.values(pay).every((c) => c.erros.length === 0),
        Object.values(pay).map((c) => c.erros.join(' ')).join(' | '));

      // O outro lado: o servidor, com sessão, pelo api/save.php a sério, em
      // cópia e servidor próprios — este caminho publica.
      const sv = await testarSavePreservaClassData(raiz);
      if (sv.semApache) {
        console.log('  (comportamento saltado: sem Apache não há PHP a servir)');
      } else {
      verificar('medição válida: há sessão de painel para publicar',
        sv.entrou === true, JSON.stringify(sv.entrou));
      verificar('publicar com classData grava a classificação',
        /"ok":true/.test(sv.comClassData.texto)
        && JSON.stringify(sv.depoisDeGravar) === JSON.stringify(['TESTE SAVE A="V"', 'TESTE SAVE B="D"']),
        sv.comClassData.estado + ' ' + sv.comClassData.texto.slice(0, 120)
        + ' → ' + JSON.stringify(sv.depoisDeGravar));
      verificar('publicar SEM mencionar o classData mantém a classificação publicada',
        /"ok":true/.test(sv.semClassData.texto)
        && JSON.stringify(sv.depoisDeOmitir) === JSON.stringify(sv.depoisDeGravar),
        JSON.stringify(sv.depoisDeOmitir));
      // Isto apagava a classificação em silêncio, e é por isso que o painel
      // deixou de enviar o null. Desde a guarda do esvaziamento, o servidor
      // também já não o aceita: recusa com 409 e não toca no ficheiro.
      verificar('um classData null é recusado com 409 e a classificação fica',
        sv.comNull.estado === 409
        && /"codigo":"esvaziamento"/.test(sv.comNull.texto)
        && JSON.stringify(sv.depoisDoNull) === JSON.stringify(sv.depoisDeGravar),
        sv.comNull.estado + ' ' + sv.comNull.texto.slice(0, 160)
        + ' → ' + JSON.stringify(sv.depoisDoNull));
      }
    }

    // ---- A gestão de logótipos no painel ---------------------------
    console.log('\nlogótipos no painel: o mapa é a fonte, e só muda a linha tocada');
    {
      const MAPA = {
        'ferreiras': 'uploads/logos/ferreiras.png',
        'quarteira': 'https://exemplo.invalido/quarteira.png',
        'sem escudo': '',
      };
      const JOGOS = [{ id: 1, casa: 'Equipa Um', fora: 'Equipa Dois' }];
      const CLASSE = [{ equipa: 'Equipa Um', pts: 3 }];
      const base = { mapa: MAPA, jogos: JOGOS, classificacao: CLASSE };

      const pl = await testarPainelLogos(browser, srv.url, [
        { nome: 'listar',    ...base, acao: 'nada' },
        { nome: 'adicionar', ...base, acao: 'adicionar',
          nomeNovo: 'equipa nova', valor: 'https://exemplo.invalido/novo.png' },
        { nome: 'url',       ...base, acao: 'url', chave: 'ferreiras',
          valor: 'https://exemplo.invalido/outro.png' },
        { nome: 'upload-ok', ...base, acao: 'upload', chave: 'quarteira',
          resposta: { estado: 200, corpo: { ok: true, chave: 'quarteira',
            caminho: 'uploads/logos/quarteira.png', slug: 'quarteira', formato: 'png',
            bytes: 1234, largura: 64, altura: 64, restos: [] } } },
        { nome: 'upload-ma', ...base, acao: 'upload', chave: 'quarteira',
          resposta: { estado: 415, corpo: { ok: false, error: 'extensao nao aceite' } } },
        { nome: 'upload-409', ...base, acao: 'upload', chave: 'quarteira',
          resposta: { estado: 409, corpo: { ok: false, codigo: 'conflito',
            error: 'ja usado', conflito: { slug: 'quarteira', dono: 'quarteira b',
              pedido: 'quarteira', caminho: 'uploads/logos/quarteira.png' } } } },
        { nome: 'rename-local', ...base, acao: 'rename', chave: 'ferreiras',
          nomeNovo: 'ferreiras novo',
          resposta: { estado: 200, corpo: { ok: true, acao: 'transferir', slug: 'ferreiras',
            de: 'ferreiras', para: 'ferreiras novo', caminho: 'uploads/logos/ferreiras.png' } } },
        { nome: 'rename-falha', ...base, acao: 'rename', chave: 'ferreiras',
          nomeNovo: 'ferreiras novo',
          resposta: { estado: 409, corpo: { ok: false, codigo: 'conflito',
            error: 'nao tem dono registado',
            conflito: { slug: 'ferreiras', dono: 'outra equipa', de: 'ferreiras', para: 'ferreiras novo' } } } },
        { nome: 'rename-externo', ...base, acao: 'rename', chave: 'quarteira',
          nomeNovo: 'quarteira nova' },
        { nome: 'upload-restos', ...base, acao: 'upload', chave: 'quarteira',
          resposta: { estado: 200, corpo: { ok: true, chave: 'quarteira',
            caminho: 'uploads/logos/quarteira.webp', slug: 'quarteira', formato: 'webp',
            bytes: 900, largura: 64, altura: 64,
            restos: ['uploads/logos/quarteira.png'] } } },
      ]);

      const semEscrita = (x) => x.pedidos.every((q) => /^GET /.test(q) || /logo\.php$/.test(q))
        && x.pedidos.every((q) => q.indexOf('save.php') === -1);

      verificar('lista as três equipas do mapa, por ordem',
        pl.listar.linhas.length === 3
        && pl.listar.linhas.map((l) => l.chave).join(',') === 'ferreiras,quarteira,sem escudo',
        JSON.stringify(pl.listar.linhas.map((l) => l.chave)));
      verificar('distingue LOCAL de EXTERNO, e conta os externos',
        pl.listar.linhas[0].origem === 'LOCAL'
        && pl.listar.linhas[1].origem === 'EXTERNO'
        && /3 equipa\(s\)/.test(pl.listar.resumo)
        && /1 ainda em endereço externo/.test(pl.listar.resumo),
        JSON.stringify(pl.listar.linhas.map((l) => l.origem)) + ' | ' + pl.listar.resumo);
      // O painel vive em /admin/, e o caminho guardado é relativo à raiz do
      // site: sem subir um nível, a pré-visualização pedia
      // /admin/uploads/logos/... e dava sempre FALHOU nas locais. Medido em
      // produção antes de isto existir.
      verificar('a pré-visualização de um caminho local sobe um nível, e o valor guardado não muda',
        pl.listar.linhas[0].src === '../uploads/logos/ferreiras.png'
        && pl.listar.linhas[0].valor === 'uploads/logos/ferreiras.png'
        && pl.listar.antes.logos['ferreiras'] === 'uploads/logos/ferreiras.png',
        'src: ' + pl.listar.linhas[0].src + ' | valor: ' + pl.listar.linhas[0].valor);
      verificar('um endereço externo é pré-visualizado tal e qual',
        pl.listar.linhas[1].src === 'https://exemplo.invalido/quarteira.png',
        'src: ' + pl.listar.linhas[1].src);
      verificar('uma imagem que não carrega fica FALHOU',
        (pl.listar.estadosFinais.find((e) => e.chave === 'quarteira') || {}).estado === 'FALHOU',
        JSON.stringify(pl.listar.estadosFinais));
      verificar('adicionar equipa acrescenta UMA linha e nada mais',
        Object.keys(pl.adicionar.depois.logos).length === 4
        && pl.adicionar.depois.logos['equipa nova'] === 'https://exemplo.invalido/novo.png'
        && JSON.stringify(pl.adicionar.mudadas) === JSON.stringify(['equipa nova']),
        JSON.stringify(pl.adicionar.mudadas));
      verificar('editar o endereço muda só essa entrada',
        pl.url.depois.logos['ferreiras'] === 'https://exemplo.invalido/outro.png'
        && pl.url.depois.logos['quarteira'] === MAPA['quarteira']
        && JSON.stringify(pl.url.mudadas) === JSON.stringify(['ferreiras']),
        JSON.stringify(pl.url.mudadas));
      verificar('upload válido escreve o caminho DO SERVIDOR, e só nessa entrada',
        pl['upload-ok'].depois.logos['quarteira'] === 'uploads/logos/quarteira.png'
        && JSON.stringify(pl['upload-ok'].mudadas) === JSON.stringify(['quarteira']),
        JSON.stringify(pl['upload-ok'].depois.logos));
      verificar('upload recusado (415) não altera o db_logos',
        JSON.stringify(pl['upload-ma'].depois.logos) === JSON.stringify(MAPA)
        && pl['upload-ma'].mudadas.length === 0,
        JSON.stringify(pl['upload-ma'].depois.logos));
      verificar('resposta 409 não altera o db_logos e mostra o conflito por inteiro',
        JSON.stringify(pl['upload-409'].depois.logos) === JSON.stringify(MAPA)
        && pl['upload-409'].mudadas.length === 0
        && pl['upload-409'].avisoVisivel === true
        && /CONFLITO DE NOME/.test(pl['upload-409'].aviso)
        && /quarteira b/.test(pl['upload-409'].aviso),
        pl['upload-409'].aviso.slice(0, 140));
      verificar('restos são apenas mostrados, com o caminho do ficheiro antigo',
        pl['upload-restos'].avisoVisivel === true
        && /quarteira\.png/.test(pl['upload-restos'].aviso)
        && /Não é apagado/.test(pl['upload-restos'].aviso)
        && pl['upload-restos'].depois.logos['quarteira'] === 'uploads/logos/quarteira.webp',
        pl['upload-restos'].aviso.slice(0, 140));
      verificar('nenhum cenário altera db_jogos nem a classificação',
        Object.values(pl).every((x) => x.depois.jogos === x.antes.jogos
          && x.depois.classe === x.antes.classe),
        JSON.stringify(Object.keys(pl).filter((n) => pl[n].depois.jogos !== pl[n].antes.jogos
          || pl[n].depois.classe !== pl[n].antes.classe)));
      verificar('Publicar não é chamado: nenhum pedido ao save.php',
        Object.values(pl).every(semEscrita),
        JSON.stringify(Object.keys(pl).map((n) => n + ': ' + JSON.stringify(pl[n].pedidos))));
      verificar('rename LOCAL pede a transferência e, com ela boa, muda a chave',
        pl['rename-local'].pedidos.some((q) => /POST \/api\/logo\.php$/.test(q))
        && pl['rename-local'].depois.logos['ferreiras novo'] === 'uploads/logos/ferreiras.png'
        && pl['rename-local'].depois.logos['ferreiras'] === undefined,
        JSON.stringify(pl['rename-local'].depois.logos));
      verificar('rename LOCAL com a transferência a falhar: db_logos NÃO muda',
        JSON.stringify(pl['rename-falha'].depois.logos) === JSON.stringify(MAPA)
        && pl['rename-falha'].mudadas.length === 0
        && pl['rename-falha'].avisoVisivel === true
        && /TRANSFERÊNCIA DE DONO FALHOU/.test(pl['rename-falha'].aviso),
        pl['rename-falha'].aviso.slice(0, 120));
      verificar('rename EXTERNO não chama o endpoint nenhuma vez',
        pl['rename-externo'].pedidos.every((q) => !/logo\.php/.test(q))
        && pl['rename-externo'].depois.logos['quarteira nova'] === MAPA['quarteira'],
        JSON.stringify(pl['rename-externo'].pedidos));
      verificar('painel: sem erros de JavaScript em nenhum dos cenários',
        Object.values(pl).every((x) => x.erros.length === 0),
        Object.values(pl).map((x) => x.erros.join(' ')).join(' | '));

      const semComentLg = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: nenhum clube está escrito em código na gestão de logos',
        !/louletano|ferreiras|quarteira|silves|portimonense/i.test(
          semComentLg.slice(semComentLg.indexOf('function renderLogos'),
                            semComentLg.indexOf('window.enviarLogo'))));
      verificar('admin.js: o painel usa o caminho do servidor e não monta nenhum',
        /mapa\[chaveFinal\] = json\.caminho;/.test(semComentLg)
        && !/uploads\/logos\/' \+/.test(semComentLg));
      verificar('admin.js: um setItem que falhe avisa e devolve false',
        /return false;/.test(semComentLg.slice(semComentLg.indexOf('function guardarLogos'),
          semComentLg.indexOf('function jscLogoOrigem'))));
    }

    // ---- Os blocos do cPanel no .htaccess da raiz -------------------
    // Medido: o ficheiro do servidor tinha 112 directivas efectivas e o do
    // repositório 81 — as 31 em falta eram exactamente estes dois blocos, e
    // nenhuma directiva nossa faltava do lado de lá. Sem eles, enviar este
    // ficheiro por cima do que está no ar apagava o handler do PHP 8.3 e
    // derrubava todo o PHP do site.
    console.log('\no .htaccess da raiz carrega os blocos do alojamento, intactos');
    {
      const ht = fs.readFileSync(path.join(raiz, '.htaccess'), 'utf8');
      const conta = (agulha) => ht.split(agulha).length - 1;
      // Para CONTAR directivas é preciso tirar os comentários: o cabeçalho de
      // aviso que precede os blocos menciona <IfModule php8_module> e
      // <IfModule lsapi_module> para explicar que podem ser inertes em
      // PHP-FPM, e a contagem crua apanhava o comentário e o código. Medido:
      // dava 2 onde o ficheiro tem 1.
      const htDir = ht.replace(/^\s*#.*$/gm, '');
      const contaDir = (agulha) => htDir.split(agulha).length - 1;

      verificar('o bloco do handler existe uma única vez, com os marcadores exactos',
        conta('# php -- BEGIN cPanel-generated handler, do not edit') === 1
        && conta('# php -- END cPanel-generated handler, do not edit') === 1,
        'begin: ' + conta('# php -- BEGIN cPanel-generated handler, do not edit')
        + ' end: ' + conta('# php -- END cPanel-generated handler, do not edit'));
      verificar('o bloco das directivas php ini existe uma única vez, com os marcadores exactos',
        conta('# BEGIN cPanel-generated php ini directives, do not edit') === 1
        && conta('# END cPanel-generated php ini directives, do not edit') === 1,
        'begin: ' + conta('# BEGIN cPanel-generated php ini directives, do not edit')
        + ' end: ' + conta('# END cPanel-generated php ini directives, do not edit'));
      verificar('o AddHandler nomeia ea-php83 e as três extensões, com um único AddHandler de PHP',
        ht.indexOf('  AddHandler application/x-httpd-ea-php83 .php .php8 .phtml\n') !== -1
        && conta('AddHandler application/x-httpd-ea-php') === 1,
        (ht.match(/AddHandler[^\n]*/g) || []).join(' | '));
      // As aspas curvas são como o cPanel escreve o comentário, e é por elas
      // que ele reconhece o bloco como seu. Quem transcrever à mão e as
      // "corrigir" faz o cPanel acrescentar um segundo bloco.
      verificar('as aspas tipográficas do comentário do handler estão intactas',
        ht.indexOf('# Set the \u201cea-php83\u201d package as the default \u201cPHP\u201d programming language.') !== -1,
        (ht.match(/# Set the[^\n]*/) || ['(ausente)'])[0]);
      verificar('os dois blocos ficam no fim, depois das nossas regras',
        ht.indexOf('# BEGIN cPanel-generated php ini directives') > ht.indexOf('RewriteRule ^uploads/')
        && ht.indexOf('# php -- BEGIN cPanel-generated handler')
             > ht.indexOf('# BEGIN cPanel-generated php ini directives'),
        'uploads/ em ' + ht.indexOf('RewriteRule ^uploads/')
        + ', ini em ' + ht.indexOf('# BEGIN cPanel-generated php ini directives')
        + ', handler em ' + ht.indexOf('# php -- BEGIN cPanel-generated handler'));
      verificar('as doze directivas php estão nos dois IfModule, php8_module e lsapi_module',
        contaDir('<IfModule php8_module>') === 1 && contaDir('<IfModule lsapi_module>') === 1
        && contaDir('php_value post_max_size 8M') === 2
        && contaDir('php_value upload_max_filesize 2M') === 2
        && contaDir('php_flag display_errors Off') === 2,
        'php8_module: ' + contaDir('<IfModule php8_module>')
        + ' lsapi: ' + contaDir('<IfModule lsapi_module>')
        + ' post_max_size: ' + contaDir('php_value post_max_size 8M')
        + ' upload_max: ' + contaDir('php_value upload_max_filesize 2M')
        + ' display_errors: ' + contaDir('php_flag display_errors Off'));
      // Os blocos trazem caminhos do alojamento. Caminhos não são segredos,
      // mas uma palavra-passe ou uma chave no .htaccess seria.
      verificar('o .htaccess não traz credenciais nem segredos',
        !/password\s*=|passwd\s*=|DB_PASS|api[_-]?key|secret|AuthUserFile/i.test(ht),
        (ht.match(/password|passwd|DB_PASS|api[_-]?key|secret|AuthUserFile/ig) || []).join(','));
      // As nossas regras continuam todas lá: a incorporação acrescenta, não
      // substitui. Uma amostra das que importam para a segurança.
      verificar('nenhuma regra de segurança nossa se perdeu na incorporação',
        /RewriteRule \^uploads\/\.\*\\\.\(php\|phtml/.test(ht)
        && /RewriteRule \^uploads\/logos\/\.\+ - \[F,L\]/.test(ht)
        && /<FilesMatch "\\\.\(env\|json\|log\|sql\|bak\|sh\|bat\|md\)\$">/.test(ht)
        && /RedirectMatch 403 \^\/scraper/.test(ht)
        && /Header always set Content-Security-Policy/.test(ht)
        && /X-Robots-Tag/.test(ht));
    }

    // ---- A ferramenta que compara os dois .htaccess ------------------
    // A secção acima prova que os blocos do cPanel estão aqui HOJE. Isso
    // caduca: muda-se a versão de PHP ou um limite no cPanel e esta cópia
    // fica desactualizada sem ninguém saber. A ferramenta é o que permite
    // ver isso antes de um envio, e tem de ser ela própria testada —
    // incluindo o que promete não fazer: escrever.
    console.log('\ntools/comparar-htaccess.js: compara, e só lê');
    {
      const ch = testarCompararHtaccess(raiz);
      const c = ch.casos;
      const temErro = (nome, agulha) =>
        (c[nome].erros || []).some((l) => l.indexOf(agulha) !== -1);

      verificar('medição válida: o ficheiro do repositório tem os dois blocos e o cabeçalho de aviso',
        ch.ficheiroReal.temBlocoIni && ch.ficheiroReal.temBlocoHandler
        && ch.ficheiroReal.temCabecalhoDeAviso,
        JSON.stringify(ch.ficheiroReal));
      verificar('ficheiros iguais: sai 0, sem um único ERRO',
        c.identico.saida === 0 && c.identico.erros.length === 0
        && /SEM DIVERGÊNCIAS/.test(c.identico.texto),
        'saída ' + c.identico.saida + ' erros ' + JSON.stringify(c.identico.erros));
      // Controlo, e a razão de ser do cabeçalho de aviso: comentários a mais,
      // o cabeçalho a menos e a indentação dobrada não são divergências.
      verificar('controlo: comentários e indentação diferentes não contam como divergência',
        c['so-comentarios'].saida === 0 && c['so-comentarios'].erros.length === 0,
        'saída ' + c['so-comentarios'].saida + ' '
        + JSON.stringify(c['so-comentarios'].erros));
      verificar('a contagem de directivas que o comando imprime é a que a função conta',
        ch.directivasImpressas !== null
        && ch.directivasImpressas === ch.directivasContadas,
        'impressas ' + ch.directivasImpressas + ' contadas ' + ch.directivasContadas);
      verificar('bloco do handler em falta no repositório: sai 1 e nomeia o bloco',
        c['repo-sem-handler'].saida === 1
        && temErro('repo-sem-handler', 'bloco cPanel: handler do PHP')
        && /FALTA no repositório/.test(c['repo-sem-handler'].texto),
        'saída ' + c['repo-sem-handler'].saida + ' '
        + JSON.stringify(c['repo-sem-handler'].erros));
      verificar('versão de PHP diferente: sai 1 e di-lo pelo nome',
        c['versao-php-diferente'].saida === 1
        && temErro('versao-php-diferente', 'versão de PHP')
        && /ea-php83/.test(c['versao-php-diferente'].texto)
        && /ea-php82/.test(c['versao-php-diferente'].texto),
        'saída ' + c['versao-php-diferente'].saida + ' '
        + JSON.stringify(c['versao-php-diferente'].erros));
      verificar('regra de segurança em falta no repositório: sai 1 e nomeia a regra',
        c['repo-sem-regra'].saida === 1
        && temErro('repo-sem-regra', 'executáveis bloqueados em uploads/')
        && /removeria esta protecção do servidor/.test(c['repo-sem-regra'].texto),
        'saída ' + c['repo-sem-regra'].saida + ' '
        + JSON.stringify(c['repo-sem-regra'].erros));
      // O caso que não se resolve a enviar ficheiros: a protecção falta no
      // servidor, e o que está desprotegido é o site, agora.
      verificar('regra de segurança em falta no servidor: sai 1 e diz que o site está sem ela',
        c['servidor-sem-regra'].saida === 1
        && temErro('servidor-sem-regra', 'Content-Security-Policy')
        && /FALTA NO SERVIDOR/.test(c['servidor-sem-regra'].texto),
        'saída ' + c['servidor-sem-regra'].saida + ' '
        + JSON.stringify(c['servidor-sem-regra'].erros));
      // As doze php_value aparecem duas vezes cada, uma por IfModule. Uma
      // comparação por conjuntos não via a perda de uma delas.
      verificar('perder uma das doze php_value repetidas: sai 1 e aparece na lista',
        c['php-value-a-menos'].saida === 1
        && temErro('php-value-a-menos', 'directivas só no servidor')
        && /memory_limit 128M/.test(c['php-value-a-menos'].texto),
        'saída ' + c['php-value-a-menos'].saida + ' '
        + JSON.stringify(c['php-value-a-menos'].erros));
      verificar('ficheiro do servidor ilegível: sai 2 e não o cria',
        ch.semFicheiro.saida === 2 && ch.semFicheiro.criou === false
        && /Não foi possível ler/.test(ch.semFicheiro.texto),
        'saída ' + ch.semFicheiro.saida + ' criou ' + ch.semFicheiro.criou);
      verificar('sem argumento: sai 2 e explica como se usa',
        ch.semArgumento.saida === 2
        && /node tools\/comparar-htaccess\.js/.test(ch.semArgumento.texto),
        'saída ' + ch.semArgumento.saida);
      // A promessa de que a ferramenta não escreve, medida por sha256 dos
      // dois ficheiros de entrada antes e depois de cada execução, e não por
      // ler o código e acreditar.
      verificar('nenhuma das execuções alterou um único byte dos ficheiros lidos',
        Object.keys(c).length === 7
        && Object.keys(c).every((k) => c[k].intactos === true),
        Object.keys(c).map((k) => k + ':' + c[k].intactos).join(' '));
      verificar('a fonte da ferramenta não tem uma única chamada que escreva',
        ch.escritasNaFonte.length === 0,
        JSON.stringify(ch.escritasNaFonte));
      verificar('a ferramenta cobre as doze regras de segurança e os dois blocos',
        ch.nRegras === 12 && ch.nBlocos === 2,
        'regras ' + ch.nRegras + ' blocos ' + ch.nBlocos);
    }

    // ---- Nada dentro de uploads/ é executável ----------------------
    console.log('\nuploads/: as imagens abrem, os executáveis dão 403');
    {
      const htRaiz = fs.readFileSync(path.join(raiz, '.htaccess'), 'utf8');
      verificar('.htaccess da raiz: a regra dos uploads é a primeira do bloco rewrite',
        /RewriteEngine On\s*\n(?:\s*#[^\n]*\n)*\s*RewriteRule \^uploads\/\.\*\\\./.test(htRaiz),
        'primeira RewriteRule: ' + ((htRaiz.match(/RewriteRule [^\n]*/) || [''])[0]).slice(0, 70));
      // Comparação literal sobre a lista extraída da regra. A primeira versao
      // construía expressões e o 'php[0-9]' perdia o escape dos parênteses
      // rectos, passando a classe de caracteres: falhava sem o ficheiro ter
      // nada de errado.
      const lista = ((htRaiz.match(/RewriteRule \^uploads\/\.\*\\\.\(([^)]*)\)/) || [])[1] || '')
        .split('|');
      verificar('.htaccess da raiz: bloqueia php, phtml, phps, php[0-9], pl, py, cgi, shtml, sh',
        ['php', 'phtml', 'phps', 'php[0-9]', 'pl', 'py', 'cgi', 'shtml', 'sh']
          .every((e) => lista.indexOf(e) !== -1),
        'lista da regra: ' + JSON.stringify(lista));
      verificar('.htaccess da raiz: a allowlist das imagens em uploads/logos/',
        /RewriteCond %\{REQUEST_URI\} !\\\.\(png\|jpe\?g\|webp\)\$ \[NC\]/.test(htRaiz)
        && /RewriteRule \^uploads\/logos\/\.\+ - \[F,L\]/.test(htRaiz));
      // Esta asserção fixava a AUSÊNCIA dos blocos do cPanel, que era a verdade
      // quando a regra dos uploads foi escrita: o handler vivia só no servidor.
      // Passou a ser o contrário — os blocos estão versionados de propósito,
      // para um envio por engano não apagar o handler do PHP 8.3. O que aqui
      // importa é que a regra dos uploads é nossa e vem ANTES do território do
      // alojamento; a integridade dos blocos é medida na sua própria secção.
      verificar('.htaccess da raiz: a regra dos uploads vem antes dos blocos do cPanel',
        htRaiz.indexOf('RewriteRule ^uploads/') !== -1
        && htRaiz.indexOf('RewriteRule ^uploads/') < htRaiz.indexOf('cPanel-generated'),
        'uploads em ' + htRaiz.indexOf('RewriteRule ^uploads/')
        + ', cPanel em ' + htRaiz.indexOf('cPanel-generated'));
      verificar('a mesma regra existe nos .htaccess de uploads/, como rede',
        /RewriteRule \\\.\(php\|phtml/.test(fs.readFileSync(path.join(raiz, 'uploads', '.htaccess'), 'utf8'))
        && /RewriteCond %\{REQUEST_URI\} !\\\.\(png\|jpe\?g\|webp\)\$/.test(
             fs.readFileSync(path.join(raiz, 'uploads', 'logos', '.htaccess'), 'utf8')));

      const ex = await testarUploadsSemExecucao(raiz);
      if (ex.semApache) {
        console.log('  (comportamento saltado: sem Apache não há PHP a servir)');
      } else {
      // O .php exacto é arrancado pelo ProxyPassMatch desta bateria antes de
      // qualquer .htaccess, por isso não é observável aqui. Fica dito, e
      // fica medido, para ninguém o ler como garantia.
      // Tudo o que termina exactamente em .php é arrancado pelo
      // ProxyPassMatch ^/(.*\.php)$ do servidor de teste antes de qualquer
      // .htaccess, esteja onde estiver. Não é observável aqui — e classificar
      // o uploads/raiz.php como observável foi erro meu na primeira versao.
      const naoObservavel = ['sonda.php', '../raiz.php'];
      const observaveis = Object.keys(ex.bloqueados).filter((n) => naoObservavel.indexOf(n) === -1);

      verificar('todas as extensões executáveis observáveis dão 403',
        observaveis.filter((n) => n !== 'sonda.txt')
          .every((n) => ex.bloqueados[n].estado === 403),
        JSON.stringify(observaveis.filter((n) => n !== 'sonda.txt')
          .map((n) => n + '=' + ex.bloqueados[n].estado)));
      verificar('nenhuma delas executou PHP',
        observaveis.every((n) => ex.bloqueados[n].executou === false),
        JSON.stringify(observaveis.filter((n) => ex.bloqueados[n].executou)));
      // A extensão dupla é o caso que apanhou o defeito do desenho: terminando
      // em .png, passava a allowlist, e como o mod_rewrite não herda, a regra
      // da raiz não se aplicava naquela pasta. Agora as duas regras estão em
      // cada ficheiro.
      verificar('.php.png e .PhP dão 403 — extensão dupla e maiúsculas',
        ex.bloqueados['sonda.php.png'].estado === 403
        && ex.bloqueados['sonda.PhP'].estado === 403,
        'php.png=' + ex.bloqueados['sonda.php.png'].estado
        + ' PhP=' + ex.bloqueados['sonda.PhP'].estado);
      verificar('nenhum executável observável é servido em bruto',
        observaveis.filter((n) => n !== 'sonda.txt')
          .every((n) => ex.bloqueados[n].servidoEmBruto === false),
        JSON.stringify(observaveis.filter((n) => ex.bloqueados[n].servidoEmBruto)));
      verificar('a allowlist também trava um .txt na pasta dos escudos',
        ex.bloqueados['sonda.txt'].estado === 403,
        String(ex.bloqueados['sonda.txt'].estado));
      verificar('a regra cobre uploads/ inteiro, não só uploads/logos/',
        /RewriteRule \^uploads\/\.\*/.test(htRaiz)
        && /RewriteRule \\\.\(php\|phtml/.test(
             fs.readFileSync(path.join(raiz, 'uploads', '.htaccess'), 'utf8')),
        'a do /uploads/raiz.php não é observável: termina em .php');

      verificar('CONTROLO: as imagens dos escudos continuam a abrir',
        ex.png.estado === 200 && ex.webp.estado === 200,
        'png=' + ex.png.estado + ' webp=' + ex.webp.estado);
      verificar('CONTROLO: o PHP legítimo fora de uploads/ continua a correr',
        ex.apiLoad.estado === 200 && ex.apiAuth.estado === 200,
        'load=' + ex.apiLoad.estado + ' auth=' + ex.apiAuth.estado);
      // O modo catastrófico do bloco do cPanel desactualizado: o PHP servido
      // como texto, com o código-fonte à vista de quem pedir.
      verificar('CONTROLO: nenhum endpoint PHP é servido como código-fonte',
        ex.apiLoad.temFontePhp === false && ex.apiAuth.temFontePhp === false
        && /json/.test(ex.apiLoad.tipo),
        'load: ' + ex.apiLoad.temFontePhp + ' (' + ex.apiLoad.tipo + ')'
        + ' auth: ' + ex.apiAuth.temFontePhp);
      verificar('CONTROLO: as páginas do site continuam a abrir',
        ex.indexHtml.estado === 200, String(ex.indexHtml.estado));

      console.log('      (não observável nesta bateria: /uploads/logos/sonda.php responde '
        + ex.bloqueados['sonda.php'].estado
        + (ex.bloqueados['sonda.php'].executou ? ' E EXECUTA' : ' e nao executa')
        + ' — o ProxyPassMatch do servidor de teste apanha o pedido antes de'
        + ' qualquer .htaccess. No alojamento, onde o PHP vem por handler, a'
        + ' regra corre no fixup e devolve 403: medir no servidor.)');
      }
    }

    // ---- O endpoint dos logótipos -----------------------------------
    console.log('\no api/logo.php: o que recusa antes do que aceita');
    {
      const fonteLogo = fs.readFileSync(path.join(raiz, 'api', 'logo.php'), 'utf8');
      verificar('logo.php: exige o cabeçalho do painel e a capacidade configuracoes',
        /jsc_exigir_pedido_do_painel\(\);/.test(fonteLogo)
        && /jsc_exigir\('configuracoes'\);/.test(fonteLogo));
      verificar('logo.php: o nome do ficheiro vem do slug, nunca do cliente',
        /\$slug \. '\.' \. \$extFinal/.test(fonteLogo)
        && !/basename\(\s*\$f\['name'\]/.test(fonteLogo));
      verificar('logo.php: usa getimagesize e is_uploaded_file',
        /@getimagesize\(\$f\['tmp_name'\]\)/.test(fonteLogo)
        && /is_uploaded_file\(\$f\['tmp_name'\]\)/.test(fonteLogo));
      verificar('logo.php: grava dentro de uploads\/logos e confirma com realpath',
        /__DIR__ \. '\/\.\.\/uploads\/logos'/.test(fonteLogo)
        && /\$destinoReal !== \$raizReal/.test(fonteLogo));
      verificar('logo.php: não toca em jogos, classificações, sync nem publicação',
        fonteLogo.indexOf('db_jogos') === -1 && fonteLogo.indexOf('DATA_FILE') === -1
        && fonteLogo.indexOf('jsc_publicar') === -1 && fonteLogo.indexOf('geracao.php') === -1,
        'db_jogos/DATA_FILE/jsc_publicar/geracao: '
        + [fonteLogo.indexOf('db_jogos'), fonteLogo.indexOf('DATA_FILE'),
           fonteLogo.indexOf('jsc_publicar'), fonteLogo.indexOf('geracao.php')].join(','));

      const ht = fs.readFileSync(path.join(raiz, 'uploads', 'logos', '.htaccess'), 'utf8');
      verificar('uploads/logos/.htaccess: desliga a execução e só serve png/jpg/webp',
        /php_flag engine off/.test(ht) && /RemoveHandler/.test(ht)
        && /\(png\|jpe\?g\|webp\)/.test(ht) && /Options -ExecCGI/.test(ht));

      const lg = await testarEndpointLogo(raiz);
      if (lg.semApache) {
        console.log('  (comportamento saltado: sem Apache não há PHP a servir)');
      } else {
      const recusa = (x, estados) => x && estados.indexOf(x.estado) !== -1
        && x.json && x.json.ok === false;

      verificar('medição válida: há sessão de painel',
        lg.entrou === true, JSON.stringify(lg.entrou));
      verificar('sem o cabeçalho X-JSC-Painel: recusado',
        recusa(lg.semCabecalho, [400]), lg.semCabecalho.estado + ' ' + lg.semCabecalho.texto.slice(0, 80));
      verificar('sem sessão: recusado com 401',
        recusa(lg.semSessao, [401]), lg.semSessao.estado + ' ' + lg.semSessao.texto.slice(0, 80));
      verificar('GET em vez de POST: recusado com 405',
        recusa(lg.metodoGet, [405]), lg.metodoGet.estado + ' ' + lg.metodoGet.texto.slice(0, 80));
      verificar('sem nome de equipa, ou nome sem letras: recusado',
        recusa(lg.semEquipa, [400]) && recusa(lg.equipaSoSimbolos, [400]),
        lg.semEquipa.estado + '/' + lg.equipaSoSimbolos.estado);
      verificar('sem ficheiro, ou no campo errado: recusado',
        recusa(lg.semFicheiro, [400]) && recusa(lg.campoErrado, [400]),
        lg.semFicheiro.estado + '/' + lg.campoErrado.estado);
      verificar('extensão .svg e .php: recusadas com 415',
        recusa(lg.extensaoMa, [415]) && recusa(lg.extensaoPhp, [415]),
        lg.extensaoMa.estado + '/' + lg.extensaoPhp.estado);
      verificar('um JPEG com extensão .png: recusado, o tipo real não bate',
        recusa(lg.tipoTrocado, [415]), lg.tipoTrocado.estado + ' ' + lg.tipoTrocado.texto.slice(0, 100));
      verificar('PHP disfarçado de .png: recusado, não é imagem',
        recusa(lg.naoEImagem, [415]), lg.naoEImagem.estado + ' ' + lg.naoEImagem.texto.slice(0, 100));
      verificar('ficheiro vazio: recusado',
        recusa(lg.vazio, [400]), lg.vazio.estado + ' ' + lg.vazio.texto.slice(0, 80));
      verificar('8x8 e 1200 de lado: recusados por dimensões',
        recusa(lg.pequeno, [422]) && recusa(lg.grande, [422]),
        lg.pequeno.estado + '/' + lg.grande.estado);
      verificar('nome de equipa com travessia de caminho: fica um slug inofensivo',
        lg.travessia.json && lg.travessia.json.ok === true
        && lg.travessia.json.slug === 'etc-passwd'
        && lg.travessia.json.caminho === 'uploads/logos/etc-passwd.png',
        JSON.stringify(lg.travessia.json && lg.travessia.json.caminho));
      verificar('nome de ficheiro com ../ e .php: ignorado por completo',
        lg.nomeMalicioso.json && lg.nomeMalicioso.json.ok === false,
        lg.nomeMalicioso.estado + ' ' + lg.nomeMalicioso.texto.slice(0, 80));
      verificar('nenhuma das recusas deixou ficheiros na pasta',
        JSON.stringify(lg.depoisDasRecusas) === JSON.stringify(['etc-passwd.png']),
        JSON.stringify(lg.depoisDasRecusas));

      verificar('um PNG válido é aceite e grava-se com o slug da equipa',
        lg.bom.json && lg.bom.json.ok === true
        && lg.bom.json.caminho === 'uploads/logos/ferreiras.png'
        && lg.bom.json.chave === 'ferreiras'
        && lg.bom.json.largura === 64 && lg.bom.json.altura === 64,
        JSON.stringify(lg.bom.json));
      verificar('o ficheiro no disco é um PNG a sério, com os bytes enviados',
        lg.ferreirasPng === true && lg.ferreirasBytes > 0,
        'png: ' + lg.ferreirasPng + ' bytes: ' + lg.ferreirasBytes);
      verificar('acentos no nome da equipa dão um slug sem acentos',
        lg.acentos.json && lg.acentos.json.slug === 'associacao-desportiva-sao-bras',
        JSON.stringify(lg.acentos.json && lg.acentos.json.slug));
      verificar('um JPEG com .jpg é aceite e grava-se como .jpg',
        lg.jpegReal.json && lg.jpegReal.json.ok === true
        && lg.jpegReal.json.caminho === 'uploads/logos/quarteira.jpg',
        JSON.stringify(lg.jpegReal.json && lg.jpegReal.json.caminho));
      verificar('voltar a carregar a mesma equipa substitui o ficheiro, sem duplicar',
        lg.substituir.json && lg.substituir.json.ok === true
        && lg.substituir.json.caminho === 'uploads/logos/ferreiras.png'
        && lg.noFim.filter((f) => f.indexOf('ferreiras') === 0).length === 1,
        JSON.stringify(lg.noFim));
      verificar('a chave devolvida é o nome em minúsculas, para o db_logos',
        lg.acentos.json && lg.acentos.json.chave === 'associa\u00e7\u00e3o desportiva s\u00e3o br\u00e1s',
        JSON.stringify(lg.acentos.json && lg.acentos.json.chave));

      verificar('a pasta serve o PNG gravado',
        lg.servePng.estado === 200 && /image\/png/.test(lg.servePng.tipo),
        lg.servePng.estado + ' ' + lg.servePng.tipo);
      // A garantia a sério é esta, e não o .htaccess: o endpoint gera o nome, e
      // o nome gerado nunca pode ser executável. Seis tentativas de o forjar
      // pelas duas vias — nome da equipa e nome do ficheiro.
      verificar('nenhum nome forjado produz um ficheiro executável',
        lg.forjados.every((x) => !x.ok
          || /^uploads\/logos\/[a-z0-9-]+\.(png|jpg|webp)$/.test(x.caminho)),
        JSON.stringify(lg.forjados.map((x) => x.equipa + ' + ' + x.nome + ' -> '
          + (x.ok ? x.caminho : 'recusado ' + x.estado))));
      verificar('e nada com extensão executável aparece na pasta',
        lg.depoisDosForjados.every((f) => /\.(png|jpg|webp)$/.test(f)),
        JSON.stringify(lg.depoisDosForjados));
      // O .htaccess continua lá e serve nos alojamentos com mod_php, mas
      // NESTE a execução é encaminhada por ProxyPassMatch antes de o
      // .htaccess ser lido: medido idêntico com e sem ficheiro nenhum. Não se
      // afirma aqui uma garantia que o alojamento não dá — registra-se o que
      // ele faz, para a decisão ser tomada com o facto à vista.
      console.log('      (medição, sem garantia: um .php colocado nesta pasta por outra via '
        + 'responde ' + lg.phpNaPasta.estado + ' '
        + (lg.phpNaPasta.corpo.indexOf('EXECUTOU') !== -1 ? 'E EXECUTA' : 'e nao executa')
        + ' — com PHP ligado por proxy o .htaccess não o impede)');
      verificar('a pasta não lista o seu conteúdo',
        lg.listagem.estado !== 200 || lg.listagem.corpo.indexOf('ferreiras') === -1,
        lg.listagem.estado + ' ' + lg.listagem.corpo.slice(0, 60));
      verificar('o próprio .htaccess não é servido',
        lg.htaccess.estado !== 200, String(lg.htaccess.estado));

      // Colisão de slug: o caso Louletano B vs Louletano-B.
      verificar('Louletano B grava, e Louletano-B dá 409 com o detalhe do conflito',
        lg.louletanoB.json && lg.louletanoB.json.ok === true
        && lg.louletanoB.json.slug === 'louletano-b'
        && lg.louletanoHifen.estado === 409
        && lg.louletanoHifen.json && lg.louletanoHifen.json.codigo === 'conflito'
        && (lg.louletanoHifen.json.conflito || {}).dono === 'louletano b'
        && (lg.louletanoHifen.json.conflito || {}).pedido === 'louletano-b',
        lg.louletanoHifen.estado + ' ' + JSON.stringify(lg.louletanoHifen.json));
      verificar('e o ficheiro do primeiro fica byte a byte intacto',
        lg.colisaoIntacto === true, 'intacto: ' + lg.colisaoIntacto);
      verificar('o mesmo dono continua a poder substituir o seu escudo',
        lg.mesmoDono.json && lg.mesmoDono.json.ok === true
        && lg.mesmoDono.json.caminho === 'uploads/logos/louletano-b.png',
        JSON.stringify(lg.mesmoDono.json && lg.mesmoDono.json.caminho));
      verificar('o registo de donos não é servido pela web',
        lg.registoServido.estado !== 200,
        lg.registoServido.estado + ' ' + lg.registoServido.corpo);

      // Transferência de propriedade.
      verificar('transferir com o dono errado: 409 e o registo não muda',
        lg.trDonoErrado.estado === 409
        && (lg.trDonoErrado.json || {}).codigo === 'conflito'
        && lg.donoAposErrado === 'louletano b',
        lg.trDonoErrado.estado + ' dono: ' + lg.donoAposErrado);
      verificar('transferir com caminho forjado: 409 nos três casos, registo intacto',
        lg.trForjado.estado === 409 && lg.trForjado2.estado === 409
        && lg.trForjado3.estado === 409 && lg.donoAposForjado === 'louletano b',
        [lg.trForjado.estado, lg.trForjado2.estado, lg.trForjado3.estado].join('/')
        + ' dono: ' + lg.donoAposForjado);
      verificar('transferência legítima: o dono do slug passa para o nome novo',
        (lg.trBoa.json || {}).ok === true
        && (lg.trBoa.json || {}).de === 'louletano b'
        && (lg.trBoa.json || {}).para === 'louletano reserva'
        && lg.donoApos === 'louletano reserva',
        JSON.stringify(lg.trBoa.json) + ' dono: ' + lg.donoApos);
      verificar('e depois dela o upload do clube renomeado funciona, sem 409',
        (lg.uploadAposTr.json || {}).ok === true
        && (lg.uploadAposTr.json || {}).caminho === 'uploads/logos/louletano-reserva.png',
        lg.uploadAposTr.estado + ' ' + JSON.stringify((lg.uploadAposTr.json || {}).caminho));
      verificar('o dono antigo já não pode substituir o ficheiro transferido',
        lg.antigoJaNao.estado === 409
        && (lg.antigoJaNao.json || {}).codigo === 'conflito',
        lg.antigoJaNao.estado + ' ' + JSON.stringify((lg.antigoJaNao.json || {}).error));

      // Concorrência.
      verificar('oito uploads em paralelo: todos aceites',
        lg.paralelos.every((x) => (x.json || {}).ok === true),
        JSON.stringify(lg.paralelos.map((x) => x.estado)));
      verificar('e o registo de donos fica válido com os oito donos',
        lg.registoFinal.valido === true && lg.registoFinal.presentes === 8,
        JSON.stringify(lg.registoFinal));
      verificar('logo.php: a leitura-modificação-escrita do registo usa flock',
        /flock\(\$fh, LOCK_EX\)/.test(fonteLogo) && /flock\(\$fh, LOCK_UN\)/.test(fonteLogo)
        && /fopen\(\$registo, 'c\+'\)/.test(fonteLogo),
        'flock: ' + /flock/.test(fonteLogo));
      const logoSemComent = fonteLogo.replace(/^\s*\/\/.*$/gm, '');
      verificar('logo.php: o move_uploaded_file acontece dentro do bloqueio',
        (function () {
          const abre  = logoSemComent.indexOf('jsc_logo_com_registo($registo, function ($donos) use (');
          const move  = logoSemComent.indexOf("@move_uploaded_file($f['tmp_name']");
          const grava = logoSemComent.indexOf('$donos[$slug] = $dono;');
          return abre !== -1 && move > abre && grava > move;
        })(),
        'abre/move/grava: '
        + logoSemComent.indexOf('jsc_logo_com_registo($registo, function ($donos) use (') + '/'
        + logoSemComent.indexOf("@move_uploaded_file($f['tmp_name']") + '/'
        + logoSemComent.indexOf('$donos[$slug] = $dono;'));
      verificar('logo.php: o caminho da transferência é confrontado com um padrão fixo',
        /\^uploads\/logos\/\(\[a-z0-9-\]\+\)\\\.\(png\|jpg\|webp\)\$/.test(fonteLogo));
      }
    }

    // ---- Repor do servidor ------------------------------------------
    console.log('\nrepor do servidor: lê, compara, pede, e só depois escreve');
    {
      const fonteAdmRep = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8');
      const corpo = fonteAdmRep.slice(
        fonteAdmRep.indexOf('async function reporDoServidor()'),
        fonteAdmRep.indexOf('window.reporDoServidor = reporDoServidor;'));
      verificar('medição válida: o corpo do reporDoServidor foi encontrado na fonte',
        corpo.length > 500, corpo.length + ' caracteres');
      verificar('reporDoServidor: lê do /api/load.php, e só de lá',
        /fetch\('\.\.\/api\/load\.php', \{ cache: 'no-store' \}\)/.test(corpo)
        && corpo.indexOf('save.php') === -1
        && corpo.indexOf('publicarNoServidor') === -1
        && corpo.indexOf("method: 'POST'") === -1,
        'load: ' + /load\.php/.test(corpo) + ' save: ' + (corpo.indexOf('save.php') !== -1)
        + ' publicar: ' + (corpo.indexOf('publicarNoServidor') !== -1));
      verificar('reporDoServidor: o backup é escrito antes das áreas, e falhar aborta',
        corpo.indexOf("localStorage.setItem(marca") < corpo.indexOf('localStorage.setItem(x.chave'),
        'backup em ' + corpo.indexOf("localStorage.setItem(marca")
        + ', áreas em ' + corpo.indexOf('localStorage.setItem(x.chave'));
      const mapa = fonteAdmRep.slice(fonteAdmRep.indexOf('const JSC_REPOR_AREAS'),
        fonteAdmRep.indexOf('const JSC_REPOR_NAO_TOCAR'));
      // O mapa tem de existir para a ausência significar algo: sem a primeira
      // condição, um slice vazio passava esta asserção por vazio.
      verificar('o mapa das áreas não inclui emailConfig, classData nem publicadoEm',
        /jsc_noticias/.test(mapa) && /fpf_sync_config/.test(mapa)
        && mapa.indexOf('emailConfig') === -1 && mapa.indexOf('classData') === -1
        && mapa.indexOf('publicadoEm') === -1 && mapa.indexOf('email_config') === -1,
        'mapa com ' + mapa.length + ' caracteres');

      // O servidor de mentira: traz de propósito as três áreas que não se repõem.
      const SERVIDOR = {
        publicadoEm: '2026-10-15T09:00:00Z',
        jogos:    [{ id: 1, casa: 'Equipa Um', fora: 'Equipa Dois' }, { id: 2, casa: 'Equipa Tres', fora: 'Equipa Quatro' }],
        noticias: [{ id: 9, titulo: 'Publicada do servidor', resumo: 'texto', publicada: true, data: '2026-10-01' }],
        escaloes: [{ id: 1, nome: 'Escalao Um' }],
        dadosClube: { nome: 'Clube do servidor' },
        emailConfig: { mode: 'emailjs', publicKey: 'xxx' },
        classData: { 'fpf_class_Sub-17': [{ equipa: 'Equipa Um', pts: 3 }] },
      };
      const JOGOS_LOCAIS = JSON.stringify([{ id: 99, casa: 'Rascunho', fora: 'Local' }]);
      const INTOCAVEIS = {
        email_config:      JSON.stringify({ mode: 'smtp', segredo: 'fica-aqui' }),
        'fpf_class_Sub-17': JSON.stringify([{ equipa: 'Colada', pts: 9 }]),
        'fpf_jogos_Sub-17': JSON.stringify([{ casa: 'Colado', fora: 'Tambem' }]),
        jsc_publicado_em:  '2020-01-01T00:00:00Z',
        uma_chave_minha:   'nada-a-ver-com-o-site',
      };

      const rp = await testarReporDoServidor(browser, srv.url, [
        { nome: 'vazio',      servidor: SERVIDOR, semente: { ...INTOCAVEIS } },
        { nome: 'parcial',    servidor: SERVIDOR,
          semente: { ...INTOCAVEIS, db_escaloes: JSON.stringify(SERVIDOR.escaloes) } },
        { nome: 'difere-mantem',    servidor: SERVIDOR, palavra: 'substituir',
          semente: { ...INTOCAVEIS, db_jogos: JOGOS_LOCAIS } },
        { nome: 'difere-substitui', servidor: SERVIDOR, palavra: 'SUBSTITUIR',
          semente: { ...INTOCAVEIS, db_jogos: JOGOS_LOCAIS } },
        { nome: 'cancelar',   servidor: SERVIDOR, cancelar: true, semente: { ...INTOCAVEIS } },
      ]);

      // O que é preciso provar não é que só há um pedido — o arranque do painel
      // faz o seu GET ao auth.php — mas que a reposição não escreve nada no
      // servidor: nenhum método de escrita, nenhum toque no save.php, e o
      // load.php pedido pelo menos uma vez.
      const semEscrita = (x) => x.pedidos.every((q) => /^GET /.test(q))
        && x.pedidos.every((q) => q.indexOf('save.php') === -1)
        && x.pedidos.some((q) => /load\.php$/.test(q));
      verificar('localStorage vazio: as 4 áreas mapeáveis do servidor são criadas',
        JSON.stringify(rp.vazio.criadas.sort())
          === JSON.stringify(['dados_clube', 'db_escaloes', 'db_jogos', 'jsc_noticias'].sort()),
        JSON.stringify(rp.vazio.criadas));
      verificar('localStorage vazio: nada é removido e nada existente é alterado',
        rp.vazio.removidas.length === 0 && rp.vazio.alteradas.length === 0,
        'removidas ' + JSON.stringify(rp.vazio.removidas) + ' alteradas ' + JSON.stringify(rp.vazio.alteradas));
      verificar('dados parciais: a área igual fica, as ausentes são criadas',
        rp.parcial.criadas.indexOf('db_escaloes') === -1
        && rp.parcial.criadas.indexOf('db_jogos') !== -1
        && rp.parcial.alteradas.length === 0,
        JSON.stringify(rp.parcial.criadas) + ' alteradas ' + JSON.stringify(rp.parcial.alteradas));
      verificar('dados diferentes + palavra errada: a chave local fica intacta',
        rp['difere-mantem'].depois.db_jogos === JOGOS_LOCAIS
        && rp['difere-mantem'].alteradas.length === 0,
        'db_jogos: ' + String(rp['difere-mantem'].depois.db_jogos).slice(0, 50));
      verificar('dados diferentes + SUBSTITUIR: a chave local é substituída',
        rp['difere-substitui'].depois.db_jogos === JSON.stringify(SERVIDOR.jogos)
        && JSON.stringify(rp['difere-substitui'].alteradas) === JSON.stringify(['db_jogos']),
        'db_jogos: ' + String(rp['difere-substitui'].depois.db_jogos).slice(0, 50));
      verificar('cancelar a comparação: nada escrito e nenhum backup criado',
        rp.cancelar.criadas.length === 0 && rp.cancelar.alteradas.length === 0
        && rp.cancelar.backup.length === 0,
        JSON.stringify(rp.cancelar.criadas) + ' backup ' + JSON.stringify(rp.cancelar.backup));
      verificar('o backup guarda o estado anterior das chaves tocadas',
        (function () {
          const b = JSON.parse(rp['difere-substitui'].conteudoBackup || '{}');
          return b.chaves && b.chaves.db_jogos === JOGOS_LOCAIS
            && b.chaves.jsc_noticias === null && typeof b.quando === 'string';
        })(),
        String(rp['difere-substitui'].conteudoBackup).slice(0, 160));
      verificar('email_config, fpf_class_*, fpf_jogos_* e jsc_publicado_em ficam intocados',
        Object.values(rp).every((x) => Object.keys(INTOCAVEIS)
          .every((k) => x.depois[k] === INTOCAVEIS[k])),
        JSON.stringify(Object.keys(rp).map((n) => n + ': '
          + Object.keys(INTOCAVEIS).filter((k) => rp[n].depois[k] !== INTOCAVEIS[k]).join(','))));
      verificar('uma chave que não pertence ao site é preservada',
        Object.values(rp).every((x) => x.depois.uma_chave_minha === 'nada-a-ver-com-o-site'));
      verificar('Publicar não é chamado: só GETs, nenhum ao save.php',
        Object.values(rp).every(semEscrita),
        JSON.stringify(Object.keys(rp).map((n) => n + ': ' + JSON.stringify(rp[n].pedidos))));
      // Sem diálogo nenhum isto tem de FALHAR, não rebentar: medido na
      // verificação negativa, onde a função não existe e o dialogos[0] é
      // undefined — a bateria morria com um TypeError a meio da secção.
      const primeiroDialogo = (x) => (x && x.dialogos && x.dialogos[0])
        || { tipo: '(nenhum diálogo)', texto: '' };
      verificar('a comparação é mostrada antes de qualquer escrita, com o aviso do que não volta',
        primeiroDialogo(rp.vazio).tipo === 'confirm'
        && /A CRIAR/.test(primeiroDialogo(rp.vazio).texto)
        && /rascunhos e notícias agendadas/.test(primeiroDialogo(rp.vazio).texto)
        && /Não publica nada/.test(primeiroDialogo(rp.vazio).texto),
        primeiroDialogo(rp.vazio).tipo + ': ' + primeiroDialogo(rp.vazio).texto.slice(0, 120));
      verificar('a substituição pede a palavra escrita, num prompt',
        rp['difere-substitui'].dialogos.some((d) => d.tipo === 'prompt'
          && /SUBSTITUIR/.test(d.texto) && /rascunhos/.test(d.texto)),
        JSON.stringify(rp['difere-substitui'].dialogos.map((d) => d.tipo)));
      verificar('no fim diz quantas áreas foram repostas',
        /\d+ área\(s\) reposta\(s\): \d+ criada\(s\), \d+ substituída\(s\)/
          .test(rp['difere-substitui'].dialogos.map((d) => d.texto).join(' ')),
        rp['difere-substitui'].dialogos.map((d) => d.texto.slice(0, 80)).join(' | '));
      verificar('painel: sem erros de JavaScript em nenhum dos cinco cenários',
        Object.values(rp).every((x) => x.erros.length === 0 && x.erro === null),
        Object.values(rp).map((x) => (x.erros.join(' ') + ' ' + (x.erro || ''))).join(' | '));

      // O servidor a sério: sem interceptar o load.php, e o data/db.json lido
      // do disco antes e depois.
      const fich = path.join(raiz, 'data', 'db.json');
      const bytesAntes = fs.existsSync(fich) ? fs.readFileSync(fich) : null;
      const real = await testarReporDoServidor(browser, srv.url, [
        { nome: 'servidor-real', servidor: null, semente: { ...INTOCAVEIS } },
      ]);
      const bytesDepois = fs.existsSync(fich) ? fs.readFileSync(fich) : null;
      verificar('contra o servidor a sério: o data/db.json fica byte a byte igual',
        bytesAntes !== null && bytesDepois !== null && bytesAntes.equals(bytesDepois),
        'antes ' + (bytesAntes ? bytesAntes.length : 'ausente')
        + ' bytes, depois ' + (bytesDepois ? bytesDepois.length : 'ausente'));
      verificar('contra o servidor a sério: nenhum pedido de escrita à api',
        semEscrita(real['servidor-real']),
        JSON.stringify(real['servidor-real'].pedidos));
      verificar('contra o servidor a sério: as chaves intocáveis continuam intocadas',
        Object.keys(INTOCAVEIS).every((k) => real['servidor-real'].depois[k] === INTOCAVEIS[k]),
        JSON.stringify(Object.keys(INTOCAVEIS)
          .filter((k) => real['servidor-real'].depois[k] !== INTOCAVEIS[k])));
    }

    // ---- A migração da db_noticias --------------------------------
    console.log('\na chave antiga das notícias só sai quando já há destino para ela');
    {
      const semComentDat = fs.readFileSync(path.join(raiz, 'admin', 'js', 'data.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('data.js: a remoção da db_noticias deixou de ser incondicional',
        !/^\s*try \{ localStorage\.removeItem\('db_noticias'\); \} catch\(_\) \{\}/m.test(semComentDat));
      verificar('data.js: só remove com uma jsc_noticias legível e com conteúdo',
        /Array\.isArray\(destino\) && destino\.length\) localStorage\.removeItem\('db_noticias'\)/.test(semComentDat));

      const ANTIGAS = JSON.stringify([
        { id: 11, titulo: 'Antiga uma', resumo: 'texto', publicada: true, data: '2025-05-01' },
        { id: 12, titulo: 'Antiga duas', resumo: 'texto', publicada: true, data: '2025-05-02' },
      ]);
      const NOVAS = JSON.stringify([
        { id: 21, titulo: 'Nova uma', resumo: 'texto', publicada: true, data: '2026-05-01' },
      ]);
      // Acompanhantes: provam que a migração não leva mais nada atrás.
      const VIZINHAS = {
        db_jogos:    JSON.stringify([{ id: 1, casa: 'Equipa Um', fora: 'Equipa Dois' }]),
        db_atletas:  JSON.stringify([{ id: 2, nome: 'Atleta Um' }]),
        db_logos:    JSON.stringify({ 'equipa um': '/img/um.png' }),
        site_config: JSON.stringify({ heroTitle: 'Titulo' }),
      };
      const mg = await testarMigracaoNoticias(browser, srv.url, [
        { nome: 'A-sem-destino',   semente: { db_noticias: ANTIGAS, ...VIZINHAS } },
        { nome: 'B-com-destino',   semente: { db_noticias: ANTIGAS, jsc_noticias: NOVAS, ...VIZINHAS } },
        { nome: 'C-destino-vazio', semente: { db_noticias: ANTIGAS, jsc_noticias: '[]', ...VIZINHAS } },
        { nome: 'D-destino-ilegivel', semente: { db_noticias: ANTIGAS, jsc_noticias: 'nao-e-json', ...VIZINHAS } },
      ]);

      verificar('CASO A — sem jsc_noticias: a db_noticias fica intacta, byte a byte',
        mg['A-sem-destino'].temAntiga === true
        && mg['A-sem-destino'].valorAntiga === ANTIGAS
        && mg['A-sem-destino'].removidas.length === 0,
        'removidas: ' + JSON.stringify(mg['A-sem-destino'].removidas)
        + ' db_noticias: ' + String(mg['A-sem-destino'].valorAntiga).slice(0, 40));
      verificar('CASO B — com jsc_noticias válida: a db_noticias é removida',
        mg['B-com-destino'].temAntiga === false
        && JSON.stringify(mg['B-com-destino'].removidas) === JSON.stringify(['db_noticias']),
        'removidas: ' + JSON.stringify(mg['B-com-destino'].removidas));
      verificar('jsc_noticias vazia não é destino: a db_noticias fica',
        mg['C-destino-vazio'].temAntiga === true
        && mg['C-destino-vazio'].valorAntiga === ANTIGAS
        && mg['C-destino-vazio'].removidas.length === 0,
        'removidas: ' + JSON.stringify(mg['C-destino-vazio'].removidas));
      verificar('jsc_noticias ilegível não é destino: a db_noticias fica',
        mg['D-destino-ilegivel'].temAntiga === true
        && mg['D-destino-ilegivel'].valorAntiga === ANTIGAS
        && mg['D-destino-ilegivel'].removidas.length === 0,
        'removidas: ' + JSON.stringify(mg['D-destino-ilegivel'].removidas));
      verificar('nenhum outro db_* é removido em nenhum dos quatro cenários',
        Object.values(mg).every((x) => x.removidas.every((k) => k === 'db_noticias')),
        JSON.stringify(Object.keys(mg).map((n) => n + ': ' + JSON.stringify(mg[n].removidas))));
      verificar('as chaves vizinhas ficam byte a byte iguais',
        Object.values(mg).every((x) => x.alteradas.length === 0),
        JSON.stringify(Object.keys(mg).map((n) => n + ': ' + JSON.stringify(mg[n].alteradas))));
      verificar('a única escrita no arranque é a marca jsc_painel_local',
        Object.values(mg).every((x) =>
          JSON.stringify(x.acrescentadas) === JSON.stringify(['jsc_painel_local'])),
        JSON.stringify(Object.keys(mg).map((n) => n + ': ' + JSON.stringify(mg[n].acrescentadas))));
      verificar('painel: sem erros de JavaScript nos quatro cenários',
        Object.values(mg).every((x) => x.erros.length === 0),
        Object.values(mg).map((x) => x.erros.join(' ')).join(' | '));
    }

    // ---- A chave das notícias não nasce vazia ----------------------
    console.log('\nabrir o painel com o armazém vazio não inventa uma lista de notícias');
    {
      const semComentNot = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: o initAdmin já não grava a chave das notícias',
        !/if \(!localStorage\.getItem\(NEWS_KEY\)\) saveNoticias\(\[\]\);/.test(semComentNot));
      verificar('admin.js: o loadNoticias continua a devolver [] sem a chave',
        /JSON\.parse\(localStorage\.getItem\(NEWS_KEY\) \|\| '\[\]'\)/.test(semComentNot));

      const SEMEADAS = [
        { id: 951, titulo: 'Primeira guardada', resumo: 'texto', publicada: true, data: '2026-03-01' },
        { id: 952, titulo: 'Segunda guardada', resumo: 'texto', publicada: false, data: '2026-03-02' },
      ];
      const nk = await testarNoticiasSemChave(browser, srv.url, [
        { nome: 'sem-chave', semear: null },
        { nome: 'com-chave', semear: SEMEADAS },
      ]);

      verificar('armazém vazio: o initAdmin não cria a jsc_noticias',
        nk['sem-chave'].antes.presente === false
        && nk['sem-chave'].depois.presente === false
        && nk['sem-chave'].depois.nChaves === 0,
        JSON.stringify(nk['sem-chave'].depois));
      verificar('armazém vazio: e continua sem a chave depois do arranque assíncrono',
        nk['sem-chave'].depoisDeEsperar.presente === false,
        JSON.stringify(nk['sem-chave'].depoisDeEsperar));
      verificar('armazém vazio: o painel trabalha com [] em memória e desenha o vazio',
        nk['sem-chave'].lidas === 0 && nk['sem-chave'].nCartoes === 1
        && /Nova Notícia/.test(nk['sem-chave'].cartoes[0] || ''),
        nk['sem-chave'].lidas + ' lida(s), ' + JSON.stringify(nk['sem-chave'].cartoes));
      verificar('chave existente: é lida normalmente, com as duas notícias',
        nk['com-chave'].lidas === 2 && nk['com-chave'].nCartoes === 3
        && nk['com-chave'].cartoes.join(' ').indexOf('Primeira guardada') !== -1
        && nk['com-chave'].cartoes.join(' ').indexOf('Segunda guardada') !== -1,
        nk['com-chave'].lidas + ' lida(s), ' + JSON.stringify(nk['com-chave'].cartoes));
      verificar('chave existente: fica byte a byte igual ao que lá estava',
        nk['com-chave'].depois.valor === nk['com-chave'].antes.valor
        && nk['com-chave'].depoisDeEsperar.valor === nk['com-chave'].antes.valor,
        'antes ' + String(nk['com-chave'].antes.valor).length + ' bytes, depois '
        + String(nk['com-chave'].depois.valor).length);
      verificar('painel: sem erros de JavaScript nos dois cenários',
        Object.values(nk).every((x) => x.erros.length === 0),
        Object.values(nk).map((x) => x.erros.join(' ')).join(' | '));
    }

    // ---- Publicar vazio por cima do que o site tem ------------------
    console.log('\nnenhuma publicação substitui conteúdo por nada sem o dizer');
    {
      const semComentAdmV = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      const fonteSave = fs.readFileSync(path.join(raiz, 'api', 'save.php'), 'utf8');

      verificar('admin.js: as áreas do armazém só entram no pedido quando existem',
        /if \(v !== null && v !== undefined\) dados\[campo\] = v;/.test(semComentAdmV));
      verificar('admin.js: a confirmação é uma palavra escrita, não um confirm()',
        /resposta\.trim\(\) === JSC_PALAVRA_APAGAR/.test(semComentAdmV)
        && /const JSC_PALAVRA_APAGAR = 'APAGAR';/.test(semComentAdmV));
      verificar('admin.js: o 409 de esvaziamento é tratado e reenviado com a confirmação',
        /resp\.status === 409 && json && json\.codigo === 'esvaziamento'/.test(semComentAdmV)
        && /confirmarEsvaziar: confirmacao/.test(semComentAdmV));
      verificar('save.php: a confirmação sai do payload antes de ser gravada',
        /unset\(\$novos\['confirmarEsvaziar'\]\);/.test(fonteSave));
      verificar('save.php: a guarda compara área a área com o que está gravado',
        /\$dado !== \$esperado/.test(fonteSave)
        && /'codigo'\s*=>\s*'esvaziamento'/.test(fonteSave));

      // O painel: quantos pedidos saem, e o que levam.
      const CONTEUDO = {
        noticias: [{ id: 901, titulo: 'Uma', resumo: 'texto', publicada: true, data: '2026-01-01' }],
        jogos: [{ id: 801, escalao: 'Sub-17', data: '2026-01-10', casa: 'Equipa Um', fora: 'Equipa Dois', estado: 'Agendado' }],
        atletas: [{ id: 601, nome: 'Atleta Um', escalao: 'Sub-17' }],
        escaloes: [{ id: 501, nome: 'Escalao Um', designacao: 'Um' }],
        treinadores: [{ id: 401, nome: 'Treinador Um' }],
        modalidades: [{ id: 301, nome: 'Modalidade Uma' }],
        patrocinadores: [{ id: 701, nome: 'Apoio Um' }],
        galeria: [{ id: 201, titulo: 'Foto Uma' }],
        videos: [{ id: 101, titulo: 'Video Um' }],
        agenda: [{ id: 111, titulo: 'Evento Um', data: '2026-02-01' }],
      };
      const pv = await testarPublicarVazio(browser, srv.url, [
        { nome: 'normal',            comDados: true,  servidorRecusa: false, palavra: 'APAGAR', ...CONTEUDO },
        { nome: 'recusa-confirmada', comDados: true,  servidorRecusa: true,  palavra: 'APAGAR', ...CONTEUDO },
        { nome: 'recusa-palavra-ma', comDados: true,  servidorRecusa: true,  palavra: 'apagar', ...CONTEUDO },
        { nome: 'recusa-cancelada',  comDados: true,  servidorRecusa: true,  palavra: null,     ...CONTEUDO },
        { nome: 'painel-vazio',      comDados: false, servidorRecusa: true,  palavra: 'nao',    ...CONTEUDO },
      ]);

      verificar('painel com dados: publica num pedido e sem perguntar nada',
        pv.normal.nPedidos === 1 && pv.normal.prompts.length === 0,
        pv.normal.nPedidos + ' pedido(s), ' + pv.normal.prompts.length + ' prompt(s)');
      verificar('painel: uma chave ausente no armazém não vai no pedido',
        pv.normal.temLogos === false && pv.normal.temNoticias === true,
        'logos: ' + pv.normal.temLogos + ' noticias: ' + pv.normal.temNoticias);
      verificar('servidor recusa + palavra certa: segundo pedido com a confirmação do servidor',
        pv['recusa-confirmada'].nPedidos === 2
        && pv['recusa-confirmada'].confirmacoes[0] === null
        && JSON.stringify(pv['recusa-confirmada'].confirmacoes[1])
           === JSON.stringify([{ area: 'jogos', antes: 7, depois: 0 }]),
        pv['recusa-confirmada'].nPedidos + ' pedido(s): '
        + JSON.stringify(pv['recusa-confirmada'].confirmacoes));
      verificar('servidor recusa: o aviso diz a área e as contagens',
        pv['recusa-confirmada'].prompts.length === 1
        && /jogos: 7 → 0/.test(pv['recusa-confirmada'].prompts[0].texto)
        && /APAGAR/.test(pv['recusa-confirmada'].prompts[0].texto),
        JSON.stringify(pv['recusa-confirmada'].prompts));
      verificar('palavra errada: fica no primeiro pedido e não reenvia',
        pv['recusa-palavra-ma'].nPedidos === 1 && pv['recusa-palavra-ma'].prompts.length === 1,
        pv['recusa-palavra-ma'].nPedidos + ' pedido(s)');
      verificar('cancelar o aviso: fica no primeiro pedido e não reenvia',
        pv['recusa-cancelada'].nPedidos === 1 && pv['recusa-cancelada'].prompts.length === 1,
        pv['recusa-cancelada'].nPedidos + ' pedido(s)');
      verificar('painel inteiro vazio: nem o primeiro pedido sai sem a palavra',
        pv['painel-vazio'].nPedidos === 0 && pv['painel-vazio'].prompts.length === 1
        && /áreas principais estão todas vazias/.test(pv['painel-vazio'].prompts[0].texto),
        pv['painel-vazio'].nPedidos + ' pedido(s): '
        + JSON.stringify(pv['painel-vazio'].prompts));
      verificar('painel: sem erros de JavaScript em nenhum dos cinco cenários',
        Object.values(pv).every((c) => c.erros.length === 0),
        Object.values(pv).map((c) => c.erros.join(' ')).join(' | '));

      // E o servidor a sério, em cópia e servidor próprios: este caminho publica.
      const es = await testarSaveEsvaziamento(raiz);
      if (es.semApache) {
        console.log('  (comportamento saltado: sem Apache não há PHP a servir)');
      } else {
      verificar('medição válida: há sessão e o conteúdo semeado ficou gravado',
        es.entrou === true && (es.semear.json || {}).ok === true
        && es.depoisDeSemear.jogos === 2 && es.depoisDeSemear.patrocinadores === 3,
        es.semear.estado + ' ' + JSON.stringify(es.depoisDeSemear));
      verificar('publicar vazio sem confirmar: 409 e o ficheiro intacto',
        es.semConfirmar.estado === 409
        && (es.semConfirmar.json || {}).codigo === 'esvaziamento'
        && es.depoisDeRecusar.jogos === 2 && es.depoisDeRecusar.patrocinadores === 3,
        es.semConfirmar.estado + ' ' + JSON.stringify(es.depoisDeRecusar));
      verificar('o 409 nomeia as duas áreas e as contagens reais',
        JSON.stringify(((es.semConfirmar.json || {}).esvaziamentos || []).slice().sort(
          (a, b) => a.area.localeCompare(b.area)))
          === JSON.stringify([{ area: 'jogos', antes: 2, depois: 0 },
                              { area: 'patrocinadores', antes: 3, depois: 0 }]),
        JSON.stringify((es.semConfirmar.json || {}).esvaziamentos));
      verificar('confirmação com contagem errada, área a menos ou área trocada: recusadas',
        es.contagemErrada.estado === 409 && es.areaAMenos.estado === 409
        && es.areaTrocada.estado === 409
        && es.depoisDasErradas.jogos === 2 && es.depoisDasErradas.patrocinadores === 3,
        [es.contagemErrada.estado, es.areaAMenos.estado, es.areaTrocada.estado].join('/')
        + ' ' + JSON.stringify(es.depoisDasErradas));
      verificar('com a confirmação exacta do servidor: publica e esvazia as duas áreas',
        (es.confirmada.json || {}).ok === true
        && es.depoisDeConfirmar.jogos === 0 && es.depoisDeConfirmar.patrocinadores === 0,
        es.confirmada.estado + ' ' + JSON.stringify(es.depoisDeConfirmar));
      verificar('a confirmação nunca fica gravada dentro do data/db.json',
        es.depoisDeSemear.temConfirmacao === false
        && es.depoisDeConfirmar.temConfirmacao === false
        && es.depoisDeOmitir.temConfirmacao === false,
        JSON.stringify([es.depoisDeSemear.temConfirmacao,
          es.depoisDeConfirmar.temConfirmacao, es.depoisDeOmitir.temConfirmacao]));
      verificar('controlo: escrever conteúdo novo passa sem pergunta nenhuma',
        (es.normal.json || {}).ok === true && es.depoisDoNormal.jogos === 2,
        es.normal.estado + ' ' + JSON.stringify(es.depoisDoNormal));
      verificar('controlo: omitir uma área continua a querer dizer inalterada',
        (es.omitindo.json || {}).ok === true && es.depoisDeOmitir.jogos === 2,
        es.omitindo.estado + ' ' + JSON.stringify(es.depoisDeOmitir));
      }
    }

    console.log('\na coluna Forma na classificação pública');
    {
      const semComentRes = fs.readFileSync(path.join(raiz, 'js', 'resultados.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('resultados.js: o formaHTML tolera uma forma ausente',
        /return String\(forma \|\| ''\)\.split\(''\)/.test(semComentRes));

      const COM = [
        { equipa: 'J.S. Campinense', abrev: 'JC', j: 10, v: 7, e: 2, d: 1, gm: 25, gs: 8, dg: 17, pts: 23, forma: 'VVVVV', sc: true },
        { equipa: 'TESTE LOULETANO', abrev: 'TL', j: 10, v: 6, e: 2, d: 2, gm: 20, gs: 12, dg: 8, pts: 20, forma: 'VVEDV', sc: false },
        { equipa: 'TESTE QUARTEIRENSE', abrev: 'TQ', j: 10, v: 3, e: 2, d: 5, gm: 12, gs: 18, dg: -6, pts: 11, forma: 'DDEVD', sc: false },
      ];
      const SEM = [COM[0], (() => { const c = { ...COM[1] }; delete c.forma; return c; })(), COM[2]];

      const com = await testarColunaForma(browser, srv.url, COM);
      const umDe = (r, equipa) => r.linhas.find((l) => l.equipa === equipa) || {};
      verificar('com forma: cada equipa mostra os seus cinco círculos',
        com.linhas.length === 3
        && umDe(com, 'J.S. Campinense').letras === 'VVVVV'
        && umDe(com, 'TESTE LOULETANO').letras === 'VVEDV'
        && umDe(com, 'TESTE QUARTEIRENSE').letras === 'DDEVD',
        JSON.stringify(com.linhas.map((l) => l.equipa + '=' + l.letras)));
      verificar('e cada círculo tem a classe do resultado e altura visível',
        JSON.stringify(umDe(com, 'TESTE LOULETANO').classes)
          === JSON.stringify(['forma-dot--v', 'forma-dot--v', 'forma-dot--e', 'forma-dot--d', 'forma-dot--v'])
        && umDe(com, 'TESTE LOULETANO').altura > 0,
        JSON.stringify(umDe(com, 'TESTE LOULETANO')));

      const sem = await testarColunaForma(browser, srv.url, SEM);
      verificar('uma linha sem a chave forma não impede a tabela de ser desenhada',
        sem.linhas.length === 3, 'linhas: ' + sem.linhas.length);
      verificar('a linha sem forma fica com a célula vazia e as outras intactas',
        umDe(sem, 'TESTE LOULETANO').pontos === 0
        && umDe(sem, 'J.S. Campinense').letras === 'VVVVV'
        && umDe(sem, 'TESTE QUARTEIRENSE').letras === 'DDEVD',
        JSON.stringify(sem.linhas.map((l) => l.equipa + '=' + l.pontos)));
      verificar('classificação pública: sem exceções de JavaScript',
        com.erros.length === 0 && sem.erros.length === 0,
        com.erros.concat(sem.erros).join(' | '));
    }

    // ---- A colagem da classificação: pts1fase e forma ---------------
    console.log('\na colagem da classificação não apaga o pts1fase nem a forma');
    {
      const fonteAdm3 = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: o input da 1ª fase é identificado pelo nome da equipa',
        /data-pts1fase="\$\{jscEsc\(r\.equipa\)\}"/.test(fonteAdm3)
        && !/data-pts1fase="\$\{i\}"/.test(fonteAdm3));
      verificar('admin.js: o valor do formulário é aplicado por nome, não por posição',
        /chaveEquipa\(r\.equipa\) === nome/.test(fonteAdm3)
        && !/rows\[idx\]\.pts1fase = val/.test(fonteAdm3));
      verificar('admin.js: a herança é por nome em minúsculas e consome a linha antiga',
        /const chaveEquipa = \(n\) => \(n \|\| ''\)\.toLowerCase\(\);/.test(fonteAdm3)
        && /const antiga = fila && fila\.length \? fila\.shift\(\) : null;/.test(fonteAdm3));
      verificar('admin.js: herdam-se só o pts1fase e a forma',
        /if \(r\.pts1fase == null && antiga\.pts1fase != null\) r\.pts1fase = antiga\.pts1fase;/.test(fonteAdm3)
        && /if \(!r\.forma && antiga\.forma\) r\.forma = antiga\.forma;/.test(fonteAdm3)
        && !/antiga\.(pts|dg|j|v|e|d|gm|gs|logo)\b/.test(fonteAdm3));

      // A classificação já guardada: pts1fase da caixa da 1ª fase e forma do
      // editor manual, que é o único sítio que a escreve com conteúdo.
      const GUARDADAS = [
        { equipa: 'TESTE LOULETANO',    abrev: 'TL', j: 10, v: 6, e: 2, d: 2, gm: 20, gs: 12, dg: 8,  pts: 26, pts1fase: 6, forma: 'VVEVD', sc: false },
        { equipa: 'TESTE QUARTEIRENSE', abrev: 'TQ', j: 10, v: 3, e: 2, d: 5, gm: 12, gs: 18, dg: -6, pts: 14, pts1fase: 3, forma: 'DDEVD', sc: false },
        { equipa: 'J.S. Campinense',    abrev: 'JC', j: 10, v: 7, e: 2, d: 1, gm: 25, gs: 8,  dg: 17, pts: 32, pts1fase: 9, forma: 'VVVVV', sc: true },
      ];
      // Linhas sem a coluna da posição, para não entrar no achado lateral do
      // "Pts primeiro" do parser, que fica para diagnóstico separado.
      const ln = (nome, j, v, e, d, gm, gs, pts) => [nome, j, v, e, d, gm, gs, gm - gs, pts].join('\t');
      const TL   = ln('TESTE LOULETANO', 10, 6, 2, 2, 20, 12, 20);
      const TQ   = ln('TESTE QUARTEIRENSE', 10, 3, 2, 5, 12, 18, 11);
      const SC   = ln('J.S. Campinense', 10, 7, 2, 1, 25, 8, 23);
      const SC2  = ln('JS Campinense', 10, 7, 2, 1, 25, 8, 23);
      const NOVA = ln('TESTE NOVA EQUIPA', 10, 2, 1, 7, 8, 22, 7);
      const TL2  = ln('TESTE LOULETANO', 9, 4, 1, 4, 14, 15, 13);
      const txt = (...l) => l.join('\n') + '\n';

      const cp = await testarColagemPreserva(browser, srv.url, [
        { nome: 'mesma-ordem',  guardadas: GUARDADAS, texto: txt(TL, TQ, SC) },
        { nome: 'ordem-invertida', guardadas: GUARDADAS, texto: txt(SC, TQ, TL) },
        { nome: 'equipa-nova',  guardadas: GUARDADAS, texto: txt(TL, TQ, SC, NOVA) },
        { nome: 'equipa-removida', guardadas: GUARDADAS, texto: txt(TL, SC) },
        { nome: 'grafia-alterada', guardadas: GUARDADAS, texto: txt(TL, TQ, SC2) },
        { nome: 'nomes-repetidos', guardadas: GUARDADAS, texto: txt(TL, TL2, SC) },
        { nome: 'texto-trocado-depois-da-previsao', guardadas: GUARDADAS, texto: txt(TL, TQ, SC),
          pts1: [6, 3, 9], textoAntesDeGuardar: txt(SC, TQ, TL) },
      ]);
      const de = (n, equipa) => cp[n].linhas.find((l) => l.equipa === equipa) || {};
      const resumo = (n) => JSON.stringify(cp[n].linhas.map(
        (l) => l.equipa + '=' + ('pts1fase' in l ? l.pts1fase : '(sem)') + '/' + (l.forma || '(vazia)')));

      verificar('medição válida: a pré-visualização identifica os inputs pelo nome',
        JSON.stringify(cp['mesma-ordem'].atributos)
          === JSON.stringify(['TESTE LOULETANO', 'TESTE QUARTEIRENSE', 'J.S. Campinense']),
        JSON.stringify(cp['mesma-ordem'].atributos));

      verificar('mesma classificação, mesma ordem: o pts1fase mantém-se em cada equipa',
        de('mesma-ordem', 'TESTE LOULETANO').pts1fase === 6
        && de('mesma-ordem', 'TESTE QUARTEIRENSE').pts1fase === 3
        && de('mesma-ordem', 'J.S. Campinense').pts1fase === 9, resumo('mesma-ordem'));
      verificar('mesma classificação, mesma ordem: a forma mantém-se em cada equipa',
        de('mesma-ordem', 'TESTE LOULETANO').forma === 'VVEVD'
        && de('mesma-ordem', 'TESTE QUARTEIRENSE').forma === 'DDEVD'
        && de('mesma-ordem', 'J.S. Campinense').forma === 'VVVVV', resumo('mesma-ordem'));
      verificar('e os números da colagem é que valem: pts, dg, j, v, e, d, gm, gs',
        JSON.stringify(de('mesma-ordem', 'TESTE LOULETANO')) ===
        JSON.stringify({ equipa: 'TESTE LOULETANO', abrev: 'TES', j: 10, v: 6, e: 2, d: 2,
          gm: 20, gs: 12, dg: 8, pts: 20, forma: 'VVEVD', pts1fase: 6 }),
        JSON.stringify(de('mesma-ordem', 'TESTE LOULETANO')));

      verificar('ordem invertida: nada muda de equipa',
        de('ordem-invertida', 'TESTE LOULETANO').pts1fase === 6
        && de('ordem-invertida', 'TESTE LOULETANO').forma === 'VVEVD'
        && de('ordem-invertida', 'J.S. Campinense').pts1fase === 9
        && de('ordem-invertida', 'J.S. Campinense').forma === 'VVVVV', resumo('ordem-invertida'));

      verificar('equipa nova: entra sem pts1fase e com a forma vazia',
        cp['equipa-nova'].linhas.length === 4
        && !('pts1fase' in de('equipa-nova', 'TESTE NOVA EQUIPA'))
        && de('equipa-nova', 'TESTE NOVA EQUIPA').forma === '', resumo('equipa-nova'));
      verificar('e as outras continuam com o que era delas',
        de('equipa-nova', 'TESTE QUARTEIRENSE').pts1fase === 3
        && de('equipa-nova', 'TESTE QUARTEIRENSE').forma === 'DDEVD', resumo('equipa-nova'));

      verificar('equipa removida: sai da tabela e as que ficam não herdam o que era dela',
        cp['equipa-removida'].linhas.length === 2
        && !cp['equipa-removida'].linhas.some((l) => l.equipa === 'TESTE QUARTEIRENSE')
        && de('equipa-removida', 'TESTE LOULETANO').pts1fase === 6
        && de('equipa-removida', 'J.S. Campinense').pts1fase === 9, resumo('equipa-removida'));

      verificar('grafia alterada: conta como equipa nova, sem correspondência aproximada',
        !('pts1fase' in de('grafia-alterada', 'JS Campinense'))
        && de('grafia-alterada', 'JS Campinense').forma === ''
        && !cp['grafia-alterada'].linhas.some((l) => l.equipa === 'J.S. Campinense'),
        resumo('grafia-alterada'));
      verificar('e as restantes não são afectadas pela mudança de grafia',
        de('grafia-alterada', 'TESTE LOULETANO').pts1fase === 6
        && de('grafia-alterada', 'TESTE QUARTEIRENSE').pts1fase === 3, resumo('grafia-alterada'));

      verificar('medição válida: duas linhas com o mesmo nome foram reconhecidas',
        cp['nomes-repetidos'].linhas.filter((l) => l.equipa === 'TESTE LOULETANO').length === 2,
        resumo('nomes-repetidos'));
      verificar('nomes repetidos: só a primeira herda — a linha antiga consome-se uma vez',
        (() => {
          const d = cp['nomes-repetidos'].linhas.filter((l) => l.equipa === 'TESTE LOULETANO');
          return d[0].pts1fase === 6 && d[0].forma === 'VVEVD'
            && !('pts1fase' in d[1]) && d[1].forma === '';
        })(), resumo('nomes-repetidos'));

      verificar('texto trocado entre Pré-visualizar e Guardar: os pontos ficam na equipa certa',
        de('texto-trocado-depois-da-previsao', 'TESTE LOULETANO').pts1fase === 6
        && de('texto-trocado-depois-da-previsao', 'TESTE QUARTEIRENSE').pts1fase === 3
        && de('texto-trocado-depois-da-previsao', 'J.S. Campinense').pts1fase === 9,
        'pré-visualizado ' + JSON.stringify(cp['texto-trocado-depois-da-previsao'].ordemPrevisao)
        + ' com [6,3,9] → ' + resumo('texto-trocado-depois-da-previsao'));

      verificar('painel: sem erros de JavaScript em nenhuma das colagens',
        Object.values(cp).every((c) => c.erros.length === 0),
        Object.values(cp).map((c) => c.erros.join(' ')).join(' | '));
    }

    // ---- O mapa de logótipos das equipas ----------------------------
    console.log('\no db_logos: um mapa vazio não apaga os logótipos de ninguém');
    {
      const semComent = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: a colagem só grava o db_logos quando traz algo de novo',
        /if \(novosLogos\) localStorage\.setItem\('db_logos'/.test(semComent('admin/js/admin.js')));
      verificar('sync.js: o db_logos só é substituído por um mapa com chaves',
        /if \(data\.logos && typeof data\.logos === 'object'\s*&& Object\.keys\(data\.logos\)\.length\) ls\('db_logos', data\.logos\);/
          .test(semComent('js/sync.js')));
      verificar('conteudo.php: a chave logos vazia não sai na projeção',
        /unset\(\$fora\['logos'\]\);/.test(fs.readFileSync(path.join(raiz, 'api/conteudo.php'), 'utf8')));

      const TL = 'https://exemplo.test/logos/tl.png';
      const TQ = 'https://exemplo.test/logos/tq.png';
      const NOVO_TL = 'https://exemplo.test/logos/tl-novo.png';
      // Tabela do ZeroZero, separada por tabulações. Uma versão sem imagens e
      // uma com os tokens [img:...] que o parser reconhece.
      const SEM_IMAGENS = '1\tTESTE LOULETANO\t10\t6\t2\t2\t20\t12\t8\t20\n'
                        + '2\tTESTE QUARTEIRENSE\t10\t3\t2\t5\t12\t18\t-6\t11\n';
      const COM_IMAGENS = '1\t[img:' + NOVO_TL + ']\tTESTE LOULETANO\t10\t6\t2\t2\t20\t12\t8\t20\n'
                        + '2\t[img:' + TQ + ']\tTESTE QUARTEIRENSE\t10\t3\t2\t5\t12\t18\t-6\t11\n';

      const col = await testarColagemLogos(browser, srv.url, [
        { nome: 'sem-imagens',  logosAntes: { 'teste louletano': TL }, texto: SEM_IMAGENS },
        { nome: 'com-imagens',  logosAntes: { 'teste louletano': TL }, texto: COM_IMAGENS },
        { nome: 'sem-imagens-e-sem-mapa', logosAntes: null, texto: SEM_IMAGENS },
      ]);

      verificar('medição válida: as duas colagens foram reconhecidas',
        col['sem-imagens'].reconhecidas === 2 && col['com-imagens'].reconhecidas === 2,
        JSON.stringify([col['sem-imagens'].reconhecidas, col['com-imagens'].reconhecidas]));
      verificar('db_logos existente + colagem sem imagens: o mapa fica como estava',
        col['sem-imagens'].depois === JSON.stringify({ 'teste louletano': TL }),
        'ficou: ' + col['sem-imagens'].depois);
      verificar('e sem mapa nenhum, uma colagem sem imagens não cria o "{}"',
        col['sem-imagens-e-sem-mapa'].depois === null,
        'ficou: ' + col['sem-imagens-e-sem-mapa'].depois);
      verificar('db_logos existente + colagem com logótipos: actualiza e acrescenta',
        JSON.parse(col['com-imagens'].depois || '{}')['teste louletano'] === NOVO_TL
        && JSON.parse(col['com-imagens'].depois || '{}')['teste quarteirense'] === TQ,
        'ficou: ' + col['com-imagens'].depois);
      verificar('e as linhas guardadas levam o logótipo da colagem',
        col['com-imagens'].logosNasLinhas.join(' | ').indexOf(NOVO_TL) !== -1,
        col['com-imagens'].logosNasLinhas.join(' | '));
      verificar('painel: sem erros de JavaScript nas colagens',
        Object.values(col).every((c) => c.erros.length === 0),
        Object.values(col).map((c) => c.erros.join(' ')).join(' | '));

      const pub = await testarPublicacaoLogos(raiz);
      verificar('publicação sem logos: a chave não aparece',
        pub.ausente.tem === false);
      verificar('publicação com logos vazio: a chave também não aparece',
        pub.vazio.tem === false, 'chaves: ' + JSON.stringify(pub.vazio.chaves));
      verificar('publicação com logos válidos: a chave aparece com as entradas',
        pub.comEntradas.tem === true
        && pub.comEntradas.corpo.logos['teste louletano'] === TL,
        JSON.stringify(pub.comEntradas.corpo.logos));
      verificar('a publicação normal continua a sair inteira',
        pub.vazio.chaves.indexOf('publicadoEm') !== -1 && pub.vazio.chaves.indexOf('agenda') !== -1
        && JSON.stringify(pub.comEntradas.chaves.filter((k) => k !== 'logos'))
           === JSON.stringify(pub.vazio.chaves),
        'com logos: ' + JSON.stringify(pub.comEntradas.chaves)
        + ' / vazio: ' + JSON.stringify(pub.vazio.chaves));

      const sinc = await testarSyncLogos(browser, srv.url, [
        { nome: 'vazio-sobre-existente',  logosAntes: { 'teste louletano': TL },
          corpo: JSON.stringify({ publicadoEm: '2026-10-09T12:00:00Z', logos: [] }) },
        { nome: 'vazio-objeto-sobre-existente', logosAntes: { 'teste louletano': TL },
          corpo: JSON.stringify({ publicadoEm: '2026-10-09T12:01:00Z', logos: {} }) },
        { nome: 'validos-sobre-existente', logosAntes: { 'teste louletano': TL },
          corpo: JSON.stringify({ publicadoEm: '2026-10-09T12:02:00Z',
            logos: { 'teste louletano': NOVO_TL, 'teste quarteirense': TQ } }) },
        { nome: 'visitante-novo-servidor-sem-logos', logosAntes: null,
          corpo: JSON.stringify({ publicadoEm: '2026-10-09T12:03:00Z',
            agenda: [{ id: 1, titulo: 'TESTE EVENTO' }] }) },
      ]);

      verificar('publicação com logos=[] não apaga os logótipos do visitante',
        sinc['vazio-sobre-existente'].logos === JSON.stringify({ 'teste louletano': TL }),
        'ficou: ' + sinc['vazio-sobre-existente'].logos);
      verificar('nem com logos={}',
        sinc['vazio-objeto-sobre-existente'].logos === JSON.stringify({ 'teste louletano': TL }),
        'ficou: ' + sinc['vazio-objeto-sobre-existente'].logos);
      verificar('publicação com logos válidos sincroniza normalmente',
        JSON.parse(sinc['validos-sobre-existente'].logos || '{}')['teste louletano'] === NOVO_TL
        && JSON.parse(sinc['validos-sobre-existente'].logos || '{}')['teste quarteirense'] === TQ,
        'ficou: ' + sinc['validos-sobre-existente'].logos);
      verificar('visitante novo e servidor sem logos: não se inventa nada',
        sinc['visitante-novo-servidor-sem-logos'].logos === null,
        'ficou: ' + sinc['visitante-novo-servidor-sem-logos'].logos);
      verificar('e o resto da publicação chega mesmo assim — a medição é válida',
        /TESTE EVENTO/.test(sinc['visitante-novo-servidor-sem-logos'].agenda || ''),
        'agenda: ' + sinc['visitante-novo-servidor-sem-logos'].agenda);
      verificar('páginas públicas: sem erros de JavaScript na sincronização',
        Object.values(sinc).every((c) => c.erros.length === 0),
        Object.values(sinc).map((c) => c.erros.join(' ')).join(' | '));
    }

    // ---- O editor manual de classificação ---------------------------
    console.log('\no editor de classificação: guardar não pode apagar campos');
    {
      const fonteAdm = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('admin.js: as linhas abertas ficam guardadas no _edClassCtx',
        /_edClassCtx = \{ escalao, teamKey, originais: rows \};/.test(fonteAdm));
      verificar('admin.js: o <tr> leva o índice da linha de origem',
        /function _edClassRowHTML\(t, i\)/.test(fonteAdm)
        && /data-idx="\$\{jscEsc\(i\)\}"/.test(fonteAdm));
      verificar('admin.js: o guardar funde sobre a linha de origem em vez de a reconstruir',
        /const base = idx !== undefined && originais\[idx\] \? originais\[idx\] : \{\};/.test(fonteAdm)
        && /const linha = Object\.assign\(\{\}, base, \{/.test(fonteAdm));
      verificar('admin.js: o abrev só se recalcula se o nome mudou',
        /if \(!base\.abrev \|\| base\.equipa !== equipa\) linha\.abrev = _abrevEquipa\(equipa\);/.test(fonteAdm));
      verificar('admin.js: o dg e o pts recalculam-se, e só onde já existiam',
        /if \('dg' in base\)\s+linha\.dg\s+= linha\.gm - linha\.gs;/.test(fonteAdm)
        && /if \('pts' in base\) linha\.pts = linha\.v \* 3 \+ linha\.e \+ \(base\.pts1fase \|\| 0\);/.test(fonteAdm));

      const LOGO_SC = 'https://exemplo.test/logos/sc.png';
      const LOGO_TL = 'https://exemplo.test/logos/tl.png';
      // r0: linha completa, como fica depois de uma colagem com logótipo e com
      //     pontos da 1ª fase escritos na pré-visualização. O serie é um campo
      //     inventado, para medir se um campo futuro sobrevive.
      // r1: completa, sem pts1fase, já com o sc: false que o editor acrescenta.
      // r2: mínima, sem dg, sem pts, sem logo e sem sc.
      const SEMENTE = [
        { equipa: 'J.S. Campinense', abrev: 'J.S', j: 10, v: 7, e: 2, d: 1, gm: 25, gs: 8,
          dg: 17, pts: 29, pts1fase: 6, forma: 'VVEVD', logo: LOGO_SC, sc: true, serie: 'A' },
        { equipa: 'TESTE LOULETANO', abrev: 'TL', j: 10, v: 8, e: 1, d: 1, gm: 22, gs: 9,
          dg: 13, pts: 25, forma: 'VVVEV', logo: LOGO_TL, sc: false },
        { equipa: 'TESTE QUARTEIRENSE', abrev: 'TQ', j: 10, v: 1, e: 1, d: 8, gm: 5, gs: 24,
          forma: 'DDDED' },
      ];
      // Comparação campo a campo, sem depender da ordem das chaves.
      const canon = (o) => JSON.stringify(Object.keys(o || {}).sort().reduce((a, k) => {
        a[k] = o[k]; return a;
      }, {}));

      const ed = await testarEditorPreservaCampos(browser, srv.url, SEMENTE,
        ['nada', 'renomear', 'numeros', 'remover-meio', 'adicionar']);

      // 1. abrir e guardar sem alterar nada
      verificar('medição válida: a abertura numerou as três linhas por ordem',
        JSON.stringify(ed.nada.idxAbertura) === JSON.stringify(['0', '1', '2']),
        JSON.stringify(ed.nada.idxAbertura));
      verificar('guardar sem tocar em nada: a linha do clube fica exactamente igual',
        canon(ed.nada.linhas[0]) === canon(SEMENTE[0]),
        'ficou: ' + canon(ed.nada.linhas[0]));
      verificar('guardar sem tocar em nada: a segunda linha fica exactamente igual',
        canon(ed.nada.linhas[1]) === canon(SEMENTE[1]),
        'ficou: ' + canon(ed.nada.linhas[1]));
      verificar('guardar sem tocar em nada: na linha mínima a única diferença é o sc que o editor já acrescentava',
        canon(ed.nada.linhas[2]) === canon({ ...SEMENTE[2], sc: false }),
        'ficou: ' + canon(ed.nada.linhas[2]));

      // 2, 3, 4. logo, pts1fase e campos futuros
      verificar('o logo sobrevive intacto',
        ed.nada.linhas[0].logo === LOGO_SC && ed.nada.linhas[1].logo === LOGO_TL,
        JSON.stringify([ed.nada.linhas[0].logo, ed.nada.linhas[1].logo]));
      verificar('o pts1fase sobrevive intacto',
        ed.nada.linhas[0].pts1fase === 6, 'pts1fase: ' + ed.nada.linhas[0].pts1fase);
      verificar('um campo que o formulário não conhece sobrevive intacto',
        ed.nada.linhas[0].serie === 'A', 'serie: ' + ed.nada.linhas[0].serie);
      verificar('e não aparece em quem não o tinha',
        !('serie' in ed.nada.linhas[1]) && !('pts1fase' in ed.nada.linhas[1])
        && !('dg' in ed.nada.linhas[2]) && !('pts' in ed.nada.linhas[2]),
        JSON.stringify(Object.keys(ed.nada.linhas[2])));

      // 5. o abrev mantém-se se o nome não mudou
      verificar('nome igual: o abrev "J.S" da colagem não passa a "JC"',
        ed.nada.linhas[0].abrev === 'J.S', 'abrev: ' + ed.nada.linhas[0].abrev);

      // 6. o abrev recalcula-se se o nome mudou
      verificar('nome mudado: o abrev acompanha',
        ed.renomear.linhas[0].equipa === 'Juventude Sport Campinense'
        && ed.renomear.linhas[0].abrev === 'JSC',
        JSON.stringify([ed.renomear.linhas[0].equipa, ed.renomear.linhas[0].abrev]));
      verificar('nome mudado: o logo, o pts1fase e o serie continuam na linha',
        ed.renomear.linhas[0].logo === LOGO_SC
        && ed.renomear.linhas[0].pts1fase === 6
        && ed.renomear.linhas[0].serie === 'A',
        canon(ed.renomear.linhas[0]));

      // 7 e 8. dg e pts recalculados
      verificar('números editados: o dg é gm − gs',
        ed.numeros.linhas[0].dg === 12, 'dg: ' + ed.numeros.linhas[0].dg + ' (esperado 20 − 8)');
      verificar('números editados: o pts é V×3 + E + pts1fase',
        ed.numeros.linhas[0].pts === 26, 'pts: ' + ed.numeros.linhas[0].pts + ' (esperado 18 + 2 + 6)');
      verificar('números editados: quem não tinha dg nem pts continua sem eles',
        !('dg' in ed.numeros.linhas[2]) && !('pts' in ed.numeros.linhas[2])
        && ed.numeros.linhas[2].gm === 7,
        canon(ed.numeros.linhas[2]));

      // 9. apagar uma linha não desalinha os índices
      verificar('linha do meio apagada: ficam duas, e cada uma com os seus campos',
        ed['remover-meio'].linhas.length === 2
        && canon(ed['remover-meio'].linhas[0]) === canon(SEMENTE[0])
        && canon(ed['remover-meio'].linhas[1]) === canon({ ...SEMENTE[2], sc: false }),
        JSON.stringify(ed['remover-meio'].linhas.map((r) => r.equipa)));
      verificar('e a que sobrou não herdou o logo nem o pts da linha apagada',
        !('logo' in ed['remover-meio'].linhas[1]) && !('pts' in ed['remover-meio'].linhas[1])
        && ed['remover-meio'].linhas[1].abrev === 'TQ',
        canon(ed['remover-meio'].linhas[1]));

      // 10. linha nova
      verificar('linha nova: entra só com os campos do formulário',
        ed.adicionar.linhas.length === 4
        && canon(ed.adicionar.linhas[3]) === canon({
          equipa: 'TESTE NOVA', abrev: 'TN', j: 4, v: 3, e: 1, d: 0, gm: 9, gs: 2,
          forma: '', sc: false,
        }),
        'ficou: ' + canon(ed.adicionar.linhas[3]));
      verificar('linha nova: as que já existiam não se mexeram',
        canon(ed.adicionar.linhas[0]) === canon(SEMENTE[0])
        && canon(ed.adicionar.linhas[1]) === canon(SEMENTE[1]));

      verificar('painel: sem erros de JavaScript em nenhum dos cinco cenários',
        Object.values(ed).every((c) => c.erros.length === 0),
        Object.values(ed).map((c) => c.erros.join(' ')).join(' | '));

      // 11. a classificação pública não perde pontos nem posição
      const pub = await testarEditorNaoPerdePontos(browser, srv.url, SEMENTE);
      verificar('medição válida: a classificação pública desenhou as três linhas',
        pub.antes.length === 3, JSON.stringify(pub.antes));
      verificar('a classificação pública tem os pontos da 1ª fase antes de guardar',
        pub.antes[0].equipa === 'J.S. Campinense' && pub.antes[0].pts === '29',
        JSON.stringify(pub.antes));
      verificar('abrir e guardar o editor não muda pontos nem posições na página pública',
        JSON.stringify(pub.depois) === JSON.stringify(pub.antes),
        'antes: ' + JSON.stringify(pub.antes) + ' depois: ' + JSON.stringify(pub.depois));
      verificar('página pública: sem erros de JavaScript na medição',
        pub.erros.length === 0, pub.erros.join(' / '));
    }

    // ---- O emblema do clube na classificação ------------------------
    console.log('\nresultados.html: o emblema do clube na classificação');
    {
      // Sem as linhas comentadas: a asserção de baixo passava com a correcção
      // comentada — medido, ao repor o defeito de propósito.
      const fonteRes2 = fs.readFileSync(path.join(raiz, 'js', 'resultados.js'), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '');
      verificar('resultados.js: o recurso só se aplica à linha do clube',
        /if \(!logo && t\.sc === true\) logo = logoDoClube\(\);/.test(fonteRes2));
      verificar('resultados.js: o emblema vem do dados_clube.logo, com o ficheiro local como recurso',
        /logoDoClube\(\) \{[\s\S]*?dados_clube[\s\S]*?return 'images\/logo\.svg';/.test(fonteRes2));
      verificar('resultados.js: a procura por nome no db_logos fica como estava',
        /logosMap\[\(t\.equipa \|\| ''\)\.toLowerCase\(\)\]/.test(fonteRes2));
      verificar('resultados.js: a página não escreve nada nos dados',
        !/setItem\('db_logos'|setItem\('fpf_class_|setItem\('dados_clube'/.test(fonteRes2));

      const OUTRO = 'https://exemplo.test/logos/outro.png';
      const ZZ_SC = 'https://exemplo.test/logos/zz-campinense.png';
      const linha = (equipa, abrev, sc, extra) => Object.assign({
        equipa, abrev, j: 5, v: sc ? 4 : 2, e: 1, d: sc ? 0 : 2,
        gm: 10, gs: 4, forma: 'VVEVV',
      }, sc ? { sc: true } : {}, extra || {});
      // Em todos os cenários: uma equipa com chave no db_logos e outra sem
      // nenhuma — o recurso do clube não lhes pode tocar.
      const outras = () => [
        linha('TESTE LOULETANO', 'TL', false),
        linha('TESTE QUARTEIRENSE', 'TQ', false),
      ];
      const logosBase = { 'teste louletano': OUTRO };

      const e = await testarEmblemaDoClube(browser, srv.url, [
        { nome: 'sem-entrada', linhas: [linha('J.S. Campinense', 'JC', true), ...outras()],
          logos: logosBase, clube: null },
        { nome: 'grafia-diferente', linhas: [linha('JS Campinense', 'JC', true), ...outras()],
          logos: Object.assign({ 'j.s. campinense': ZZ_SC }, logosBase), clube: null },
        { nome: 'clube-configurado', linhas: [linha('J.S. Campinense', 'JC', true), ...outras()],
          logos: logosBase, clube: { logo: 'images/logo.png' } },
        { nome: 'recurso-local', linhas: [linha('J.S. Campinense', 'JC', true), ...outras()],
          logos: logosBase, clube: { logo: 'x.png' } },
        { nome: 'logo-proprio', linhas: [linha('J.S. Campinense', 'JC', true, { logo: ZZ_SC }), ...outras()],
          logos: logosBase, clube: { logo: 'images/logo.png' } },
      ]);
      const sc = (n) => e[n].linhas.find((r) => r.equipa.indexOf('Campinense') !== -1);
      const outra = (n, nome) => e[n].linhas.find((r) => r.equipa.indexOf(nome) !== -1);

      verificar('medição válida: os cinco cenários desenharam as três linhas',
        Object.keys(e).length === 5 && Object.values(e).every((c) => c.linhas.length === 3),
        JSON.stringify(Object.keys(e).map((k) => e[k].linhas.length)));

      verificar('J.S. Campinense sem entrada no db_logos: aparece o emblema do clube',
        sc('sem-entrada').src === 'images/logo.svg',
        'src: ' + sc('sem-entrada').src);
      verificar('e o escudo "JC" deixa de aparecer — a imagem carregou mesmo',
        sc('sem-entrada').escudoVisivel === false && sc('sem-entrada').escudoTexto === 'JC',
        JSON.stringify(sc('sem-entrada')));

      verificar('JS Campinense com a chave noutra grafia: aparece o emblema do clube',
        sc('grafia-diferente').src === 'images/logo.svg',
        'src: ' + sc('grafia-diferente').src);
      verificar('grafia diferente: o escudo amarelo não volta',
        sc('grafia-diferente').escudoVisivel === false);

      verificar('com dados_clube.logo configurado, é esse o endereço usado',
        sc('clube-configurado').src === 'images/logo.png',
        'src: ' + sc('clube-configurado').src);
      verificar('configurado: o escudo fica escondido — a imagem carregou',
        sc('clube-configurado').escudoVisivel === false);

      verificar('sem dados_clube.logo utilizável, o recurso é images/logo.svg',
        sc('recurso-local').src === 'images/logo.svg',
        'src: ' + sc('recurso-local').src);

      verificar('uma linha do clube que já tenha logótipo próprio mantém-no',
        sc('logo-proprio').src === ZZ_SC, 'src: ' + sc('logo-proprio').src);

      verificar('as outras equipas continuam iguais: a que tem chave mantém o logótipo',
        Object.keys(e).every((n) => outra(n, 'LOULETANO').src === OUTRO),
        JSON.stringify(Object.keys(e).map((n) => outra(n, 'LOULETANO').src)));
      verificar('a que não tem chave continua com o escudo normal, sem imagem',
        Object.keys(e).every((n) => outra(n, 'QUARTEIRENSE').src === null
          && outra(n, 'QUARTEIRENSE').escudoVisivel === true
          && outra(n, 'QUARTEIRENSE').escudoSC === false),
        JSON.stringify(outra('sem-entrada', 'QUARTEIRENSE')));
      verificar('o emblema do clube não chega a nenhuma equipa de terceiros',
        Object.keys(e).every((n) => e[n].linhas
          .filter((r) => r.equipa.indexOf('Campinense') === -1)
          .every((r) => !/images\/logo\./.test(r.src || ''))));
      verificar('classificação: sem erros de JavaScript em nenhum cenário',
        Object.values(e).every((c) => c.erros.length === 0),
        Object.values(e).map((c) => c.erros.join(' ')).join(' | '));
    }

    // ---- O transporte do proxy: cURL e a alternativa ----------------
    console.log('\napi/buscar.php: cURL, alternativa por stream, redirects e tecto');
    {
      const t = await testarTransporteDoProxy(raiz);
      const MAX = 3145728;

      // 1. Com cURL.
      verificar('com cURL: busca uma página e devolve 200',
        t.comCurl.via === 'curl' && t.comCurl.codigo === 200 && t.comCurl.inicio === 'INICIO-OK...',
        JSON.stringify(t.comCurl).slice(0, 140));

      // 2. Sem cURL: a alternativa por stream.
      verificar('sem cURL: a alternativa por stream faz o mesmo pedido',
        t.semCurl.temCurl === false && t.semCurl.via === 'stream'
        && t.semCurl.codigo === 200 && t.semCurl.inicio === 'INICIO-OK...',
        JSON.stringify(t.semCurl).slice(0, 140));

      // 3. Sem cURL e sem allow_url_fopen: o erro diz a verdade.
      verificar('sem cURL e sem allow_url_fopen: o erro nomeia as duas causas',
        !!t.semNada.erro && /cURL/.test(t.semNada.erro) && /allow_url_fopen/.test(t.semNada.erro),
        JSON.stringify(t.semNada).slice(0, 180));

      // 4. Redirects: devolvidos, não seguidos.
      verificar('com cURL: um 302 é devolvido com o Location, e NÃO é seguido',
        t.redirect.codigo === 302 && /\/ok$/.test(t.redirect.destino || '')
        && t.redirect.bytes === 0,
        JSON.stringify(t.redirect).slice(0, 140));
      verificar('sem cURL: o 302 também é devolvido sem ser seguido',
        t.redirectSemCurl.codigo === 302 && /\/ok$/.test(t.redirectSemCurl.destino || ''),
        JSON.stringify(t.redirectSemCurl).slice(0, 140));
      verificar('um Location para fora é devolvido como está, para o ciclo o validar',
        t.redirectFora.codigo === 302 && t.redirectFora.destino === 'https://exemplo.test/x',
        JSON.stringify(t.redirectFora).slice(0, 140));

      // 5. Tecto de 3 MB.
      verificar('com cURL: 5 MB são cortados nos 3 MB e marcados como truncados',
        t.grande.codigo === 200 && t.grande.bytes === MAX && t.grande.truncado === true,
        't.grande bytes=' + t.grande.bytes + ' truncado=' + t.grande.truncado);
      verificar('sem cURL: o mesmo tecto de 3 MB',
        t.grandeSemCurl.codigo === 200 && t.grandeSemCurl.bytes === MAX
        && t.grandeSemCurl.truncado === true,
        't.grandeSemCurl bytes=' + t.grandeSemCurl.bytes);

      // 6. Um erro do site de origem chega como código, não como falha.
      verificar('um 404 do site de origem é devolvido como código 404',
        t.erro404.codigo === 404 && !t.erro404.erro, JSON.stringify(t.erro404).slice(0, 120));

      // 7. A allowlist, estreitada e à prova de nomes parecidos.
      const d = t.dominios;
      verificar('allowlist: www.zerozero.pt, zerozero.pt e www.afalgarve.pt entram',
        d.zz.permitido === true && d.zzRaiz.permitido === true && d.af.permitido === true,
        JSON.stringify(d).slice(0, 160));
      verificar('allowlist: o fpf.pt já NÃO entra — a lista foi estreitada',
        d.fpf.permitido === false);
      verificar('allowlist: um domínio que só termina no mesmo texto não entra',
        d.parecido.permitido === false);
      verificar('allowlist: um domínio que começa pelo permitido não entra',
        d.sufixo.permitido === false);
      verificar('allowlist: esquema que não é http/https não entra',
        d.esquema.permitido === false);
      verificar('allowlist: porta fora da 80/443 não entra',
        d.porta.permitido === false);
      verificar('allowlist: endereço com utilizador e password não entra',
        d.utilizador.permitido === false);

      // 8. A fonte: as protecções e as opções pedidas.
      const fonteBuscar = fs.readFileSync(path.join(raiz, 'api', 'buscar.php'), 'utf8');
      verificar('buscar.php: o cURL não segue redirects por si',
        /CURLOPT_FOLLOWLOCATION => false/.test(fonteBuscar));
      verificar('buscar.php: tempos de ligação e total, e User-Agent de browser',
        /CURLOPT_CONNECTTIMEOUT => JSC_BUSCAR_CONEXAO_S/.test(fonteBuscar)
        && /CURLOPT_TIMEOUT        => JSC_BUSCAR_TOTAL_S/.test(fonteBuscar)
        && /CURLOPT_USERAGENT      => JSC_BUSCAR_AGENTE/.test(fonteBuscar));
      verificar('buscar.php: verificação de certificado activa nos dois caminhos',
        /CURLOPT_SSL_VERIFYPEER => true/.test(fonteBuscar)
        && /CURLOPT_SSL_VERIFYHOST => 2/.test(fonteBuscar)
        && /'verify_peer'      => true/.test(fonteBuscar)
        && /'verify_peer_name' => true/.test(fonteBuscar));
      verificar('buscar.php: protocolos limitados a http e https',
        /CURLOPT_PROTOCOLS_STR, 'http,https'/.test(fonteBuscar)
        && /CURLPROTO_HTTP \| CURLPROTO_HTTPS/.test(fonteBuscar));
      verificar('buscar.php: não escreve nada em disco',
        !/file_put_contents|fwrite|rename\(|unlink\(|mkdir\(/.test(fonteBuscar));
      verificar('buscar.php: o tecto declarado é de 3 MB',
        /const JSC_BUSCAR_MAX_BYTES = 3145728;/.test(fonteBuscar));
      verificar('tools/teste-buscar.php só corre na linha de comandos',
        /PHP_SAPI !== 'cli'/.test(fs.readFileSync(path.join(raiz, 'tools', 'teste-buscar.php'), 'utf8')));

      // 9. O painel mostra o erro real do nosso proxy.
      const fonteAdmin2 = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8');
      verificar('o painel lê o corpo do erro do proxy local em vez de o descartar',
        /erroLocal = \(await res\.text\(\)\)/.test(fonteAdmin2)
        && /throw new Error\('O servidor respondeu: ' \+ erroLocal/.test(fonteAdmin2));
      verificar('o painel já não mostra o genérico "fetch falhou"',
        !/fetch falhou/.test(fonteAdmin2));
      verificar('o pedido ao proxy local leva credentials same-origin',
        /fetch\(proxyUrl, \{ signal: ctrl\.signal, credentials: 'same-origin' \}\)/.test(fonteAdmin2));
    }

    // ---- O api/proxy.php e a sessão do painel -----------------------
    console.log('\napi/proxy.php: a sessão do painel');
    {
      const naRaiz = fs.existsSync(path.join(raiz, 'proxy.php'));
      const emApi  = fs.existsSync(path.join(raiz, 'api', 'proxy.php'));
      verificar('o proxy vive em api/proxy.php e já não na raiz do site',
        emApi && !naRaiz, 'api/proxy.php=' + emApi + ' raiz=' + naRaiz);

      const fonteProxy = fs.readFileSync(path.join(raiz, 'api', 'proxy.php'), 'utf8');
      verificar('api/proxy.php carrega o sessao.php da mesma pasta',
        /require_once __DIR__ \. '\/sessao\.php';/.test(fonteProxy));
      // As quatro decisões que o endpoint guarda. O tecto de bytes passou para o
      // transporte, no api/buscar.php, e é medido lá — com 5 MB a sério.
      verificar('api/proxy.php mantém as quatro decisões de segurança',
        /jsc_pode\('importar'\)/.test(fonteProxy)
        && /jsc_dominio_permitido\(\$url, \$DOMINIOS\)/.test(fonteProxy)
        && /jsc_dominio_permitido\(\$destino, \$DOMINIOS\)/.test(fonteProxy)
        && /jsc_endereco_publico\(\$host\)/.test(fonteProxy));
      verificar('api/proxy.php carrega o transporte do api/buscar.php',
        /require_once __DIR__ \. '\/buscar\.php';/.test(fonteProxy));
      verificar('api/proxy.php: a allowlist ficou nos dois domínios',
        /\$DOMINIOS = \['zerozero\.pt', 'afalgarve\.pt'\];/.test(fonteProxy));
      verificar('api/proxy.php não tem nenhuma instrução de escrita',
        !/file_put_contents|fwrite|rename\(|unlink\(|mkdir\(/.test(fonteProxy));

      const fonteAdmin = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8');
      verificar('o painel chama ../api/proxy.php',
        /`\.\.\/api\/proxy\.php\?url=\$\{encodeURIComponent\(url\)\}`/.test(fonteAdmin));
      verificar('nenhum ficheiro do projeto chama ainda o proxy na raiz',
        !/['"`]\.\.\/proxy\.php|['"`]\/proxy\.php/.test(fonteAdmin));

      if (srv.modo !== 'apache') {
        console.log('  (comportamento saltado: sem Apache não há PHP a servir)');
      } else {
        const ficheiroUtils = path.join(raiz, 'data', 'utilizadores.json');
        const haviaUtils = fs.existsSync(ficheiroUtils);
        try {
          const p = await testarProxyAutenticado(srv.url);
          verificar('sem sessão: 401 e a mensagem do painel',
            p.semSessao.estado === 401 && /Precisa de sessao no painel/.test(p.semSessao.texto),
            p.semSessao.estado + ' · ' + p.semSessao.texto.slice(0, 60));
          verificar('a conta de Super Admin foi criada e deu cookie — a medição é válida',
            p.criou && p.cookieAdmin, 'criou=' + p.criou + ' cookie=' + p.cookieAdmin);
          verificar('o api/auth.php vê a sessão desse cookie (controlo)',
            p.painelVeSessao === true);
          verificar('O MESMO cookie é reconhecido pelo api/proxy.php',
            p.comAdmin.estado !== 401 && !/Precisa de sessao/.test(p.comAdmin.texto),
            p.comAdmin.estado + ' · ' + p.comAdmin.texto.slice(0, 60));
          verificar('e passa também a verificação de capacidade importar',
            !/nao pode importar/.test(p.comAdmin.texto), p.comAdmin.texto.slice(0, 60));
          verificar('um domínio fora da allowlist é recusado com 403, já com sessão',
            p.foraDaLista.estado === 403 && /Dominio nao permitido/.test(p.foraDaLista.texto),
            p.foraDaLista.estado + ' · ' + p.foraDaLista.texto.slice(0, 60));
          verificar('um perfil sem a capacidade importar foi criado e entrou — medição válida',
            p.criouComunicacao && p.entrouComunicacao,
            'criou=' + p.criouComunicacao + ' entrou=' + p.entrouComunicacao);
          verificar('esse perfil recebe 403 do api/proxy.php, não o conteúdo',
            p.semCapacidade.estado === 403 && /nao pode importar/.test(p.semCapacidade.texto),
            p.semCapacidade.estado + ' · ' + p.semCapacidade.texto.slice(0, 60));
        } finally {
          // As contas são da medição: não ficam para os testes seguintes.
          if (!haviaUtils) { try { fs.unlinkSync(ficheiroUtils); } catch (_) {} }
        }
      }
    }

    // ---- Pré-visualização da importação de jogos: o logótipo --------
    console.log('\nimportação de jogos: o logótipo na pré-visualização');
    {
      const fonte = fs.readFileSync(path.join(raiz, 'admin', 'js', 'admin.js'), 'utf8');
      verificar('admin.js: o logoImg() já não vai envolvido em jscEsc()',
        !/jscEsc\(logoImg\(/.test(fonte),
        (fonte.match(/jscEsc\(logoImg\(/g) || []).length + ' ocorrência(s)');
      verificar('admin.js: as duas células inserem o markup do logótipo directamente',
        (fonte.match(/\$\{logoImg\(j\.logo(Casa|Fora)\)\}/g) || []).length === 2);
      verificar('admin.js: o endereço do logótipo continua a passar pelo jscEscUrl',
        /<img src="\$\{jscEscUrl\(url\)\}"/.test(fonte));
      verificar('admin.js: o nome da equipa ao lado do logótipo continua escapado',
        /\$\{logoImg\(j\.logoCasa\)\}\$\{jscEsc\(j\.casa\)\}/.test(fonte)
        && /\$\{logoImg\(j\.logoFora\)\}\$\{jscEsc\(j\.fora\)\}/.test(fonte));

      const p = await testarPreviaDeJogos(browser, srv.url);
      verificar('a pré-visualização reconheceu os dois jogos — a medição é válida',
        p.linhas.length === 2, p.linhas.length + ' linhas · ' + p.preview.slice(0, 120));

      if (p.linhas.length === 2) {
        // 1. O logótipo aparece como imagem, não como texto.
        verificar('o logótipo aparece como <img> e não como código em texto',
          p.markupComoTexto === false, 'texto da prévia: ' + p.preview.slice(0, 140));
        verificar('a equipa com logótipo normal tem a imagem com o endereço certo',
          p.srcs.includes(p.URL_BOA), JSON.stringify(p.srcs));

        // 2. Sem logótipo não há imagem, e o nome continua lá.
        verificar('a equipa sem logótipo não produz nenhuma <img>',
          p.linhas[0].imgs === 1, 'imagens na primeira linha: ' + p.linhas[0].imgs);
        verificar('e o nome da equipa sem logótipo continua visível',
          p.linhas[0].texto.indexOf('TESTE EQUIPA FORA') !== -1, p.linhas[0].texto);

        // 3. URL maliciosa: recusada, sem javascript: em nenhum src.
        verificar('uma URL javascript: é recusada e dá src vazio',
          p.srcs.filter((x) => x === '').length === 1, JSON.stringify(p.srcs));
        verificar('nenhum src contém javascript:, vbscript: ou data: de não-imagem',
          p.srcs.every((x) => !/^\s*(javascript|vbscript)\s*:/i.test(x || '')
            && !(/^\s*data\s*:/i.test(x || '') && !/^\s*data:image\//i.test(x || ''))),
          JSON.stringify(p.srcs));

        // 4. Injeção pelo campo do logótipo: nada escapa do atributo.
        verificar('uma URL com aspas não cria elementos a mais',
          p.nImgs === 3, p.nImgs + ' imagens, esperava 3');
        verificar('nenhuma imagem ganhou um onerror estranho ao do projeto',
          p.onerros.every((o) => o === "this.style.display='none'"),
          JSON.stringify(p.onerros));
        verificar('a injeção pelo campo do logótipo não executou nada',
          p.xssDisparou === false);
      }

      verificar('sem erros de JavaScript no painel durante a medição',
        p.erros.length === 0, p.erros.join(' / '));
    }

    // ---- Orçamento do payload antes de publicar -------------------
    console.log('\norçamento do payload antes de publicar');
    {
      const o = await testarOrcamentoDoPayload(browser, srv.url);
      verificar('a função de orçamento existe na página do painel', o.existe === true);
      if (o.existe) {
        verificar('conteúdo pequeno: publica sem aviso',
          !o.pequeno.recusar && !o.pequeno.avisar,
          JSON.stringify(o.pequeno).slice(0, 160));
        verificar('conteúdo acima do limite do servidor: RECUSADO antes do POST',
          o.grande.recusar === true && /post_max_size/.test(o.grande.mensagem || ''),
          (o.grande.bytes / 1048576).toFixed(2) + ' MB · ' + String(o.grande.mensagem).slice(0, 120));
        verificar('a recusa nomeia a área que pesa e quantas imagens tem',
          /noticias/.test(o.grande.mensagem || '') && /imagem/.test(o.grande.mensagem || ''),
          String(o.grande.mensagem).slice(0, 200));
        verificar('notícias pesadas mas abaixo do limite: avisa em vez de recusar',
          o.medio.avisar === true && !o.medio.recusar,
          (o.medio.bytes / 1048576).toFixed(2) + ' MB · ' + String(o.medio.mensagem).slice(0, 120));
        verificar('sem erros de JavaScript na página do painel',
          o.erros.length === 0, o.erros.join(' / '));
      }
    }

    // ---- A lista de notícias nas sete larguras --------------------
    // A projeção pública passou a alimentar esta página com JavaScript ligado.
    console.log('\nlista de notícias nas sete larguras, com a projeção pública');
    for (const largura of [320, 375, 414, 768, 1024, 1280, 1440]) {
      const w = await testarNoticias(browser, srv.url, true, largura);
      verificar(`${largura}px: ${N} cartões no DOM, 9 visíveis, sem transbordo`,
        w.cartoes === N && w.visiveis === 9 && w.transbordo <= 0,
        'DOM ' + w.cartoes + ' · visíveis ' + w.visiveis + ' · transbordo +' + w.transbordo + 'px');
    }

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

    // ---- 6. Bloco 4: formacao.html e escalao.html ---------------
    console.log('\nformação: cartões dos escalões');
    const escFix = dados.escaloes.filter((e) => (e.nome || '').trim() !== '');
    const nomesEsc = escFix.map((e) => e.nome.trim());

    let f = await testarFormacao(browser, srv.url, false, 1440);
    verificar(`sem JS: ${escFix.length} cartões de escalão`,
      f.cartoes === escFix.length && f.cartoesVisiveis === escFix.length,
      'cartões ' + f.cartoes + ', visíveis ' + f.cartoesVisiveis);
    verificar('sem JS: os nomes são os do painel, pela mesma ordem',
      JSON.stringify(f.lidos.map((c) => c.nome)) === JSON.stringify(nomesEsc),
      JSON.stringify(f.lidos.map((c) => c.nome)));
    verificar('sem JS: nenhum estado vazio visível com escalões', !f.vazioVisivel);
    verificar('sem JS: campo vazio não produz elemento',
      (function () {
        const c = f.lidos.find((x) => x.nome === 'TESTE-SO-NOME');
        return c && c.designacao === null && c.faixa === null
          && c.descricao === null && c.itens === null;
      })(), JSON.stringify(f.lidos.find((x) => x.nome === 'TESTE-SO-NOME')));
    verificar('sem JS: nenhuma lista vazia em cartão nenhum', f.listasVazias === 0);
    verificar('sem JS: o cartão completo tem os cinco itens, nesta ordem',
      (function () {
        const c = f.lidos.find((x) => x.nome === 'TESTE-COMPLETO');
        return c && JSON.stringify(c.itens) === JSON.stringify([
          'TESTE HORARIO DE TREINOS', 'Treinador: TESTE TREINADOR',
          'TESTE COMPETICAO DO ESCALAO', 'TESTE LOCAL DO ESCALAO', '12 atletas inscritos']);
      })(), JSON.stringify((f.lidos.find((x) => x.nome === 'TESTE-COMPLETO') || {}).itens));
    verificar('sem JS: competição e local sozinhos produzem só os seus itens',
      (function () {
        const c = f.lidos.find((x) => x.nome === 'TESTE-COMP-LOCAL');
        return c && JSON.stringify(c.itens) === JSON.stringify(['TESTE SO COMPETICAO', 'TESTE SO LOCAL']);
      })());
    verificar('sem JS: nenhum "0 atletas inscritos" na página',
      !/\b0 atletas inscritos/.test(f.texto) && !/-3 atletas/.test(f.texto)
      && !f.texto.includes('muitos atletas'));
    verificar('sem JS: o escalão com atletas 0, "0", negativo e inválido não tem lista',
      ['TESTE-ZERO-NUMERO', 'TESTE-ZERO-TEXTO', 'TESTE-ATLETAS-NEGATIVO', 'TESTE-ATLETAS-INVALIDO']
        .every((n) => (f.lidos.find((x) => x.nome === n) || {}).itens === null));
    verificar('sem JS: só o escalão em destaque tem badge e classe',
      f.lidos.filter((c) => c.destaque).length === 1
      && f.lidos.filter((c) => c.badge).length === 1
      && (f.lidos.find((c) => c.destaque) || {}).nome === 'TESTE-DESTAQUE');
    verificar('sem JS: cada cartão tem uma ligação <a> a sério',
      f.focaveis === escFix.length
      && f.lidos.every((c) => c.ligacaoTag === 'A' && c.href.startsWith('escalao.html?escalao=')));
    verificar('sem JS: a ligação do nome difícil volta a dar o nome exacto',
      (function () {
        const c = f.lidos.find((x) => x.nome === 'TESTE A&B/C 1');
        return c && c.href === 'escalao.html?escalao=TESTE%20A%26B%2FC%201'
          && c.escalaoDoUrl === 'TESTE A&B/C 1';
      })(), JSON.stringify(f.lidos.find((x) => x.nome === 'TESTE A&B/C 1')));
    verificar('sem JS: o URLSearchParams recupera todos os nomes',
      JSON.stringify(f.lidos.map((c) => c.escalaoDoUrl)) === JSON.stringify(nomesEsc));
    verificar('sem JS: nenhum dado pessoal de atleta na formacao.html',
      !f.texto.includes('TESTE ATLETA') && !f.texto.includes('TESTE ENCARREGADO')
      && !/\b\d+ anos\b/.test(f.texto));
    verificar('sem JS: sem transbordo a 1440 px', f.transbordo <= 0, 'transbordo ' + f.transbordo);

    f = await testarFormacao(browser, srv.url, false, 320);
    verificar('sem JS a 320 px: os cartões continuam todos',
      f.cartoes === escFix.length);
    verificar('sem JS a 320 px: sem transbordo', f.transbordo <= 0, 'transbordo ' + f.transbordo);

    // Com JavaScript, o bloco gerado e atual não é redesenhado. A marca de
    // água prova-o: se o JavaScript reescrevesse a grelha, desaparecia.
    const fmcFich = path.join(raiz, 'formacao.html');
    const fmcAntes = fs.readFileSync(fmcFich, 'utf8');
    fs.writeFileSync(fmcFich, fmcAntes.replace(
      '<div class="category-card__age">TESTE-COMPLETO</div>',
      '<div class="category-card__age">TESTE-COMPLETO</div><!--MARCA-->'));
    f = await testarFormacao(browser, srv.url, true, 1440);
    verificar('com JS: o bloco gerado e atual não é redesenhado',
      fs.readFileSync(fmcFich, 'utf8').includes('<!--MARCA-->')
      && f.cartoes === escFix.length && f.lidos.length === escFix.length);
    verificar('com JS: sem erros de consola', f.erros.length === 0, f.erros.join(' | '));
    const lidosGerados = JSON.stringify(f.lidos);

    // data-itens errado: o JavaScript tem de redesenhar, e o cartão que
    // desenha tem de ser o mesmo cartão que o servidor gerou.
    fs.writeFileSync(fmcFich, fs.readFileSync(fmcFich, 'utf8')
      .replace('data-itens="' + escFix.length + '"', 'data-itens="99"'));
    f = await testarFormacao(browser, srv.url, true, 1440);
    verificar('com JS: data-itens errado força o redesenho',
      f.cartoes === escFix.length && f.itens === '99');
    verificar('com JS: o cartão desenhado é o mesmo que o gerado',
      JSON.stringify(f.lidos) === lidosGerados,
      'desenhado: ' + JSON.stringify(f.lidos).slice(0, 300));
    verificar('com JS: nenhum "0 atletas inscritos" depois do redesenho',
      !/\b0 atletas inscritos/.test(f.texto));
    fs.writeFileSync(fmcFich, fmcAntes);

    console.log('\nescalões: redução de dados pessoais');
    let esc = await testarEscalao(browser, srv.url, 'TESTE-COMPLETO', true);
    verificar('escalão: o plantel mostra os atletas do escalão',
      esc.jogadores === dados.atletas.filter((a) => a.escalao === 'TESTE-COMPLETO').length,
      'jogadores ' + esc.jogadores);
    verificar('escalão: o cartão do atleta não mostra a idade',
      esc.metas.every((m) => !/anos/.test(m) && !/·/.test(m)),
      JSON.stringify(esc.metas));
    verificar('escalão: nenhuma idade em toda a página',
      !/\b\d+ anos\b/.test(esc.texto));
    verificar('escalão: a secção dos aniversários não existe',
      !esc.aniversarios && !esc.aniversariosLista && esc.cartoesAniversario === 0);
    verificar('escalão: nem a palavra Aniversários aparece',
      !/Aniversári/i.test(esc.texto));
    verificar('escalão: a equipa técnica continua a aparecer',
      esc.staff === dados.treinadores.filter((t) => t.escalao === 'TESTE-COMPLETO').length);
    verificar('escalão: a foto do treinador com \' e ( ) é percent-encoded no url(...)',
      esc.staffEstilos.some((e) => e.includes('%27') && e.includes('%28') && e.includes('%29'))
      && esc.staffImagens.some((i) => i.startsWith('url(')),
      JSON.stringify(esc.staffEstilos) + ' | ' + JSON.stringify(esc.staffImagens));
    verificar('escalão: sem erros de consola', esc.erros.length === 0, esc.erros.join(' | '));

    // ---- 6d. Bloco 7: galeria e vídeos --------------------------
    console.log('\ngaleria e vídeos: fonte única');
    const galPub = dados.galeria.filter((f) => f.ativo !== false
      && String(f.titulo || '').trim() !== '');
    const idYtB = (u) => {
      const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return m ? m[1] : '';
    };
    const vidPub = dados.videos.filter((v) => v.ativo !== false
      && String(v.titulo || '').trim() !== '' && idYtB(v.url) !== '');

    // As sete larguras, nas três zonas.
    for (const largura of [320, 375, 390, 430, 768, 1024, 1440]) {
      for (const [pagina, esperados] of [
        ['index.html', Math.min(galPub.length, 6)],
        ['galeria.html', galPub.length],
        ['videos.html', vidPub.length],
      ]) {
        const x = await testarMedia(browser, srv.url, pagina, false, largura);
        verificar(`sem JS a ${largura} px (${pagina}): ${esperados} cartões visíveis`,
          x.cartoes === esperados && x.cartoesVisiveis === esperados,
          'cartões ' + x.cartoes + ', visíveis ' + x.cartoesVisiveis);
        verificar(`sem JS a ${largura} px (${pagina}): sem transbordo`,
          x.transbordo <= 0, '+' + x.transbordo + 'px');
      }
    }

    let gi = await testarMedia(browser, srv.url, 'index.html', false, 1440);
    verificar('sem JS (inicial): a secção da galeria existe e não há esqueletos',
      gi.secaoGaleria && gi.esqueletos === 0);
    verificar('sem JS (inicial): nenhuma das cinco legendas fictícias na página',
      !/Treino Sub-17|Jogo Sub-13|Treino Sub-9|Campeão Distrital/.test(gi.texto));
    verificar('sem JS (inicial): os filtros e o botão "Ver mais" saem sem JavaScript',
      gi.filtrosVisiveis === 0 && !gi.botaoMais,
      'filtros ' + gi.filtrosVisiveis + ', botão ' + gi.botaoMais);
    verificar('sem JS (inicial): a imagem problemática resolve percent-encoded',
      gi.lidos.some((c) => /%27/.test(c.fundo) && /%28/.test(c.fundo)),
      JSON.stringify(gi.lidos.map((c) => c.fundo).slice(0, 2)));
    verificar('sem JS (inicial): imgPos e imgSize resolvidos pelo browser',
      gi.lidos.some((c) => c.fundoPos === '50% 0%' && c.fundoSize === 'contain'),
      JSON.stringify(gi.lidos.map((c) => [c.fundoPos, c.fundoSize]).slice(0, 3)));

    let gp = await testarMedia(browser, srv.url, 'galeria.html', false, 1440);
    verificar('sem JS (galeria): nenhum esqueleto de carregamento',
      gp.esqueletos === 0, 'esqueletos ' + gp.esqueletos);
    verificar('sem JS (galeria): o estado vazio está escondido com fotografias',
      !gp.vazioVisivel);
    verificar('sem JS (galeria): os filtros saem sem JavaScript',
      gp.filtrosVisiveis === 0, 'filtros visíveis ' + gp.filtrosVisiveis);
    verificar('sem JS (galeria): a fotografia sem endereço tem cartão de categoria',
      gp.lidos.some((c) => /galeria-placeholder/.test(c.classes) || !/url\(/.test(c.fundo)));
    verificar('sem JS (galeria): cada cartão tem nome acessível',
      gp.lidos.every((c) => /^Ver foto: /.test(c.rotulo || '')));
    verificar('sem JS (galeria): o título com & e <b> aparece como texto',
      gp.texto.includes('TESTE ESCAPE FOTO & <b>B</b>'));
    verificar('sem JS (galeria): a ordem é a ordem dos dados',
      JSON.stringify(gp.lidos.map((c) => c.legenda)) === JSON.stringify(galPub.map((f) => f.titulo.trim())),
      JSON.stringify(gp.lidos.map((c) => c.legenda).slice(0, 3)));

    let vp = await testarMedia(browser, srv.url, 'videos.html', false, 1440);
    verificar('sem JS (vídeos): cada cartão é uma ligação para o YouTube',
      vp.lidos.every((c) => c.etiqueta === 'A'
        && /^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/.test(c.href || '')),
      JSON.stringify(vp.lidos.map((c) => c.href)));
    verificar('sem JS (vídeos): toda a miniatura vem do id validado e tem alt',
      vp.lidos.every((c) => /^https:\/\/img\.youtube\.com\/vi\/[a-zA-Z0-9_-]{11}\//.test(c.src || '')
        && (c.alt || '') !== ''));
    verificar('sem JS (vídeos): o estado vazio está escondido com vídeos',
      !vp.vazioVisivel);
    verificar('sem JS (vídeos): os filtros saem sem JavaScript',
      vp.filtrosVisiveis === 0);
    verificar('sem JS (vídeos): o iframe do modal não tem src',
      vp.iframeSrc === null || vp.iframeSrc === '');

    // Com JavaScript: o bloco gerado e atual não é redesenhado, e o cartão
    // desenhado é o mesmo que o gerado.
    for (const [pagina, ficheiro, ancora] of [
      ['index.html', path.join(raiz, 'index.html'), '<span class="gallery__caption">TESTE FOTO SO TITULO</span>'],
      ['galeria.html', path.join(raiz, 'galeria.html'), '<p class="galeria-item__overlay-title">TESTE FOTO SO TITULO</p>'],
      ['videos.html', path.join(raiz, 'videos.html'), '<p class="video-card__title">TESTE VIDEO COMPLETO</p>'],
    ]) {
      const esperados = pagina === 'index.html' ? Math.min(galPub.length, 6)
        : pagina === 'galeria.html' ? galPub.length : vidPub.length;
      const total = pagina === 'videos.html' ? vidPub.length : galPub.length;
      const antes = fs.readFileSync(ficheiro, 'utf8');
      fs.writeFileSync(ficheiro, antes.replace(ancora, ancora + '<!--MARCA-->'));
      let y = await testarMedia(browser, srv.url, pagina, true, 1440);
      verificar(`com JS (${pagina}): o bloco gerado e atual não é redesenhado`,
        fs.readFileSync(ficheiro, 'utf8').includes('<!--MARCA-->') && y.cartoes === esperados,
        'cartões ' + y.cartoes);
      verificar(`com JS (${pagina}): sem erros de consola`, y.erros.length === 0, y.erros.join(' | '));
      const gerados = JSON.stringify(y.lidos);

      // Alterar o data-itens do contentor certo: na página inicial há mais do
      // que uma região, e duas podem declarar o mesmo número.
      const contentor = pagina === 'index.html' ? 'galleryGrid'
        : pagina === 'galeria.html' ? 'galeriaGrid' : 'videosGrid';
      fs.writeFileSync(ficheiro, fs.readFileSync(ficheiro, 'utf8').replace(
        new RegExp('(id="' + contentor + '"[^>]*data-itens=")' + total + '(")'), '$199$2'));
      y = await testarMedia(browser, srv.url, pagina, true, 1440);
      verificar(`com JS (${pagina}): data-itens errado força o redesenho`,
        y.cartoes === esperados && y.itens === '99', 'cartões ' + y.cartoes + ', itens ' + y.itens);
      verificar(`com JS (${pagina}): o cartão desenhado é o mesmo que o gerado`,
        JSON.stringify(y.lidos) === gerados, 'desenhado: ' + JSON.stringify(y.lidos).slice(0, 260));
      fs.writeFileSync(ficheiro, antes);
    }

    // Com JavaScript os filtros voltam a aparecer.
    gp = await testarMedia(browser, srv.url, 'galeria.html', true, 1440);
    verificar('com JS (galeria): os filtros aparecem e há um por categoria',
      gp.filtrosVisiveis === gp.filtros && gp.filtros > 1, 'filtros ' + gp.filtros);
    gi = await testarMedia(browser, srv.url, 'index.html', true, 1440);
    verificar('com JS (inicial): o botão "Ver mais" aparece quando há mais do que 6',
      gi.botaoMais === (galPub.length > 6), 'botão ' + gi.botaoMais);

    console.log('\ngaleria e vídeos: lightbox e teclado');
    // Enter abre a lightbox e o foco vai para o botão de fechar.
    let k = await testarMedia(browser, srv.url, 'galeria.html', true, 1440,
      { teclado: '#galeriaGrid .galeria-item', tecla: 'Enter' });
    verificar('lightbox: Enter abre e o foco vai para o botão de fechar',
      k.caixaAberta && k.focado === 'lbClose', 'aberta=' + k.caixaAberta + ' foco=' + k.focado);
    verificar('lightbox: mostra o título e o contador da fotografia',
      k.lbTitulo !== '' && /^1 \/ /.test(k.lbContador), k.lbTitulo + ' | ' + k.lbContador);
    // O espaço abre e não faz scroll.
    k = await testarMedia(browser, srv.url, 'galeria.html', true, 1440,
      { teclado: '#galeriaGrid .galeria-item', tecla: ' ' });
    verificar('lightbox: o espaço abre a caixa e não faz scroll na página',
      k.caixaAberta && k.scrollDepois === k.scrollAntes,
      'scroll ' + k.scrollAntes + ' → ' + k.scrollDepois);
    // Tab não sai da caixa.
    k = await testarMedia(browser, srv.url, 'galeria.html', true, 1440,
      { teclado: '#galeriaGrid .galeria-item', tecla: 'Enter', tab: true });
    verificar('lightbox: o Tab não sai da caixa', k.focoDentroDaCaixa, 'foco=' + k.focado);
    // Escape fecha e devolve o foco ao cartão.
    k = await testarMedia(browser, srv.url, 'galeria.html', true, 1440,
      { teclado: '#galeriaGrid .galeria-item', tecla: 'Enter', escape: true });
    verificar('lightbox: Escape fecha e o foco volta ao cartão que a abriu',
      !k.caixaAberta && /^Ver foto: /.test(k.focado), 'aberta=' + k.caixaAberta + ' foco=' + k.focado);
    // A seta navega.
    k = await testarMedia(browser, srv.url, 'galeria.html', true, 1440,
      { teclado: '#galeriaGrid .galeria-item', tecla: 'Enter', seta: 'ArrowRight' });
    verificar('lightbox: a seta direita avança para a fotografia seguinte',
      /^2 \/ /.test(k.lbContador), 'contador ' + k.lbContador);

    // O modal do vídeo: o iframe recebe só um embed do id validado.
    let mv2 = await testarMedia(browser, srv.url, 'videos.html', true, 1440,
      { clicar: '#videosGrid .video-card' });
    verificar('modal do vídeo: abre e o foco vai para o botão de fechar',
      mv2.caixaAberta && mv2.focado === 'vmClose', 'aberta=' + mv2.caixaAberta + ' foco=' + mv2.focado);
    verificar('modal do vídeo: o src do iframe é um embed do id validado',
      /^https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]{11}\?/.test(mv2.iframeSrc || ''),
      String(mv2.iframeSrc));
    verificar('modal do vídeo: o title do iframe é o título do vídeo',
      mv2.iframeTitle === 'TESTE VIDEO COMPLETO', String(mv2.iframeTitle));
    verificar('modal do vídeo: mantém loading lazy, allow e allowfullscreen',
      mv2.iframeLazy === 'lazy' && /autoplay/.test(mv2.iframeAllow || '') && mv2.iframeFull === true);
    mv2 = await testarMedia(browser, srv.url, 'videos.html', true, 1440,
      { teclado: '#videosGrid .video-card', tecla: 'Enter', escape: true });
    verificar('modal do vídeo: Escape fecha e o foco volta ao cartão',
      !mv2.caixaAberta && /video-card/.test(mv2.focado), 'foco=' + mv2.focado);
    verificar('modal do vídeo: o src do iframe é limpo ao fechar, e a reprodução pára',
      mv2.iframeSrc === '' || mv2.iframeSrc === null, String(mv2.iframeSrc));

    console.log('\ngaleria e vídeos: painel');
    const adm7 = await testarAdminMedia(browser, srv.url);
    verificar('painel: o aviso sobre dados pessoais de menores está no modal da fotografia',
      adm7.fotoAviso === true);
    verificar('painel: a fotografia tem caixa de publicado, marcada por omissão',
      adm7.fotoAtivo === true && adm7.fotoAtivoMarcado === true);
    verificar('painel: o vídeo tem caixa de publicado, marcada por omissão',
      adm7.videoAtivo === true && adm7.videoAtivoMarcado === true);
    verificar('painel: o limite de upload anunciado é o que a validação aplica',
      adm7.limites.length > 0 && adm7.limites.every((l) => l === adm7.limiteReal),
      'anunciado ' + adm7.limites.join('/') + ', aplicado ' + adm7.limiteReal);
    verificar('painel: o id do YouTube vem do ajudante partilhado',
      adm7.ytPartilhado === true);
    verificar('painel: sem exceções', adm7.erros.length === 0, adm7.erros.join(' | '));


    // Os dois números sem fonte não aparecem na faixa da página inicial, e não
    // sobra cartão vazio no lugar deles.
    console.log('\npágina inicial: faixa de estatísticas');
    for (const comJs of [false, true]) {
      const e = await testarEstatisticas(browser, srv.url, comJs);
      const q = comJs ? 'com' : 'sem';
      verificar(`estatísticas (${q} JS): nem "300+ Atletas" nem "80+ Títulos"`,
        !/300\+/.test(e.barra) && !/80\+/.test(e.barra)
        && !/Atletas Formados/.test(e.barra),
        'barra: ' + JSON.stringify(e.barra));
      verificar(`estatísticas (${q} JS): nenhum cartão vazio na barra`,
        e.vazios === 0, e.vazios + ' cartões visíveis sem número ou sem etiqueta');
      verificar(`estatísticas (${q} JS): ficam os dois com fonte, e só esses`,
        e.visiveis === 2
        && e.conteudo.some((c) => /Escalões/.test(c))
        && e.conteudo.some((c) => /Anos de história/.test(c)),
        e.visiveis + ' visíveis: ' + JSON.stringify(e.conteudo));
      verificar(`estatísticas (${q} JS): os quatro lugares continuam no HTML`,
        e.total === 4, 'os lugares ficam administráveis: ' + e.total);
      verificar(`estatísticas (${q} JS): sem erros de consola`,
        e.erros.length === 0, e.erros.join(' | '));
    }
    // Com um valor guardado no painel, o lugar volta a aparecer — a capacidade
    // administrável não se perdeu ao retirar o número.
    {
      escreverDados(raiz, { ...dados,
        siteConfig: { ...(dados.siteConfig || {}), stat1Num: '12', stat1Label: 'Equipas' } });
      const e = await testarEstatisticas(browser, srv.url, true);
      verificar('estatísticas: um valor guardado no painel faz o lugar aparecer',
        e.visiveis === 3 && e.conteudo.some((c) => /12 ?Equipas/.test(c)),
        e.visiveis + ' visíveis: ' + JSON.stringify(e.conteudo));
      verificar('estatísticas: e não traz de volta nenhum dos dois retirados',
        !/300\+/.test(e.barra) && !/80\+/.test(e.barra), 'barra: ' + JSON.stringify(e.barra));
      escreverDados(raiz, dados);
      gerar(raiz);
    }

    // ---- 6f. Bloco 9: institucional e SEO -----------------------
    // O rodapé estava copiado em 17 páginas com os contactos escritos à mão, o
    // ano do copyright fixo (16 diziam 2026 e a atleta.html 2024), 54 ligações
    // href="#", e os dados estruturados existiam só com JavaScript, com 14 das
    // 15 propriedades escritas à mão.
    console.log('\nrodapé institucional: sem JavaScript');
    {
      const i = await testarInstitucional(browser, srv.url, 'index.html', false, 1440);

      // Contactos da fonte única, e a morada com o <br> a valer como salto.
      verificar('rodapé: a morada vem do painel, com o <br> a valer como salto de linha',
        /TESTE RUA 16<br>1234-567 TESTE LOCALIDADE, Portugal/.test(i.rodapeMoradaHtml || '')
        && !/&lt;br/.test(i.rodapeMoradaHtml || '')
        && !/<br\s*\/?>/.test(i.rodapeMoradaTexto || ''),
        'html: ' + JSON.stringify(i.rodapeMoradaHtml));
      verificar('rodapé: o telefone e o e-mail vêm do painel',
        (i.rodapeTelefone || '').includes('+351 000 000 001')
        && (i.rodapeEmail || '').includes('teste@exemplo.invalid'),
        i.rodapeTelefone + ' / ' + i.rodapeEmail);

      // O nome do clube e o ano, da fonte única, com escape.
      // O ano é o da PUBLICAÇÃO, não o de hoje: é a data do conteúdo publicado
      // que manda, e a fixture publica em 2020. Era exactamente este o defeito
      // do ficheiro antigo — um ano escrito à mão que nunca acompanhava nada.
      const anoDaFixture = String(dados.publicadoEm || '').slice(0, 4);
      verificar('rodapé: o ano é o da publicação, e não um ano escrito à mão',
        i.rodapeCopyright.includes('© ' + anoDaFixture)
        && !/2024|2026/.test(i.rodapeCopyright),
        'esperava ' + anoDaFixture + ' em ' + JSON.stringify(i.rodapeCopyright));
      verificar('rodapé: o nome do clube aparece como texto, com o & e o <b> escapados',
        (i.rodapeCopyright || '').includes('TESTE CLUBE OFICIAL & <b>escape</b>'),
        JSON.stringify(i.rodapeCopyright));
      verificar('rodapé: nenhuma página diz 2024',
        !/2024/.test(i.rodapeCopyright || ''), JSON.stringify(i.rodapeCopyright));

      // Redes: duas válidas publicadas, a de javascript: recusada.
      verificar('rodapé: só as redes com endereço válido são escritas',
        i.sociaisTotal === 2, i.sociaisTotal + ' botões: ' + JSON.stringify(i.sociaisHrefs));
      verificar('rodapé: o endereço javascript: da rede social foi recusado',
        i.hrefsMaus.length === 0, JSON.stringify(i.hrefsMaus));
      verificar('rodapé: nenhuma ligação social com href="#"',
        i.sociaisMortas === 0, i.sociaisMortas + ' ligações sociais mortas');
      verificar('rodapé: as redes abrem noutro separador, com rel e nome acessível',
        i.sociaisRel.every((r) => /noopener/.test(r || ''))
        && i.sociaisNome.every((n) => !!n),
        JSON.stringify(i.sociaisRel) + ' / ' + JSON.stringify(i.sociaisNome));

      // JSON-LD sem JavaScript — era o principal buraco.
      verificar('JSON-LD: existe SEM JavaScript, e são dois',
        i.jsonldN === 2 && i.schemas.includes('SportsOrganization') && i.schemas.includes('WebSite'),
        JSON.stringify(i.schemas));
      verificar('JSON-LD: nenhuma propriedade vazia, em nenhum nível',
        i.jsonldVazias.length === 0, JSON.stringify(i.jsonldVazias));
      verificar('JSON-LD: o nome e a sigla vêm do dados_clube',
        i.org.name === 'TESTE CLUBE OFICIAL & <b>escape</b>'
        && i.org.alternateName === 'TESTE SIGLA',
        JSON.stringify(i.org.name) + ' / ' + JSON.stringify(i.org.alternateName));
      verificar('JSON-LD: o foundingDate vem do dados_clube.ano',
        i.org.foundingDate === '1999', String(i.org.foundingDate));
      verificar('JSON-LD: a morada vem do painel, partida em rua e código postal',
        i.org.address && i.org.address.streetAddress === 'TESTE RUA 16'
        && i.org.address.postalCode === '1234-567'
        && i.org.address.addressLocality === 'TESTE LOCALIDADE',
        JSON.stringify(i.org.address));
      verificar('JSON-LD: o telefone e o e-mail vêm do painel',
        i.org.contactPoint && i.org.contactPoint.telephone === '+351 000 000 001'
        && i.org.contactPoint.email === 'teste@exemplo.invalid',
        JSON.stringify(i.org.contactPoint));
      verificar('JSON-LD: o sameAs só tem as redes válidas',
        Array.isArray(i.org.sameAs) && i.org.sameAs.length === 2
        && !i.org.sameAs.some((u) => /javascript/i.test(u)),
        JSON.stringify(i.org.sameAs));

      // Segurança do herói, sem JavaScript o HTML já vem filtrado pela gravação.
      verificar('institucional: sem transbordo', i.transbordo <= 0, i.transbordo + 'px');
      verificar('institucional: sem erros de consola', i.erros.length === 0, i.erros.join(' | '));
    }

    console.log('\ninstitucional: com JavaScript');
    {
      const i = await testarInstitucional(browser, srv.url, 'index.html', true, 1440);
      verificar('JSON-LD: com JavaScript continuam a ser dois, sem duplicar',
        i.jsonldN === 2, i.jsonldN + ' blocos');
      verificar('JSON-LD: com JavaScript o conteúdo é o mesmo',
        i.org.name === 'TESTE CLUBE OFICIAL & <b>escape</b>'
        && i.org.foundingDate === '1999'
        && i.jsonldVazias.length === 0,
        JSON.stringify(i.jsonldVazias));
      verificar('rodapé: com JavaScript as redes continuam duas, sem href="#"',
        i.sociaisTotal === 2 && i.sociaisMortas === 0 && i.hrefsMaus.length === 0,
        i.sociaisTotal + ' / ' + i.sociaisMortas + ' / ' + JSON.stringify(i.hrefsMaus));
      verificar('contacto: os botões sociais da secção de contacto seguem a mesma regra',
        i.sociaisBotoesVisiveis === 2
        && !i.sociaisBotoesHrefs.some((h) => h === '#' || /^javascript:/i.test(h || '')),
        i.sociaisBotoesVisiveis + ' visíveis: ' + JSON.stringify(i.sociaisBotoesHrefs));

      // Segurança: nada do painel corre, e nada do painel injecta CSS.
      verificar('segurança: o <img onerror> do título do herói não corre',
        i.xss === false && !/onerror/i.test(i.heroTitleHtml || ''),
        JSON.stringify((i.heroTitleHtml || '').slice(0, 100)));
      verificar('segurança: o título do herói mantém o <br> e o <span> permitidos',
        /<br>/.test(i.heroTitleHtml || '') && /<span>/.test(i.heroTitleHtml || ''),
        JSON.stringify((i.heroTitleHtml || '').slice(0, 100)));
      verificar('segurança: o endereço javascript: do botão do herói foi recusado',
        !/javascript:/i.test(i.heroBt2 || ''), JSON.stringify(i.heroBt2));
      verificar('segurança: o endereço válido do outro botão passou',
        (i.heroBt1 || '').includes('inscricao.html'), JSON.stringify(i.heroBt1));
      verificar('segurança: a imagem do herói com apóstrofo e parêntesis resolve',
        /url\("[^"]*logo\.png/.test(i.heroBgComputado || ''),
        JSON.stringify((i.heroBgComputado || '').slice(0, 140)));
      verificar('segurança: o heroOverlay fora de formato não injecta CSS no gradiente',
        !/rgb\(0, 0, 255\)/.test(i.heroBg || ''), JSON.stringify((i.heroBg || '').slice(0, 140)));
      verificar('segurança: o heroImgPos fora de formato cai no valor por omissão',
        i.heroPos === '50% 50%, 50% 50%' || i.heroPos === '50% 50%', String(i.heroPos));
      verificar('institucional com JS: sem erros de consola',
        i.erros.length === 0, i.erros.join(' | '));
    }

    // O seoTitle da página inicial NÃO pode mexer nas outras.
    console.log('\nSEO: o título da página inicial não contamina as outras');
    {
      const inicial = await testarInstitucional(browser, srv.url, 'index.html', true, 1440);
      verificar('SEO: na página inicial o título do painel é aplicado',
        inicial.titulo === 'TESTE SEO TITULO DA INICIAL'
        && inicial.desc === 'TESTE SEO DESCRICAO DA INICIAL',
        JSON.stringify(inicial.titulo));
      for (const pagina of ['historia.html', 'noticias.html', 'contacto.html',
                            'formacao.html', 'galeria.html', 'videos.html',
                            'patrocinadores.html', 'privacidade.html', 'resultados.html',
                            'agenda.html', 'equipa-principal.html', 'pesquisa.html']) {
        const o = await testarInstitucional(browser, srv.url, pagina, true, 1440);
        verificar(`SEO: ${pagina} mantém o seu título e a sua descrição`,
          o.titulo !== 'TESTE SEO TITULO DA INICIAL'
          && o.desc !== 'TESTE SEO DESCRICAO DA INICIAL'
          && o.titulo.includes('Campinense'),
          'título: ' + JSON.stringify(o.titulo));
      }
    }

    // og:url igual ao canonical, e um h1 por página.
    console.log('\nSEO: canonical, og:url e h1');
    {
      for (const pagina of ['index.html', 'historia.html', 'noticias.html', 'contacto.html',
                            'formacao.html', 'privacidade.html', 'pesquisa.html']) {
        const o = await testarInstitucional(browser, srv.url, pagina, false, 1440);
        verificar(`SEO: ${pagina} tem og:url igual ao canonical`,
          !!o.canonical && o.ogUrl === o.canonical,
          'canonical=' + o.canonical + ' og:url=' + o.ogUrl);
        verificar(`SEO: ${pagina} tem exactamente um h1`, o.h1n === 1, String(o.h1n));
      }
      const pq = await testarInstitucional(browser, srv.url, 'pesquisa.html', false, 1440);
      verificar('SEO: a pesquisa tem noindex, follow',
        pq.robots === 'noindex, follow', String(pq.robots));
    }

    // O número de escalões passou a 8, por confirmação do clube.
    {
      const i = await testarInstitucional(browser, srv.url, 'index.html', false, 1440);
      verificar('estatísticas: os escalões dizem 8',
        i.stats.some((t) => /^8 ?Escalões/.test(t)), JSON.stringify(i.stats));
      verificar('estatísticas: continuam sem 80+ Títulos e sem 300+ Atletas',
        !/80\+/.test(i.textoTodo) && !/300\+/.test(i.textoTodo));
    }

    // As duas datas do texto legal saíram.
    {
      const pr = await testarInstitucional(browser, srv.url, 'privacidade.html', false, 1440);
      verificar('legal: as duas datas de "Última atualização" saíram',
        !/Última atualização/i.test(pr.textoTodo), 'sem data, por decisão do clube');
    }

    // Sitemap gerado.
    console.log('\nsitemap e robots');
    {
      const sm = fs.readFileSync(path.join(raiz, 'sitemap.xml'), 'utf8');
      const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      const mods = new Set([...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]));
      // 13 páginas, mais uma entrada por notícia publicada (Bloco 10). As
      // notícias passaram a ser endereços a sério: o api/noticia.php responde a
      // cada uma com o seu artigo, o seu título e a sua descrição.
      const publicadas = dados.noticias.filter(
        (n) => n.publicada || (n.scheduledAt && n.scheduledAt <= new Date().toISOString()));
      const locsNot = locs.filter((l) => /\?id=\d+$/.test(l));
      verificar(`sitemap: ${13 + publicadas.length} entradas (13 páginas + ${publicadas.length} notícias), todas em https://campinense.pt`,
        locs.length === 13 + publicadas.length
        && locs.every((l) => l.startsWith('https://campinense.pt')),
        locs.length + ' entradas, ' + locsNot.length + ' de notícias');
      verificar('sitemap: cada notícia publicada entra uma vez, e só essas',
        locsNot.length === publicadas.length
        && publicadas.every((n) => locs.includes('https://campinense.pt/noticias.html?id=' + n.id))
        && !locs.includes('https://campinense.pt/noticias.html?id=1004')
        && !locs.includes('https://campinense.pt/noticias.html?id=1022'),
        JSON.stringify(locsNot.slice(0, 4)));
      // As 13 páginas levam a data da publicação; cada notícia leva a sua. O
      // 2026-07-01 escrito à mão não volta por via nenhuma.
      const modPaginas = [...sm.matchAll(/<loc>[^<]*<\/loc>\s*<lastmod>([^<]+)</g)]
        .filter((m, i) => i < 13).map((m) => m[1]);
      verificar('sitemap: as 13 páginas levam a data desta publicação, e não o 2026-07-01 escrito à mão',
        new Set(modPaginas).size === 1 && !mods.has('2026-07-01'),
        JSON.stringify([...new Set(modPaginas)]));
      verificar('sitemap: o lastmod de cada notícia é a data da notícia',
        publicadas.every((n) => new RegExp(
          '<loc>https://campinense\\.pt/noticias\\.html\\?id=' + n.id
          + '</loc>\\s*<lastmod>' + n.data + '</lastmod>').test(sm)),
        JSON.stringify([...mods].slice(0, 5)));
      const proibidos = ['/admin', '/api/', '/modelos/', '/manutencao.html', '/offline.html',
                         '/404.html', '/pesquisa.html', '/atleta.html',
                         '/modalidade.html', '/escalao.html']
        .filter((x) => sm.includes(x));
      verificar('sitemap: não inclui admin, api, modelos, manutenção, offline, 404, pesquisa, atleta, modalidade nem escalão',
        proibidos.length === 0, 'encontrados: ' + proibidos.join(', '));
      const rb = fs.readFileSync(path.join(raiz, 'robots.txt'), 'utf8');
      verificar('robots: cobre o scraper e a documentação interna',
        /Disallow: \/scraper\//.test(rb) && /Disallow: \/AUDITORIA\.md/.test(rb)
        && /Sitemap: https:\/\/campinense\.pt\/sitemap\.xml/.test(rb));
      verificar('robots: não bloqueia a pesquisa, para o motor poder ler o noindex',
        !/Disallow: \/pesquisa\.html/.test(rb));
    }

    // Base institucional vazia: nada de elementos, ligações ou propriedades vazias.
    console.log('\ninstitucional: base vazia');
    {
      escreverDados(raiz, { ...dados, dadosClube: {}, siteConfig: { homepageNewsCount: 3 } });
      gerar(raiz);
      for (const comJs of [false, true]) {
        const i = await testarInstitucional(browser, srv.url, 'index.html', comJs, 1024);
        const q = comJs ? 'com' : 'sem';
        verificar(`vazio (${q} JS): nenhum botão de rede social, e nenhum morto`,
          i.sociaisTotal === 0 && i.sociaisMortas === 0 && i.sociaisBotoesVisiveis === 0,
          i.sociaisTotal + ' no rodapé, ' + i.sociaisBotoesVisiveis + ' no contacto, '
          + i.sociaisMortas + ' com href="#"');
        verificar(`vazio (${q} JS): nenhuma linha de contacto`,
          i.rodapeMoradaHtml === null && i.rodapeTelefone === null && i.rodapeEmail === null,
          JSON.stringify([i.rodapeMoradaHtml, i.rodapeTelefone, i.rodapeEmail]));
        verificar(`vazio (${q} JS): o JSON-LD não tem propriedades vazias`,
          i.jsonldVazias.length === 0 && i.jsonldN === 2, JSON.stringify(i.jsonldVazias));
        verificar(`vazio (${q} JS): sem nome guardado o JSON-LD sai sem name`,
          i.org.name === undefined, String(i.org.name));
        verificar(`vazio (${q} JS): sem ano guardado não há foundingDate`,
          i.org.foundingDate === undefined, String(i.org.foundingDate));
        verificar(`vazio (${q} JS): sem morada guardada não há address`,
          i.org.address === undefined);
        verificar(`vazio (${q} JS): sem contactos não há contactPoint nem sameAs`,
          i.org.contactPoint === undefined && i.org.sameAs === undefined);
        verificar(`vazio (${q} JS): a linha de direitos existe, sem inventar nome`,
          /Todos os direitos reservados/.test(i.rodapeCopyright || '')
          && !/TESTE CLUBE/.test(i.rodapeCopyright || ''),
          JSON.stringify(i.rodapeCopyright));
        verificar(`vazio (${q} JS): sem transbordo`, i.transbordo <= 0, i.transbordo + 'px');
      }
      escreverDados(raiz, dados);
      gerar(raiz);
    }

    // As sete larguras, com o rodapé gerado.
    console.log('\ninstitucional: sete larguras');
    for (const largura of [320, 375, 390, 430, 768, 1024, 1440]) {
      const i = await testarInstitucional(browser, srv.url, 'index.html', true, largura);
      verificar(`institucional a ${largura}px: sem transbordo e com o rodapé de pé`,
        i.transbordo <= 0 && i.sociaisTotal === 2 && i.jsonldN === 2,
        `transbordo ${i.transbordo}px, ${i.sociaisTotal} redes, ${i.jsonldN} schemas`);
    }

    // ---- 6e. Bloco 8: História ----------------------------------
    // Os 22 marcos e os 16 títulos da história do clube desapareciam sem
    // JavaScript, atrás de dois "A carregar..." permanentes. A fixture tem 14
    // marcos e 10 títulos, feitos para medir cada regra.
    console.log('\nhistória: cronologia e palmarés sem JavaScript');
    {
      const h = await testarHistoria(browser, srv.url, false, 1440);

      // Publicáveis: 14 marcos menos o inativo, os dois sem título = 11.
      verificar('cronologia: 11 marcos dos 14 registos',
        h.marcos === 11, 'obtive ' + h.marcos);
      verificar('cronologia: os marcos vêem-se sem JavaScript',
        h.marcosVisiveis === 11, 'visíveis: ' + h.marcosVisiveis);
      verificar('cronologia: nenhum "A carregar" ficou na página',
        h.temCarregar === false);
      verificar('cronologia: um <h3> por marco',
        h.h3 === 11, 'obtive ' + h.h3);
      verificar('cronologia: o data-itens declara os marcos gerados',
        h.tlItens === '11', String(h.tlItens));
      verificar('cronologia: sem estado vazio quando há marcos',
        h.tlVazio === false);

      // Ordenação crescente, com o desempate estável nos dois de 1990, e os
      // dois sem ano utilizável no fim, sem elemento de ano.
      verificar('cronologia: ano crescente, apesar de o array vir desordenado',
        h.anos.join(' ') === '1947 1990 1990 2001 2002 2003 2004 2005 2009',
        'anos: ' + h.anos.join(' '));
      verificar('cronologia: dois marcos do mesmo ano mantêm a ordem do array',
        h.titulos.indexOf('TESTE MARCO A MESMO ANO') < h.titulos.indexOf('TESTE MARCO B MESMO ANO'));
      verificar('cronologia: os marcos sem ano utilizável ficam no fim, sem ano',
        h.titulos[h.titulos.length - 2] === 'TESTE MARCO SEM ANO'
        && h.titulos[h.titulos.length - 1] === 'TESTE MARCO ANO EM TEXTO'
        && h.anos.length === 9,
        'últimos: ' + h.titulos.slice(-2).join(' | ') + ' · anos: ' + h.anos.length);
      verificar('cronologia: o ano do telemóvel acompanha o ano do ecrã grande',
        h.anosMovel.join(' ') === h.anos.join(' '));

      // Campos opcionais vazios não produzem elementos vazios.
      verificar('cronologia: marco mínimo aparece só com ano e título',
        h.titulos.includes('TESTE MARCO MINIMO'));
      // Dos 11 publicados, quatro não têm descrição: três com o campo vazio e
      // o marco mínimo, que não tem o campo.
      verificar('cronologia: descrição vazia não produz parágrafo',
        h.descricoes === 7, 'obtive ' + h.descricoes);
      verificar('cronologia: só o marco em destaque leva a marca de destaque',
        h.destaques === 1, 'obtive ' + h.destaques);

      // ativo
      verificar('cronologia: o marco sem o campo ativo é publicado',
        h.titulos.includes('TESTE MARCO SEM CAMPO ATIVO'));
      verificar('cronologia: o marco inativo não aparece',
        !h.textoTodo.includes('TESTE MARCO NAO PUBLICADO'));
      verificar('cronologia: o marco sem título não aparece',
        !h.textoTodo.includes('Sem título, não vai para a página')
        && !h.textoTodo.includes('Só espaços no título'));

      // Imagens: decorativas, sem src="" e a resolver no browser.
      verificar('cronologia: uma imagem, e é decorativa',
        h.imagens.length === 1 && h.imagens[0].alt === ''
        && h.imagens[0].ariaHidden === 'true',
        JSON.stringify(h.imagens));
      verificar('cronologia: a imagem com apóstrofo e parêntesis resolve no browser',
        h.imagens[0] && h.imagens[0].completa === true,
        'resolvida: ' + (h.imagens[0] || {}).resolvida);
      verificar('cronologia: nenhuma imagem recusada produz src=""',
        h.imgSemSrc === 0, 'obtive ' + h.imgSemSrc + ' imagens sem src');
      verificar('cronologia: os dois marcos de imagem recusada saem sem <img>',
        h.titulos.includes('TESTE MARCO IMAGEM JAVASCRIPT')
        && h.titulos.includes('TESTE MARCO IMAGEM DATA')
        && h.imagens.length === 1);

      // Escape
      verificar('cronologia: o título com & e <b> aparece como texto',
        h.titulos.includes('TESTE MARCO C & <b>escape</b>'),
        JSON.stringify(h.titulos.filter((t) => t.includes('escape'))));

      // ---- Palmarés ----
      // Publicáveis: 10 menos o inativo e o sem competição = 8.
      verificar('palmarés: 8 títulos dos 10 registos',
        h.cartoes === 8, 'obtive ' + h.cartoes);
      verificar('palmarés: os cartões vêem-se sem JavaScript',
        h.cartoesVisiveis === 8, 'visíveis: ' + h.cartoesVisiveis);
      verificar('palmarés: o data-itens declara os títulos gerados',
        h.pmItens === '8', String(h.pmItens));
      verificar('palmarés: ano DECRESCENTE, e não a ordem do array',
        h.competicoes[0] === 'TESTE TITULO MAIS RECENTE'
        && h.competicoes[h.competicoes.length - 2] === 'TESTE TITULO MAIS ANTIGO',
        'primeiro: ' + h.competicoes[0] + ' · penúltimo: ' + h.competicoes[h.competicoes.length - 2]);
      verificar('palmarés: dois títulos do mesmo ano mantêm a ordem do array',
        h.competicoes.indexOf('TESTE TITULO A MESMO ANO') < h.competicoes.indexOf('TESTE TITULO B MESMO ANO'));
      verificar('palmarés: o título sem ano fica no fim',
        h.competicoes[h.competicoes.length - 1] === 'TESTE TITULO SEM ANO',
        'último: ' + h.competicoes[h.competicoes.length - 1]);
      verificar('palmarés: o título sem o campo ativo é publicado',
        h.competicoes.includes('TESTE TITULO SEM CAMPO ATIVO'));
      verificar('palmarés: o título inativo não aparece',
        !h.textoTodo.includes('TESTE TITULO NAO PUBLICADO'));
      verificar('palmarés: o título sem competição não aparece',
        h.escaloes.indexOf('Sub-13') === -1, 'escalões: ' + h.escaloes.join(' | '));
      verificar('palmarés: o escalão de texto livre não se perde',
        h.escaloes.includes('Traquinas A') && h.escaloes.includes('Sen. Femininos')
        && h.escaloes.includes('Nome Do Atleta Teste'),
        'escalões: ' + h.escaloes.join(' | '));
      verificar('palmarés: escalão vazio não produz etiqueta vazia',
        h.escaloes.every((e) => e !== ''), 'escalões: ' + JSON.stringify(h.escaloes));
      verificar('palmarés: a observação com & e <b> aparece como texto',
        h.metas.some((m) => m.includes('Observação com & e <i>etiquetas</i>')),
        JSON.stringify(h.metas));
      verificar('palmarés: sem observação a meta é só o ano',
        h.metas.includes('2020') || h.metas.includes('2022'),
        JSON.stringify(h.metas));

      // Estrutura e acessibilidade
      verificar('história: um h1 e os dois h2 das secções',
        h.h1.length === 1 && h.h2.includes('Linha do Tempo') && h.h2.includes('Palmarés'));
      verificar('história: sem JavaScript o CSS não esconde nada',
        h.anima === false && h.naoRevelados === 0
        && h.opacidades.every((o) => o === '1'), 'opacidades: ' + h.opacidades.join(' '));
      verificar('história: a faixa de estatísticas sem fonte não existe',
        h.temFaixa === false && h.temHStat === false);
      verificar('história: nenhum número sem fonte na página',
        h.temTitulos80 === false && h.temAtletas300 === false && h.temSeculo === false);
      verificar('história: sem transbordo', h.transbordo <= 0, h.transbordo + 'px');
      verificar('história: sem erros de consola', h.erros.length === 0, h.erros.join(' | '));
    }

    console.log('\nhistória: com JavaScript');
    {
      const h = await testarHistoria(browser, srv.url, true, 1440);
      verificar('história: com JavaScript o número de itens é o mesmo',
        h.marcos === 11 && h.cartoes === 8, h.marcos + ' marcos, ' + h.cartoes + ' títulos');
      verificar('história: com JavaScript a ordem é a mesma',
        h.anos.join(' ') === '1947 1990 1990 2001 2002 2003 2004 2005 2009'
        && h.competicoes[0] === 'TESTE TITULO MAIS RECENTE',
        'anos: ' + h.anos.join(' '));
      // A revelação liga-se (html.jsc-anima) e revela o que entra no ecrã. O
      // que se exige não é que todos os 19 itens fiquem marcados — isso
      // depende da cadência do IntersectionObserver — mas que nada fique
      // invisível estando visível na janela. É essa a falha que o visitante
      // notaria.
      verificar('história: a revelação liga-se e nada fica invisível estando no ecrã',
        h.anima === true && h.invisiveisNoEcra === 0,
        'anima=' + h.anima + ', invisíveis no ecrã: ' + h.invisiveisNoEcra
        + ', detalhe: ' + JSON.stringify(h.detalheInvisiveis));
      verificar('história: a revelação chegou a marcar itens como revelados',
        h.naoRevelados < h.marcos + h.cartoes,
        'nenhum dos ' + (h.marcos + h.cartoes) + ' foi revelado');
      verificar('história: com JavaScript continua sem números sem fonte',
        h.temTitulos80 === false && h.temAtletas300 === false);
      verificar('história: com JavaScript sem erros de consola',
        h.erros.length === 0, h.erros.join(' | '));
    }

    // O bloco gerado e atual não é redesenhado; um data-itens errado força o
    // redesenho, e o que sai é o MESMO.
    {
      const his = path.join(raiz, 'historia.html');
      const geradoTl = dentroDasMarcas(fs.readFileSync(his, 'utf8'), 'historia.html', 'historia');
      const geradoPm = dentroDasMarcas(fs.readFileSync(his, 'utf8'), 'historia.html', 'palmares');
      fs.writeFileSync(his, fs.readFileSync(his, 'utf8')
        .replace(/(id="historiaTimeline"[^>]*data-itens=")\d+/, '$199')
        .replace(/(id="historiaPalmares"[^>]*data-itens=")\d+/, '$199'));
      const h = await testarHistoria(browser, srv.url, true, 1440);
      verificar('história: data-itens errado força o redesenho e dá o mesmo resultado',
        h.marcos === 11 && h.cartoes === 8
        && h.anos.join(' ') === '1947 1990 1990 2001 2002 2003 2004 2005 2009'
        && h.competicoes[0] === 'TESTE TITULO MAIS RECENTE',
        h.marcos + ' marcos, ' + h.cartoes + ' títulos');
      fs.writeFileSync(his, fs.readFileSync(his, 'utf8')
        .replace(/(id="historiaTimeline"[^>]*data-itens=")99/, '$111')
        .replace(/(id="historiaPalmares"[^>]*data-itens=")99/, '$18'));
      // Byte a byte: o que o JavaScript desenha não pode diferir do gerado.
      verificar('história: as regiões voltaram ao que o servidor gerou',
        dentroDasMarcas(fs.readFileSync(his, 'utf8'), 'historia.html', 'historia') === geradoTl
        && dentroDasMarcas(fs.readFileSync(his, 'utf8'), 'historia.html', 'palmares') === geradoPm);
    }

    // Impressão: o que está escrito sai no papel. Era o pior caso da
    // revelação — o que o visitante não tivesse percorrido saía em branco.
    {
      const h = await testarHistoria(browser, srv.url, true, 1024,
        { imprimir: true, semRolar: true });
      verificar('história: na impressão nenhum marco fica escondido pela animação',
        h.marcos === 11 && h.invisiveisNoEcra === 0
        && h.opacidades.every((o) => o === '1'),
        'opacidades: ' + h.opacidades.join(' ') + ', invisíveis: ' + h.invisiveisNoEcra);
    }
    // prefers-reduced-motion: a revelação deixa de esconder.
    {
      const h = await testarHistoria(browser, srv.url, true, 1024,
        { movimentoReduzido: true, semRolar: true });
      verificar('história: com movimento reduzido nada fica invisível',
        h.marcos === 11 && h.invisiveisNoEcra === 0
        && h.opacidades.every((o) => o === '1'),
        'opacidades: ' + h.opacidades.join(' ') + ', invisíveis: ' + h.invisiveisNoEcra);
    }

    // As sete larguras, nas duas zonas.
    console.log('\nhistória: sete larguras');
    for (const largura of [320, 375, 390, 430, 768, 1024, 1440]) {
      const h = await testarHistoria(browser, srv.url, true, largura);
      verificar(`história a ${largura}px: sem transbordo e com tudo lá`,
        h.transbordo <= 0 && h.marcos === 11 && h.cartoes === 8,
        `transbordo ${h.transbordo}px, ${h.marcos} marcos, ${h.cartoes} títulos`);
    }

    // Base vazia: estado vazio honesto, e nenhuma das três cópias de volta.
    console.log('\nhistória: base vazia');
    {
      escreverDados(raiz, { ...dados, historia: [], palmares: [] });
      gerar(raiz);
      for (const comJs of [false, true]) {
        const h = await testarHistoria(browser, srv.url, comJs, 1024);
        verificar(`história sem dados (${comJs ? 'com' : 'sem'} JS): nenhum marco nem título`,
          h.marcos === 0 && h.cartoes === 0, h.marcos + ' / ' + h.cartoes);
        verificar(`história sem dados (${comJs ? 'com' : 'sem'} JS): os dois estados vazios aparecem`,
          h.tlVazio === true && h.pmVazio === true);
        verificar(`história sem dados (${comJs ? 'com' : 'sem'} JS): nenhum dos 38 factos volta`,
          !/Fundação do Clube|Pedro Correia Bota|III Divisão Nacional|Medalha Municipal/.test(h.textoTodo),
          'as três cópias antigas não podem reaparecer como fallback');
        verificar(`história sem dados (${comJs ? 'com' : 'sem'} JS): sem transbordo`,
          h.transbordo <= 0, h.transbordo + 'px');
      }
      // Todos inativos dá o mesmo que base vazia.
      escreverDados(raiz, {
        ...dados,
        historia: (dados.historia || []).map((h) => ({ ...h, ativo: false })),
        palmares: (dados.palmares || []).map((t) => ({ ...t, ativo: false })),
      });
      gerar(raiz);
      const h = await testarHistoria(browser, srv.url, false, 1024);
      verificar('história com tudo inativo: nada publicado e os estados vazios visíveis',
        h.marcos === 0 && h.cartoes === 0 && h.tlVazio === true && h.pmVazio === true);
      escreverDados(raiz, dados);
      gerar(raiz);
    }

    console.log('\nhistória: painel');
    {
      const a8 = await testarAdminHistoria(browser, srv.url);
      verificar('painel: a semente da história vem do DB, e é a única',
        a8.sementeDoDB === true && a8.sementeMarcos === 22 && a8.sementeTitulos === 16,
        a8.sementeMarcos + ' marcos, ' + a8.sementeTitulos + ' títulos');
      verificar('painel: a designação do torneio foi uniformizada',
        a8.sementeSemLaranjeira === true && a8.sementeComFaisca === true);
      verificar('painel: a subida dos Juvenis de 2025 diz 1.ª Divisão Distrital',
        a8.sementeJuvenis2025 === true);
      verificar('painel: o Boxe de 1994 continua na história',
        a8.sementeBoxe1994 === true);
      verificar('painel: o Ténis de Mesa de 2012 continua no palmarés',
        a8.sementeTenisMesa2012 === true);
      verificar('painel: nenhum acontecimento foi inventado para o id 8',
        a8.sementeSemId8 === true, 'o buraco fica como está');
      verificar('painel: o marco tem caixa de publicado, marcada por omissão',
        a8.marcoAtivo === true && a8.marcoAtivoMarcado === true);
      verificar('painel: o título tem caixa de publicado, marcada por omissão',
        a8.tituloAtivo === true && a8.tituloAtivoMarcado === true);
      verificar('painel: o escalão do palmarés é texto livre, não um <select>',
        a8.escalaoEtiqueta === 'INPUT', String(a8.escalaoEtiqueta));
      verificar('painel: editar um título NÃO perde o escalão "Traquinas A"',
        a8.escalaoPreservado === 'Traquinas A', String(a8.escalaoPreservado));
      verificar('painel: os valores em uso ficam como sugestão, não como imposição',
        a8.escalaoTemSugestoes === true);
      verificar('painel: existem os dois interruptores de publicar/despublicar',
        a8.temToggles === true);
      verificar('painel: sem exceções', a8.erros.length === 0, a8.erros.join(' | '));
    }

    // ---- 6c. Bloco 6: modalidades -------------------------------
    console.log('\nmodalidades: fonte única');
    const modAtivas = dados.modalidades.filter((m) => m.ativo !== false
      && String(m.nome || '').trim() !== '');

    for (const largura of [320, 375, 390, 430, 768, 1024, 1440]) {
      const x = await testarModalidades(browser, srv.url, false, largura);
      verificar(`sem JS a ${largura} px: ${modAtivas.length} cartões, todos visíveis`,
        x.cartoes === modAtivas.length && x.cartoesVisiveis === modAtivas.length,
        'cartões ' + x.cartoes + ', visíveis ' + x.cartoesVisiveis);
      verificar(`sem JS a ${largura} px: sem transbordo`, x.transbordo <= 0, '+' + x.transbordo + 'px');
    }

    let mm = await testarModalidades(browser, srv.url, false, 1440);
    verificar('sem JS: os nomes são os do painel, pela mesma ordem',
      JSON.stringify(mm.lidos.map((c) => c.nome)) === JSON.stringify(modAtivas.map((m) => m.nome.trim())),
      JSON.stringify(mm.lidos.map((c) => c.nome).slice(0, 4)));
    verificar('sem JS: a inativa e as sem nome não estão na página',
      !mm.texto.includes('NAO APARECE'));
    verificar('sem JS: nenhuma das três modalidades vem de um fallback',
      !/Kickboxing|Judo|Futsal/.test(mm.texto));
    verificar('sem JS: campo vazio não produz elemento',
      (function () {
        const c = mm.lidos.find((x) => x.nome === 'TESTE SO NOME');
        return c && c.descricao === null && c.itens === null && c.temStyle === false;
      })(), JSON.stringify(mm.lidos.find((x) => x.nome === 'TESTE SO NOME')));
    verificar('sem JS: nenhuma caixa de informação vazia', mm.caixasVazias === 0);
    verificar('sem JS: a modalidade completa tem os três itens, nesta ordem',
      (function () {
        const c = mm.lidos.find((x) => x.nome === 'TESTE MODALIDADE COMPLETA');
        return c && c.itens && c.itens.length === 3
          && /TESTE HORARIO/.test(c.itens[0]) && /TESTE LOCAL/.test(c.itens[1])
          && /TESTE RESPONSAVEL/.test(c.itens[2]);
      })(), JSON.stringify((mm.lidos.find((x) => x.nome === 'TESTE MODALIDADE COMPLETA') || {}).itens));
    verificar('sem JS: treinos, local e responsável sozinhos dão uma caixa de um item',
      ['TESTE SO TREINOS', 'TESTE SO LOCAL', 'TESTE SO RESPONSAVEL']
        .every((n) => ((mm.lidos.find((x) => x.nome === n) || {}).itens || []).length === 1));
    verificar('sem JS: o ícone aparece como texto, não como HTML',
      (function () {
        const c = mm.lidos.find((x) => x.nome === 'TESTE ICONE COM HTML');
        return c && c.icone === '<b>&x</b>' && !/<b>/.test(c.iconeHtml);
      })(), JSON.stringify(mm.lidos.find((x) => x.nome === 'TESTE ICONE COM HTML')));
    verificar('sem JS: todos os ícones são decorativos',
      mm.lidos.every((c) => c.iconeEscondido === 'true'));
    verificar('sem JS: a imagem problemática resolve no browser',
      (function () {
        const c = mm.lidos.find((x) => x.nome === 'TESTE MODALIDADE COMPLETA');
        return c && /^url\(/.test(c.fundo) && /%27/.test(c.fundo) && /%28/.test(c.fundo);
      })(), JSON.stringify((mm.lidos.find((x) => x.nome === 'TESTE MODALIDADE COMPLETA') || {}).fundo));
    verificar('sem JS: a imagem simples resolve',
      (function () {
        const c = mm.lidos.find((x) => x.nome === 'TESTE IMAGEM SIMPLES');
        return c && /logo\.png/.test(c.fundo);
      })());
    // Sem imagem fica o gradiente do CSS, que é o fundo de omissão da capa.
    // O que não pode existir é um url(...): não há imagem para carregar.
    verificar('sem JS: sem imagem não há url() no fundo, só o gradiente do CSS',
      (function () {
        const c = mm.lidos.find((x) => x.nome === 'TESTE SO NOME');
        return c && !/url\(/.test(c.fundo) && /gradient/.test(c.fundo);
      })(), JSON.stringify((mm.lidos.find((x) => x.nome === 'TESTE SO NOME') || {}).fundo));
    // O browser devolve a posição resolvida: top é 50% 0%, bottom é 50% 100%.
    verificar('sem JS: a imagemPos é respeitada pelo browser',
      (function () {
        const a = mm.lidos.find((x) => x.nome === 'TESTE MODALIDADE COMPLETA');
        const b = mm.lidos.find((x) => x.nome === 'TESTE IMAGEM SIMPLES');
        return a && b && a.fundoPos === '50% 0%' && b.fundoPos === '50% 100%';
      })(), JSON.stringify([(mm.lidos[0] || {}).fundoPos, (mm.lidos.find((x) => x.nome === 'TESTE IMAGEM SIMPLES') || {}).fundoPos]));
    verificar('sem JS: cada cartão tem uma ligação <a> a sério',
      mm.ligacoes === modAtivas.length
      && mm.lidos.every((c) => c.ligacaoTag === 'A' && /^modalidade\.html\?id=/.test(c.href)));
    verificar('sem JS: a ligação do id difícil volta a dar o id exacto',
      (function () {
        const c = mm.lidos.find((x) => x.nome === 'TESTE ID DIFICIL');
        return c && c.href === 'modalidade.html?id=609%20a%26b%2Fc' && c.idDoUrl === '609 a&b/c';
      })(), JSON.stringify(mm.lidos.find((x) => x.nome === 'TESTE ID DIFICIL')));
    verificar('sem JS: o URLSearchParams recupera todos os ids',
      mm.lidos.every((c) => c.idDoUrl !== null && c.idDoUrl !== ''));
    verificar('sem JS: nenhum contacto na grelha',
      !/telefone|email|contacto/i.test(mm.texto));
    verificar('sem JS: sem erros de rede', mm.erros.length === 0, mm.erros.join(' | '));

    // Com JavaScript: o bloco gerado e atual não é redesenhado, e quando é
    // redesenhado dá o mesmo cartão.
    {
      const fich = path.join(raiz, 'index.html');
      const antes = fs.readFileSync(fich, 'utf8');
      const ancora = '<h3 class="modality-card__name">TESTE SO NOME</h3>';
      fs.writeFileSync(fich, antes.replace(ancora, ancora + '<!--MARCA-->'));
      let y = await testarModalidades(browser, srv.url, true, 1440);
      verificar('com JS: o bloco gerado e atual não é redesenhado',
        fs.readFileSync(fich, 'utf8').includes('<!--MARCA-->') && y.cartoes === modAtivas.length);
      verificar('com JS: sem erros de consola', y.erros.length === 0, y.erros.join(' | '));
      const gerados = JSON.stringify(y.lidos);

      fs.writeFileSync(fich, fs.readFileSync(fich, 'utf8')
        .replace('data-itens="' + modAtivas.length + '"', 'data-itens="99"'));
      y = await testarModalidades(browser, srv.url, true, 1440);
      verificar('com JS: data-itens errado força o redesenho',
        y.cartoes === modAtivas.length && y.itens === '99');
      verificar('com JS: o cartão desenhado é o mesmo que o gerado',
        JSON.stringify(y.lidos) === gerados,
        'desenhado: ' + JSON.stringify(y.lidos).slice(0, 300));
      verificar('com JS: o ícone continua escapado depois do redesenho',
        (y.lidos.find((x) => x.nome === 'TESTE ICONE COM HTML') || {}).icone === '<b>&x</b>');
      verificar('com JS: nenhuma caixa de informação vazia depois do redesenho',
        y.caixasVazias === 0);
      fs.writeFileSync(fich, antes);
    }

    console.log('\nmodalidade.html: correcções pontuais');
    let pm = await testarPaginaModalidade(browser, srv.url, 601);
    verificar('modalidade: a modalidade ativa abre com o nome e a descrição',
      pm.nome === 'TESTE MODALIDADE COMPLETA' && pm.desc === 'TESTE DESCRICAO DA MODALIDADE');
    verificar('modalidade: a barra de informação e as publicações aparecem',
      pm.infoVisivel && pm.postsVisivel && pm.posts === 1);
    verificar('modalidade: a imagem do herói com \' e ( ) resolve percent-encoded',
      /%27/.test(pm.heroFundo) && /%28/.test(pm.heroFundo) && /url\(/.test(pm.heroFundo),
      pm.heroFundo.slice(0, 160));
    verificar('modalidade: sem erros de consola', pm.erros.length === 0, pm.erros.join(' | '));

    pm = await testarPaginaModalidade(browser, srv.url, 610);
    verificar('modalidade: uma modalidade inativa não é publicada por endereço directo',
      pm.nome === 'Modalidade não encontrada' && !pm.infoVisivel && !pm.postsVisivel);
    verificar('modalidade: a publicação da inativa não aparece',
      !pm.texto.includes('TESTE POST DA INATIVA NAO APARECE'));

    pm = await testarPaginaModalidade(browser, srv.url, 611);
    verificar('modalidade: uma modalidade sem nome é tratada como inexistente',
      pm.nome === 'Modalidade não encontrada' && !pm.infoVisivel);
    pm = await testarPaginaModalidade(browser, srv.url, 99999);
    verificar('modalidade: um id inexistente continua a dar não encontrada',
      pm.nome === 'Modalidade não encontrada' && !pm.infoVisivel && !pm.postsVisivel);

    pm = await testarPaginaModalidade(browser, srv.url, 601, { hamburger: true, largura: 375 });
    verificar('modalidade: o menu móvel abre com um clique',
      pm.menuAberto, 'o ouvinte duplicado abria e fechava no mesmo clique');
    verificar('modalidade: o aria-expanded acompanha o estado visível',
      pm.menuAria === 'true', 'aria-expanded=' + pm.menuAria);

    pm = await testarPaginaModalidade(browser, srv.url, 601, { tema: 'dark' });
    verificar('modalidade: em tema escuro o nome não fica com a cor do tema claro',
      pm.corDoNome !== 'rgb(0, 31, 77)' && pm.corDoNome !== '', pm.corDoNome);

    // ---- 6b. Bloco 5: patrocinadores ----------------------------
    console.log('\npatrocinadores: zona única');
    const patAtivos = dados.patrocinadores.filter((p) => (p.ativo === true || p.ativo === 1
      || (typeof p.ativo === 'string' && ['true', '1'].indexOf(p.ativo.trim().toLowerCase()) !== -1))
      && String(p.nome || '').trim() !== '');
    const comSite = patAtivos.filter((p) => {
      const w = String(p.website || '').trim();
      return w !== '' && !/^javascript:/i.test(w) && !/^data:/i.test(w);
    }).length;

    for (const pagina of ['index.html', 'patrocinadores.html']) {
      let x = await testarPatrocinadores(browser, srv.url, pagina, false, 1440);
      verificar(`sem JS (${pagina}): ${patAtivos.length} cartões, todos visíveis`,
        x.cartoes === patAtivos.length && x.cartoesVisiveis === patAtivos.length,
        'cartões ' + x.cartoes + ', visíveis ' + x.cartoesVisiveis);
      verificar(`sem JS (${pagina}): uma grelha só`,
        pagina === 'index.html' ? x.grelhas === 0 : x.grelhas === 1, 'grelhas ' + x.grelhas);
      verificar(`sem JS (${pagina}): nenhuma classe de nível na zona pública`,
        x.classesDeNivel.length === 0, x.classesDeNivel.join(', '));
      verificar(`sem JS (${pagina}): todos os cartões têm as mesmas classes`,
        new Set(x.lidos.map((c) => c.classes)).size === 1,
        JSON.stringify(Array.from(new Set(x.lidos.map((c) => c.classes)))));
      verificar(`sem JS (${pagina}): nenhum inativo na página`,
        !x.texto.includes('NAO APARECE'));
      verificar(`sem JS (${pagina}): nenhum <a> de cartão sem href`,
        x.ancorasSemHref === 0, 'encontrei ' + x.ancorasSemHref);
      verificar(`sem JS (${pagina}): ${comSite} ligações externas, alcançáveis por teclado`,
        x.focaveis === comSite, 'focáveis ' + x.focaveis);
      verificar(`sem JS (${pagina}): o website sem esquema resolve para https`,
        x.lidos.some((c) => c.href === 'https://exemplo.invalido'),
        JSON.stringify(x.lidos.map((c) => c.href).filter(Boolean)));
      verificar(`sem JS (${pagina}): javascript: e data: não deram ligação`,
        x.lidos.every((c) => !c.href || /^https?:\/\//.test(c.href)));
      verificar(`sem JS (${pagina}): o logótipo tem alt e a imagem resolveu`,
        x.lidos.some((c) => c.alt === 'TESTE PATROCINADOR COMPLETO' && c.imagemOk === true),
        JSON.stringify(x.lidos.filter((c) => c.alt !== null)));
      verificar(`sem JS (${pagina}): o nome com & e <b> aparece como texto`,
        x.texto.includes('TESTE ESCAPE & <b>B</b>'));
      verificar(`sem JS (${pagina}): o travessão do sector não aparece`,
        x.lidos.every((c) => c.sector !== '—' && c.sector !== '-'));
      verificar(`sem JS (${pagina}): a ordem é a ordem dos dados`,
        JSON.stringify(x.lidos.map((c) => c.nome)) === JSON.stringify(patAtivos.map((p) => p.nome.trim())),
        JSON.stringify(x.lidos.map((c) => c.nome).slice(0, 4)));
      verificar(`sem JS (${pagina}): sem transbordo a 1440 px`, x.transbordo <= 0, '+' + x.transbordo + 'px');
      verificar(`sem JS (${pagina}): sem erros de rede`, x.erros.length === 0, x.erros.join(' | '));

      x = await testarPatrocinadores(browser, srv.url, pagina, false, 320);
      verificar(`sem JS a 320 px (${pagina}): os cartões continuam todos`,
        x.cartoes === patAtivos.length);
      verificar(`sem JS a 320 px (${pagina}): sem transbordo`, x.transbordo <= 0, '+' + x.transbordo + 'px');
    }
    const xp = await testarPatrocinadores(browser, srv.url, 'patrocinadores.html', false, 1440);
    verificar('sem JS: o convite final existe sem JavaScript',
      xp.cta, 'era o bloco que desaparecia com a página');
    verificar('sem JS: sector, ano e botão do site aparecem quando existem',
      xp.lidos.some((c) => c.sector === 'TESTE SECTOR')
      && xp.lidos.some((c) => c.desde === 'Parceiro desde 2019'));
    verificar('sem JS: quem não tem sector nem ano não produz esses elementos',
      xp.lidos.some((c) => c.nome === 'TESTE SO NOME' && c.sector === null && c.desde === null));

    // Com JavaScript: o bloco gerado e atual não é redesenhado, e quando é
    // redesenhado dá o mesmo cartão.
    for (const [pagina, ficheiro, ancora] of [
      ['index.html', path.join(raiz, 'index.html'), '<div class="sponsor-card__logo">TESTE SO NOME</div>'],
      ['patrocinadores.html', path.join(raiz, 'patrocinadores.html'), '<h3 class="sp-card__name">TESTE SO NOME</h3>'],
    ]) {
      const antes = fs.readFileSync(ficheiro, 'utf8');
      fs.writeFileSync(ficheiro, antes.replace(ancora, ancora + '<!--MARCA-->'));
      let y = await testarPatrocinadores(browser, srv.url, pagina, true, 1440);
      verificar(`com JS (${pagina}): o bloco gerado e atual não é redesenhado`,
        fs.readFileSync(ficheiro, 'utf8').includes('<!--MARCA-->')
        && y.cartoes === patAtivos.length);
      verificar(`com JS (${pagina}): sem erros de consola`, y.erros.length === 0, y.erros.join(' | '));
      const gerados = JSON.stringify(y.lidos);

      fs.writeFileSync(ficheiro, fs.readFileSync(ficheiro, 'utf8')
        .replace('data-itens="' + patAtivos.length + '"', 'data-itens="99"'));
      y = await testarPatrocinadores(browser, srv.url, pagina, true, 1440);
      verificar(`com JS (${pagina}): data-itens errado força o redesenho`,
        y.cartoes === patAtivos.length && y.itens === '99');
      verificar(`com JS (${pagina}): o cartão desenhado é o mesmo que o gerado`,
        JSON.stringify(y.lidos) === gerados,
        'desenhado: ' + JSON.stringify(y.lidos).slice(0, 300));
      verificar(`com JS (${pagina}): nenhuma classe de nível depois do redesenho`,
        y.classesDeNivel.length === 0, y.classesDeNivel.join(', '));
      verificar(`com JS (${pagina}): nenhum <a> sem href depois do redesenho`,
        y.ancorasSemHref === 0);
      fs.writeFileSync(ficheiro, antes);
    }

    // O registo sem nome não pode apagar a página: era o que fazia o
    // initials() do script inline, que estourava e deixava tudo em branco.
    verificar('com JS: um registo sem nome não apaga a página',
      (await testarPatrocinadores(browser, srv.url, 'patrocinadores.html', true, 1440)).cta);

    console.log('\npatrocinadores: painel');
    const adm = await testarAdminPatrocinadores(browser, srv.url);
    verificar('painel: o botão de novo patrocinador existe', adm.abriu);
    verificar('painel: o selector de nível desapareceu', !adm.temSelectorNivel);
    verificar('painel: não há opções de nível no modal', !adm.opcoesDeNivel);
    verificar('painel: o campo de logótipo existe', adm.temCampoLogotipo);
    verificar('painel: a lista deixou de agrupar por nível', !adm.listaComNiveis);
    verificar('painel: sem exceções', adm.erros.length === 0, adm.erros.join(' | '));

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
      ['/modelos/escaloes.php', 403],
      ['/modelos/patrocinadores-inicio.php', 403],
      ['/modelos/patrocinadores-pagina.php', 403],
      ['/modelos/modalidades.php', 403],
      ['/modelos/galeria-inicio.php', 403],
      ['/modelos/galeria-pagina.php', 403],
      ['/modelos/videos.php', 403],
      ['/modelos/historia-cronologia.php', 403],
      ['/modelos/historia-palmares.php', 403],
      ['/modelos/rodape-redes.php', 403],
      ['/modelos/rodape-contacto.php', 403],
      ['/modelos/rodape-base.php', 403],
      ['/modelos/sitemap.php', 403],
      // Documentação interna e a ferramenta de linha de comando deixam de ser
      // servidas. O robots.txt pede; é o Apache que impede.
      ['/AUDITORIA.md', 403],
      ['/scraper/fpf-scraper.js', 403],
      ['/scraper/README.md', 403],
      // O manifesto tem de continuar público, senão o service worker não instala.
      ['/manifest.json', 200],
      ['/robots.txt', 200],
      ['/sitemap.xml', 200],
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
    // E a formação sem escalões: a grelha tem de voltar ao estado vazio.
    semNoticias.escaloes = [];
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

    let fv = await testarFormacao(browser, srv.url, false, 1440);
    verificar('formação: sem escalões nenhum cartão e o estado vazio visível',
      fv.cartoes === 0 && fv.vazioVisivel, 'cartões ' + fv.cartoes + ', vazio=' + fv.vazioVisivel);
    verificar('formação: sem escalões nenhuma ligação para escalões',
      fv.focaveis === 0);
    verificar('formação: sem transbordo no estado vazio', fv.transbordo <= 0, '+' + fv.transbordo + 'px');
    fv = await testarFormacao(browser, srv.url, true, 1440);
    verificar('formação: com JavaScript o estado vazio mantém-se, sem duplicar',
      fv.cartoes === 0 && fv.vazioVisivel && fv.itens === '0',
      'cartões ' + fv.cartoes + ', data-itens ' + fv.itens);
    verificar('formação: sem erros de consola no estado vazio',
      fv.erros.length === 0, fv.erros.join(' / '));

    semNoticias.patrocinadores = [];
    // E sem modalidades: a grelha tem de voltar ao estado vazio, sem
    // Kickboxing, Judo ou Futsal a reaparecerem de um fallback.
    semNoticias.modalidades = [];
    escreverDados(raiz, semNoticias);
    gerar(raiz);
    for (const pagina of ['index.html', 'patrocinadores.html']) {
      const pv = await testarPatrocinadores(browser, srv.url, pagina, false, 1440);
      verificar(`patrocinadores (${pagina}): sem patrocinadores, nenhum cartão e o vazio visível`,
        pv.cartoes === 0 && pv.vazioVisivel, 'cartões ' + pv.cartoes + ', vazio=' + pv.vazioVisivel);
      const pvJs = await testarPatrocinadores(browser, srv.url, pagina, true, 1440);
      verificar(`patrocinadores (${pagina}): com JavaScript o vazio mantém-se, sem duplicar`,
        pvJs.cartoes === 0 && pvJs.vazioVisivel && pvJs.itens === '0',
        'cartões ' + pvJs.cartoes + ', data-itens ' + pvJs.itens);
      verificar(`patrocinadores (${pagina}): sem erros de consola no estado vazio`,
        pvJs.erros.length === 0, pvJs.erros.join(' / '));
    }
    verificar('patrocinadores: sem patrocinadores o convite final continua lá',
      (await testarPatrocinadores(browser, srv.url, 'patrocinadores.html', false, 1440)).cta);

    let mv = await testarModalidades(browser, srv.url, false, 1440);
    verificar('modalidades: sem modalidades nenhum cartão e o vazio visível',
      mv.cartoes === 0 && mv.vazioVisivel, 'cartões ' + mv.cartoes + ', vazio=' + mv.vazioVisivel);
    verificar('modalidades: sem modalidades nenhuma das três reaparece',
      !/Kickboxing|Judo|Futsal/.test(mv.texto), mv.texto.slice(0, 120));
    verificar('modalidades: sem modalidades nenhuma ligação para modalidade.html',
      mv.ligacoes === 0);
    verificar('modalidades: sem transbordo no estado vazio', mv.transbordo <= 0, '+' + mv.transbordo + 'px');
    mv = await testarModalidades(browser, srv.url, true, 1440);
    verificar('modalidades: com JavaScript o estado vazio mantém-se, sem duplicar',
      mv.cartoes === 0 && mv.vazioVisivel && mv.itens === '0',
      'cartões ' + mv.cartoes + ', data-itens ' + mv.itens);
    verificar('modalidades: sem erros de consola no estado vazio',
      mv.erros.length === 0, mv.erros.join(' / '));

    // Nenhum dado de teste nos ficheiros públicos do repositório. A
    // verificação abaixo olha para a cópia gerada; esta olha para a fonte,
    // que é onde nunca pode haver dados de teste. Comentários não contam —
    // podem explicar o que um teste faz.
    {
      const publicos = fs.readdirSync(RAIZ_PROJETO).filter((f) => f.endsWith('.html'))
        .concat(fs.readdirSync(path.join(RAIZ_PROJETO, 'js')).map((f) => 'js/' + f))
        .concat(fs.readdirSync(path.join(RAIZ_PROJETO, 'modelos')).map((f) => 'modelos/' + f));
      const comTeste = publicos.filter((rel) => /\bTESTE[ -]/.test(
        fs.readFileSync(path.join(RAIZ_PROJETO, rel), 'utf8').replace(/<!--[\s\S]*?-->/g, '')));
      verificar('nenhum dado de teste nos ficheiros públicos do repositório',
        comTeste.length === 0, 'ficheiros: ' + comTeste.join(', '));
    }

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
