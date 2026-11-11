// context/OrderContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo
} from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '../api/client';

const OrderContext = createContext();

/**
 * Bookings are stored in PostgreSQL and scoped by the API: a signed-in user
 * sees their account's orders, a guest sees the ones this browser placed. The
 * server hands a guest's orders to the account when they sign in.
 */
export const OrderProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reload whenever the signed-in account changes, so signing in or out swaps
  // the visible history.
  useEffect(() => {
    if (authLoading) return undefined;

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        const data = await apiRequest('/orders');
        if (cancelled) return;
        setOrders(data?.orders ?? []);
        setError(null);
      } catch (requestError) {
        if (cancelled) return;
        setOrders([]);
        setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.email]);

  const placeOrder = useCallback(async (payload) => {
    const data = await apiRequest('/orders', { method: 'POST', body: payload });
    const order = data.order;

    setOrders((previous) => [
      order,
      ...previous.filter((existing) => existing.id !== order.id)
    ]);

    return { ...order, gatewayUrl: data.gatewayUrl };
  }, []);

  const updateOrderStatus = useCallback(async (orderId, status) => {
    const data = await apiRequest(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: { status }
    });
    setOrders((previous) =>
      previous.map((o) => (o.id === orderId ? data.order : o))
    );
    return data.order;
  }, []);

  const getOrderById = useCallback(
    (id) => orders.find((order) => order.id === id) || null,
    [orders]
  );

  /** Fetches one order directly, for a page loaded straight from a link. */
  const fetchOrder = useCallback(async (id) => {
    try {
      const data = await apiRequest(`/orders/${encodeURIComponent(id)}`);
      return data.order;
    } catch (requestError) {
      if (requestError.status === 404) return null;
      throw requestError;
    }
  }, []);

  const value = useMemo(
    () => ({
      orders,
      loading,
      error,
      placeOrder,
      getOrderById,
      fetchOrder,
      updateOrderStatus
    }),
    [orders, loading, error, placeOrder, getOrderById, fetchOrder, updateOrderStatus]
  );

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};
