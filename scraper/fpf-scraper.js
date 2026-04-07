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

const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

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

// ── ENDPOINTS FPF ────────────────────────────────────────────────────

async function listarCompeticoes() {
  log(`A pesquisar competições da AF Algarve (assoc. ${CONFIG.associationId}, época ${CONFIG.seasonId})...`);
  try {
    const { data } = await http.get('/Competition/GetCompetitionsByAssociation', {
      params: { associationId: CONFIG.associationId, seasonId: CONFIG.seasonId },
    });
    return Array.isArray(data) ? data : (data.competitions || data.data || []);
  } catch (e) {
    warn(`Não foi possível obter competições: ${e.message}`);
    if (e.response) warn(`HTTP ${e.response.status}: ${JSON.stringify(e.response.data).slice(0,200)}`);
    return [];
  }
}

async function obterClassificacao(competicaoId) {
  try {
    const { data } = await http.get('/Competition/GetStandings', {
      params: { competitionId: competicaoId, seasonId: CONFIG.seasonId },
    });
    const rows = Array.isArray(data) ? data : (data.standings || data.rows || data.data || []);
    return rows.map(r => ({
      posicao:  r.position   || r.Position   || r.pos || 0,
      equipa:   r.teamName   || r.TeamName   || r.team || '—',
      j:  parseInt(r.played  || r.Played  || 0),
      v:  parseInt(r.won     || r.Won     || 0),
      e:  parseInt(r.drawn   || r.Drawn   || 0),
      d:  parseInt(r.lost    || r.Lost    || 0),
      gm: parseInt(r.goalsFor    || r.GoalsFor    || r.gf || 0),
      gs: parseInt(r.goalsAgainst|| r.GoalsAgainst|| r.ga || 0),
      pts: parseInt(r.points || r.Points || 0),
      sc: (r.teamName || r.TeamName || '').includes(CONFIG.clube),
    }));
  } catch (e) {
    warn(`Classificação competicao ${competicaoId}: ${e.message}`);
    return [];
  }
}

async function obterJogos(competicaoId) {
  try {
    const { data } = await http.get('/Competition/GetMatches', {
      params: { competitionId: competicaoId, seasonId: CONFIG.seasonId },
    });
    const matches = Array.isArray(data) ? data : (data.matches || data.games || data.data || []);
    return matches.map(m => {
      const dataBruta = m.matchDate || m.date || m.Date || m.matchDateTime || '';
      const horaBruta = m.matchTime || m.time || m.Time || dataBruta;
      const gcasa = m.homeGoals ?? m.HomeGoals ?? m.homeScore ?? null;
      const gfora = m.awayGoals ?? m.AwayGoals ?? m.awayScore ?? null;
      const realizado = gcasa !== null && gfora !== null;
      return {
        casa:   m.homeTeam  || m.HomeTeam  || m.home  || '—',
        fora:   m.awayTeam  || m.AwayTeam  || m.away  || '—',
        gcasa:  realizado ? parseInt(gcasa) : null,
        gfora:  realizado ? parseInt(gfora) : null,
        data:   normalizarData(dataBruta),
        hora:   normalizarHora(horaBruta) || '—',
        local:  m.venue || m.Venue || m.stadium || '—',
        estado: realizado ? 'Realizado' : 'Agendado',
      };
    });
  } catch (e) {
    warn(`Jogos competicao ${competicaoId}: ${e.message}`);
    return [];
  }
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

  // ── Modo: testar ligação
  if (args.includes('--testar')) {
    await testarLigacao();
    return;
  }

  // ── Modo: debug API
  if (args.includes('--debug')) {
    log('A inspecionar endpoints da API FPF...\n');
    const endpoints = [
      `/Competition/GetCompetitionsByAssociation?associationId=218&seasonId=103`,
      `/Competition/GetCompetitionsByAssociation?associationId=218&seasonId=104`,
      `/Competition/GetCompetitionsByAssociation?associationId=218&seasonId=105`,
      `/api/Competition/GetCompetitionsByAssociation?associationId=218&seasonId=103`,
      `/api/v1/competitions?associationId=218`,
      `/Association/GetAll`,
      `/Season/GetAll`,
      `/api/Season/GetAll`,
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
      await sleep(300);
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

  // ── Modo: listar competições
  const competicoes = await listarCompeticoes();
  if (!competicoes.length) {
    err(`Sem competições. Verifique associationId (${CONFIG.associationId}) e seasonId (${CONFIG.seasonId}).`);
    err('Corra:  node fpf-scraper.js --descobrir-af');
    err('Ou aceda a https://resultados.fpf.pt e verifique os IDs no URL.');
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

  // ── Filtrar competições a importar
  let alvo = competicoes;
  const idFlag = args.indexOf('--competicao');
  if (idFlag !== -1 && args[idFlag + 1]) {
    const filtroId = parseInt(args[idFlag + 1]);
    alvo = competicoes.filter(c =>
      (c.competitionId || c.CompetitionId || c.id) === filtroId
    );
    if (!alvo.length) {
      err(`Competição ID ${filtroId} não encontrada.`);
      process.exit(1);
    }
  } else if (CONFIG.competicaoIds.length) {
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
