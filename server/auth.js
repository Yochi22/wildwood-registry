import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { config, isProd } from './config.js';

export const COOKIE = isProd ? '__Host-sid' : 'sid';

export function issueSession(res, user) {
  const token = jwt.sign({ uid: user.id, tv: user.token_version, typ: 'session' }, config.jwtSecret, {
    expiresIn: `${config.sessionHours}h`,
    algorithm: 'HS256',
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionHours * 3600 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/' });
}

export function signMfaToken(user) {
  return jwt.sign({ uid: user.id, tv: user.token_version, typ: 'mfa' }, config.jwtSecret, {
    expiresIn: '5m',
    algorithm: 'HS256',
  });
}

export function verifyToken(token, typ) {
  try {
    const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return p.typ === typ ? p : null;
  } catch {
    return null;
  }
}

const loadUser = db.prepare(
  'SELECT id, email, name, role, active, token_version, totp_enabled FROM users WHERE id = ?'
);

/** Carga req.user si la cookie es válida; la sesión se invalida al desactivar el usuario o cambiar contraseña. */
export function sessionMiddleware(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    const p = verifyToken(token, 'session');
    if (p) {
      const u = loadUser.get(p.uid);
      if (u && u.active && u.token_version === p.tv) req.user = u;
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

const RANK = { viewer: 1, editor: 2, admin: 3 };
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (RANK[req.user.role] < RANK[role]) return res.status(403).json({ error: 'forbidden' });
  next();
};

/**
 * Protección CSRF: además de SameSite=Strict, toda petición que modifica datos
 * debe traer la cabecera X-Requested-With (un formulario de otro sitio no puede
 * enviarla sin CORS, y CORS no está habilitado) y un Origin propio si existe.
 */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'fetch') return res.status(403).json({ error: 'csrf' });
  // El Origin debe ser el propio sitio: el de PUBLIC_URL o el mismo host por el que llegó la petición.
  const origin = req.get('origin');
  if (origin && isProd) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {}
    const sameSite = origin === new URL(config.publicUrl).origin || host === req.get('host');
    if (!sameSite) return res.status(403).json({ error: 'csrf' });
  }
  next();
}
