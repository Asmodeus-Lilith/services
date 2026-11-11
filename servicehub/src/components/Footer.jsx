// components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-section">
            <h3 className="footer-title">
              <span className="logo-icon">
                <Icon name="home" size={18} />
              </span>
              ServiceHub
            </h3>
            <p className="footer-description">
              Your one-stop destination for all home and personal services. 
              Book trusted professionals for tuition, cleaning, salon, and more.
            </p>
            <div className="social-links">
              <a href="#" aria-label="Facebook">
                <Icon name="facebook" size={16} />
              </a>
              <a href="#" aria-label="Twitter">
                <Icon name="twitter" size={16} />
              </a>
              <a href="#" aria-label="Instagram">
                <Icon name="instagram" size={16} />
              </a>
              <a href="#" aria-label="LinkedIn">
                <Icon name="linkedin" size={16} />
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h4 className="footer-heading">Services</h4>
            <ul className="footer-links">
              <li><Link to="/services/tuition">Home Tuition</Link></li>
              <li><Link to="/services/cleaning">Home Cleaning</Link></li>
              <li><Link to="/services/salon">Salon at Home</Link></li>
              <li><Link to="/services/repair">Appliance Repair</Link></li>
              <li><Link to="/services/plumbing">Plumbing</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-heading">Company</h4>
            <ul className="footer-links">
              <li><Link to="/about">About</Link></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Press</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-heading">Support</h4>
            <ul className="footer-links">
              <li><a href="#">Help Center</a></li>
              <li><a href="#">Safety</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Cancellation</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} ServiceHub. All rights reserved.</p>
          <div className="payment-methods">
            <span><Icon name="credit-card" size={16} /></span>
            <span><Icon name="bank" size={16} /></span>
            <span><Icon name="smartphone" size={16} /></span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
