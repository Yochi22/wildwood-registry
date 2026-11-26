import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando

  const refresh = useCallback(() => api('/api/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)), []);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setUser(null));
  }, [refresh]);

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  return <AuthContext.Provider value={{ user, setUser, refresh, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
