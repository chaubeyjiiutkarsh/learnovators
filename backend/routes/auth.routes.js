import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  createUser,
  getUserByEmail,
  getUserViewById,
  buildUserView,
} from '../services/user.service.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function sessionPayload(user) {
  return { token: issueToken(user), user: buildUserView(user) };
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup — create an account with email + password
// ---------------------------------------------------------------------------
router.post('/signup', async (req, res) => {
  const { name, email, password, educationLevel = '', college = '' } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Please enter your name.' } });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Please enter a valid email address.' } });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' } });
  }

  if (getUserByEmail(email)) {
    return res.status(409).json({
      error: {
        code: 'EMAIL_IN_USE',
        message: 'An account with this email already exists. Try logging in instead.',
      },
    });
  }

  // Passwords are NEVER stored in plain text — bcrypt hashes them first.
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = createUser({
    name: String(name).trim(),
    email: String(email).trim(),
    passwordHash,
    provider: 'email',
    educationLevel,
    college,
  });

  res.status(201).json(sessionPayload(user));
});

// ---------------------------------------------------------------------------
// POST /api/auth/login — email + password login
// ---------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  const user = email ? getUserByEmail(email) : null;
  // Same generic message for "no such user" and "wrong password" so the
  // endpoint can't be used to discover which emails are registered.
  const ok =
    user &&
    user.password_hash &&
    (await bcrypt.compare(String(password || ''), user.password_hash));

  if (!ok) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect. Please try again.' },
    });
  }

  res.json(sessionPayload(user));
});

// ---------------------------------------------------------------------------
// POST /api/auth/google — real Google sign-in
// ---------------------------------------------------------------------------
// The frontend uses Google Identity Services and sends the Google "ID token"
// here. We verify it against Google's servers and check it was issued for OUR
// client id, then create or sign into the matching account.
router.post('/google', async (req, res) => {
  const { credential } = req.body || {};

  if (!config.googleClientId) {
    return res.status(501).json({
      error: {
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google sign-in is not configured on the server (set GOOGLE_CLIENT_ID).',
      },
    });
  }
  if (!credential) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Missing Google credential.' } });
  }

  // Verify the ID token with Google's tokeninfo endpoint and check the
  // audience — this proves the token is genuine and intended for this app.
  let info;
  try {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!resp.ok) throw new Error('token rejected');
    info = await resp.json();
  } catch {
    return res
      .status(401)
      .json({ error: { code: 'GOOGLE_INVALID', message: 'Could not verify the Google sign-in.' } });
  }

  if (info.aud !== config.googleClientId || !(info.email_verified === 'true' || info.email_verified === true)) {
    return res
      .status(401)
      .json({ error: { code: 'GOOGLE_INVALID', message: 'Could not verify the Google sign-in.' } });
  }

  let user = getUserByEmail(info.email);
  if (!user) {
    user = createUser({
      name: info.name || info.email.split('@')[0],
      email: info.email,
      provider: 'google',
    });
  }

  res.json(sessionPayload(user));
});

// ---------------------------------------------------------------------------
// POST /api/auth/google-demo — fallback used when no Google client id is set
// ---------------------------------------------------------------------------
// Lets the "Continue with Google" button complete a REAL backend login during
// demos/development without OAuth setup. Configure GOOGLE_CLIENT_ID +
// VITE_GOOGLE_CLIENT_ID to switch this button to genuine Google sign-in.
router.post('/google-demo', (req, res) => {
  const DEMO_EMAIL = 'alex.rivera@student.edu';
  let user = getUserByEmail(DEMO_EMAIL);
  if (!user) {
    user = createUser({
      name: 'Alex Rivera',
      email: DEMO_EMAIL,
      provider: 'google-demo',
      educationLevel: 'Undergraduate (UG)',
      college: 'National Tech Institute',
    });
  }
  res.json(sessionPayload(user));
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — the logged-in user's full profile
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: getUserViewById(req.user.id) });
});

export default router;
