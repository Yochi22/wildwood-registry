// Respaldo diario (programado con cron, ver README).
//
// - Base de datos: una copia comprimida por día; se conservan las últimas BACKUP_KEEP (14).
// - Fotos: espejo incremental. Las fotos nunca se modifican (cada foto nueva tiene un nombre
//   nuevo), así que solo se agregan las nuevas. En el mismo disco se usan enlaces duros:
//   no ocupan espacio extra y sobreviven aunque la foto original se borre.
// - Copia fuera del servidor (recomendado): si BACKUP_REMOTE está definido, se sube con rclone.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { db } from '../db.js';
import { config } from '../config.js';

const keep = Number(process.env.BACKUP_KEEP || 14);
const dbDir = path.join(config.backupsDir, 'db');
const photoDir = path.join(config.backupsDir, 'photos');
fs.mkdirSync(dbDir, { recursive: true });
fs.mkdirSync(photoDir, { recursive: true });

// 1. Base de datos: copia consistente sin detener el servicio, luego gzip.
const stamp = new Date().toISOString().replace(/:/g, '').replace('T', '_').slice(0, 15);
const tmp = path.join(dbDir, `.tmp-${stamp}.sqlite`);
const out = path.join(dbDir, `registry-${stamp}.sqlite.gz`);
await db.backup(tmp);
db.close();
await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 9 }), fs.createWriteStream(out));
fs.rmSync(tmp);

const snapshots = fs.readdirSync(dbDir).filter((f) => /^registry-.*\.sqlite\.gz$/.test(f)).sort();
for (const old of snapshots.slice(0, Math.max(0, snapshots.length - keep))) fs.rmSync(path.join(dbDir, old));

// 2. Fotos: solo las nuevas.
let added = 0;
for (const f of fs.readdirSync(config.uploadsDir)) {
  const dest = path.join(photoDir, f);
  if (fs.existsSync(dest)) continue;
  const src = path.join(config.uploadsDir, f);
  try {
    fs.linkSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
  }
  added++;
}

// 3. Copia externa opcional (p. ej. BACKUP_REMOTE=r2:wildwood-respaldos).
if (process.env.BACKUP_REMOTE) {
  const remote = process.env.BACKUP_REMOTE.replace(/\/$/, '');
  execFileSync('rclone', ['sync', dbDir, `${remote}/db`], { stdio: 'inherit' });
  execFileSync('rclone', ['copy', photoDir, `${remote}/photos`], { stdio: 'inherit' });
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(
  `[${new Date().toISOString()}] respaldo OK · base de datos ${mb(fs.statSync(out).size)} MB · ${added} fotos nuevas · ${Math.min(snapshots.length, keep)} copias de la base conservadas` +
    (process.env.BACKUP_REMOTE ? ' · subido a ' + process.env.BACKUP_REMOTE : '')
);
