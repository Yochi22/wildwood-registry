import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import QRCode from 'qrcode';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import { db, audit } from '../db.js';
import { config } from '../config.js';
import { hashPassword, verifyPassword, DUMMY_HASH, passwordProblems } from '../lib/password.js';
import { issueSession, clearSession, signMfaToken, verifyToken, requireAuth } from '../auth.js';

const r = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const getByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const getById = db.prepare('SELECT * FROM users WHERE id = ?');

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, totpEnabled: !!u.totp_enabled };
}

async function checkTotp(user, code) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const res = await verifyTotp({
    secret: user.totp_secret,
    token: String(code),
    epochTolerance: 30,
    // Anti-replay: un código ya usado no vuelve a servir.
    ...(user.totp_last_step != null ? { afterTimeStep: user.totp_last_step } : {}),
  });
  if (!res.valid) return false;
  db.prepare('UPDATE users SET totp_last_step = ? WHERE id = ?').run(res.timeStep, user.id);
  return true;
}

function finishLogin(req, res, user) {
  db.prepare(
    "UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?"
  ).run(user.id);
  issueSession(res, user);
  req.user = user;
  audit(req, 'login', 'user', user.id);
  res.json({ user: publicUser(user) });
}

function registerFailure(req, user, email) {
  if (user) {
    const attempts = user.failed_attempts + 1;
    const lock = attempts >= config.maxLoginAttempts;
    db.prepare(
      `UPDATE users SET failed_attempts = ?, locked_until = ${lock ? `datetime('now', '+${config.lockMinutes} minutes')` : 'locked_until'} WHERE id = ?`
    ).run(lock ? 0 : attempts, user.id);
    if (lock) audit(req, 'account_locked', 'user', user.id, { email });
  }
  audit(req, 'login_failed', 'user', user?.id, { email });
}

const isLocked = (u) => u.locked_until && new Date(u.locked_until + 'Z') > new Date();

r.post('/login', loginLimiter, async (req, res) => {
  const body = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'invalid_credentials' });
  const { email, password } = body.data;
  const user = getByEmail.get(email.trim());
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

  if (user && isLocked(user)) return res.status(423).json({ error: 'locked' });
  if (!user || !ok || !user.active) {
    registerFailure(req, user, email);
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  if (user.totp_enabled) return res.json({ mfaRequired: true, mfaToken: signMfaToken(user) });
  finishLogin(req, res, user);
});

r.post('/mfa', loginLimiter, async (req, res) => {
  const p = verifyToken(String(req.body?.mfaToken || ''), 'mfa');
  const user = p && getById.get(p.uid);
  if (!user || !user.active || user.token_version !== p.tv) return res.status(401).json({ error: 'mfa_expired' });
  if (isLocked(user)) return res.status(423).json({ error: 'locked' });
  if (!(await checkTotp(user, req.body?.code))) {
    registerFailure(req, user, user.email);
    return res.status(401).json({ error: 'invalid_code' });
  }
  finishLogin(req, res, user);
});

r.post('/logout', (req, res) => {
  if (req.user) audit(req, 'logout', 'user', req.user.id);
  clearSession(res);
  res.json({ ok: true });
});

r.get('/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

r.post('/password', requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  const user = getById.get(req.user.id);
  if (!(await verifyPassword(String(current || ''), user.password_hash))) {
    return res.status(400).json({ error: 'wrong_password' });
  }
  const problems = passwordProblems(next);
  if (problems.length) return res.status(400).json({ error: 'weak_password', problems });
  db.prepare(
    "UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = datetime('now') WHERE id = ?"
  ).run(await hashPassword(next), user.id);
  audit(req, 'password_changed', 'user', user.id);
  issueSession(res, getById.get(user.id)); // las otras sesiones quedan revocadas
  res.json({ ok: true });
});

r.post('/2fa/setup', requireAuth, async (req, res) => {
  const user = getById.get(req.user.id);
  if (user.totp_enabled) return res.status(400).json({ error: 'already_enabled' });
  const secret = generateSecret();
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);
  const uri = generateURI({ issuer: config.brand.registryName, label: user.email, secret });
  res.json({ secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
});

r.post('/2fa/enable', requireAuth, async (req, res) => {
  const user = getById.get(req.user.id);
  if (!user.totp_secret || user.totp_enabled) return res.status(400).json({ error: 'setup_required' });
  if (!(await checkTotp(user, req.body?.code))) return res.status(400).json({ error: 'invalid_code' });
  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(user.id);
  audit(req, '2fa_enabled', 'user', user.id);
  res.json({ ok: true });
});

r.post('/2fa/disable', requireAuth, async (req, res) => {
  const user = getById.get(req.user.id);
  if (!(await verifyPassword(String(req.body?.password || ''), user.password_hash))) {
    return res.status(400).json({ error: 'wrong_password' });
  }
  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = NULL WHERE id = ?').run(user.id);
  audit(req, '2fa_disabled', 'user', user.id);
  res.json({ ok: true });
});

export default r;
