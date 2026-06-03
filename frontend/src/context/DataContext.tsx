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
import {
  saveConfigCache,
  loadConfigCache,
  invalidateConfigCache,
} from '../utils/configCache';

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
  creditMayoristas?: number;
  creditTa?: number;
}

interface DataContextType {
  data: AppData;
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  salesLoading: boolean;
  fetchDashboard: (params?: Record<string, unknown>, isBackgroundRefresh?: boolean) => Promise<void>;
  fetchSales: () => Promise<void>;
  fetchClients: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchFlights: () => Promise<void>;
  fetchCommissionAgents: () => Promise<void>;
  fetchSettlements: () => Promise<void>;
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
  voidSale: (id: number, reason: string) => Promise<void>;
  registerCreditPayment: (saleId: number, amount: number, method?: string, isTotal?: boolean) => Promise<{ payment: any; status: string; creditPaidAmount: number }>;
  deleteSalePayment: (saleId: number, paymentId: string) => Promise<void>;
  updateFlight: (id: string, flight: Partial<Flight> | FormData) => Promise<void>;
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
    // tabla de ventas/usuarios/catálogos se renderice en 0ms antes del primer fetch de red.
    const cachedSales = loadSalesCache();
    const cachedClients = loadClientsCache();
    const cachedUsers = loadUsersCache();
    const cachedConfig = loadConfigCache();

    const initialConfig = {
      ...emptyData.config,
      ...(cachedConfig || {})
    };

    if (cachedSales || cachedClients || cachedUsers || cachedConfig) {
      return {
        ...emptyData,
        sales: (cachedSales as Sale[]) || [],
        clients: (cachedClients as Client[]) || [],
        users: (cachedUsers as User[]) || [],
        config: initialConfig,
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

  const fetchSales = useCallback(async () => {
    setSalesLoading(true);
    try {
      const res = await api.listSales({ perPage: 50 }).catch(() => ({ data: [] }));
      const freshSales = res.data || [];
      setData(prev => {
        saveSalesAndClientsCache(freshSales, prev.clients);
        return { ...prev, sales: freshSales };
      });
    } catch {
    } finally {
      setSalesLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.listClients({ perPage: 100 }).catch(() => ({ data: [] }));
      const freshClients = res.data || [];
      setData(prev => {
        saveSalesAndClientsCache(prev.sales, freshClients);
        return { ...prev, clients: freshClients };
      });
    } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.listUsers({ perPage: 100 }).catch(() => ({ data: [] }));
      const freshUsers = res.data || [];
      saveUsersCache(freshUsers);
      setData(prev => ({ ...prev, users: freshUsers }));
    } catch {}
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const [configAll, asesorPerms, freelancerPerms] = await Promise.all([
        api.getAllConfig().catch(() => ({})),
        api.getRolePermissions('asesor').catch(() => null),
        api.getRolePermissions('freelancer').catch(() => null),
      ]);
      const resolvedRolePermissions = {
        asesor: asesorPerms ? normalizeRolePermissions(asesorPerms) : emptyData.config.rolePermissions.asesor,
        freelancer: freelancerPerms ? normalizeRolePermissions(freelancerPerms) : emptyData.config.rolePermissions.freelancer,
      };
      if (configAll && Object.keys(configAll).length > 0) {
        saveConfigCache({
          cards: configAll.cards || [],
          paymentMethods: configAll['payment-methods'] || [],
          documentTypes: configAll['document-types'] || [],
          airlines: configAll.airlines || [],
          suppliers: configAll.suppliers || [],
          airports: configAll.airports || [],
          baggage: configAll.baggage || [],
          packages: configAll.packages || [],
        });
      }
      setData(prev => ({
        ...prev,
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
        }
      }));
    } catch {}
  }, []);

  const fetchFlights = useCallback(async () => {
    try {
      const res = await api.listFlights({ perPage: 100 }).catch(() => ({ data: [] }));
      setData(prev => ({ ...prev, flights: res.data || [] }));
    } catch (err) {
      console.warn('[DataContext] Error fetching flights:', err);
    }
  }, []);

  const fetchCommissionAgents = useCallback(async () => {
    try {
      const res = await api.listCommissionAgents({ perPage: 100 }).catch(() => ({ data: [] }));
      setData(prev => ({ ...prev, commissionAgents: res.data || [] }));
    } catch {}
  }, []);

  const fetchSettlements = useCallback(async () => {
    try {
      const res = await api.listSettlements({ perPage: 100 }).catch(() => ({ data: [] }));
      setData(prev => ({ ...prev, commissionSettlements: res.data || [] }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      setData(emptyData);
      setDashboardData(null);
      return;
    }

    // Al iniciar sesión o cambiar de usuario, cargar inmediatamente su caché específico
    // Esto evita mostrar datos del usuario anterior (ej: admin a asesor)
    const cachedConfig = loadConfigCache();
    setData(prev => ({
      ...emptyData,
      sales: (loadSalesCache() as Sale[]) || [],
      clients: (loadClientsCache() as Client[]) || [],
      users: (loadUsersCache() as User[]) || [],
      config: { ...emptyData.config, ...(cachedConfig || {}) },
    }));
    setDashboardData(loadDashboardCache());
    setDashboardLoading(!loadDashboardCache());
    setSalesLoading(!loadSalesCache());

    if (!cachedConfig) {
       fetchConfig();
    }
  }, [user?.id, fetchConfig]);

  const refreshData = () => { 
    // Compatibilidad para el botón refrescar del usuario
    setDashboardData(null);
    invalidateDashboardCache();
    fetchSales();
    fetchClients();
    fetchFlights();
  };

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
    setDashboardData(null);
    fetchFlights();
    return created;
  };

  const updateSale = async (id: number, saleUpdate: Partial<Sale>) => {
    await api.updateSale(id, saleUpdate);
    const updated = await api.getSale(id);
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === id ? { ...s, ...updated, ...saleUpdate } : s)
    }));
    invalidateSalesCache();
    invalidateDashboardCache();
    setDashboardData(null);
    fetchFlights();
  };

  const deleteSale = async (id: number) => {
    await api.deleteSale(id);
    setData(prev => {
      const updatedSales = prev.sales.filter(s => s.id !== id);
      invalidateSalesCache();
      invalidateDashboardCache();
      return { ...prev, sales: updatedSales };
    });
    setDashboardData(null);
    invalidateDashboardCache();
    fetchFlights();
  };

  const voidSale = async (id: number, reason: string) => {
    await api.voidSale(id, reason);
    const updated = await api.getSale(id);
    setData(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === id ? { ...s, ...updated } : s)
    }));
    invalidateSalesCache();
    invalidateDashboardCache();
    setDashboardData(null);
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
    setDashboardData(null);
    invalidateDashboardCache();
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
    setDashboardData(null);
    invalidateDashboardCache();
  };


  const updateFlight = async (id: string, flightUpdate: Partial<Flight> | FormData) => {
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
    const list = (data.config as any)[section] || [];
    const maxId = list.reduce((max: number, i: any) => {
      const idNum = Number(i.id);
      return !isNaN(idNum) && idNum > max ? idNum : max;
    }, 0);
    const tempId = maxId + 1;

    const optimisticItem = { id: tempId, ...item };

    setData(prev => {
      const nextConfig = {
        ...prev.config,
        [section]: [...(prev.config as any)[section], optimisticItem]
      };
      saveConfigCache(nextConfig);
      return { ...prev, config: nextConfig };
    });

    try {
      const created = await api.createConfigItem(section, item);
      setData(prev => {
        const nextConfig = {
          ...prev.config,
          [section]: (prev.config as any)[section].map((i: any) => i.id === tempId ? created : i)
        };
        saveConfigCache(nextConfig);
        return { ...prev, config: nextConfig };
      });
      return created;
    } catch (err) {
      setData(prev => {
        const nextConfig = {
          ...prev.config,
          [section]: (prev.config as any)[section].filter((i: any) => i.id !== tempId)
        };
        saveConfigCache(nextConfig);
        return { ...prev, config: nextConfig };
      });
      throw err;
    }
  };

  const updateConfigItem = async (section: ConfigSection, id: number, itemUpdate: Record<string, unknown>) => {
    const originalItem = (data.config as any)[section].find((i: any) => i.id === id);

    setData(prev => {
      const nextConfig = {
        ...prev.config,
        [section]: (prev.config as any)[section].map((i: any) => i.id === id ? { ...i, ...itemUpdate } : i)
      };
      saveConfigCache(nextConfig);
      return { ...prev, config: nextConfig };
    });

    try {
      await api.updateConfigItem(section, id, itemUpdate);
    } catch (err) {
      setData(prev => {
        const nextConfig = {
          ...prev.config,
          [section]: (prev.config as any)[section].map((i: any) => i.id === id ? originalItem : i)
        };
        saveConfigCache(nextConfig);
        return { ...prev, config: nextConfig };
      });
      throw err;
    }
  };

  const deleteConfigItem = async (section: ConfigSection, id: number) => {
    const originalList = (data.config as any)[section];

    setData(prev => {
      const nextConfig = {
        ...prev.config,
        [section]: (prev.config as any)[section].filter((i: any) => i.id !== id)
      };
      saveConfigCache(nextConfig);
      return { ...prev, config: nextConfig };
    });

    try {
      await api.deleteConfigItem(section, id);
    } catch (err) {
      setData(prev => {
        const nextConfig = {
          ...prev.config,
          [section]: originalList
        };
        saveConfigCache(nextConfig);
        return { ...prev, config: nextConfig };
      });
      throw err;
    }
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
      fetchSales,
      fetchClients,
      fetchUsers,
      fetchConfig,
      fetchFlights,
      fetchCommissionAgents,
      fetchSettlements,
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
      voidSale,
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
