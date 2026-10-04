import api from './client';
import type { CommissionAgent, CommissionSettlement } from '../types';
import type { Pagina, Recurso } from './tipos';

export async function listCommissionAgents(params: Record<string, unknown> = {}) {
  const res = await api.get<Pagina<CommissionAgent>>('/commissions/agents', { params });
  return res.data;
}

export async function createCommissionAgent(data: Record<string, unknown>) {
  const res = await api.post<Recurso<CommissionAgent>>('/commissions/agents', data);
  return res.data.data;
}

export async function updateCommissionAgent(id: number, data: Record<string, unknown>) {
  const res = await api.put<Recurso<CommissionAgent>>(`/commissions/agents/${id}`, data);
  return res.data.data;
}

export async function deleteCommissionAgent(id: number) {
  await api.delete(`/commissions/agents/${id}`);
}

export async function listSettlements(params: Record<string, unknown> = {}) {
  const res = await api.get<Pagina<CommissionSettlement>>('/commissions/settlements', { params });
  return res.data;
}

export async function createSettlement(data: Record<string, unknown>) {
  const res = await api.post<Recurso<CommissionSettlement>>('/commissions/settlements', data);
  return res.data.data;
}
