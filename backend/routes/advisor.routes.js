import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateAdvisorReply } from '../services/advisor.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/advisor/chat — the AI Career Advisor.
//
// The frontend sends the student's message; the backend composes the reply
// from the student's stored profile, so advice is always grounded in their
// real assessment data.
// ---------------------------------------------------------------------------
router.post('/chat', requireAuth, (req, res) => {
  const message = String(req.body?.message || '').trim();

  if (!message) {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION', message: 'Please type a question first.' } });
  }
  if (message.length > 500) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'Please keep your question under 500 characters.' },
    });
  }

  res.json({ reply: generateAdvisorReply(message, req.user) });
});

export default router;
