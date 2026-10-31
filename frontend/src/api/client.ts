import axios from 'axios';
import { haySesionLocal } from '../utils/sesionLocal';

// Por defecto, el mismo sitio que la página: en Vercel un rewrite reenvía `/api` a Render y en local lo hace
// el proxy de Vite. Así la cookie de sesión es del propio sitio y `SameSite=Strict` funciona (spec 035).
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

/**
 * Evento que se emite cuando una petición CON sesión recibe un 401: la sesión
 * caducó o se cerró. `AuthContext` lo escucha y saca al usuario al login.
 *
 * Antes solo se borraba el token de `localStorage`, pero React seguía creyendo
 * que había alguien dentro: la pantalla seguía pidiendo datos, todo daba 401 y
 * nunca se llegaba al login. El login fallido no cuenta: sin sesión en el
 * navegador no hay nada que caducar. El token va solo en la cookie, así que
 * "con sesión" es que el navegador recuerda haber entrado (`sesionLocal`).
 */
export const SESION_CADUCADA = 'nexus:sesion-caducada';

// Un aviso del servidor junto a una respuesta correcta (p. ej. el alta que reutilizó una persona
// ya registrada, spec 024) lo enseña `ToastProvider`, sea cual sea la pantalla que hizo la llamada.
export const EVENTO_AVISO = 'nexus:aviso';

api.interceptors.response.use(
  (response) => {
    const aviso = response.data?.meta?.aviso;
    if (typeof aviso === 'string') window.dispatchEvent(new CustomEvent(EVENTO_AVISO, { detail: aviso }));
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // El 401 del propio logout (sesión ya caducada) no es un aviso que dar:
      // el usuario pidió salir.
      if (haySesionLocal() && !String(error.config?.url || '').endsWith('/auth/logout')) {
        window.dispatchEvent(new CustomEvent(SESION_CADUCADA, {
          detail: { mensaje: error.response?.data?.error?.message },
        }));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
