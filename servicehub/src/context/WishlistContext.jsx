// context/WishlistContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo
} from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from './AuthContext';

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return undefined;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const data = await apiRequest('/wishlist');
        if (!cancelled) setWishlist(data?.services ?? []);
      } catch (error) {
        if (!cancelled) setWishlist([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.email]);

  const addToWishlist = useCallback(async (serviceId) => {
    try {
      await apiRequest(`/wishlist/${encodeURIComponent(serviceId)}`, { method: 'POST' });
      const data = await apiRequest('/wishlist');
      setWishlist(data?.services ?? []);
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  const removeFromWishlist = useCallback(async (serviceId) => {
    try {
      await apiRequest(`/wishlist/${serviceId}`, { method: 'DELETE' });
      setWishlist(prev => prev.filter(s => s.id !== serviceId));
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  const isInWishlist = useCallback(
    (serviceId) => wishlist.some(s => s.id === serviceId),
    [wishlist]
  );

  const toggleWishlist = useCallback(async (serviceId) => {
    if (isInWishlist(serviceId)) {
      return removeFromWishlist(serviceId);
    }
    return addToWishlist(serviceId);
  }, [isInWishlist, addToWishlist, removeFromWishlist]);

  const value = useMemo(
    () => ({
      wishlist,
      loading,
      addToWishlist,
      removeFromWishlist,
      isInWishlist,
      toggleWishlist
    }),
    [wishlist, loading, addToWishlist, removeFromWishlist, isInWishlist, toggleWishlist]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
