// context/NotificationContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const pendingRead = useRef(new Set());

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiRequest('/notifications');
      setNotifications(data?.notifications ?? []);
    } catch (error) {
      setNotifications([]);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await apiRequest('/notifications/unread-count');
      setUnreadCount(data?.count ?? 0);
    } catch (error) {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      await Promise.all([loadNotifications(), loadUnreadCount()]);
      if (!cancelled) setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.email, loadNotifications, loadUnreadCount]);

  const markAsRead = useCallback(async (id) => {
    if (pendingRead.current.has(id) || !notifications.some((item) => item.id === id && !item.read)) return;
    pendingRead.current.add(id);
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      // ignore
    } finally {
      pendingRead.current.delete(id);
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      refresh: loadNotifications
    }),
    [notifications, unreadCount, loading, markAsRead, markAllAsRead, loadNotifications]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
