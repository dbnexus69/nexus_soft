import api from './client';

export async function listFlights(params: Record<string, unknown>) {
  const res = await api.get('/flights', { params });
  return res.data;
}

/**
 * Check-ins de vuelo, paginados y con los contadores por estado en
 * `meta.counts`. Sustituye a las tres llamadas que la pantalla hacía contra
 * `listFlights` con filtros distintos.
 */
export async function listCheckins(params: Record<string, unknown>) {
  const res = await api.get('/flights/checkins', { params });
  return res.data;
}

export async function updateCheckin(id: string, data: Record<string, unknown> | FormData) {
  const isFormData = data instanceof FormData;
  const res = await api.put(`/flights/${id}/checkin`, data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return res.data.data;
}

/**
 * Cancela el check-in de un tramo. El motivo es obligatorio (5-255 caracteres)
 * y lo valida el servidor, que responde 422 con el detalle por campo.
 */
export async function cancelCheckin(id: string, reasonCanceled: string) {
  const res = await api.post(`/flights/${id}/checkin/cancellation`, { reasonCanceled });
  return res.data.data;
}
