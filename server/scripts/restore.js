// Restaura un respaldo. DETÉN el servicio antes:  sudo systemctl stop wildwood-registry
// Uso: npm run restore -- registry-2026-11-26_0317.sqlite.gz
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';

const name = process.argv[2];
const file = name && (fs.existsSync(name) ? name : path.join(config.backupsDir, 'db', name));
if (!file || !fs.existsSync(file)) {
  const list = fs.existsSync(path.join(config.backupsDir, 'db')) ? fs.readdirSync(path.join(config.backupsDir, 'db')).filter((f) => f.endsWith('.gz')) : [];
  console.error('Uso: npm run restore -- <archivo.sqlite.gz>\nRespaldos disponibles:\n  ' + (list.join('\n  ') || '(ninguno)'));
  process.exit(1);
}

// La base actual se guarda aparte por si acaso.
for (const ext of ['', '-wal', '-shm']) {
  const f = config.dbFile + ext;
  if (fs.existsSync(f)) fs.renameSync(f, `${f}.antes-de-restaurar-${Date.now()}`);
}
await pipeline(fs.createReadStream(file), zlib.createGunzip(), fs.createWriteStream(config.dbFile));

// Recupera desde el espejo las fotos que falten.
const photoDir = path.join(config.backupsDir, 'photos');
let restored = 0;
if (fs.existsSync(photoDir)) {
  for (const f of fs.readdirSync(photoDir)) {
    const dest = path.join(config.uploadsDir, f);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(photoDir, f), dest);
      restored++;
    }
  }
}
console.log(`Base de datos restaurada desde ${path.basename(file)} · ${restored} fotos recuperadas. Ya puedes iniciar el servicio.`);
