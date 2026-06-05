/**
 * Copa Fácil – JS Campinense
 * routes/jogos.js – Match detail and result update
 *
 * GET /api/jogos/:id          – get match with team names
 * PUT /api/jogos/:id          – update result, date, local, estado (auth required)
 */

const express = require('express');
const { db } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ── GET SINGLE MATCH ──────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const jogo = db.prepare(`
    SELECT j.*,
      ec.nome AS equipa_casa_nome,
      ec.brasao AS equipa_casa_brasao,
      ec.cor_principal AS equipa_casa_cor,
      ef.nome AS equipa_fora_nome,
      ef.brasao AS equipa_fora_brasao,
      ef.cor_principal AS equipa_fora_cor,
      c.nome AS campeonato_nome
    FROM jogos j
    JOIN equipas ec ON ec.id = j.equipa_casa_id
    JOIN equipas ef ON ef.id = j.equipa_fora_id
    JOIN campeonatos c ON c.id = j.campeonato_id
    WHERE j.id = ?
  `).get(req.params.id);

  if (!jogo) return res.status(404).json({ error: 'Jogo não encontrado.' });
  res.json(jogo);
});

// ── UPDATE MATCH ──────────────────────────────────────────────────────────────
router.put('/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT * FROM jogos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Jogo não encontrado.' });

  const { gols_casa, gols_fora, data_jogo, local, estado, jornada, fase } = req.body;

  // Determine estado automatically if both goals provided and not explicitly set
  let novoEstado = estado !== undefined ? estado : existing.estado;
  const novosGolsCasa = gols_casa !== undefined ? Number(gols_casa) : existing.gols_casa;
  const novosGolsFora = gols_fora !== undefined ? Number(gols_fora) : existing.gols_fora;

  if (novosGolsCasa >= 0 && novosGolsFora >= 0 && estado === undefined) {
    novoEstado = 'terminado';
  }

  db.prepare(`
    UPDATE jogos
    SET gols_casa = ?,
        gols_fora = ?,
        data_jogo = ?,
        local = ?,
        estado = ?,
        jornada = ?,
        fase = ?
    WHERE id = ?
  `).run(
    novosGolsCasa,
    novosGolsFora,
    data_jogo !== undefined ? data_jogo : existing.data_jogo,
    local !== undefined ? local : existing.local,
    novoEstado,
    jornada !== undefined ? jornada : existing.jornada,
    fase !== undefined ? fase : existing.fase,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT j.*,
      ec.nome AS equipa_casa_nome,
      ec.brasao AS equipa_casa_brasao,
      ef.nome AS equipa_fora_nome,
      ef.brasao AS equipa_fora_brasao
    FROM jogos j
    JOIN equipas ec ON ec.id = j.equipa_casa_id
    JOIN equipas ef ON ef.id = j.equipa_fora_id
    WHERE j.id = ?
  `).get(req.params.id);

  res.json(updated);
});

module.exports = router;
