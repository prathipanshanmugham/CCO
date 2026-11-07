import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from './lib/config.js';
import { pool, one, insert, migrate } from './lib/db.js';
import { attachUser, hashPassword } from './lib/auth.js';
import { errorMiddleware, notFound } from './lib/errors.js';
import { ensureStorage, resolveSafe, EXT_MIME } from './services/storage.js';
import { ensureDefaults } from './services/settings.js';
import { verifyWebhookSignature, handleWebhook } from './services/payments.js';
import { router as publicRouter } from './routes/public.js';
import { router as authRouter } from './routes/auth.js';
import { router as staffRouter } from './routes/staff.js';
import { router as adminRouter } from './routes/admin.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.set('trust proxy', 1); // behind Caddy/Nginx
app.disable('x-powered-by');

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.isProd ? [config.publicUrl] : true, credentials: true }));
app.use(pinoHttp({ logger: log, autoLogging: { ignore: (req) => req.url.startsWith('/api/files') || req.url === '/api/health' } }));
app.use(cookieParser());

// Razorpay webhook needs the raw body for signature verification. Mounted before json().
app.post('/api/payments/razorpay/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const raw = req.body.toString('utf8');
  if (!verifyWebhookSignature(raw, req.headers['x-razorpay-signature'])) return res.status(400).json({ error: 'bad signature' });
  try { res.json(await handleWebhook(JSON.parse(raw))); }
  catch (e) { req.log.error({ err: e }, 'webhook'); res.status(500).json({ error: 'failed' }); }
});

app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, version: '2.0.0' }); }
  catch { res.status(503).json({ ok: false }); }
});

// Public files: design images and previews (unguessable cuid paths). Model files are NOT served here.
app.get('/api/files/*', (req, res) => {
  const rel = req.params[0];
  const ext = path.extname(rel).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.glb'].includes(ext)) return res.status(404).end();
  let abs; try { abs = resolveSafe(rel); } catch { return res.status(400).end(); }
  res.type(EXT_MIME[ext]);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(abs, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

app.use('/api', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/admin', adminRouter);

// Serve the built web app when present (single-container deploys). Caddy does this in Docker.
const webDist = path.resolve(process.env.WEB_DIST || '../web/dist');
if (fs.existsSync(path.join(webDist, 'index.html'))) {
  app.use(express.static(webDist, { maxAge: '1y', index: false, setHeaders: (res, p) => { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.use('/api', (_req, _res, next) => next(notFound('No such endpoint')));
app.use(errorMiddleware);

async function bootstrap() {
  await migrate(log);
  await ensureStorage();
  await ensureDefaults();
  const { n: users } = await one('SELECT count(*)::int AS n FROM users');
  if (users === 0) {
    if (!config.admin.password || config.admin.password.length < 8) throw new Error('No users exist yet: set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars) to create the first admin');
    await insert('users', { email: config.admin.email.toLowerCase(), name: config.admin.name, role: 'ADMIN', passwordHash: await hashPassword(config.admin.password), mustChangePw: true });
    log.info({ email: config.admin.email }, 'created first admin account');
  }
}

export { app, bootstrap };

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  bootstrap().then(() => {
    app.listen(config.port, () => log.info(`Clelia API listening on :${config.port} (${config.env})`));
  }).catch((e) => { log.error(e, 'startup failed'); process.exit(1); });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await pool.end(); process.exit(0); });
}
