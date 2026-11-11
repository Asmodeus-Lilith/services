// pages/AdminOrders.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { apiRequest } from '../api/client';
import { formatCurrency } from '../utils/format';
import Icon from '../components/Icon';
import './AdminOrders.css';

const STATUS_OPTIONS = ['upcoming', 'in_progress', 'delivered', 'cancelled'];

const STATUS_STYLES = {
  upcoming: 'badge-info',
  in_progress: 'badge-warning',
  delivered: 'badge-success',
  cancelled: 'badge-error',
};

const AdminOrders = () => {
  const { user } = useAuth();
  const { updateOrderStatus } = useOrders();
  const [statusFilter, setStatusFilter] = useState('');
  const [filter, setFilter] = useState('');
  const [updating, setUpdating] = useState(null);

  // Fetch all orders regardless of owner — admin context will be handled server-side.
  // The existing OrderContext fetches /orders scoped to the user.
  // For admin we need a separate fetch.
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState(null);

  useEffect(() => {
    if (!user || user.userType !== 'admin') return;
    let cancelled = false;
    setAdminLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '100');
    const loadOrders = async () => {
      try {
        const firstPage = await apiRequest(`/admin/orders?${params.toString()}`);
        const orders = [...(firstPage.orders ?? [])];
        const pages = firstPage.pagination?.pages ?? 1;
        for (let page = 2; page <= pages; page += 1) {
          if (cancelled) return;
          const pageParams = new URLSearchParams(params);
          pageParams.set('page', String(page));
          const nextPage = await apiRequest(`/admin/orders?${pageParams.toString()}`);
          orders.push(...(nextPage.orders ?? []));
        }
        if (!cancelled) {
          setAdminOrders(orders);
          setAdminError(null);
          setAdminLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setAdminError(err.message);
          setAdminLoading(false);
        }
      }
    };
    loadOrders();
    return () => { cancelled = true; };
  }, [user, statusFilter]);

  const filtered = useMemo(() => {
    if (!filter) return adminOrders;
    const q = filter.toLowerCase();
    return adminOrders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.customer?.name.toLowerCase().includes(q) ||
        o.customer?.email.toLowerCase().includes(q)
    );
  }, [adminOrders, filter]);

  const handleStatusChange = useCallback(
    async (orderId, newStatus) => {
      setUpdating(orderId);
      try {
        const data = await updateOrderStatus(orderId, newStatus);
        setAdminOrders((prev) =>
          prev.map((o) => (o.id === orderId ? (data || o) : o))
        );
      } catch (err) {
        setAdminError(err.message);
      } finally {
        setUpdating(null);
      }
    },
    [updateOrderStatus]
  );

  if (!user || user.userType !== 'admin') {
    return (
      <div className="admin-page">
        <div className="container">
          <div className="admin-forbidden">
            <h2>Access Denied</h2>
            <p>Only admins can view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-header">
          <h1>
            <Icon name="package" size={24} />
            Order Management
          </h1>
          <p>Manage and deliver customer orders</p>
        </div>

        {/* Filters */}
        <div className="admin-filters">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search order #, customer name, email..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="admin-search"
          />
        </div>

        {/* Error */}
        {adminError && (
          <div className="admin-error">{adminError}</div>
        )}

        {/* Loading */}
        {adminLoading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <span className="admin-empty-icon">
              <Icon name="package" size={28} />
            </span>
            <h3>No orders found</h3>
            <p>No orders match your filters.</p>
          </div>
        ) : (
          <div className="admin-orders-list">
            {filtered.map((order) => (
              <div key={order.id} className="admin-order-card">
                <div className="admin-order-header">
                  <div>
                    <span className={`badge ${STATUS_STYLES[order.status] ?? 'badge-warning'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <span
                      className={`badge ${order.paymentStatus === 'paid' ? 'badge-success' : 'badge-neutral'}`}
                      style={{ marginLeft: 6 }}
                    >
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                    <span className="admin-order-id">#{order.id}</span>
                  </div>
                  <span className="admin-order-date">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>

                <div className="admin-order-body">
                  <div className="admin-customer">
                    <strong>{order.customer?.name}</strong>
                    <span>{order.customer?.email}</span>
                    {order.customer?.phone && <span>{order.customer.phone}</span>}
                  </div>
                  <div className="admin-items">
                    {order.items?.map((item, i) => (
                      <span key={i} className="admin-item-tag">
                        {item.name} × {item.quantity}
                      </span>
                    ))}
                  </div>
                  <div className="admin-total">{formatCurrency(order.total)}</div>
                </div>

                <div className="admin-order-footer">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    disabled={updating === order.id}
                    className="admin-status-select"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                  {updating === order.id && <span className="admin-spinner" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;
