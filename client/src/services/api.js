import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
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
