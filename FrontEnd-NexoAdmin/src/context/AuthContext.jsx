import { createContext, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const revision = useRef(0);
  async function refresh() {
    const current = ++revision.current;
    setLoading(true); setError('');
    try { const data = await api('/auth/me'); if (current === revision.current) setUser(data.user); }
    catch (e) { if (current === revision.current) { setUser(null); if (e.status !== 401) setError(e.message); } }
    finally { if (current === revision.current) setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  async function authenticate(mode, body) {
    const data = await api(`/auth/${mode}`, { method: 'POST', body });
    revision.current++; setUser(data.user); setError(''); setLoading(false);
    return data;
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); }
    catch (e) { if (e.status !== 401) throw e; }
    revision.current++; setUser(null); setLoading(false);
  }
  return <AuthContext.Provider value={{ user, loading, error, refresh, authenticate, logout }}>{children}</AuthContext.Provider>;
}
