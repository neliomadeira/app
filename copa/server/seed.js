/**
 * Copa Fácil – JS Campinense
 * seed.js – Populate the database with initial demo data
 *
 * Run with: npm run seed
 *
 * Seeds:
 *   - 1 admin user (admin / copa2024)
 *   - 2 campeonatos
 *   - 4 equipas with players
 *   - Team associations
 *   - Fixtures (with results for the terminated campeonato)
 */

const bcrypt = require('bcryptjs');
const { db } = require('./db');

console.log('Seeding database...');

// ── Wipe existing data ────────────────────────────────────────────────────────
db.exec(`
  DELETE FROM jogos;
  DELETE FROM campeonato_equipas;
  DELETE FROM jogadores;
  DELETE FROM equipas;
  DELETE FROM campeonatos;
  DELETE FROM utilizadores;
`);

// ── Admin user ────────────────────────────────────────────────────────────────
const hashedPassword = bcrypt.hashSync('copa2024', 10);
const adminId = db.prepare(
  'INSERT INTO utilizadores (username, password, role) VALUES (?, ?, ?)'
).run('admin', hashedPassword, 'admin').lastInsertRowid;

console.log(`Created admin user (id=${adminId})`);

// ── Campeonatos ───────────────────────────────────────────────────────────────
const campeonato1Id = db.prepare(`
  INSERT INTO campeonatos (nome, modalidade, formato, epoca, descricao, estado)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  'Torneio de Verão 2025',
  'Futebol 11',
  'liga',
  '2025',
  'Torneio anual de Verão do JS Campinense. Disputado entre os clubes da região de Loulé.',
  'em_curso'
).lastInsertRowid;

const campeonato2Id = db.prepare(`
  INSERT INTO campeonatos (nome, modalidade, formato, epoca, descricao, estado)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  'Taça Juventude 2024',
  'Futebol 11',
  'eliminatorias',
  '2024',
  'Taça da Juventude 2024 – fase eliminatória entre os melhores clubes juvenis do Algarve.',
  'terminado'
).lastInsertRowid;

console.log(`Created campeonatos (ids=${campeonato1Id}, ${campeonato2Id})`);

// ── Equipas ───────────────────────────────────────────────────────────────────
const equipas = [
  { nome: 'JS Campinense',  brasao: '🏆', cor: '#FFD100' },
  { nome: 'Sporting Loulé', brasao: '⚽', cor: '#009A44' },
  { nome: 'FC Almancil',    brasao: '🔵', cor: '#0000CD' },
  { nome: 'Olhanense',      brasao: '🔴', cor: '#CC0000' },
];

const equipaIds = equipas.map(e =>
  db.prepare('INSERT INTO equipas (nome, brasao, cor_principal) VALUES (?, ?, ?)').run(e.nome, e.brasao, e.cor).lastInsertRowid
);

console.log(`Created equipas (ids=${equipaIds.join(', ')})`);

// ── Players ───────────────────────────────────────────────────────────────────
const jogadoresPorEquipa = [
  // JS Campinense
  [
    { nome: 'Ricardo Ferreira', numero: 1,  posicao: 'GR' },
    { nome: 'Miguel Santos',    numero: 2,  posicao: 'DD' },
    { nome: 'André Costa',      numero: 4,  posicao: 'DC' },
    { nome: 'Luís Pereira',     numero: 5,  posicao: 'DC' },
    { nome: 'Tiago Almeida',    numero: 3,  posicao: 'DE' },
    { nome: 'João Faria',       numero: 6,  posicao: 'MCD' },
    { nome: 'Carlos Neto',      numero: 8,  posicao: 'MC' },
    { nome: 'Rui Guerreiro',    numero: 10, posicao: 'MCO' },
    { nome: 'Bruno Gomes',      numero: 7,  posicao: 'ED' },
    { nome: 'Pedro Tavares',    numero: 11, posicao: 'EE' },
    { nome: 'Marco Silva',      numero: 9,  posicao: 'AV' },
  ],
  // Sporting Loulé
  [
    { nome: 'Hugo Martins',     numero: 1,  posicao: 'GR' },
    { nome: 'Filipe Correia',   numero: 2,  posicao: 'DD' },
    { nome: 'Sérgio Lopes',     numero: 5,  posicao: 'DC' },
    { nome: 'Nuno Freitas',     numero: 4,  posicao: 'DC' },
    { nome: 'Rafael Pinto',     numero: 3,  posicao: 'DE' },
    { nome: 'Daniel Mota',      numero: 8,  posicao: 'MC' },
    { nome: 'Vítor Sousa',      numero: 6,  posicao: 'MCD' },
    { nome: 'Gonçalo Brito',    numero: 10, posicao: 'MCO' },
    { nome: 'Eduardo Rocha',    numero: 7,  posicao: 'ED' },
    { nome: 'Diogo Carvalho',   numero: 11, posicao: 'AV' },
    { nome: 'Fernando Cruz',    numero: 9,  posicao: 'PL' },
  ],
  // FC Almancil
  [
    { nome: 'Artur Henriques',  numero: 1,  posicao: 'GR' },
    { nome: 'Paulo Monteiro',   numero: 2,  posicao: 'DD' },
    { nome: 'Jorge Cunha',      numero: 5,  posicao: 'DC' },
    { nome: 'Cláudio Reis',     numero: 4,  posicao: 'DC' },
    { nome: 'Tomás Vieira',     numero: 3,  posicao: 'DE' },
    { nome: 'Manuel Barbosa',   numero: 6,  posicao: 'MC' },
    { nome: 'Óscar Marques',    numero: 8,  posicao: 'MC' },
    { nome: 'Hélder Morais',    numero: 10, posicao: 'MCO' },
    { nome: 'Vasco Araújo',     numero: 7,  posicao: 'ED' },
    { nome: 'Bernardo Fonseca', numero: 11, posicao: 'EE' },
    { nome: 'Ângelo Dias',      numero: 9,  posicao: 'AV' },
  ],
  // Olhanense
  [
    { nome: 'Fábio Nascimento', numero: 1,  posicao: 'GR' },
    { nome: 'Nelson Cabral',    numero: 2,  posicao: 'DD' },
    { nome: 'Álvaro Leite',     numero: 5,  posicao: 'DC' },
    { nome: 'Renato Esteves',   numero: 4,  posicao: 'DC' },
    { nome: 'Mário Rodrigues',  numero: 3,  posicao: 'DE' },
    { nome: 'Simão Pacheco',    numero: 6,  posicao: 'MCD' },
    { nome: 'Leandro Teixeira', numero: 8,  posicao: 'MC' },
    { nome: 'Marcos Antunes',   numero: 10, posicao: 'MCO' },
    { nome: 'David Fragoso',    numero: 7,  posicao: 'ED' },
    { nome: 'Kévin Valente',    numero: 11, posicao: 'EE' },
    { nome: 'Joel Brandão',     numero: 9,  posicao: 'PL' },
  ],
];

jogadoresPorEquipa.forEach((players, idx) => {
  players.forEach(p => {
    db.prepare(`
      INSERT INTO jogadores (equipa_id, nome, numero, posicao)
      VALUES (?, ?, ?, ?)
    `).run(equipaIds[idx], p.nome, p.numero, p.posicao);
  });
});

console.log('Created players for all teams');

// ── Associate teams with campeonatos ──────────────────────────────────────────
// Torneio Verão 2025 – all 4 teams
equipaIds.forEach(eId => {
  db.prepare('INSERT INTO campeonato_equipas (campeonato_id, equipa_id) VALUES (?, ?)').run(campeonato1Id, eId);
});

// Taça Juventude 2024 – all 4 teams
equipaIds.forEach(eId => {
  db.prepare('INSERT INTO campeonato_equipas (campeonato_id, equipa_id) VALUES (?, ?)').run(campeonato2Id, eId);
});

console.log('Associated teams with campeonatos');

// ── Generate round-robin fixtures for Torneio Verão 2025 (em_curso) ──────────
const [e1, e2, e3, e4] = equipaIds;

// Round-robin for 4 teams: 3 jornadas, 2 jogos each = 6 jogos total
// Jornada 1: e1 vs e2, e3 vs e4
// Jornada 2: e1 vs e3, e2 vs e4
// Jornada 3: e1 vs e4, e2 vs e3
const fixturesVerao = [
  { casa: e1, fora: e2, jornada: 1, data: '2025-07-05', gols_casa: 2, gols_fora: 1, estado: 'terminado' },
  { casa: e3, fora: e4, jornada: 1, data: '2025-07-05', gols_casa: 0, gols_fora: 0, estado: 'terminado' },
  { casa: e1, fora: e3, jornada: 2, data: '2025-07-12', gols_casa: 1, gols_fora: 1, estado: 'terminado' },
  { casa: e2, fora: e4, jornada: 2, data: '2025-07-12', gols_casa: 3, gols_fora: 2, estado: 'terminado' },
  { casa: e1, fora: e4, jornada: 3, data: '2025-07-19', gols_casa: -1, gols_fora: -1, estado: 'agendado' },
  { casa: e2, fora: e3, jornada: 3, data: '2025-07-19', gols_casa: -1, gols_fora: -1, estado: 'agendado' },
];

fixturesVerao.forEach(f => {
  db.prepare(`
    INSERT INTO jogos (campeonato_id, equipa_casa_id, equipa_fora_id, jornada, data_jogo, gols_casa, gols_fora, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(campeonato1Id, f.casa, f.fora, f.jornada, f.data, f.gols_casa, f.gols_fora, f.estado);
});

// ── Fixtures for Taça Juventude 2024 (terminado) ─────────────────────────────
const fichasJuventude = [
  { casa: e1, fora: e3, jornada: 1, fase: 'Meias-Finais', data: '2024-11-02', gols_casa: 3, gols_fora: 1, estado: 'terminado' },
  { casa: e2, fora: e4, jornada: 1, fase: 'Meias-Finais', data: '2024-11-02', gols_casa: 1, gols_fora: 2, estado: 'terminado' },
  { casa: e1, fora: e4, jornada: 2, fase: 'Final',        data: '2024-11-16', gols_casa: 2, gols_fora: 0, estado: 'terminado' },
  { casa: e2, fora: e3, jornada: 2, fase: '3.º/4.º Lugar',data: '2024-11-16', gols_casa: 1, gols_fora: 3, estado: 'terminado' },
];

fichasJuventude.forEach(f => {
  db.prepare(`
    INSERT INTO jogos (campeonato_id, equipa_casa_id, equipa_fora_id, jornada, fase, data_jogo, gols_casa, gols_fora, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(campeonato2Id, f.casa, f.fora, f.jornada, f.fase, f.data, f.gols_casa, f.gols_fora, f.estado);
});

console.log('Generated fixtures and results');
console.log('');
console.log('Seed complete!');
console.log('  Admin login: admin / copa2024');
console.log(`  Campeonatos: ${campeonato1Id}, ${campeonato2Id}`);
console.log(`  Equipas:     ${equipaIds.join(', ')}`);
