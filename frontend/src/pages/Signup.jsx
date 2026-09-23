import React, { useState } from 'react';
import API from '../api/axios';
import '../styles/login.css';

export default function Signup({ onSwitchToLogin, onSignupSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await API.post('/api/auth/signup', { email: cleanEmail, password });
      onSignupSuccess('Account created. The admin must approve it before you can log in.');
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. Check that the backend is running.');
      } else {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail) && detail.length) {
          setError(detail[0].msg);
        } else {
          setError('Signup failed. Please try again.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>

      <div className="login-card">
        <div className="login-header">
          <div className="logo">S</div>
          <h1>Create account</h1>
          <p>The admin approves new accounts before they can log in</p>
        </div>

        {error && (
          <div className="error-alert" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="signup-email">Email</label>
            <div className="input-wrapper">
              <input
                id="signup-email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password</label>
            <div className="input-wrapper">
              <input
                id="signup-password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-confirm">Confirm password</label>
            <div className="input-wrapper">
              <input
                id="signup-confirm"
                type="password"
                className="form-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Creating account...
              </>
            ) : (
              'Sign up'
            )}
          </button>

          <button
            type="button"
            className="forgot-password-link"
            onClick={onSwitchToLogin}
            disabled={isLoading}
          >
            Already have an account? Log in
          </button>
        </form>
      </div>
    </div>
  );
}
