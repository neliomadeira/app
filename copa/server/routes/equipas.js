/**
 * Copa Fácil – JS Campinense
 * routes/equipas.js – Team + Player CRUD
 *
 * GET    /api/equipas                           – list all with player count
 * GET    /api/equipas/:id                       – team + players
 * POST   /api/equipas                           – create (auth)
 * PUT    /api/equipas/:id                       – update (auth)
 * DELETE /api/equipas/:id                       – delete (auth)
 * POST   /api/equipas/:id/jogadores             – add player (auth)
 * PUT    /api/equipas/:id/jogadores/:jId        – update player (auth)
 * DELETE /api/equipas/:id/jogadores/:jId        – remove player (auth)
 */

const express = require('express');
const { db } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ── LIST ALL ──────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const equipas = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM jogadores j WHERE j.equipa_id = e.id) AS num_jogadores
    FROM equipas e
    ORDER BY e.nome ASC
  `).all();
  res.json(equipas);
});

// ── SINGLE (with players) ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const equipa = db.prepare('SELECT * FROM equipas WHERE id = ?').get(req.params.id);
  if (!equipa) return res.status(404).json({ error: 'Equipa não encontrada.' });

  const jogadores = db.prepare(
    'SELECT * FROM jogadores WHERE equipa_id = ? ORDER BY numero ASC NULLS LAST, nome ASC'
  ).all(req.params.id);

  res.json({ ...equipa, jogadores });
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  const { nome, brasao, cor_principal } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });

  const result = db.prepare(`
    INSERT INTO equipas (nome, brasao, cor_principal)
    VALUES (?, ?, ?)
  `).run(nome, brasao || null, cor_principal || '#003B8E');

  const created = db.prepare('SELECT * FROM equipas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.put('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT * FROM equipas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Equipa não encontrada.' });

  const { nome, brasao, cor_principal } = req.body;
  db.prepare(`
    UPDATE equipas SET nome = ?, brasao = ?, cor_principal = ? WHERE id = ?
  `).run(
    nome ?? existing.nome,
    brasao !== undefined ? brasao : existing.brasao,
    cor_principal ?? existing.cor_principal,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM equipas WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT id FROM equipas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Equipa não encontrada.' });
  db.prepare('DELETE FROM equipas WHERE id = ?').run(req.params.id);
  res.json({ message: 'Equipa eliminada com sucesso.' });
});

// ── ADD PLAYER ────────────────────────────────────────────────────────────────
router.post('/:id/jogadores', auth, (req, res) => {
  const equipa = db.prepare('SELECT id FROM equipas WHERE id = ?').get(req.params.id);
  if (!equipa) return res.status(404).json({ error: 'Equipa não encontrada.' });

  const { nome, numero, posicao, data_nascimento, foto } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome do jogador é obrigatório.' });

  const result = db.prepare(`
    INSERT INTO jogadores (equipa_id, nome, numero, posicao, data_nascimento, foto)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, nome, numero || null, posicao || null, data_nascimento || null, foto || null);

  const created = db.prepare('SELECT * FROM jogadores WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// ── UPDATE PLAYER ─────────────────────────────────────────────────────────────
router.put('/:id/jogadores/:jId', auth, (req, res) => {
  const jogador = db.prepare(
    'SELECT * FROM jogadores WHERE id = ? AND equipa_id = ?'
  ).get(req.params.jId, req.params.id);

  if (!jogador) return res.status(404).json({ error: 'Jogador não encontrado.' });

  const { nome, numero, posicao, data_nascimento, foto } = req.body;
  db.prepare(`
    UPDATE jogadores
    SET nome = ?, numero = ?, posicao = ?, data_nascimento = ?, foto = ?
    WHERE id = ?
  `).run(
    nome ?? jogador.nome,
    numero !== undefined ? numero : jogador.numero,
    posicao !== undefined ? posicao : jogador.posicao,
    data_nascimento !== undefined ? data_nascimento : jogador.data_nascimento,
    foto !== undefined ? foto : jogador.foto,
    req.params.jId
  );

  const updated = db.prepare('SELECT * FROM jogadores WHERE id = ?').get(req.params.jId);
  res.json(updated);
});

// ── DELETE PLAYER ─────────────────────────────────────────────────────────────
router.delete('/:id/jogadores/:jId', auth, (req, res) => {
  const result = db.prepare(
    'DELETE FROM jogadores WHERE id = ? AND equipa_id = ?'
  ).run(req.params.jId, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Jogador não encontrado.' });
  }
  res.json({ message: 'Jogador removido com sucesso.' });
});

module.exports = router;
