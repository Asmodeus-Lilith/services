// components/ServiceCard.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import Icon from './Icon';
import './ServiceCard.css';

const ServiceCard = ({ service }) => {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(service);
    toast.success(`${service.name} added to cart`);
  };

  const handleToggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info('Please sign in to save services to your wishlist');
      navigate('/login', { state: { from: { pathname: `/service/${service.id}` } } });
      return;
    }
    toggleWishlist(service.id);
    if (isInWishlist(service.id)) {
      toast.info(`${service.name} removed from wishlist`);
    } else {
      toast.success(`${service.name} saved to wishlist`);
    }
  };

  const handleMessageProvider = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/service/${service.id}` } } });
      return;
    }
    if (user.userType === 'provider') {
      navigate('/messages');
      return;
    }
    if (user.userType !== 'customer') {
      toast.error('Only customers can message service providers');
      return;
    }
    setContactOpen((open) => !open);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const result = await apiRequest('/messages/conversations', {
        method: 'POST',
        body: { serviceId: service.id, message: text }
      });
      navigate(`/messages?conversation=${encodeURIComponent(result.conversationId)}`);
    } catch (error) {
      toast.error(error.message || 'Could not send your message');
    } finally {
      setSending(false);
    }
  };

  const inWishlist = isInWishlist(service.id);

  return (
    <div className="service-card">
      <Link to={`/service/${service.id}`} className="service-link">
        <div className="service-image-container">
          <img src={service.image} alt={service.name} className="service-image" />
          {service.discount && (
            <span className="discount-badge">{service.discount}% OFF</span>
          )}
          {service.popular && (
            <span className="popular-badge">Popular</span>
          )}
        </div>
        <div className="service-content">
          <div className="service-category">{service.category}</div>
          <h3 className="service-name">{service.name}</h3>
          <p className="service-description">{service.description}</p>
          
          <div className="service-rating">
            <Icon name="star" size={14} />
            <span className="rating-value">{service.rating}</span>
            <span className="review-count">({service.reviews} reviews)</span>
          </div>

        </div>
      </Link>
      <div className="service-card-bottom">
        <div className="service-footer">
          <div className="service-price">
            <span className="current-price">BDT{service.price}</span>
            <span className="price-unit">/{service.unit}</span>
          </div>
          <div className="service-actions">
            <button type="button" className="add-to-cart-btn" onClick={handleAddToCart} title="Add to cart">
              <Icon name="cart" size={14} />Add
            </button>
            <button type="button" className={`wishlist-btn ${inWishlist ? 'active' : ''}`} onClick={handleToggleWishlist} title={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}>
              <Icon name="heart" size={14} />
            </button>
          </div>
        </div>
        {service.providerAccountAvailable && (
          <button type="button" className="message-service-btn" onClick={handleMessageProvider} disabled={authLoading} title="Message provider">
            <Icon name="message" size={14} /><span>Message provider</span>
          </button>
        )}
        {contactOpen && user?.userType === 'customer' && (
          <form className="service-card-message-form" onSubmit={handleSendMessage} onClick={(e) => e.stopPropagation()}>
            <label htmlFor={`service-message-${service.id}`}>Message {service.provider || 'the provider'}</label>
            <textarea
              id={`service-message-${service.id}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Ask about this service…"
              required
            />
            <div className="service-card-message-footer">
              <span>{message.length}/2000</span>
              <button className="btn btn-primary btn-sm" type="submit" disabled={sending || !message.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ServiceCard;
