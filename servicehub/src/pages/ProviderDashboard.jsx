import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, uploadProviderPhotos } from '../api/client';
import { useCatalog } from '../context/CatalogContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import Icon from '../components/Icon';
import './ProviderDashboard.css';

const emptyForm = {
  name: '',
  category: '',
  description: '',
  price: '',
  unit: 'session',
  image: '',
  images: [],
  experience: '',
  duration: '',
  availability: '',
  subjects: '',
  includes: ''
};

const ProviderDashboard = () => {
  const { categories, reload: reloadCatalog } = useCatalog();
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState({ completed: 0, pending: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Photo upload states
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [photoMode, setPhotoMode] = useState('pc'); // 'pc' | 'url'
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [serviceData, paymentData] = await Promise.all([
        apiRequest('/provider/services'),
        apiRequest('/provider/payments')
      ]);
      setServices(serviceData.services || []);
      setPayments(paymentData.payments || []);
      setTotals(paymentData.totals || { completed: 0, pending: 0 });
    } catch (requestError) {
      setError(requestError.message || 'Could not load your provider workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!form.category && categories.length) {
      setForm((current) => ({
        ...current,
        category: categories.find((item) => item.id !== 'all')?.id || ''
      }));
    }
  }, [categories, form.category]);

  const activeCount = useMemo(
    () => services.filter((service) => service.isActive).length,
    [services]
  );

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleFiles = async (filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const validFiles = [];

    for (const file of files) {
      if (!allowedMime.includes(file.type)) {
        toast.error(`"${file.name}" is not supported. Please use JPG, PNG, WebP, or GIF.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 10 MB limit.`);
        return;
      }
      validFiles.push(file);
    }

    setUploading(true);
    try {
      const result = await uploadProviderPhotos(validFiles);
      const newUrls = result.urls || (result.url ? [result.url] : []);
      if (!newUrls.length) {
        throw new Error('Upload succeeded but no image URL was returned.');
      }

      setForm((current) => {
        const existing = Array.isArray(current.images)
          ? current.images
          : (current.image ? [current.image] : []);
        const combined = [...existing];
        for (const u of newUrls) {
          if (!combined.includes(u)) combined.push(u);
        }
        return {
          ...current,
          image: combined[0] || '',
          images: combined
        };
      });

      toast.success(
        validFiles.length === 1
          ? 'Photo uploaded from PC'
          : `${validFiles.length} photos uploaded from PC`
      );
    } catch (err) {
      toast.error(err.message || 'Could not upload photo from your PC');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = (e) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        toast.error('Image URL must use HTTPS');
        return;
      }
    } catch (_) {
      toast.error('Please enter a valid image URL');
      return;
    }

    setForm((current) => {
      const existing = Array.isArray(current.images)
        ? current.images
        : (current.image ? [current.image] : []);
      if (existing.includes(url)) {
        toast.error('This image has already been added');
        return current;
      }
      const combined = [...existing, url];
      return {
        ...current,
        image: combined[0] || '',
        images: combined
      };
    });
    setUrlInput('');
    toast.success('Image link added');
  };

  const handleRemovePhoto = (indexToRemove) => {
    setForm((current) => {
      const existing = Array.isArray(current.images)
        ? current.images
        : (current.image ? [current.image] : []);
      const updated = existing.filter((_, idx) => idx !== indexToRemove);
      return {
        ...current,
        image: updated[0] || '',
        images: updated
      };
    });
  };

  const handleSetMainPhoto = (indexToPromote) => {
    if (indexToPromote === 0) return;
    setForm((current) => {
      const existing = [
        ...(Array.isArray(current.images)
          ? current.images
          : (current.image ? [current.image] : []))
      ];
      const [promoted] = existing.splice(indexToPromote, 1);
      existing.unshift(promoted);
      return {
        ...current,
        image: promoted,
        images: existing
      };
    });
    toast.success('Updated main photo');
  };

  const startEditing = (service) => {
    setEditingId(service.id);
    const serviceImages = Array.isArray(service.images) && service.images.length > 0
      ? service.images
      : (service.image ? [service.image] : []);
    setForm({
      name: service.name || '',
      category: service.category || '',
      description: service.description || '',
      price: String(service.price ?? ''),
      unit: service.unit || 'session',
      image: service.image || serviceImages[0] || '',
      images: serviceImages,
      experience: service.experience || '',
      duration: service.duration || '',
      availability: service.availability || '',
      subjects: (service.subjects || []).join(', '),
      includes: (service.includes || []).join(', ')
    });
    setUrlInput('');
    document.getElementById('provider-service-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetForm = () => {
    setEditingId(null);
    setUrlInput('');
    setForm({
      ...emptyForm,
      category: categories.find((item) => item.id !== 'all')?.id || ''
    });
  };

  const submitService = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const currentImages = Array.isArray(form.images) && form.images.length > 0
        ? form.images
        : (form.image ? [form.image] : []);
      const payload = {
        ...form,
        price: Number(form.price),
        image: currentImages[0] || form.image || '',
        images: currentImages,
        subjects: form.subjects.split(',').map((value) => value.trim()).filter(Boolean),
        includes: form.includes.split(',').map((value) => value.trim()).filter(Boolean)
      };
      if (editingId) {
        await apiRequest(`/provider/services/${editingId}`, { method: 'PUT', body: payload });
        toast.success('Service listing updated');
      } else {
        await apiRequest('/provider/services', { method: 'POST', body: payload });
        toast.success('Service listing published');
      }
      resetForm();
      await Promise.all([loadWorkspace(), reloadCatalog()]);
    } catch (requestError) {
      toast.error(requestError.message || 'Could not save this listing');
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (service) => {
    try {
      const result = await apiRequest(`/provider/services/${service.id}/availability`, {
        method: 'PATCH',
        body: { isActive: !service.isActive }
      });
      setServices((current) =>
        current.map((item) =>
          item.id === service.id ? { ...item, isActive: result.isActive } : item
        )
      );
      await reloadCatalog();
      toast.success(result.isActive ? 'Listing is live' : 'Listing paused');
    } catch (requestError) {
      toast.error(requestError.message || 'Could not update listing availability');
    }
  };

  const currentPhotos = Array.isArray(form.images) && form.images.length > 0
    ? form.images
    : (form.image ? [form.image] : []);

  return (
    <div className="provider-page">
      <div className="container">
        <div className="provider-heading">
          <div>
            <span className="provider-eyebrow">SERVICE PROVIDER</span>
            <h1>Provider workspace</h1>
            <p>Manage your service listings and track booking earnings.</p>
          </div>
          <Link className="btn btn-secondary" to="/services">
            View marketplace
          </Link>
        </div>

        {error && (
          <div className="provider-error" role="alert">
            {error}
            <button onClick={loadWorkspace}>Try again</button>
          </div>
        )}

        <div className="provider-stats">
          <article className="provider-stat">
            <Icon name="package" />
            <span>Active listings</span>
            <strong>{activeCount}</strong>
          </article>
          <article className="provider-stat">
            <Icon name="clock" />
            <span>Pending booking value</span>
            <strong>{formatCurrency(totals.pending)}</strong>
          </article>
          <article className="provider-stat">
            <Icon name="check-circle" />
            <span>Completed booking value</span>
            <strong>{formatCurrency(totals.completed)}</strong>
          </article>
        </div>

        <section className="provider-panel" id="provider-service-form">
          <div className="provider-section-heading">
            <div>
              <h2>{editingId ? 'Edit service' : 'Add a service'}</h2>
              <p>Describe what customers can book from you.</p>
            </div>
            {editingId && (
              <button className="btn btn-secondary" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
          <form className="provider-form" onSubmit={submitService}>
            <label>
              Service name
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                maxLength="120"
                required
                placeholder="e.g. Professional Deep Cleaning"
              />
            </label>
            <label>
              Category
              <select name="category" value={form.category} onChange={updateField} required>
                {categories
                  .filter((category) => category.id !== 'all')
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="provider-form-wide">
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                minLength="20"
                maxLength="5000"
                rows="4"
                required
                placeholder="Explain what the service includes and who it is for."
              />
            </label>
            <label>
              Price
              <input
                name="price"
                type="number"
                min="1"
                step="0.01"
                value={form.price}
                onChange={updateField}
                required
              />
            </label>
            <label>
              Price unit
              <input
                name="unit"
                value={form.unit}
                onChange={updateField}
                maxLength="40"
                required
                placeholder="hour, visit, session"
              />
            </label>
            <label>
              Experience
              <input
                name="experience"
                value={form.experience}
                onChange={updateField}
                maxLength="80"
                placeholder="5 years"
              />
            </label>
            <label>
              Duration
              <input
                name="duration"
                value={form.duration}
                onChange={updateField}
                maxLength="80"
                placeholder="About 2 hours"
              />
            </label>
            <label>
              Availability
              <input
                name="availability"
                value={form.availability}
                onChange={updateField}
                maxLength="160"
                placeholder="Weekdays, 9 AM–5 PM"
              />
            </label>

            {/* Service Photos Management Section */}
            <div className="provider-photos-section provider-form-wide">
              <div className="provider-photos-header">
                <div>
                  <span className="provider-photos-title">Service photos</span>
                  <p className="provider-photos-subtitle">
                    Upload pictures from your computer or add an image link. The first photo will be used as the main cover.
                  </p>
                </div>
                <div className="provider-photo-tabs" role="tablist">
                  <button
                    type="button"
                    className={`provider-photo-tab ${photoMode === 'pc' ? 'is-active' : ''}`}
                    onClick={() => setPhotoMode('pc')}
                  >
                    <Icon name="upload" size={16} />
                    Upload from PC
                  </button>
                  <button
                    type="button"
                    className={`provider-photo-tab ${photoMode === 'url' ? 'is-active' : ''}`}
                    onClick={() => setPhotoMode('url')}
                  >
                    <Icon name="image" size={16} />
                    Image link
                  </button>
                </div>
              </div>

              {photoMode === 'pc' ? (
                <div
                  className={`provider-dropzone ${dragOver ? 'is-dragover' : ''} ${uploading ? 'is-uploading' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.length) {
                      handleFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        handleFiles(e.target.files);
                      }
                    }}
                  />
                  {uploading ? (
                    <div className="provider-dropzone-loading">
                      <div className="spinner" />
                      <span>Uploading photo(s) from your PC…</span>
                    </div>
                  ) : (
                    <div className="provider-dropzone-content">
                      <span className="provider-dropzone-icon">
                        <Icon name="upload" size={28} />
                      </span>
                      <p className="provider-dropzone-text">
                        <strong>Choose photos from your PC</strong> or drag and drop here
                      </p>
                      <small className="provider-dropzone-hint">
                        JPG, PNG, WebP, or GIF up to 10 MB each. You can select multiple photos.
                      </small>
                    </div>
                  )}
                </div>
              ) : (
                <div className="provider-url-box">
                  <div className="provider-url-row">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste image HTTPS URL (e.g. https://images.unsplash.com/...)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddUrl(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAddUrl}
                      disabled={!urlInput.trim()}
                    >
                      Add image link
                    </button>
                  </div>
                </div>
              )}

              {/* Photo gallery preview */}
              {currentPhotos.length > 0 ? (
                <div className="provider-photo-gallery">
                  <div className="provider-gallery-label">
                    <span>{currentPhotos.length} {currentPhotos.length === 1 ? 'photo' : 'photos'} attached</span>
                    <small>Click "Set as main" to change the cover photo</small>
                  </div>
                  <div className="provider-photo-grid">
                    {currentPhotos.map((photoUrl, index) => (
                      <div key={`${photoUrl}-${index}`} className="provider-photo-item">
                        <div className="provider-photo-preview-wrap">
                          <img src={photoUrl} alt={`Service preview ${index + 1}`} />
                          {index === 0 && (
                            <span className="provider-photo-main-badge">
                              <Icon name="star" size={12} /> Main photo
                            </span>
                          )}
                          <div className="provider-photo-actions-overlay">
                            {index !== 0 && (
                              <button
                                type="button"
                                className="provider-photo-set-main-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetMainPhoto(index);
                                }}
                                title="Make this the main cover photo"
                              >
                                Set as main
                              </button>
                            )}
                            <button
                              type="button"
                              className="provider-photo-remove-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePhoto(index);
                              }}
                              title="Remove this photo"
                              aria-label="Remove photo"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="provider-photo-empty-hint">
                  <Icon name="image" size={18} />
                  <span>No photos added yet. Upload at least one photo from your computer to show customers what you offer.</span>
                </div>
              )}
            </div>

            <label>
              Subjects or specialties
              <input
                name="subjects"
                value={form.subjects}
                onChange={updateField}
                placeholder="Math, physics"
              />
            </label>
            <label>
              What's included
              <input
                name="includes"
                value={form.includes}
                onChange={updateField}
                placeholder="Materials, consultation"
              />
            </label>
            <div className="provider-form-actions provider-form-wide">
              <button className="btn btn-primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Publish service'}
              </button>
            </div>
          </form>
        </section>

        <section className="provider-panel">
          <div className="provider-section-heading">
            <div>
              <h2>Your services</h2>
              <p>Paused listings are hidden from customers.</p>
            </div>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : services.length === 0 ? (
            <div className="provider-empty">
              <Icon name="package" size={30} />
              <p>You have not published a service yet.</p>
            </div>
          ) : (
            <div className="provider-listings">
              {services.map((service) => (
                <article className="provider-listing" key={service.id}>
                  {service.image ? (
                    <img src={service.image} alt={service.name} />
                  ) : (
                    <span className="provider-listing-placeholder">
                      <Icon name="package" />
                    </span>
                  )}
                  <div className="provider-listing-info">
                    <span className={`provider-status ${service.isActive ? 'is-live' : ''}`}>
                      {service.isActive ? 'Live' : 'Paused'}
                    </span>
                    <h3>{service.name}</h3>
                    <p>
                      {service.category} · {formatCurrency(service.price)} / {service.unit}
                      {Array.isArray(service.images) && service.images.length > 1 && (
                        <span> · {service.images.length} photos</span>
                      )}
                    </p>
                  </div>
                  <div className="provider-listing-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startEditing(service)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => toggleAvailability(service)}
                    >
                      {service.isActive ? 'Pause' : 'Publish'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="provider-panel">
          <div className="provider-section-heading">
            <div>
              <h2>Payments and earnings</h2>
              <p>Estimated service value from your bookings. Amounts exclude tax.</p>
            </div>
          </div>
          <p className="provider-payment-note">
            Checkout currently records demo bookings only. ServiceHub does not process real charges or provider payouts yet.
          </p>
          {loading ? (
            <div className="spinner" />
          ) : payments.length === 0 ? (
            <div className="provider-empty">
              <Icon name="dollar" size={30} />
              <p>Payments will appear when customers book your services.</p>
            </div>
          ) : (
            <div className="provider-payments-wrap">
              <table className="provider-payments">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Service</th>
                    <th>Payment method</th>
                    <th>Status</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr key={`${payment.orderId}-${index}`}>
                      <td>#{payment.orderId}</td>
                      <td>
                        {payment.serviceName} × {payment.quantity}
                      </td>
                      <td>{payment.paymentMethod}</td>
                      <td>{payment.status.replace('_', ' ')}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProviderDashboard;
