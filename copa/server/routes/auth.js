/**
 * Copa Fácil – JS Campinense
 * routes/auth.js – Authentication endpoints
 *
 * POST /api/auth/login  – validate credentials, return JWT
 * GET  /api/auth/me     – return current user info (requires JWT)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'copa_secret_2024';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password são obrigatórios.' });
  }

  const user = db.prepare('SELECT * FROM utilizadores WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM utilizadores WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
  res.json({ user });
});

module.exports = router;
