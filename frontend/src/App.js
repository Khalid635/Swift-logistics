import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import TrackingPage from './pages/TrackingPage';
import API from './api/axios';
import './styles/global.css';

// The public tracking page lives at /#/track, so no router or server setup is needed.
const isTrackHash = () => window.location.hash.startsWith('#/track');

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminData, setAdminData] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [notice, setNotice] = useState('');
  const [showTracking, setShowTracking] = useState(isTrackHash());

  useEffect(() => {
    const onHashChange = () => setShowTracking(isTrackHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // On page load, check the saved token with the backend
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await API.get('/api/auth/me');
        setAdminData(res.data);
        setIsLoggedIn(true);
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Login.jsx passes the real token from the backend
  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setAdminData(userData);
    setNotice('');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAdminData(null);
    setAuthView('login');
    setIsLoggedIn(false);
  };

  const handleSignupSuccess = (message) => {
    setNotice(message);
    setAuthView('login');
  };

  // Public page: anyone can open it, logged in or not
  if (showTracking) {
    return <TrackingPage onBack={() => { window.location.hash = ''; }} />;
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="app-container">
        <Dashboard adminData={adminData} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <a
        href="#/track"
        className="fixed right-4 top-4 z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 no-underline shadow-lg hover:bg-blue-50"
      >
        Track a parcel
      </a>

      {authView === 'signup' ? (
        <Signup
          onSwitchToLogin={() => setAuthView('login')}
          onSignupSuccess={handleSignupSuccess}
        />
      ) : (
        <Login
          onLogin={handleLogin}
          onSwitchToSignup={() => {
            setNotice('');
            setAuthView('signup');
          }}
          notice={notice}
        />
      )}
    </div>
  );
}
