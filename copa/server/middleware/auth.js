/**
 * Copa Fácil – JS Campinense
 * middleware/auth.js – JWT verification middleware
 *
 * Reads the Authorization: Bearer <token> header, verifies it and
 * attaches req.user = { id, username, role } on success.
 * Returns 401 if the token is missing or invalid.
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'copa_secret_2024';

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = authMiddleware;
