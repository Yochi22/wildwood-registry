// Emergencia: quita la verificación en dos pasos de una cuenta (p. ej. si perdió el celular).
// Uso en el VPS:  sudo -u registry node --env-file=.env server/scripts/reset-2fa.js correo@dominio.com
import { db, audit } from '../db.js';

const email = process.argv[2];
const u = email && db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (!u) {
  console.error('Uso: node server/scripts/reset-2fa.js correo@dominio.com (el usuario debe existir)');
  process.exit(1);
}
db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = NULL, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(u.id);
audit(null, '2fa_disabled', 'user', u.id, { email, via: 'cli' });
console.log(`2FA quitada para ${email}. Al entrar deberá configurarla de nuevo.`);
