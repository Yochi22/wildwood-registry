import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

// Sin caracteres ambiguos (0/O, 1/I/L). 31^6 ≈ 887 millones de combinaciones por año:
// imposible de enumerar con el rate limit público.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRegNumber() {
  const year = new Date().getFullYear();
  const exists = db.prepare('SELECT 1 FROM dogs WHERE reg_number = ?');
  for (let i = 0; i < 20; i++) {
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
    const reg = `${config.regPrefix}-${year}-${code}`;
    if (!exists.get(reg)) return reg;
  }
  throw new Error('No se pudo generar un número de registro único');
}
