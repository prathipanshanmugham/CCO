// Razorpay signature + webhook idempotency, without calling Razorpay.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.RAZORPAY_KEY_ID = 'rzp_test_x'; process.env.RAZORPAY_KEY_SECRET = 'secret123'; process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';
const { app, bootstrap } = await import('../src/server.js');
const { pool, query, insert } = await import('../src/lib/db.js');
const { verifyCheckoutSignature, amountsFor } = await import('../src/services/payments.js');

let server, base;
before(async () => { await bootstrap(); server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { server.close(); await pool.end(); });

test('checkout signature verification', () => {
  const sig = crypto.createHmac('sha256', 'secret123').update('order_1|pay_1').digest('hex');
  verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: sig });
  assert.throws(() => verifyCheckoutSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'bad' }));
});

test('webhook: bad signature rejected; payment.captured marks paid once', async () => {
  const d = await insert('designs', { pieceType: 'ring', prompt: 'test', metal: 'gold-18k', weightG: 3 });
  const q = await insert('quotes', { ref: `TST-${Date.now()}`, trackToken: 'tok' + Date.now(), designId: d.id, status: 'QUOTED', customerName: 'T', phone: '9876543210', address1: 'x', city: 'c', state: 's', pincode: '641001', total: 100000, advancePercent: 50 });
  const p = await insert('payments', { quoteId: q.id, kind: 'ADVANCE', amount: 50000, razorpayOrderId: `order_${Date.now()}` });
  const body = JSON.stringify({ event: 'payment.captured', created_at: 1, payload: { payment: { entity: { id: `pay_${Date.now()}`, order_id: p.razorpayOrderId, method: 'upi' } } } });
  const bad = await fetch(base + '/api/payments/razorpay/webhook', { method: 'POST', headers: { 'x-razorpay-signature': 'nope' }, body });
  assert.equal(bad.status, 400);
  const sig = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
  const ok = await fetch(base + '/api/payments/razorpay/webhook', { method: 'POST', headers: { 'x-razorpay-signature': sig }, body });
  assert.equal(ok.status, 200);
  const again = await fetch(base + '/api/payments/razorpay/webhook', { method: 'POST', headers: { 'x-razorpay-signature': sig }, body });
  assert.deepEqual(await again.json(), { duplicate: true });
  const [pay] = await query('SELECT * FROM payments WHERE id = $1', [p.id]);
  const [quote] = await query('SELECT * FROM quotes WHERE id = $1', [q.id]);
  assert.equal(pay.status, 'PAID'); assert.equal(quote.status, 'ACCEPTED');
  const a = amountsFor({ ...quote, payments: [pay] });
  assert.equal(a.due, 50000); assert.equal(a.nextKind, 'BALANCE');
});
