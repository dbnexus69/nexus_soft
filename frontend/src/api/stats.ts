import api from './client';

export async function getDashboard(params: Record<string, unknown> = {}) {
  const res = await api.get('/stats/dashboard', { params });
  return res.data.data;
}


export async function getAsesorPerformance(params: Record<string, unknown> = {}) {
  const res = await api.get('/stats/asesor-performance', { params });
  return res.data.data;
}

export async function getTopClients(params: Record<string, unknown> = {}) {
  const res = await api.get('/stats/top-clients', { params });
  return res.data.data;
}

export async function getCategoryDistribution(params: Record<string, unknown> = {}) {
  const res = await api.get('/stats/category-distribution', { params });
  return res.data.data;
}

/**
 * Lo que requiere acción hoy: créditos vencidos, check-ins inminentes y ventas
 * sin revisar. Un solo endpoint y un solo viaje: tres peticiones separadas
 * costarían tres veces la latencia.
 */
export async function getAttention() {
  const res = await api.get('/stats/attention');
  return res.data.data;
}
