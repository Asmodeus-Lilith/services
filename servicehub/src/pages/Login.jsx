// pages/Login.jsx
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('customer');
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Set by ProtectedRoute so the user lands back where they were headed.
  const redirectTo = location.state?.from?.pathname ||
    (loginType === 'provider' ? '/provider/dashboard' : '/dashboard');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, loginType);
      toast.success('Welcome back!');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email || 'admin@servicehub.local', password, 'admin');
      toast.success('Welcome back, Admin!');
      navigate('/admin/orders', { replace: true });
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
            <h1>Welcome Back</h1>
            <p>Sign in to continue to ServiceHub</p>
          </div>

          {location.state?.from && !error && (
            <div className="auth-notice">
              Please sign in to continue to that page.
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          {/* Choose the account type to sign in to. */}
          <div className="user-type-selector login-type-selector">
            <button
              type="button"
              className={`user-type-btn ${loginType === 'customer' ? 'active' : ''}`}
              onClick={() => { setLoginType('customer'); setError(''); }}
            >
              <Icon name="user" size={16} />
              Customer
            </button>
            <button
              type="button"
              className={`user-type-btn ${loginType === 'provider' ? 'active' : ''}`}
              onClick={() => { setLoginType('provider'); setError(''); }}
            >
              <Icon name="wrench" size={16} />
              Provider
            </button>
            <button
              type="button"
              className={`user-type-btn ${loginType === 'admin' ? 'active' : ''}`}
              onClick={() => { setLoginType('admin'); setError(''); if (!email) setEmail('admin@servicehub.local'); }}
            >
              <Icon name="settings" size={16} />
              Admin
            </button>
          </div>

          {loginType === 'admin' ? (
            <form onSubmit={handleAdminLogin}>
              <div className="form-group">
                <label>Admin Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@servicehub.local"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In as Admin'}
              </button>
              <p className="auth-footer" style={{ marginTop: 12 }}>
                Demo credentials: admin@servicehub.local / admin123
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" /> Remember me
                </label>
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                  {loading ? 'Signing in...' : loginType === 'provider' ? 'Sign In as Provider' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="social-auth">
            <button className="social-btn">Google</button>
            <button className="social-btn">Facebook</button>
          </div>

          <p className="auth-footer">
            Don't have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
