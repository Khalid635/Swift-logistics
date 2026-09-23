import axios from 'axios';

// Locally this is the FastAPI server on your computer. On the live site we set
// REACT_APP_API_URL to the live backend address (no trailing slash).
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000',
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Log out when the token stops working, or when the admin blocks the account.
// Wrong passwords on the login and signup screens must not reload the page.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthRequest = url.includes('/api/auth/login') || url.includes('/api/auth/signup');
    const status = error.response?.status;
    const detail = String(error.response?.data?.detail || '');
    const accountLocked =
      status === 403 && (detail.includes('blocked') || detail.includes('waiting for admin approval'));

    if ((status === 401 || accountLocked) && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default API;
