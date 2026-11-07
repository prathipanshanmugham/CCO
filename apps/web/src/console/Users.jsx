import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, fieldErrors } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { ErrorBox, Field, Icon, Modal, useToast, initials } from '../components/ui.jsx';
import { dateTime, title } from '../lib/format.js';
import { NoAccess } from './Layout.jsx';

const ROLES = [
  { id: 'STAFF', label: 'Staff', desc: 'Reviews requests, prepares prices, updates production. Cannot approve quotes.' },
  { id: 'MANAGER', label: 'Manager', desc: 'Everything staff can do, plus approve quotes, assign work, record payments and view AI usage.' },
  { id: 'ADMIN', label: 'Admin', desc: 'Full access: users, pricing, content and AI keys.' },
];

export default function UsersPage() {
  const { can, user: me } = useOutletContext();
  const toast = useToast();
  const { data: users, error, reload, setData } = useApi(() => api.get('/api/admin/users'), []);
  const [edit, setEdit] = useState(null);
  if (!can('users.manage')) return <NoAccess what="Users & roles" />;
  const save = async (form) => {
    try {
      const body = { ...form }; if (!body.password) delete body.password;
      const saved = edit.id ? await api.patch(`/api/admin/users/${edit.id}`, body) : await api.post('/api/admin/users', body);
      setData(edit.id ? users.map((u) => (u.id === saved.id ? saved : u)) : [...users, saved]); setEdit(null); toast('Saved');
    } catch (e) { const fe = fieldErrors(e); throw Object.keys(fe).length ? fe : { _: e.message }; }
  };
  return (
    <div className="stack">
      <div className="page-head"><div><h1 style={{ fontSize: 32 }}>Users &amp; roles</h1><span className="hint">New people get a first password and must change it when they sign in.</span></div><button type="button" className="btn btn-primary" onClick={() => setEdit({ name: '', email: '', phone: '', role: 'STAFF', password: '' })}><Icon name="plus" size={16} /> Add person</button></div>
      <ErrorBox error={error} retry={reload} />
      <div className="grid-2">{ROLES.map((r) => <div key={r.id} className="panel tight"><strong>{r.label}</strong><p className="hint">{r.desc}</p></div>)}</div>
      {users && <div className="table-wrap"><table className="list"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>
        {users.map((u) => (
          <tr key={u.id}><td><div className="row" style={{ gap: 10 }}><span className="avatar">{initials(u.name)}</span><div>{u.name}{u.id === me.id && <span className="hint"> (you)</span>}<div className="hint">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div></div></div></td>
            <td><span className="badge plain tone-accent">{title(u.role)}</span></td><td>{u.active ? <span className="badge tone-ok">Active</span> : <span className="badge tone-bad">Disabled</span>}{u.mustChangePw && <div className="hint">must change password</div>}</td><td className="hint">{u.lastLoginAt ? dateTime(u.lastLoginAt) : 'never'}</td>
            <td style={{ textAlign: 'right' }}><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...u, password: '' })}>Edit</button></td></tr>))}
      </tbody></table></div>}
      {edit && <UserModal user={edit} me={me} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function UserModal({ user, me, onClose, onSave }) {
  const [f, setF] = useState(user); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErrs({}); try { await onSave({ name: f.name, email: f.email, phone: f.phone || '', role: f.role, password: f.password, ...(user.id ? { active: f.active } : {}) }); } catch (er) { setErrs(er); } finally { setBusy(false); } };
  return (
    <Modal title={user.id ? `Edit ${user.name}` : 'Add a person'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {errs._ && <p className="error">{errs._}</p>}
        <div className="form-grid">
          <Field id="n" label="Name" error={errs.name}><input id="n" className="input" value={f.name} onChange={set('name')} required /></Field>
          <Field id="e" label="Work email" error={errs.email}><input id="e" className="input" type="email" value={f.email} onChange={set('email')} required /></Field>
          <Field id="p" label="Phone (optional)"><input id="p" className="input" value={f.phone || ''} onChange={set('phone')} /></Field>
          <Field id="r" label="Role"><select id="r" className="select" value={f.role} onChange={set('role')} disabled={user.id === me.id}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
          <div className="span-2"><Field id="pw" label={user.id ? 'Reset password (leave blank to keep)' : 'First password'} hint="At least 8 characters. They will be asked to change it." error={errs.password}><input id="pw" className="input" type="text" autoComplete="new-password" value={f.password} onChange={set('password')} minLength={8} required={!user.id} /></Field></div>
          {user.id && user.id !== me.id && <label className="check span-2"><input type="checkbox" checked={f.active} onChange={set('active')} /> Active (untick to disable sign-in without deleting history)</label>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
