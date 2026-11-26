import { Router } from 'express';
import { z } from 'zod';
import { db, audit } from '../db.js';
import { requireRole } from '../auth.js';
import { ROLES } from '../lib/constants.js';
import { hashPassword, passwordProblems } from '../lib/password.js';

const r = Router();
r.use(requireRole('admin'));

const cols = 'id, email, name, role, active, totp_enabled, last_login_at, created_at, locked_until';

r.get('/', (_req, res) => {
  res.json({ items: db.prepare(`SELECT ${cols} FROM users ORDER BY active DESC, name`).all() });
});

r.post('/', async (req, res) => {
  const p = z
    .object({ email: z.string().trim().email().max(200), name: z.string().trim().min(2).max(120), role: z.enum(ROLES), password: z.string() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'validation', fields: Object.fromEntries(p.error.issues.map((i) => [i.path[0], i.message])) });
  const problems = passwordProblems(p.data.password);
  if (problems.length) return res.status(400).json({ error: 'weak_password', problems });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(p.data.email)) return res.status(409).json({ error: 'email_taken' });
  const info = db
    .prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)')
    .run(p.data.email, p.data.name, p.data.role, await hashPassword(p.data.password));
  audit(req, 'user_create', 'user', info.lastInsertRowid, { email: p.data.email, role: p.data.role });
  res.status(201).json({ user: db.prepare(`SELECT ${cols} FROM users WHERE id = ?`).get(info.lastInsertRowid) });
});

const activeAdmins = () => db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1").get().n;

r.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'not_found' });
  const p = z
    .object({
      name: z.string().trim().min(2).max(120).optional(),
      role: z.enum(ROLES).optional(),
      active: z.boolean().optional(),
      password: z.string().optional(),
      revokeSessions: z.boolean().optional(),
      unlock: z.boolean().optional(),
      reset2fa: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'validation' });
  const b = p.data;

  const losingAdmin = u.role === 'admin' && u.active && ((b.role && b.role !== 'admin') || b.active === false);
  if (losingAdmin && activeAdmins() <= 1) return res.status(400).json({ error: 'last_admin' });
  if (id === req.user.id && (b.active === false || (b.role && b.role !== 'admin'))) return res.status(400).json({ error: 'self_demote' });

  let bump = !!b.revokeSessions || b.active === false || (b.role && b.role !== u.role);
  let hash = u.password_hash;
  if (b.password) {
    const problems = passwordProblems(b.password);
    if (problems.length) return res.status(400).json({ error: 'weak_password', problems });
    hash = await hashPassword(b.password);
    bump = true;
  }
  db.prepare(
    `UPDATE users SET name=?, role=?, active=?, password_hash=?, token_version=token_version+?,
       locked_until=CASE WHEN ? THEN NULL ELSE locked_until END,
       failed_attempts=CASE WHEN ? THEN 0 ELSE failed_attempts END,
       totp_enabled=CASE WHEN ? THEN 0 ELSE totp_enabled END,
       totp_secret=CASE WHEN ? THEN NULL ELSE totp_secret END,
       updated_at=datetime('now') WHERE id=?`
  ).run(b.name ?? u.name, b.role ?? u.role, b.active === undefined ? u.active : b.active ? 1 : 0, hash, bump ? 1 : 0, b.unlock ? 1 : 0, b.unlock ? 1 : 0, b.reset2fa ? 1 : 0, b.reset2fa ? 1 : 0, id);
  const changes = Object.keys(b).filter((k) => k !== 'password');
  if (b.password) changes.push('password_reset');
  audit(req, 'user_update', 'user', id, { email: u.email, changes });
  res.json({ user: db.prepare(`SELECT ${cols} FROM users WHERE id = ?`).get(id) });
});

export default r;
