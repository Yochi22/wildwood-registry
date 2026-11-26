import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/** Logo opcional: coloca data/brand/logo.png (fondo transparente) y se usa en el panel, el perfil y el carnet. */
export function brandLogoPath() {
  const p = path.join(config.dataDir, 'brand', 'logo.png');
  return fs.existsSync(p) ? p : null;
}
