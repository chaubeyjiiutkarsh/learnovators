import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  buildUserView,
  updateUser,
  getUserById,
} from '../services/user.service.js';
import { scoreInterest, scoreMindset, validateAnswers } from '../services/scoring.service.js';

const router = Router();

const STREAMS = ['Science', 'Commerce', 'Arts', 'Engineering', 'Other'];

// Every endpoint below requires a valid JWT (see middleware/auth.js).
router.use(requireAuth);

// Re-read the user after a change and return the fresh view model so the
// frontend can update its state straight from the server's response.
function respondWithUser(res, userId) {
  res.json({ user: buildUserView(getUserById(userId)) });
}

// ---------------------------------------------------------------------------
// POST /api/onboarding/interest — save Step 1 answers (scores computed here)
// ---------------------------------------------------------------------------
router.post('/interest', (req, res) => {
  const { answers } = req.body || {};

  if (!validateAnswers(answers, 6, 4)) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Interest answers must be 6 valid option indexes.' },
    });
  }

  const scores = scoreInterest(answers);
  updateUser(req.user.id, { interestAnswers: answers, interestScores: scores, onboardingStep: 1 });
  respondWithUser(res, req.user.id);
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/academic — save Step 2 (marks, stream, certificates)
// ---------------------------------------------------------------------------
router.post('/academic', (req, res) => {
  const { marks, stream, certifications = '', examScore = '' } = req.body || {};

  const marksNum = parseFloat(marks);
  if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Please enter a valid percentage between 0 and 100.' },
    });
  }
  if (!STREAMS.includes(stream)) {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: 'Please select your stream.' } });
  }

  updateUser(req.user.id, {
    marks: String(marks).trim(),
    stream,
    certifications: String(certifications).trim().slice(0, 300),
    examScore: String(examScore).trim().slice(0, 120),
    onboardingStep: 2,
  });
  respondWithUser(res, req.user.id);
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/mindset — save Step 3 (completes onboarding)
// ---------------------------------------------------------------------------
router.post('/mindset', (req, res) => {
  const { answers } = req.body || {};

  if (!validateAnswers(answers, 6, 4)) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Mindset answers must be 6 valid option indexes.' },
    });
  }

  const scores = scoreMindset(answers);
  updateUser(req.user.id, { mindsetAnswers: answers, mindsetScores: scores, onboardingStep: 3 });
  respondWithUser(res, req.user.id);
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/step — move the progress marker (Back buttons).
// Only backwards moves are allowed; skipping ahead happens automatically
// through the step endpoints above.
// ---------------------------------------------------------------------------
router.post('/step', (req, res) => {
  const step = Number(req.body?.step);
  if (![0, 1, 2].includes(step)) {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: 'Step must be 0, 1 or 2.' } });
  }
  if (step > req.user.onboarding_step) {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: 'You cannot skip ahead in onboarding.' } });
  }

  updateUser(req.user.id, { onboardingStep: step });
  respondWithUser(res, req.user.id);
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/reset — start a fresh assessment ("Retake" in the UI).
// Clears all previous answers, scores and enrollment.
// ---------------------------------------------------------------------------
router.post('/reset', (req, res) => {
  updateUser(req.user.id, {
    onboardingStep: 0,
    enrolled: 0,
    interestAnswers: [],
    interestScores: { analytical: 0, creative: 0, social: 0, technical: 0 },
    mindsetAnswers: [],
    mindsetScores: { resilience: 0, confidence: 0, focus: 0 },
    marks: '',
    stream: '',
    certifications: '',
    examScore: '',
  });
  respondWithUser(res, req.user.id);
});

// ---------------------------------------------------------------------------
// POST /api/onboarding/enroll — "Request enrollment" on the Results page
// ---------------------------------------------------------------------------
router.post('/enroll', (req, res) => {
  updateUser(req.user.id, { enrolled: 1 });
  respondWithUser(res, req.user.id);
});

export default router;
