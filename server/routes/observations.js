'use strict';

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getAllObservations, getObservation } = require('../services/csvLoader');

const router = express.Router();

/**
 * GET /api/observations
 * Auth required.
 * Returns an array of observation summary objects.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const observations = await getAllObservations();
    return res.json(observations);
  } catch (err) {
    console.error('GET /observations error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load observations' });
  }
});

/**
 * GET /api/observations/:id
 * Auth required.
 * Returns the full CSV row for the given unique_id_calc.
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const observation = await getObservation(id);

    if (!observation) {
      return res.status(404).json({ error: `Observation not found: ${id}` });
    }

    return res.json(observation);
  } catch (err) {
    console.error('GET /observations/:id error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load observation' });
  }
});

module.exports = router;
