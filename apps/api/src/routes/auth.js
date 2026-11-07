import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { one, update } from '../lib/db.js';
import { wrap, unauthorized, badRequest } from '../lib/errors.js';
import { verifyPassword, hashPassword, signSession, setSessionCookie, clearSessionCookie, requireUser, PERMISSIONS, audit } from '../lib/auth.js';

export const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Wait 15 minutes.' } });

const safeUser = (u) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, mustChangePw: u.mustChangePw, lastLoginAt: u.lastLoginAt });

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await one('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) throw unauthorized('Email or password is incorrect');
  await update('users', user.id, { lastLoginAt: new Date() });
  setSessionCookie(res, signSession(user));
  await audit(user.id, 'login', 'user', user.id);
  res.json({ user: safeUser(user), permissions: PERMISSIONS });
}));

router.post('/logout', (req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

router.get('/me', requireUser, (req, res) => res.json({ user: safeUser(req.user), permissions: PERMISSIONS }));

router.post('/change-password', requireUser, wrap(async (req, res) => {
  const { current, next } = z.object({ current: z.string(), next: z.string().min(8, 'Use at least 8 characters').max(128) }).parse(req.body);
  if (!(await verifyPassword(current, req.user.passwordHash))) throw badRequest('Current password is incorrect');
  await update('users', req.user.id, { passwordHash: await hashPassword(next), mustChangePw: false });
  await audit(req.user.id, 'password.change', 'user', req.user.id);
  res.json({ ok: true });
}));
