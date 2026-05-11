'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const {
  getSessionState,
  appendReview,
  upsertClaim,
  deleteClaim,
  getClaim,
  getCompletedReviews,
} = require('../services/googleSheets');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates overall compliance percentage from a verdicts object.
 * verdicts = { sectionKey: { itemKey: "correct" | "incorrect" | "skip", ... }, ... }
 * Returns a number 0-100 rounded to 1 decimal place.
 */
function calculateCompliance(verdicts) {
  if (!verdicts || typeof verdicts !== 'object') return 0;

  let totalItems = 0;
  let correctItems = 0;

  for (const sectionKey of Object.keys(verdicts)) {
    const sectionVerdicts = verdicts[sectionKey];
    if (!sectionVerdicts || typeof sectionVerdicts !== 'object') continue;

    for (const itemKey of Object.keys(sectionVerdicts)) {
      const verdict = sectionVerdicts[itemKey];
      // Only count non-skipped items
      if (verdict === 'correct' || verdict === 'incorrect') {
        totalItems++;
        if (verdict === 'correct') correctItems++;
      }
    }
  }

  if (totalItems === 0) return 0;
  return Math.round((correctItems / totalItems) * 1000) / 10; // round to 1 decimal
}

// ---------------------------------------------------------------------------
// GET /api/session
// ---------------------------------------------------------------------------

/**
 * GET /api/session
 * Auth required.
 * Returns current session state: completed reviews, active claims, drafts.
 */
router.get('/session', authMiddleware, async (req, res) => {
  try {
    const state = await getSessionState();
    return res.json(state);
  } catch (err) {
    console.error('GET /session error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get session state' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/claim
// ---------------------------------------------------------------------------

/**
 * POST /api/claim
 * Auth required.
 * Body: { unique_id_calc, audio_filename, audio_file_id }
 */
router.post('/claim', authMiddleware, async (req, res) => {
  try {
    const { unique_id_calc, audio_filename, audio_file_id } = req.body;
    const reviewer = req.user.username;

    if (!unique_id_calc || !audio_filename || !audio_file_id) {
      return res.status(400).json({
        error: 'unique_id_calc, audio_filename, and audio_file_id are required',
      });
    }

    // Check if already claimed or completed
    const state = await getSessionState();

    if (state.completed.includes(unique_id_calc)) {
      return res.status(409).json({ error: 'This observation has already been completed' });
    }

    const existingClaim = state.claimed.find((c) => c.unique_id_calc === unique_id_calc);
    if (existingClaim) {
      return res.status(409).json({
        error: `This observation is already claimed by ${existingClaim.reviewer}`,
      });
    }

    const existingDraft = state.drafts.find((c) => c.unique_id_calc === unique_id_calc);
    if (existingDraft) {
      return res.status(409).json({
        error: `This observation has a draft in progress by ${existingDraft.reviewer}`,
      });
    }

    const claimRecord = {
      unique_id_calc,
      audio_filename,
      audio_file_id,
      reviewer,
      claimed_at: new Date().toISOString(),
      status: 'claimed',
      draft_data_json: '',
    };

    await upsertClaim(claimRecord);

    return res.status(201).json(claimRecord);
  } catch (err) {
    console.error('POST /claim error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create claim' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/claim/:unique_id_calc
// ---------------------------------------------------------------------------

/**
 * DELETE /api/claim/:unique_id_calc
 * Auth required. Only the owning reviewer can delete their claim.
 */
router.delete('/claim/:unique_id_calc', authMiddleware, async (req, res) => {
  try {
    const { unique_id_calc } = req.params;
    const reviewer = req.user.username;

    const claim = await getClaim(unique_id_calc);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.reviewer !== reviewer) {
      return res.status(403).json({ error: 'You can only delete your own claims' });
    }

    await deleteClaim(unique_id_calc);
    return res.json({ success: true, unique_id_calc });
  } catch (err) {
    console.error('DELETE /claim/:unique_id_calc error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete claim' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/reviews
// ---------------------------------------------------------------------------

/**
 * POST /api/reviews
 * Auth required.
 * Body: {
 *   unique_id_calc, audio_filename, status ("draft"|"complete"),
 *   sections_reviewed, verdicts, section_comments, overall_comment
 * }
 */
router.post('/reviews', authMiddleware, async (req, res) => {
  try {
    const {
      unique_id_calc,
      audio_filename,
      status,
      sections_reviewed = [],
      verdicts = {},
      section_comments = {},
      overall_comment = '',
    } = req.body;

    const reviewer = req.user.username;

    if (!unique_id_calc || !audio_filename) {
      return res.status(400).json({ error: 'unique_id_calc and audio_filename are required' });
    }

    if (!['draft', 'complete'].includes(status)) {
      return res.status(400).json({ error: 'status must be "draft" or "complete"' });
    }

    // Calculate compliance
    const overall_compliance_pct = calculateCompliance(verdicts);
    const flagged = overall_compliance_pct < 85;

    const review_timestamp = new Date().toISOString();

    if (status === 'draft') {
      // Upsert a draft into the Claims tab
      const existingClaim = await getClaim(unique_id_calc);
      const claimed_at = existingClaim ? existingClaim.claimed_at : review_timestamp;
      const audio_file_id = existingClaim ? existingClaim.audio_file_id : '';

      const draftData = {
        sections_reviewed,
        verdicts,
        section_comments,
        overall_comment,
        overall_compliance_pct,
        flagged,
        updated_at: review_timestamp,
      };

      const claimRecord = {
        unique_id_calc,
        audio_filename,
        audio_file_id,
        reviewer,
        claimed_at,
        status: 'draft',
        draft_data_json: JSON.stringify(draftData),
      };

      await upsertClaim(claimRecord);

      return res.json({
        unique_id_calc,
        audio_filename,
        reviewer,
        status: 'draft',
        overall_compliance_pct,
        flagged,
        sections_reviewed,
        verdicts,
        section_comments,
        overall_comment,
        updated_at: review_timestamp,
      });
    }

    // status === 'complete'
    const review_id = uuidv4();

    const reviewRow = {
      review_id,
      unique_id_calc,
      audio_filename,
      reviewer,
      review_timestamp,
      status: 'complete',
      sections_reviewed: sections_reviewed.join(','),
      overall_compliance_pct,
      flagged: flagged ? 'true' : 'false',
      overall_comment,
      verdicts_json: JSON.stringify(verdicts),
      comments_json: JSON.stringify(section_comments),
    };

    // Append to Reviews tab and remove from Claims tab (in parallel)
    await Promise.all([
      appendReview(reviewRow),
      deleteClaim(unique_id_calc),
    ]);

    return res.status(201).json({
      review_id,
      unique_id_calc,
      audio_filename,
      reviewer,
      review_timestamp,
      status: 'complete',
      sections_reviewed,
      overall_compliance_pct,
      flagged,
      overall_comment,
      verdicts,
      section_comments,
    });
  } catch (err) {
    console.error('POST /reviews error:', err);
    return res.status(500).json({ error: err.message || 'Failed to save review' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reviews/mine
// ---------------------------------------------------------------------------

/**
 * GET /api/reviews/mine
 * Auth required.
 * Returns all complete reviews + drafts belonging to the current user.
 */
router.get('/reviews/mine', authMiddleware, async (req, res) => {
  try {
    const reviewer = req.user.username;
    const [state, allReviews] = await Promise.all([
      getSessionState(),
      getCompletedReviews(),
    ]);
    const myCompleted = allReviews
      .filter((r) => r.reviewer === reviewer)
      .map((r) => ({
        ...r,
        sections_reviewed: r.sections_reviewed
          ? r.sections_reviewed.split(',').filter(Boolean)
          : [],
        verdicts: safeParseJSON(r.verdicts_json, {}),
        section_comments: safeParseJSON(r.comments_json, {}),
        flagged: r.flagged === 'true',
        overall_compliance_pct: parseFloat(r.overall_compliance_pct) || 0,
      }));

    const myDrafts = state.drafts
      .filter((d) => d.reviewer === reviewer)
      .map((d) => ({
        unique_id_calc: d.unique_id_calc,
        audio_filename: d.audio_filename,
        reviewer: d.reviewer,
        status: 'draft',
        ...(d.draft_data || {}),
      }));

    return res.json({ completed: myCompleted, drafts: myDrafts });
  } catch (err) {
    console.error('GET /reviews/mine error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load reviews' });
  }
});

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = router;
