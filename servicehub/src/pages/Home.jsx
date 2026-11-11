// pages/Home.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ServiceCard from '../components/ServiceCard';
import Icon from '../components/Icon';
import './Home.css';

const CATEGORY_ICONS = {
  tuition: 'book',
  cleaning: 'droplet',
  salon: 'scissors',
  repair: 'wrench',
  plumbing: 'wrench',
};

const Home = () => {
  const { services, categories, loading, error } = useCatalog();
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredServices = activeCategory === 'all'
    ? services.slice(0, 8)
    : services.filter(s => s.category === activeCategory).slice(0, 8);

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Book Trusted Services at Your <span className="highlight">Doorstep</span>
          </h1>
          <p className="hero-subtitle">
            From home tuition to cleaning, salon to repairs - get verified professionals 
            for all your needs. Book in minutes, pay securely.
          </p>
          <div className="hero-actions">
            <Link to="/services" className="btn btn-primary btn-lg">
              Explore Services
            </Link>
            <Link to="/register" className="btn btn-secondary btn-lg">
              Become a Provider
            </Link>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-number">10K+</span>
              <span className="stat-label">Happy Customers</span>
            </div>
            <div className="stat">
              <span className="stat-number">500+</span>
              <span className="stat-label">Verified Providers</span>
            </div>
            <div className="stat">
              <span className="stat-number">50+</span>
              <span className="stat-label">Cities Covered</span>
            </div>
          </div>
        </div>
        <div className="hero-image">
          <img 
            src="https://images.unsplash.com/photo-1556911220-bff31c812dba?w=600" 
            alt="Home Services"
          />
          <div className="floating-card card-1">
            <span className="floating-icon">
              <Icon name="star" size={14} />
            </span>
            <span>4.9 Rating</span>
          </div>
          <div className="floating-card card-2">
            <span className="floating-icon">
              <Icon name="check-circle" size={14} />
            </span>
            <span>Verified Pros</span>
          </div>
          <div className="floating-card card-3">
            <span className="floating-icon">
              <Icon name="shield" size={14} />
            </span>
            <span>Secure Payment</span>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories-section">
        <div className="container">
          <h2 className="section-title">What Service Do You Need?</h2>
          <p className="section-subtitle">Choose from our wide range of professional services</p>
          
          <div className="categories-grid">
            {categories.filter(c => c.id !== 'all').map(category => (
              <Link
                key={category.id}
                to={`/services/${category.id}`}
                className="category-card"
              >
                <span className="category-icon">
                  <Icon name={CATEGORY_ICONS[category.id] || 'sparkles'} size={28} />
                </span>
                <h3 className="category-name">{category.name}</h3>
                <span className="category-count">{category.count} services</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="featured-section">
        <div className="container">
          <h2 className="section-title">Popular Services</h2>
          <p className="section-subtitle">Most booked services by our customers</p>
          
          <div className="category-tabs">
            {categories.slice(0, 5).map(category => (
              <button
                key={category.id}
                className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                <Icon name={CATEGORY_ICONS[category.id] || 'sparkles'} size={14} />
                {category.name}
              </button>
            ))}
          </div>

          <div className="grid grid-4">
            {loading && <div className="spinner" />}

            {!loading && error && (
              <p className="section-subtitle">
                We couldn't load the catalogue right now. Please refresh to try
                again.
              </p>
            )}

            {!loading &&
              !error &&
              filteredServices.map(service => (
                <ServiceCard key={service.id} service={service} />
              ))}
          </div>

          <div className="view-all">
            <Link to="/services" className="btn btn-primary">
              View All Services
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Book your service in 3 simple steps</p>
          
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-icon">
                <Icon name="search" size={32} />
              </div>
              <h3>Search & Select</h3>
              <p>Browse through our services and find what you need</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-icon">
                <Icon name="calendar" size={32} />
              </div>
              <h3>Book & Schedule</h3>
              <p>Choose your preferred time and book instantly</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-icon">
                <Icon name="sparkles" size={32} />
              </div>
              <h3>Get Service Done</h3>
              <p>Professional arrives at your doorstep and completes the job</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="why-us">
        <div className="container">
          <h2 className="section-title">Why Choose ServiceHub?</h2>
          
          <div className="features-grid">
            <div className="feature">
              <span className="feature-icon">
                <Icon name="check-circle" size={24} />
              </span>
              <h3>Verified Professionals</h3>
              <p>All our service providers are background verified and trained</p>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Icon name="dollar" size={24} />
              </span>
              <h3>Best Prices</h3>
              <p>Competitive pricing with no hidden charges</p>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Icon name="zap" size={24} />
              </span>
              <h3>Quick Booking</h3>
              <p>Book a service in under 2 minutes</p>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Icon name="shield" size={24} />
              </span>
              <h3>Secure Payments</h3>
              <p>Multiple payment options with 100% security</p>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Icon name="award" size={24} />
              </span>
              <h3>Service Guarantee</h3>
              <p>100% satisfaction guarantee or redo service</p>
            </div>
            <div className="feature">
              <span className="feature-icon">
                <Icon name="phone" size={24} />
              </span>
              <h3>24/7 Support</h3>
              <p>Round the clock customer support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="container">
          <h2 className="section-title">What Our Customers Say</h2>
          
          <div className="grid grid-3">
            <div className="testimonial-card">
              <div className="testimonial-rating">
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
              </div>
              <p className="testimonial-text">
                "Amazing service! The math tutor was very patient and knowledgeable. 
                My daughter's grades improved significantly."
              </p>
              <div className="testimonial-author">
                <img src="https://i.pravatar.cc/50?img=5" alt="Customer" />
                <div>
                  <strong>Ritu Sharma</strong>
                  <span>Delhi</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-rating">
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
              </div>
              <p className="testimonial-text">
                "The deep cleaning service was exceptional. My home looks brand new! 
                Very professional and thorough team."
              </p>
              <div className="testimonial-author">
                <img src="https://i.pravatar.cc/50?img=8" alt="Customer" />
                <div>
                  <strong>Amit Patel</strong>
                  <span>Mumbai</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card">
              <div className="testimonial-rating">
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
                <Icon name="star" size={16} />
              </div>
              <p className="testimonial-text">
                "Booked salon services for my wedding. The makeup artist was brilliant! 
                Highly recommend ServiceHub."
              </p>
              <div className="testimonial-author">
                <img src="https://i.pravatar.cc/50?img=9" alt="Customer" />
                <div>
                  <strong>Priya Singh</strong>
                  <span>Bangalore</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Are You a Service Provider?</h2>
            <p>Join our platform and grow your business. Reach thousands of customers.</p>
            <Link to="/register" className="btn btn-primary btn-lg">
              Register as Provider
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
