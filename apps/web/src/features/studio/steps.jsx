import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PIECE_TYPES, METALS, STONES } from '@clelia/engine';
import { api } from '../../lib/api.js';
import { Field, Icon, PriceTable } from '../../components/ui.jsx';
import { grams, metalLabel, title } from '../../lib/format.js';

const PIECE_GLYPH = {
  ring: <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="24" cy="28" r="13" /><circle cx="24" cy="28" r="8" /><path d="M24 9l5 5-5 5-5-5z" fill="currentColor" stroke="none" /></svg>,
  pendant: <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6c8 10 10 16 18 16s10-6 18-16" /><circle cx="24" cy="23" r="3" /><path d="M24 26v3l-8 8 8 7 8-7-8-8" /></svg>,
  earrings: <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 6v8M34 6v8" /><circle cx="14" cy="24" r="8" /><circle cx="34" cy="24" r="8" /><path d="M14 32v6M34 32v6" /></svg>,
  bracelet: <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><ellipse cx="24" cy="26" rx="18" ry="11" /><ellipse cx="24" cy="26" rx="13" ry="7" /><circle cx="24" cy="15" r="2.5" fill="currentColor" stroke="none" /></svg>,
  bangle: <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="24" cy="24" r="18" /><circle cx="24" cy="24" r="12" /></svg>,
  chain: <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 10c6 14 12 14 18 14s12 0 18 14" /><ellipse cx="12" cy="14" rx="3.5" ry="2.5" /><ellipse cx="24" cy="24" rx="3.5" ry="2.5" /><ellipse cx="36" cy="34" rx="3.5" ry="2.5" /></svg>,
  'cuban-chain': <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.6"><rect x="4" y="18" width="14" height="12" rx="6" /><rect x="14" y="18" width="14" height="12" rx="6" /><rect x="24" y="18" width="14" height="12" rx="6" /><rect x="34" y="18" width="12" height="12" rx="6" /></svg>,
  grillz: <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 20c6-6 30-6 36 0v6c-6 6-30 6-36 0z" /><path d="M13 17v12M20 15v16M28 15v16M35 17v12" /></svg>,
  'nose-pin': <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M24 40c-8-6-8-14-8-20" /><circle cx="24" cy="12" r="4" fill="currentColor" stroke="none" /><path d="M24 16v8" /></svg>,
};
const PIECE_HINT = { ring: 'Bands, solitaires, halos', pendant: 'Hearts, discs, teardrops', earrings: 'Studs, hoops, drops', bracelet: 'Links, tennis, cuffs', bangle: 'Plain, faceted, dotted', chain: 'Curb, rope, box, figaro', 'cuban-chain': 'Miami cuban, pavé top', grillz: 'Caps, open-face, pavé', 'nose-pin': 'Studs, L-pins, rings' };

export function PieceStep({ spec, update, brand, content }) {
  const pieces = PIECE_TYPES.filter((p) => (brand === 'SCORPLING' ? true : true));
  const sorted = brand === 'SCORPLING' ? [...pieces].sort((a, b) => (a.group === 'iced' ? -1 : 1) - (b.group === 'iced' ? -1 : 1)) : pieces;
  return (
    <div className="stack-lg">
      <div className="hero">
        <span className="eyebrow">{brand === 'SCORPLING' ? 'Scorpling · iced-out jewellery' : 'Made to order'}</span>
        <h1>{brand === 'SCORPLING' ? 'Design it. See it. Wear it.' : content?.studioTitle || 'Design your own piece'}</h1>
        <p style={{ fontSize: 17, color: 'var(--ink-2)' }}>{brand === 'SCORPLING' ? content?.scorplingIntro : content?.studioIntro}</p>
      </div>
      <div>
        <h3 style={{ marginBottom: 12 }}>What are we making?</h3>
        <div className="tile-grid">
          {sorted.map((p) => (
            <button type="button" key={p.id} className={`tile ${spec.pieceType === p.id ? 'active' : ''}`} onClick={() => update({ pieceType: p.id, params: null })}>
              {p.group === 'iced' && <span className="tag">Iced</span>}
              <span className="glyph">{PIECE_GLYPH[p.id]}</span>
              <strong>{p.label}</strong>
              <small>{PIECE_HINT[p.id]}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PROMPT_IDEAS = {
  ring: ['A thin twisted band with a small oval emerald', 'Wide comfort-fit band, brushed, with five tiny diamonds', 'Classic solitaire with a 5 mm stone and a halo'],
  pendant: ['A small heart with a pavé border and a single ruby in the centre', 'Plain polished disc, 16 mm, with my initial engraved'],
  earrings: ['Simple 12 mm hoops, slightly thick', 'Teardrop studs with a sapphire'],
  bracelet: ['Delicate tennis bracelet with small lab diamonds', 'Chunky curb link bracelet, 8 mm'],
  bangle: ['Slim faceted bangle, size 2.6', 'Bold 12 mm plain bangle with a dotted edge'],
  chain: ['Rope chain, 20 inches, medium thickness', 'Thin box chain for a pendant'],
  'cuban-chain': ['12 mm Miami cuban, fully iced on top, 20 inches', 'Clean 8 mm cuban, no stones, heavy'],
  grillz: ['Six teeth top grill, open face on the two front teeth, iced', 'Four teeth bottom grill, plain polished'],
  'nose-pin': ['Tiny 2 mm diamond stud', 'Small L-shaped pin with a ruby'],
};

export function DescribeStep({ spec, update, brand, refFiles, setRefFiles, errors, metals, stones }) {
  const fileInput = useRef(null);
  const metalList = METALS.filter((m) => !metals || metals.includes(m.id));
  const stoneList = STONES.filter((s) => !stones || stones.includes(s.id));
  const [previews, setPreviews] = useState([]);
  useEffect(() => { const urls = refFiles.map((f) => URL.createObjectURL(f)); setPreviews(urls); return () => urls.forEach((u) => URL.revokeObjectURL(u)); }, [refFiles]);
  const piece = PIECE_TYPES.find((p) => p.id === spec.pieceType);
  return (
    <div className="design-layout">
      <div className="stack">
        <div>
          <span className="eyebrow">Step 2</span>
          <h2>Describe your {piece?.label.toLowerCase()}</h2>
          <p className="muted" style={{ marginTop: 6 }}>Write it the way you'd tell a jeweller. Shape, thickness, stones, feel. We turn it into a 3D design on the next step.</p>
        </div>
        <Field id="prompt" error={errors.prompt}>
          <textarea id="prompt" className={`textarea ${errors.prompt ? 'error' : ''}`} rows={4} maxLength={600} placeholder={PROMPT_IDEAS[spec.pieceType]?.[0]} value={spec.prompt} onChange={(e) => update({ prompt: e.target.value })} />
          <div className="row between"><span className="hint">{spec.prompt.length}/600</span></div>
        </Field>
        <div className="chips">
          {(PROMPT_IDEAS[spec.pieceType] || []).map((t) => <button key={t} type="button" className="chip" onClick={() => update({ prompt: t })}>{t}</button>)}
        </div>
        <div className="grid-2">
          <Field id="metal" label="Metal">
            <select id="metal" className="select" value={spec.metal} onChange={(e) => update({ metal: e.target.value })}>
              {metalList.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Field id="stone" label="Stones" hint={brand === 'SCORPLING' ? 'CZ and moissanite give the iced look at a friendlier price.' : undefined}>
            <select id="stone" className="select" value={spec.stone} onChange={(e) => update({ stone: e.target.value })}>
              {stoneList.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="stack-sm">
          <label style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)' }}>Reference photos <span className="muted">(optional, up to 4)</span></label>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => setRefFiles([...refFiles, ...Array.from(e.target.files || [])].slice(0, 4))} />
          <div className="refs">
            {previews.map((u, i) => <div key={u} style={{ position: 'relative' }}><img src={u} alt="" /><button type="button" className="icon-btn" style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24 }} onClick={() => setRefFiles(refFiles.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="x" size={12} /></button></div>)}
            {refFiles.length < 4 && <button type="button" className="drop" style={{ width: previews.length ? 64 : '100%', height: previews.length ? 64 : 'auto', padding: previews.length ? 0 : 16 }} onClick={() => fileInput.current.click()}>{previews.length ? <Icon name="plus" /> : <><Icon name="camera" /> Add a photo of something you like</>}</button>}
          </div>
        </div>
      </div>
      <aside className="panel stack">
        <h4>How it works</h4>
        <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)', fontSize: 14.5, display: 'grid', gap: 8 }}>
          <li>We build your piece in 3D at real size. Turn it, resize it, see it in your room.</li>
          <li>Send it to us. Our designers refine it and a manager approves a clear, itemised price.</li>
          <li>Pay an advance to start. Your piece is 3D-printed, cast and finished by hand.</li>
        </ol>
        <p className="hint">No payment is taken at this stage.</p>
      </aside>
    </div>
  );
}

export function DetailsStep({ details, setDetails, errors }) {
  const set = (k) => (e) => setDetails({ ...details, [k]: e.target.value });
  const [pinInfo, setPinInfo] = useState(null);
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(details.pincode)) return setPinInfo(null);
    let dead = false;
    api.get(`/api/pincode/${details.pincode}`).then((r) => {
      if (dead) return; setPinInfo(r);
      if (r.valid !== false) setDetails((d) => ({ ...d, city: d.city || r.city || '', state: d.state || r.state || '' }));
    }).catch(() => {});
    return () => { dead = true; };
  }, [details.pincode]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="design-layout">
      <div className="stack">
        <div><span className="eyebrow">Step 4</span><h2>Where should we reach you?</h2><p className="muted" style={{ marginTop: 6 }}>We'll send your quote on WhatsApp or email, and ship to this address.</p></div>
        <div className="form-grid">
          <Field id="name" label="Your name" error={errors.customerName}><input id="name" className={`input ${errors.customerName ? 'error' : ''}`} autoComplete="name" value={details.customerName} onChange={set('customerName')} /></Field>
          <Field id="phone" label="Mobile (WhatsApp)" error={errors.phone}><input id="phone" className={`input ${errors.phone ? 'error' : ''}`} inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={details.phone} onChange={set('phone')} /></Field>
          <Field id="email" label="Email (optional)" error={errors.email}><input id="email" className="input" type="email" autoComplete="email" value={details.email} onChange={set('email')} /></Field>
          <Field id="pincode" label="PIN code" error={errors.pincode} hint={pinInfo?.valid === false ? 'We could not find this PIN code' : pinInfo?.areas?.length ? `${pinInfo.areas.slice(0, 3).join(', ')}…` : undefined}><input id="pincode" className={`input ${errors.pincode ? 'error' : ''}`} inputMode="numeric" maxLength={6} autoComplete="postal-code" value={details.pincode} onChange={(e) => setDetails({ ...details, pincode: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field id="address1" label="Address" error={errors.address1}><input id="address1" className={`input ${errors.address1 ? 'error' : ''}`} autoComplete="address-line1" placeholder="Flat / house, street" value={details.address1} onChange={set('address1')} /></Field>
          <Field id="address2" label="Landmark / area (optional)"><input id="address2" className="input" autoComplete="address-line2" value={details.address2} onChange={set('address2')} /></Field>
          <Field id="city" label="City / district" error={errors.city}><input id="city" className={`input ${errors.city ? 'error' : ''}`} autoComplete="address-level2" value={details.city} onChange={set('city')} /></Field>
          <Field id="state" label="State" error={errors.state}><input id="state" className={`input ${errors.state ? 'error' : ''}`} autoComplete="address-level1" value={details.state} onChange={set('state')} /></Field>
          <div className="span-2"><Field id="notes" label="Anything else? (optional)" hint="Occasion, date you need it by, engraving text, ring size if you know it."><textarea id="notes" className="textarea" rows={3} maxLength={600} value={details.customerNotes} onChange={set('customerNotes')} /></Field></div>
        </div>
      </div>
      <aside className="panel stack"><h4>Your privacy</h4><p className="hint">We use these details only to prepare your quote and deliver your piece. No marketing lists.</p></aside>
    </div>
  );
}

export function ReviewStep({ spec, built, design, details, content, brand }) {
  const piece = PIECE_TYPES.find((p) => p.id === spec.pieceType);
  return (
    <div className="design-layout">
      <div className="stack">
        <div><span className="eyebrow">Step 5</span><h2>Check and send</h2></div>
        <div className="panel stack">
          <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
            {design?.previewPath && <img src={design.previewPath} alt="" style={{ width: 140, height: 140, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface-2)' }} />}
            <div className="stack-sm" style={{ flex: 1, minWidth: 200 }}>
              <h3>{piece?.label} · {metalLabel(spec.metal)}</h3>
              <p style={{ color: 'var(--ink-2)' }}>{built?.summary}</p>
              <p className="hint">Approx. {grams(built?.weightG)} of metal · {spec.stone !== 'none' ? `${built?.stoneCount || 0} × ${title(spec.stone)}` : 'no stones'}</p>
              <p style={{ fontStyle: 'italic', color: 'var(--ink-2)' }}>“{spec.prompt}”</p>
            </div>
          </div>
          {design?.aiImages?.length > 0 && <div className="ai-grid">{design.aiImages.slice(-3).map((im) => <img key={im.url} src={im.url} alt="" />)}</div>}
        </div>
        <div className="panel">
          <dl className="kv">
            <dt>Name</dt><dd>{details.customerName}</dd>
            <dt>Mobile</dt><dd>{details.phone}</dd>
            {details.email && <><dt>Email</dt><dd>{details.email}</dd></>}
            <dt>Address</dt><dd>{details.address1}{details.address2 ? `, ${details.address2}` : ''}, {details.city}, {details.state} – {details.pincode}</dd>
            {details.customerNotes && <><dt>Notes</dt><dd>{details.customerNotes}</dd></>}
          </dl>
        </div>
      </div>
      <aside className="panel stack">
        <h4>What happens next</h4>
        <p style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>Our team reviews the design and metal weight, prices it at the day's rate and a manager approves it. You'll get a link to see the itemised quote, usually within one working day.</p>
        <p className="hint">{content?.termsNote}</p>
        <p className="hint">Typical making time: {content?.leadTimeDays || '14–21'} days after the advance.</p>
      </aside>
    </div>
  );
}

export function DoneStep({ result, details, content, brand, onNew }) {
  const url = result?.trackUrl || `${location.origin}/track/${result?.ref}?t=${result?.token}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`My ${brand === 'SCORPLING' ? 'Scorpling' : 'Clelia & Co.'} design request ${result?.ref}: ${url}`)}`;
  return (
    <div className="panel stack" style={{ maxWidth: 640, margin: '20px auto', textAlign: 'center', justifyItems: 'center' }}>
      <span className="avatar" style={{ width: 56, height: 56, background: 'var(--ok-soft)', color: 'var(--ok)' }}><Icon name="check" size={26} /></span>
      <h2>Request received</h2>
      <p style={{ color: 'var(--ink-2)' }}>Thank you, {details.customerName.split(' ')[0]}. Your reference is</p>
      <div className="mono" style={{ fontSize: 26, color: 'var(--wine)' }}>{result?.ref}</div>
      <p className="hint">Save this link to see your quote and pay the advance when it's ready:</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <a className="btn btn-primary" href={url}>Open my request</a>
        <button type="button" className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(url)}><Icon name="share" size={16} /> Copy link</button>
        <a className="btn btn-secondary" href={wa} target="_blank" rel="noreferrer">Send to WhatsApp</a>
      </div>
      <p className="hint">We'll also message {details.phone}{details.email ? ` and ${details.email}` : ''}. Questions? {content?.supportEmail}</p>
      <button type="button" className="btn btn-ghost" onClick={onNew}>Design another piece</button>
    </div>
  );
}
