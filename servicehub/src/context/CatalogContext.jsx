// context/CatalogContext.js
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

const CatalogContext = createContext();

/**
 * The service catalogue and category list now live in PostgreSQL. They are
 * fetched once here and shared by the home, listing, detail and dashboard
 * screens instead of each importing a static file.
 */
export const CatalogProvider = ({ children }) => {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latestLoad = useRef(0);

  const load = useCallback(async ({ signal, category, search } = {}) => {
    const loadId = ++latestLoad.current;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category);
      if (search) params.set('search', search);

      const qs = params.toString();
      const data = await apiRequest(`/catalog${qs ? `?${qs}` : ''}`, { signal });
      if (loadId !== latestLoad.current) return;
      setServices(data?.services ?? []);
      setCategories(data?.categories ?? []);
      setError(null);
    } catch (requestError) {
      if (requestError?.name === 'AbortError' || loadId !== latestLoad.current) return;
      console.error('[CatalogContext] load error:', requestError);
      setError(requestError.message || 'Failed to load catalog');
    } finally {
      if (loadId === latestLoad.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });

    return () => controller.abort();
  }, [load]);

  // Auto-retry every 5s when the API is unreachable so the page
  // recovers as soon as the server comes back up.
  useEffect(() => {
    if (!error) return undefined;
    const id = setInterval(() => load(), 5000);
    return () => clearInterval(id);
  }, [error, load]);

  const value = useMemo(
    () => ({
      services,
      categories,
      loading,
      error,
      reload: () => load(),
      loadByCategory: (category) => load({ category }),
      searchServices: (query) => load({ search: query })
    }),
    [services, categories, loading, error, load]
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
};

export const useCatalog = () => {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
};
