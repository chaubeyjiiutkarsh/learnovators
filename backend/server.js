import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { initDb } from './db/index.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import recommendationsRoutes from './routes/recommendations.routes.js';
import portalRoutes from './routes/portal.routes.js';
import advisorRoutes from './routes/advisor.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Database ---------------------------------------------------------------
initDb();

// --- Express app ------------------------------------------------------------
const app = express();

app.use(cors()); // allows the Vite dev server (5173) to call this API (4000)
app.use(express.json({ limit: '1mb' }));

// Small request logger — helpful during development and demos.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.path}`);
  }
  next();
});

// --- REST API ---------------------------------------------------------------
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'learnovators-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/advisor', advisorRoutes);

// Unknown API routes → JSON 404 (never fall through to the HTML shell)
app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint.' } });
});

// --- Production static hosting ---------------------------------------------
// After `npm run build` (frontend), Express serves the built React app too,
// so one server can host the whole project in production.
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log('[server] Serving production build from /dist');
}

// --- Central error handler --------------------------------------------------
// Any uncaught error in a route ends up here as a clean JSON response
// instead of an HTML error page or a hanging request.
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again.' },
  });
});

app.listen(config.port, () => {
  console.log('==============================================');
  console.log('  Learnovators API');
  console.log(`  Listening on http://localhost:${config.port}`);
  console.log(`  Database: ${config.dbFile}`);
  console.log(`  Google sign-in: ${config.googleClientId ? 'configured' : 'not configured (demo mode)'}`);
  console.log('==============================================');
});
