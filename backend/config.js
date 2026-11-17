import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Central configuration. Every value can be overridden through the .env file
// (see .env.example). Sensible defaults are provided for local development.
export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'learnovators-dev-secret-do-not-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  dbFile: process.env.DB_FILE
    ? path.resolve(process.env.DB_FILE)
    : path.join(__dirname, 'data', 'learnovators.db'),
};

if (!process.env.JWT_SECRET) {
  console.warn(
    '[config] JWT_SECRET not set — using a default development secret. ' +
      'Set a real secret in backend/.env before deploying.'
  );
}
