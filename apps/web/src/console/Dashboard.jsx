import React from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { StatusBadge, ErrorBox, Empty, Icon } from '../components/ui.jsx';
import { inr, ago, title, metalLabel } from '../lib/format.js';

export default function Dashboard() {
  const { user, can } = useOutletContext();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get('/api/staff/dashboard'), []);
  if (error) return <ErrorBox error={error} retry={reload} />;
  if (loading || !data) return <div className="empty"><span className="spin" /></div>;
  const n = data.needsAction; const c = data.counts;
  const hour = new Date().getHours();
  return (
    <div className="stack-lg">
      <div className="page-head"><div><span className="eyebrow">{hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}</span><h1 style={{ fontSize: 32 }}>{user.name.split(' ')[0]}</h1></div><Link to="/" className="btn btn-secondary btn-sm"><Icon name="spark" size={14} /> Customer studio</Link></div>
      <div className="stats">
        <Link to="/staff/quotes?status=NEW" className="stat-card"><span className="n">{n.newRequests}</span><span className="l">New requests to pick up</span></Link>
        <Link to="/staff/quotes?mine=1" className="stat-card"><span className="n">{n.mine}</span><span className="l">Assigned to me, in review</span></Link>
        {can('quotes.approve') && <Link to="/staff/quotes?status=PENDING_APPROVAL" className="stat-card" style={{ borderColor: n.awaitingApproval ? 'var(--wine)' : undefined }}><span className="n">{n.awaitingApproval}</span><span className="l">Awaiting your approval</span></Link>}
        <Link to="/staff/quotes?status=QUOTED" className="stat-card"><span className="n">{c.QUOTED || 0}</span><span className="l">Quotes with customers</span></Link>
        <Link to="/staff/quotes?status=ACCEPTED,IN_PRODUCTION,READY" className="stat-card"><span className="n">{(c.ACCEPTED || 0) + (c.IN_PRODUCTION || 0) + (c.READY || 0)}</span><span className="l">Being made or ready</span></Link>
        <div className="stat-card"><span className="n" style={{ fontSize: 24 }}>{inr(data.revenue30.paise)}</span><span className="l">Collected in 30 days · {data.revenue30.payments} payments</span></div>
      </div>
      <div>
        <div className="row between" style={{ marginBottom: 10 }}><h3>Recent activity</h3><Link to="/staff/quotes" className="btn btn-ghost btn-sm">All quotes <Icon name="right" size={14} /></Link></div>
        {data.recent.length === 0 ? <div className="panel"><Empty icon="list" title="No requests yet">Share the design studio link with customers to get started.</Empty></div> : (
          <div className="table-wrap"><table className="list"><thead><tr><th></th><th>Ref</th><th>Customer</th><th>Piece</th><th>Status</th><th>Total</th><th>Updated</th></tr></thead>
            <tbody>{data.recent.map((q) => (
              <tr key={q.id} className="click" onClick={() => navigate(`/staff/quotes/${q.ref}`)}>
                <td style={{ width: 52 }}>{q.design?.previewPath ? <img className="thumb" src={q.design.previewPath} alt="" /> : <span className="thumb" />}</td>
                <td className="mono">{q.ref}</td><td>{q.customerName}<div className="hint">{q.city}</div></td><td>{title(q.design?.pieceType)}<div className="hint">{metalLabel(q.design?.metal)}</div></td>
                <td><StatusBadge status={q.status} /></td><td className="mono">{q.total ? inr(q.total) : '—'}</td><td className="hint">{ago(q.updatedAt)}</td>
              </tr>))}</tbody></table></div>
        )}
      </div>
    </div>
  );
}
