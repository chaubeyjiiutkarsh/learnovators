# Database — SQLite

The app uses **SQLite** through the `better-sqlite3` driver. The database is a
single file: `backend/data/learnovators.db` (created automatically on first
start — see `backend/db/index.js` for the full `CREATE TABLE` schema).

Why SQLite for this project:
- a **real relational database** (real SQL, real constraints, real indexes) —
  not a mock, not localStorage;
- **zero setup**: no server install, no cloud account, no network dependency —
  perfect for demos and viva;
- the same schema would port to PostgreSQL/MySQL later with only the driver
  changed, because all SQL lives in one layer (`services/`).

## ER diagram (one-to-many relationships)

```
                 ┌──────────────────┐
                 │      users       │
                 │ id (PK, uuid)    │
                 │ email (UNIQUE)   │
                 │ password_hash    │
                 │ onboarding_step  │
                 │ enrolled         │
                 │ interest_answers │
                 │ interest_scores  │
                 │ academic_*       │
                 │ mindset_*        │
                 │ coins            │
                 └────────┬─────────┘
        ┌───────────┬─────┴──────┬─────────────┬──────────────────┐
        ▼           ▼            ▼             ▼                  ▼
┌───────────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌────────────────────┐
│quiz_completions│ │   task_  │ │  journal_ │ │ redemptions │ │  coin_transactions │
│user_id (FK)   │ │completions│ │ entries   │ │ user_id (FK)│ │  user_id (FK)      │
│week_key       │ │ user_id(FK)│ │ user_id(FK)│ │ item_id     │ │  delta (+10 / −15) │
│score,total    │ │ task_id   │ │ content   │ │ voucher_code│ │  reason            │
│UNIQUE(user,   │ │UNIQUE(user,│ │ created_at│ │ cost        │ │  created_at        │
│   week_key)   │ │  task_id) │ └───────────┘ │UNIQUE(user, │ └────────────────────┘
└───────────────┘ └──────────┘               │   item_id)  │
                                             └─────────────┘
```

## Tables in one line each

| Table | Purpose | Interesting constraint |
|---|---|---|
| `users` | Account + assessment profile + cached coin balance | `email UNIQUE COLLATE NOCASE` |
| `quiz_completions` | One row per weekly quiz attempt | `UNIQUE(user_id, week_key)` → one attempt per ISO week |
| `task_completions` | Wellbeing tasks completed | `UNIQUE(user_id, task_id)` → reward payable once |
| `journal_entries` | Reflection journal texts | ordered by `created_at DESC` in the API |
| `redemptions` | Coin-store purchases + voucher codes | `UNIQUE(user_id, item_id)` → each item once |
| `coin_transactions` | Append-only ledger of every coin movement | rebuilds the balance from scratch if ever needed |

## Where SQL lives

- `backend/db/index.js` — connection + schema (DDL)
- `backend/services/user.service.js` — all reads/writes for users, coins, week key
- `backend/routes/portal.routes.js` — quiz/task/journal/redeem inserts with constraint checks

## Inspecting the data during your viva

Open `backend/data/learnovators.db` with any SQLite browser (e.g. the free
"DB Browser for SQLite") — or from the terminal:

```bash
cd backend
node -e "const db=require('better-sqlite3')('./data/learnovators.db'); console.log(db.prepare('SELECT name, email, coins, onboarding_step, enrolled FROM users').all())"
```

## JSON columns

`interest_answers`, `interest_scores`, `mindset_answers`, `mindset_scores`
are stored as JSON text. They are assessment *profile* data that is always
read and written as a whole (never queried by inner fields), so JSON columns
keep the schema simple without losing integrity — the same trade-off
PostgreSQL's `jsonb` makes.
