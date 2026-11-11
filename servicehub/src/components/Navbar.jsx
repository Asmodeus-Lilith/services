// components/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationContext';
import Icon from './Icon';
import './Navbar.css';

const Navbar = ({ onSearch, searchTerm }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchTerm || '');
  const { getCartCount } = useCart();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { wishlist } = useWishlist();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Update search value when searchTerm prop changes
  useEffect(() => {
    setSearchValue(searchTerm || '');
  }, [searchTerm]);

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
    setIsNotificationOpen(false);
    toast.info('You have been signed out');
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      onSearch(searchValue.trim());
      navigate('/services', { state: { search: searchValue.trim() } });
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      setIsNotificationOpen(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">
            <Icon name="home" size={20} />
          </span>
          <span className="logo-text">ServiceHub</span>
        </Link>

        <form className="navbar-search" onSubmit={handleSearch} role="search">
          <Icon name="search" size={18} className="search-icon" />
          <input
            type="search"
            placeholder="Search services..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="search-input"
            aria-label="Search services"
          />
        </form>

        <div className={`navbar-menu ${isMenuOpen ? 'active' : ''}`}>
          <Link to="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>
            Home
          </Link>
          <Link to="/services" className="nav-link" onClick={() => setIsMenuOpen(false)}>
            All Services
          </Link>
          <Link to="/services/tuition" className="nav-link" onClick={() => setIsMenuOpen(false)}>
            Tuition
          </Link>
          <Link to="/services/cleaning" className="nav-link" onClick={() => setIsMenuOpen(false)}>
            Home Cleaning
          </Link>
          <Link to="/services/salon" className="nav-link" onClick={() => setIsMenuOpen(false)}>
            Salon
          </Link>
          <Link to="/about" className="nav-link" onClick={() => setIsMenuOpen(false)}>
            About
          </Link>
        </div>

        <div className="navbar-actions">
          <div className="nav-icon-group">
            <Link to="/cart" className="icon-btn" aria-label="Cart">
              <Icon name="cart" size={20} />
              {getCartCount() > 0 && (
                <span className="icon-badge">{getCartCount()}</span>
              )}
            </Link>

            {user && user.userType !== 'admin' && (
              <Link to="/messages" className="icon-btn" aria-label="Messages">
                <Icon name="message" size={20} />
              </Link>
            )}

            <div className="icon-dropdown">
              <button
                className="icon-btn"
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                aria-label="Notifications"
              >
                <Icon name="bell" size={20} />
                {unreadCount > 0 && (
                  <span className="icon-badge">{unreadCount}</span>
                )}
              </button>
              {isNotificationOpen && (
                <div className="dropdown-panel notification-panel">
                  <div className="panel-header">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <button className="mark-all-btn" onClick={markAllAsRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="panel-list">
                    {notifications.length === 0 ? (
                      <p className="panel-empty">No notifications yet</p>
                    ) : (
                      notifications.slice(0, 5).map(notification => (
                        <div
                          key={notification.id}
                          className={`panel-item ${notification.read ? '' : 'unread'}`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <strong>{notification.title}</strong>
                          <p>{notification.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="nav-divider" />

          {user ? (
            <div className="profile-dropdown">
              <button
                className="profile-btn"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                <img src={user.avatar} alt={user.name} className="profile-avatar" />
                <span className="profile-name">{user.name.split(' ')[0]}</span>
                <Icon name="chevron-down" size={14} />
              </button>
              {isProfileOpen && (
                <div className="dropdown-panel profile-panel">
                  <Link to={user.userType === 'provider' ? '/provider/dashboard' : '/dashboard'} onClick={() => setIsProfileOpen(false)}>
                    <Icon name="dashboard" size={16} />
                    {user.userType === 'provider' ? 'Provider workspace' : 'Dashboard'}
                  </Link>
                  <Link to="/wishlist" onClick={() => setIsProfileOpen(false)}>
                    <Icon name="heart" size={16} />
                    Wishlist
                    {wishlist.length > 0 && (
                      <span className="panel-badge">{wishlist.length}</span>
                    )}
                  </Link>
                  {user.userType === 'admin' && (
                    <>
                      <Link to="/admin/orders" onClick={() => setIsProfileOpen(false)}>
                        <Icon name="package" size={16} />
                        Order Management
                      </Link>
                      <Link to="/admin/moderation" onClick={() => setIsProfileOpen(false)}>
                        <Icon name="shield" size={16} />
                        Marketplace moderation
                      </Link>
                      <Link to="/admin/promotions" onClick={() => setIsProfileOpen(false)}>
                        <Icon name="tag" size={16} />
                        Promotions
                      </Link>
                    </>
                  )}
                  <div className="panel-divider" />
                  <button onClick={handleLogout}>
                    <Icon name="logout" size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-secondary btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </div>
          )}

          <button
            className="icon-btn menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <Icon name="menu" size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
