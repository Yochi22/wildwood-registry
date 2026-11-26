import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { config } from '../config.js';

/**
 * Re-codifica la imagen subida: valida que realmente sea una imagen,
 * elimina metadatos EXIF (GPS, etc.), corrige la orientación y la reduce a WebP
 * (~40-80 KB por foto => 100.000 perros ≈ 6 GB).
 */
export async function saveDogPhoto(buffer) {
  const name = `${crypto.randomBytes(16).toString('hex')}.webp`;
  const out = await sharp(buffer, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(900, 900, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await fs.writeFile(path.join(config.uploadsDir, name), out);
  return name;
}

export async function deletePhoto(name) {
  if (!name || !/^[a-f0-9]{32}\.webp$/.test(name)) return;
  await fs.rm(path.join(config.uploadsDir, name), { force: true });
}
