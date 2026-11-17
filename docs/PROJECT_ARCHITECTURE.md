# Project Architecture

## The three tiers

```
┌─────────────────────────────┐
│ FRONTEND — React (Vite)     │  http://localhost:5173
│                             │
│  pages/     Landing, Auth,  │
│             Onboarding,     │        fetch('/api/...')          ┌──────────────────────────┐
│             Results, Portal │ ────────────────────────────────► │ BACKEND — Node/Express   │
│  contexts/  AuthContext     │        via Vite dev proxy         │ http://localhost:4000    │
│  lib/api.js (one API client)│                                   │                          │
│  components/ 11 reusable    │ ◄──────────────────────────────── │  routes → services → db  │
│  data/ questions, roadmaps  │        JSON + JWT                 │                          │
└─────────────────────────────┘                                   └────────────┬─────────────┘
                                                                               │ better-sqlite3
                                                                               ▼
                                                                  ┌──────────────────────────┐
                                                                  │ DATABASE — SQLite file   │
                                                                  │ backend/data/            │
                                                                  │ learnovators.db          │
                                                                  │ 6 tables, FK + UNIQUEs   │
                                                                  └──────────────────────────┘
```

## Folder map

```
Learnovators/
├── frontend/                 # React SPA (UI only — no business rules)
│   ├── src/pages/            # 5 screens
│   ├── src/contexts/         # AuthContext: session + userDoc state
│   ├── src/lib/api.js        # single fetch wrapper, attaches the JWT
│   ├── src/components/       # CareerCard, modals, headers, etc.
│   └── src/data/             # question text/options, roadmap display data
├── backend/                  # Express REST API (all business rules)
│   ├── routes/               # HTTP layer (validate → call service → respond)
│   ├── services/             # business logic (scoring, careers, coins, advisor)
│   ├── middleware/auth.js    # JWT verification
│   ├── db/index.js           # SQLite connection + schema
│   └── config.js             # .env config
├── database/README.md        # schema + ER documentation
└── docs/                     # this file + teacher explanation
```

## Authentication flow

1. **Signup** — `POST /api/auth/signup`. Backend validates, bcrypt-hashes the
   password (cost 10), inserts the user, signs a JWT (`sub = user id`, 7 days).
2. **Client stores the token** in `localStorage` (`learnovators_token`).
3. **Every protected request** sends `Authorization: Bearer <token>`.
   `middleware/auth.js` verifies the signature, loads the user, attaches
   `req.user`.
4. **Returning visit** — `AuthContext` boots by calling `GET /api/auth/me`;
   if the token is valid the whole profile comes back (coins, onboarding
   step, redemptions, journal…) and routing resumes where the student left
   off. Invalid token → cleared, user is logged out.

## State-based routing (the spec's core requirement)

`ProtectedRoute.jsx` decides which screen a user may see:

| User state | Route | Enforced by |
|---|---|---|
| Not logged in | `/`, `/auth` | `PublicRoute` |
| Logged in, `onboardingStep < 3` | `/onboarding` | `OnboardingRoute`, `PublicRoute` |
| Onboarding done, not enrolled | `/results` | `SmartRoute requireEnrolled={false}` |
| Enrolled | `/portal` (and `/results`) | `SmartRoute requireEnrolled={true}` |

## Onboarding data flow (server-side scoring)

```
Student picks options        Backend                          Database
─────────────────────        ───────                          ────────
6 interest answers    ──►    POST /api/onboarding/interest
                             scoreInterest(answers) ──► interest_scores JSON, step=1
marks + stream        ──►    POST /api/onboarding/academic
                             validate 0–100, stream ──► academic_* columns, step=2
6 mindset answers     ──►    POST /api/onboarding/mindset
                             scoreMindset(answers)  ──► mindset_scores JSON, step=3
                             → frontend navigates to /results
```

The client never sends scores — only raw option indexes. This is why the
scoring logic in `backend/services/scoring.service.js` is authoritative.

## Recommendation engine

`GET /api/recommendations`:
1. read `interest_scores` → dominant category (analytical / creative / social / technical);
2. pick the 3 career paths mapped to that category (`career.service.js`);
3. build `whyText` per path **from the stored profile** — stream, marks ≥75,
   certifications, exam score all inject into the sentence;
4. return `{ topCategory, paths[] }` — the Results page just renders it.

## Coin economy

| Action | Endpoint | Coins | Anti-abuse |
|---|---|---|---|
| Weekly quiz | `POST /api/portal/quiz` | +10 | answers graded server-side; `UNIQUE(user_id, week_key)`; resets each ISO week |
| Breathing / break task | `POST /api/portal/tasks/:id/complete` | +5 | `UNIQUE(user_id, task_id)` |
| Journal entry | `POST /api/portal/journal` | +5 once | task2 row inserted only if missing |
| Redeem item | `POST /api/portal/redeem` | −cost | balance re-read from DB; `UNIQUE(user_id, item_id)` |

Every movement is appended to `coin_transactions` (ledger). The frontend
balance always comes from the server response — the UI's only job is display.

## AI advisor

`POST /api/advisor/chat` — the message goes to `advisor.service.js`, which
matches keywords (projects / internship / exams / certificates) and composes
a reply grounded in the student's stored profile (top interest, stream,
marks, mindset soft labels). To upgrade to a real LLM later, only this one
service changes.

## Production build

```bash
npm run build    # vite build → dist/
npm start        # Express serves dist/ AND the API on port 4000
```

One process hosts the whole app; no CORS needed in production.
