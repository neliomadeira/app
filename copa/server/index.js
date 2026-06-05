/**
 * Copa Fácil – JS Campinense
 * index.js – Express server entry point
 *
 * Mounts routes:
 *   /api/auth        → routes/auth.js
 *   /api/campeonatos → routes/campeonatos.js
 *   /api/equipas     → routes/equipas.js
 *   /api/jogos       → routes/jogos.js
 *
 * In production, serves the Vite build from ../client/dist
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const campeonatosRoutes = require('./routes/campeonatos');
const equipasRoutes = require('./routes/equipas');
const jogosRoutes = require('./routes/jogos');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/campeonatos', campeonatosRoutes);
app.use('/api/equipas', equipasRoutes);
app.use('/api/jogos', jogosRoutes);

// ── Production static files ───────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use('/copa', express.static(distPath));
  app.get('/copa/*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`Copa Fácil server running on http://localhost:${PORT}`);
});
