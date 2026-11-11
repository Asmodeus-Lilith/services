// pages/OrderConfirmation.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatSchedule } from '../utils/format';
import { apiRequest } from '../api/client';
import Icon from '../components/Icon';
import './OrderConfirmation.css';

const PAYMENT_LABELS = {
  sslcommerz: 'SSLCommerz Payment Gateway',
  card: 'Credit / Debit Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  cod: 'Cash on Service'
};

const formatPaymentMethod = (method) => {
  if (!method) return 'Not Specified';
  if (method === 'cod') return 'Cash on Service';
  if (method === 'sslcommerz') return 'SSLCommerz Gateway';
  if (method.startsWith('SSLCommerz')) return method;
  return PAYMENT_LABELS[method] || method;
};

const OrderConfirmation = () => {
  const { id } = useParams();
  const location = useLocation();
  const { toast } = useToast();
  const { getOrderById, fetchOrder, loading } = useOrders();
  const [order, setOrder] = useState(() => getOrderById(id));
  const [looking, setLooking] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const paymentParam = searchParams.get('payment'); // 'success' | 'failed' | 'cancelled'
  const reasonParam = searchParams.get('reason');

  // Reached straight after checkout the order is already in context. Opened
  // from a link or a refresh it has to be fetched from the API.
  useEffect(() => {
    let cancelled = false;

    // If we have payment query params, always fetch the freshest order state from backend
    if (!paymentParam) {
      const cached = getOrderById(id);
      if (cached) {
        setOrder(cached);
        setLooking(false);
        return undefined;
      }
    }

    if (loading) return undefined;

    setLooking(true);

    fetchOrder(id)
      .then(found => {
        if (cancelled) return;
        setOrder(found);
        setLooking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setOrder(null);
        setLooking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, getOrderById, fetchOrder, loading, paymentParam]);

  const handleRetryPayment = async () => {
    if (!order) return;
    setRetryingPayment(true);
    try {
      const data = await apiRequest(`/payment/sslcommerz/init/${encodeURIComponent(order.id)}`, {
        method: 'POST'
      });
      if (data.gatewayUrl) {
        toast.success('Redirecting to SSLCommerz…');
        window.location.href = data.gatewayUrl;
      } else {
        throw new Error('No gateway URL returned from SSLCommerz');
      }
    } catch (err) {
      toast.error(err.message || 'Could not connect to payment gateway');
      setRetryingPayment(false);
    }
  };

  if (looking) {
    return (
      <div className="order-confirmation-page">
        <div className="container">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-confirmation-page">
        <div className="container">
          <div className="order-missing">
            <span className="order-missing-icon">
              <Icon name="search" size={28} />
            </span>
            <h2>We couldn't find that order</h2>
            <p>
              Order <strong>{id}</strong> isn't in your history. It may belong to
              another account or the link may be incorrect.
            </p>
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === 'paid';
  const isFailed = paymentParam === 'failed' || order.paymentStatus === 'failed';
  const isCancelled = paymentParam === 'cancelled' || order.paymentStatus === 'cancelled';
  const isCod = order.paymentMethod === 'cod';

  return (
    <div className="order-confirmation-page">
      <div className="container">
        {/* Payment Status Notification Banners */}
        {paymentParam === 'success' && (
          <div className="order-payment-banner banner-success">
            <Icon name="check-circle" size={22} />
            <div>
              <strong>Payment Verified!</strong>
              <p>Your payment has been successfully confirmed by SSLCommerz.</p>
            </div>
          </div>
        )}

        {isFailed && (
          <div className="order-payment-banner banner-failed">
            <Icon name="alert" size={22} />
            <div className="banner-content">
              <strong>Payment Incomplete</strong>
              <p>{reasonParam ? decodeURIComponent(reasonParam) : 'The payment was not completed on SSLCommerz.'} You can retry your payment below.</p>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="order-payment-banner banner-cancelled">
            <Icon name="info" size={22} />
            <div className="banner-content">
              <strong>Payment Cancelled</strong>
              <p>The transaction was cancelled. Click "Pay Now via SSLCommerz" below to complete payment.</p>
            </div>
          </div>
        )}

        <div className="order-success-banner">
          <span className={`order-success-icon ${isFailed ? 'icon-warning' : ''}`}>
            <Icon name={isFailed ? 'alert' : 'check'} size={28} />
          </span>
          <div>
            <h1>{isPaid ? 'Payment & Booking Confirmed!' : 'Booking Recorded!'}</h1>
            <p>
              Your order <strong>#{order.id}</strong> is registered. We've sent the
              details to {order.customer?.email || 'your email'}.
            </p>
          </div>
        </div>

        <div className="order-layout">
          <div className="order-main">
            <div className="order-panel">
              <h2>Services Booked</h2>
              <div className="order-lines">
                {order.items.map(item => (
                  <div key={item.id} className="order-line">
                    <img src={item.image} alt={item.name} />
                    <div className="order-line-info">
                      <strong>{item.name}</strong>
                      <span>
                        {item.provider ? `${item.provider} · ` : ''}
                        Qty {item.quantity}
                        {item.unit ? ` × ${formatCurrency(item.price)}/${item.unit}` : ''}
                      </span>
                    </div>
                    <span className="order-line-total">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="order-totals">
                <div className="order-total-row">
                  <span>Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="order-total-row">
                  <span>Tax (18%)</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
                {order.promoCode && (
                  <div className="order-total-row promotion-receipt-discount">
                    <span>Promotion ({order.promoCode})</span>
                    <span>−{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="order-total-row grand">
                  <span>Total Amount</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="order-side">
            <div className="order-panel">
              <h2>Booking Details</h2>
              <dl className="order-details">
                <div>
                  <dt>Order ID</dt>
                  <dd>#{order.id}</dd>
                </div>
                <div>
                  <dt>Booking Status</dt>
                  <dd>
                    <span className={`order-status ${order.status}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Payment Status</dt>
                  <dd>
                    {isPaid ? (
                      <span className="payment-status-badge is-paid">
                        <Icon name="check-circle" size={13} /> Paid via SSLCommerz
                      </span>
                    ) : isCod ? (
                      <span className="payment-status-badge is-cod">
                        Cash on Service
                      </span>
                    ) : isFailed ? (
                      <span className="payment-status-badge is-failed">
                        Failed / Unpaid
                      </span>
                    ) : (
                      <span className="payment-status-badge is-pending">
                        Payment Pending
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Payment Channel</dt>
                  <dd>{formatPaymentMethod(order.paymentMethod)}</dd>
                </div>
                {order.transactionId && (
                  <div>
                    <dt>Transaction ID</dt>
                    <dd className="order-tran-id">{order.transactionId}</dd>
                  </div>
                )}
                <div>
                  <dt>Schedule</dt>
                  <dd>{formatSchedule(order.schedule)}</dd>
                </div>
                <div>
                  <dt>Service Address</dt>
                  <dd>
                    {order.address?.line}
                    {order.address?.city ? `, ${order.address.city}` : ''}
                    {order.address?.pincode ? ` - ${order.address.pincode}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {order.customer?.name}
                    {order.customer?.phone ? ` · ${order.customer.phone}` : ''}
                  </dd>
                </div>
              </dl>

              {/* Retry payment button if unpaid and not COD */}
              {!isPaid && !isCod && (
                <div className="order-retry-section">
                  <button
                    type="button"
                    className="btn btn-primary btn-block btn-retry-sslcommerz"
                    onClick={handleRetryPayment}
                    disabled={retryingPayment}
                  >
                    <Icon name="shield" size={16} />
                    {retryingPayment ? 'Connecting to SSLCommerz…' : `Pay ${formatCurrency(order.total)} with SSLCommerz`}
                  </button>
                  <small className="order-retry-note">
                    Pay securely using bKash, Nagad, Rocket, or Cards.
                  </small>
                </div>
              )}

              <Link to="/dashboard" className="btn btn-secondary btn-block">
                View My Bookings
              </Link>
              <Link to="/services" className="order-secondary-link">
                Book another service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
