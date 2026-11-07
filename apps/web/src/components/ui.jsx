import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import monogram from '../monogram.png';
import wordmark from '../wordmark.png';
import { STATUS_LABELS, STATUS_TONE } from '../lib/format.js';

export function Brand({ stacked, sub, brand = 'CLELIA' }) {
  if (brand === 'SCORPLING') {
    return <span className={`brand ${stacked ? 'stacked' : ''}`}><span className="scorpling-word">Scorpling<small>by Clelia &amp; Co.</small></span>{sub && <span className="sub">{sub}</span>}</span>;
  }
  return (
    <span className={`brand ${stacked ? 'stacked' : ''}`}>
      <span className="mark" style={{ '--m': `url(${monogram})` }} aria-hidden />
      <span className="sep" aria-hidden />
      <span className="word" style={{ '--m': `url(${wordmark})` }} role="img" aria-label="Clelia & Co." />
      {sub && <span className="sub">{sub}</span>}
    </span>
  );
}

export const initials = (name = '') => name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const ICONS = {
  ring: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z M12 2l2 2-2 2-2-2z',
  spark: 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  cube: 'M12 2 3 7v10l9 5 9-5V7zm0 2.3L18.6 8 12 11.7 5.4 8zM5 9.6l6 3.4v6.6l-6-3.3zm8 10v-6.6l6-3.4v6.7z',
  camera: 'M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
  check: 'M20 6 9 17l-5-5 1.4-1.4L9 14.2 18.6 4.6z',
  right: 'M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z',
  left: 'M15 5l-7 7 7 7 1.4-1.4L10.8 12l5.6-5.6z',
  download: 'M12 3v11l4-4 1.4 1.4L12 17.8 6.6 11.4 8 10l3 3V3zM4 19h16v2H4z',
  upload: 'M12 21V10l-4 4-1.4-1.4L12 6.2l5.4 6.4L16 14l-3-3v10zM4 3h16v2H4z',
  dashboard: 'M3 3h8v8H3zm10 0h8v5h-8zM3 13h8v8H3zm10-3h8v11h-8z',
  list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z',
  users: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v3h10v-3c0-1 .4-1.9 1.1-2.7C10 13.4 9 13 8 13zm8 0c-.4 0-.8 0-1.2.1 1.3.9 2.2 2.2 2.2 3.9v3h7v-3c0-2.7-5.3-4-8-4z',
  settings: 'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3H9l-.4 2.9c-.6.2-1.2.6-1.7 1l-2.5-1-2 3.5L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.8 1.7 1L9 21h6l.4-2.9c.6-.2 1.2-.6 1.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  cpu: 'M9 2h2v3h2V2h2v3h3a2 2 0 0 1 2 2v3h3v2h-3v2h3v2h-3v3a2 2 0 0 1-2 2h-3v3h-2v-3h-2v3H9v-3H6a2 2 0 0 1-2-2v-3H1v-2h3v-2H1v-2h3V7a2 2 0 0 1 2-2h3zm-1 7v6h8V9z',
  logout: 'M10 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8v-2h8V5h-8zm-1 4 5 5-5 5-1.4-1.4L10.2 13H2v-2h8.2L7.6 8.4z',
  lock: 'M17 9V7A5 5 0 0 0 7 7v2H5v13h14V9zm-8-2a3 3 0 0 1 6 0v2H9zm3 6a1.5 1.5 0 0 1 1 2.6V18h-2v-2.4A1.5 1.5 0 0 1 12 13z',
  eye: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  eyeOff: 'M2.4 3.8 3.8 2.4l17.8 17.8-1.4 1.4-3.2-3.2A11 11 0 0 1 12 19C6 19 2 12 2 12a19 19 0 0 1 4.5-5.1zM12 5c6 0 10 7 10 7a18 18 0 0 1-3 3.9L9.1 5.9A10 10 0 0 1 12 5zm0 3a4 4 0 0 1 3.6 5.7l-5.3-5.3A4 4 0 0 1 12 8z',
  x: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z',
  plus: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z',
  phone: 'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.1.4 2.3.6 3.6.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.3 1z',
  ar: 'M12 2 3 6.5v11L12 22l9-4.5v-11zm0 2.2 6.5 3.3L12 10.8 5.5 7.5zM5 9.2l6 3v7.4l-6-3zm8 10.4v-7.4l6-3v7.4z',
  share: 'M18 16a3 3 0 0 0-2.1.9L8.9 13a3 3 0 0 0 0-2l7-3.9A3 3 0 1 0 15 5l.1.9-7 3.9a3 3 0 1 0 0 4.4l7 4a3 3 0 1 0 2.9-2.2z',
  warn: 'M12 2 1 21h22zm1 15h-2v-2h2zm0-4h-2V9h2z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z',
  trash: 'M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z',
  refresh: 'M12 5a7 7 0 0 1 6.3 4H16v2h6V5h-2v2.3A9 9 0 1 0 21 13h-2a7 7 0 1 1-7-8z',
  wallet: 'M3 6a2 2 0 0 1 2-2h14v3H5a1 1 0 0 0 0 2h16v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm13 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zm-9-2.7L17.9 8 12 11.3 6.1 8zM5 9.7l6 3.3v6.3l-6-3.3zm8 9.6v-6.3l6-3.3v6.3z',
  rupee: 'M7 4h10v2h-3.2c.6.6 1 1.3 1.1 2H17v2h-2.1c-.4 2.6-2.5 4.4-5.4 4.6L15 20h-2.8l-5.6-5.6V13h2c2 0 3.2-.9 3.6-2.4H7V8.6h5.1C11.7 7.6 10.6 7 9.1 7H7z',
};

export function Icon({ name, size = 18, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flex: 'none', ...style }}><path d={ICONS[name] || ICONS.info} /></svg>;
}

export function Field({ id, label, hint, error, children }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <span className="error">{Array.isArray(error) ? error[0] : error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_TONE[status] || ''}`}>{STATUS_LABELS[status] || status}</span>;
}

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between"><h3>{title}</h3>{onClose && <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>}</div>
        {children}
        {footer && <div className="row" style={{ justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Lightbox({ src, onClose }) {
  if (!src) return null;
  return <div className="lightbox" onClick={onClose}><img src={src} alt="" /></div>;
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone) => {
    const id = Math.random();
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.tone || ''}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Empty({ icon = 'info', title, children }) {
  return <div className="empty"><Icon name={icon} size={28} /><strong style={{ color: 'var(--ink)' }}>{title}</strong>{children}</div>;
}

export function Spinner() { return <span className="spin" aria-label="Loading" />; }

export function ErrorBox({ error, retry }) {
  if (!error) return null;
  return <div className="banner bad"><span><Icon name="warn" size={16} /> {error.message || String(error)}</span>{retry && <button type="button" className="btn btn-sm btn-secondary" onClick={retry}>Try again</button>}</div>;
}

export function PriceTable({ breakdown }) {
  if (!breakdown?.lines) return null;
  return (
    <table className="price">
      <tbody>
        {breakdown.lines.map((l) => <tr key={l.key}><td>{l.label}</td><td>{l.amount < 0 ? '−' : ''}₹{Math.abs(l.amount).toLocaleString('en-IN')}</td></tr>)}
        <tr className="sub"><td>Subtotal</td><td>₹{breakdown.subtotal.toLocaleString('en-IN')}</td></tr>
        <tr className="sub"><td>GST {breakdown.gstPercent}%</td><td>₹{breakdown.gst.toLocaleString('en-IN')}</td></tr>
        <tr className="total"><td>Total</td><td>₹{breakdown.total.toLocaleString('en-IN')}</td></tr>
      </tbody>
    </table>
  );
}

export function Timeline({ items = [], current }) {
  return (
    <div className="timeline">
      {items.map((t, i) => (
        <div key={i} className={`t ${t.status === current && i === items.length - 1 ? 'now' : ''}`}>
          <strong>{t.label || STATUS_LABELS[t.status] || t.status}</strong>
          {t.note && <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{t.note} </span>}
          <small>{new Date(t.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}{t.by && t.by !== 'customer' ? ` · ${t.by}` : ''}</small>
        </div>
      ))}
    </div>
  );
}
