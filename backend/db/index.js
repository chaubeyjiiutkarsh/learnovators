import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

// ---------------------------------------------------------------------------
// SQLite connection
// ---------------------------------------------------------------------------
// The whole application state lives in a single SQLite database file.
// better-sqlite3 is synchronous, which keeps the data access code short and
// easy to explain (no callbacks/promises for simple queries).

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new Database(config.dbFile);

// WAL mode = better concurrency (readers don't block the writer).
db.pragma('journal_mode = WAL');
// Foreign keys are OFF by default in SQLite — turn them ON explicitly.
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema — created on every start if the tables don't exist yet
// ---------------------------------------------------------------------------

export function initDb() {
  db.exec(`
    -- Core account + assessment profile (one row per student)
    CREATE TABLE IF NOT EXISTS users (
      id                    TEXT PRIMARY KEY,
      name                  TEXT NOT NULL DEFAULT '',
      email                 TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash         TEXT,
      auth_provider         TEXT NOT NULL DEFAULT 'email',   -- email | google | google-demo
      education_level       TEXT NOT NULL DEFAULT '',
      college               TEXT NOT NULL DEFAULT '',
      onboarding_step       INTEGER NOT NULL DEFAULT 0,      -- 0..3 (3 = finished)
      enrolled              INTEGER NOT NULL DEFAULT 0,      -- 0/1
      interest_answers      TEXT,                            -- JSON array of 6 option indexes
      interest_scores       TEXT,                            -- JSON {analytical,creative,social,technical}
      academic_marks        TEXT NOT NULL DEFAULT '',
      academic_stream       TEXT NOT NULL DEFAULT '',
      academic_certifications TEXT NOT NULL DEFAULT '',
      academic_exam_score   TEXT NOT NULL DEFAULT '',
      mindset_answers       TEXT,                            -- JSON array of 6 option indexes
      mindset_scores        TEXT,                            -- JSON {resilience,confidence,focus}
      coins                 INTEGER NOT NULL DEFAULT 0,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL
    );

    -- One completion per ISO week per student (the quiz resets weekly)
    CREATE TABLE IF NOT EXISTS quiz_completions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_key      TEXT NOT NULL,                           -- e.g. "2026-W47"
      score         INTEGER NOT NULL,
      total         INTEGER NOT NULL,
      completed_at  TEXT NOT NULL,
      UNIQUE(user_id, week_key)
    );

    -- Wellbeing tasks: one row per completed task (UNIQUE = can't be claimed twice)
    CREATE TABLE IF NOT EXISTS task_completions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id       TEXT NOT NULL,                           -- task1 | task2 | task3
      completed_at  TEXT NOT NULL,
      UNIQUE(user_id, task_id)
    );

    -- Journal entries written in the wellbeing section
    CREATE TABLE IF NOT EXISTS journal_entries (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content       TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    -- Coin store redemptions (UNIQUE = each item can be redeemed once)
    CREATE TABLE IF NOT EXISTS redemptions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id       TEXT NOT NULL,                           -- library | ebook | mentorship
      item_title    TEXT NOT NULL,
      cost          INTEGER NOT NULL,
      voucher_code  TEXT NOT NULL,
      redeemed_at   TEXT NOT NULL,
      UNIQUE(user_id, item_id)
    );

    -- Append-only ledger of every coin movement (audit trail for the balance)
    CREATE TABLE IF NOT EXISTS coin_transactions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta         INTEGER NOT NULL,                        -- +earn / -spend
      reason        TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_journal_user   ON journal_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_coin_tx_user   ON coin_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_redemptions_user ON redemptions(user_id);
  `);
  console.log(`[db] SQLite ready at ${config.dbFile}`);
}

export default db;
