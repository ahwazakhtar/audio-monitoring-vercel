# Audio Monitoring Platform

A web application for audio monitoring officers to verify EGRA/EGMA assessment recordings against collected survey data. Officers listen to audio files stored in Google Drive, compare responses against the dataset, and log compliance verdicts. Observations below 85% compliance are automatically flagged for supervisor review.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS, Recharts |
| Backend | Node.js + Express |
| Auth | JWT + bcrypt |
| Data | Google Sheets API v4 (review output), Google Drive API v3 (audio files) |
| Hosting | Vercel (frontend), Render (backend) |

## Project Structure

```
audio-monitoring/
├── client/              # React + Vite frontend
│   └── src/
│       ├── pages/       # Login, Dashboard, ReviewScreen, Analytics
│       ├── components/  # AudioPlayer, SectionVerifier, ObservationPanel, NavBar
│       └── api/         # Axios wrappers
├── server/              # Express backend
│   ├── routes/          # auth, observations, audio, reviews, analytics
│   ├── services/        # googleSheets.js, googleDrive.js, csvLoader.js, auth.js
│   ├── middleware/      # JWT auth
│   └── config/          # sections.js — assessment section definitions
├── data/
│   └── EGRA_EGMA_Combine_WIDE.csv
├── render.yaml          # Render deployment config
└── CLAUDE.md            # Full architecture and business logic reference
```

## Prerequisites

- Node.js ≥ 18
- A Google Cloud service account with access to:
  - The Google Drive folder containing audio files
  - The Google Sheet used for review output
- The survey CSV (`EGRA_EGMA_Combine_WIDE.csv`) placed in `server/data/`

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd "audio-monitoring"

cd server && npm install
cd ../client && npm install
```

### 2. Configure the backend

Create `server/.env`:

```env
GOOGLE_SERVICE_ACCOUNT_KEY=<base64-encoded service account JSON>
GOOGLE_SHEET_ID=1N1POd9dhcXy3f-u_UZggNsLzE3hlObK4Y7JzFJQANQI
GOOGLE_DRIVE_FOLDER_ID=19tfSEeBaOchNwSB2VNZd9s9PmEpDAIkG
JWT_SECRET=<random secret string>
USERS=[{"username":"mpatel","passwordHash":"<bcrypt hash>"},{"username":"ahwaz","passwordHash":"<bcrypt hash>"}]
CSV_PATH=./data/EGRA_EGMA_Combine_WIDE.csv
PORT=3001
```

To generate a bcrypt hash for a password:

```bash
node -e "const b=require('bcryptjs'); b.hash('yourpassword',10).then(console.log)"
```

### 3. Run locally

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend (proxies /api to localhost:3001)
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deployment

### Backend — Render

1. Create a new **Web Service** pointing to the `server/` directory.
2. Set the start command to `npm start`.
3. Add all environment variables from the list above in the Render dashboard.
4. Mount a persistent disk at `/app/data` if using on-disk CSV storage.

### Frontend — Vercel

1. Import the repository and set the **root directory** to `client/`.
2. Add the environment variable:
   ```
   VITE_API_URL=https://<your-render-service>.onrender.com
   ```
3. Deploy — Vercel will run `npm run build` automatically.

## Officer Workflow

1. **Login** at `/login` with your username and password.
2. **Dashboard** lists all audio files with status: available, in-review, or completed.
3. **Claim** a file — it is locked to you for up to 24 hours.
4. **Review Screen** — listen to the audio on the left; view observation data on the right.
5. **Verify sections** — for each assessment section, mark items as Correct, Incorrect, or Cannot Determine.
6. **Submit** — the review is written to the Google Sheet; compliance is calculated automatically.

Partial reviews are saved as drafts and can be resumed. A draft claim expires after 24 hours of inactivity.

## Compliance Rules

- **Score** = (items marked Correct) / (total items verified) × 100
- **Flag threshold:** score < 85% → observation flagged for supervisor review
- Score is computed across all sections the officer chose to verify

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/observations` | List observations with review status |
| GET | `/api/audio/:filename` | Stream audio file from Google Drive |
| GET | `/api/session` | Fetch completed and claimed review state |
| POST | `/api/claim/:uniqueId` | Claim an observation |
| DELETE | `/api/claim/:uniqueId` | Release a claim |
| POST | `/api/reviews` | Submit a review to Google Sheet |
| GET | `/api/reviews/mine` | Get the current user's submitted reviews |
| GET | `/api/analytics` | Aggregated compliance statistics |

## Assessment Sections

The platform covers 16 assessment sections across Urdu, English, and Math. Section definitions (variables, summary fields) are in `server/config/sections.js`. See `CLAUDE.md` for the full section-to-variable mapping.

## Data Sources

| File | Purpose |
|------|---------|
| `EGRA_EGMA_Combine_WIDE.csv` | Master survey dataset (one row per student, 1000+ columns) |
| `EGRA_EGMA_Combine codebook v109.html` | Variable definitions and answer codes |

Audio files are stored in Google Drive. Each observation's `audio_comp` field contains a SurveyCTO URL whose `file=` parameter encodes the Drive filename (format: `AA_<UUID>_enumerator.m4a`).

## Officers

Accounts are provisioned via the `USERS` environment variable. Initial officers: `mpatel`, `ahwaz`. No self-registration.

## License

Internal project — not for public distribution.
