// pages/ServiceDetail.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { formatDate } from '../utils/format';
import Icon from '../components/Icon';
import './ServiceDetail.css';

const ServiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { services, loading } = useCatalog();
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContactMessage, setSendingContactMessage] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const service = services.find(s => s.id === Number(id));
  const activeImage = selectedImage || service?.image || (service?.images && service?.images[0]) || '';

  const loadReviews = useCallback(async () => {
    if (!service) return;
    setReviewsLoading(true);
    try {
      const data = await apiRequest(`/reviews/service/${service.id}`);
      setReviews(data?.reviews ?? []);
    } catch (error) {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // The catalogue arrives from the API, so "not found" is only true once it
  // has actually loaded.
  if (loading) {
    return (
      <div className="container">
        <div className="spinner" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="container">
        <div className="not-found">
          <h2>Service not found</h2>
          <Link to="/services" className="btn btn-primary">
            Browse Services
          </Link>
        </div>
      </div>
    );
  }

  const relatedServices = services
    .filter(s => s.category === service.category && s.id !== service.id)
    .slice(0, 4);

  const inWishlist = isInWishlist(service.id);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(service);
    }
    setAddedToCart(true);
    toast.success(`${quantity} × ${service.name} added to cart`);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleBookNow = () => {
    addToCart(service);
    toast.info('Added to cart — complete your booking at checkout');
    navigate('/cart');
  };

  const handleContactProvider = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/service/${service.id}` } } });
      return;
    }
    if (user.userType === 'provider') {
      navigate('/messages');
      return;
    }
    if (user.userType !== 'customer') {
      toast.error('Only customers can start a provider conversation');
      return;
    }
    setShowContactForm((open) => !open);
  };

  const handleSendProviderMessage = async (event) => {
    event.preventDefault();
    const message = contactMessage.trim();
    if (!message) return;
    setSendingContactMessage(true);
    try {
      const result = await apiRequest('/messages/conversations', {
        method: 'POST',
        body: { serviceId: service.id, message }
      });
      navigate(`/messages?conversation=${encodeURIComponent(result.conversationId)}`);
    } catch (error) {
      toast.error(error.message || 'Could not send your message');
    } finally {
      setSendingContactMessage(false);
    }
  };

  const handleReportProvider = async (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/service/${service.id}` } } });
      return;
    }
    if (user.userType !== 'customer') {
      toast.error('Only customers can report a provider from a service page');
      return;
    }
    setSubmittingReport(true);
    try {
      await apiRequest('/reports', {
        method: 'POST',
        body: { serviceId: service.id, reason: reportReason, description: reportDescription.trim() }
      });
      toast.success('Report sent to the admin team for review');
      setShowReportForm(false);
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      toast.error(error.message || 'Could not submit the report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleToggleWishlist = () => {
    if (!user) {
      toast.info('Please sign in to save services to your wishlist');
      navigate('/login', { state: { from: { pathname: `/service/${service.id}` } } });
      return;
    }
    toggleWishlist(service.id);
    if (inWishlist) {
      toast.info(`${service.name} removed from wishlist`);
    } else {
      toast.success(`${service.name} saved to wishlist`);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.comment.trim()) {
      toast.error('Please write a comment');
      return;
    }

    setSubmittingReview(true);
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: {
          serviceId: service.id,
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim()
        }
      });
      toast.success('Review submitted successfully');
      setReviewForm({ rating: 5, comment: '' });
      await loadReviews();
    } catch (error) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Icon
        key={i}
        name="star"
        size={16}
        style={{ color: i < rating ? '#f59e0b' : '#e5e7eb' }}
      />
    ));
  };

  return (
    <div className="service-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/services">Services</Link>
          <span>/</span>
          <Link to={`/services/${service.category}`}>{service.category}</Link>
          <span>/</span>
          <span>{service.name}</span>
        </div>

        <div className="service-detail-layout">
          {/* Left - Image & Info */}
          <div className="service-detail-main">
            <div className="service-detail-image">
              <img src={activeImage} alt={service.name} />
              {service.discount && (
                <span className="detail-discount">{service.discount}% OFF</span>
              )}
            </div>

            {service.images && service.images.length > 1 && (
              <div className="service-detail-thumbnails">
                {service.images.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    className={`service-thumbnail-btn ${activeImage === img ? 'is-active' : ''}`}
                    onClick={() => setSelectedImage(img)}
                    title={`View photo ${idx + 1}`}
                  >
                    <img src={img} alt={`${service.name} thumbnail ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}

            <div className="service-detail-info">
              <span className="detail-category">{service.category}</span>
              <h1 className="detail-title">{service.name}</h1>

              <div className="detail-rating">
                <Icon name="star" size={16} />
                <span className="rating-value">{service.rating}</span>
                <span className="review-count">({service.reviews} reviews)</span>
              </div>

              <p className="detail-description">{service.description}</p>

              <div className="detail-features">
                <h3>What's Included</h3>
                <ul className="features-list">
                  {service.includes?.map((item, index) => (
                    <li key={index}>
                      <span className="check-icon">
                        <Icon name="check" size={10} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="detail-provider">
                <h3>Service Provider</h3>
                <div className="provider-card">
                  <div className="provider-avatar">
                    {service.provider?.charAt(0) || 'S'}
                  </div>
                  <div className="provider-info">
                    <strong>{service.provider}</strong>
                    <span>{service.experience} experience</span>
                  </div>
                  <span className="verified-badge">
                    <Icon name="check-circle" size={12} />
                    Verified
                  </span>
                </div>
              </div>

              <div className="detail-availability">
                <h3>Availability</h3>
                <p>{service.availability || 'Mon-Sat, 9AM-8PM'}</p>
                <p className="duration">Duration: {service.duration || '1-2 hours'}</p>
              </div>
            </div>
          </div>

          {/* Right - Booking Card */}
          <div className="service-detail-sidebar">
            <div className="booking-card">
              <div className="booking-price">
                {service.originalPrice && (
                  <span className="original-price">BDT{service.originalPrice}</span>
                )}
                <span className="current-price">BDT{service.price}</span>
                <span className="price-unit">/{service.unit}</span>
              </div>

              <div className="booking-form">
                <div className="form-group">
                  <label>Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="form-group">
                  <label>Select Time</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                  >
                    <option value="">Choose a time slot</option>
                    <option value="09:00">9:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="12:00">12:00 PM</option>
                    <option value="14:00">2:00 PM</option>
                    <option value="15:00">3:00 PM</option>
                    <option value="16:00">4:00 PM</option>
                    <option value="17:00">5:00 PM</option>
                    <option value="18:00">6:00 PM</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantity</label>
                  <div className="quantity-selector">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                      <Icon name="minus" size={14} />
                    </button>
                    <span>{quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)}>
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </div>

                <div className="booking-total">
                  <span>Total:</span>
                  <span className="total-price">BDT{service.price * quantity}</span>
                </div>

                <button
                  className="btn btn-primary btn-block"
                  onClick={handleAddToCart}
                >
                  {addedToCart ? (
                    <>
                      <Icon name="check" size={16} />
                      Added to Cart
                    </>
                  ) : (
                    <>
                      <Icon name="cart" size={16} />
                      Add to Cart
                    </>
                  )}
                </button>

                <button
                  className="btn btn-secondary btn-block"
                  onClick={handleBookNow}
                >
                  Book Now
                </button>

                <button
                  className={`btn btn-block wishlist-toggle-btn ${inWishlist ? 'active' : ''}`}
                  onClick={handleToggleWishlist}
                >
                  <Icon name="heart" size={16} />
                  {inWishlist ? 'Saved to Wishlist' : 'Save to Wishlist'}
                </button>

                {service.providerAccountAvailable && (
                  <div className="provider-contact">
                    <button type="button" className="btn btn-secondary btn-block" onClick={handleContactProvider}>
                      <Icon name="message" size={16} />
                      {user?.userType === 'provider' ? 'Open your messages' : 'Message provider'}
                    </button>
                    {showContactForm && user?.userType === 'customer' && (
                      <form className="provider-contact-form" onSubmit={handleSendProviderMessage}>
                        <label htmlFor="provider-contact-message">Your message</label>
                        <textarea
                          id="provider-contact-message"
                          value={contactMessage}
                          onChange={(event) => setContactMessage(event.target.value)}
                          maxLength={2000}
                          rows={4}
                          placeholder={`Ask ${service.provider || 'the provider'} about this service...`}
                          required
                        />
                        <div className="provider-contact-submit">
                          <span>{contactMessage.length}/2000</span>
                          <button type="submit" className="btn btn-primary" disabled={sendingContactMessage || !contactMessage.trim()}>
                            {sendingContactMessage ? 'Sending…' : 'Send message'}
                          </button>
                        </div>
                      </form>
                    )}
                    {user?.userType === 'customer' && (
                      <button type="button" className="service-report-link" onClick={() => setShowReportForm((open) => !open)}>
                        <Icon name="flag" size={15} /> Report this provider
                      </button>
                    )}
                    {showReportForm && user?.userType === 'customer' && (
                      <form className="provider-contact-form service-report-form" onSubmit={handleReportProvider}>
                        <h3>Report this provider</h3>
                        <p>Tell our admin team what happened. Your report is private.</p>
                        <label htmlFor="provider-report-reason">Reason</label>
                        <select id="provider-report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)} required>
                          <option value="">Choose a reason</option>
                          <option value="harassment">Harassment or bullying</option>
                          <option value="fraud">Fraud or scam</option>
                          <option value="inappropriate_behavior">Inappropriate behavior</option>
                          <option value="service_quality">Service quality or conduct</option>
                          <option value="safety_concern">Safety concern</option>
                          <option value="other">Other</option>
                        </select>
                        <label htmlFor="provider-report-description">Describe what happened</label>
                        <textarea id="provider-report-description" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} minLength={20} maxLength={2000} rows={4} placeholder="Include relevant details (20–2,000 characters)" required />
                        <div className="provider-contact-submit">
                          <span>{reportDescription.length}/2000</span>
                          <button type="submit" className="btn btn-primary" disabled={submittingReport || !reportReason || reportDescription.trim().length < 20}>
                            {submittingReport ? 'Submitting…' : 'Submit report'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>

              <div className="booking-guarantee">
                <Icon name="shield" size={16} />
                <span>100% Satisfaction Guarantee</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="reviews-section">
          <h2 className="section-title">Customer Reviews</h2>

          {/* Review Form */}
          {user && (
            <div className="review-form-card">
              <h3>Write a Review</h3>
              <form onSubmit={handleSubmitReview}>
                <div className="form-group">
                  <label>Your Rating</label>
                  <div className="rating-selector">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        className={`star-btn ${reviewForm.rating >= star ? 'active' : ''}`}
                        onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                      >
                        <Icon name="star" size={24} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Your Review</label>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Share your experience with this service..."
                    rows={4}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReview}
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            </div>
          )}

          {/* Reviews List */}
          <div className="reviews-list">
            {reviewsLoading ? (
              <div className="spinner" />
            ) : reviews.length === 0 ? (
              <div className="no-reviews">
                <p>No reviews yet. Be the first to review this service!</p>
              </div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="review-card">
                  <div className="review-header">
                    <div className="reviewer-info">
                      <div className="reviewer-avatar">
                        {review.userName?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <strong>{review.userName}</strong>
                        <span className="review-date">{formatDate(review.createdAt)}</span>
                      </div>
                    </div>
                    <div className="review-rating">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  <p className="review-comment">{review.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Related Services */}
        {relatedServices.length > 0 && (
          <div className="related-services">
            <h2 className="section-title">Similar Services</h2>
            <div className="grid grid-4">
              {relatedServices.map(s => (
                <Link key={s.id} to={`/service/${s.id}`} className="related-card">
                  <img src={s.image} alt={s.name} />
                  <div className="related-content">
                    <h4>{s.name}</h4>
                    <span className="related-price">BDT{s.price}/{s.unit}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceDetail;
