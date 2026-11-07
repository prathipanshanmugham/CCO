import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { ErrorBox, Field, useToast } from '../components/ui.jsx';
import { metalLabel, title, dateTime } from '../lib/format.js';
import { NoAccess } from './Layout.jsx';

export default function SettingsPage() {
  const { can } = useOutletContext();
  const toast = useToast();
  const { data, error, reload, setData } = useApi(() => api.get('/api/admin/settings'), []);
  const [tab, setTab] = useState('pricing');
  if (!can('settings.view')) return <NoAccess what="Pricing & content" />;
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return <div className="empty"><span className="spin" /></div>;
  const edit = can('settings.edit');
  const save = async (key, value) => { try { const saved = await api.put(`/api/admin/settings/${key}`, value); setData({ ...data, [key]: saved }); toast('Saved'); } catch (e) { toast(e.message, 'bad'); } };
  return (
    <div className="stack">
      <div className="page-head"><div><h1 style={{ fontSize: 32 }}>Pricing &amp; content</h1><span className="hint">{edit ? 'Changes apply to new quotes immediately. Existing quotes keep their saved price.' : 'View only. Ask an admin to change these.'}</span></div></div>
      <div className="tabs">{[['pricing', 'Metal rates & charges'], ['stones', 'Stone prices'], ['content', 'Studio content'], ['audit', 'Activity log']].map(([k, l]) => <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'pricing' && <PricingForm pricing={data.pricing} edit={edit} onSave={(v) => save('pricing', v)} />}
      {tab === 'stones' && <StonesForm pricing={data.pricing} edit={edit} onSave={(v) => save('pricing', v)} />}
      {tab === 'content' && <ContentForm content={data.content} edit={edit} onSave={(v) => save('content', v)} />}
      {tab === 'audit' && <AuditLog />}
    </div>
  );
}

function PricingForm({ pricing, edit, onSave }) {
  const [p, setP] = useState(pricing);
  const num = (k, label, hint, extra = {}) => <Field id={k} label={label} hint={hint}><input id={k} className="input" type="number" value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} disabled={!edit} {...extra} /></Field>;
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(p); }}>
      <div className="panel stack">
        <div><h3>Metal rate per gram (₹)</h3><p className="hint">Update these with the day's rate. Staff can still adjust the rate on an individual quote.</p></div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {Object.keys(p.metalRates).map((m) => <Field key={m} id={`mr-${m}`} label={metalLabel(m)}><input id={`mr-${m}`} className="input" type="number" min={0} value={p.metalRates[m]} onChange={(e) => setP({ ...p, metalRates: { ...p.metalRates, [m]: Number(e.target.value) } })} disabled={!edit} /></Field>)}
        </div>
      </div>
      <div className="panel stack">
        <h3>Charges</h3>
        <div className="form-grid">
          {num('wastagePercent', 'Wastage %', 'Added on the metal value', { step: 0.5, min: 0, max: 40 })}
          {num('makingPerGram', 'Making charges ₹/g')}
          {num('makingMinimum', 'Minimum making charge ₹')}
          {num('designFee', 'Design fee ₹', 'Covers the 3D design work')}
          {num('printAndCasting', '3D print & casting ₹')}
          {num('gstPercent', 'GST %', '3% on jewellery', { step: 0.5, min: 0, max: 28 })}
          {num('advancePercent', 'Default advance %', 'Staff can change per quote', { min: 10, max: 100, step: 5 })}
          {num('quoteValidDays', 'Quote valid for (days)', '', { min: 1, max: 60 })}
          {num('scorplingSurchargePercent', 'Scorpling setting surcharge %', 'Extra on metal + making for dense pavé work', { step: 0.5, min: 0 })}
        </div>
      </div>
      {edit && <button className="btn btn-primary" style={{ justifySelf: 'start' }}>Save pricing</button>}
    </form>
  );
}

function StonesForm({ pricing, edit, onSave }) {
  const [rates, setRates] = useState(pricing.stoneRates);
  const sizes = ['small', 'medium', 'large'];
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave({ ...pricing, stoneRates: rates }); }}>
      <div className="panel stack">
        <div><h3>Price per stone (₹)</h3><p className="hint">Small ≈ under 2 mm, medium ≈ 2–4 mm, large ≈ over 4 mm. Staff can override per quote.</p></div>
        <div className="table-wrap"><table className="list"><thead><tr><th>Stone</th>{sizes.map((s) => <th key={s}>{title(s)}</th>)}</tr></thead><tbody>
          {Object.keys(rates).filter((k) => k !== 'none').map((k) => <tr key={k}><td>{title(k)}</td>{sizes.map((s) => <td key={s}><input className="input" type="number" min={0} style={{ width: 120 }} value={rates[k][s]} onChange={(e) => setRates({ ...rates, [k]: { ...rates[k], [s]: Number(e.target.value) } })} disabled={!edit} /></td>)}</tr>)}
        </tbody></table></div>
      </div>
      {edit && <button className="btn btn-primary" style={{ justifySelf: 'start' }}>Save stone prices</button>}
    </form>
  );
}

function ContentForm({ content, edit, onSave }) {
  const [c, setC] = useState(content);
  const f = (k, label, hint, textarea) => <Field id={k} label={label} hint={hint}>{textarea ? <textarea id={k} className="textarea" rows={2} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} disabled={!edit} /> : <input id={k} className="input" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} disabled={!edit} />}</Field>;
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(c); }}>
      <div className="panel stack"><h3>Customer studio</h3><div className="form-grid">
        <div className="span-2">{f('studioTitle', 'Headline')}</div>
        <div className="span-2">{f('studioIntro', 'Introduction', '', true)}</div>
        <div className="span-2">{f('scorplingIntro', 'Scorpling introduction', '', true)}</div>
        {f('leadTimeDays', 'Making time (days)', 'Shown to customers, e.g. 14–21')}
        {f('supportPhone', 'Support phone')}
        {f('supportEmail', 'Support email')}
        {f('whatsapp', 'WhatsApp number', 'With country code, e.g. 919876543210')}
        <div className="span-2">{f('termsNote', 'Note under every quote', '', true)}</div>
      </div></div>
      {edit && <button className="btn btn-primary" style={{ justifySelf: 'start' }}>Save content</button>}
    </form>
  );
}

function AuditLog() {
  const { data, error, reload } = useApi(() => api.get('/api/admin/audit?limit=200'), []);
  if (error) return <ErrorBox error={error} retry={reload} />;
  return <div className="table-wrap"><table className="list"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>On</th></tr></thead><tbody>{(data || []).map((l) => <tr key={l.id}><td className="hint">{dateTime(l.createdAt)}</td><td>{l.user?.name || 'system'}</td><td className="mono">{l.action}</td><td className="hint">{l.entity} {l.entityId ? `· ${l.entityId.slice(0, 14)}` : ''}{l.meta?.note ? ` · ${l.meta.note}` : ''}</td></tr>)}</tbody></table></div>;
}
