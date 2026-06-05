/**
 * Copa Fácil – JS Campinense
 * routes/campeonatos.js – Championship CRUD + standings + fixture generation
 *
 * GET    /api/campeonatos                      – list all with stats
 * GET    /api/campeonatos/:id                  – single campeonato
 * GET    /api/campeonatos/:id/classificacao    – standings
 * GET    /api/campeonatos/:id/jogos            – all matches
 * GET    /api/campeonatos/:id/equipas          – all teams in campeonato
 * POST   /api/campeonatos                      – create (auth)
 * PUT    /api/campeonatos/:id                  – update (auth)
 * DELETE /api/campeonatos/:id                  – delete (auth)
 * POST   /api/campeonatos/:id/equipas          – add team (auth)
 * DELETE /api/campeonatos/:id/equipas/:eqId    – remove team (auth)
 * POST   /api/campeonatos/:id/gerar-fixtures   – generate round-robin (auth)
 */

const express = require('express');
const { db, calcularClassificacao } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ── LIST ALL ──────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const campeonatos = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM campeonato_equipas ce WHERE ce.campeonato_id = c.id) AS num_equipas,
      (SELECT COUNT(*) FROM jogos j WHERE j.campeonato_id = c.id) AS num_jogos
    FROM campeonatos c
    ORDER BY c.criado_em DESC
  `).all();
  res.json(campeonatos);
});

// ── SINGLE ────────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const c = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM campeonato_equipas ce WHERE ce.campeonato_id = c.id) AS num_equipas,
      (SELECT COUNT(*) FROM jogos j WHERE j.campeonato_id = c.id) AS num_jogos
    FROM campeonatos c
    WHERE c.id = ?
  `).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Campeonato não encontrado.' });
  res.json(c);
});

// ── CLASSIFICAÇÃO ─────────────────────────────────────────────────────────────
router.get('/:id/classificacao', (req, res) => {
  const c = db.prepare('SELECT id FROM campeonatos WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Campeonato não encontrado.' });
  const classificacao = calcularClassificacao(req.params.id);
  res.json(classificacao);
});

// ── JOGOS ─────────────────────────────────────────────────────────────────────
router.get('/:id/jogos', (req, res) => {
  const jogos = db.prepare(`
    SELECT j.*,
      ec.nome AS equipa_casa_nome,
      ec.brasao AS equipa_casa_brasao,
      ec.cor_principal AS equipa_casa_cor,
      ef.nome AS equipa_fora_nome,
      ef.brasao AS equipa_fora_brasao,
      ef.cor_principal AS equipa_fora_cor
    FROM jogos j
    JOIN equipas ec ON ec.id = j.equipa_casa_id
    JOIN equipas ef ON ef.id = j.equipa_fora_id
    WHERE j.campeonato_id = ?
    ORDER BY j.jornada ASC, j.data_jogo ASC
  `).all(req.params.id);
  res.json(jogos);
});

// ── EQUIPAS ───────────────────────────────────────────────────────────────────
router.get('/:id/equipas', (req, res) => {
  const equipas = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM jogadores p WHERE p.equipa_id = e.id) AS num_jogadores
    FROM campeonato_equipas ce
    JOIN equipas e ON e.id = ce.equipa_id
    WHERE ce.campeonato_id = ?
    ORDER BY e.nome ASC
  `).all(req.params.id);
  res.json(equipas);
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const { nome, modalidade, formato, epoca, descricao, estado, logo } = req.body;
  if (!nome || !epoca) {
    return res.status(400).json({ error: 'Nome e época são obrigatórios.' });
  }
  const result = db.prepare(`
    INSERT INTO campeonatos (nome, modalidade, formato, epoca, descricao, estado, logo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    nome,
    modalidade || 'Futebol 11',
    formato || 'liga',
    epoca,
    descricao || null,
    estado || 'por_iniciar',
    logo || null
  );
  const created = db.prepare('SELECT * FROM campeonatos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.put('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT * FROM campeonatos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campeonato não encontrado.' });

  const { nome, modalidade, formato, epoca, descricao, estado, logo } = req.body;
  db.prepare(`
    UPDATE campeonatos
    SET nome = ?, modalidade = ?, formato = ?, epoca = ?,
        descricao = ?, estado = ?, logo = ?
    WHERE id = ?
  `).run(
    nome ?? existing.nome,
    modalidade ?? existing.modalidade,
    formato ?? existing.formato,
    epoca ?? existing.epoca,
    descricao ?? existing.descricao,
    estado ?? existing.estado,
    logo ?? existing.logo,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM campeonatos WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT id FROM campeonatos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Campeonato não encontrado.' });
  db.prepare('DELETE FROM campeonatos WHERE id = ?').run(req.params.id);
  res.json({ message: 'Campeonato eliminado com sucesso.' });
});

// ── ADD TEAM ──────────────────────────────────────────────────────────────────
router.post('/:id/equipas', auth, (req, res) => {
  const { equipa_id } = req.body;
  if (!equipa_id) return res.status(400).json({ error: 'equipa_id é obrigatório.' });

  const campeonato = db.prepare('SELECT id FROM campeonatos WHERE id = ?').get(req.params.id);
  if (!campeonato) return res.status(404).json({ error: 'Campeonato não encontrado.' });

  const equipa = db.prepare('SELECT id FROM equipas WHERE id = ?').get(equipa_id);
  if (!equipa) return res.status(404).json({ error: 'Equipa não encontrada.' });

  try {
    db.prepare('INSERT INTO campeonato_equipas (campeonato_id, equipa_id) VALUES (?, ?)').run(req.params.id, equipa_id);
    res.status(201).json({ message: 'Equipa adicionada ao campeonato.' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Equipa já está inscrita neste campeonato.' });
    }
    throw err;
  }
});

// ── REMOVE TEAM ───────────────────────────────────────────────────────────────
router.delete('/:id/equipas/:equipaId', auth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM campeonato_equipas WHERE campeonato_id = ? AND equipa_id = ?'
  ).run(req.params.id, req.params.equipaId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Associação não encontrada.' });
  }
  res.json({ message: 'Equipa removida do campeonato.' });
});

// ── GERAR FIXTURES (round-robin) ──────────────────────────────────────────────
router.post('/:id/gerar-fixtures', auth, (req, res) => {
  const campeonato = db.prepare('SELECT * FROM campeonatos WHERE id = ?').get(req.params.id);
  if (!campeonato) return res.status(404).json({ error: 'Campeonato não encontrado.' });

  const equipas = db.prepare(
    'SELECT equipa_id FROM campeonato_equipas WHERE campeonato_id = ?'
  ).all(req.params.id).map(r => r.equipa_id);

  if (equipas.length < 2) {
    return res.status(400).json({ error: 'Precisam de pelo menos 2 equipas para gerar fixtures.' });
  }

  // Delete existing fixtures for this campeonato
  db.prepare('DELETE FROM jogos WHERE campeonato_id = ?').run(req.params.id);

  /**
   * Round-robin using the "circle method":
   * With N teams (N even), there are N-1 rounds each with N/2 games.
   * If N is odd, add a "bye" team and ignore games against it.
   */
  let teams = [...equipas];
  const hasOdd = teams.length % 2 !== 0;
  if (hasOdd) teams.push(null); // bye

  const n = teams.length;
  const numRounds = n - 1;
  const gamesPerRound = n / 2;

  const insertJogo = db.prepare(`
    INSERT INTO jogos (campeonato_id, equipa_casa_id, equipa_fora_id, jornada, estado)
    VALUES (?, ?, ?, ?, 'agendado')
  `);

  const insertMany = db.transaction(() => {
    for (let round = 0; round < numRounds; round++) {
      const jornada = round + 1;

      for (let game = 0; game < gamesPerRound; game++) {
        const home = teams[game];
        const away = teams[n - 1 - game];

        // Skip bye games
        if (home === null || away === null) continue;

        // Alternate home/away by round parity (except the first slot which is fixed)
        if (round % 2 === 0 || game === 0) {
          insertJogo.run(req.params.id, home, away, jornada);
        } else {
          insertJogo.run(req.params.id, away, home, jornada);
        }
      }

      // Rotate teams (keep first fixed, rotate the rest)
      const last = teams.pop();
      teams.splice(1, 0, last);
    }
  });

  insertMany();

  const count = db.prepare('SELECT COUNT(*) as c FROM jogos WHERE campeonato_id = ?').get(req.params.id);
  res.json({ message: `${count.c} jogos gerados com sucesso.`, total: count.c });
});

module.exports = router;
