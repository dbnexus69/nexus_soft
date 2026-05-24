import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { AppData, User, Client, Sale, Flight, RolePermissions, normalizeRolePermissions } from '../types';
import * as api from '../api';
import { useAuth } from './AuthContext';
import { getCurrentMonth } from '../utils/formatters';
import {
  saveSalesAndClientsCache,
  loadSalesCache,
  loadClientsCache,
  invalidateSalesCache,
} from '../utils/salesCache';
import {
  saveUsersCache,
  loadUsersCache,
  invalidateUsersCache,
} from '../utils/usersCache';
import {
  saveDashboardCache,
  loadDashboardCache,
  invalidateDashboardCache,
} from '../utils/dashboardCache';

// Limpiar caché de permisos de rol si quedó de versiones anteriores
try { localStorage.removeItem('itea_role_permissions_cache'); } catch {}

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
  salesLoading: boolean;
  fetchDashboard: (params?: Record<string, unknown>, isBackgroundRefresh?: boolean) => Promise<void>;
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
      asesor: { dashboard: { view: 'own' }, sales: { view: 'own', create: true, edit: true }, clients: { view: 'own', create: true, edit: false }, itineraries: { view: true, edit: false }, commissions: { view: false, create: false, edit: false, delete: false } },
      freelancer: { dashboard: { view: 'own' }, sales: { view: 'own', create: true, edit: true }, clients: { view: 'own', create: true, edit: false }, itineraries: { view: true, edit: false }, commissions: { view: false, create: false, edit: false, delete: false } },
    },
  },
  salesHistory: [],
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<AppData>(() => {
    // ── Inicialización optimista desde caché ──────────────────────────────
    // Si hay datos cacheados válidos, pre-populamos el estado para que la
    // tabla de ventas/usuarios se renderice en 0ms antes del primer fetch de red.
    const cachedSales = loadSalesCache();
    const cachedClients = loadClientsCache();
    const cachedUsers = loadUsersCache();
    if (cachedSales || cachedClients || cachedUsers) {
      return {
        ...emptyData,
        sales: (cachedSales as Sale[]) || [],
        clients: (cachedClients as Client[]) || [],
        users: (cachedUsers as User[]) || [],
      };
    }
    return emptyData;
  });
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => loadDashboardCache());
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(() => !loadDashboardCache());
  // salesLoading = true sólo cuando NO hay caché y se está haciendo el primer fetch
  const [salesLoading, setSalesLoading] = useState<boolean>(() => {
    const hasCachedSales = loadSalesCache() !== null;
    return !hasCachedSales;
  });
  const backgroundLoadingRef = useRef(false);
  const fetchingDashboardRef = useRef(false);

  const fetchDashboard = useCallback(async (params: Record<string, unknown> = {}, isBackgroundRefresh = false) => {
    if (fetchingDashboardRef.current) return;
    fetchingDashboardRef.current = true;
    
    if (!isBackgroundRefresh) {
      setDashboardLoading(true);
    }
    try {
      const result = await api.getDashboard(params);
      setDashboardData(result as DashboardData);
      
      // Guardar en caché el dashboard consultado
      saveDashboardCache(result as DashboardData);
    } catch {
      setDashboardData(null);
    } finally {
      fetchingDashboardRef.current = false;
      if (!isBackgroundRefresh) {
        setDashboardLoading(false);
      }
    }
  }, []);

  /**
   * Carga en CASCADA:
   * Fase 1 (crítica, bloqueante para la UI de ventas):
   *   → Cargar sales + clients primero → renderiza tabla inmediatamente
   *   → Guarda en caché localStorage
   * Fase 2 (background, no bloqueante):
   *   → Cargar el resto (users, flights, config, agents, etc.)
   *   → Merge al estado ya visible, sin interrumpir la UI
   */
  const loadAll = useCallback(async () => {
    // Si ya tenemos datos en caché, la tabla ya está visible.
    // La fase 1 igualmente recarga en background para mantener datos frescos.
    const hasCachedData = loadSalesCache() !== null;

    if (!hasCachedData) {
      setSalesLoading(true);
    }

    try {
      // ── FASE 1: Datos críticos (ventas + clientes) ────────────────────
      const [salesRes, clientsRes] = await Promise.all([
        api.listSales({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listClients({ perPage: 100 }).catch(() => ({ data: [] })),
      ]);

      const freshSales = salesRes.data || [];
      const freshClients = clientsRes.data || [];

      // Guardar en caché para próximas visitas
      saveSalesAndClientsCache(freshSales, freshClients);

      // Actualizar sólo sales + clients → tabla se renderiza de inmediato
      setData(prev => ({ ...prev, sales: freshSales, clients: freshClients }));
      setSalesLoading(false);

      // ── FASE 2: Resto de datos en background ─────────────────────────
      if (backgroundLoadingRef.current) return; // Evitar cargas duplicadas en background
      backgroundLoadingRef.current = true;

      const [usersRes, flightsRes, agentsRes, settlementsRes, configAll, asesorPerms, freelancerPerms, salesHistory] = await Promise.all([
        api.listUsers({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listFlights({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listCommissionAgents({ perPage: 100 }).catch(() => ({ data: [] })),
        api.listSettlements({ perPage: 100 }).catch(() => ({ data: [] })),
        api.getAllConfig().catch(() => ({})),
        api.getRolePermissions('asesor').catch(() => null),
        api.getRolePermissions('freelancer').catch(() => null),
        api.getSalesHistory(new Date().getFullYear()).catch(() => null),
      ]);

      backgroundLoadingRef.current = false;

      const resolvedRolePermissions = {
        // Los permisos siempre se leen frescos del servidor, nunca desde caché.
        asesor: asesorPerms ? normalizeRolePermissions(asesorPerms) : emptyData.config.rolePermissions.asesor,
        freelancer: freelancerPerms ? normalizeRolePermissions(freelancerPerms) : emptyData.config.rolePermissions.freelancer,
      };

      // Guardar usuarios en caché
      if (usersRes.data?.length) saveUsersCache(usersRes.data);

      // Merge completo al estado — sin tocar sales/clients que ya están
      setData(prev => ({
        ...prev,
        users: usersRes.data || [],
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
          rolePermissions: resolvedRolePermissions,
        },
        salesHistory: salesHistory || [],
      }));

      // Dashboard en background (usando la función que previene duplicados)
      const { start, end } = getCurrentMonth();
      const dashParams: Record<string, unknown> = {};
      if (start) dashParams.dateFrom = new Date(start).toISOString();
      if (end) dashParams.dateTo = new Date(end).toISOString();
      fetchDashboard(dashParams, true);
    } catch {
      setSalesLoading(false);
      backgroundLoadingRef.current = false;
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
    setData(prev => {
      const updated = [...prev.users, created];
      invalidateUsersCache();
      return { ...prev, users: updated };
    });
    return created;
  };

  const updateUser = async (id: number, userUpdate: Partial<User>) => {
    const updated = await api.updateUser(id, userUpdate);
    setData(prev => {
      const users = prev.users.map(u => u.id === id ? { ...u, ...updated } : u);
      invalidateUsersCache();
      return { ...prev, users };
    });
  };

  const deleteUser = async (id: number) => {
    await api.deleteUser(id);
    setData(prev => {
      invalidateUsersCache();
      return { ...prev, users: prev.users.filter(u => u.id !== id) };
    });
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
    setData(prev => {
      const updatedSales = [...prev.sales, created];
      // Invalida caché para que próximas visitas recarguen datos frescos
      invalidateSalesCache();
      invalidateDashboardCache();
      return { ...prev, sales: updatedSales };
    });
    return created;
  };

  const updateSale = async (id: number, saleUpdate: Partial<Sale>) => {
    await api.updateSale(id, saleUpdate);
    const updated = await api.getSale(id);
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === id ? { ...s, ...updated, ...saleUpdate } : s)
    }));
  };

  const deleteSale = async (id: number) => {
    await api.deleteSale(id);
    setData(prev => {
      const updatedSales = prev.sales.filter(s => s.id !== id);
      // Invalida caché al eliminar una venta
      invalidateSalesCache();
      invalidateDashboardCache();
      return { ...prev, sales: updatedSales };
    });
  };

  const registerCreditPayment = async (saleId: number, amount: number, method?: string, isTotal: boolean = false) => {
    // Find current sale to pass totals — backend can skip a findUnique
    const sale = data.sales.find(s => s.id === saleId);
    const result = await api.registerPayment(saleId, {
      amount,
      method,
      isTotal,
      currentPaidAmount: sale?.creditPaidAmount ?? 0,
      saleTotal: sale?.total ?? undefined
    });
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === saleId ? {
        ...s,
        creditPaidAmount: result.creditPaidAmount,
        status: result.status,
        payments: [...(s.payments || []), result.payment]
      } : s)
    }));
    return result;
  };

  const deleteSalePayment = async (saleId: number, paymentId: string) => {
    // Pass current payments array so backend can compute new total without a query
    const sale = data.sales.find(s => s.id === saleId);
    const result = await api.deletePayment(saleId, paymentId, {
      currentPayments: sale?.payments || [],
      saleTotal: sale?.total ?? undefined
    });
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === saleId ? {
        ...s,
        creditPaidAmount: result.creditPaidAmount,
        status: result.status,
        payments: (s.payments || []).filter((p: any) => p.id !== paymentId)
      } : s)
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
      salesLoading,
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
