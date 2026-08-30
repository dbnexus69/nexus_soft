import api from './client';
import { User } from '../types';

export async function listUsers(params: Record<string, unknown>) {
  const res = await api.get('/users', { params });
  return res.data;
}

export async function getUser(id: number) {
  const res = await api.get(`/users/${id}`);
  return res.data.data;
}

export async function createUser(data: Partial<User>) {
  const res = await api.post('/users', data);
  return res.data.data;
}

export async function updateUser(id: number, data: Partial<User>) {
  const res = await api.put(`/users/${id}`, data);
  return res.data.data;
}

export async function deleteUser(id: number) {
  await api.delete(`/users/${id}`);
}


export async function updateRolePermissions(role: string, permissions: Record<string, unknown>) {
  const res = await api.put(`/roles/${role}/permissions`, { permissions });
  return res.data.data;
}

export async function getRolePermissions(role: string) {
  const res = await api.get(`/roles/${role}/permissions`);
  return res.data.data;
}
