import { useState, useMemo } from 'react';
import { Plus, Search, X, Users as UsersIcon } from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Form';
import { ClientTable } from '../components/clients/ClientTable';
import ClientDetailModal from '../components/clients/ClientDetailModal';
import { ClientModal } from '../components/clients/ClientModal';
import { useData } from '../context/DataContext';
import { useClientsContext } from '../context/ClientsContext';
import { usePermissions } from '../context/PermissionsContext';
import { useToast } from '../context/ToastContext';
import { Client } from '../types';

export default function Clients() {
  const { data } = useData();
  const { 
    clients, 
    handleCreateClient: addClient, 
    handleUpdateClient: updateClient, 
    handleToggleStatus: toggleClientStatus 
  } = useClientsContext();
  const { canCreate, canEdit } = usePermissions();
  const { success, error } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Client; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'desc' });

  const filteredClients = useMemo(() => {
    let filtered = [...clients];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => client.status === statusFilter);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(client => 
        (client.name && client.name.toLowerCase().includes(lowerSearch)) ||
        (client.docNumber && client.docNumber.toLowerCase().includes(lowerSearch)) ||
        (client.email && client.email.toLowerCase().includes(lowerSearch)) ||
        (client.phone && client.phone.toLowerCase().includes(lowerSearch))
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal === undefined) aVal = '';
      if (bVal === undefined) bVal = '';

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [clients, searchTerm, statusFilter, sortConfig]);

  const handleOpenModal = (client?: Client) => {
    setEditingClient(client || null);
    setIsModalOpen(true);
  };

  const handleViewDetail = (client: Client) => {
    setSelectedClient(client);
    setIsDetailOpen(true);
  };

  const handleToggleStatus = async (client: Client) => {
    const action = client.status === 'active' ? 'desactivar' : 'activar';
    if (window.confirm(`¿Estás seguro de que deseas ${action} a ${client.name}?`)) {
      try {
        await toggleClientStatus(client.id);
        success(`Cliente ${action}do exitosamente`);
      } catch (err: any) {
        error(err.message || `Error al ${action} cliente`);
      }
    }
  };

  const handleSaveClient = async (clientData: Partial<Client>) => {
    try {
      if (editingClient) {
        await updateClient(editingClient.id, clientData);
        success('Cliente actualizado exitosamente');
      } else {
        await addClient(clientData);
        success('Cliente creado exitosamente');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      throw new Error(error.message || 'Error al guardar cliente');
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key: key as keyof Client,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="space-y-6 relative animate-fade-in">
      <div className="mb-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <UsersIcon className="text-accent w-8 h-8" /> Gestión de Clientes
            </h1>
            <p className="text-gray-500 text-sm mt-1">Administra la base de datos de tus viajeros y su historial de compras.</p>
          </div>
        </div>
      </div>

      <Card className="animate-fade-in">
        <CardHeader actions={
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder="Buscar por nombre o doc..." 
                className="pl-10 pr-9 w-72"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded">
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="text-sm border border-gray-border rounded-lg px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo Activos</option>
              <option value="inactive">Solo Inactivos</option>
            </select>
            {canCreate('clients') && (
              <Button onClick={() => handleOpenModal()}>
                <Plus size={18} /> Nuevo Cliente
              </Button>
            )}
          </div>
        }>
          Lista de Clientes
        </CardHeader>
        
        <div className="overflow-x-auto">
          <ClientTable 
            clients={filteredClients}
            sortBy={sortConfig.key}
            sortOrder={sortConfig.direction}
            onSort={handleSort}
            onViewDetail={handleViewDetail}
            onEdit={handleOpenModal}
            onToggleStatus={handleToggleStatus}
            canEdit={canEdit('clients')}
          />
        </div>
      </Card>

      <ClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingClient={editingClient}
        documentTypes={(data.config.documentTypes as any) || []}
        onSave={handleSaveClient}
      />

      {selectedClient && (
        <ClientDetailModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          client={selectedClient}
          clientSales={(data.sales as any).filter((s: any) => s.clientId === selectedClient.id)}
          clientFlights={[]}
        />
      )}
    </div>
  );
}