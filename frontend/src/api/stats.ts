import api from './client';
import type { DashboardStats, AttentionSummary } from '../types';
import type { Recurso } from './tipos';

export interface ClienteTop { name: string; total: number }
export interface RendimientoAsesor { asesorName: string; totalIngresos: number; totalVentas: number }
export interface CategoriaVentas { name: string; value: number }

export async function getDashboard(params: Record<string, unknown> = {}) {
  const res = await api.get<Recurso<DashboardStats>>('/stats/dashboard', { params });
  return res.data.data;
}


export async function getAsesorPerformance(params: Record<string, unknown> = {}) {
  const res = await api.get<Recurso<RendimientoAsesor[]>>('/stats/asesor-performance', { params });
  return res.data.data;
}

export async function getTopClients(params: Record<string, unknown> = {}) {
  const res = await api.get<Recurso<ClienteTop[]>>('/stats/top-clients', { params });
  return res.data.data;
}

/**
 * De lo que deben los clientes, cuánto va a los proveedores y cuánto es margen
 * de la agencia. Se pide al abrir la modal, no con el dashboard: es el detalle
 * de una cifra, no parte de la portada.
 */
export async function getCreditBreakdown(params: Record<string, unknown> = {}) {
  const res = await api.get('/stats/credit-breakdown', { params });
  return res.data.data;
}

export async function getCategoryDistribution(params: Record<string, unknown> = {}) {
  const res = await api.get<Recurso<CategoriaVentas[]>>('/stats/category-distribution', { params });
  return res.data.data;
}

/**
 * Lo que requiere acción hoy: créditos vencidos, check-ins inminentes y ventas
 * sin revisar. Un solo endpoint y un solo viaje: tres peticiones separadas
 * costarían tres veces la latencia.
 */
export async function getAttention() {
  const res = await api.get<Recurso<AttentionSummary>>('/stats/attention');
  return res.data.data;
}
