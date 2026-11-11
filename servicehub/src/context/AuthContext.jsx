// context/AuthContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo
} from 'react';
import { apiRequest, getToken, setToken, getGuestKey } from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the stored token on first render.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch (error) {
        // A rejected token is worthless; drop it so we stop sending it.
        if (error.status === 401) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password, userType) => {
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password, guestKey: getGuestKey(), userType }
      });

      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('[AuthContext] login error:', error);
      // Provide user-friendly error message
      const message = error.status === 401 ? 'Incorrect email or password' :
                     error.status === 0 ? 'Could not reach the server. Is the backend running?' :
                     error.message || 'Login failed';
      throw new Error(message);
    }
  }, []);

  const register = useCallback(
    async (name, email, password, userType = 'customer', avatar = null) => {
      try {
        const data = await apiRequest('/auth/register', {
          method: 'POST',
          body: { name, email, password, userType, avatar }
        });

        setToken(data.token);
        setUser(data.user);
        return data.user;
      } catch (error) {
        console.error('[AuthContext] register error:', error);
        const message = error.status === 409 ? 'An account with that email already exists' :
                       error.status === 400 ? error.message || 'Please fill all required fields' :
                       error.status === 0 ? 'Could not reach the server. Is the backend running?' :
                       error.message || 'Registration failed';
        throw new Error(message);
      }
    },
    []
  );

  /**
   * Signs out locally straight away and revokes the session in the background,
   * so a slow network never leaves the user stuck looking signed in.
   */
  const logout = useCallback(() => {
    const revoke = apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setUser(null);
    return revoke;
  }, []);

  const value = useMemo(
    () => ({ user, login, register, logout, loading }),
    [user, login, register, logout, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
