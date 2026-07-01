import api from './client';

export async function listCommissionAgents(params: Record<string, unknown> = {}) {
  const res = await api.get('/commissions/agents', { params });
  return res.data;
}

export async function createCommissionAgent(data: Record<string, unknown>) {
  const res = await api.post('/commissions/agents', data);
  return res.data.data;
}

export async function updateCommissionAgent(id: number, data: Record<string, unknown>) {
  const res = await api.put(`/commissions/agents/${id}`, data);
  return res.data.data;
}

export async function deleteCommissionAgent(id: number) {
  await api.delete(`/commissions/agents/${id}`);
}

export async function listSettlements(params: Record<string, unknown> = {}) {
  const res = await api.get('/commissions/settlements', { params });
  return res.data;
}

export async function createSettlement(data: Record<string, unknown>) {
  const res = await api.post('/commissions/settlements', data);
  return res.data.data;
}
