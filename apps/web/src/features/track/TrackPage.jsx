import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { Brand, Icon, PriceTable, StatusBadge, Timeline, ErrorBox, Modal, Lightbox, useToast } from '../../components/ui.jsx';
import { ARModal } from '../../components/ARViewer.jsx';
import { inr, date, grams, metalLabel, title } from '../../lib/format.js';

export function TrackLookup() {
  const [ref, setRef] = useState(''); const [phone, setPhone] = useState('');
  const navigate = useNavigate();
  return (
    <div className="login">
      <div className="login-card">
        <Link to="/" style={{ justifySelf: 'center' }}><Brand stacked /></Link>
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); navigate(`/track/${ref.trim().toUpperCase()}?phone=${phone.replace(/\D/g, '')}`); }}>
          <h2 style={{ fontSize: 24 }}>Track a request</h2>
          <div className="field"><label htmlFor="ref">Reference</label><input id="ref" className="input mono" placeholder="CLC-2611-0123" value={ref} onChange={(e) => setRef(e.target.value)} required /></div>
          <div className="field"><label htmlFor="ph">Mobile number used</label><input id="ph" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
          <button className="btn btn-primary btn-block">Show my request</button>
          <p className="hint">The link we sent you opens the request directly, without this form.</p>
        </form>
      </div>
    </div>
  );
}

let rzpLoading;
const loadRazorpay = () => rzpLoading ||= new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve();
  const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = resolve; s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.')); document.body.appendChild(s);
});

export default function TrackPage() {
  const { ref } = useParams();
  const [sp] = useSearchParams();
  const toast = useToast();
  const auth = sp.get('t') ? `t=${encodeURIComponent(sp.get('t'))}` : `phone=${encodeURIComponent(sp.get('phone') || '')}`;
  const { data: q, error, loading, reload, setData } = useApi(() => api.get(`/api/track/${ref}?${auth}`), [ref, auth]);
  const [confirm, setConfirm] = useState(null);
  const [paying, setPaying] = useState(false);
  const [ar, setAr] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  useEffect(() => { document.documentElement.dataset.brand = q?.brand === 'SCORPLING' ? 'scorpling' : ''; return () => { document.documentElement.dataset.brand = ''; }; }, [q?.brand]);

  const act = async (action, body) => {
    try { setData(await api.post(`/api/track/${ref}/${action}?${auth}`, body)); setConfirm(null); }
    catch (e) { toast(e.message, 'bad'); }
  };

  const pay = async (kind) => {
    setPaying(true);
    try {
      await loadRazorpay();
      const order = await api.post(`/api/track/${ref}/pay?${auth}`, { kind });
      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId, name: q.brand === 'SCORPLING' ? 'Scorpling' : 'Clelia & Co.', description: order.description,
          prefill: order.prefill, theme: { color: q.brand === 'SCORPLING' ? '#111113' : '#660033' },
          handler: async (resp) => { try { setData(await api.post(`/api/track/${ref}/pay/verify?${auth}`, resp)); toast('Payment received. Thank you!'); } catch (e) { toast(e.message, 'bad'); } resolve(); },
          modal: { ondismiss: resolve },
        });
        rzp.on('payment.failed', (r) => toast(r.error?.description || 'Payment failed', 'bad'));
        rzp.open();
      });
    } catch (e) { toast(e.message, 'bad'); }
    finally { setPaying(false); }
  };

  if (loading) return <div className="login"><span className="spin" /></div>;
  if (error) return <div className="login"><div className="login-card"><Brand stacked /><ErrorBox error={error} retry={reload} /><Link className="btn btn-secondary" to="/track">Try another reference</Link></div></div>;

  const d = q.design; const pay$ = q.pay;
  const canAccept = q.status === 'QUOTED';
  const glb = d?.modelFiles?.find((f) => f.ext === '.glb')?.url;
  const expired = q.validUntil && new Date(q.validUntil) < new Date() && q.status === 'QUOTED';

  return (
    <div className="wrap" style={{ paddingBottom: 60 }}>
      <header className="studio-head"><Link to="/" style={{ textDecoration: 'none' }}><Brand brand={q.brand} sub="Your request" /></Link><Link className="btn btn-ghost btn-sm" to="/">Design another piece</Link></header>
      <div className="track-head" style={{ marginBottom: 18 }}>
        <div><span className="eyebrow">Reference</span><h1 className="mono" style={{ fontSize: 30 }}>{q.ref}</h1></div>
        <StatusBadge status={q.status} />
      </div>

      {q.status === 'QUOTED' && !expired && <div className="banner info"><span><Icon name="info" size={16} /> Your quote is ready{q.validUntil ? ` and valid until ${date(q.validUntil)}` : ''}. Accept it and pay the advance to start making your piece.</span></div>}
      {expired && <div className="banner warn"><span><Icon name="warn" size={16} /> This quote has passed its validity date. Metal rates move daily, so message us and we'll refresh it.</span></div>}
      {['ACCEPTED', 'IN_PRODUCTION'].includes(q.status) && pay$?.due > 0 && pay$?.paid > 0 && <div className="banner info"><span>Advance received. The balance of {inr(pay$.due)} is due when your piece is ready.</span></div>}
      {q.status === 'READY' && pay$?.due > 0 && <div className="banner ok"><span><Icon name="check" size={16} /> Your piece is ready! Pay the balance of {inr(pay$.due)} and we'll ship it.</span></div>}
      {q.status === 'DECLINED' && <div className="banner bad"><span>{q.declineReason || 'This request was closed.'}</span></div>}

      <div className="detail-layout">
        <div className="stack">
          <div className="panel stack">
            <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
              {d?.previewPath && <img src={d.previewPath} alt="" style={{ width: 160, height: 160, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface-2)', cursor: 'zoom-in' }} onClick={() => setLightbox(d.previewPath)} />}
              <div className="stack-sm" style={{ flex: 1, minWidth: 220 }}>
                <h3>{title(d?.pieceType)} · {metalLabel(d?.metal)}</h3>
                <p style={{ color: 'var(--ink-2)' }}>{d?.summary}</p>
                <p className="hint">Approx. {grams(q.priceBreakdown?.weightG ?? d?.weightG)} · {d?.stone && d.stone !== 'none' ? title(d.stone) : 'No stones'}</p>
                <p style={{ fontStyle: 'italic', color: 'var(--ink-2)', fontSize: 14.5 }}>“{d?.prompt}”</p>
                {glb && <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => setAr(true)}><Icon name="ar" size={14} /> View in 3D / AR</button></div>}
              </div>
            </div>
            {d?.aiImages?.length > 0 && <div className="ai-grid">{d.aiImages.slice(-3).map((im) => <img key={im.url} src={im.url} alt="" onClick={() => setLightbox(im.url)} />)}</div>}
          </div>

          {q.priceBreakdown && (
            <div className="panel stack">
              <div className="row between"><h3>Your quote</h3>{q.approvalNote && <span className="hint">“{q.approvalNote}”</span>}</div>
              <PriceTable breakdown={q.priceBreakdown} />
              {pay$ && (
                <div className="stack-sm" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 14 }}>
                  <div className="row between"><span>Paid so far</span><strong className="mono">{inr(pay$.paid)}</strong></div>
                  <div className="row between"><span>Balance</span><strong className="mono">{inr(pay$.due)}</strong></div>
                  {q.payments?.map((p, i) => <div key={i} className="hint">{title(p.kind)} · {inr(p.amount)} · {date(p.paidAt)}{p.method ? ` · ${p.method}` : ''}</div>)}
                </div>
              )}
              <div className="row">
                {canAccept && !expired && (pay$ ? (
                  <>
                    <button type="button" className="btn btn-primary btn-lg" onClick={() => pay('ADVANCE')} disabled={paying}>{paying ? <span className="spin" /> : <Icon name="wallet" size={16} />} Accept &amp; pay {q.advancePercent}% advance · {inr(pay$.advance)}</button>
                    {q.advancePercent < 100 && <button type="button" className="btn btn-secondary" onClick={() => pay('FULL')} disabled={paying}>Pay in full · {inr(pay$.total)}</button>}
                  </>
                ) : <button type="button" className="btn btn-primary btn-lg" onClick={() => act('accept')}>Accept this quote</button>)}
                {canAccept && <button type="button" className="btn btn-ghost" onClick={() => setConfirm('decline')}>Not for me</button>}
                {!canAccept && pay$?.nextKind && ['ACCEPTED', 'IN_PRODUCTION', 'READY', 'SHIPPED'].includes(q.status) && <button type="button" className="btn btn-primary" onClick={() => pay(pay$.nextKind)} disabled={paying}>{paying ? <span className="spin" /> : <Icon name="wallet" size={16} />} Pay {pay$.nextKind === 'BALANCE' ? 'balance' : 'advance'} · {inr(pay$.nextAmount)}</button>}
              </div>
              <p className="hint">Payments are processed securely by Razorpay (UPI, cards, net banking). Prices include GST.</p>
            </div>
          )}
          {!q.priceBreakdown && !['DECLINED', 'CANCELLED'].includes(q.status) && <div className="panel"><h3>Quote in progress</h3><p style={{ color: 'var(--ink-2)', marginTop: 6 }}>Our designers are reviewing your piece. You'll see the itemised price here as soon as a manager approves it, and we'll message you.</p></div>}
        </div>

        <aside className="stack">
          <div className="panel stack"><h4>Progress</h4><Timeline items={q.timeline} current={q.status} /></div>
          <div className="panel stack"><h4>Delivery to</h4><p style={{ fontSize: 14.5 }}>{q.customerName}<br />{q.city}, {q.state} – {q.pincode}</p></div>
        </aside>
      </div>

      {confirm === 'decline' && (
        <Modal title="Decline this quote?" onClose={() => setConfirm(null)} footer={<><button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>Keep it</button><button type="button" className="btn btn-danger" onClick={() => act('decline', { reason: document.getElementById('why')?.value })}>Decline</button></>}>
          <p style={{ color: 'var(--ink-2)' }}>Tell us why, if you like. If it's the price or a detail of the design, we're happy to revise it.</p>
          <textarea id="why" className="textarea" rows={3} placeholder="Optional" />
        </Modal>
      )}
      {ar && <ARModal glbUrl={glb} onClose={() => setAr(false)} />}
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
