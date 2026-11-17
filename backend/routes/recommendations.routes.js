import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getRecommendations } from '../services/career.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/recommendations — the Results page's career blueprint.
//
// The recommendation engine runs on the backend: it reads the student's
// stored interest scores + academic profile and returns three career paths
// with personalised "whyText" explanations.
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  res.json(getRecommendations(req.user));
});

export default router;
