# Learnovators

A personalized AI career and education advisor for students — scenario-based interest assessment, academic profile, a gentle mindset check, and a coin-rewarded student portal.

## Architecture

```
┌─────────────────────────┐        ┌───────────────────────────┐        ┌──────────────────────┐
│  FRONTEND  (React)      │  HTTP  │  BACKEND  (Node/Express)  │  SQL   │  DATABASE  (SQLite)  │
│  Vite · Tailwind        │ ─────► │  REST API · JWT auth      │ ─────► │  6 tables · ledger   │
│  localhost:5173         │  JSON  │  localhost:4000           │        │  backend/data/*.db   │
└─────────────────────────┘        └───────────────────────────┘        └──────────────────────┘
```

- **frontend/** — React + Vite + Tailwind. All 5 screens: Landing, Auth, Onboarding (3 steps), Results (career blueprint), Student Portal (quiz, wellbeing tasks, coin store, AI advisor chat).
- **backend/** — Express REST API. Owns ALL the important logic: password hashing + JWT sessions, assessment scoring, career recommendations, quiz grading, the coin economy, redemptions.
- **database/** — SQLite via better-sqlite3 (a real SQL database file, no cloud account needed). Schema documented in [database/README.md](database/README.md).

## Quick start

```bash
# 1. Install everything (frontend + backend)
npm run install:all

# 2. Configure the backend
copy backend\.env.example backend\.env
#    (a ready-to-run backend/.env with a dev JWT secret ships in the ZIP)

# 3. Start both servers together
npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies `/api/*` to the Express backend on port 4000.

### Run scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts backend (port 4000) + frontend (port 5173) together |
| `npm run dev:front` | Frontend only |
| `npm run dev:back` | Backend only |
| `npm run build` | Builds the frontend into `dist/` |
| `npm start` | Production mode — Express serves the built frontend **and** the API on port 4000 |

## Features

- **Real signup/login** — email + password with bcrypt hashing, JWT sessions, plus Google sign-in (real Google Identity Services when a client ID is configured; a demo account otherwise).
- **State-based routing** — incomplete onboarding → `/onboarding`; finished but not enrolled → `/results`; enrolled → `/portal`.
- **Server-side scoring** — the backend computes interest/mindset scores from the raw answers, so results can't be faked from the client.
- **Personalised recommendations** — GET `/api/recommendations` returns three career paths with "why this fits you" text generated from the student's actual stream, marks, certifications and exam score.
- **Coin economy** — weekly quiz (+10, resets every ISO week), wellbeing tasks (+5 each, payable once), journal entries stored in SQL, coin store with balance validation and voucher codes, and a full append-only coin ledger.
- **Persistence** — everything lives in SQLite; log out, close the browser, come back — progress, coins, journal, quiz state and redemptions are all restored via `GET /api/auth/me`.

## Google sign-in (optional)

1. Create an OAuth Client ID (Web application) at console.cloud.google.com → APIs & Credentials, with origin `http://localhost:5173`.
2. Put the same client ID into `VITE_GOOGLE_CLIENT_ID` (root `.env`) and `GOOGLE_CLIENT_ID` (`backend/.env`).
3. Restart. Without it, the Google button signs into a sample account — still a complete, real backend session.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create account (bcrypt + JWT) |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/google` | Google ID-token login |
| POST | `/api/auth/google-demo` | Demo login when OAuth isn't configured |
| GET | `/api/auth/me` | Current user's full profile |
| PATCH | `/api/users/me` | Edit academic/profile fields |
| POST | `/api/onboarding/interest` | Save step 1 answers (scored server-side) |
| POST | `/api/onboarding/academic` | Save step 2 |
| POST | `/api/onboarding/mindset` | Save step 3 (completes onboarding) |
| POST | `/api/onboarding/step` | Move backwards in onboarding |
| POST | `/api/onboarding/reset` | Retake the assessment |
| POST | `/api/onboarding/enroll` | Request enrollment |
| GET | `/api/recommendations` | Career blueprint (3 paths + why text) |
| GET/POST | `/api/portal/quiz` | Get this week's quiz / submit answers (graded server-side) |
| POST | `/api/portal/tasks/:taskId/complete` | Wellbeing task (+5 coins, once per task) |
| GET/POST | `/api/portal/journal` | List / add journal reflections |
| POST | `/api/portal/redeem` | Spend coins on a store item |
| GET | `/api/portal/wallet` | Redeemed items + voucher codes |
| GET | `/api/portal/coins/history` | Full coin ledger |
| POST | `/api/advisor/chat` | AI advisor reply, grounded in the profile |

Full request/response examples: [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md).
Viva-ready explanations: [docs/TEACHER_EXPLANATION.md](docs/TEACHER_EXPLANATION.md).
