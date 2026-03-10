import axios from 'axios';

// Determine API base URL:
// 1. Use explicit env var if set at build time
// 2. If running on the Render frontend domain, point to the Render backend
// 3. Otherwise fall back to /api (local dev via proxy)
function getBaseURL() {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://gse-analyser-server.onrender.com/api';
  }
  return '/api';
}

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gse_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gse_token');
    }
    // If request was blob but server returned a JSON error, parse it so callers see a real message
    if (err.response?.data instanceof Blob && err.response.data.type?.includes('json')) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        err.message = json.error || json.message || err.message;
      } catch (_) {}
    }
    return Promise.reject(err);
  }
);

export default api;
