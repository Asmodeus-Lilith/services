// pages/Cart.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import './Cart.css';

const Cart = () => {
  const { items, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart();
  const { toast } = useToast();

  const handleRemove = (item) => {
    removeFromCart(item.id);
    toast.info(`${item.name} removed from cart`);
  };

  const handleClearCart = () => {
    clearCart();
    toast.info('Cart cleared');
  };

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <div className="empty-cart">
            <span className="empty-icon">
              <Icon name="cart" size={32} />
            </span>
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added any services yet</p>
            <Link to="/services" className="btn btn-primary">
              Browse Services
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = getCartTotal();
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + tax;

  return (
    <div className="cart-page">
      <div className="container">
        <h1 className="page-title">Shopping Cart</h1>
        <p className="page-subtitle">{items.length} items in your cart</p>

        <div className="cart-layout">
          <div className="cart-items">
            {items.map(item => (
              <div key={item.id} className="cart-item">
                <img src={item.image} alt={item.name} className="cart-item-image" />
                <div className="cart-item-info">
                  <span className="cart-item-category">{item.category}</span>
                  <h3 className="cart-item-name">{item.name}</h3>
                  <p className="cart-item-provider">by {item.provider}</p>
                </div>
                <div className="cart-item-actions">
                  <div className="cart-item-price">
                    BDT{item.price * item.quantity}
                  </div>
                  <div className="quantity-selector">
                    <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>
                      <Icon name="minus" size={12} />
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemove(item)}
                  >
                    <Icon name="trash" size={14} />
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <button className="clear-cart-btn" onClick={handleClearCart}>
              Clear Cart
            </button>
          </div>

          <div className="cart-summary">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>BDT{subtotal}</span>
            </div>
            <div className="summary-row">
              <span>Tax (18%)</span>
              <span>BDT{tax}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>BDT{total}</span>
            </div>
            <Link to="/checkout" className="btn btn-primary btn-block">
              Proceed to Checkout
            </Link>
            <Link to="/services" className="continue-shopping">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
