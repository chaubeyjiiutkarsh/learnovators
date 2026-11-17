# Backend — Learnovators REST API

Node.js + **Express** + **SQLite** (better-sqlite3). This is a real, classic
three-tier backend: routes → services → database.

```
backend/
├── server.js                       # Express app: middleware, route mounting, error handler
├── config.js                       # Reads .env (port, JWT secret, Google client ID, DB path)
├── db/
│   └── index.js                    # SQLite connection + CREATE TABLE schema (runs on start)
├── middleware/
│   └── auth.js                     # requireAuth — verifies the JWT on protected routes
├── routes/
│   ├── auth.routes.js              # signup / login / google / me
│   ├── users.routes.js             # PATCH /users/me (edit profile)
│   ├── onboarding.routes.js        # the 3 assessment steps + enroll + reset
│   ├── recommendations.routes.js   # career blueprint engine
│   ├── portal.routes.js            # quiz, tasks, journal, redeem, wallet, coin ledger
│   └── advisor.routes.js           # AI advisor chat
└── services/
    ├── user.service.js             # all users-table SQL + coin ledger + weekly week-key
    ├── scoring.service.js          # interest & mindset scoring (SERVER-side)
    ├── career.service.js           # career path data + personalised "why" text
    ├── portal.service.js           # quiz questions/answers, rewards, store prices
    └── advisor.service.js          # rule-based advisor replies
```

## Run

```bash
npm install          # inside backend/
npm run dev          # starts on http://localhost:4000 with auto-reload
```

The frontend (Vite, port 5173) proxies `/api/*` here — see `vite.config.js`.

## Design principles (good viva talking points)

1. **The server owns the truth.** Raw answers go in; scores, recommendations,
   grades and coin movements come out. The client cannot fake a score or mint
   coins — there are no endpoints that accept a coin amount.
2. **Layered architecture.** Routes only do HTTP (validate → call service →
   respond). Services hold business rules. `db/index.js` is the only file that
   talks SQL.
3. **Double-claim protection is structural.** `UNIQUE(user_id, week_key)` on
   quiz completions and `UNIQUE(user_id, task_id)` on tasks means repeat
   payouts are impossible even under concurrent requests.
4. **Append-only coin ledger.** Every +/− movement is a row in
   `coin_transactions`; the balance on `users.coins` is just a cached summary
   you can always rebuild from the ledger.
5. **Passwords are never stored** — only bcrypt hashes. Login compares with
   `bcrypt.compare` and returns one generic error for wrong email *or*
   password (prevents account enumeration).
6. **Sessions are JWTs** signed with `JWT_SECRET` (7-day expiry). The client
   stores the token and sends `Authorization: Bearer <token>`; `requireAuth`
   verifies it and loads `req.user`.
7. **Google sign-in** verifies the Google ID token against Google's tokeninfo
   endpoint *and* checks the `aud` claim equals our client ID. Without a
   configured client ID, `/api/auth/google-demo` provides a demo account so
   the button still performs a genuine backend session.
8. **Weekly quiz reset** uses an ISO week key (`2026-W47`), so a new week
   automatically re-enables the quiz without any cron job.

## Error format

Every error is JSON, one predictable shape:

```json
{ "error": { "code": "INSUFFICIENT_COINS", "message": "You need 15 more coins for this item." } }
```

Frontend code reads `err.message` directly — messages are already user-friendly.

## Trying the API with curl

```bash
# signup
curl -X POST http://localhost:4000/api/auth/signup -H "Content-Type: application/json" \
  -d '{"name":"Demo","email":"demo@test.com","password":"password123","educationLevel":"Undergraduate (UG)"}'

# use the returned token for protected routes
TOKEN=...

curl http://localhost:4000/api/auth/me -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:4000/api/onboarding/interest -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"answers":[3,3,3,3,3,3]}'
curl http://localhost:4000/api/recommendations -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:4000/api/portal/quiz -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"answers":[1,2,2]}'
```
