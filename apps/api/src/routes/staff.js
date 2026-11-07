// Staff console: quotes workflow, files, dashboard.
import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import { one, query, insert, update } from '../lib/db.js';
import { loadQuote } from '../services/repo.js';
import { wrap, notFound, badRequest, forbidden, conflict } from '../lib/errors.js';
import { requirePerm, can, audit } from '../lib/auth.js';
import { nextStatus, timelineEntry, STATUS_LABELS, TRANSITIONS } from '../services/quotes.js';
import { computeBreakdown, toPaise } from '../services/pricing.js';
import { getSetting } from '../services/settings.js';
import { amountsFor } from '../services/payments.js';
import { resolveSafe, EXT_MIME } from '../services/storage.js';

export const router = Router();
router.use(requirePerm('quotes.view'));


router.get('/dashboard', wrap(async (req, res) => {
  const [byStatus, recent, paid, mineRow] = await Promise.all([
    query('SELECT status, count(*)::int AS n FROM quotes GROUP BY status'),
    query(`SELECT q.id, q.ref, q.status, q.brand, q.customer_name, q.city, q.total, q.updated_at, q.created_at,
             json_build_object('pieceType', d.piece_type, 'metal', d.metal, 'previewPath', d.preview_path) AS design
           FROM quotes q JOIN designs d ON d.id = q.design_id ORDER BY q.updated_at DESC LIMIT 8`),
    one(`SELECT coalesce(sum(amount),0)::int AS paise, count(*)::int AS payments FROM payments WHERE status = 'PAID' AND paid_at >= now() - interval '30 days'`),
    one(`SELECT count(*)::int AS n FROM quotes WHERE assigned_to_id = $1 AND status IN ('IN_REVIEW','CHANGES_REQUESTED')`, [req.user.id]),
  ]);
  const counts = Object.fromEntries(byStatus.map((b) => [b.status, b.n]));
  const mine = mineRow.n;
  res.json({
    counts, labels: STATUS_LABELS,
    needsAction: { newRequests: counts.NEW || 0, awaitingApproval: counts.PENDING_APPROVAL || 0, mine, inProduction: counts.IN_PRODUCTION || 0 },
    revenue30: paid,
    recent,
  });
}));

router.get('/quotes', wrap(async (req, res) => {
  const { status, q, brand, mine, page = '1', pageSize = '25' } = req.query;
  const conds = []; const params = [];
  const add = (sql, v) => { params.push(v); conds.push(sql.replace('?', `$${params.length}`)); };
  if (status) add('q.status = ANY(?)', String(status).split(','));
  if (brand) add('q.brand = ?', brand);
  if (mine === '1') add('q.assigned_to_id = ?', req.user.id);
  if (q) add('(q.ref ILIKE ? OR q.customer_name ILIKE ? OR q.phone LIKE ? OR q.city ILIKE ?)'.replace(/\?/g, `$${params.length + 1}`), `%${q}%`);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const take = Math.min(Number(pageSize), 100); const skip = (Math.max(Number(page), 1) - 1) * take;
  const [items, tot] = await Promise.all([
    query(`SELECT q.id, q.ref, q.status, q.brand, q.customer_name, q.phone, q.city, q.state, q.total, q.created_at, q.updated_at, q.quoted_at,
             json_build_object('pieceType', d.piece_type, 'metal', d.metal, 'stone', d.stone, 'previewPath', d.preview_path, 'weightG', d.weight_g) AS design,
             CASE WHEN a.id IS NULL THEN NULL ELSE json_build_object('id', a.id, 'name', a.name) END AS assigned_to
           FROM quotes q JOIN designs d ON d.id = q.design_id LEFT JOIN users a ON a.id = q.assigned_to_id
           ${where} ORDER BY q.created_at DESC LIMIT ${take} OFFSET ${skip}`, params),
    one(`SELECT count(*)::int AS n FROM quotes q ${where}`, params),
  ]);
  res.json({ items, total: tot.n, page: Number(page), pageSize: take, labels: STATUS_LABELS });
}));

async function load(id) {
  const q = await loadQuote('q.id = $1 OR q.ref = $2', [id, id.toUpperCase()]);
  if (!q) throw notFound('Quote not found');
  return q;
}

const actionsFor = (user, q) => Object.keys(TRANSITIONS[q.status] || {}).filter((a) => {
  if (['approve', 'sendBack'].includes(a)) return can(user, 'quotes.approve');
  if (['cancel', 'reopen', 'revise'].includes(a)) return can(user, 'quotes.override') || (a === 'revise' && can(user, 'quotes.approve'));
  if (a === 'accept' || a === 'expire') return false; // customer / system only
  return can(user, 'quotes.work');
});

router.get('/quotes/:id', wrap(async (req, res) => {
  const q = await load(req.params.id);
  const pricing = await getSetting('pricing');
  res.json({ quote: q, actions: actionsFor(req.user, q), pay: amountsFor(q), pricingDefaults: pricing, labels: STATUS_LABELS });
}));

// Price preview without saving (staff tweaks lines live)
const priceSchema = z.object({
  overrides: z.object({ weightG: z.number().positive().optional(), metalRate: z.number().nonnegative().optional(), wastagePercent: z.number().min(0).max(40).optional(), makingPerGram: z.number().nonnegative().optional(), designFee: z.number().nonnegative().optional(), printAndCasting: z.number().nonnegative().optional(), discount: z.number().nonnegative().optional(), gstPercent: z.number().min(0).max(28).optional() }).default({}),
  stones: z.array(z.object({ type: z.string(), size: z.enum(['small', 'medium', 'large']).default('small'), count: z.number().int().min(0).max(500), unitPrice: z.number().nonnegative().optional() })).default([]),
  advancePercent: z.number().int().min(10).max(100).optional(),
  note: z.string().max(600).optional(),
});

router.post('/quotes/:id/price', requirePerm('quotes.work'), wrap(async (req, res) => {
  const q = await load(req.params.id);
  const body = priceSchema.parse(req.body);
  const pricing = await getSetting('pricing');
  const breakdown = computeBreakdown({ weightG: q.design.weightG, metal: q.design.metal, stones: body.stones, pricing, overrides: body.overrides, brand: q.brand });
  if (req.query.preview === '1') return res.json({ breakdown });
  if (!['IN_REVIEW', 'CHANGES_REQUESTED', 'NEW'].includes(q.status)) throw conflict('Pricing can only be edited while the quote is under review');
  await update('quotes', q.id, {
    priceBreakdown: breakdown, total: toPaise(breakdown.total), advancePercent: body.advancePercent ?? q.advancePercent, preparedById: req.user.id,
    assignedToId: q.assignedToId || req.user.id, status: q.status === 'NEW' ? 'IN_REVIEW' : q.status,
    timeline: q.status === 'NEW' ? timelineEntry(q, 'IN_REVIEW', req.user.name) : q.timeline,
  });
  const updated = await load(q.id);
  await audit(req.user.id, 'quote.price', 'quote', q.id, { total: breakdown.total });
  res.json({ quote: updated, actions: actionsFor(req.user, updated), pay: amountsFor(updated) });
}));

router.post('/quotes/:id/action', wrap(async (req, res) => {
  const q = await load(req.params.id);
  const { action, note } = z.object({ action: z.string(), note: z.string().max(600).optional() }).parse(req.body);
  if (!actionsFor(req.user, q).includes(action)) throw forbidden(`You cannot "${action}" this quote`);
  const to = nextStatus(q.status, action);
  const data = { status: to, timeline: timelineEntry(q, to, req.user.name, note) };
  if (action === 'claim') data.assignedToId = req.user.id;
  if (action === 'submit') {
    if (!q.total) throw badRequest('Add the price before sending for approval');
    data.preparedById = req.user.id;
  }
  if (action === 'approve') {
    if (q.preparedById === req.user.id && req.user.role !== 'ADMIN') throw forbidden('A quote must be approved by someone other than the person who prepared it');
    const pricing = await getSetting('pricing');
    data.approvedById = req.user.id; data.approvalNote = note || null; data.quotedAt = new Date();
    data.validUntil = new Date(Date.now() + pricing.quoteValidDays * 86400e3);
  }
  if (action === 'sendBack' && !note) throw badRequest('Tell the staff member what to change');
  if (action === 'decline' || action === 'cancel') data.declineReason = note || null;
  if (action === 'complete') data.completedAt = new Date();
  await update('quotes', q.id, data);
  const updated = await load(q.id);
  await audit(req.user.id, `quote.${action}`, 'quote', q.id, { from: q.status, to, note });
  res.json({ quote: updated, actions: actionsFor(req.user, updated), pay: amountsFor(updated) });
}));

router.post('/quotes/:id/notes', requirePerm('quotes.work'), wrap(async (req, res) => {
  const q = await load(req.params.id);
  const { text } = z.object({ text: z.string().trim().min(1).max(1000) }).parse(req.body);
  const staffNotes = [...(q.staffNotes || []), { by: req.user.name, byId: req.user.id, at: new Date().toISOString(), text }];
  await update('quotes', q.id, { staffNotes });
  const updated = await load(q.id);
  res.json({ quote: updated, actions: actionsFor(req.user, updated), pay: amountsFor(updated) });
}));

router.post('/quotes/:id/assign', requirePerm('quotes.approve'), wrap(async (req, res) => {
  const q = await load(req.params.id);
  const { userId } = z.object({ userId: z.string().nullable() }).parse(req.body);
  await update('quotes', q.id, { assignedToId: userId });
  const updated = await load(q.id);
  res.json({ quote: updated, actions: actionsFor(req.user, updated), pay: amountsFor(updated) });
}));

router.post('/quotes/:id/manual-payment', requirePerm('quotes.approve'), wrap(async (req, res) => {
  // Cash / UPI received outside Razorpay. Recorded with a synthetic order id.
  const q = await load(req.params.id);
  const { amount, method, note } = z.object({ amount: z.number().positive(), method: z.string().max(40).default('cash'), note: z.string().max(300).optional() }).parse(req.body);
  const a = amountsFor(q);
  const paise = toPaise(amount);
  if (paise > a.due) throw badRequest(`Only ₹${(a.due / 100).toLocaleString('en-IN')} is due`);
  const kind = a.paid === 0 ? (paise >= a.total ? 'FULL' : 'ADVANCE') : 'BALANCE';
  await insert('payments', { quoteId: q.id, kind, amount: paise, status: 'PAID', razorpayOrderId: `manual_${q.ref}_${Date.now()}`, method, paidAt: new Date(), raw: { note, by: req.user.name } });
  const data = { timeline: timelineEntry(q, q.status === 'QUOTED' ? 'ACCEPTED' : q.status, req.user.name, `${method} payment ₹${amount.toLocaleString('en-IN')} recorded`) };
  if (q.status === 'QUOTED') { data.status = 'ACCEPTED'; data.acceptedAt = new Date(); }
  await update('quotes', q.id, data);
  const updated = await load(q.id);
  await audit(req.user.id, 'payment.manual', 'quote', q.id, { amount, method });
  res.json({ quote: updated, actions: actionsFor(req.user, updated), pay: amountsFor(updated) });
}));

// Staff-only download of model files (3D print pack)
router.get('/files/*', requirePerm('files.download'), wrap(async (req, res) => {
  const rel = req.params[0];
  const ext = path.extname(rel).toLowerCase();
  if (!EXT_MIME[ext]) throw notFound();
  res.type(EXT_MIME[ext]);
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(rel)}"`);
  res.sendFile(resolveSafe(rel), (err) => { if (err && !res.headersSent) res.status(404).json({ error: 'File not found' }); });
}));

router.get('/users-lite', wrap(async (_req, res) => {
  res.json(await query('SELECT id, name, role FROM users WHERE active ORDER BY name'));
}));
