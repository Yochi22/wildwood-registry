import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db, audit } from '../db.js';
import { requireRole } from '../auth.js';
import { SPECIALTIES } from '../lib/constants.js';
import { generateRegNumber } from '../lib/regnumber.js';
import { saveDogPhoto, deletePhoto } from '../lib/images.js';
import { today, addDays, addYears, computeState, daysUntil, STATE_SQL, EXPIRING_DAYS } from '../lib/status.js';
import { qrSvg, qrPng, profileUrl } from '../lib/qr.js';
import { isCatalogTask, catalogHas, taskText } from '../lib/tasks.js';
import { renderCardPdf } from '../lib/card.js';

const r = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 30 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.mimetype)),
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date');
const optText = (max) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max).nullable().optional());
const bool = z.preprocess((v) => v === true || v === 'true' || v === '1' || v === 1, z.boolean());

const dogSchema = z
  .object({
    status: z.enum(['active', 'inactive']).default('active'),
    owner_name: z.string().trim().min(2, 'required').max(150),
    microchip: z.preprocess(
      // Vacío o «N/A» = sin microchip.
      (v) => (typeof v === 'string' ? (/^(n\/?a)?$/i.test(v.replace(/\s+/g, '')) ? null : v.replace(/\s+/g, '')) : v),
      z.string().regex(/^[A-Za-z0-9.-]{6,30}$/, 'microchip').nullable().optional()
    ),
    dog_name: z.string().trim().min(1, 'required').max(80),
    breed: optText(100),
    specialty: z.enum(SPECIALTIES, { message: 'required' }),
    country: z.string().regex(/^[A-Z]{2}$/, 'required'),
    issue_date: date,
    lifetime: bool.default(false),
    expiry_date: z.preprocess((v) => (v === '' ? null : v), date.nullable().optional()),
    tasks: z.preprocess(
      (v) => (typeof v === 'string' ? JSON.parse(v || '[]') : v),
      z.array(z.string().trim().min(1).max(200).refine((t) => !isCatalogTask(t) || catalogHas(t), 'invalid')).max(40)
    ),
    notes: optText(2000),
  })
  .superRefine((d, ctx) => {
    if (!d.lifetime && !d.expiry_date) ctx.addIssue({ code: 'custom', path: ['expiry_date'], message: 'required' });
    if (!d.lifetime && d.expiry_date && d.expiry_date < d.issue_date)
      ctx.addIssue({ code: 'custom', path: ['expiry_date'], message: 'expiry_before_issue' });
  });

function parseDog(body) {
  try {
    const res = dogSchema.safeParse(body);
    if (!res.success) {
      return { errors: Object.fromEntries(res.error.issues.map((i) => [i.path.join('.') || '_', i.message])) };
    }
    const d = res.data;
    return {
      data: {
        ...d,
        lifetime: d.lifetime ? 1 : 0,
        expiry_date: d.lifetime ? null : d.expiry_date,
        microchip: d.microchip ?? null,
        breed: d.breed ?? null,
        notes: d.notes ?? null,
        tasks: JSON.stringify(d.tasks),
      },
    };
  } catch {
    return { errors: { tasks: 'invalid' } };
  }
}

export function serializeDog(d, t = today()) {
  if (!d) return d;
  const state = computeState(d, t);
  const days = state === 'active' ? daysUntil(d.expiry_date, t) : null;
  return {
    ...d,
    lifetime: !!d.lifetime,
    tasks: JSON.parse(d.tasks || '[]'),
    photo_url: d.photo ? `/media/${d.photo}` : null,
    state,
    days_left: days,
    expiring: state === 'active' && days <= EXPIRING_DAYS,
    profile_url: profileUrl(d.reg_number),
  };
}

const SORTS = {
  reg: 'd.reg_number',
  dog: 'd.dog_name COLLATE NOCASE',
  breed: 'd.breed COLLATE NOCASE',
  owner: 'd.owner_name COLLATE NOCASE',
  microchip: 'd.microchip',
  specialty: 'd.specialty',
  country: 'd.country',
  issue: 'd.issue_date',
  expiry: 'd.lifetime %DIR%, d.expiry_date',
  created: 'd.created_at',
};

function dateParams() {
  const t = today();
  return { today: t, soon: addDays(t, EXPIRING_DAYS) };
}

function buildFilter(q) {
  const where = [];
  const params = dateParams();
  if (q.q) {
    const term = String(q.q).trim().replace(/[%_]/g, '').replace(/\s+/g, ' ');
    if (term) {
      where.push(`(d.reg_number LIKE @q OR d.dog_name LIKE @q OR d.owner_name LIKE @q OR d.microchip LIKE @qc OR d.breed LIKE @q)`);
      params.q = `%${term}%`;
      params.qc = `%${term.replace(/\s/g, '')}%`;
    }
  }
  if (q.state && STATE_SQL[q.state]) where.push(STATE_SQL[q.state]);
  if (q.specialty && SPECIALTIES.includes(q.specialty)) {
    where.push('d.specialty = @specialty');
    params.specialty = q.specialty;
  }
  if (q.country && /^[A-Z]{2}$/.test(q.country)) {
    where.push('d.country = @country');
    params.country = q.country;
  }
  const within = Number(q.expires);
  if ([30, 60, 90].includes(within)) {
    where.push(`${STATE_SQL.active} AND d.expiry_date <= @within`);
    params.within = addDays(params.today, within);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function orderBy(q) {
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const col = SORTS[q.sort] || SORTS.created;
  return `${col.replace('%DIR%', dir)} ${dir}, d.id ${dir}`;
}

const getDog = db.prepare('SELECT * FROM dogs WHERE id = ?');

r.get('/', requireRole('viewer'), (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = [10, 25, 50, 100].includes(Number(req.query.pageSize)) ? Number(req.query.pageSize) : 25;
  const { sql, params } = buildFilter(req.query);
  const total = db.prepare(`SELECT COUNT(*) n FROM dogs d ${sql}`).get(params).n;
  const rows = db
    .prepare(`SELECT d.* FROM dogs d ${sql} ORDER BY ${orderBy(req.query)} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });
  const countries = db.prepare('SELECT DISTINCT country FROM dogs ORDER BY country').all().map((c) => c.country);
  res.json({ items: rows.map((d) => serializeDog(d, params.today)), total, page, pageSize, countries });
});

r.get('/overview', requireRole('viewer'), (_req, res) => {
  const params = dateParams();
  const expiringCount = db.prepare(`SELECT COUNT(*) n FROM dogs d WHERE ${STATE_SQL.expiring}`).get(params).n;
  const expiring = db
    .prepare(`SELECT d.* FROM dogs d WHERE ${STATE_SQL.expiring} ORDER BY d.expiry_date ASC LIMIT 8`)
    .all(params)
    .map((d) => serializeDog(d, params.today));
  const byMonth = db
    .prepare(
      `SELECT strftime('%Y-%m', issue_date) k, COUNT(*) n FROM dogs
       WHERE issue_date >= date(@today, 'start of month', '-11 months') AND issue_date <= @today
       GROUP BY k ORDER BY k`
    )
    .all(params);
  const activity = db
    .prepare(
      `SELECT a.id, a.action, a.created_at, a.entity_id, COALESCE(u.name, a.user_email) user_name,
              d.dog_name, COALESCE(d.reg_number, json_extract(a.details, '$.reg_number')) reg_number
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN dogs d ON d.id = CAST(a.entity_id AS INTEGER)
       WHERE a.entity = 'dog' AND a.entity_id IS NOT NULL
       ORDER BY a.id DESC LIMIT 8`
    )
    .all();
  res.json({ today: params.today, expiringCount, expiring, byMonth, activity });
});

r.get('/export.csv', requireRole('editor'), (req, res) => {
  const { sql, params } = buildFilter(req.query);
  const rows = db.prepare(`SELECT d.* FROM dogs d ${sql} ORDER BY ${orderBy(req.query)}`).all(params);
  const cols = ['reg_number', 'state', 'dog_name', 'breed', 'owner_name', 'microchip', 'specialty', 'country', 'issue_date', 'expiry_date', 'lifetime', 'tasks', 'created_at'];
  // Prefijo ' para neutralizar inyección de fórmulas al abrir en Excel.
  const esc = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [cols.join(';')];
  for (const d of rows) {
    const row = { ...d, microchip: d.microchip || 'N/A', state: computeState(d, params.today), tasks: JSON.parse(d.tasks).map((x) => taskText(x, 'es')).join(' | '), lifetime: d.lifetime ? 'yes' : 'no' };
    lines.push(cols.map((c) => esc(row[c])).join(';'));
  }
  audit(req, 'export', 'dog', null, { count: rows.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="registros-${params.today}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

r.post('/bulk', requireRole('editor'), (req, res) => {
  const p = z
    .object({ ids: z.array(z.number().int().positive()).min(1).max(500), action: z.enum(['activate', 'deactivate', 'renew']) })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'validation' });
  const { ids, action } = p.data;
  const t = today();
  let changed = 0;
  db.transaction(() => {
    for (const id of ids) {
      const d = getDog.get(id);
      if (!d) continue;
      if (action === 'renew') {
        if (d.lifetime) continue;
        const base = d.expiry_date && d.expiry_date > t ? d.expiry_date : t;
        db.prepare("UPDATE dogs SET expiry_date=?, updated_by=?, updated_at=datetime('now') WHERE id=?").run(addYears(base, 1), req.user.id, id);
      } else {
        db.prepare("UPDATE dogs SET status=?, updated_by=?, updated_at=datetime('now') WHERE id=?").run(action === 'activate' ? 'active' : 'inactive', req.user.id, id);
      }
      audit(req, action, 'dog', id, { reg_number: d.reg_number, bulk: true });
      changed++;
    }
  })();
  res.json({ changed });
});

r.get('/:id', requireRole('viewer'), (req, res) => {
  const d = getDog.get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'not_found' });
  const history = db
    .prepare(
      `SELECT a.action, COALESCE(u.name, a.user_email) user_name, a.details, a.created_at FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.entity='dog' AND a.entity_id=? ORDER BY a.id DESC LIMIT 50`
    )
    .all(String(d.id))
    .map((h) => ({ ...h, details: h.details ? JSON.parse(h.details) : null }));
  res.json({ dog: serializeDog(d), history });
});

r.get('/:id/qr.:fmt', requireRole('viewer'), async (req, res) => {
  const d = getDog.get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'not_found' });
  if (req.query.download) res.setHeader('Content-Disposition', `attachment; filename="QR-${d.reg_number}.${req.params.fmt}"`);
  if (req.params.fmt === 'svg') res.type('image/svg+xml').send(await qrSvg(d.reg_number));
  else if (req.params.fmt === 'png') res.type('image/png').send(await qrPng(d.reg_number, 1024));
  else res.status(404).end();
});

r.get('/:id/card.pdf', requireRole('viewer'), async (req, res, next) => {
  const d = getDog.get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'not_found' });
  try {
    const pdf = await renderCardPdf(d);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="carnet-${d.reg_number}.pdf"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

async function handlePhoto(req) {
  if (!req.file) return { photo: undefined };
  try {
    return { photo: await saveDogPhoto(req.file.buffer) };
  } catch {
    return { error: true };
  }
}

const duplicateChip = (chip, id = 0) => chip && db.prepare('SELECT 1 FROM dogs WHERE microchip = ? AND id != ?').get(chip, id);

r.post('/', requireRole('editor'), upload.single('photo'), async (req, res) => {
  const { data, errors } = parseDog(req.body);
  if (errors) return res.status(400).json({ error: 'validation', fields: errors });
  if (duplicateChip(data.microchip)) return res.status(409).json({ error: 'validation', fields: { microchip: 'duplicate' } });
  const { photo, error } = await handlePhoto(req);
  if (error) return res.status(400).json({ error: 'validation', fields: { photo: 'invalid_image' } });
  const reg = generateRegNumber();
  const info = db
    .prepare(
      `INSERT INTO dogs (reg_number, status, photo, owner_name, microchip, dog_name, breed, specialty, country, issue_date, expiry_date, lifetime, tasks, notes, created_by, updated_by)
       VALUES (@reg, @status, @photo, @owner_name, @microchip, @dog_name, @breed, @specialty, @country, @issue_date, @expiry_date, @lifetime, @tasks, @notes, @uid, @uid)`
    )
    .run({ ...data, reg, photo: photo ?? null, uid: req.user.id });
  audit(req, 'create', 'dog', info.lastInsertRowid, { reg_number: reg });
  res.status(201).json({ dog: serializeDog(getDog.get(info.lastInsertRowid)) });
});

r.put('/:id', requireRole('editor'), upload.single('photo'), async (req, res) => {
  const id = Number(req.params.id);
  const existing = getDog.get(id);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const { data, errors } = parseDog(req.body);
  if (errors) return res.status(400).json({ error: 'validation', fields: errors });
  if (duplicateChip(data.microchip, id)) return res.status(409).json({ error: 'validation', fields: { microchip: 'duplicate' } });
  const up = await handlePhoto(req);
  if (up.error) return res.status(400).json({ error: 'validation', fields: { photo: 'invalid_image' } });
  const photo = up.photo !== undefined ? up.photo : req.body.remove_photo === '1' ? null : existing.photo;
  db.prepare(
    `UPDATE dogs SET status=@status, photo=@photo, owner_name=@owner_name, microchip=@microchip,
       dog_name=@dog_name, breed=@breed, specialty=@specialty, country=@country, issue_date=@issue_date,
       expiry_date=@expiry_date, lifetime=@lifetime, tasks=@tasks, notes=@notes, updated_by=@uid, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...data, photo, uid: req.user.id, id });
  if (photo !== existing.photo) await deletePhoto(existing.photo);
  const changed = Object.keys(data).filter((k) => String(data[k] ?? '') !== String(existing[k] ?? ''));
  if (photo !== existing.photo) changed.push('photo');
  audit(req, 'update', 'dog', id, { reg_number: existing.reg_number, changed });
  res.json({ dog: serializeDog(getDog.get(id)) });
});

r.post('/:id/status', requireRole('editor'), (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: 'validation' });
  const d = getDog.get(id);
  if (!d) return res.status(404).json({ error: 'not_found' });
  db.prepare("UPDATE dogs SET status=?, updated_by=?, updated_at=datetime('now') WHERE id=?").run(status, req.user.id, id);
  audit(req, status === 'active' ? 'activate' : 'deactivate', 'dog', id, { reg_number: d.reg_number });
  res.json({ dog: serializeDog(getDog.get(id)) });
});

r.post('/:id/renew', requireRole('editor'), (req, res) => {
  const id = Number(req.params.id);
  const years = [1, 2, 3].includes(Number(req.body?.years)) ? Number(req.body.years) : 1;
  const d = getDog.get(id);
  if (!d) return res.status(404).json({ error: 'not_found' });
  if (d.lifetime) return res.status(400).json({ error: 'lifetime' });
  const t = today();
  const base = d.expiry_date && d.expiry_date > t ? d.expiry_date : t;
  const expiry = addYears(base, years);
  db.prepare("UPDATE dogs SET expiry_date=?, updated_by=?, updated_at=datetime('now') WHERE id=?").run(expiry, req.user.id, id);
  audit(req, 'renew', 'dog', id, { reg_number: d.reg_number, expiry_date: expiry });
  res.json({ dog: serializeDog(getDog.get(id)) });
});

r.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const d = getDog.get(id);
  if (!d) return res.status(404).json({ error: 'not_found' });
  if (String(req.body?.confirm || '').trim().toLowerCase() !== d.dog_name.trim().toLowerCase()) {
    return res.status(400).json({ error: 'confirm_mismatch' });
  }
  db.prepare('DELETE FROM dogs WHERE id = ?').run(id);
  await deletePhoto(d.photo);
  audit(req, 'delete', 'dog', id, { reg_number: d.reg_number, dog_name: d.dog_name, owner_name: d.owner_name });
  res.json({ ok: true });
});

export default r;
