// pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'customer'
  });
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 180 * 1024) {
      setError('Profile photos must be 180 KB or smaller.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.onerror = () => setError('Could not read that image. Please try another.');
    reader.readAsDataURL(file);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(
        formData.name,
        formData.email,
        formData.password,
        formData.userType,
        avatar || null
      );
      toast.success(`Welcome to ServiceHub, ${formData.name.split(' ')[0]}!`);
      navigate(formData.userType === 'provider' ? '/provider/dashboard' : '/dashboard');
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Create Account</h1>
            <p>Join ServiceHub and start booking services</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="user-type-selector">
            <button
              type="button"
              className={`user-type-btn ${formData.userType === 'customer' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, userType: 'customer' })}
            >
              <Icon name="user" size={16} />
              Customer
            </button>
            <button
              type="button"
              className={`user-type-btn ${formData.userType === 'provider' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, userType: 'provider' })}
            >
              <Icon name="wrench" size={16} />
              Service Provider
            </button>
            <button
              type="button"
              className={`user-type-btn ${formData.userType === 'admin' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, userType: 'admin' })}
            >
              <Icon name="settings" size={16} />
              Admin
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group profile-photo-field">
              <label htmlFor="profile-photo">Profile photo (optional)</label>
              <div className="profile-photo-picker">
                {avatar ? (
                  <img className="profile-photo-preview" src={avatar} alt="Profile preview" />
                ) : (
                  <span className="profile-photo-placeholder" aria-hidden="true">
                    <Icon name="user" size={28} />
                  </span>
                )}
                <div>
                  <input
                    id="profile-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                  />
                  <small>JPG, PNG, or WebP · up to 180 KB</small>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
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
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <PasswordInput
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <PasswordInput
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
