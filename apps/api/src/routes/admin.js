// Users & roles, pricing & content settings, AI providers, reports.
import { Router } from 'express';
import { z } from 'zod';
import { one, query, insert, update } from '../lib/db.js';
import { wrap, badRequest, notFound } from '../lib/errors.js';
import { requirePerm, hashPassword, audit } from '../lib/auth.js';
import { getSetting, setSetting, DEFAULT_SETTINGS } from '../services/settings.js';
import { listProviders, saveProviderKey, updateProvider, removeProvider, testProvider, usageSummary, PROVIDERS } from '../services/ai.js';

export const router = Router();

// ---- users ----
const safe = (u) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, active: u.active, mustChangePw: u.mustChangePw, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt });
const userSchema = z.object({ email: z.string().email().max(120), name: z.string().trim().min(2).max(80), phone: z.string().max(20).optional().or(z.literal('')), role: z.enum(['STAFF', 'MANAGER', 'ADMIN']), password: z.string().min(8).max(128).optional() });

router.get('/users', requirePerm('users.manage'), wrap(async (_req, res) => res.json((await query('SELECT * FROM users ORDER BY created_at')).map(safe))));

router.post('/users', requirePerm('users.manage'), wrap(async (req, res) => {
  const body = userSchema.parse(req.body);
  if (!body.password) throw badRequest('Set a first password');
  if (await one('SELECT 1 FROM users WHERE email = $1', [body.email.toLowerCase()])) throw badRequest('That email already has an account');
  const u = await insert('users', { email: body.email.toLowerCase(), name: body.name, phone: body.phone || null, role: body.role, passwordHash: await hashPassword(body.password), mustChangePw: true });
  await audit(req.user.id, 'user.create', 'user', u.id, { role: u.role });
  res.status(201).json(safe(u));
}));

router.patch('/users/:id', requirePerm('users.manage'), wrap(async (req, res) => {
  const body = userSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body);
  const u = await one('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!u) throw notFound();
  if (u.id === req.user.id && (body.active === false || (body.role && body.role !== 'ADMIN'))) throw badRequest('You cannot lock yourself out');
  if ((body.active === false || (body.role && body.role !== 'ADMIN')) && u.role === 'ADMIN') {
    const { n: admins } = await one(`SELECT count(*)::int AS n FROM users WHERE role = 'ADMIN' AND active`);
    if (admins <= 1) throw badRequest('Keep at least one active admin');
  }
  const data = { ...body };
  delete data.password;
  if (body.email) data.email = body.email.toLowerCase();
  if (body.phone === '') data.phone = null;
  if (body.password) { data.passwordHash = await hashPassword(body.password); data.mustChangePw = true; }
  const updated = await update('users', u.id, data);
  await audit(req.user.id, 'user.update', 'user', u.id, { fields: Object.keys(body) });
  res.json(safe(updated));
}));

// ---- settings ----
router.get('/settings', requirePerm('settings.view'), wrap(async (_req, res) => {
  const [pricing, content, ai] = await Promise.all([getSetting('pricing'), getSetting('content'), getSetting('ai')]);
  res.json({ pricing, content, ai, defaults: DEFAULT_SETTINGS });
}));

router.put('/settings/:key', requirePerm('settings.edit'), wrap(async (req, res) => {
  const key = req.params.key;
  if (!DEFAULT_SETTINGS[key]) throw notFound();
  const value = z.record(z.any()).parse(req.body);
  if (key === 'pricing') {
    for (const [m, r] of Object.entries(value.metalRates || {})) if (!(Number(r) >= 0)) throw badRequest(`Bad rate for ${m}`);
    if (value.gstPercent !== undefined && !(value.gstPercent >= 0 && value.gstPercent <= 28)) throw badRequest('GST must be 0–28%');
  }
  const saved = await setSetting(key, value);
  await audit(req.user.id, 'settings.update', 'setting', key);
  res.json(saved);
}));

// ---- AI providers (keys never leave the server) ----
router.get('/ai', requirePerm('ai.view'), wrap(async (_req, res) => {
  const [providers, usage, settings] = await Promise.all([listProviders(), usageSummary(), getSetting('ai')]);
  res.json({ providers, usage, settings });
}));

router.put('/ai/:provider/key', requirePerm('ai.manage'), wrap(async (req, res) => {
  const { apiKey, model } = z.object({ apiKey: z.string().min(1), model: z.string().optional() }).parse(req.body);
  await saveProviderKey({ provider: req.params.provider, apiKey, model, userId: req.user.id });
  await audit(req.user.id, 'ai.key.set', 'aiProvider', req.params.provider);
  res.json({ providers: await listProviders() });
}));

router.patch('/ai/:provider', requirePerm('ai.manage'), wrap(async (req, res) => {
  const patch = z.object({ model: z.string().optional(), enabled: z.boolean().optional(), isDefault: z.boolean().optional(), monthlyBudgetUsd: z.number().nonnegative().nullable().optional() }).parse(req.body);
  if (!PROVIDERS[req.params.provider]) throw notFound();
  await updateProvider(req.params.provider, patch, req.user.id);
  await audit(req.user.id, 'ai.provider.update', 'aiProvider', req.params.provider, patch);
  res.json({ providers: await listProviders() });
}));

router.delete('/ai/:provider', requirePerm('ai.manage'), wrap(async (req, res) => {
  await removeProvider(req.params.provider);
  await audit(req.user.id, 'ai.key.remove', 'aiProvider', req.params.provider);
  res.json({ providers: await listProviders() });
}));

router.post('/ai/:provider/test', requirePerm('ai.manage'), wrap(async (req, res) => {
  res.json({ result: await testProvider(req.params.provider), providers: await listProviders() });
}));

// ---- reports / audit ----
router.get('/audit', requirePerm('reports.view'), wrap(async (req, res) => {
  const take = Math.min(Number(req.query.limit || 100), 500);
  res.json(await query(`SELECT l.*, CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('name', u.name, 'email', u.email) END AS "user" FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.created_at DESC LIMIT ${take}`));
}));

router.get('/reports/summary', requirePerm('reports.view'), wrap(async (_req, res) => {
  const quotes = await query(`SELECT q.created_at, q.status, q.total, q.brand, json_build_object('pieceType', d.piece_type, 'metal', d.metal) AS design
    FROM quotes q JOIN designs d ON d.id = q.design_id WHERE q.created_at >= now() - interval '90 days'`);
  const payments = await query(`SELECT amount, paid_at, kind FROM payments WHERE status = 'PAID' AND paid_at >= now() - interval '90 days'`);
  res.json({ quotes, payments });
}));
