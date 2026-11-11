import React, { createContext, useContext, useState, useEffect } from 'react';
import { syncEngine, getServerUrl } from '../sync/syncEngine';
import { safeJson } from '../utils/http';

export interface User {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, deviceLabel?: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, timezone?: string) => Promise<void>;
  logout: () => void;
  continueAsGuest: (displayName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('level_up_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('level_up_token');
      const cachedUser = localStorage.getItem('level_up_user');

      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch {
          // Ignore
        }
      }

      if (!storedToken) {
        setLoading(false);
        return;
      }

      const baseUrl = getServerUrl();
      try {
        const res = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        if (res.ok) {
          const data = await safeJson(res);
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('level_up_user', JSON.stringify(data.user));
            syncEngine.init();
          }
        }
      } catch {
        if (cachedUser) {
          syncEngine.init();
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string, deviceLabel: string = 'Browser Device') => {
    const baseUrl = getServerUrl();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, device_label: deviceLabel })
      });
    } catch (err: any) {
      throw new Error(`Cannot reach server at ${baseUrl || 'current origin'}. Check connection or use Offline Mode.`);
    }

    if (!res.ok) {
      const errorData = await safeJson(res).catch(() => ({ error: `Login failed (${res.status} ${res.statusText})` }));
      throw new Error(errorData.error || 'Failed to log in');
    }

    const data = await safeJson(res);
    if (!data.token) {
      throw new Error('Server returned invalid response');
    }

    localStorage.setItem('level_up_token', data.token);
    localStorage.setItem('level_up_user', JSON.stringify(data.user));
    if (data.deviceId) {
      localStorage.setItem('level_up_device_id', data.deviceId);
    }

    setToken(data.token);
    setUser(data.user);
    syncEngine.connectWebSocket();
    await syncEngine.syncNow();
  };

  const register = async (email: string, password: string, displayName: string, timezone?: string) => {
    const baseUrl = getServerUrl();
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName, timezone: tz })
      });
    } catch (err: any) {
      throw new Error(`Cannot reach server at ${baseUrl || 'current origin'}. Check connection or use Offline Mode.`);
    }

    if (!res.ok) {
      const errorData = await safeJson(res).catch(() => ({ error: `Registration failed (${res.status} ${res.statusText})` }));
      throw new Error(errorData.error || 'Failed to create account');
    }

    const data = await safeJson(res);
    if (!data.token) {
      throw new Error('Server returned invalid response');
    }

    localStorage.setItem('level_up_token', data.token);
    localStorage.setItem('level_up_user', JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);
    syncEngine.connectWebSocket();
    await syncEngine.syncNow();
  };

  const continueAsGuest = (displayName: string) => {
    const guestUser: User = {
      id: 'local_' + crypto.randomUUID(),
      email: 'local@device',
      display_name: displayName || 'Scholar',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      created_at: new Date().toISOString()
    };
    localStorage.setItem('level_up_user', JSON.stringify(guestUser));
    setUser(guestUser);
  };

  const logout = () => {
    localStorage.removeItem('level_up_token');
    localStorage.removeItem('level_up_user');
    syncEngine.disconnectWebSocket();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, continueAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
