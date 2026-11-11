// components/Toast.jsx
import React from 'react';
import Icon from './Icon';
import './Toast.css';

const ICONS = {
  success: 'check-circle',
  error: 'alert',
  info: 'info'
};

const ToastViewport = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map(item => (
        <div key={item.id} className={`toast toast-${item.type}`}>
          <span className="toast-icon">
            <Icon name={ICONS[item.type] || ICONS.info} size={14} />
          </span>
          <span className="toast-message">{item.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(item.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastViewport;
