import { useState, useCallback, useEffect } from 'react';
import { listClients, createClient, updateClient, toggleClientStatus } from '../api/clients';
import { Client } from '../types';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listClients({ search: searchTerm, status: statusFilter });
      if (res.success && Array.isArray(res.data)) {
        setClients(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar clientes';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleCreateClient = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const newClient = await createClient(data);
      await fetchClients();
      return newClient;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear cliente';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClient = async (id: number, data: Record<string, unknown>) => {
    setLoading(true);
    try {
      const updated = await updateClient(id, data);
      await fetchClients();
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar cliente';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await toggleClientStatus(id);
      await fetchClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      throw new Error(msg);
    }
  };

  return {
    clients,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    fetchClients,
    handleCreateClient,
    handleUpdateClient,
    handleToggleStatus
  };
}
