// Customer-facing endpoints. No login; abuse limited by IP rate limits and tracking tokens.
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { one, query, insert, update } from '../lib/db.js';
import { findDesign, loadQuote } from '../services/repo.js';
import { wrap, badRequest, notFound, forbidden, HttpError } from '../lib/errors.js';
import { randomToken } from '../lib/crypto.js';
import { config } from '../lib/config.js';
import { getSetting, publicContent } from '../services/settings.js';
import { saveBuffer, designDir } from '../services/storage.js';
import { generateDesignImages, publicAiStatus } from '../services/ai.js';
import { nextRef, customerView, nextStatus, timelineEntry } from '../services/quotes.js';
import { createOrder, verifyCheckoutSignature, markPaid, amountsFor, paymentsEnabled } from '../services/payments.js';
import { lookupPincode } from '../services/pincode.js';

export const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 6 } });

const designLimiter = rateLimit({ windowMs: 60 * 60e3, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many designs from this connection. Please try again in an hour.' } });
const quoteLimiter = rateLimit({ windowMs: 60 * 60e3, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please try again later.' } });

const PIECES = ['ring', 'pendant', 'earrings', 'bracelet', 'bangle', 'chain', 'cuban-chain', 'grillz', 'nose-pin'];
const STONES = ['none', 'diamond', 'lab-diamond', 'moissanite', 'ruby', 'emerald', 'sapphire', 'cz'];

const designSchema = z.object({
  brand: z.enum(['CLELIA', 'SCORPLING']).default('CLELIA'),
  pieceType: z.enum(PIECES),
  prompt: z.string().trim().min(8, 'Tell us a little more about the piece').max(600),
  metal: z.string().min(3).max(32),
  purity: z.string().max(10).optional(),
  stone: z.enum(STONES).default('none'),
  styleTags: z.array(z.string().max(24)).max(8).default([]),
  params: z.record(z.any()).default({}),
  summary: z.string().max(300).optional(),
  dimensions: z.record(z.any()).optional(),
  volumeMm3: z.number().nonnegative().optional(),
  weightG: z.number().nonnegative().optional(),
});

// ---- content & status ----
router.get('/content', wrap(async (_req, res) => {
  const [content, pricing, ai] = await Promise.all([getSetting('content'), getSetting('pricing'), publicAiStatus()]);
  res.json({ content: publicContent(content, pricing), ai, payments: paymentsEnabled(), razorpayKeyId: config.razorpay.keyId || null, pieces: PIECES, stones: STONES });
}));

router.get('/pincode/:pin', wrap(async (req, res) => res.json(await lookupPincode(req.params.pin))));

// ---- designs ----
router.post('/designs', designLimiter, wrap(async (req, res) => {
  const body = designSchema.parse(req.body);
  const pricing = await getSetting('pricing');
  if (!pricing.metalRates[body.metal]) throw badRequest('Unknown metal');
  const design = await insert('designs', { ...body, clientIp: req.ip });
  res.status(201).json(design);
}));

router.patch('/designs/:id', wrap(async (req, res) => {
  const patch = designSchema.partial().parse(req.body);
  const d = await findDesign(req.params.id);
  if (!d) throw notFound();
  if (await one('SELECT 1 FROM quotes WHERE design_id = $1 LIMIT 1', [d.id])) throw forbidden('This design is already part of a quote');
  res.json(await update('designs', d.id, patch));
}));

router.get('/designs/:id', wrap(async (req, res) => {
  const d = await findDesign(req.params.id);
  if (!d) throw notFound();
  res.json(d);
}));

// Reference photos from the customer
router.post('/designs/:id/references', upload.array('files', 4), wrap(async (req, res) => {
  const d = await findDesign(req.params.id);
  if (!d) throw notFound();
  const saved = [];
  for (const f of req.files || []) {
    if (!/^image\/(png|jpe?g|webp)$/.test(f.mimetype)) throw badRequest('Only PNG, JPG or WebP photos please');
    const ext = f.mimetype === 'image/png' ? '.png' : f.mimetype === 'image/webp' ? '.webp' : '.jpg';
    const rel = `${designDir(d.id)}/ref-${Date.now()}-${saved.length}${ext}`;
    await saveBuffer(rel, f.buffer);
    saved.push({ url: `/api/files/${rel}`, name: f.originalname.slice(0, 80) });
  }
  const refImages = [...(d.refImages || []), ...saved].slice(0, 6);
  res.json(await update('designs', d.id, { refImages }));
}));

// 3D files exported in the browser (STL/3MF/OBJ/GLB) + preview PNG
router.post('/designs/:id/model', upload.fields([{ name: 'files', maxCount: 5 }, { name: 'preview', maxCount: 1 }]), wrap(async (req, res) => {
  const d = await findDesign(req.params.id);
  if (!d) throw notFound();
  const modelFiles = [];
  for (const f of req.files?.files || []) {
    const ext = ('.' + (f.originalname.split('.').pop() || '')).toLowerCase();
    if (!['.stl', '.3mf', '.obj', '.glb'].includes(ext)) throw badRequest(`Unsupported model file ${ext}`);
    const rel = `${designDir(d.id)}/model${ext}`;
    await saveBuffer(rel, f.buffer);
    modelFiles.push({ ext, url: `/api/files/${rel}`, bytes: f.size });
  }
  let previewPath = d.previewPath;
  const pv = req.files?.preview?.[0];
  if (pv && pv.mimetype === 'image/png') {
    const rel = `${designDir(d.id)}/preview.png`;
    await saveBuffer(rel, pv.buffer);
    previewPath = `/api/files/${rel}`;
  }
  const meta = {};
  if (req.body.weightG) meta.weightG = Number(req.body.weightG);
  if (req.body.volumeMm3) meta.volumeMm3 = Number(req.body.volumeMm3);
  if (req.body.dimensions) { try { meta.dimensions = JSON.parse(req.body.dimensions); } catch { /* ignore */ } }
  if (req.body.summary) meta.summary = String(req.body.summary).slice(0, 300);
  res.json(await update('designs', d.id, { modelFiles: modelFiles.length ? modelFiles : d.modelFiles, previewPath, ...meta }));
}));

// AI images: generated on the server with the studio's key; the customer only gets URLs back.
const aiPerIp = new Map(); // ip -> { day, count }
router.post('/designs/:id/images', wrap(async (req, res) => {
  const d = await findDesign(req.params.id);
  if (!d) throw notFound();
  const day = new Date().toISOString().slice(0, 10);
  const rec = aiPerIp.get(req.ip) || { day, count: 0 };
  if (rec.day !== day) { rec.day = day; rec.count = 0; }
  if (rec.count >= config.aiImagesPerIpPerDay) throw new HttpError(429, 'You have used today\'s AI image allowance. Your 3D design still works.');
  const out = await generateDesignImages(d, { count: req.body?.count });
  rec.count += out.urls.length; aiPerIp.set(req.ip, rec);
  const aiImages = [...(d.aiImages || []), ...out.urls.map((url) => ({ url, prompt: d.prompt, model: out.model, at: new Date().toISOString() }))].slice(-12);
  await update('designs', d.id, { aiImages });
  res.json({ images: out.urls, model: out.model, warning: out.warning });
}));

// ---- quotes ----
const quoteSchema = z.object({
  designId: z.string().min(5),
  customerName: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number'),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  address1: z.string().trim().min(4).max(160),
  address2: z.string().trim().max(160).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a 6-digit PIN code'),
  customerNotes: z.string().trim().max(600).optional().or(z.literal('')),
});

router.post('/quotes', quoteLimiter, wrap(async (req, res) => {
  const body = quoteSchema.parse(req.body);
  const design = await findDesign(body.designId);
  if (!design) throw badRequest('Design not found. Please create the design again.');
  const pricing = await getSetting('pricing');
  let quote;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      quote = await insert('quotes', {
        ...body, email: body.email || null, address2: body.address2 || null, customerNotes: body.customerNotes || null,
        brand: design.brand, ref: await nextRef(design.brand), trackToken: randomToken(18), advancePercent: pricing.advancePercent,
        timeline: [{ status: 'NEW', at: new Date().toISOString(), by: 'customer' }],
      });
      break;
    } catch (e) { if (e.code !== '23505' || attempt === 2) throw e; }
  }
  res.status(201).json({ ref: quote.ref, token: quote.trackToken, trackUrl: `${config.publicUrl}/track/${quote.ref}?t=${quote.trackToken}` });
}));

async function loadTracked(req) {
  const q = await loadQuote('q.ref = $1', [String(req.params.ref).toUpperCase()]);
  if (!q) throw notFound('We could not find that reference');
  const token = req.query.t || req.body?.token;
  // Token OR matching phone keeps it usable for customers who lost the link.
  const phone = String(req.query.phone || req.body?.phone || '').replace(/\D/g, '').slice(-10);
  if (q.trackToken !== token && !(phone && q.phone.replace(/\D/g, '').endsWith(phone))) throw forbidden('That link or phone number does not match this request');
  return q;
}

router.get('/track/:ref', wrap(async (req, res) => {
  const q = await loadTracked(req);
  const pay = paymentsEnabled() ? amountsFor(q) : null;
  res.json({ ...customerView(q), pay, razorpayKeyId: config.razorpay.keyId || null });
}));

router.post('/track/:ref/accept', wrap(async (req, res) => {
  const q = await loadTracked(req);
  const to = nextStatus(q.status, 'accept');
  await update('quotes', q.id, { status: to, acceptedAt: new Date(), timeline: timelineEntry(q, to, 'customer') });
  res.json(customerView(await loadQuote('q.id = $1', [q.id])));
}));

router.post('/track/:ref/decline', wrap(async (req, res) => {
  const q = await loadTracked(req);
  const to = nextStatus(q.status, 'decline');
  const reason = String(req.body?.reason || '').slice(0, 300);
  await update('quotes', q.id, { status: to, declineReason: reason || 'Declined by customer', timeline: timelineEntry(q, to, 'customer', reason) });
  res.json(customerView(await loadQuote('q.id = $1', [q.id])));
}));

router.post('/track/:ref/pay', wrap(async (req, res) => {
  const q = await loadTracked(req);
  const payment = await createOrder(q, { kind: req.body?.kind });
  res.json({ orderId: payment.razorpayOrderId, amount: payment.amount, currency: payment.currency, kind: payment.kind, keyId: config.razorpay.keyId,
    prefill: { name: q.customerName, contact: q.phone, email: q.email || undefined }, description: `${q.brand === 'SCORPLING' ? 'Scorpling' : 'Clelia & Co.'} · ${q.ref} · ${payment.kind.toLowerCase()}` });
}));

router.post('/track/:ref/pay/verify', wrap(async (req, res) => {
  const q = await loadTracked(req);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (!orderId || !paymentId || !signature) throw badRequest('Missing payment details');
  const p = await one('SELECT * FROM payments WHERE razorpay_order_id = $1', [orderId]);
  if (!p || p.quoteId !== q.id) throw badRequest('Order does not belong to this quote');
  verifyCheckoutSignature({ orderId, paymentId, signature });
  await markPaid({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, raw: { verifiedAt: new Date().toISOString() } });
  const fresh = await loadQuote('q.id = $1', [q.id]);
  res.json({ ...customerView(fresh), pay: amountsFor(fresh) });
}));
