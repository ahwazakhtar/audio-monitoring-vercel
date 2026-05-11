'use strict';

const { google } = require('googleapis');

let _auth = null;

/**
 * Returns a GoogleAuth instance configured with the service account key.
 * The GOOGLE_SERVICE_ACCOUNT_KEY env var must be a base64-encoded JSON string
 * of the service account credentials.
 *
 * Caches the auth instance after first call.
 */
function getAuth() {
  if (_auth) return _auth;

  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!encoded) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  let credentials;
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    credentials = JSON.parse(decoded);
  } catch (err) {
    throw new Error(
      `Failed to decode/parse GOOGLE_SERVICE_ACCOUNT_KEY: ${err.message}`
    );
  }

  _auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });

  return _auth;
}

module.exports = { getAuth };
