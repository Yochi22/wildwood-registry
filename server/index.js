import { config } from './config.js';
import { createApp } from './app.js';
import { db } from './db.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[registry] escuchando en http://localhost:${config.port}`);
  const users = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  if (!users) console.log('[registry] No hay usuarios. Crea el primer administrador con: npm run user:create');
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
