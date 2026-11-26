import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';

const r = Router();

r.get('/', requireRole('admin'), (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = [25, 50, 100].includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 50;
  const where = [];
  const params = {};
  if (req.query.q) {
    where.push('(a.user_email LIKE @q OR u.name LIKE @q OR a.details LIKE @q OR a.ip LIKE @q)');
    params.q = `%${String(req.query.q).replace(/[%_]/g, '')}%`;
  }
  if (req.query.action && /^[a-z0-9_]+$/.test(req.query.action)) {
    where.push('a.action = @action');
    params.action = req.query.action;
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) n FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ${w}`).get(params).n;
  const items = db
    .prepare(
      `SELECT a.*, u.name user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ${w}
       ORDER BY a.id DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize })
    .map((a) => ({ ...a, details: a.details ? JSON.parse(a.details) : null }));
  res.json({ items, total, page, pageSize });
});

export default r;
