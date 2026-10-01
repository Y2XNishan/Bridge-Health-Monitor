import { useState, useEffect } from 'react';
import { AuthContext } from './authContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('bridgeiq_token') || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('bridgeiq_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  // The token, not cached profile data, determines the authenticated identity.
  useEffect(() => {
    let cancelled = false;
    if (token) {
      fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Invalid token');
      })
      .then(data => {
        if (cancelled) return;
        setUser(data);
        localStorage.setItem('bridgeiq_user', JSON.stringify(data));
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[auth-verify-error]', err);
        // Clear invalid session
        setToken(null);
        setUser(null);
        localStorage.removeItem('bridgeiq_token');
        localStorage.removeItem('bridgeiq_user');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      Promise.resolve().then(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Authentication failed');
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('bridgeiq_token', data.token);
    localStorage.setItem('bridgeiq_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.error('[auth-logout-error]', err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('bridgeiq_token');
      localStorage.removeItem('bridgeiq_user');
    }
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  const isEngineer = () => {
    return user?.role === 'engineer' || user?.role === 'admin';
  };

  const hasPermission = (action) => {
    if (!user) return false;
    const role = user.role;
    if (role === 'admin') return true; // Admins have all permissions
    if (action === 'activate' || action === 'deactivate') {
      return role === 'engineer';
    }
    if (action === 'report') {
      return true; // Any authenticated user can export reports
    }
    return false;
  };

  const value = {
    token,
    user,
    loading,
    login,
    logout,
    isAdmin,
    isEngineer,
    hasPermission
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
