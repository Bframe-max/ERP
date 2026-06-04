import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: si recibe 401, limpia la sesión local
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Limpiar sesión local
      localStorage.removeItem('zeltek-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
