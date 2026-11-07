import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Viewer3D } from '../components/Viewer3D.jsx';
import { StatusBadge, ErrorBox, Icon, Modal, Field, PriceTable, Timeline, Lightbox, useToast } from '../components/ui.jsx';
import { inr, rupees, date, dateTime, grams, title, metalLabel } from '../lib/format.js';

const ACTION_META = {
  claim: { label: 'Start review', tone: 'btn-primary' }, submit: { label: 'Send for approval', tone: 'btn-primary' },
  approve: { label: 'Approve & send to customer', tone: 'btn-ok', note: 'Note to customer (optional)' },
  sendBack: { label: 'Send back', tone: 'btn-secondary', note: 'What should change?', required: true },
  revise: { label: 'Revise price', tone: 'btn-secondary' }, startProduction: { label: 'Start production', tone: 'btn-primary' },
  ready: { label: 'Mark ready', tone: 'btn-primary' }, ship: { label: 'Mark shipped', tone: 'btn-primary', note: 'Courier & tracking (optional)' }, complete: { label: 'Complete', tone: 'btn-ok' },
  decline: { label: 'Decline', tone: 'btn-ghost', note: 'Reason (shown to customer)' }, cancel: { label: 'Cancel', tone: 'btn-ghost', note: 'Reason' }, reopen: { label: 'Reopen', tone: 'btn-secondary' },
};
const STONE_TYPES = ['diamond', 'lab-diamond', 'moissanite', 'ruby', 'emerald', 'sapphire', 'cz'];

export default function QuoteDetail() {
  const { id } = useParams();
  const { user, can } = useOutletContext();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi(() => api.get(`/api/staff/quotes/${id}`), [id]);
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const q = data?.quote; const d = q?.design;

  const run = async (fn, okMsg) => { setBusy(true); try { const r = await fn(); setData({ ...data, ...r }); if (okMsg) toast(okMsg); setModal(null); setNote(''); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); } };
  const doAction = (action) => { const m = ACTION_META[action]; if (m.note && modal !== action) { setModal(action); return; } if (m.required && !note.trim()) return toast('Please add a note', 'bad'); run(() => api.post(`/api/staff/quotes/${q.id}/action`, { action, note: note.trim() || undefined }), `${m.label} ✓`); };

  if (error) return <ErrorBox error={error} retry={reload} />;
  if (loading || !q) return <div className="empty"><span className="spin" /></div>;
  const canPrice = ['NEW', 'IN_REVIEW', 'CHANGES_REQUESTED'].includes(q.status) && can('quotes.work');
  const glb = d.modelFiles?.find((f) => f.ext === '.glb');

  return (
    <div className="stack">
      <div className="page-head">
        <div><Link to="/staff/quotes" className="hint" style={{ textDecoration: 'none' }}>← Quotes</Link><div className="row" style={{ gap: 12 }}><h1 className="mono" style={{ fontSize: 30 }}>{q.ref}</h1><StatusBadge status={q.status} />{q.brand === 'SCORPLING' && <span className="badge plain">Scorpling</span>}</div><span className="hint">Requested {dateTime(q.createdAt)} · {q.assignedTo ? `assigned to ${q.assignedTo.name}` : 'unassigned'}{q.preparedBy ? ` · priced by ${q.preparedBy.name}` : ''}{q.approvedBy ? ` · approved by ${q.approvedBy.name}` : ''}</span></div>
        <div className="row">{data.actions.map((a) => <button key={a} type="button" className={`btn btn-sm ${ACTION_META[a]?.tone || 'btn-secondary'}`} disabled={busy} onClick={() => doAction(a)}>{ACTION_META[a]?.label || a}</button>)}</div>
      </div>
      {q.status === 'PENDING_APPROVAL' && can('quotes.approve') && q.preparedBy?.id === user.id && user.role !== 'ADMIN' && <div className="banner warn"><span><Icon name="warn" size={16} /> You prepared this price, so another manager must approve it.</span></div>}
      {q.status === 'CHANGES_REQUESTED' && <div className="banner warn"><span><Icon name="warn" size={16} /> Sent back: {q.timeline?.slice().reverse().find((t) => t.status === 'CHANGES_REQUESTED')?.note}</span></div>}

      <div className="detail-layout">
        <div className="stack">
          <div className="panel stack">
            <div className="row between"><h3>{title(d.pieceType)} · {metalLabel(d.metal)}</h3><div className="row">{d.modelFiles?.map((f) => <a key={f.ext} className="btn btn-secondary btn-sm" href={f.url.replace('/api/files/', '/api/staff/files/')} download><Icon name="download" size={14} /> {f.ext.slice(1).toUpperCase()}</a>)}</div></div>
            <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }}>
              <ModelView glbUrl={glb?.url} previewPath={d.previewPath} />
              <div className="stack-sm">
                <p style={{ color: 'var(--ink-2)' }}>{d.summary}</p>
                <dl className="kv">
                  <dt>Prompt</dt><dd style={{ fontStyle: 'italic' }}>“{d.prompt}”</dd>
                  <dt>Weight</dt><dd>{grams(d.weightG)} <span className="hint">(from 3D volume {d.volumeMm3 ? `${Math.round(d.volumeMm3)} mm³` : ''})</span></dd>
                  <dt>Size</dt><dd>{d.dimensions ? `${d.dimensions.widthMm?.toFixed(1)} × ${d.dimensions.heightMm?.toFixed(1)} × ${d.dimensions.depthMm?.toFixed(1)} mm` : '—'}</dd>
                  <dt>Stone</dt><dd>{d.stone && d.stone !== 'none' ? title(d.stone) : 'None'}</dd>
                  <dt>Options</dt><dd className="hint">{Object.entries(d.params || {}).map(([k, v]) => `${title(k)}: ${v}`).join(' · ') || '—'}</dd>
                </dl>
                {d.refImages?.length > 0 && <div><span className="hint">Customer's references</span><div className="refs" style={{ marginTop: 4 }}>{d.refImages.map((r) => <img key={r.url} src={r.url} alt="" onClick={() => setLightbox(r.url)} style={{ cursor: 'zoom-in' }} />)}</div></div>}
              </div>
            </div>
            {d.aiImages?.length > 0 && <div><span className="hint">AI concept images the customer saw</span><div className="ai-grid" style={{ marginTop: 6, gridTemplateColumns: 'repeat(6, 1fr)' }}>{d.aiImages.map((im) => <img key={im.url} src={im.url} alt="" onClick={() => setLightbox(im.url)} />)}</div></div>}
          </div>

          <PricingPanel data={data} canPrice={canPrice} onSaved={(r) => { setData({ ...data, ...r }); toast('Price saved'); }} />

          <div className="panel stack">
            <h3>Internal notes</h3>
            <div className="notes">{(q.staffNotes || []).map((n, i) => <div key={i} className="note">{n.text}<small>{n.by} · {dateTime(n.at)}</small></div>)}{!q.staffNotes?.length && <p className="hint">No notes yet.</p>}</div>
            {can('quotes.work') && <NoteForm onAdd={(text) => run(() => api.post(`/api/staff/quotes/${q.id}/notes`, { text }))} />}
          </div>
        </div>

        <aside className="stack">
          <div className="panel stack">
            <h4>Customer</h4>
            <dl className="kv"><dt>Name</dt><dd>{q.customerName}</dd><dt>Mobile</dt><dd><a href={`tel:${q.phone}`}>{q.phone}</a> · <a href={`https://wa.me/91${q.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hello ${q.customerName.split(' ')[0]}, this is ${q.brand === 'SCORPLING' ? 'Scorpling' : 'Clelia & Co.'} about your request ${q.ref}.`)}`} target="_blank" rel="noreferrer">WhatsApp</a></dd>{q.email && <><dt>Email</dt><dd><a href={`mailto:${q.email}`}>{q.email}</a></dd></>}<dt>Address</dt><dd>{q.address1}{q.address2 ? `, ${q.address2}` : ''}<br />{q.city}, {q.state} – {q.pincode}</dd>{q.customerNotes && <><dt>Notes</dt><dd>{q.customerNotes}</dd></>}</dl>
            <a className="btn btn-secondary btn-sm" href={`/track/${q.ref}?t=${q.trackToken}`} target="_blank" rel="noreferrer"><Icon name="eye" size={14} /> View as customer</a>
          </div>
          {can('quotes.approve') && <AssignBox q={q} onChange={(r) => setData({ ...data, ...r })} />}
          <div className="panel stack">
            <div className="row between"><h4>Payments</h4>{data.pay?.total > 0 && <span className="hint">{inr(data.pay.paid)} of {inr(data.pay.total)}</span>}</div>
            {q.payments?.length ? q.payments.map((p) => <div key={p.id} className="row between" style={{ fontSize: 14 }}><span>{title(p.kind)} · <span className={`badge plain ${p.status === 'PAID' ? 'tone-ok' : p.status === 'FAILED' ? 'tone-bad' : ''}`}>{p.status.toLowerCase()}</span></span><span className="mono">{inr(p.amount)}</span><span className="hint" style={{ width: '100%' }}>{p.method || (p.razorpayOrderId.startsWith('manual') ? 'recorded manually' : 'Razorpay')} · {dateTime(p.paidAt || p.createdAt)}</span></div>) : <p className="hint">No payments yet.</p>}
            {data.pay?.due > 0 && can('quotes.approve') && ['QUOTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY', 'SHIPPED'].includes(q.status) && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal('manual')}><Icon name="rupee" size={14} /> Record cash / UPI payment</button>}
          </div>
          <div className="panel stack"><h4>Timeline</h4><Timeline items={q.timeline} current={q.status} /></div>
        </aside>
      </div>

      {modal && ACTION_META[modal] && (
        <Modal title={ACTION_META[modal].label} onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Back</button><button type="button" className={`btn ${ACTION_META[modal].tone === 'btn-ghost' ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={() => doAction(modal)}>{ACTION_META[modal].label}</button></>}>
          {modal === 'approve' && <PriceTable breakdown={q.priceBreakdown} />}
          <Field id="note" label={ACTION_META[modal].note}><textarea id="note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></Field>
        </Modal>
      )}
      {modal === 'manual' && <ManualPayment due={data.pay.due} onClose={() => setModal(null)} onSave={(body) => run(() => api.post(`/api/staff/quotes/${q.id}/manual-payment`, body), 'Payment recorded')} />}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function ModelView({ glbUrl, previewPath }) {
  const [obj, setObj] = useState(null); const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!glbUrl) return;
    let dead = false;
    new GLTFLoader().load(glbUrl, (g) => { g.scene.scale.setScalar(1000); /* GLB is in metres; viewer works in mm */ if (!dead) setObj(g.scene); }, undefined, () => setFailed(true));
    return () => { dead = true; };
  }, [glbUrl]);
  if (!glbUrl || failed) return previewPath ? <img src={previewPath} alt="" style={{ borderRadius: 14, border: '1px solid var(--line)', width: '100%' }} /> : <div className="viewer"><div className="loading">No 3D file</div></div>;
  return <Viewer3D object={obj} autoRotate={false} style={{ aspectRatio: '1' }}>{!obj && <div className="loading"><span className="spin" /></div>}</Viewer3D>;
}

function PricingPanel({ data, canPrice, onSaved }) {
  const q = data.quote; const d = q.design; const defaults = data.pricingDefaults;
  const saved = q.priceBreakdown;
  const [ov, setOv] = useState(() => ({ weightG: saved?.weightG ?? d.weightG ?? '', metalRate: saved?.metalRate ?? defaults.metalRates[d.metal] ?? '', wastagePercent: saved?.overrides?.wastagePercent ?? defaults.wastagePercent, makingPerGram: saved?.overrides?.makingPerGram ?? defaults.makingPerGram, designFee: saved?.overrides?.designFee ?? defaults.designFee, printAndCasting: saved?.overrides?.printAndCasting ?? defaults.printAndCasting, discount: saved?.overrides?.discount ?? 0, gstPercent: saved?.overrides?.gstPercent ?? defaults.gstPercent }));
  const [stones, setStones] = useState(() => saved?.stones?.length ? saved.stones.map((s) => ({ type: s.type, size: s.size, count: s.count, unitPrice: s.unitPrice })) : d.stone && d.stone !== 'none' ? [{ type: d.stone, size: 'small', count: Math.max(1, Number(d.params?.stoneCount) || 1), unitPrice: defaults.stoneRates[d.stone]?.small }] : []);
  const [advance, setAdvance] = useState(q.advancePercent);
  const [preview, setPreview] = useState(saved || null);
  const [busy, setBusy] = useState(false);
  const body = useMemo(() => ({ overrides: Object.fromEntries(Object.entries(ov).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)])), stones: stones.filter((s) => s.count > 0).map((s) => ({ ...s, count: Number(s.count), unitPrice: s.unitPrice === '' || s.unitPrice == null ? undefined : Number(s.unitPrice) })), advancePercent: Number(advance) }), [ov, stones, advance]);
  const timer = useRef();
  useEffect(() => {
    if (!canPrice) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api.post(`/api/staff/quotes/${q.id}/price?preview=1`, body).then((r) => setPreview(r.breakdown)).catch(() => {}), 250);
    return () => clearTimeout(timer.current);
  }, [body, canPrice, q.id]);
  const save = async () => { setBusy(true); try { onSaved(await api.post(`/api/staff/quotes/${q.id}/price`, body)); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  const num = (k, extra = {}) => <input className="input" type="number" inputMode="decimal" value={ov[k]} onChange={(e) => setOv({ ...ov, [k]: e.target.value })} {...extra} />;
  if (!canPrice) return (
    <div className="panel stack"><div className="row between"><h3>Price</h3>{q.validUntil && <span className="hint">Valid until {date(q.validUntil)} · advance {q.advancePercent}%</span>}</div>{saved ? <PriceTable breakdown={saved} /> : <p className="hint">Not priced yet.</p>}</div>
  );
  return (
    <div className="panel stack">
      <div className="row between"><h3>Price this piece</h3><span className="hint">Rates default to Pricing &amp; content; adjust here for this quote only.</span></div>
      <div className="form-grid">
        <Field id="w" label="Metal weight (g)" hint={`3D estimate ${grams(d.weightG)}. Add for sprues/finish if needed.`}>{num('weightG', { step: 0.01, min: 0 })}</Field>
        <Field id="r" label={`Rate ₹/g · ${metalLabel(d.metal)}`}>{num('metalRate', { step: 1, min: 0 })}</Field>
        <Field id="wa" label="Wastage %">{num('wastagePercent', { step: 0.5, min: 0, max: 40 })}</Field>
        <Field id="m" label="Making ₹/g">{num('makingPerGram', { step: 10, min: 0 })}</Field>
        <Field id="df" label="Design fee ₹">{num('designFee', { step: 100, min: 0 })}</Field>
        <Field id="pc" label="3D print & casting ₹">{num('printAndCasting', { step: 100, min: 0 })}</Field>
        <Field id="disc" label="Discount ₹">{num('discount', { step: 100, min: 0 })}</Field>
        <Field id="gst" label="GST %">{num('gstPercent', { step: 0.5, min: 0, max: 28 })}</Field>
      </div>
      <div className="stack-sm">
        <div className="row between"><label style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)' }}>Stones</label><button type="button" className="btn btn-ghost btn-sm" onClick={() => setStones([...stones, { type: 'cz', size: 'small', count: 1, unitPrice: defaults.stoneRates.cz.small }])}><Icon name="plus" size={14} /> Add row</button></div>
        {stones.map((s, i) => (
          <div key={i} className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <select className="select" value={s.type} onChange={(e) => setStones(stones.map((x, j) => (j === i ? { ...x, type: e.target.value, unitPrice: defaults.stoneRates[e.target.value]?.[x.size] } : x)))}>{STONE_TYPES.map((t) => <option key={t} value={t}>{title(t)}</option>)}</select>
            <select className="select" style={{ width: 120 }} value={s.size} onChange={(e) => setStones(stones.map((x, j) => (j === i ? { ...x, size: e.target.value, unitPrice: defaults.stoneRates[x.type]?.[e.target.value] } : x)))}>{['small', 'medium', 'large'].map((z) => <option key={z} value={z}>{title(z)}</option>)}</select>
            <input className="input" style={{ width: 80 }} type="number" min={0} value={s.count} onChange={(e) => setStones(stones.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))} aria-label="Count" />
            <input className="input" style={{ width: 110 }} type="number" min={0} value={s.unitPrice ?? ''} placeholder="₹ each" onChange={(e) => setStones(stones.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} aria-label="Unit price" />
            <button type="button" className="icon-btn" onClick={() => setStones(stones.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" size={14} /></button>
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div>{preview ? <PriceTable breakdown={preview} /> : <p className="hint">Enter the weight to see the price.</p>}</div>
        <div className="stack">
          <Field id="adv" label="Advance to start (%)"><input id="adv" type="range" className="range" min={10} max={100} step={5} value={advance} onChange={(e) => setAdvance(e.target.value)} /><span className="hint">{advance}% = {preview ? rupees(Math.round(preview.total * advance / 100)) : '—'}</span></Field>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !preview}>{busy ? 'Saving…' : saved ? 'Save changes' : 'Save price'}</button>
          <p className="hint">Saving does not send it to the customer. Use “Send for approval” above; a manager approves and the customer is notified.</p>
        </div>
      </div>
    </div>
  );
}

function NoteForm({ onAdd }) {
  const [text, setText] = useState('');
  return <form className="row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(''); } }}><input className="input" style={{ flex: 1 }} placeholder="Add a note for the team…" value={text} onChange={(e) => setText(e.target.value)} /><button className="btn btn-secondary">Add</button></form>;
}

function AssignBox({ q, onChange }) {
  const { data: users } = useApi(() => api.get('/api/staff/users-lite'), []);
  return (
    <div className="panel stack"><h4>Assigned to</h4>
      <select className="select" value={q.assignedTo?.id || ''} onChange={async (e) => onChange(await api.post(`/api/staff/quotes/${q.id}/assign`, { userId: e.target.value || null }))}><option value="">Unassigned</option>{(users || []).map((u) => <option key={u.id} value={u.id}>{u.name} · {title(u.role)}</option>)}</select>
    </div>
  );
}

function ManualPayment({ due, onClose, onSave }) {
  const [amount, setAmount] = useState(String(Math.round(due / 100))); const [method, setMethod] = useState('upi'); const [note, setNote] = useState('');
  return (
    <Modal title="Record a payment" onClose={onClose} footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => onSave({ amount: Number(amount), method, note })}>Record</button></>}>
      <p className="hint">For money received outside Razorpay (cash at the studio, direct UPI or bank transfer). Due: {inr(due)}.</p>
      <div className="form-grid"><Field id="amt" label="Amount ₹"><input id="amt" className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field id="mth" label="Method"><select id="mth" className="select" value={method} onChange={(e) => setMethod(e.target.value)}><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="card">Card at studio</option></select></Field><div className="span-2"><Field id="pn" label="Reference / note"><input id="pn" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div></div>
    </Modal>
  );
}
