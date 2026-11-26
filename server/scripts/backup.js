// Respaldo consistente de la base de datos + fotos. Conserva los últimos BACKUP_KEEP (14 por defecto).
// Programarlo a diario con cron (ver README).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { db } from '../db.js';
import { config } from '../config.js';

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const dir = path.join(config.backupsDir, stamp);
fs.mkdirSync(dir, { recursive: true });

await db.backup(path.join(dir, 'registry.sqlite'));
execFileSync('tar', ['-czf', path.join(dir, 'uploads.tar.gz'), '-C', config.dataDir, 'uploads']);
console.log(`Respaldo creado en ${dir}`);

const keep = Number(process.env.BACKUP_KEEP || 14);
const all = fs.readdirSync(config.backupsDir).filter((f) => /^\d{4}-/.test(f)).sort();
for (const old of all.slice(0, Math.max(0, all.length - keep))) {
  fs.rmSync(path.join(config.backupsDir, old), { recursive: true, force: true });
}
db.close();
