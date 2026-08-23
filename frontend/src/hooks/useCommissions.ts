import { useState, useCallback } from 'react';
import * as api from '../api/commissions';

export function useCommissions() {
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsMeta, setAgentsMeta] = useState<any>({ page: 1, perPage: 10, total: 0, totalPages: 0 });
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settlementsMeta, setSettlementsMeta] = useState<any>({ page: 1, perPage: 10, total: 0, totalPages: 0 });
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

  const handleCreateAgent = async (agent: any) => {
    try {
      const created = await api.createCommissionAgent(agent);
      await fetchCommissionAgents({ page: 1, perPage: agentsMeta.perPage });
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear comisionista';
      throw new Error(msg);
    }
  };

  const handleUpdateAgent = async (id: number, agentUpdate: any) => {
    try {
      await api.updateCommissionAgent(id, agentUpdate);
      await fetchCommissionAgents({ page: agentsMeta.page, perPage: agentsMeta.perPage });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar comisionista';
      throw new Error(msg);
    }
  };

  const handleDeleteAgent = async (id: number) => {
    try {
      await api.deleteCommissionAgent(id);
      await fetchCommissionAgents({ page: agentsMeta.page, perPage: agentsMeta.perPage });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar comisionista';
      throw new Error(msg);
    }
  };

  const handleCreateSettlement = async (settlementData: any) => {
    try {
      const created = await api.createSettlement(settlementData);
      await fetchSettlements({ page: 1, perPage: settlementsMeta.perPage });
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al liquidar comisiones';
      throw new Error(msg);
    }
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
