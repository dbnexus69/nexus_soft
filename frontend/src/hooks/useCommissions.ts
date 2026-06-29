import { useState, useCallback } from 'react';
import * as api from '../api/commissions';

export function useCommissions() {
  const [agents, setAgents] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingSettlements, setLoadingSettlements] = useState(false);

  const fetchCommissionAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const data = await api.listCommissionAgents();
      setAgents(data);
    } catch (err) {
      console.error("Error fetching commission agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const fetchSettlements = useCallback(async () => {
    setLoadingSettlements(true);
    try {
      const data = await api.listSettlements();
      setSettlements(data);
    } catch (err) {
      console.error("Error fetching settlements:", err);
    } finally {
      setLoadingSettlements(false);
    }
  }, []);

  const handleCreateAgent = async (agent: any) => {
    try {
      const created = await api.createCommissionAgent(agent);
      await fetchCommissionAgents();
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear comisionista';
      throw new Error(msg);
    }
  };

  const handleUpdateAgent = async (id: number, agentUpdate: any) => {
    try {
      await api.updateCommissionAgent(id, agentUpdate);
      await fetchCommissionAgents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar comisionista';
      throw new Error(msg);
    }
  };

  const handleDeleteAgent = async (id: number) => {
    try {
      await api.deleteCommissionAgent(id);
      await fetchCommissionAgents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar comisionista';
      throw new Error(msg);
    }
  };

  const handleCreateSettlement = async (settlementData: any) => {
    try {
      const created = await api.createSettlement(settlementData);
      await fetchSettlements();
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al liquidar comisiones';
      throw new Error(msg);
    }
  };

  return {
    agents,
    settlements,
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
