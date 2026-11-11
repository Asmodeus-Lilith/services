// pages/Dashboard.jsx
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { useCatalog } from '../context/CatalogContext';
import { formatCurrency, formatSchedule } from '../utils/format';
import Icon from '../components/Icon';
import './Dashboard.css';

/**
 * A booking whose scheduled date has passed counts as completed, so history
 * stays accurate without any backend to update the stored status.
 */
const isPastBooking = (order) => {
  if (!order.schedule?.date) return false;

  const scheduled = new Date(`${order.schedule.date}T00:00:00`);
  if (Number.isNaN(scheduled.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return scheduled < today;
};

const getDisplayStatus = (order) => {
  if (order.status === 'upcoming' && isPastBooking(order)) return 'completed';
  return order.status || 'upcoming';
};

const getOrderTitle = (order) => {
  const [first, ...rest] = order.items || [];
  if (!first) return 'Service booking';
  return rest.length > 0 ? `${first.name} +${rest.length} more` : first.name;
};

const Dashboard = () => {
  const { user } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const { services, loading: catalogLoading } = useCatalog();

  const stats = useMemo(() => {
    const active = orders.filter(order => getDisplayStatus(order) === 'upcoming');
    const completed = orders.filter(order => getDisplayStatus(order) === 'completed');
    const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);

    return [
      { icon: 'package', value: orders.length, label: 'Total Bookings' },
      { icon: 'clock', value: active.length, label: 'Active Services' },
      { icon: 'check-circle', value: completed.length, label: 'Completed' },
      { icon: 'dollar', value: formatCurrency(totalSpent), label: 'Total Spent' }
    ];
  }, [orders]);

  const recentOrders = orders.slice(0, 4);

  return (
    <div className="dashboard-page">
      <div className="container">
        {/* Welcome Header */}
        <div className="dashboard-header">
          <div className="welcome-card">
            <img src={user?.avatar} alt={user?.name} className="welcome-avatar" />
            <div className="welcome-info">
              <h1>Welcome back, {user?.name?.split(' ')[0]}!</h1>
              <p>Here's what's happening with your services</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {stats.map(stat => (
            <div key={stat.label} className="stat-card">
              <span className="stat-icon">
                <Icon name={stat.icon} size={22} />
              </span>
              <div>
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          {/* Recent Orders */}
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Recent Bookings</h2>
              <Link to="/services">Book New</Link>
            </div>

            {ordersLoading ? (
              <div className="spinner" />
            ) : recentOrders.length === 0 ? (
              <div className="orders-empty">
                <span className="orders-empty-icon">
                  <Icon name="calendar" size={24} />
                </span>
                <h3>No bookings yet</h3>
                <p>
                  Once you confirm a booking it will show up here with its
                  schedule and receipt.
                </p>
                <Link to="/services" className="btn btn-primary">
                  Browse Services
                </Link>
              </div>
            ) : (
              <div className="orders-list">
                {recentOrders.map(order => (
                  <Link
                    key={order.id}
                    to={`/order-confirmation/${order.id}`}
                    className="order-card"
                  >
                    <img
                      src={order.items[0]?.image}
                      alt={order.items[0]?.name || 'Booked service'}
                    />
                    <div className="order-info">
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`order-status ${getDisplayStatus(order)}`}>
                          {getDisplayStatus(order)}
                        </span>
                        {order.paymentStatus === 'paid' && (
                          <span className="order-status" style={{ background: '#dcfce7', color: '#15803d' }}>
                            Paid
                          </span>
                        )}
                      </div>
                      <h4>{getOrderTitle(order)}</h4>
                      <p>{formatSchedule(order.schedule)}</p>
                      <p className="order-ref">#{order.id}</p>
                    </div>
                    <div className="order-price">{formatCurrency(order.total)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="dashboard-section">
            <h2>Quick Actions</h2>
            <div className="quick-actions">
              <Link to="/services/tuition" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="book" size={20} />
                </span>
                <span>Book Tuition</span>
              </Link>
              <Link to="/services/cleaning" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="droplet" size={20} />
                </span>
                <span>Book Cleaning</span>
              </Link>
              <Link to="/services/salon" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="scissors" size={20} />
                </span>
                <span>Book Salon</span>
              </Link>
              <Link to="/services/repair" className="quick-action">
                <span className="quick-action-icon">
                  <Icon name="wrench" size={20} />
                </span>
                <span>Book Repair</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Recommended Services */}
        <div className="dashboard-section full-width">
          <div className="section-header">
            <h2>Recommended for You</h2>
            <Link to="/services">View All</Link>
          </div>
          <div className="recommended-grid">
            {catalogLoading ? (
              <div className="spinner" />
            ) : (
              services.slice(4, 8).map(service => (
                <Link key={service.id} to={`/service/${service.id}`} className="recommended-card">
                  <img src={service.image} alt={service.name} />
                  <div className="recommended-info">
                    <h4>{service.name}</h4>
                    <span className="recommended-price">BDT{service.price}/{service.unit}</span>
                    <span className="recommended-rating">
                      <Icon name="star" size={12} />
                      {service.rating}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
