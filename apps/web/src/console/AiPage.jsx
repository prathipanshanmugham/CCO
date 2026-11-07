// AI image providers: keys are entered here once, encrypted on the server, and never shown again.
import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { ErrorBox, Field, Icon, useToast, Modal } from '../components/ui.jsx';
import { dateTime, usd, title } from '../lib/format.js';
import { NoAccess } from './Layout.jsx';

export default function AiPage() {
  const { can } = useOutletContext();
  const toast = useToast();
  const { data, error, reload, setData } = useApi(() => api.get('/api/admin/ai'), []);
  const [keyFor, setKeyFor] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!can('ai.view')) return <NoAccess what="AI settings" />;
  const manage = can('ai.manage');
  const apply = (r) => setData({ ...data, providers: r.providers });
  const patch = async (p, body) => { try { apply(await api.patch(`/api/admin/ai/${p}`, body)); } catch (e) { toast(e.message, 'bad'); } };
  const test = async (p) => { setTesting(p); setTestResult(null); try { const r = await api.post(`/api/admin/ai/${p}/test`); apply(r); setTestResult({ provider: p, ...r.result }); } catch (e) { toast(e.message, 'bad'); } finally { setTesting(null); } };
  const remove = async (p) => { if (!confirm('Remove this key? Image generation through this provider will stop.')) return; try { apply(await api.del(`/api/admin/ai/${p}`)); toast('Key removed'); } catch (e) { toast(e.message, 'bad'); } };
  const saveSettings = async (s) => { setBusy(true); try { const ai = await api.put('/api/admin/settings/ai', s); setData({ ...data, settings: ai }); toast('Saved'); } catch (e) { toast(e.message, 'bad'); } finally { setBusy(false); } };

  if (error) return <ErrorBox error={error} retry={reload} />;
  if (!data) return <div className="empty"><span className="spin" /></div>;
  const { providers, usage, settings } = data;
  const live = providers.some((p) => p.configured && p.enabled) && settings.mode !== 'paused';

  return (
    <div className="stack-lg">
      <div className="page-head"><div><h1 style={{ fontSize: 32 }}>AI concept images</h1><span className="hint">Customers see photographic concepts of their description. Keys stay on the server; the browser only ever gets finished images.</span></div>
        <span className={`badge ${live ? 'tone-ok' : 'tone-bad'}`}>{live ? 'Live for customers' : 'Off for customers'}</span></div>

      <div className="stats">
        <div className="stat-card"><span className="n" style={{ fontSize: 26 }}>{usd(usage.month.costUsd)}</span><span className="l">Spent this month · {usage.month.images} images</span></div>
        <div className="stat-card"><span className="n" style={{ fontSize: 26 }}>{usd(usage.last30.costUsd)}</span><span className="l">Last 30 days · {usage.last30.calls} calls</span></div>
        <div className="stat-card"><span className="n" style={{ fontSize: 26 }}>{usage.last30.images ? usd(usage.last30.costUsd / usage.last30.images) : '—'}</span><span className="l">Average per image</span></div>
        <div className="stat-card"><span className="n" style={{ fontSize: 26 }}>{usage.last30.failures}</span><span className="l">Failed calls (30 d)</span></div>
      </div>

      <div className="grid-2">
        {providers.map((p) => (
          <div key={p.provider} className={`provider ${p.isDefault && p.configured ? 'default' : ''}`}>
            <div className="row between"><div><strong style={{ fontSize: 17 }}>{p.label}</strong>{p.isDefault && p.configured && <span className="badge plain tone-accent" style={{ marginLeft: 8 }}>Default</span>}<p className="hint">{p.help}</p></div>
              {p.configured ? <span className={`badge ${p.enabled ? 'tone-ok' : ''}`}>{p.enabled ? 'Enabled' : 'Disabled'}</span> : <span className="badge">Not set up</span>}</div>
            {p.configured ? (
              <>
                <div className="row between" style={{ fontSize: 14 }}><span>Key ending <span className="mono">····{p.keyLast4}</span></span><span className="hint">{p.lastTestAt ? `Tested ${dateTime(p.lastTestAt)}: ${p.lastTestOk ? 'OK' : 'failed'}` : 'Not tested yet'}</span></div>
                {p.lastTestOk === false && p.lastTestError && <p className="error">{p.lastTestError}</p>}
                <Field id={`m-${p.provider}`} label="Model"><select id={`m-${p.provider}`} className="select" value={p.model} disabled={!manage} onChange={(e) => patch(p.provider, { model: e.target.value })}>{p.models.map((m) => <option key={m.id} value={m.id}>{m.label} · ≈{usd(m.costUsd)}/image</option>)}</select></Field>
                {manage && <Field id={`b-${p.provider}`} label="Monthly budget (USD, optional)" hint="Images stop for customers when this is reached; 3D designs keep working."><input id={`b-${p.provider}`} className="input" type="number" min={0} step={1} defaultValue={p.monthlyBudgetUsd ?? ''} onBlur={(e) => patch(p.provider, { monthlyBudgetUsd: e.target.value === '' ? null : Number(e.target.value) })} placeholder="No limit" /></Field>}
                {manage && <div className="row">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => test(p.provider)} disabled={testing === p.provider}>{testing === p.provider ? <><span className="spin" /> Testing…</> : <><Icon name="spark" size={14} /> Test image</>}</button>
                  {!p.isDefault && <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(p.provider, { isDefault: true })}>Make default</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(p.provider, { enabled: !p.enabled })}>{p.enabled ? 'Disable' : 'Enable'}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKeyFor(p)}>Replace key</button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)' }} onClick={() => remove(p.provider)}><Icon name="trash" size={14} /> Remove</button>
                </div>}
              </>
            ) : manage ? <button type="button" className="btn btn-primary btn-sm" style={{ justifySelf: 'start' }} onClick={() => setKeyFor(p)}><Icon name="lock" size={14} /> Add API key</button> : <p className="hint">An admin can add the key.</p>}
          </div>
        ))}
      </div>

      {testResult && <div className={`banner ${testResult.ok ? 'ok' : 'bad'}`}><span>{testResult.ok ? `Test image generated in ${(testResult.ms / 1000).toFixed(1)} s.` : `Test failed: ${testResult.error}`}</span>{testResult.ok && <img src={testResult.url} alt="Test" style={{ width: 72, height: 72, borderRadius: 8 }} />}</div>}

      {can('settings.view') && (
        <div className="panel stack">
          <h3>Customer-side behaviour</h3>
          <AiSettingsForm settings={settings} manage={can('settings.edit')} onSave={saveSettings} busy={busy} />
        </div>
      )}

      <div className="grid-2">
        <div className="panel stack"><h4>By provider (30 days)</h4>{usage.byProvider.length ? <table className="list"><thead><tr><th>Provider</th><th>Model</th><th>Images</th><th>Cost</th></tr></thead><tbody>{usage.byProvider.map((b) => <tr key={b.provider + b.model}><td>{title(b.provider)}</td><td className="hint">{b.model}</td><td>{b.images}</td><td className="mono">{usd(b.costUsd)}</td></tr>)}</tbody></table> : <p className="hint">No usage yet.</p>}</div>
        <div className="panel stack"><h4>Recent calls</h4><div className="stack-sm" style={{ maxHeight: 320, overflow: 'auto' }}>{usage.recent.map((u) => <div key={u.id} className="row between" style={{ fontSize: 13.5 }}><span><span className={`badge plain ${u.ok ? 'tone-ok' : 'tone-bad'}`}>{u.ok ? 'ok' : 'failed'}</span> {u.images} img · {u.model}</span><span className="hint">{usd(u.costUsd)} · {(u.ms / 1000).toFixed(1)} s · {dateTime(u.createdAt)}</span>{u.error && <span className="error" style={{ width: '100%' }}>{u.error}</span>}</div>)}{!usage.recent.length && <p className="hint">Nothing yet.</p>}</div></div>
      </div>

      {keyFor && <KeyModal provider={keyFor} onClose={() => setKeyFor(null)} onSaved={(r) => { apply(r); setKeyFor(null); toast('Key saved and encrypted'); }} />}
    </div>
  );
}

function KeyModal({ provider, onClose, onSaved }) {
  const [key, setKey] = useState(''); const [model, setModel] = useState(provider.model); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { onSaved(await api.put(`/api/admin/ai/${provider.provider}/key`, { apiKey: key.trim(), model })); } catch (er) { setErr(er.message); } finally { setBusy(false); } };
  return (
    <Modal title={`${provider.label} API key`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="hint">{provider.help} Paste the key here; it is encrypted at rest and only the last 4 characters are ever shown again.</p>
        <Field id="k" label="API key"><div style={{ position: 'relative' }}><input id="k" className="input mono" style={{ paddingRight: 44 }} type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} required /><button type="button" className="icon-btn" style={{ position: 'absolute', right: 4, top: 4, border: 0, width: 32, height: 32 }} onClick={() => setShow((v) => !v)} aria-label="Show"><Icon name={show ? 'eyeOff' : 'eye'} size={16} /></button></div></Field>
        <Field id="mo" label="Model"><select id="mo" className="select" value={model} onChange={(e) => setModel(e.target.value)}>{provider.models.map((m) => <option key={m.id} value={m.id}>{m.label} · ≈{usd(m.costUsd)}/image</option>)}</select></Field>
        {err && <p className="error">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save key'}</button></div>
      </form>
    </Modal>
  );
}

function AiSettingsForm({ settings, manage, onSave, busy }) {
  const [s, setS] = useState(settings);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(s); }}>
      <div className="form-grid">
        <Field id="mode" label="Concept images for customers"><select id="mode" className="select" value={s.mode} onChange={set('mode')} disabled={!manage}><option value="live">On (when a provider is enabled)</option><option value="paused">Paused</option></select></Field>
        <Field id="ipd" label="Images per click" hint="1–4. Each costs roughly the per-image price above."><input id="ipd" className="input" type="number" min={1} max={4} value={s.imagesPerDesign} onChange={set('imagesPerDesign')} disabled={!manage} /></Field>
        <div className="span-2"><Field id="style" label="Style instruction added to every prompt"><textarea id="style" className="textarea" rows={2} value={s.style} onChange={set('style')} disabled={!manage} /></Field></div>
        <div className="span-2"><Field id="neg" label="Things to avoid"><input id="neg" className="input" value={s.negative} onChange={set('negative')} disabled={!manage} /></Field></div>
      </div>
      {manage && <button className="btn btn-primary" style={{ justifySelf: 'start' }} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>}
    </form>
  );
}
