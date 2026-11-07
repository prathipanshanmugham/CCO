import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { StatusBadge, ErrorBox, Empty, Icon } from '../components/ui.jsx';
import { inr, ago, title, metalLabel, STATUS_LABELS } from '../lib/format.js';

const FILTERS = [
  { label: 'All', value: '' }, { label: 'New', value: 'NEW' }, { label: 'In review', value: 'IN_REVIEW,CHANGES_REQUESTED' }, { label: 'Awaiting approval', value: 'PENDING_APPROVAL' },
  { label: 'Quoted', value: 'QUOTED' }, { label: 'Accepted', value: 'ACCEPTED' }, { label: 'In production', value: 'IN_PRODUCTION,READY,SHIPPED' }, { label: 'Completed', value: 'COMPLETED' }, { label: 'Closed', value: 'DECLINED,CANCELLED' },
];

export default function QuotesPage() {
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const status = sp.get('status') || ''; const mine = sp.get('mine') || ''; const brand = sp.get('brand') || ''; const page = Number(sp.get('page') || 1);
  const [q, setQ] = useState(sp.get('q') || '');
  const qs = new URLSearchParams({ status, mine, brand, q: sp.get('q') || '', page }).toString();
  const { data, error, loading, reload } = useApi(() => api.get(`/api/staff/quotes?${qs}`), [qs]);
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); if (!('page' in patch)) n.delete('page'); setSp(n); };
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;
  return (
    <div className="stack">
      <div className="page-head"><h1 style={{ fontSize: 32 }}>Quotes</h1><span className="hint">{data ? `${data.total} request${data.total === 1 ? '' : 's'}` : ''}</span></div>
      <div className="filters">
        <form onSubmit={(e) => { e.preventDefault(); set({ q }); }} className="row" style={{ gap: 6 }}>
          <input className="input" placeholder="Search ref, name, phone, city" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn btn-secondary btn-sm">Search</button>
        </form>
        <select className="select" style={{ width: 'auto' }} value={brand} onChange={(e) => set({ brand: e.target.value })}><option value="">Both brands</option><option value="CLELIA">Clelia &amp; Co.</option><option value="SCORPLING">Scorpling</option></select>
        <label className="check" style={{ marginLeft: 4 }}><input type="checkbox" checked={mine === '1'} onChange={(e) => set({ mine: e.target.checked ? '1' : '' })} /> Mine</label>
      </div>
      <div className="chips">{FILTERS.map((f) => <button type="button" key={f.value} className={`chip ${status === f.value ? 'active' : ''}`} onClick={() => set({ status: f.value })}>{f.label}</button>)}</div>
      {error && <ErrorBox error={error} retry={reload} />}
      {loading && !data ? <div className="empty"><span className="spin" /></div> : data?.items.length === 0 ? <div className="panel"><Empty icon="list" title="Nothing here">Try a different filter.</Empty></div> : data && (
        <div className="table-wrap"><table className="list"><thead><tr><th></th><th>Ref</th><th>Customer</th><th>Piece</th><th>Status</th><th>Assigned</th><th>Total</th><th>Created</th></tr></thead>
          <tbody>{data.items.map((it) => (
            <tr key={it.id} className="click" onClick={() => navigate(`/staff/quotes/${it.ref}`)}>
              <td style={{ width: 52 }}>{it.design?.previewPath ? <img className="thumb" src={it.design.previewPath} alt="" /> : <span className="thumb" />}</td>
              <td><span className="mono">{it.ref}</span>{it.brand === 'SCORPLING' && <div className="hint">Scorpling</div>}</td>
              <td>{it.customerName}<div className="hint">{it.city} · {it.phone}</div></td>
              <td>{title(it.design?.pieceType)}<div className="hint">{metalLabel(it.design?.metal)}{it.design?.weightG ? ` · ${it.design.weightG.toFixed(1)} g` : ''}</div></td>
              <td><StatusBadge status={it.status} /></td><td className="hint">{it.assignedTo?.name || '—'}</td><td className="mono">{it.total ? inr(it.total) : '—'}</td><td className="hint">{ago(it.createdAt)}</td>
            </tr>))}</tbody></table></div>
      )}
      {pages > 1 && <div className="row" style={{ justifyContent: 'center' }}><button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}><Icon name="left" size={14} /> Prev</button><span className="hint">Page {page} of {pages}</span><button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next <Icon name="right" size={14} /></button></div>}
    </div>
  );
}
