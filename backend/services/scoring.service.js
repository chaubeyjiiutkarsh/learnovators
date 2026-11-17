// ---------------------------------------------------------------------------
// Scoring service — computes assessment results on the SERVER.
//
// The frontend only sends the raw option indexes the student picked. The
// backend owns the scoring logic, so the results can never be faked by
// tampering with the client.
// ---------------------------------------------------------------------------

import db from '../db/index.js';

// Each of the 6 interest questions has 4 options, always in this category
// order, so the chosen index maps directly to a category.
export const INTEREST_CATEGORIES = ['analytical', 'creative', 'social', 'technical'];

// Category of each option for each of the 6 mindset questions
// (mirrors frontend/src/data/mindsetQuestions.js).
const MINDSET_OPTION_CATEGORIES = [
  /* Q1 */ ['resilience', 'confidence', 'focus', 'resilience'],
  /* Q2 */ ['focus', 'resilience', 'confidence', 'focus'],
  /* Q3 */ ['confidence', 'resilience', 'focus', 'resilience'],
  /* Q4 */ ['confidence', 'resilience', 'focus', 'confidence'],
  /* Q5 */ ['focus', 'resilience', 'confidence', 'resilience'],
  /* Q6 */ ['focus', 'resilience', 'confidence', 'resilience'],
];

export const MINDSET_DIMENSIONS = ['resilience', 'confidence', 'focus'];

export function scoreInterest(answers) {
  const scores = { analytical: 0, creative: 0, social: 0, technical: 0 };
  answers.forEach((optionIndex) => {
    const category = INTEREST_CATEGORIES[optionIndex];
    if (category) scores[category] += 1;
  });
  return scores;
}

export function scoreMindset(answers) {
  const scores = { resilience: 0, confidence: 0, focus: 0 };
  answers.forEach((optionIndex, questionIndex) => {
    const category = MINDSET_OPTION_CATEGORIES[questionIndex]?.[optionIndex];
    if (category) scores[category] += 1;
  });
  return scores;
}

// Scores are 0..6; the UI shows soft labels (Growing / Steady / Strong),
// never raw numbers, to keep the tone supportive.
export function toSoftLabel(score) {
  if (score <= 1) return 'Growing';
  if (score <= 3) return 'Steady';
  return 'Strong';
}

// The dominant interest category — ties are broken by fixed category order,
// which keeps results stable for identical answer sets.
export function getTopCategory(scores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

// Validation helper: onboarding endpoints expect exactly 6 answers, each an
// integer option index within range.
export function validateAnswers(answers, questionCount = 6, optionCount = 4) {
  return (
    Array.isArray(answers) &&
    answers.length === questionCount &&
    answers.every((a) => Number.isInteger(a) && a >= 0 && a < optionCount)
  );
}

// Used by GET /api/auth/me etc. — nothing here writes to the DB, it just
// re-scores stored raw answers if the stored scores are missing (safety net
// for accounts created before scoring moved server-side).
export function ensureScores(user) {
  if (user.interest_answers && !user.interest_scores) {
    const scores = scoreInterest(JSON.parse(user.interest_answers));
    db.prepare('UPDATE users SET interest_scores = ? WHERE id = ?').run(
      JSON.stringify(scores),
      user.id
    );
    user.interest_scores = JSON.stringify(scores);
  }
  if (user.mindset_answers && !user.mindset_scores) {
    const scores = scoreMindset(JSON.parse(user.mindset_answers));
    db.prepare('UPDATE users SET mindset_scores = ? WHERE id = ?').run(
      JSON.stringify(scores),
      user.id
    );
    user.mindset_scores = JSON.stringify(scores);
  }
  return user;
}
