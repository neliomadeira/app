/**
 * Copa Fácil – JS Campinense
 * db.js – SQLite database setup via better-sqlite3
 *
 * Tables:
 *   campeonatos, equipas, jogadores, campeonato_equipas, jogos, utilizadores
 *
 * Also exports calcularClassificacao(campeonatoId) which computes the full
 * standings for a league (pontos, vitórias, empates, derrotas, golos marcados,
 * golos sofridos, diferença de golos).  Sorted by: pts DESC → DG DESC → GM DESC.
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'copa.db');

const db = new Database(DB_PATH);

// Enable WAL for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ────────────────────────────────────────────────
// Schema creation
// ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS campeonatos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nome         TEXT    NOT NULL,
    modalidade   TEXT    NOT NULL DEFAULT 'Futebol 11',
    formato      TEXT    NOT NULL DEFAULT 'liga'
                          CHECK(formato IN ('liga','eliminatorias','grupos')),
    epoca        TEXT    NOT NULL,
    descricao    TEXT,
    estado       TEXT    NOT NULL DEFAULT 'por_iniciar'
                          CHECK(estado IN ('em_curso','terminado','por_iniciar')),
    logo         TEXT,
    criado_em    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS equipas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT    NOT NULL,
    brasao         TEXT,
    cor_principal  TEXT    DEFAULT '#003B8E',
    criado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jogadores (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    equipa_id        INTEGER NOT NULL REFERENCES equipas(id) ON DELETE CASCADE,
    nome             TEXT    NOT NULL,
    numero           INTEGER,
    posicao          TEXT,
    data_nascimento  TEXT,
    foto             TEXT
  );

  CREATE TABLE IF NOT EXISTS campeonato_equipas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    campeonato_id  INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
    equipa_id      INTEGER NOT NULL REFERENCES equipas(id)     ON DELETE CASCADE,
    UNIQUE(campeonato_id, equipa_id)
  );

  CREATE TABLE IF NOT EXISTS jogos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    campeonato_id  INTEGER NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
    equipa_casa_id INTEGER NOT NULL REFERENCES equipas(id),
    equipa_fora_id INTEGER NOT NULL REFERENCES equipas(id),
    data_jogo      TEXT,
    local          TEXT,
    gols_casa      INTEGER NOT NULL DEFAULT -1,
    gols_fora      INTEGER NOT NULL DEFAULT -1,
    estado         TEXT    NOT NULL DEFAULT 'agendado'
                            CHECK(estado IN ('agendado','terminado')),
    jornada        INTEGER,
    fase           TEXT
  );

  CREATE TABLE IF NOT EXISTS utilizadores (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT    NOT NULL UNIQUE,
    password  TEXT    NOT NULL,
    role      TEXT    NOT NULL DEFAULT 'admin'
  );
`);

// ────────────────────────────────────────────────
// calcularClassificacao
// ────────────────────────────────────────────────
/**
 * Computes league standings for a given campeonato.
 *
 * Only finished matches (estado = 'terminado', gols >= 0) are counted.
 *
 * Returns an array of objects sorted by:
 *   1. pontos DESC
 *   2. diferenca_golos DESC
 *   3. gols_marcados DESC
 *   4. nome ASC (tiebreaker)
 *
 * @param {number} campeonatoId
 * @returns {Array<{equipa_id, nome, brasao, cor_principal, jogos, vitorias, empates, derrotas, gols_marcados, gols_sofridos, diferenca_golos, pontos}>}
 */
function calcularClassificacao(campeonatoId) {
  // Fetch all teams registered in this campeonato
  const equipas = db.prepare(`
    SELECT e.id, e.nome, e.brasao, e.cor_principal
    FROM campeonato_equipas ce
    JOIN equipas e ON e.id = ce.equipa_id
    WHERE ce.campeonato_id = ?
  `).all(campeonatoId);

  // Fetch finished matches only
  const jogosTerminados = db.prepare(`
    SELECT id, equipa_casa_id, equipa_fora_id, gols_casa, gols_fora
    FROM jogos
    WHERE campeonato_id = ?
      AND estado = 'terminado'
      AND gols_casa >= 0
      AND gols_fora >= 0
  `).all(campeonatoId);

  // Build a map: equipa_id -> stats
  const stats = {};
  for (const eq of equipas) {
    stats[eq.id] = {
      equipa_id: eq.id,
      nome: eq.nome,
      brasao: eq.brasao,
      cor_principal: eq.cor_principal,
      jogos: 0,
      vitorias: 0,
      empates: 0,
      derrotas: 0,
      gols_marcados: 0,
      gols_sofridos: 0,
      diferenca_golos: 0,
      pontos: 0
    };
  }

  for (const jogo of jogosTerminados) {
    const casa = stats[jogo.equipa_casa_id];
    const fora = stats[jogo.equipa_fora_id];

    if (!casa || !fora) continue; // team not in this campeonato

    casa.jogos++;
    fora.jogos++;
    casa.gols_marcados += jogo.gols_casa;
    casa.gols_sofridos += jogo.gols_fora;
    fora.gols_marcados += jogo.gols_fora;
    fora.gols_sofridos += jogo.gols_casa;

    if (jogo.gols_casa > jogo.gols_fora) {
      // Casa wins
      casa.vitorias++;
      casa.pontos += 3;
      fora.derrotas++;
    } else if (jogo.gols_casa < jogo.gols_fora) {
      // Fora wins
      fora.vitorias++;
      fora.pontos += 3;
      casa.derrotas++;
    } else {
      // Draw
      casa.empates++;
      fora.empates++;
      casa.pontos += 1;
      fora.pontos += 1;
    }
  }

  // Compute goal difference
  const table = Object.values(stats).map(s => ({
    ...s,
    diferenca_golos: s.gols_marcados - s.gols_sofridos
  }));

  // Sort
  table.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.diferenca_golos !== a.diferenca_golos) return b.diferenca_golos - a.diferenca_golos;
    if (b.gols_marcados !== a.gols_marcados) return b.gols_marcados - a.gols_marcados;
    return a.nome.localeCompare(b.nome);
  });

  return table;
}

module.exports = { db, calcularClassificacao };
