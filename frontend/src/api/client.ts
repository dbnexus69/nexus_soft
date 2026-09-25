import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Evento que se emite cuando una petición CON sesión recibe un 401: la sesión
 * caducó o se cerró. `AuthContext` lo escucha y saca al usuario al login.
 *
 * Antes solo se borraba el token de `localStorage`, pero React seguía creyendo
 * que había alguien dentro: la pantalla seguía pidiendo datos, todo daba 401 y
 * nunca se llegaba al login. El login fallido no cuenta: no lleva token.
 */
export const SESION_CADUCADA = 'nexus:sesion-caducada';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexus_token');
      localStorage.removeItem('nexus_user');
      localStorage.removeItem('nexus_session_expiry');
      // El 401 del propio logout (sesión ya caducada) no es un aviso que dar:
      // el usuario pidió salir.
      if (error.config?.headers?.Authorization && !String(error.config?.url || '').endsWith('/auth/logout')) {
        window.dispatchEvent(new CustomEvent(SESION_CADUCADA, {
          detail: { mensaje: error.response?.data?.error?.message },
        }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
