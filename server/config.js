import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// Carga .env simple (sin dependencias). Las variables ya definidas tienen prioridad.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
export const isProd = env.NODE_ENV === 'production';

const DATA_DIR = path.resolve(ROOT, env.DATA_DIR || 'data');

let jwtSecret = env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) {
    console.error('FATAL: JWT_SECRET debe definirse (mínimo 32 caracteres) en producción.');
    process.exit(1);
  }
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[config] JWT_SECRET no definido: usando uno temporal (las sesiones se pierden al reiniciar).');
}

export const config = {
  port: Number(env.PORT || 3001),
  // Solo accesible desde el propio servidor; el público entra por nginx/Caddy.
  host: env.HOST || '127.0.0.1',
  dataDir: DATA_DIR,
  dbFile: path.join(DATA_DIR, 'registry.sqlite'),
  uploadsDir: path.join(DATA_DIR, 'uploads'),
  backupsDir: path.join(DATA_DIR, 'backups'),
  jwtSecret,
  sessionHours: Number(env.SESSION_HOURS || 8),
  trustProxy: env.TRUST_PROXY ?? (isProd ? '1' : 'false'),
  publicUrl: (env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  regPrefix: (env.REG_PREFIX || 'WWT').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'WWT',
  timezone: env.APP_TIMEZONE || 'UTC',
  maxLoginAttempts: 5,
  lockMinutes: 15,
  brand: {
    name: env.BRAND_NAME || 'Wildwood Training',
    registryName: env.REGISTRY_NAME || 'Wildwood Service Dog Registry',
    siteUrl: env.BRAND_SITE_URL || 'https://wildwood-training.com/',
    contactEmail: env.BRAND_CONTACT_EMAIL || '',
  },
};

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.backupsDir, { recursive: true });
