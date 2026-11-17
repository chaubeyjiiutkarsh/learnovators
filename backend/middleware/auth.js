import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getUserById } from '../services/user.service.js';

// ---------------------------------------------------------------------------
// JWT authentication middleware
// ---------------------------------------------------------------------------
// The frontend sends:  Authorization: Bearer <token>
// The token was issued by /api/auth/login or /api/auth/signup and contains the
// user id in the "sub" claim. We verify the signature and load the user from
// the database, so every protected route has req.user available.

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'Please log in to continue.' } });
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({
      error: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please log in again.' },
    });
  }

  const user = getUserById(payload.sub);
  if (!user) {
    return res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'Account not found. Please log in again.' } });
  }

  req.user = user;
  next();
}
