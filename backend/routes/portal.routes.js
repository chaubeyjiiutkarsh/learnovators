import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/index.js';
import {
  buildUserView,
  awardCoins,
  getUserById,
  getCoinHistory,
  currentWeekKey,
} from '../services/user.service.js';
import {
  weeklyQuiz,
  gradeQuiz,
  QUIZ_COIN_REWARD,
  TASK_COIN_REWARD,
  DIRECT_TASK_IDS,
  storeItems,
  makeVoucherCode,
} from '../services/portal.service.js';

const router = Router();

const nowIso = () => new Date().toISOString();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/portal/quiz — this week's quiz + whether it was already completed
// ---------------------------------------------------------------------------
router.get('/quiz', (req, res) => {
  const done = db
    .prepare('SELECT completed_at, score, total FROM quiz_completions WHERE user_id = ? AND week_key = ?')
    .get(req.user.id, currentWeekKey());

  res.json({
    weekKey: currentWeekKey(),
    completed: Boolean(done),
    lastResult: done || null,
    coinReward: QUIZ_COIN_REWARD,
    questions: weeklyQuiz.questions.map(({ id, question, options }) => ({
      id,
      question,
      options,
      // NOTE: the correct answer index is intentionally NOT sent to the client.
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /api/portal/quiz — submit answers; graded on the server
// ---------------------------------------------------------------------------
router.post('/quiz', (req, res) => {
  const { answers } = req.body || {};
  const weekKey = currentWeekKey();

  if (
    !Array.isArray(answers) ||
    answers.length !== weeklyQuiz.questions.length ||
    !answers.every((a) => Number.isInteger(a) && a >= 0 && a < 4)
  ) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Quiz answers are incomplete or invalid.' },
    });
  }

  // One attempt per week is enforced by the UNIQUE(user_id, week_key) index —
  // but check first so the response is a clean error instead of a crash.
  const existing = db
    .prepare('SELECT 1 FROM quiz_completions WHERE user_id = ? AND week_key = ?')
    .get(req.user.id, weekKey);
  if (existing) {
    return res.status(409).json({
      error: { code: 'ALREADY_COMPLETED', message: 'You have already completed this week\u2019s quiz.' },
    });
  }

  const { score, total } = gradeQuiz(answers);
  db.prepare(
    'INSERT INTO quiz_completions (user_id, week_key, score, total, completed_at) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.id, weekKey, score, total, nowIso());

  awardCoins(req.user.id, QUIZ_COIN_REWARD, 'weekly_quiz');

  res.json({
    score,
    total,
    awarded: QUIZ_COIN_REWARD,
    user: buildUserView(getUserById(req.user.id)),
  });
});

// ---------------------------------------------------------------------------
// POST /api/portal/tasks/:taskId/complete — wellbeing tasks (+5 coins once)
// ---------------------------------------------------------------------------
router.post('/tasks/:taskId/complete', (req, res) => {
  const { taskId } = req.params;

  if (!DIRECT_TASK_IDS.includes(taskId)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION',
        message: 'Unknown task. (The journal task is completed by saving a journal entry.)',
      },
    });
  }

  const done = db
    .prepare('SELECT 1 FROM task_completions WHERE user_id = ? AND task_id = ?')
    .get(req.user.id, taskId);
  if (done) {
    return res.status(409).json({
      error: { code: 'ALREADY_COMPLETED', message: 'This task was already completed.' },
    });
  }

  db.prepare('INSERT INTO task_completions (user_id, task_id, completed_at) VALUES (?, ?, ?)').run(
    req.user.id,
    taskId,
    nowIso()
  );
  awardCoins(req.user.id, TASK_COIN_REWARD, `task:${taskId}`);

  res.json({ awarded: TASK_COIN_REWARD, user: buildUserView(getUserById(req.user.id)) });
});

// ---------------------------------------------------------------------------
// POST /api/portal/journal — save a reflection entry (earns task2 coins once)
// ---------------------------------------------------------------------------
router.post('/journal', (req, res) => {
  const text = String(req.body?.text || '').trim();

  if (!text) {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: 'Please write a sentence before saving.' } });
  }
  if (text.length > 1000) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Journal entries are limited to 1000 characters.' },
    });
  }

  const createdAt = nowIso();
  db.prepare('INSERT INTO journal_entries (user_id, content, created_at) VALUES (?, ?, ?)').run(
    req.user.id,
    text,
    createdAt
  );

  // The journal task pays out only the first time — enforced by the
  // UNIQUE(user_id, task_id) index on task_completions.
  let awarded = 0;
  const alreadyDone = db
    .prepare('SELECT 1 FROM task_completions WHERE user_id = ? AND task_id = ?')
    .get(req.user.id, 'task2');
  if (!alreadyDone) {
    db.prepare('INSERT INTO task_completions (user_id, task_id, completed_at) VALUES (?, ?, ?)').run(
      req.user.id,
      'task2',
      createdAt
    );
    awardCoins(req.user.id, TASK_COIN_REWARD, 'task:task2');
    awarded = TASK_COIN_REWARD;
  }

  res.json({
    awarded,
    entry: { text, date: createdAt },
    user: buildUserView(getUserById(req.user.id)),
  });
});

// ---------------------------------------------------------------------------
// GET /api/portal/journal — list saved reflections (newest first)
// ---------------------------------------------------------------------------
router.get('/journal', (req, res) => {
  const entries = db
    .prepare('SELECT content, created_at FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ entries: entries.map((e) => ({ text: e.content, date: e.created_at })) });
});

// ---------------------------------------------------------------------------
// POST /api/portal/redeem — spend coins on a store item
// ---------------------------------------------------------------------------
router.post('/redeem', (req, res) => {
  const { itemId } = req.body || {};
  const item = storeItems[itemId];

  if (!item) {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: 'Unknown store item.' } });
  }

  const already = db
    .prepare('SELECT 1 FROM redemptions WHERE user_id = ? AND item_id = ?')
    .get(req.user.id, itemId);
  if (already) {
    return res.status(409).json({
      error: { code: 'ALREADY_REDEEMED', message: 'You have already redeemed this item.' },
    });
  }

  // Re-read the balance from the database — never trust the client's number.
  const user = getUserById(req.user.id);
  if (user.coins < item.cost) {
    return res.status(400).json({
      error: {
        code: 'INSUFFICIENT_COINS',
        message: `You need ${item.cost - user.coins} more coins for this item.`,
      },
    });
  }

  const voucherCode = makeVoucherCode(itemId, req.user.id);
  db.prepare(
    'INSERT INTO redemptions (user_id, item_id, item_title, cost, voucher_code, redeemed_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, itemId, item.title, item.cost, voucherCode, nowIso());

  awardCoins(req.user.id, -item.cost, `redeem:${itemId}`);

  res.json({
    voucherCode,
    user: buildUserView(getUserById(req.user.id)),
  });
});

// ---------------------------------------------------------------------------
// GET /api/portal/wallet — redeemed items with voucher codes
// ---------------------------------------------------------------------------
router.get('/wallet', (req, res) => {
  const rows = db
    .prepare('SELECT item_id, item_title, cost, voucher_code, redeemed_at FROM redemptions WHERE user_id = ? ORDER BY redeemed_at DESC')
    .all(req.user.id);
  res.json({ redemptions: rows });
});

// ---------------------------------------------------------------------------
// GET /api/portal/coins/history — the full coin ledger (audit trail)
// ---------------------------------------------------------------------------
router.get('/coins/history', (req, res) => {
  res.json({ history: getCoinHistory(req.user.id) });
});

export default router;
