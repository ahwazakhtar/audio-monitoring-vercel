# Audio Monitoring Platform — CLAUDE.md

## Project Overview

A web platform for audio monitoring officers to verify EGRA/EGMA assessment recordings against collected survey data. Officers listen to audio files from a Google Drive folder, compare what they hear against the recorded responses in the dataset, and log compliance verdicts with comments. Observations with < 85% compliance are automatically flagged.

## Source Data

| File | Purpose |
|------|---------|
| `EGRA_EGMA_Combine_WIDE.csv` | Master survey data (one row per student observation, 1000+ columns) |
| `EGRA_EGMA_Combine codebook v109.html` | Codebook describing all variables and answer codes |

**Key identifier fields:** `unique_id_calc`, `enumerator_name`, `school_name`, `caseid`

**Audio link field:** `audio_comp` — contains a SurveyCTO URL whose `file=` parameter is the Google Drive filename (starts with `AA_`, e.g. `AA_75469b92-e2a1-44e3-bf25-bf5c6e52a03b_enumerator.m4a`)

## External Resources

| Resource | URL / Location |
|----------|---------------|
| Audio files (Google Drive) | `https://drive.google.com/drive/u/1/folders/19tfSEeBaOchNwSB2VNZd9s9PmEpDAIkG` |
| Review output sheet | `https://docs.google.com/spreadsheets/d/1N1POd9dhcXy3f-u_UZggNsLzE3hlObK4Y7JzFJQANQI` |

## Tech Stack

- **Frontend:** React (Vite), deployed to **Vercel**
- **Backend:** Node.js + Express, deployed to **Render**
- **Database (session state):** In-memory or lightweight (SQLite / Render persistent disk) — stores claim locks and review records between syncs
- **Google APIs:** Sheets API v4 + Drive API v3 via service account
- **Auth:** Simple username + bcrypt-hashed password, JWT sessions

## Architecture

```
React SPA (Vercel)
  └── REST API (Express on Render)
        ├── GET  /api/session-state     → Pull Google Sheet for completed reviews
        ├── GET  /api/observations      → Return CSV rows (served from backend)
        ├── POST /api/claim             → Lock an audio file for a reviewer
        ├── POST /api/review            → Submit review, write row to Google Sheet
        ├── GET  /api/analytics         → Aggregated compliance stats
        └── Drive API                  → Stream audio files to browser
```

## Officer Workflow

1. **Login** — simple username + password
2. **Session load** — app fetches the Google Sheet to mark already-reviewed files
3. **File list** — shows all Google Drive audio files, with reviewed/claimed/available status
4. **Claim** — officer clicks a file → auto-matched to the observation via `audio_comp` field; marked "in review" so other officers skip it
5. **Review screen:**
   - Left: embedded audio player (streamed from Drive)
   - Right: observation data (key fields + section data)
6. **Section verification** — officer selects which sections to verify; for each section, an item-level table shows variable name, recorded value, and a checkbox (Correct / Incorrect) + optional per-item comment
7. **Overall comment** — free-text box at the bottom
8. **Submit** — review written to Google Sheet; compliance score computed

## Assessment Sections (configurable per review)

Each section maps to a group of variables in the CSV. Officers can expand/collapse sections.

| Section Key | Variables | Summary Scores |
|-------------|-----------|----------------|
| `listcomp_urd` | `listcomp_lit1_urd`–`listcomp_inf2_urd` (6 items) | `listcomp_numcorrect_urd`, `listcomp_percorrect_urd` |
| `letterid_urd` | `letterid_fl_urd_1`–`_100` | `lid_reading_correct_urd`, `lid_reading_attempted_urd` |
| `idwrd_urd` | `idwrd_reading_urd_1`–`_50` | `idwrd_60s_correct_urd`, `idwrd_60s_attempted_urd` |
| `orf_urd` | `orf_reading_urd_1`–`_60` | `orf_60s_correct_urd`, `orf_60s_attempted_urd`, `orf_reading_sentences_urd` |
| `rdcomp_urd` | `rdcomp_lit1_urd`–`rdcomp_inf2_urd` (6 items) | `rdcomp_numcorrect_urd`, `rdcomp_percorrect_urd` |
| `listcomp_eng` | `listcomp_lit1_eng`–`listcomp_inf2_eng` (6 items) | `listcomp_numcorrect_eng` |
| `letterid_eng` | `letterid_fl_eng_1`–`_100` | `lid_reading_correct_eng` |
| `pw_eng` | `pw_reading_eng_1`–`_50` | `pw_60s_correct_eng` |
| `idwrd_eng` | `idwrd_reading_eng_1`–`_50` | `idwrd_60s_correct_eng` |
| `orf_eng` | `orf_reading_eng_1`–`_68` | `orf_60s_correct_eng`, `orf_reading_sentences_eng` |
| `rdcomp_eng` | `rdcomp_lit1_eng`–`rdcomp_inf2_eng` (6 items) | `rdcomp_numcorrect_eng` |
| `idnummag` | `identify_1a`–`identify_4b` (8 items) | `idnummag_numcorrect` |
| `numrep` | `represent_1a`–`represent_4b` (8 items) | `numrep_numcorrect` |
| `blfluency_l1` | `blfl1_question_ans_1`–`_20` | `blfl1_s1ore` |
| `blfluency_l4` | `blfl4_question_ans_1`–`_20` | `blfl4_s1ore` |
| `computation` | `computation_1a`–`computation_4b` (8 items) | `comp_numcorrect` |
| `word_problems` | `word_problems_1a`–`word_problems_4b` (8 items) | `wrdpblm_numcorrect` |
| `patterns` | `patterns_1a`–`patterns_4b` (8 items) | `patterns_numcorrect` |

## Compliance Rules

- **Per observation compliance** = (number of items marked Correct by officer) / (total items verified) × 100
- **Flag threshold:** < 85% compliance → observation flagged for supervisor review
- Compliance is calculated across all sections the officer chose to verify in a session

## Google Sheet Schema (output)

Each review writes one row:

| Column | Content |
|--------|---------|
| `review_id` | UUID generated at submit time |
| `unique_id_calc` | Matched observation ID |
| `audio_filename` | e.g. `AA_75469b92-..._enumerator.m4a` |
| `reviewer` | Username of officer |
| `review_timestamp` | ISO 8601 |
| `sections_reviewed` | Comma-separated section keys |
| `overall_compliance_pct` | Number 0–100 |
| `flagged` | TRUE / FALSE |
| `overall_comment` | Free text |
| `<section>_compliance_pct` | One column per section reviewed |
| `<section>_item_verdicts` | JSON string: `{"var_name": "correct"|"incorrect", ...}` |
| `<section>_comments` | Free text per section |

## Audio File ↔ Observation Matching

1. Extract filename from `audio_comp` field: parse the `file=` query parameter from the URL — this gives a string containing `AA_<UUID>_enumerator.m4a`
2. In Google Drive, audio files may have additional text prepended before `AA_` (e.g. `prefix_AA_uuid.m4a`)
3. Match by checking if the Drive filename **contains** the `AA_<UUID>` substring from the `audio_comp` field
4. If no match found, officer can manually search/select the observation

## Session State at Login

On app load (or explicit refresh):
1. Fetch all rows from the Google Sheet output tab
2. Build a set of `unique_id_calc` values that are already reviewed (status = complete)
3. Build a set of `audio_filename` values that are claimed (status = in-review) from backend lock store
4. Mark observations in the UI accordingly

## Analytics Dashboard

Visible to all logged-in users:

- **Progress ring:** X of Y recordings reviewed
- **Compliance by enumerator:** table with avg compliance % per enumerator + flag count
- **Compliance by school:** same for school_name / emis_code
- **Compliance by section:** which assessment sections have the most errors
- **Flagged observations list:** filterable table of all flagged rows with links to re-review

## Auth

- Backend maintains a `users.json` (or env-configured list) of `{username, passwordHash}`
- Login returns a signed JWT (24h expiry)
- All API routes are protected; JWT passed in Authorization header
- No self-registration; accounts are provisioned by the project lead

## Environment Variables (backend)

```
GOOGLE_SERVICE_ACCOUNT_KEY=<base64-encoded service account JSON>
GOOGLE_SHEET_ID=1N1POd9dhcXy3f-u_UZggNsLzE3hlObK4Y7JzFJQANQI
GOOGLE_DRIVE_FOLDER_ID=19tfSEeBaOchNwSB2VNZd9s9PmEpDAIkG
JWT_SECRET=<random string>
USERS=<JSON array of {username, passwordHash}>
CSV_PATH=./data/EGRA_EGMA_Combine_WIDE.csv
```

## Folder Structure (target)

```
audio-monitoring/
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/   # Login, Dashboard, ReviewList, ReviewScreen, Analytics
│   │   ├── components/
│   │   └── api/     # Axios wrappers for backend
│   └── vite.config.js
├── server/          # Express backend
│   ├── routes/
│   ├── services/    # googleSheets.js, googleDrive.js, csvLoader.js
│   ├── middleware/  # auth.js
│   └── index.js
├── data/
│   └── EGRA_EGMA_Combine_WIDE.csv
└── CLAUDE.md
```

## Officers

Two officers for initial deployment:
- `mpatel`
- `ahwaz`

Passwords are set via the `USERS` environment variable (bcrypt-hashed). Accounts provisioned by project lead.

## Review Rules

- **Partial reviews:** Allowed — officers can save progress and return. The claim lock persists. A review has status `draft` (in-progress) or `complete` (submitted).
- **One reviewer per observation:** Once an observation is claimed and submitted (status = `complete`), it is locked and removed from the queue for all other officers.
- **Claim expiry:** A `draft` claim auto-expires after 24 hours of inactivity, returning the file to the available pool.
