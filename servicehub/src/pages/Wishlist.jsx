// pages/Wishlist.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import Icon from '../components/Icon';
import './Wishlist.css';

const Wishlist = () => {
  const { user } = useAuth();
  const { wishlist: services, loading, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter wishlist client-side based on search
  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToCart = (service) => {
    addToCart(service);
    toast.success(`${service.name} added to cart`);
  };

  const handleRemove = async (serviceId) => {
    const service = services.find((item) => item.id === serviceId);
    if (await removeFromWishlist(serviceId)) {
      toast.info(`${service?.name || 'Service'} removed from wishlist`);
    } else {
      toast.error('Could not remove this service. Please try again.');
    }
  };

  if (!user) {
    return (
      <div className="wishlist-page">
        <div className="container">
          <div className="auth-prompt">
            <Icon name="heart" size={48} className="prompt-icon" />
            <h2>Please sign in to view your wishlist</h2>
            <p>Save your favorite services and access them anytime</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <div className="container">
        <div className="wishlist-header">
          <h1>My Wishlist</h1>
          <p className="subtitle">
            {loading ? 'Loading…' : `${filteredServices.length} saved services`}
          </p>
        </div>

        <div className="wishlist-layout">
          {/* Search Bar */}
          <div className="wishlist-search">
            <Icon name="search" size={18} className="search-icon" />
            <input
              type="search"
              placeholder="Search your wishlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                ×
              </button>
            )}
          </div>

          {loading && <div className="spinner" />}

          {!loading && filteredServices.length === 0 && (
            <div className="empty-wishlist">
              <Icon name="heart" size={48} className="empty-icon" />
              <h3>Your wishlist is empty</h3>
              <p>Services you save will appear here</p>
              <a href="/services" className="btn btn-primary">Browse Services</a>
            </div>
          )}

          {!loading && filteredServices.length > 0 && (
            <div className="wishlist-grid">
              {filteredServices.map((service) => (
                <div key={service.id} className="wishlist-card">
                  <Link to={`/service/${service.id}`} className="wishlist-link">
                    <div className="wishlist-image-container">
                      <img src={service.image} alt={service.name} />
                      {service.discount && (
                        <span className="discount-badge">{service.discount}% OFF</span>
                      )}
                    </div>
                    <div className="wishlist-content">
                      <span className="wishlist-category">{service.category}</span>
                      <h3 className="wishlist-name">{service.name}</h3>
                      <div className="wishlist-rating">
                        <Icon name="star" size={14} />
                        <span>{service.rating}</span>
                        <span className="review-count">({service.reviews})</span>
                      </div>
                      <div className="wishlist-price">
                        {service.originalPrice && (
                          <span className="original-price">{formatCurrency(service.originalPrice)}</span>
                        )}
                        <span className="current-price">{formatCurrency(service.price)}</span>
                        <span className="price-unit">/{service.unit}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="wishlist-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAddToCart(service)}
                    >
                      <Icon name="cart" size={14} />
                      Add to Cart
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRemove(service.id)}
                    >
                      <Icon name="trash" size={14} />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wishlist;
