'use strict';

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// In-memory cache
let _observations = null; // full parsed rows as array of objects
let _byId = null;         // Map<unique_id_calc, row>

// Summary fields returned by getAllObservations()
const SUMMARY_FIELDS = [
  'unique_id_calc',
  'enumerator_name',
  'school_name',
  'emis_code',
  'caseid',
  'SubmissionDate',
  'audio_comp',
];

/**
 * Loads and parses the CSV file on first call, then caches the result.
 * Returns { observations, byId }.
 */
function loadCSV() {
  if (_observations !== null) {
    return { observations: _observations, byId: _byId };
  }

  const csvPath = path.resolve(__dirname, '..', process.env.CSV_PATH || '../EGRA_EGMA_Combine_WIDE.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');

  const result = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // keep everything as strings to avoid data loss
  });

  if (result.errors && result.errors.length > 0) {
    // Log non-fatal parse warnings but continue
    console.warn(`CSV parse warnings (${result.errors.length}):`, result.errors.slice(0, 3));
  }

  _observations = result.data;
  _byId = new Map(_observations.map((row) => [row['unique_id_calc'], row]));

  console.log(`CSV loaded: ${_observations.length} observations, ${Object.keys(_observations[0] || {}).length} columns`);

  return { observations: _observations, byId: _byId };
}

/**
 * Extracts the `file=` query parameter value from a SurveyCTO audio_comp URL.
 * Example input:
 *   https://akademos2021.surveycto.com/view/submission-attachment/?uuid=uuid%3A75469b92-...&file=AA_75469b92-e2a1-44e3-bf25-bf5c6e52a03b_enumerator.m4a
 * Returns:
 *   "AA_75469b92-e2a1-44e3-bf25-bf5c6e52a03b_enumerator.m4a"
 * Returns null if not parseable.
 */
function extractAudioFilenameSegment(audio_comp) {
  if (!audio_comp || typeof audio_comp !== 'string') return null;

  try {
    // The URL may not have a proper host if it's stored without protocol — try as-is first
    let url;
    try {
      url = new URL(audio_comp);
    } catch {
      // Try prepending https:// as fallback
      url = new URL('https://' + audio_comp);
    }

    const fileParam = url.searchParams.get('file');
    if (fileParam) return fileParam;

    // Manual fallback: search for "file=" in the raw string
    const match = audio_comp.match(/[?&]file=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);

    return null;
  } catch {
    // Manual fallback
    const match = audio_comp.match(/[?&]file=([^&]+)/);
    if (match) {
      try { return decodeURIComponent(match[1]); } catch { return match[1]; }
    }
    return null;
  }
}

/**
 * Returns an array of summary objects (key fields only + audio_filename_segment).
 * Filters out rows with no unique_id_calc.
 */
function getAllObservations() {
  const { observations } = loadCSV();

  return observations
    .filter((row) => row['unique_id_calc'])
    .map((row) => {
      const summary = {};
      for (const field of SUMMARY_FIELDS) {
        summary[field] = row[field] || '';
      }
      summary.audio_filename_segment = extractAudioFilenameSegment(row['audio_comp']);
      return summary;
    });
}

/**
 * Returns the full row object for a given unique_id_calc, or null if not found.
 */
function getObservation(unique_id_calc) {
  const { byId } = loadCSV();
  return byId.get(unique_id_calc) || null;
}

module.exports = {
  getAllObservations,
  getObservation,
  extractAudioFilenameSegment,
};
