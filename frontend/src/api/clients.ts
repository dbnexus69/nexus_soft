import api from './client';
import type { Client } from '../types';
import type { Pagina, Recurso } from './tipos';

export async function listClients(params: Record<string, unknown>) {
  const res = await api.get<Pagina<Client>>('/clients', { params });
  return res.data;
}

export async function getClient(id: number) {
  const res = await api.get<Recurso<Client>>(`/clients/${id}`, { params: { includeSales: true } });
  return res.data.data;
}

export async function createClient(data: Record<string, unknown>) {
  const res = await api.post<Recurso<Client>>('/clients', data);
  return res.data.data;
}

export async function updateClient(id: number, data: Record<string, unknown>) {
  const res = await api.put<Recurso<Client>>(`/clients/${id}`, data);
  return res.data.data;
}

export async function toggleClientStatus(id: number) {
  const res = await api.patch<Recurso<Client>>(`/clients/${id}/toggle-status`);
  return res.data.data;
}
