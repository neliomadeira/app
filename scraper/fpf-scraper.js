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

  // ID da época (103 = 2025/2026 geralmente — ajuste se necessário)
  seasonId: 103,

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
    'User-Agent':        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept':            'application/json, text/javascript, */*; q=0.01',
    'Accept-Language':   'pt-PT,pt;q=0.9',
    'X-Requested-With':  'XMLHttpRequest',
    'Referer':           'https://resultados.fpf.pt/',
  },
});

// ── UTILITÁRIOS ───────────────────────────────────────────────────────
function log(msg)   { process.stdout.write(`[FPF] ${msg}\n`); }
function warn(msg)  { process.stdout.write(`[AVISO] ${msg}\n`); }
function err(msg)   { process.stderr.write(`[ERRO] ${msg}\n`); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizarData(str) {
  if (!str) return null;
  // Formatos comuns da FPF: "22/03/2026", "2026-03-22T10:30:00"
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

// ── ENDPOINTS FPF ────────────────────────────────────────────────────

/**
 * Lista todas as competições da associação
 */
async function listarCompeticoes() {
  log(`A pesquisar competições da AF Algarve (assoc. ${CONFIG.associationId}, época ${CONFIG.seasonId})...`);
  try {
    const { data } = await http.get('/Competition/GetCompetitionsByAssociation', {
      params: { associationId: CONFIG.associationId, seasonId: CONFIG.seasonId },
    });
    return Array.isArray(data) ? data : (data.competitions || data.data || []);
  } catch (e) {
    warn(`Não foi possível obter competições: ${e.message}`);
    return [];
  }
}

/**
 * Obtém a classificação de uma competição
 */
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

/**
 * Obtém os jogos de uma competição
 */
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

/**
 * Descobre IDs das associações disponíveis
 */
async function descobrirAssociacoes() {
  log('A tentar descobrir IDs de associações...');
  const encontradas = [];
  for (let id = 210; id <= 240; id++) {
    try {
      const { data } = await http.get('/Competition/GetCompetitionsByAssociation', {
        params: { associationId: id, seasonId: CONFIG.seasonId },
        timeout: 6000,
      });
      const lista = Array.isArray(data) ? data : (data.competitions || []);
      if (lista.length > 0) {
        const nome = lista[0].associationName || lista[0].AssociationName || `ID ${id}`;
        log(`  ✓ ID ${id}: ${nome} (${lista.length} competições)`);
        encontradas.push({ id, nome, total: lista.length });
      }
    } catch (_) {}
    await sleep(300);
  }
  return encontradas;
}

// ── MAIN ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // ── Modo: descobrir associações
  if (args.includes('--descobrir-af')) {
    const assocs = await descobrirAssociacoes();
    if (!assocs.length) {
      err('Nenhuma associação encontrada. Verifique o seasonId ou a ligação à Internet.');
    } else {
      log('\nProcure "Algarve" na lista acima e actualize CONFIG.associationId no script.');
    }
    return;
  }

  // ── Modo: listar competições
  const competicoes = await listarCompeticoes();
  if (!competicoes.length) {
    err(`Sem competições. Verifique associationId (${CONFIG.associationId}) e seasonId (${CONFIG.seasonId}).`);
    err('Sugestão: corra  node fpf-scraper.js --descobrir-af  para encontrar o ID correcto.');
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

    await sleep(500); // intervalo para não sobrecarregar o servidor
  }

  // Guardar ficheiro
  fs.writeFileSync(CONFIG.output, JSON.stringify(resultado, null, 2), 'utf-8');
  log(`\n✓ Dados guardados em: ${CONFIG.output}`);
  log(`  Copie o ficheiro para  ../data/fpf-data.json`);
  log(`  e importe no Painel Admin → Jogos → "Importar FPF"\n`);
}

main().catch(e => {
  err(`Erro inesperado: ${e.message}`);
  process.exit(1);
});
