'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, username }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    // Parse users from env var
    let users;
    try {
      users = JSON.parse(process.env.USERS || '[]');
    } catch (err) {
      console.error('Failed to parse USERS env var:', err.message);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Find user (case-insensitive username match)
    const user = users.find(
      (u) => u.username && u.username.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue JWT (24-hour expiry)
    const token = jwt.sign(
      { username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
