import React, { useState, useRef } from 'react';
import API from '../api/axios';
import '../styles/login.css';

export default function Login({ onLogin, onSwitchToSignup, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const formRef = useRef(null);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const getEmailError = () => {
    if (!touched.email) return '';
    if (!email.trim()) return 'Email is required';
    if (!validateEmail(email)) return 'Please enter a valid email';
    return '';
  };

  const getPasswordError = () => {
    if (!touched.password) return '';
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const isFormValid = email && password && !getEmailError() && !getPasswordError();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isFormValid) {
      setTouched({ email: true, password: true });
      return;
    }

    setIsLoading(true);
    try {
      const res = await API.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      const { access_token, role, email: userEmail } = res.data;
      onLogin(access_token, { email: userEmail, role });
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. Check that the backend is running.');
      } else {
        const detail = err.response.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    alert('Password reset functionality coming soon!');
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>

      <div className="login-card">
        <div className="login-header">
          <div className="logo">S</div>
          <h1>SwiftLogistics</h1>
          <p>Sign in to manage parcels</p>
        </div>

        {notice && (
          <div
            className="error-alert"
            role="status"
            style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
          >
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="error-alert" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                placeholder="you@example.com"
                className={`form-input ${touched.email && getEmailError() ? 'error' : ''}`}
                disabled={isLoading}
                autoComplete="email"
              />
              {touched.email && getEmailError() && (
                <span className="field-error">{getEmailError()}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <div className="password-input-container">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  placeholder="••••••••"
                  className={`form-input ${touched.password && getPasswordError() ? 'error' : ''}`}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
              </div>
              {touched.password && getPasswordError() && (
                <span className="field-error">{getPasswordError()}</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Logging in...
              </>
            ) : (
              'Log in'
            )}
          </button>

          <button
            type="button"
            className="forgot-password-link"
            onClick={handleForgotPassword}
            disabled={isLoading}
          >
            Forgot password?
          </button>

          <button
            type="button"
            className="forgot-password-link"
            onClick={onSwitchToSignup}
            disabled={isLoading}
          >
            Create a new account
          </button>
        </form>

        <div className="login-footer">
          <p>SwiftLogistics © 2024 | All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
