import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { one, insert } from './db.js';
import { unauthorized, forbidden } from './errors.js';

export const hashPassword = (pw) => bcrypt.hash(pw, 11);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role, v: 1 }, config.appSecret, { expiresIn: `${config.sessionHours}h` });
}

export function setSessionCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.sessionHours * 3600 * 1000,
    path: '/',
  });
}
export const clearSessionCookie = (res) => res.clearCookie(config.cookieName, { path: '/' });

// Attaches req.user when a valid session cookie is present. Never throws.
export async function attachUser(req, _res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.appSecret);
    const user = await one('SELECT * FROM users WHERE id = $1', [payload.sub]);
    if (user && user.active) req.user = user;
  } catch { /* expired or tampered: treat as signed out */ }
  next();
}

export const requireUser = (req, _res, next) => (req.user ? next() : next(unauthorized()));

// Permission matrix. Keep in one place so the web app can mirror it.
export const PERMISSIONS = {
  'quotes.view': ['STAFF', 'MANAGER', 'ADMIN'],
  'quotes.work': ['STAFF', 'MANAGER', 'ADMIN'],      // claim, price, notes, production updates
  'quotes.approve': ['MANAGER', 'ADMIN'],            // approve / send back a prepared quote
  'quotes.override': ['ADMIN'],                      // cancel, edit after quoted
  'files.download': ['STAFF', 'MANAGER', 'ADMIN'],
  'payments.view': ['STAFF', 'MANAGER', 'ADMIN'],
  'payments.refund': ['ADMIN'],
  'users.manage': ['ADMIN'],
  'settings.view': ['MANAGER', 'ADMIN'],
  'settings.edit': ['ADMIN'],
  'ai.view': ['MANAGER', 'ADMIN'],
  'ai.manage': ['ADMIN'],
  'reports.view': ['MANAGER', 'ADMIN'],
};

export const can = (user, perm) => !!user && (PERMISSIONS[perm] || []).includes(user.role);

export const requirePerm = (perm) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!can(req.user, perm)) return next(forbidden());
  next();
};

export async function audit(userId, action, entity, entityId, meta) {
  try { await insert('audit_logs', { userId, action, entity, entityId, meta: meta ?? null }); } catch { /* best effort */ }
}
