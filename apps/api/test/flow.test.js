// End-to-end API test: customer design → quote → staff pricing → manager approval → acceptance → payment → production.
// Needs DATABASE_URL pointing at a scratch database (tables are truncated).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, bootstrap } from '../src/server.js';
import { pool, query } from '../src/lib/db.js';
import { hashPassword } from '../src/lib/auth.js';

let server, base;
const jar = {};
async function api(method, path, body, as) {
  const headers = { 'content-type': 'application/json' };
  if (as && jar[as]) headers.cookie = jar[as];
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.get('set-cookie');
  if (as && setCookie) jar[as] = setCookie.split(';')[0];
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

before(async () => {
  await bootstrap();
  await query('TRUNCATE quotes, payments, designs, ai_usage, ai_providers, audit_logs, webhook_events CASCADE');
  await query("DELETE FROM users WHERE email LIKE '%@t.test'");
  const pw = await hashPassword('clelia123');
  for (const [email, name, role] of [['staff@t.test', 'Kavya', 'STAFF'], ['manager@t.test', 'Arjun', 'MANAGER']]) {
    await query('INSERT INTO users (email,name,role,password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING', [email, name, role, pw]);
  }
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`;
  for (const [as, email] of [['admin', process.env.ADMIN_EMAIL], ['staff', 'staff@t.test'], ['manager', 'manager@t.test']]) {
    const r = await api('POST', '/api/auth/login', { email, password: process.env.ADMIN_PASSWORD || 'clelia123' }, as);
    assert.equal(r.status, 200, `login ${as}`);
  }
});
after(async () => { server.close(); await pool.end(); });

let design, quote, token;

test('customer creates a design and a quote request', async () => {
  const r = await api('POST', '/api/designs', { pieceType: 'ring', prompt: 'Thin twisted band with a small oval emerald', metal: 'gold-18k', stone: 'emerald', weightG: 3.4, volumeMm3: 220, params: { size: 12 } });
  assert.equal(r.status, 201); design = r.json;
  const bad = await api('POST', '/api/quotes', { designId: design.id, customerName: 'A', phone: '123', address1: 'x', city: 'C', state: 'TN', pincode: '12' });
  assert.equal(bad.status, 400);
  const q = await api('POST', '/api/quotes', { designId: design.id, customerName: 'Priya S', phone: '9876543210', email: 'priya@example.com', address1: '12 Race Course', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641018' });
  assert.equal(q.status, 201); assert.match(q.json.ref, /^CLC-\d{4}-\d{4}$/);
  quote = q.json; token = q.json.token;
  const t = await api('GET', `/api/track/${quote.ref}?t=${token}`);
  assert.equal(t.status, 200); assert.equal(t.json.status, 'NEW'); assert.equal(t.json.priceBreakdown, null);
  const forbidden = await api('GET', `/api/track/${quote.ref}?t=wrong`);
  assert.equal(forbidden.status, 403);
});

test('staff cannot approve; manager cannot approve own pricing; flow reaches QUOTED', async () => {
  const claim = await api('POST', `/api/staff/quotes/${quote.ref}/action`, { action: 'claim' }, 'staff');
  assert.equal(claim.status, 200); assert.equal(claim.json.quote.status, 'IN_REVIEW');
  const preview = await api('POST', `/api/staff/quotes/${quote.ref}/price?preview=1`, { stones: [{ type: 'emerald', size: 'medium', count: 1 }] }, 'staff');
  assert.equal(preview.status, 200); assert.ok(preview.json.breakdown.total > 0);
  const price = await api('POST', `/api/staff/quotes/${quote.ref}/price`, { stones: [{ type: 'emerald', size: 'medium', count: 1 }], overrides: { discount: 500 } }, 'staff');
  assert.equal(price.status, 200); assert.ok(price.json.quote.total > 0);
  const submit = await api('POST', `/api/staff/quotes/${quote.ref}/action`, { action: 'submit' }, 'staff');
  assert.equal(submit.json.quote.status, 'PENDING_APPROVAL');
  const staffApprove = await api('POST', `/api/staff/quotes/${quote.ref}/action`, { action: 'approve' }, 'staff');
  assert.equal(staffApprove.status, 403);
  const back = await api('POST', `/api/staff/quotes/${quote.ref}/action`, { action: 'sendBack', note: 'Use large emerald' }, 'manager');
  assert.equal(back.json.quote.status, 'CHANGES_REQUESTED');
  await api('POST', `/api/staff/quotes/${quote.ref}/price`, { stones: [{ type: 'emerald', size: 'large', count: 1 }] }, 'staff');
  await api('POST', `/api/staff/quotes/${quote.ref}/action`, { action: 'submit' }, 'staff');
  const approve = await api('POST', `/api/staff/quotes/${quote.ref}/action`, { action: 'approve', note: 'Looks good' }, 'manager');
  assert.equal(approve.status, 200); assert.equal(approve.json.quote.status, 'QUOTED'); assert.ok(approve.json.quote.validUntil);
});

test('customer sees the price, accepts; manual payment moves it to production', async () => {
  const t = await api('GET', `/api/track/${quote.ref}?phone=9876543210`);
  assert.equal(t.status, 200); assert.ok(t.json.priceBreakdown.total > 0); assert.equal(t.json.pay, null, 'payments not configured in test');
  const acc = await api('POST', `/api/track/${quote.ref}/accept`, { token });
  assert.equal(acc.json.status, 'ACCEPTED');
  const total = t.json.total / 100;
  const tooMuch = await api('POST', `/api/staff/quotes/${quote.ref}/manual-payment`, { amount: total + 1, method: 'upi' }, 'manager');
  assert.equal(tooMuch.status, 400);
  const pay = await api('POST', `/api/staff/quotes/${quote.ref}/manual-payment`, { amount: Math.round(total / 2), method: 'upi' }, 'manager');
  assert.equal(pay.status, 200); assert.equal(pay.json.pay.nextKind, 'BALANCE');
  const prod = await api('POST', `/api/staff/quotes/${quote.ref}/action`, { action: 'startProduction' }, 'staff');
  assert.equal(prod.json.quote.status, 'IN_PRODUCTION');
  const list = await api('GET', '/api/staff/quotes?status=IN_PRODUCTION&q=priya', null, 'staff');
  assert.equal(list.json.total, 1);
  const dash = await api('GET', '/api/staff/dashboard', null, 'manager');
  assert.equal(dash.json.counts.IN_PRODUCTION, 1);
});

test('AI keys: stored encrypted, only last4 exposed, admin only', async () => {
  const denied = await api('PUT', '/api/admin/ai/openrouter/key', { apiKey: 'sk-or-v1-abcdefabcdefabcdefabcdef' }, 'manager');
  assert.equal(denied.status, 403);
  const bad = await api('PUT', '/api/admin/ai/openrouter/key', { apiKey: 'nope' }, 'admin');
  assert.equal(bad.status, 400);
  const ok = await api('PUT', '/api/admin/ai/openrouter/key', { apiKey: 'sk-or-v1-abcdefabcdefabcdefabcdef1234', model: 'black-forest-labs/flux.2-pro' }, 'admin');
  assert.equal(ok.status, 200);
  const p = ok.json.providers.find((x) => x.provider === 'openrouter');
  assert.equal(p.keyLast4, '1234'); assert.equal(p.isDefault, true); assert.equal(p.model, 'black-forest-labs/flux.2-pro');
  assert.ok(!JSON.stringify(ok.json).includes('abcdefabcdef'), 'key must never be returned');
  const row = (await query('SELECT key_ciphertext FROM ai_providers'))[0];
  assert.ok(row.keyCiphertext.startsWith('v1.') && !row.keyCiphertext.includes('abcdef'));
  const content = await api('GET', '/api/content');
  assert.equal(content.json.ai.live, true);
  const view = await api('GET', '/api/admin/ai', null, 'manager');
  assert.equal(view.status, 200, 'managers can view usage');
  await api('PATCH', '/api/admin/ai/openrouter', { enabled: false }, 'admin');
  assert.equal((await api('GET', '/api/content')).json.ai.live, false);
});

test('users: admin only, cannot remove last admin', async () => {
  assert.equal((await api('GET', '/api/admin/users', null, 'staff')).status, 403);
  const created = await api('POST', '/api/admin/users', { email: 'new@t.test', name: 'New Person', role: 'STAFF', password: 'password123' }, 'admin');
  assert.equal(created.status, 201);
  const me = (await api('GET', '/api/auth/me', null, 'admin')).json.user;
  const self = await api('PATCH', `/api/admin/users/${me.id}`, { role: 'STAFF' }, 'admin');
  assert.equal(self.status, 400);
  const pw = await api('POST', '/api/auth/change-password', { current: 'clelia123', next: 'clelia1234' }, 'admin');
  assert.equal(pw.status, 200);
  await api('POST', '/api/auth/change-password', { current: 'clelia1234', next: 'clelia123' }, 'admin');
});
