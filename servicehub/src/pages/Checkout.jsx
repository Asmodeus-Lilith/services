// pages/Checkout.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../api/client';
import Icon from '../components/Icon';
import './Checkout.css';

const REQUIRED_DETAIL_FIELDS = [
  ['name', 'full name'],
  ['email', 'email address'],
  ['phone', 'phone number'],
  ['address', 'service address'],
  ['city', 'city'],
  ['pincode', 'pincode'],
  ['date', 'preferred date'],
  ['time', 'preferred time']
];

const PAYMENT_METHODS = [
  {
    id: 'sslcommerz',
    label: 'SSLCommerz Gateway',
    description: 'bKash, Nagad, Rocket, Cards (Visa/MasterCard/Amex) & Net Banking',
    icon: 'shield',
    badge: 'Recommended'
  },
  {
    id: 'cod',
    label: 'Cash on Service',
    description: 'Pay cash to the specialist after service completion',
    icon: 'dollar'
  }
];

const Checkout = () => {
  const { items, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const { placeOrder } = useOrders();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
    date: '',
    time: '',
    paymentMethod: 'sslcommerz'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promotion, setPromotion] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');

  if (items.length === 0) {
    return (
      <div className="container">
        <div className="empty-checkout">
          <h2>Your cart is empty</h2>
          <Link to="/services" className="btn btn-primary">Browse Services</Link>
        </div>
      </div>
    );
  }

  const subtotal = getCartTotal();
  const tax = Math.round(subtotal * 0.18);
  const discount = promotion?.discount ?? 0;
  const total = subtotal + tax - discount;

  const applyPromotion = async (event) => {
    event.preventDefault();
    if (validatingPromo || !promoInput.trim()) return;
    setValidatingPromo(true);
    setPromoError('');
    try {
      const result = await apiRequest('/promotions/validate', {
        method: 'POST', body: { code: promoInput, subtotal }
      });
      setPromotion(result);
      setPromoInput(result.code);
    } catch (error) {
      setPromotion(null);
      setPromoError(error.message);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // The "Continue" button is not a submit, so validate the details step here.
  const goToPayment = () => {
    const missing = REQUIRED_DETAIL_FIELDS.find(([field]) => !formData[field]?.trim());

    if (missing) {
      toast.error(`Please enter your ${missing[1]} before continuing`);
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // The API prices the lines from the catalogue itself and stores the
      // booking, so the receipt does not depend on anything the browser sent.
      const order = await placeOrder({
        items,
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        },
        address: {
          line: formData.address,
          city: formData.city,
          pincode: formData.pincode
        },
        schedule: {
          date: formData.date,
          time: formData.time
        },
        paymentMethod: formData.paymentMethod,
        promoCode: promotion?.code
      });

      clearCart();

      if (order.gatewayUrl) {
        toast.success('Redirecting to SSLCommerz payment gateway…');
        window.location.href = order.gatewayUrl;
      } else {
        toast.success(`Booking confirmed — order #${order.id}`);
        navigate(`/order-confirmation/${order.id}`, { replace: true });
      }
    } catch (error) {
      toast.error(error.message || 'We could not place your booking');
      setIsProcessing(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="container">
        <h1 className="page-title">Checkout</h1>

        {/* Steps */}
        <div className="checkout-steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-num">1</span>
            <span>Details</span>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-num">2</span>
            <span>Payment</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="checkout-layout">
            <div className="checkout-form">
              {step === 1 && (
                <div className="form-section">
                  <h3>Contact Information</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <h3>Service Address</h3>
                  <div className="form-group">
                    <label>Address</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows="3"
                      required
                    ></textarea>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Pincode</label>
                      <input
                        type="text"
                        name="pincode"
                        value={formData.pincode}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <h3>Preferred Schedule</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date</label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Time</label>
                      <select
                        name="time"
                        value={formData.time}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select time</option>
                        <option value="09:00">9:00 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="12:00">12:00 PM</option>
                        <option value="14:00">2:00 PM</option>
                        <option value="15:00">3:00 PM</option>
                        <option value="16:00">4:00 PM</option>
                        <option value="17:00">5:00 PM</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={goToPayment}
                  >
                    Continue to Payment
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="form-section">
                  <h3>Payment Method</h3>
                  <div className="payment-options">
                    {PAYMENT_METHODS.map(method => (
                      <label key={method.id} className={`payment-option ${formData.paymentMethod === method.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method.id}
                          checked={formData.paymentMethod === method.id}
                          onChange={handleChange}
                        />
                        <span className="payment-icon">
                          <Icon name={method.icon} size={20} />
                        </span>
                        <div className="payment-method-text">
                          <div className="payment-method-title">
                            <strong>{method.label}</strong>
                            {method.badge && <span className="payment-badge">{method.badge}</span>}
                          </div>
                          <span className="payment-method-desc">{method.description}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {formData.paymentMethod === 'sslcommerz' && (
                    <div className="sslcommerz-info-card">
                      <div className="sslcommerz-info-header">
                        <span className="sslcommerz-badge">
                          <Icon name="shield" size={16} /> SSLCommerz Verified Gateway
                        </span>
                        <span className="sslcommerz-currency">Currency: BDT (৳)</span>
                      </div>
                      <p className="sslcommerz-info-text">
                        You will be securely redirected to SSLCommerz to complete your payment of <strong>BDT{total}</strong>. Choose from popular payment channels:
                      </p>
                      <div className="sslcommerz-channels">
                        <span className="channel-pill channel-bkash">bKash</span>
                        <span className="channel-pill channel-nagad">Nagad</span>
                        <span className="channel-pill channel-rocket">Rocket</span>
                        <span className="channel-pill channel-upay">Upay</span>
                        <span className="channel-pill">Visa</span>
                        <span className="channel-pill">MasterCard</span>
                        <span className="channel-pill">Amex</span>
                        <span className="channel-pill">Internet Banking</span>
                      </div>
                      <div className="sslcommerz-security-notice">
                        <Icon name="lock" size={14} />
                        <span>256-bit SSL encrypted & authorized by Bangladesh Bank</span>
                      </div>
                    </div>
                  )}

                  {formData.paymentMethod === 'cod' && (
                    <div className="cod-info-card">
                      <div className="cod-info-header">
                        <Icon name="dollar" size={18} />
                        <strong>Cash on Service</strong>
                      </div>
                      <p>
                        Pay <strong>BDT{total}</strong> directly to the service professional in cash after the service is completed to your satisfaction.
                      </p>
                    </div>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setStep(1)}
                      disabled={isProcessing}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-checkout-submit"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <span className="btn-loading-content">
                          <span className="spinner-inline" />
                          <span>Connecting to SSLCommerz…</span>
                        </span>
                      ) : formData.paymentMethod === 'sslcommerz' ? (
                        `Pay BDT${total} via SSLCommerz`
                      ) : (
                        `Confirm Booking (BDT${total})`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="checkout-summary">
              <h3>Order Summary</h3>
              {items.map(item => (
                <div key={item.id} className="summary-item">
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>Qty: {item.quantity}</span>
                  </div>
                  <span>BDT{item.price * item.quantity}</span>
                </div>
              ))}
              <div className="summary-divider"></div>
              <div className="promotion-form">
                <label htmlFor="promotion-code">Promotion code</label>
                <div className="promotion-input-row">
                  <input id="promotion-code" value={promoInput} onChange={(event) => { setPromoInput(event.target.value); setPromoError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyPromotion(event); } }} placeholder="Enter code" disabled={validatingPromo || Boolean(promotion)} />
                  {promotion ? <button type="button" className="btn btn-secondary" onClick={() => { setPromotion(null); setPromoInput(''); }}>Remove</button> : <button type="button" className="btn btn-secondary" onClick={applyPromotion} disabled={validatingPromo || !promoInput.trim()}>{validatingPromo ? 'Checking…' : 'Apply'}</button>}
                </div>
                {promoError && <p className="promotion-error">{promoError}</p>}
                {promotion && <p className="promotion-success">{promotion.code} applied: {promotion.discountPercent}% off</p>}
              </div>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>BDT{subtotal}</span>
              </div>
              <div className="summary-row">
                <span>Tax (18%)</span>
                <span>BDT{tax}</span>
              </div>
              {promotion && <div className="summary-row promotion-discount">
                <span>Promotion ({promotion.code})</span>
                <span>−BDT{discount}</span>
              </div>}
              <div className="summary-row total">
                <span>Total</span>
                <span>BDT{total}</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
