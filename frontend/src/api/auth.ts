import api from './client';
import type { UserRole } from '../types';

export interface LoginResponse {
  user: {
    id: number;
    personaId: number;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role: UserRole;
    avatar: string | null;
    phone: string;
    status: 'active' | 'inactive';
    docType: string | null;
    docNumber: string;
    lastLogin: string | null;
  };
  token: string;
  expiresAt: string;
}

export async function login(email: string, password: string, remember?: boolean) {
  const res = await api.post('/auth/login', { email, password, remember });
  return res.data.data as LoginResponse;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function getMe() {
  const res = await api.get('/auth/me');
  return res.data.data;
}

export async function forgotPassword(email: string) {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data;
}

export async function verifyCode(email: string, code: string) {
  const res = await api.post('/auth/verify-code', { email, code });
  return res.data;
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  // El campo se llama `password` en la API, como en el alta de usuario. Se
  // enviaba `newPassword`, que el backend nunca leyó: cuando los tres
  // endpoints eran esqueletos que devolvían 200 a cualquier cosa no se notaba.
  const res = await api.post('/auth/reset-password', { email, code, password: newPassword });
  return res.data;
}
