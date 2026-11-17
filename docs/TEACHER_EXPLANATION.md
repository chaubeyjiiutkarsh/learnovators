# Teacher Explanation / Viva Guide

Open with the one-line pitch:

> "Learnovators is a personalised career advisor for students. The student
> answers a scenario-based interest assessment, fills an academic profile and
> a gentle mindset check. The backend scores those answers, recommends three
> career paths with personalised reasons, and then keeps the student engaged
> through a coin-rewarded portal — quizzes, wellbeing tasks and a coin store.
> Everything persists in a real SQL database per account."

Then walk the three tiers: **React frontend → Express backend → SQLite database.**

---

## 1. Why is there a separate backend folder? What does it do?

The backend (Node.js + Express) holds **all the business rules**:

- account creation and login (bcrypt password hashing, JWT sessions),
- assessment scoring (interest + mindset),
- the career recommendation engine,
- quiz grading and the coin economy (earn rules, spend rules, ledger),
- the AI advisor reply engine.

The frontend only *displays*. This is the standard separation of concerns:
UI, application logic, data.

**Q: Why not just do everything in the browser like the old version did with Firebase?**
A: A BaaS (Backend-as-a-Service) hides the logic in someone else's cloud. We
wrote the backend explicitly so every rule is visible, testable and ours —
and so results can't be tampered with from the client (the client never sends
scores or coin amounts, only raw answers and intent).

## 2. Walk me through a signup.

1. React form → `POST /api/auth/signup` with name/email/password.
2. Backend validates (email format, password ≥ 8 chars), checks the email
   isn't taken (`email UNIQUE COLLATE NOCASE`).
3. `bcrypt.hash(password, 10)` — we store the **hash**, never the password.
4. Insert into `users`, sign a JWT (payload `sub = user id`, 7-day expiry).
5. Frontend saves the token to localStorage and redirects to onboarding.

**Q: How is login checked?**
A: `POST /api/auth/login` → look up by email → `bcrypt.compare(password,
hash)`. Same error message for "no such user" and "wrong password", so an
attacker can't discover which emails are registered.

**Q: What protects the other endpoints?**
A: `middleware/auth.js` — `requireAuth` reads `Authorization: Bearer <token>`,
verifies the JWT signature with our secret, loads the user, attaches
`req.user`. Every onboarding/portal route starts with `router.use(requireAuth)`.

## 3. Where is data stored? Show me the database.

SQLite, a real relational database in one file: `backend/data/learnovators.db`
(connected in `backend/db/index.js`, schema created on startup).

Six tables: `users`, `quiz_completions`, `task_completions`,
`journal_entries`, `redemptions`, `coin_transactions`. All child tables have
`user_id` foreign keys (`ON DELETE CASCADE`) — show the ER diagram in
`database/README.md`. Demo it live by opening the .db file in DB Browser for
SQLite while the app runs.

**Q: Why SQLite?**
A: A genuine SQL engine (constraints, joins, indexes) with zero installation,
so the project runs anywhere. All SQL is confined to the services layer, so
switching to PostgreSQL later means changing one driver.

## 4. How does the assessment scoring work? (the key question)

- The React onboarding sends **only the option indexes** the student chose,
  e.g. `{answers: [3,3,3,3,3,3]}` to `POST /api/onboarding/interest`.
- `backend/services/scoring.service.js` maps each option to a category and
  counts: interest → analytical/creative/social/technical (0–6);
  mindset → resilience/confidence/focus (0–6).
- Scores are saved to the `users` row; `onboarding_step` moves 0→1→2→3 so a
  returning user resumes at the right step.
- Results page shows **soft labels** (Growing/Steady/Strong) for mindset —
  never raw numbers — to keep it non-clinical.

**Q: Why score on the server?**
A: Trust. If the client computed and sent scores, anyone could POST a
perfect profile. The server only accepts raw answers.

## 5. How do career recommendations work?

`GET /api/recommendations` (`career.service.js`):
1. take the dominant interest category from stored scores,
2. look up the 3 career paths for that category,
3. build each path's "why this fits you" sentence **from the student's own
   data** — e.g. "…your Science background gives you exactly the quantitative
   foundation…" or "…82% is a competitive score…" — conditional fragments in
   code (`if stream === 'Science'`, `if parseInt(marks) >= 75`).

**Q: Is it AI?**
A: The recommender is a rule-based expert system — deterministic and
explainable. The advisor chat (below) is the conversational layer on the
same profile data. Upgrading either to an LLM API later means changing one
service file.

## 6. How does the coin system prevent cheating?

- **Earning**: the only way coins change is the server's `awardCoins()`
  helper, called from fixed endpoints. Quiz answers are graded server-side
  (correct answers are never sent to the client); task rewards fire once
  because `task_completions` has `UNIQUE(user_id, task_id)`; the quiz is
  `UNIQUE(user_id, week_key)` — one attempt per ISO week, resetting
  automatically each week.
- **Spending**: `POST /api/portal/redeem` re-reads the balance from the
  database (never trusts the UI), checks the item isn't already redeemed,
  deducts, stores a voucher code.
- **Auditability**: every movement is a row in `coin_transactions` (append-only
  ledger) — the balance can always be rebuilt/verified from it.

## 7. How does persistence work? (demo it)

Log in → earn coins → redeem → close the browser → reopen → log in again.
On every app start `AuthContext` calls `GET /api/auth/me`; the backend reads
all six tables for that user and returns the complete profile view — coins,
quiz state, tasks, journal, redemptions — and `ProtectedRoute` routes by
`onboardingStep`/`enrolled`. Nothing lives only in the browser.

## 8. How does Google sign-in work?

Real flow: Google Identity Services on the frontend returns a signed **ID
token**; `POST /api/auth/google` verifies it against Google's tokeninfo
endpoint *and* checks `aud` (audience) equals our own client ID, then
creates/links the account. Without a configured OAuth client ID the button
uses `POST /api/auth/google-demo` (a sample account) — still a full real
backend session, so the demo never breaks.

## 9. Route protection on the frontend vs backend?

Both. The **frontend** (`ProtectedRoute.jsx`) redirects based on user state
for good UX. The **backend** independently rejects any protected request
without a valid token (401). UX redirects ≠ security; the API is the gate.

## 10. Which files should I be ready to open on screen?

| File | What to say |
|---|---|
| `backend/server.js` | "Entry point: mounts the 6 route groups, central error handler, serves the built frontend in production." |
| `backend/middleware/auth.js` | "JWT verification — every protected route passes through here." |
| `backend/services/scoring.service.js` | "Server-side scoring; client sends only raw answers." |
| `backend/services/career.service.js` | "Recommendation engine + personalised why-text." |
| `backend/routes/portal.routes.js` | "Quiz grading, task rewards, redemption rules — see the UNIQUE constraints." |
| `backend/services/user.service.js` | "All user SQL + the coin ledger transaction." |
| `frontend/src/lib/api.js` | "Single API client; attaches the JWT; one error shape." |
| `frontend/src/contexts/AuthContext.jsx` | "Session state + restores it on refresh via /me." |
| `frontend/src/components/ProtectedRoute.jsx` | "State-based routing: onboarding → results → portal." |
| `backend/db/index.js` | "Schema — 6 tables, foreign keys, the anti-cheat UNIQUEs." |

## 11. Honest limitations (saying these earns marks)

- Password reset / email verification not implemented (needs an SMTP service).
- Advisor replies are template-based, not an LLM.
- SQLite is single-file — perfect for a college project; horizontal scaling
  would mean PostgreSQL.
- Rate limiting not configured (login attempts should be throttled before any
  real deployment).
- Google sign-in requires the examiner's own OAuth client ID to try live;
  the demo fallback is clearly labelled in the code.

## 12. 60-second demo script

1. Landing → "Get started" → sign up (mention bcrypt + JWT while typing).
2. Onboarding: 6 interest questions → academic form → 6 mindset questions
   (point out the calm tone + progress bar).
3. Results: server-scored bars, soft mindset labels, and read one "why this
   fits you" aloud — it quotes their own marks/stream.
4. "Request enrollment" → portal.
5. Take the quiz (+10), complete a task (+5), redeem the eBook voucher
   (balance drops live) — open `coin_transactions` in DB Browser to show the
   ledger rows.
6. Log out, log back in: everything restored. "That's the database, not the
   browser."
