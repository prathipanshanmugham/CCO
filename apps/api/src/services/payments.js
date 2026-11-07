// Razorpay: order creation, checkout verification and webhook handling.
import Razorpay from 'razorpay';
import { one, query, insert, update, tx } from '../lib/db.js';
import { config } from '../lib/config.js';
import { hmacSha256, safeEqual } from '../lib/crypto.js';
import { badRequest, conflict, HttpError } from '../lib/errors.js';
import { timelineEntry } from './quotes.js';

let client;
export function razorpay() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) throw new HttpError(503, 'Online payment is not set up yet. Please contact the studio.');
  if (!client) client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  return client;
}

export const paymentsEnabled = () => !!(config.razorpay.keyId && config.razorpay.keySecret);

// Amount still owed on a quote, in paise, split into what the next payment should be.
export function amountsFor(quote) {
  const total = quote.total || 0;
  const paid = (quote.payments || []).filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0);
  const advance = Math.round(total * (quote.advancePercent / 100));
  const due = Math.max(total - paid, 0);
  let nextKind = null; let nextAmount = 0;
  if (due > 0) {
    if (paid === 0) { nextKind = quote.advancePercent >= 100 ? 'FULL' : 'ADVANCE'; nextAmount = quote.advancePercent >= 100 ? total : advance; }
    else { nextKind = 'BALANCE'; nextAmount = due; }
  }
  return { total, paid, due, advance, nextKind, nextAmount };
}

export async function createOrder(quote, { kind } = {}) {
  if (!['QUOTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY', 'SHIPPED'].includes(quote.status)) throw conflict('This quote is not ready for payment');
  const a = amountsFor(quote);
  if (!a.nextKind) throw conflict('Nothing left to pay on this quote');
  let amount = a.nextAmount; let payKind = a.nextKind;
  if (kind === 'FULL' && a.paid === 0) { amount = a.total; payKind = 'FULL'; }
  // Reuse an open order for the same amount so refreshing the page does not pile up orders.
  const open = await one(`SELECT * FROM payments WHERE quote_id = $1 AND status = 'CREATED' AND amount = $2 AND kind = $3 AND created_at > now() - interval '20 minutes' ORDER BY created_at DESC LIMIT 1`, [quote.id, amount, payKind]);
  if (open) return open;
  const order = await razorpay().orders.create({
    amount, currency: 'INR', receipt: `${quote.ref}-${payKind}`.slice(0, 40),
    notes: { quoteRef: quote.ref, kind: payKind, brand: quote.brand },
  });
  return insert('payments', { quoteId: quote.id, kind: payKind, amount, razorpayOrderId: order.id, raw: { order } });
}

export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const expected = hmacSha256(config.razorpay.keySecret, `${orderId}|${paymentId}`);
  if (!safeEqual(expected, signature)) throw badRequest('Payment signature did not match. If money was deducted it will be reconciled automatically.');
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!config.razorpay.webhookSecret) return false;
  return safeEqual(hmacSha256(config.razorpay.webhookSecret, rawBody), signature || '');
}

// Idempotent: marks a payment paid and moves the quote forward once.
export async function markPaid({ razorpayOrderId, razorpayPaymentId, method, raw, by = 'customer' }) {
  return tx(async (c) => {
    const payment = await one('SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE', [razorpayOrderId], c);
    if (!payment) throw badRequest('Unknown order');
    const q = await one('SELECT * FROM quotes WHERE id = $1 FOR UPDATE', [payment.quoteId], c);
    if (payment.status === 'PAID') return { payment, quote: q, already: true };
    const updated = await update('payments', payment.id, { status: 'PAID', razorpayPaymentId: razorpayPaymentId ?? null, method: method ?? null, raw: { ...(payment.raw || {}), paid: raw }, paidAt: new Date() }, c);
    const data = {};
    if (q.status === 'QUOTED' || q.status === 'ACCEPTED') {
      data.status = 'ACCEPTED';
      data.acceptedAt = q.acceptedAt || new Date();
      data.timeline = timelineEntry(q, 'ACCEPTED', by, `${payment.kind.toLowerCase()} payment of ₹${(payment.amount / 100).toLocaleString('en-IN')} received`);
    } else {
      data.timeline = timelineEntry(q, q.status, by, `${payment.kind.toLowerCase()} payment of ₹${(payment.amount / 100).toLocaleString('en-IN')} received`);
    }
    const quote = await update('quotes', q.id, data, c);
    return { payment: updated, quote };
  });
}

export async function handleWebhook(event) {
  const id = event.payload?.payment?.entity?.id ? `${event.event}:${event.payload.payment.entity.id}` : `${event.event}:${event.created_at}`;
  const existing = await one('SELECT processed_at FROM webhook_events WHERE id = $1', [id]);
  if (existing?.processedAt) return { duplicate: true };
  await query('INSERT INTO webhook_events (id, event, payload) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', [id, event.event, JSON.stringify(event)]);
  const p = event.payload?.payment?.entity;
  if (event.event === 'payment.captured' && p?.order_id) {
    await markPaid({ razorpayOrderId: p.order_id, razorpayPaymentId: p.id, method: p.method, raw: p, by: 'razorpay' });
  } else if (event.event === 'payment.failed' && p?.order_id) {
    await query(`UPDATE payments SET status = 'FAILED', raw = coalesce(raw,'{}'::jsonb) || $2 WHERE razorpay_order_id = $1 AND status = 'CREATED'`, [p.order_id, JSON.stringify({ failed: p })]);
  } else if (event.event === 'refund.processed' && p?.id) {
    await query(`UPDATE payments SET status = 'REFUNDED' WHERE razorpay_payment_id = $1`, [p.id]);
  }
  await query('UPDATE webhook_events SET processed_at = now() WHERE id = $1', [id]);
  return { ok: true };
}
