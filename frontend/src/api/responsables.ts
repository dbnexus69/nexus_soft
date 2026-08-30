import api from './client';

export async function listResponsables(params?: Record<string, unknown>) {
  const res = await api.get('/responsables', { params });
  return res.data;
}

export async function getResponsable(id: number, params?: Record<string, unknown>) {
  const res = await api.get(`/responsables/${id}`, { params });
  return res.data;
}

export async function createResponsable(data: Record<string, unknown>) {
  const res = await api.post('/responsables', data);
  return res.data;
}

export async function updateResponsable(id: number, data: Record<string, unknown>) {
  const res = await api.put(`/responsables/${id}`, data);
  return res.data;
}

// DELETE responde 204 sin cuerpo.
export async function deleteResponsable(id: number) {
  await api.delete(`/responsables/${id}`);
}
