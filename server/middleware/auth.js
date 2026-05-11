'use strict';

const jwt = require('jsonwebtoken');

/**
 * Authentication middleware.
 * Accepts a JWT from:
 *   1. Authorization: Bearer <token>  header
 *   2. ?token=<token>  query parameter (needed for <audio src="..."> streaming)
 */
function authMiddleware(req, res, next) {
  let token = null;

  // 1. Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Fallback to query param
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { username, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
