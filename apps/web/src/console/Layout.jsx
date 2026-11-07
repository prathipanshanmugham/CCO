import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { Brand, Icon, initials, Field, useToast, Modal } from '../components/ui.jsx';

const ROLE_LABEL = { STAFF: 'Staff', MANAGER: 'Manager', ADMIN: 'Admin' };
const NAV = [
  { to: '/staff', label: 'Dashboard', icon: 'dashboard', perm: 'quotes.view', end: true },
  { to: '/staff/quotes', label: 'Quotes', icon: 'list', perm: 'quotes.view', badge: true },
  { to: '/staff/ai', label: 'AI images', icon: 'cpu', perm: 'ai.view' },
  { to: '/staff/users', label: 'Users & roles', icon: 'users', perm: 'users.manage' },
  { to: '/staff/settings', label: 'Pricing & content', icon: 'settings', perm: 'settings.view' },
];

export function LoginPage() {
  const { user, login, loading } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (loading) return null;
  if (user) return <Navigate to="/staff" replace />;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(email.trim(), password); navigate('/staff'); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login-card">
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}><Brand stacked /><span className="eyebrow">Studio console</span></div>
        <form className="panel stack" onSubmit={submit}>
          <h2 style={{ fontSize: 24 }}>Sign in</h2>
          <Field id="email" label="Work email"><input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field id="password" label="Password">
            <div style={{ position: 'relative' }}>
              <input id="password" className="input" style={{ paddingRight: 44 }} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="icon-btn" style={{ position: 'absolute', right: 4, top: 4, border: 0, width: 32, height: 32 }} onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeOff' : 'eye'} size={16} /></button>
            </div>
          </Field>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <Link to="/" className="muted" style={{ textAlign: 'center', fontSize: 14 }}>← Back to the design studio</Link>
      </div>
    </div>
  );
}

export function ConsoleLayout() {
  const { user, loading, logout, can, refresh } = useSession();
  const navigate = useNavigate();
  const { data: dash } = useApi(() => (user ? api.get('/api/staff/dashboard') : null), [user?.id]);
  const [pwOpen, setPwOpen] = useState(false);
  if (loading) return <div className="login"><span className="spin" /></div>;
  if (!user) return <Navigate to="/staff/login" replace />;
  const items = NAV.filter((n) => can(n.perm));
  const pending = (dash?.needsAction?.newRequests || 0) + (can('quotes.approve') ? dash?.needsAction?.awaitingApproval || 0 : 0) + (dash?.needsAction?.mine || 0);
  const signOut = async () => { await logout(); navigate('/staff/login'); };
  return (
    <div className="console">
      <aside className="sidebar">
        <Link to="/staff" style={{ textDecoration: 'none' }}><Brand stacked sub="Studio console" /></Link>
        <nav className="nav" aria-label="Console">
          {items.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={n.icon} /> {n.label}{n.badge && pending > 0 && <span className="count">{pending}</span>}</NavLink>)}
        </nav>
        <div className="sidebar-foot">
          <Link to="/" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}><Icon name="spark" size={16} /> Open customer studio</Link>
          <div className="me">
            <span className="avatar">{initials(user.name)}</span>
            <div style={{ minWidth: 0, flex: 1 }}><div className="me-name">{user.name}</div><button type="button" className="hint" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setPwOpen(true)}>{ROLE_LABEL[user.role]} · password</button></div>
            <button type="button" className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-bar"><Brand /><div className="row"><span className="badge tone-accent plain">{ROLE_LABEL[user.role]}</span><button type="button" className="icon-btn" onClick={signOut} aria-label="Sign out"><Icon name="logout" size={16} /></button></div></div>
        <nav className="mobile-nav">{items.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}{n.badge && pending > 0 ? ` (${pending})` : ''}</NavLink>)}</nav>
        <main className="work">
          {user.mustChangePw && <div className="banner warn" style={{ marginBottom: 18 }}><span><Icon name="lock" size={16} /> Please set your own password before you continue.</span><button type="button" className="btn btn-sm btn-primary" onClick={() => setPwOpen(true)}>Change password</button></div>}
          <Outlet context={{ user, can }} />
        </main>
      </div>
      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} onDone={refresh} />}
    </div>
  );
}

function ChangePassword({ onClose, onDone }) {
  const toast = useToast();
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState(''); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (next.length < 8) return setErr('Use at least 8 characters');
    if (next !== again) return setErr('The two new passwords do not match');
    try { await api.post('/api/auth/change-password', { current: cur, next }); toast('Password updated'); await onDone(); onClose(); } catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal title="Change password" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field id="cur" label="Current password"><input id="cur" className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
        <Field id="next" label="New password" hint="At least 8 characters"><input id="next" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <Field id="again" label="Repeat new password"><input id="again" className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></Field>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary">Save password</button>
      </form>
    </Modal>
  );
}

export function NoAccess({ what = 'this page' }) {
  return <div className="panel empty"><Icon name="lock" size={26} /><strong>Your role can't open {what}.</strong><span>Ask an admin if you need access.</span></div>;
}
