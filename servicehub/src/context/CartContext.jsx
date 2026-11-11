// context/CartContext.js
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '../api/client';

const CartContext = createContext();

const STORAGE_KEY = 'servicehub_cart';
const MAX_QUANTITY = 20;

// How long to wait after the last change before writing to the API, so
// clicking "+" five times is one request rather than five.
const SYNC_DELAY_MS = 400;

const clampQuantity = (quantity) => {
  const value = Number(quantity);
  if (Number.isNaN(value)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(value)));
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existingItem = state.items.find(item => item.id === action.payload.id);
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === action.payload.id
              ? { ...item, quantity: clampQuantity(item.quantity + 1) }
              : item
          )
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.payload, quantity: 1 }]
      };
    }
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: clampQuantity(action.payload.quantity) }
            : item
        )
      };
    case 'CLEAR_CART':
      return {
        ...state,
        items: []
      };
    case 'REPLACE':
      return {
        ...state,
        items: action.payload
      };
    default:
      return state;
  }
};

/**
 * Restores the cart saved by a previous visit so a refresh or a closed tab
 * does not silently empty it. Only guests use this; a signed-in visitor's cart
 * comes from the API.
 */
const readStoredCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };

    const items = parsed.items
      .filter(item => item && item.id !== undefined && typeof item.price === 'number')
      .map(item => ({ ...item, quantity: clampQuantity(item.quantity) }));

    return { items };
  } catch (error) {
    console.warn('Could not read saved cart', error);
    return { items: [] };
  }
};

/** Only the ids and quantities are sent; the API prices them itself. */
const toLines = (items) =>
  items.map(item => ({ id: item.id, quantity: item.quantity }));

/**
 * Combines a saved cart with the account's cart. The higher quantity wins, so
 * signing in never silently loses or duplicates what the visitor picked.
 */
const mergeItems = (serverItems, localItems) => {
  const byId = new Map();

  for (const item of [...serverItems, ...localItems]) {
    if (!item || item.id === undefined) continue;

    const existing = byId.get(item.id);
    byId.set(
      item.id,
      existing
        ? {
            ...existing,
            ...item,
            quantity: clampQuantity(
              Math.max(existing.quantity ?? 1, item.quantity ?? 1)
            )
          }
        : { ...item, quantity: clampQuantity(item.quantity) }
    );
  }

  return [...byId.values()];
};

export const CartProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, undefined, readStoredCart);
  const [ready, setReady] = useState(false);
  const lastSynced = useRef(null);

  // Adopt the account's cart on sign-in, merging anything picked as a guest.
  useEffect(() => {
    if (authLoading) return undefined;

    if (!user) {
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    setReady(false);

    const hydrate = async () => {
      const localItems = readStoredCart().items;

      try {
        const data = await apiRequest('/cart');
        if (cancelled) return;

        const merged = mergeItems(data?.items ?? [], localItems);
        const fingerprint = JSON.stringify(toLines(merged));

        dispatch({ type: 'REPLACE', payload: merged });

        // Nothing local to push up: record the state as already saved.
        lastSynced.current = localItems.length > 0 ? null : fingerprint;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
          /* ignore */
        }
      } catch (error) {
        // Offline or signed out mid-flight: keep whatever the browser has.
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.email]);

  // Persist every change, to the account when signed in and to this browser
  // otherwise.
  useEffect(() => {
    if (!ready) return undefined;

    if (!user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
      } catch (error) {
        console.warn('Could not save cart', error);
      }
      return undefined;
    }

    const lines = toLines(state.items);
    const fingerprint = JSON.stringify(lines);

    if (lastSynced.current === fingerprint) return undefined;

    const timer = setTimeout(() => {
      apiRequest('/cart', { method: 'PUT', body: { items: lines } })
        .then(() => {
          lastSynced.current = fingerprint;
        })
        .catch(() => {
          /* the next change retries */
        });
    }, SYNC_DELAY_MS);

    return () => clearTimeout(timer);
  }, [state.items, ready, user]);

  const addToCart = useCallback((service) => {
    dispatch({ type: 'ADD_TO_CART', payload: service });
  }, []);

  const removeFromCart = useCallback((id) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: id });
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const getCartTotal = useCallback(
    () => state.items.reduce((total, item) => total + item.price * item.quantity, 0),
    [state.items]
  );

  const getCartCount = useCallback(
    () => state.items.reduce((count, item) => count + item.quantity, 0),
    [state.items]
  );

  const value = useMemo(
    () => ({
      items: state.items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount
    }),
    [
      state.items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal,
      getCartCount
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
