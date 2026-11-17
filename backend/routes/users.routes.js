import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { buildUserView, updateUser, getUserById } from '../services/user.service.js';

const router = Router();

const STREAMS = ['Science', 'Commerce', 'Arts', 'Engineering', 'Other'];

// ---------------------------------------------------------------------------
// PATCH /api/users/me — edit profile fields without touching onboarding
// progress. Used by the Profile settings dialog in the portal.
// ---------------------------------------------------------------------------
router.patch('/me', requireAuth, (req, res) => {
  const body = req.body || {};
  const fields = {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION', message: 'Name cannot be empty.' } });
    }
    fields.name = String(body.name).trim().slice(0, 100);
  }
  if (body.educationLevel !== undefined) fields.educationLevel = String(body.educationLevel).slice(0, 100);
  if (body.college !== undefined) fields.college = String(body.college).slice(0, 150);

  if (body.marks !== undefined) {
    const marksNum = parseFloat(body.marks);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) {
      return res.status(400).json({
        error: { code: 'VALIDATION', message: 'Please enter a valid percentage between 0 and 100.' },
      });
    }
    fields.marks = String(body.marks).trim();
  }
  if (body.stream !== undefined) {
    if (!STREAMS.includes(body.stream)) {
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION', message: 'Please select a valid stream.' } });
    }
    fields.stream = body.stream;
  }
  if (body.certifications !== undefined) fields.certifications = String(body.certifications).trim().slice(0, 300);
  if (body.examScore !== undefined) fields.examScore = String(body.examScore).trim().slice(0, 120);

  updateUser(req.user.id, fields);
  res.json({ user: buildUserView(getUserById(req.user.id)) });
});

export default router;
