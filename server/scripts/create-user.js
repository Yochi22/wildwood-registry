// Uso: npm run user:create -- correo@dominio.com "Nombre Apellido" [admin|editor|viewer]
import readline from 'node:readline';
import { db } from '../db.js';
import { hashPassword, passwordProblems } from '../lib/password.js';
import { ROLES } from '../lib/constants.js';

const [email, name, role = 'admin'] = process.argv.slice(2);
if (!email || !name || !ROLES.includes(role)) {
  console.error('Uso: npm run user:create -- correo@dominio.com "Nombre Apellido" [admin|editor|viewer]');
  process.exit(1);
}
if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
  console.error('Ya existe un usuario con ese correo.');
  process.exit(1);
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    rl.stdoutMuted = true;
    rl._writeToOutput = (s) => rl.output.write(rl.stdoutMuted && s !== q ? '' : s);
    rl.question(q, (a) => {
      rl.close();
      process.stdout.write('\n');
      resolve(a);
    });
  });
}

const password = process.env.NEW_USER_PASSWORD || (await ask('Contraseña: '));
const problems = passwordProblems(password);
if (problems.length) {
  console.error('Contraseña débil: mínimo 10 caracteres, mayúsculas, minúsculas y un número.');
  process.exit(1);
}
db.prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)').run(email, name, role, await hashPassword(password));
console.log(`Usuario ${email} creado con rol ${role}.`);
