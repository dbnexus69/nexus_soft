import api from './client';
import type { Responsable } from '../types';
import type { Pagina, Recurso } from './tipos';

export async function listResponsables(params?: Record<string, unknown>) {
  const res = await api.get<Pagina<Responsable>>('/responsables', { params });
  return res.data;
}

export async function getResponsable(id: number, params?: Record<string, unknown>) {
  const res = await api.get<Recurso<Responsable>>(`/responsables/${id}`, { params });
  return res.data;
}

export async function createResponsable(data: Record<string, unknown>) {
  const res = await api.post<Recurso<Responsable>>('/responsables', data);
  return res.data;
}

export async function updateResponsable(id: number, data: Record<string, unknown>) {
  const res = await api.put<Recurso<Responsable>>(`/responsables/${id}`, data);
  return res.data;
}

// DELETE responde 204 sin cuerpo.
export async function deleteResponsable(id: number) {
  await api.delete(`/responsables/${id}`);
}
