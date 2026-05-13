'use strict';

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { listAudioFiles, streamFile } = require('../services/googleDrive');
const { getAllObservations, extractAudioFilenameSegment } = require('../services/csvLoader');
const { getSessionState } = require('../services/googleSheets');

const router = express.Router();

/**
 * GET /api/audio/files
 * Auth required.
 * Lists all files in the Drive folder and attempts to match each to an observation.
 *
 * Matching logic:
 *   Drive filename.contains(audio_filename_segment extracted from audio_comp)
 */
router.get('/files', authMiddleware, async (req, res) => {
  try {
    const [driveFiles, observations, sessionState] = await Promise.all([
      listAudioFiles(),
      Promise.resolve(getAllObservations()),
      getSessionState(),
    ]);

    // Build draft_data lookup keyed by unique_id_calc
    const draftMap = new Map();
    for (const draft of sessionState.drafts || []) {
      if (draft.unique_id_calc) {
        draftMap.set(draft.unique_id_calc, draft.draft_data);
      }
    }

    const completedSet = new Set(sessionState.completed || []);
    const claimedSet = new Set((sessionState.claimed || []).map((c) => c.unique_id_calc));

    // Build a lookup: audio_filename_segment -> unique_id_calc
    // (segment is the "AA_<UUID>_enumerator.m4a" part)
    const segmentMap = new Map();
    for (const obs of observations) {
      if (obs.audio_filename_segment) {
        segmentMap.set(obs.audio_filename_segment, obs.unique_id_calc);
      }
    }

    // Build a lookup: unique_id_calc -> observation summary (for school_name)
    const obsMap = new Map();
    for (const obs of observations) {
      obsMap.set(obs.unique_id_calc, obs);
    }

    const result = driveFiles.map((file) => {
      let unique_id_calc = null;

      for (const [segment, uid] of segmentMap.entries()) {
        if (file.filename.includes(segment)) {
          unique_id_calc = uid;
          break;
        }
      }

      const obs = unique_id_calc ? obsMap.get(unique_id_calc) : null;

      const status = unique_id_calc
        ? completedSet.has(unique_id_calc) ? 'complete'
          : draftMap.has(unique_id_calc) ? 'draft'
          : claimedSet.has(unique_id_calc) ? 'claimed'
          : 'available'
        : 'available';

      return {
        audio_file_id: file.fileId,
        audio_filename: file.filename,
        unique_id_calc,
        school_name: obs ? obs.school_name : null,
        enumerator_name: obs ? obs.enumerator_name : null,
        mimeType: file.mimeType,
        size: file.size,
        status,
        draft_data: unique_id_calc ? (draftMap.get(unique_id_calc) || null) : null,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('GET /audio/files error:', err);
    return res.status(500).json({ error: err.message || 'Failed to list audio files' });
  }
});

/**
 * GET /api/audio/stream/:fileId
 * Auth via query param ?token=<jwt> (so it can be used as <audio src="...">).
 * Streams the audio file from Drive with Range request support.
 */
router.get('/stream/:fileId', authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const rangeHeader = req.headers['range'] || null;

    await streamFile(fileId, res, rangeHeader);
  } catch (err) {
    console.error('GET /audio/stream/:fileId error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'Failed to stream audio file' });
    }
  }
});

module.exports = router;
