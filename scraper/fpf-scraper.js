/**
 * =====================================================================
 * FPF SCRAPER — resultados.fpf.pt
 * Juventude Sport Campinense – Loulé
 * =====================================================================
 *
 * USO:
 *   npm install
 *   node fpf-scraper.js                   → importa e guarda fpf-data.json
 *   node fpf-scraper.js --listar          → lista competições disponíveis
 *   node fpf-scraper.js --competicao 1234 → importa só uma competição
 *   node fpf-scraper.js --descobrir-af    → descobre IDs correctos
 *   node fpf-scraper.js --testar          → testa ligação à FPF
 *
 * O ficheiro fpf-data.json gerado deve ser copiado para ../data/fpf-data.json
 * e depois importado no painel admin em Admin → Jogos → Importar FPF.
 * =====================================================================
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

// ── CONFIGURAÇÃO ──────────────────────────────────────────────────────
const CONFIG = {
  // ID da AF Algarve em resultados.fpf.pt
  // Se não souber o ID, corra: node fpf-scraper.js --descobrir-af
  associationId: 218,

  // ID da época (105 = 2025/2026 AF Algarve)
  seasonId: 105,

  // Nome do clube a destacar na classificação
  clube: 'Sport Campinense',

  // Competições a importar (deixe [] para importar todas)
  // Ou indique os IDs: [12345, 67890]
  competicaoIds: [],

  // Ficheiro de saída
  output: path.join(__dirname, 'fpf-data.json'),
};

// ── HTTP CLIENT ───────────────────────────────────────────────────────
const http = axios.create({
  baseURL: 'https://resultados.fpf.pt',
  timeout: 15000,
  headers: {
    'User-Agent':        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'Accept':            'application/json, text/javascript, */*; q=0.01',
    'Accept-Language':   'pt-PT,pt;q=0.9,en;q=0.8',
    'X-Requested-With':  'XMLHttpRequest',
    'Referer':           'https://resultados.fpf.pt/',
    'Cache-Control':     'no-cache',
  },
});

// ── UTILITÁRIOS ───────────────────────────────────────────────────────
function log(msg)   { process.stdout.write(`[FPF] ${msg}\n`); }
function warn(msg)  { process.stdout.write(`[AVISO] ${msg}\n`); }
function err(msg)   { process.stderr.write(`[ERRO] ${msg}\n`); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizarData(str) {
  if (!str) return null;
  const iso = str.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const pt = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (pt) return `${pt[3]}-${pt[2]}-${pt[1]}`;
  return null;
}

function normalizarHora(str) {
  if (!str) return null;
  const m = str.match(/(\d{2}:\d{2})/);
  return m ? m[1] : null;
}

// ── TESTAR LIGAÇÃO ────────────────────────────────────────────────────
async function testarLigacao() {
  log('A testar ligação a resultados.fpf.pt...');
  try {
    const res = await http.get('/', { timeout: 8000 });
    log(`✓ Site acessível (HTTP ${res.status})`);
    return true;
  } catch (e) {
    if (e.response) {
      log(`✓ Site acessível (HTTP ${e.response.status})`);
      return true;
    }
    err(`Sem ligação: ${e.message}`);
    err('Verifique a sua ligação à Internet e tente novamente.');
    return false;
  }
}

// ── DESCOBRIR ÉPOCA ACTIVA ────────────────────────────────────────────
async function descobrirEpoca(assocId) {
  log(`A descobrir época activa para associação ${assocId}...`);
  // Testa IDs de época de 90 a 120
  for (let s = 120; s >= 90; s--) {
    try {
      const { data } = await http.get('/Competition/GetCompetitionsByAssociation', {
        params: { associationId: assocId, seasonId: s },
        timeout: 8000,
      });
      const lista = Array.isArray(data) ? data : (data.competitions || data.data || []);
      if (lista.length > 0) {
        log(`✓ Época ID ${s} tem ${lista.length} competições`);
        return s;
      }
    } catch (_) {}
    await sleep(200);
  }
  return null;
}

// ── OBTER HTML DA COMPETIÇÃO ──────────────────────────────────────────
async function obterPaginaHTML(competicaoId) {
  const { data } = await http.get('/Competition/Details', {
    params: { competitionId: competicaoId, seasonId: CONFIG.seasonId },
    headers: { 'Accept': 'text/html,application/xhtml+xml,*/*', 'X-Requested-With': '' },
  });
  return cheerio.load(data);
}

// ── PARSEAR CLASSIFICAÇÃO DO HTML ─────────────────────────────────────
// Estrutura encontrada:
// <div class="game classification no-gutters">
//   <div col-md-1 text-left>  <span>pos</span>  </div>
//   <div col-md-4>            nome equipa        </div>
//   <div col-md-1 text-center> J </div>
//   <div col-md-1 text-center> V </div>
//   <div col-md-1 text-center> E </div>
//   <div col-md-1 text-center> D </div>
//   ... GM GS Pts
// </div>
async function obterClassificacao(competicaoId) {
  try {
    const $ = await obterPaginaHTML(competicaoId);
    const classificacao = [];

    $('.game.classification').each((_, row) => {
      const cols = $(row).find('[class*="col-md-"]');
      if (cols.length < 6) return;

      const pos    = parseInt($(cols[0]).text().trim()) || 0;
      const equipa = $(cols[1]).text().trim();
      if (!equipa || pos === 0) return;

      const nums = [];
      cols.slice(2).each((_, c) => nums.push(parseInt($(c).text().trim()) || 0));
      // Ordem típica: J, V, E, D, GM, GS, Pts
      const [j=0, v=0, e=0, d=0, gm=0, gs=0, pts=0] = nums;

      classificacao.push({
        posicao: pos,
        equipa,
        j, v, e, d, gm, gs, pts,
        sc: equipa.toLowerCase().includes(CONFIG.clube.toLowerCase()),
      });
    });

    return classificacao;
  } catch (err_) {
    warn(`Classificação competicao ${competicaoId}: ${err_.message}`);
    return [];
  }
}

// ── PARSEAR JOGOS DO HTML ─────────────────────────────────────────────
async function obterJogos(competicaoId) {
  try {
    const $ = await obterPaginaHTML(competicaoId);
    const jogos = [];

    // Jogos realizados: procura linhas com resultado (ex: "2 - 1")
    // e jogos agendados: procura linhas com data/hora
    $('.game:not(.classification)').each((_, row) => {
      const texto = $(row).text().trim();
      if (!texto) return;

      const cols = $(row).find('[class*="col-"]');
      if (cols.length < 3) return;

      // Tenta extrair: casa | resultado/data | fora
      const textos = [];
      cols.each((_, c) => textos.push($(c).text().trim()));

      // Procura resultado "X - Y" ou "X:Y"
      const resIdx = textos.findIndex(t => /^\d+\s*[-:]\s*\d+$/.test(t));
      // Procura data "DD/MM/YYYY" ou hora "HH:MM"
      const dataIdx = textos.findIndex(t => /\d{2}\/\d{2}\/\d{4}/.test(t));
      const horaIdx = textos.findIndex(t => /^\d{2}:\d{2}$/.test(t));

      if (resIdx > 0) {
        // Jogo realizado
        const res   = textos[resIdx].replace(/\s/g, '');
        const parts = res.split(/[-:]/);
        const gcasa = parseInt(parts[0]);
        const gfora = parseInt(parts[1]);
        const casa  = textos.slice(0, resIdx).join(' ').trim() || '—';
        const fora  = textos.slice(resIdx + 1).join(' ').trim() || '—';
        const data  = dataIdx >= 0 ? normalizarData(textos[dataIdx]) : null;
        const hora  = horaIdx >= 0 ? textos[horaIdx] : '—';
        jogos.push({ casa, fora, gcasa, gfora, data, hora, local: '—', estado: 'Realizado' });
      } else if (dataIdx >= 0) {
        // Jogo agendado
        const data = normalizarData(textos[dataIdx]);
        const hora = horaIdx >= 0 ? textos[horaIdx] : '—';
        const meio = Math.floor(textos.length / 2);
        const casa = textos.slice(0, meio).filter(t => !t.match(/\d{2}\/\d{2}\/\d{4}/)).join(' ').trim() || '—';
        const fora = textos.slice(meio).filter(t => !t.match(/\d{2}\/\d{2}\/\d{4}|^\d{2}:\d{2}$/)).join(' ').trim() || '—';
        jogos.push({ casa, fora, gcasa: null, gfora: null, data, hora, local: '—', estado: 'Agendado' });
      }
    });

    return jogos;
  } catch (err_) {
    warn(`Jogos competicao ${competicaoId}: ${err_.message}`);
    return [];
  }
}

// ── LISTAR COMPETIÇÕES (não suportado via HTML — usar IDs directos) ───
async function listarCompeticoes() {
  warn('Listagem de competições não disponível. Use --competicao <ID> com o ID do URL da FPF.');
  return [];
}

async function descobrirAssociacoes() {
  log('A tentar descobrir IDs de associações (pode demorar ~30s)...');
  const encontradas = [];

  // Primeiro tenta descobrir a época correcta com assoc 218
  const epocaActiva = await descobrirEpoca(218);
  if (epocaActiva) {
    log(`\n→ Para AF Algarve (ID 218), use seasonId: ${epocaActiva}`);
    log(`  Edite CONFIG.seasonId = ${epocaActiva} no ficheiro fpf-scraper.js\n`);
    encontradas.push({ id: 218, seasonId: epocaActiva });
    return encontradas;
  }

  // Se não encontrou, testa range de IDs
  log('A testar outros IDs de associação (210-230)...');
  for (let id = 210; id <= 230; id++) {
    for (let s = 115; s >= 100; s -= 5) {
      try {
        const { data } = await http.get('/Competition/GetCompetitionsByAssociation', {
          params: { associationId: id, seasonId: s },
          timeout: 6000,
        });
        const lista = Array.isArray(data) ? data : (data.competitions || []);
        if (lista.length > 0) {
          const nome = lista[0].associationName || lista[0].AssociationName || `Associação ${id}`;
          log(`  ✓ associationId=${id} seasonId=${s}: ${nome} (${lista.length} competições)`);
          encontradas.push({ id, seasonId: s, nome, total: lista.length });
          break;
        }
      } catch (_) {}
      await sleep(150);
    }
  }
  return encontradas;
}

// ── MAIN ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // ── Modo: guardar HTML para análise
  if (args.includes('--salvar-html')) {
    const ok = await testarLigacao();
    if (!ok) return;
    log('A guardar HTML da página de competição...');
    try {
      const { data } = await http.get('/Competition/Details', {
        params: { competitionId: 28148, seasonId: 105 },
        headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
      });
      const ficheiro = path.join(__dirname, 'fpf-page.html');
      fs.writeFileSync(ficheiro, data, 'utf-8');
      log(`✓ HTML guardado em: ${ficheiro}`);
      log(`  Abra o ficheiro e procure as tabelas de classificação e jogos.`);
    } catch (e) {
      err(`Erro: ${e.message}`);
    }
    return;
  }

  // ── Modo: testar ligação
  if (args.includes('--testar')) {
    await testarLigacao();
    return;
  }

  // ── Modo: debug API
  if (args.includes('--debug')) {
    log('A inspecionar endpoints da API FPF (competitionId=28148, seasonId=105)...\n');
    const endpoints = [
      `/Competition/GetStandings?competitionId=28148&seasonId=105`,
      `/Competition/GetMatches?competitionId=28148&seasonId=105`,
      `/Competition/Details?competitionId=28148&seasonId=105`,
      `/Competition/GetClassification?competitionId=28148&seasonId=105`,
      `/Competition/GetGames?competitionId=28148&seasonId=105`,
      `/Competition/GetRounds?competitionId=28148&seasonId=105`,
      `/Competition/GetPhases?competitionId=28148&seasonId=105`,
      `/api/Competition/GetStandings?competitionId=28148&seasonId=105`,
      `/api/Competition/GetMatches?competitionId=28148&seasonId=105`,
      `/Competition/GetCompetitionsByAssociation?associationId=218&seasonId=105`,
      `/Competition/GetCompetitionsByAssociation?associationId=219&seasonId=105`,
      `/Competition/GetCompetitionsByAssociation?associationId=220&seasonId=105`,
      `/Season/GetAll`,
      `/Association/GetAll`,
    ];
    for (const ep of endpoints) {
      try {
        const { data, status } = await http.get(ep, { timeout: 8000 });
        const preview = JSON.stringify(data).slice(0, 200);
        log(`✓ ${ep}`);
        log(`  HTTP ${status}: ${preview}\n`);
      } catch (e) {
        const code = e.response?.status || e.code || e.message;
        log(`✗ ${ep} → ${code}`);
      }
      await sleep(200);
    }
    return;
  }

  // ── Modo: descobrir associações
  if (args.includes('--descobrir-af')) {
    const ok = await testarLigacao();
    if (!ok) return;
    const assocs = await descobrirAssociacoes();
    if (!assocs.length) {
      err('Nenhuma associação encontrada.');
      err('Sugestão: abra https://resultados.fpf.pt no browser, vá a AF Algarve → Juniores,');
      err('e copie os números do URL (ex: associationId=218&seasonId=105).');
    } else {
      log('\n→ Actualize CONFIG.associationId e CONFIG.seasonId no script e corra novamente.');
    }
    return;
  }

  // ── Verificar ligação antes de continuar
  const ok = await testarLigacao();
  if (!ok) process.exit(1);

  // ── Modo: importar directamente por ID (sem precisar listar)
  const idFlag = args.indexOf('--competicao');
  if (idFlag !== -1 && args[idFlag + 1]) {
    const cId = parseInt(args[idFlag + 1]);
    log(`\nA importar competição ID ${cId} directamente...\n`);

    const [classificacao, jogos] = await Promise.all([
      obterClassificacao(cId),
      obterJogos(cId),
    ]);

    log(`   Classificação: ${classificacao.length} equipas`);
    log(`   Jogos: ${jogos.length} (${jogos.filter(j=>j.estado==='Realizado').length} realizados, ${jogos.filter(j=>j.estado==='Agendado').length} agendados)`);

    if (!classificacao.length && !jogos.length) {
      err('Sem dados. Verifique se o competitionId e seasonId estão correctos.');
      process.exit(1);
    }

    const resultado = {
      geradoEm: new Date().toISOString(),
      competicoes: [{
        id: cId,
        nome: `Competição ${cId}`,
        associacao: 'AF Algarve',
        escalao: '',
        classificacao,
        jogos,
      }],
    };

    fs.writeFileSync(CONFIG.output, JSON.stringify(resultado, null, 2), 'utf-8');
    log(`\n✓ Dados guardados em: ${CONFIG.output}`);
    log(`  Importe no Painel Admin → Jogos → "Importar FPF"\n`);
    return;
  }

  // ── Modo: listar competições
  const competicoes = await listarCompeticoes();
  if (!competicoes.length) {
    err(`Sem competições. Verifique associationId (${CONFIG.associationId}) e seasonId (${CONFIG.seasonId}).`);
    err('Se conhece o competitionId, use:  node fpf-scraper.js --competicao <ID>');
    process.exit(1);
  }

  if (args.includes('--listar')) {
    log('\nCompetições disponíveis:\n');
    competicoes.forEach(c => {
      const id   = c.competitionId || c.CompetitionId || c.id || '?';
      const nome = c.competitionName || c.CompetitionName || c.name || '?';
      const esc  = c.phaseDescription || c.phase || c.escalao || '';
      console.log(`  ID ${id}  →  ${nome}  ${esc ? `[${esc}]` : ''}`);
    });
    log('\nPara importar uma competição específica:');
    log('  node fpf-scraper.js --competicao <ID>');
    return;
  }

  // ── Importar todas
  let alvo = competicoes;
  if (CONFIG.competicaoIds.length) {
    alvo = competicoes.filter(c =>
      CONFIG.competicaoIds.includes(c.competitionId || c.CompetitionId || c.id)
    );
  }

  log(`\nA importar ${alvo.length} competição(ões)...\n`);

  const resultado = { geradoEm: new Date().toISOString(), competicoes: [] };

  for (const comp of alvo) {
    const cId   = comp.competitionId || comp.CompetitionId || comp.id;
    const cNome = comp.competitionName || comp.CompetitionName || comp.name || `Competição ${cId}`;
    log(`→ ${cNome} (ID ${cId})`);

    const [classificacao, jogos] = await Promise.all([
      obterClassificacao(cId),
      obterJogos(cId),
    ]);

    log(`   Classificação: ${classificacao.length} equipas`);
    log(`   Jogos: ${jogos.length} (${jogos.filter(j=>j.estado==='Realizado').length} realizados, ${jogos.filter(j=>j.estado==='Agendado').length} agendados)`);

    resultado.competicoes.push({
      id:            cId,
      nome:          cNome,
      associacao:    comp.associationName || comp.AssociationName || 'AF Algarve',
      escalao:       comp.phaseDescription || comp.phase || comp.escalao || '',
      classificacao,
      jogos,
    });

    await sleep(500);
  }

  fs.writeFileSync(CONFIG.output, JSON.stringify(resultado, null, 2), 'utf-8');
  log(`\n✓ Dados guardados em: ${CONFIG.output}`);
  log(`  Copie o ficheiro para  ../data/fpf-data.json`);
  log(`  e importe no Painel Admin → Jogos → "Importar FPF"\n`);
}

main().catch(e => {
  err(`Erro inesperado: ${e.message}`);
  process.exit(1);
});
