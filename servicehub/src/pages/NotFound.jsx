// pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  return (
    <div className="notfound-page">
      <div className="container">
        <div className="notfound-card">
          <div className="notfound-code">404</div>
          <h1 className="notfound-title">This page took the day off</h1>
          <p className="notfound-text">
            The page you're looking for doesn't exist or may have been moved.
            Let's get you back to booking.
          </p>
          <div className="notfound-actions">
            <Link to="/" className="btn btn-primary">
              Back to Home
            </Link>
            <Link to="/services" className="btn btn-secondary">
              Browse Services
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
