import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { config } from '../config.js';
import { computeState, today } from '../lib/status.js';
import { brandLogoPath } from '../lib/brand.js';

const r = Router();

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'too_many_requests' } });

r.get('/config', (_req, res) => {
  res.json({ brand: config.brand, hasLogo: !!brandLogoPath() });
});

r.get('/logo.png', (_req, res) => {
  const p = brandLogoPath();
  if (!p) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400').sendFile(p);
});

/**
 * Perfil del perro al escanear el QR. Solo por número de registro exacto
 * (aleatorio, no enumerable). Nunca devuelve notas internas ni el documento completo.
 */
r.get('/dogs/:code', limiter, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!/^[A-Z]{2,6}-\d{4}-[A-Z0-9]{6}$/.test(code)) return res.status(404).json({ error: 'not_found' });
  const d = db.prepare('SELECT * FROM dogs WHERE reg_number = ?').get(code);
  if (!d) return res.status(404).json({ error: 'not_found' });
  const t = today();
  res.json({
    state: computeState(d, t),
    checkedAt: new Date().toISOString(),
    dog: {
      reg_number: d.reg_number,
      dog_name: d.dog_name,
      breed: d.breed,
      owner_name: d.owner_name,
      owner_document: d.owner_document ? d.owner_document.replace(/.(?=.{4})/g, '•') : null,
      microchip: d.microchip,
      specialty: d.specialty,
      country: d.country,
      issue_date: d.issue_date,
      expiry_date: d.expiry_date,
      lifetime: !!d.lifetime,
      tasks: JSON.parse(d.tasks || '[]'),
      photo_url: d.photo ? `/media/${d.photo}` : null,
    },
  });
});

export default r;
