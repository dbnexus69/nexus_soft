import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { AppData, User, Client, Sale, Flight, RolePermissions, normalizeRolePermissions } from '../types';
import * as api from '../api';
import { useAuth } from './AuthContext';
import { getCurrentMonth } from '../utils/formatters';

type ConfigSection = 'cards' | 'paymentMethods' | 'documentTypes' | 'airlines' | 'suppliers' | 'airports' | 'baggage' | 'packages';

interface RecentSale {
  id: number;
  clientName: string;
  asesorName: string;
  date: string;
  total: number;
  status: string;
}

interface DashboardData {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingBalance: number;
  pendingCount: number;
  suppliersTotal: number;
  totalClients: number;
  activeClients: number;
  totalFlights: number;
  supplierCount: number;
  recentSales: RecentSale[];
  categoryDistribution: { name: string; value: number; percentage: number }[];
  carteraStatus: { name: string; value: number; color: string }[];
  monthlyTrend: { month: number; currentYear: number; previousYear: number }[];
  categoryBreakdown: Record<string, { count: number; revenue: number }>;
}

interface DataContextType {
  data: AppData;
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  fetchDashboard: (params?: Record<string, unknown>) => Promise<void>;
  refreshData: () => void;
  addUser: (user: Omit<User, 'id'>) => Promise<User>;
  updateUser: (id: number, user: Partial<User>) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  updateUserPermissions: (id: number, permissions: RolePermissions) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (id: number, client: Partial<Client>) => Promise<void>;
  toggleClientStatus: (id: number) => Promise<void>;
  addSale: (sale: Omit<Sale, 'id'>) => Promise<Sale>;
  updateSale: (id: number, sale: Partial<Sale>) => Promise<void>;
  deleteSale: (id: number) => Promise<void>;
  registerCreditPayment: (saleId: number, amount: number, method?: string, isTotal?: boolean) => Promise<{ payment: any; status: string; creditPaidAmount: number }>;
  deleteSalePayment: (saleId: number, paymentId: string) => Promise<void>;
  updateFlight: (id: string, flight: Partial<Flight>) => Promise<void>;
  settleCommissions: (agentId: number, settlement: any) => Promise<void>;
  refreshSettlements: () => Promise<void>;
  addConfigItem: (section: ConfigSection, item: Record<string, unknown>) => Promise<Record<string, unknown>>;
  updateConfigItem: (section: ConfigSection, id: number, item: Record<string, unknown>) => Promise<void>;
  deleteConfigItem: (section: ConfigSection, id: number) => Promise<void>;
  addCommissionAgent: (agent: any) => Promise<any>;
  updateCommissionAgent: (id: number, agent: any) => Promise<void>;
  deleteCommissionAgent: (id: number) => Promise<void>;
  updateRolePermissions: (role: 'asesor' | 'freelancer', permissions: RolePermissions) => Promise<void>;
}

const emptyData: AppData = {
  users: [], clients: [], sales: [], flights: [],
  commissionAgents: [], commissionSettlements: [],
  config: {
    cards: [], paymentMethods: [], documentTypes: [],
    airlines: [], suppliers: [], airports: [],
    baggage: [], packages: [],
    rolePermissions: {
      asesor: { dashboard: { view: 'own' }, sales: { view: 'own', create: true, edit: true, delete: false }, clients: { view: 'own', create: true, edit: false }, itineraries: { view: true, edit: false }, users: { view: false, create: false, edit: false, delete: false }, config: { view: false, edit: false } },
      freelancer: { dashboard: { view: 'own' }, sales: { view: 'own', create: true, edit: true, delete: false }, clients: { view: 'own', create: true, edit: false }, itineraries: { view: true, edit: false }, users: { view: false, create: false, edit: false, delete: false }, config: { view: false, edit: false } },
    },
  },
  salesHistory: [],
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>(emptyData);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const fetchDashboard = useCallback(async (params: Record<string, unknown> = {}) => {
    setDashboardLoading(true);
    try {
      const result = await api.getDashboard(params);
      setDashboardData(result as DashboardData);
    } catch {
      setDashboardData(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [usersRes, clientsRes, salesRes, flightsRes, agentsRes, settlementsRes, configAll, asesorPerms, freelancerPerms, salesHistory] = await Promise.all([
        api.listUsers({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listClients({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listSales({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listFlights({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listCommissionAgents({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listSettlements({ perPage: 100 }).catch(() => ({ data: [] })),
        api.getAllConfig().catch(() => ({})),
        api.getRolePermissions('asesor').catch(() => null),
        api.getRolePermissions('freelancer').catch(() => null),
        api.getSalesHistory(new Date().getFullYear()).catch(() => null),
      ]);

      setData({
        users: usersRes.data || [],
        clients: clientsRes.data || [],
        sales: salesRes.data || [],
        flights: flightsRes.data || [],
        commissionAgents: agentsRes.data || [],
        commissionSettlements: settlementsRes.data || [],
        config: {
          cards: configAll?.cards || [],
          paymentMethods: configAll?.['payment-methods'] || [],
          documentTypes: configAll?.['document-types'] || [],
          airlines: configAll?.airlines || [],
          suppliers: configAll?.suppliers || [],
          airports: configAll?.airports || [],
          baggage: configAll?.baggage || [],
          packages: configAll?.packages || [],
          rolePermissions: {
            asesor: normalizeRolePermissions(asesorPerms || emptyData.config.rolePermissions.asesor),
            freelancer: normalizeRolePermissions(freelancerPerms || emptyData.config.rolePermissions.freelancer),
          },
        },
        salesHistory: salesHistory || [],
      });

      // Fetch initial dashboard data
      const { start, end } = getCurrentMonth();
      const dashParams: Record<string, unknown> = {};
      if (start) dashParams.dateFrom = new Date(start).toISOString();
      if (end) dashParams.dateTo = new Date(end).toISOString();
      api.getDashboard(dashParams).then(result => {
        setDashboardData(result as DashboardData);
      }).catch(() => {});
    } catch {
      setData(emptyData);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [loadAll, user]);

  const refreshData = () => { loadAll(); };

  const addUser = async (user: Omit<User, 'id'>): Promise<User> => {
    const created = await api.createUser(user as any);
    setData(prev => ({ ...prev, users: [...prev.users, created] }));
    return created;
  };

  const updateUser = async (id: number, userUpdate: Partial<User>) => {
    await api.updateUser(id, userUpdate);
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === id ? { ...u, ...userUpdate } : u)
    }));
  };

  const deleteUser = async (id: number) => {
    await api.deleteUser(id);
    setData(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
  };

  const updateUserPermissions = async (id: number, permissions: RolePermissions) => {
    await api.updateUserPermissions(id, permissions as any);
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === id ? { ...u, customPermissions: permissions } : u)
    }));
  };

  const addClient = async (client: Omit<Client, 'id'>): Promise<Client> => {
    const created = await api.createClient(client as any);
    setData(prev => ({ ...prev, clients: [...prev.clients, created] }));
    return created;
  };

  const updateClient = async (id: number, clientUpdate: Partial<Client>) => {
    await api.updateClient(id, clientUpdate);
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === id ? { ...c, ...clientUpdate } : c)
    }));
  };

  const toggleClientStatus = async (id: number) => {
    const result = await api.toggleClientStatus(id);
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === id ? { ...c, status: result.status } : c)
    }));
  };

  const addSale = async (sale: Omit<Sale, 'id'>): Promise<Sale> => {
    const created = await api.createSale(sale as any);
    setData(prev => ({ ...prev, sales: [...prev.sales, created] }));
    return created;
  };

  const updateSale = async (id: number, saleUpdate: Partial<Sale>) => {
    await api.updateSale(id, saleUpdate);
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === id ? { ...s, ...saleUpdate } : s)
    }));
  };

  const deleteSale = async (id: number) => {
    await api.deleteSale(id);
    setData(prev => ({ ...prev, sales: prev.sales.filter(s => s.id !== id) }));
  };

  const registerCreditPayment = async (saleId: number, amount: number, method?: string, isTotal: boolean = false) => {
    const result = await api.registerPayment(saleId, { amount, method, isTotal });
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === saleId ? { ...s, status: result.status, creditPaidAmount: result.creditPaidAmount } : s)
    }));
    return result;
  };

  const deleteSalePayment = async (saleId: number, paymentId: string) => {
    await api.deletePayment(saleId, paymentId);
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === saleId ? { ...s, payments: (s.payments || []).filter(p => p.id !== paymentId) } : s)
    }));
  };

  const updateFlight = async (id: string, flightUpdate: Partial<Flight>) => {
    const result = await api.updateCheckin(id, flightUpdate as any);
    setData(prev => ({
      ...prev,
      flights: prev.flights.map(f => f.id === id ? { ...f, checkin: result.checkinStatus } : f)
    }));
  };

  const settleCommissions = async (agentId: number, settlement: any) => {
    const salesIds = data.sales
      .filter(s => s.commissionAgentId === agentId && !s.isSettled)
      .map(s => s.id);

    const created = await api.createSettlement({ ...settlement, agentId, salesIds });
    setData(prev => ({
      ...prev,
      commissionSettlements: [...(prev.commissionSettlements || []), created],
      sales: prev.sales.map(s =>
        s.commissionAgentId === agentId && !s.isSettled
          ? { ...s, isSettled: true, settlementDate: settlement.date }
          : s
      ),
    }));
  };

  const refreshSettlements = async () => {
    const res = await api.listSettlements({ perPage: 100 }).catch(() => ({ data: [] }));
    setData(prev => ({ ...prev, commissionSettlements: res.data || [] }));
  };

  const addConfigItem = async (section: ConfigSection, item: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const created = await api.createConfigItem(section, item);
    setData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [section]: [...(prev.config as any)[section], created]
      }
    }));
    return created;
  };

  const updateConfigItem = async (section: ConfigSection, id: number, itemUpdate: Record<string, unknown>) => {
    await api.updateConfigItem(section, id, itemUpdate);
    setData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [section]: (prev.config as any)[section].map((i: any) => i.id === id ? { ...i, ...itemUpdate } : i)
      }
    }));
  };

  const deleteConfigItem = async (section: ConfigSection, id: number) => {
    await api.deleteConfigItem(section, id);
    setData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [section]: (prev.config as any)[section].filter((i: any) => i.id !== id)
      }
    }));
  };

  const addCommissionAgent = async (agent: any) => {
    const created = await api.createCommissionAgent(agent);
    setData(prev => ({ ...prev, commissionAgents: [...prev.commissionAgents, created] }));
    return created;
  };

  const updateCommissionAgent = async (id: number, agentUpdate: any) => {
    await api.updateCommissionAgent(id, agentUpdate);
    setData(prev => ({
      ...prev,
      commissionAgents: prev.commissionAgents.map(a => a.id === id ? { ...a, ...agentUpdate } : a)
    }));
  };

  const deleteCommissionAgent = async (id: number) => {
    await api.deleteCommissionAgent(id);
    setData(prev => ({
      ...prev,
      commissionAgents: prev.commissionAgents.filter(a => a.id !== id)
    }));
  };

  const updateRolePermissions = async (role: 'asesor' | 'freelancer', permissions: RolePermissions) => {
    const normalized = normalizeRolePermissions(permissions);
    await api.updateRolePermissions(role, normalized as any);
    setData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        rolePermissions: {
          ...prev.config.rolePermissions,
          [role]: normalized
        }
      }
    }));
  };

  return (
    <DataContext.Provider value={{
      data,
      dashboardData,
      dashboardLoading,
      fetchDashboard,
      refreshData,
      addUser,
      updateUser,
      deleteUser,
      updateUserPermissions,
      addClient,
      updateClient,
      toggleClientStatus,
      addSale,
      updateSale,
      deleteSale,
      settleCommissions,
      refreshSettlements,
      registerCreditPayment,
      deleteSalePayment,
      updateFlight,
      addConfigItem,
      updateConfigItem,
      deleteConfigItem,
      addCommissionAgent,
      updateCommissionAgent,
      deleteCommissionAgent,
      updateRolePermissions,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
