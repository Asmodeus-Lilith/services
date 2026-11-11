// pages/Services.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useCatalog } from '../context/CatalogContext';
import ServiceCard from '../components/ServiceCard';
import Icon from '../components/Icon';
import './Services.css';

const CATEGORY_ICONS = {
  tuition: 'book',
  cleaning: 'droplet',
  salon: 'scissors',
  repair: 'wrench',
  plumbing: 'wrench',
};

const Services = () => {
  const { category } = useParams();
  const location = useLocation();
  const { services, categories, loading, error } = useCatalog();
  const [filteredServices, setFilteredServices] = useState([]);
  const [activeCategory, setActiveCategory] = useState(category || 'all');
  const [sortBy, setSortBy] = useState('popular');
  const [priceRange, setPriceRange] = useState([0, 20000]);
  const [searchQuery, setSearchQuery] = useState('');

  // The navbar passes its submitted term in navigation state.
  useEffect(() => {
    setSearchQuery(typeof location.state?.search === 'string' ? location.state.search : '');
  }, [location.key, location.state]);

  // Filter and sort client-side
  useEffect(() => {
    let result = [...services];

    // Filter by category
    if (activeCategory !== 'all') {
      result = result.filter(s => s.category === activeCategory);
    }

    // Filter by price
    result = result.filter(s => s.price >= priceRange[0] && s.price <= priceRange[1]);

    // Filter by search (additional client-side search)
    if (searchQuery) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
      default:
        result.sort((a, b) => b.reviews - a.reviews);
    }

    setFilteredServices(result);
  }, [services, activeCategory, sortBy, priceRange, searchQuery]);

  useEffect(() => {
    setActiveCategory(category || 'all');
  }, [category]);

  const clearFilters = () => {
    setActiveCategory('all');
    setSortBy('popular');
    setPriceRange([0, 20000]);
    setSearchQuery('');
  };

  return (
    <div className="services-page">
      <div className="container">
        {/* Header */}
        <div className="services-header">
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Services</span>
            {activeCategory !== 'all' && (
              <>
                <span>/</span>
                <span>{categories.find(c => c.id === activeCategory)?.name}</span>
              </>
            )}
          </div>
          <h1 className="page-title">
            {activeCategory === 'all'
              ? 'All Services'
              : categories.find(c => c.id === activeCategory)?.name || 'Services'}
          </h1>
          <p className="page-subtitle">
            {loading
              ? 'Loading services…'
              : `${filteredServices.length} services available`}
          </p>
        </div>

        <div className="services-layout">
          {/* Sidebar Filters */}
          <aside className="filters-sidebar">
            <div className="filter-section">
              <h3>Search</h3>
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-section">
              <h3>Categories</h3>
              <div className="filter-options">
                {categories.map(cat => (
                  <label key={cat.id} className="filter-option">
                    <input
                      type="radio"
                      name="category"
                      value={cat.id}
                      checked={activeCategory === cat.id}
                      onChange={(e) => setActiveCategory(e.target.value)}
                    />
                    <Icon name={CATEGORY_ICONS[cat.id] || 'sparkles'} size={14} />
                    <span>{cat.name}</span>
                    <span className="filter-count">{cat.count}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h3>Price Range</h3>
              <div className="price-inputs">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                />
              </div>
            </div>

            <button className="btn btn-secondary clear-btn" onClick={clearFilters}>
              Clear All Filters
            </button>
          </aside>

          {/* Services Grid */}
          <div className="services-content">
            <div className="services-toolbar">
              <span className="results-count">
                Showing {filteredServices.length} results
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>

            {loading ? (
              <div className="spinner" />
            ) : error ? (
              <div className="no-results">
                <span className="no-results-icon">
                  <Icon name="alert" size={28} />
                </span>
                <h3>Couldn't load services</h3>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="no-results">
                <span className="no-results-icon">
                  <Icon name="search" size={28} />
                </span>
                <h3>No services found</h3>
                <p>Try adjusting your filters or search query</p>
                <button className="btn btn-primary" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="services-grid">
                {filteredServices.map(service => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;
