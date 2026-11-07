import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, permissions: {} });
  const refresh = useCallback(async () => {
    try { const r = await api.get('/api/auth/me'); setState({ loading: false, user: r.user, permissions: r.permissions }); }
    catch { setState({ loading: false, user: null, permissions: {} }); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = useCallback(async (email, password) => { const r = await api.post('/api/auth/login', { email, password }); setState({ loading: false, user: r.user, permissions: r.permissions }); return r.user; }, []);
  const logout = useCallback(async () => { await api.post('/api/auth/logout'); setState({ loading: false, user: null, permissions: {} }); }, []);
  const value = useMemo(() => ({
    ...state, login, logout, refresh,
    can: (perm) => !!state.user && (state.permissions[perm] || []).includes(state.user.role),
  }), [state, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
