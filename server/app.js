import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config, ROOT, isProd } from './config.js';
import { sessionMiddleware, csrfGuard, enforce2fa } from './auth.js';
import authRoutes from './routes/auth.js';
import dogRoutes from './routes/dogs.js';
import userRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import publicRoutes from './routes/public.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy === 'false' ? false : /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'font-src': ["'self'"],
          'script-src': ["'self'"],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'same-origin' },
    })
  );
  // Los perfiles no deben aparecer en buscadores.
  app.use((_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use(
    '/media',
    express.static(config.uploadsDir, {
      immutable: true,
      maxAge: '365d',
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
    })
  );

  app.use('/api', csrfGuard);
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/dogs', enforce2fa, dogRoutes);
  app.use('/api/users', enforce2fa, userRoutes);
  app.use('/api/audit', enforce2fa, auditRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

  const dist = path.join(ROOT, 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '7d', setHeaders: (res, p) => p.endsWith('.html') && res.set('Cache-Control', 'no-cache') }));
    app.get(/.*/, (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'validation', fields: { photo: 'too_large' } });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_request' });
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  });

  return app;
}
