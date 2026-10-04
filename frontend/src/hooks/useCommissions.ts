import { useState, useCallback } from 'react';
import * as api from '../api/commissions';
import type { CommissionAgent, CommissionSettlement } from '../types';
import type { Paginacion } from '../api/tipos';

export function useCommissions() {
  const [agents, setAgents] = useState<CommissionAgent[]>([]);
  const [agentsMeta, setAgentsMeta] = useState<Paginacion>({ page: 1, perPage: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false });
  const [settlements, setSettlements] = useState<CommissionSettlement[]>([]);
  const [settlementsMeta, setSettlementsMeta] = useState<Paginacion>({ page: 1, perPage: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false });
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  const fetchCommissionAgents = useCallback(async (params: { page?: number, perPage?: number, search?: string, status?: string } = {}) => {
    setLoadingAgents(true);
    try {
      const data = await api.listCommissionAgents(params);
      setAgents(data.data || []);
      if (data.meta) setAgentsMeta(data.meta);
    } catch (err) {
      console.error("Error fetching commission agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const fetchSettlements = useCallback(async (params: { page?: number, perPage?: number, agentId?: number, dateFrom?: string, dateTo?: string } = {}) => {
    setLoadingSettlements(true);
    try {
      const data = await api.listSettlements(params);
      setSettlements(data.data || []);
      if (data.meta) setSettlementsMeta(data.meta);
    } catch (err) {
      console.error("Error fetching settlements:", err);
    } finally {
      setLoadingSettlements(false);
    }
  }, []);

  // Los errores se dejan pasar tal cual. Antes cada manejador los envolvía en
  // `new Error(err.message)`, que descarta la respuesta de la API: la pantalla
  // solo podía enseñar "Request failed with status code 409".
  const handleCreateAgent = async (agent: Record<string, unknown>) => {
    const created = await api.createCommissionAgent(agent);
    await fetchCommissionAgents({ page: 1, perPage: agentsMeta.perPage });
    return created;
  };

  const handleUpdateAgent = async (id: number, agentUpdate: Record<string, unknown>) => {
    await api.updateCommissionAgent(id, agentUpdate);
    await fetchCommissionAgents({ page: agentsMeta.page, perPage: agentsMeta.perPage });
  };

  const handleDeleteAgent = async (id: number) => {
    await api.deleteCommissionAgent(id);
    await fetchCommissionAgents({ page: agentsMeta.page, perPage: agentsMeta.perPage });
  };

  const handleCreateSettlement = async (settlementData: Record<string, unknown>) => {
    const created = await api.createSettlement(settlementData);
    await fetchSettlements({ page: 1, perPage: settlementsMeta.perPage });
    return created;
  };

  return {
    agents,
    agentsMeta,
    settlements,
    settlementsMeta,
    loadingAgents,
    loadingSettlements,
    fetchCommissionAgents,
    fetchSettlements,
    handleCreateAgent,
    handleUpdateAgent,
    handleDeleteAgent,
    handleCreateSettlement
  };
}
