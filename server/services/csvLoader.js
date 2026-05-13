'use strict';

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Cache only summary fields — avoids holding 1000+ columns × 19K rows in memory
let _summaries = null;       // array of summary objects
let _summaryById = null;     // Map<unique_id_calc, summary>
let _loadPromise = null;     // deduplicates concurrent startup calls

const SUMMARY_FIELDS = [
  'unique_id_calc',
  'enumerator_name',
  'school_name',
  'emis_code',
  'caseid',
  'SubmissionDate',
  'audio_comp',
];

function getCsvPath() {
  return path.resolve(__dirname, '..', process.env.CSV_PATH || '../EGRA_EGMA_Combine_WIDE.csv');
}

/**
 * Streams the CSV and builds the summary cache.
 * Called once; subsequent calls return the already-resolved promise.
 */
function ensureLoaded() {
  if (_summaries !== null) return Promise.resolve();
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve, reject) => {
    const csvPath = getCsvPath();

    if (!fs.existsSync(csvPath)) {
      return reject(new Error(`CSV file not found at: ${csvPath}`));
    }

    const summaries = [];
    const stream = fs.createReadStream(csvPath, { encoding: 'utf8' });

    Papa.parse(stream, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      step(results) {
        const row = results.data;
        if (!row['unique_id_calc']) return;
        const summary = {};
        for (const field of SUMMARY_FIELDS) {
          summary[field] = row[field] || '';
        }
        summary.audio_filename_segment = extractAudioFilenameSegment(row['audio_comp']);
        summaries.push(summary);
      },
      complete() {
        _summaries = summaries;
        _summaryById = new Map(summaries.map((s) => [s.unique_id_calc, s]));
        console.log(`CSV loaded: ${_summaries.length} observations (summary fields only)`);
        resolve();
      },
      error(err) {
        _loadPromise = null; // allow retry on next request
        reject(err);
      },
    });
  });

  return _loadPromise;
}

/**
 * Extracts the `file=` query parameter from a SurveyCTO audio_comp URL.
 * Returns null if not parseable.
 */
function extractAudioFilenameSegment(audio_comp) {
  if (!audio_comp || typeof audio_comp !== 'string') return null;
  try {
    let url;
    try { url = new URL(audio_comp); } catch { url = new URL('https://' + audio_comp); }
    const fileParam = url.searchParams.get('file');
    if (fileParam) return fileParam;
    const match = audio_comp.match(/[?&]file=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  } catch {
    const match = audio_comp.match(/[?&]file=([^&]+)/);
    if (match) {
      try { return decodeURIComponent(match[1]); } catch { return match[1]; }
    }
    return null;
  }
}

/**
 * Returns summary objects for all observations (key fields + audio_filename_segment).
 */
async function getAllObservations() {
  await ensureLoaded();
  return _summaries;
}

/**
 * Streams the CSV to find and return the full row for the given unique_id_calc.
 * Does not cache full rows — avoids the memory spike from 1000+ columns × 19K rows.
 */
function getObservation(unique_id_calc) {
  return new Promise((resolve, reject) => {
    const csvPath = getCsvPath();
    const stream = fs.createReadStream(csvPath, { encoding: 'utf8' });
    let found = false;

    Papa.parse(stream, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      step(results, parser) {
        if (results.data['unique_id_calc'] === unique_id_calc) {
          found = true;
          resolve(results.data);
          parser.abort();
        }
      },
      complete() {
        if (!found) resolve(null);
      },
      error(err) {
        reject(err);
      },
    });
  });
}

module.exports = {
  getAllObservations,
  getObservation,
  extractAudioFilenameSegment,
};
