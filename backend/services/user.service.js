import { randomUUID } from 'node:crypto';
import db from '../db/index.js';

// ---------------------------------------------------------------------------
// User service — all direct database access to the users table lives here.
// Routes never write SQL themselves; they call these functions.
// ---------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();

// --- Row → API shape -------------------------------------------------------
// The API returns a single nested "user" object that the React app can render
// directly (same shape as the old Firestore document, so the UI stays simple).

export function buildUserView(user) {
  const quizRow = db
    .prepare('SELECT 1 FROM quiz_completions WHERE user_id = ? AND week_key = ?')
    .get(user.id, currentWeekKey());

  const taskRows = db.prepare('SELECT task_id FROM task_completions WHERE user_id = ?').all(user.id);
  const redemptionRows = db
    .prepare('SELECT item_id FROM redemptions WHERE user_id = ?')
    .all(user.id);
  const journalRows = db
    .prepare('SELECT content, created_at FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);

  const wellbeingTasks = { task1: false, task2: false, task3: false };
  for (const row of taskRows) wellbeingTasks[row.task_id] = true;

  const redemptions = { library: false, ebook: false, mentorship: false };
  for (const row of redemptionRows) redemptions[row.item_id] = true;

  return {
    id: user.id,
    uid: user.id,
    name: user.name,
    email: user.email,
    authProvider: user.auth_provider,
    educationLevel: user.education_level,
    college: user.college,
    onboardingStep: user.onboarding_step,
    enrolled: Boolean(user.enrolled),
    coins: user.coins,
    interestAnswers: parseJson(user.interest_answers) || [],
    interestScores:
      parseJson(user.interest_scores) || { analytical: 0, creative: 0, social: 0, technical: 0 },
    academicProfile: {
      marks: user.academic_marks,
      stream: user.academic_stream,
      certifications: user.academic_certifications,
      examScore: user.academic_exam_score,
    },
    mindsetAnswers: parseJson(user.mindset_answers) || [],
    mindsetScores: parseJson(user.mindset_scores) || { resilience: 0, confidence: 0, focus: 0 },
    weeklyQuizCompleted: Boolean(quizRow),
    wellbeingTasks,
    redemptions,
    journalEntries: journalRows.map((r) => ({ text: r.content, date: r.created_at })),
    createdAt: user.created_at,
  };
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// --- Reads -----------------------------------------------------------------

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
}

export function getUserViewById(id) {
  const user = getUserById(id);
  return user ? buildUserView(user) : null;
}

// --- Writes ----------------------------------------------------------------

export function createUser({ name, email, passwordHash = null, provider = 'email', educationLevel = '', college = '' }) {
  const id = randomUUID();
  const ts = nowIso();
  db.prepare(
    `INSERT INTO users
       (id, name, email, password_hash, auth_provider, education_level, college,
        onboarding_step, enrolled, coins, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
  ).run(id, name, email, passwordHash, provider, educationLevel, college, ts, ts);
  return getUserById(id);
}

const USER_FIELDS = {
  name: 'name',
  educationLevel: 'education_level',
  college: 'college',
  onboardingStep: 'onboarding_step',
  enrolled: 'enrolled',
  marks: 'academic_marks',
  stream: 'academic_stream',
  certifications: 'academic_certifications',
  examScore: 'academic_exam_score',
};

export function updateUser(id, fields) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(USER_FIELDS)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(fields[key]);
    }
  }
  const jsonFields = [
    ['interestAnswers', 'interest_answers'],
    ['interestScores', 'interest_scores'],
    ['mindsetAnswers', 'mindset_answers'],
    ['mindsetScores', 'mindset_scores'],
  ];
  for (const [key, column] of jsonFields) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(JSON.stringify(fields[key]));
    }
  }

  if (sets.length === 0) return getUserById(id);

  sets.push('updated_at = ?');
  values.push(nowIso(), id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getUserById(id);
}

// --- Coin economy ------------------------------------------------------------
// Coins are never edited directly. The only way to change a balance is
// awardCoins(), which appends a row to the coin_transactions ledger and then
// updates the user's cached balance in the same transaction. The ledger is the
// source of truth; the users.coins column is a fast-reading summary.

export const awardCoins = db.transaction((userId, delta, reason) => {
  db.prepare(
    'INSERT INTO coin_transactions (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)'
  ).run(userId, delta, reason, nowIso());

  db.prepare('UPDATE users SET coins = coins + ?, updated_at = ? WHERE id = ?').run(
    delta,
    nowIso(),
    userId
  );
});

export function getCoinHistory(userId) {
  return db
    .prepare('SELECT delta, reason, created_at FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
}

// --- Weekly quiz bookkeeping -------------------------------------------------
// The focus quiz resets every ISO calendar week. We store the week key
// (e.g. "2026-W47") with each completion, so a new week automatically makes
// the quiz available again.

export function currentWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
