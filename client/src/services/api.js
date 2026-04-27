import axios from 'axios';

// In dev: use relative URL → Vite proxy forwards to deployed server → no CORS
// In prod (Electron file:// or built): use absolute deployed URL
const isElectronProd = window.location.protocol === 'file:';
const API_BASE = isElectronProd
  ? 'https://federated-learning-skin-cancer-prediction.onrender.com/api'
  : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const predictionService = {
  submitPrediction: (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return api.post('/predictions/predict', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  batchPrediction: (imageFiles) => {
    const formData = new FormData();
    imageFiles.forEach((file) => formData.append('images', file));
    return api.post('/predictions/batch', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getPredictionHistory: (page = 1, limit = 10, filters = {}) =>
    api.get('/predictions/history', {
      params: { page, limit, ...filters },
    }),
  getPredictionById: (id) => api.get(`/predictions/${id}`),
  getStatistics: () => api.get('/predictions/stats'),
};

export const flService = {
  getAllRounds: (page = 1, limit = 10) =>
    api.get('/federated-learning/rounds', { params: { page, limit } }),
  getRoundDetails: (id) => api.get(`/federated-learning/rounds/${id}`),
  initiateRound: (data) => api.post('/federated-learning/rounds/initiate', data),
  stopRound: (data) => api.post('/federated-learning/rounds/stop', data),
  updateClientResults: (roundId, data) =>
    api.put(`/federated-learning/rounds/${roundId}/update-client`, data),
  completeRound: (roundId, data) =>
    api.put(`/federated-learning/rounds/${roundId}/complete`, data),
  getAnalytics: () => api.get('/federated-learning/analytics'),
};

export const systemService = {
  getHealth: () => api.get('/health'),
  getMLHealth: () => api.get('/health/ml'),
  getFLHealth: () => api.get('/health/fl'),
  getModelInfo: () => api.get('/model/info'),
  getClasses: () => api.get('/classes'),
};

export default api;
