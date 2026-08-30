import api from './client';

export interface LoginResponse {
  user: {
    id: number;
    personaId: number;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role: 'admin' | 'asesor' | 'freelancer';
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
  const res = await api.post('/auth/reset-password', { email, code, newPassword });
  return res.data;
}
