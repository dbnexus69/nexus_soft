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
  // Responde solo el id y el número visible (spec 034).
  const res = await api.post<Recurso<{ id: number; numero: number }>>('/responsables', data);
  return res.data;
}

export async function updateResponsable(id: number, data: Record<string, unknown>) {
  // Responde solo los campos que se mandaron, más el id (spec 033).
  const res = await api.put<Recurso<Partial<Responsable> & { id: number }>>(`/responsables/${id}`, data);
  return res.data;
}

/** Activar o desactivar (spec 033): manda y recibe solo el estado. */
export async function setResponsableStatus(id: number, status: Responsable['status']) {
  const res = await api.patch<Recurso<{ id: number; status: Responsable['status'] }>>(`/responsables/${id}/status`, { status });
  return res.data;
}

