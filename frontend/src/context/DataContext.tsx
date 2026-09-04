import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { AppData, User, Client, Sale, Flight, Responsable, CommissionAgent, CommissionSettlement, RolePermissions, ADMIN_PERMISSIONS, normalizeRolePermissions } from '../types';
import * as api from '../api';
import { fetchAllPages } from '../api/fetchAll';
import { useAuth } from './AuthContext';
import { getCurrentMonth } from '../utils/formatters';
import {
  saveClientsCache,
  loadClientsCache,
} from '../utils/clientsCache';
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
  creditProveedores?: number;
  creditTa?: number;
}

interface DataContextType {
  data: AppData;
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  fetchDashboard: (params?: Record<string, unknown>, isBackgroundRefresh?: boolean) => Promise<void>;
  invalidateDashboard: () => void;
  fetchClients: () => Promise<void>;
  fetchResponsables: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchFlights: () => Promise<void>;
  /** Se incrementa cuando alguien pide refrescar los vuelos. */
  flightsRefreshToken: number;
  fetchCommissionAgents: () => Promise<void>;
  fetchSettlements: () => Promise<void>;
  refreshData: () => void;
  addUser: (user: Omit<User, 'id'>) => Promise<User>;
  updateUser: (id: number, user: Partial<User>) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<Client>;
  updateClient: (id: number, client: Partial<Client>) => Promise<void>;
  toggleClientStatus: (id: number) => Promise<void>;
  addResponsable: (responsable: any) => Promise<any>;
  updateResponsable: (id: number, responsable: any) => Promise<void>;
  deleteResponsable: (id: number) => Promise<void>;
  updateFlight: (id: string, flight: Partial<Flight> | FormData) => Promise<any>;
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
  users: [], clients: [], responsables: [],
  commissionAgents: [], commissionSettlements: [],
  config: {
    cards: [], paymentMethods: [], documentTypes: [],
    airlines: [], suppliers: [], airports: [],
    baggage: [], packages: [],
    rolePermissions: {
      asesor: { dashboard: { view: 'own' }, sales: { view: 'own', create: true, edit: true }, clients: { view: 'own', create: true, edit: false }, responsables: { view: 'own', create: true, edit: true }, itineraries: { view: 'own', edit: false }, commissions: { view: false, create: false, edit: false, delete: false } },
      freelancer: { dashboard: { view: 'own' }, sales: { view: 'own', create: true, edit: true }, clients: { view: 'own', create: true, edit: false }, responsables: { view: 'own', create: true, edit: true }, itineraries: { view: 'own', edit: false }, commissions: { view: false, create: false, edit: false, delete: false } },
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
    const cachedClients = loadClientsCache();
    const cachedUsers = loadUsersCache();
    const cachedConfig = loadConfigCache();

    const initialConfig = {
      ...emptyData.config,
      ...(cachedConfig || {})
    };

    if (cachedClients || cachedUsers || cachedConfig) {
      return {
        ...emptyData,
        clients: (cachedClients as Client[]) || [],
        users: (cachedUsers as User[]) || [],
        config: initialConfig,
      };
    }
    return emptyData;
  });
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => loadDashboardCache());
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(() => !loadDashboardCache());
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


  const fetchClients = useCallback(async () => {
    try {
      const res = await fetchAllPages<Client>(api.listClients, { sortOrder: 'desc' });
      if (res && res.data) {
        const freshClients = res.data;
        setData(prev => {
          saveClientsCache(freshClients);
          return { ...prev, clients: freshClients };
        });
      }
    } catch (err) {
      console.error('[DataContext] Error fetching clients:', err);
    }
  }, []);

  const fetchResponsables = useCallback(async () => {
    try {
      const res = await fetchAllPages<Responsable>(api.listResponsables, { sortOrder: 'desc' });
      if (res && res.data) {
        setData(prev => ({ ...prev, responsables: res.data }));
      }
    } catch (err) {
      console.error('[DataContext] Error fetching responsables:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetchAllPages<User>(api.listUsers, { sortOrder: 'desc' });
      if (res && res.data) {
        saveUsersCache(res.data);
        setData(prev => ({ ...prev, users: res.data }));
      }
    } catch (err) {
      console.error('[DataContext] Error fetching users:', err);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      // Los tres roles se leen de la base. 'admin' se pedía nunca y el frontend
      // usaba una constante inventada en su lugar.
      const [configAll, asesorPerms, freelancerPerms, adminPerms] = await Promise.all([
        api.getAllConfig().catch((err) => {
          console.error('[DataContext] Error fetching config:', err);
          return {};
        }),
        api.getRolePermissions('asesor').catch(() => null),
        api.getRolePermissions('freelancer').catch(() => null),
        api.getRolePermissions('admin').catch(() => null),
      ]);
      const resolvedRolePermissions = {
        asesor: asesorPerms ? normalizeRolePermissions(asesorPerms) : emptyData.config.rolePermissions.asesor,
        freelancer: freelancerPerms ? normalizeRolePermissions(freelancerPerms) : emptyData.config.rolePermissions.freelancer,
        ...(adminPerms ? { admin: normalizeRolePermissions(adminPerms, ADMIN_PERMISSIONS) } : {}),
      };
      if (configAll && Object.keys(configAll).length > 0) {
        const newConfig = {
          cards: configAll.cards || [],
          paymentMethods: configAll['payment-methods'] || [],
          documentTypes: configAll['document-types'] || [],
          airlines: configAll.airlines || [],
          suppliers: configAll.suppliers || [],
          airports: configAll.airports || [],
          baggage: configAll.baggage || [],
          packages: configAll.packages || [],
        };
        saveConfigCache(newConfig);
        
        setData(prev => ({
          ...prev,
          config: {
            ...prev.config,
            ...newConfig,
            rolePermissions: resolvedRolePermissions,
          }
        }));
      }
    } catch (err) {
      console.error('[DataContext] Error in fetchConfig catch block:', err);
    }
  }, []);

  const [flightsRefreshToken, setFlightsRefreshToken] = useState(0);

  /**
   * Señal de refresco para la pantalla de vuelos.
   *
   * Antes recorría TODAS las páginas de vuelos con fetchAllPages y guardaba el
   * resultado en `data.flights`, que ningún componente leía para renderizar: su
   * único uso era un parche optimista sobre una lista invisible. Se pagaba en el
   * arranque y en cada pulsación de refrescar, y crecía con la tabla.
   *
   * Y el botón de refrescar en /flights no refrescaba nada, porque la pantalla
   * relee con su propio contador. Ahora esta función incrementa ese contador, que
   * es lo que el botón siempre quiso hacer. Mismo arreglo que se hizo con la rama
   * `sales` del contexto.
   */
  const fetchFlights = useCallback(async () => {
    setFlightsRefreshToken(t => t + 1);
  }, []);

  const fetchCommissionAgents = useCallback(async () => {
    try {
      const res = await fetchAllPages<CommissionAgent>(api.listCommissionAgents, { sortOrder: 'desc' });
      if (res && res.data) {
        setData(prev => ({ ...prev, commissionAgents: res.data }));
      }
    } catch (err) {
      console.error('[DataContext] Error fetching agents:', err);
    }
  }, []);

  const fetchSettlements = useCallback(async () => {
    try {
      const res = await fetchAllPages<CommissionSettlement>(api.listSettlements, { sortOrder: 'desc' });
      if (res && res.data) {
        setData(prev => ({ ...prev, commissionSettlements: res.data }));
      }
    } catch (err) {
      console.error('[DataContext] Error fetching settlements:', err);
    }
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
    const cachedClients = loadClientsCache();
    const cachedUsers = loadUsersCache();
    
    setData(prev => ({
      ...emptyData,
      clients: (cachedClients as Client[]) || [],
      users: (cachedUsers as User[]) || [],
      config: { ...emptyData.config, ...(cachedConfig || {}) },
    }));
    setDashboardData(loadDashboardCache());
    setDashboardLoading(!loadDashboardCache());

    // Solo lo que hace falta desde el primer render en cualquier pantalla:
    // los catálogos que alimentan los selectores del wizard de ventas.
    //
    // Fuera quedan sales, settlements y flights: cada página los pide al
    // montarse, y sales además se consulta filtrada por cliente o asesor
    // donde se necesita. Antes se traían los tres al arrancar aunque el
    // usuario no llegara a abrir esas pantallas.
    //
    // Van en paralelo: la cascada existía para no agotar un pool de una sola
    // conexión, y ese límite ya no está.
    const loadBackgroundData = () => Promise.all([
      fetchConfig(),
      fetchClients(),
      fetchUsers(),
      fetchResponsables(),
      fetchCommissionAgents(),
    ]);

    loadBackgroundData();
  }, [
    user?.id, 
    fetchConfig, 
    fetchClients, 
    fetchUsers, 
    fetchResponsables, 
    fetchCommissionAgents
  ]);

  // Lo llaman las mutaciones de venta, que ya no viven aquí: crear o anular una
  // venta cambia las cifras del dashboard y hay que forzar su recarga.
  const invalidateDashboard = useCallback(() => {
    setDashboardData(null);
    invalidateDashboardCache();
  }, []);

  const refreshData = () => { 
    // Compatibilidad para el botón refrescar del usuario.
    // Ya no refresca sales: ningún componente lee data.sales — el listado vive
    // en SalesContext y los detalles se piden filtrados por cliente o asesor.
    setDashboardData(null);
    invalidateDashboardCache();
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
    // Optimistic toggle implemented in component if needed, else refetch
    await fetchClients();
  };

  const addResponsable = async (responsable: any) => {
    await api.createResponsable(responsable);
    await fetchResponsables();
  };

  const updateResponsable = async (id: number, responsable: any) => {
    const res = await api.updateResponsable(id, responsable);
    const updated = res.data;
    setData(prev => ({
      ...prev,
      responsables: prev.responsables.map(r => r.id === id ? updated : r)
    }));
  };

  const deleteResponsable = async (id: number) => {
    await api.deleteResponsable(id);
    await fetchResponsables();
  };









  const updateFlight = async (id: string, flightUpdate: Partial<Flight> | FormData) => {
    // Devuelve el resultado para que la pantalla decida qué hacer. Ya no parchea
    // `data.flights`: esa lista no existe (ver fetchFlights).
    return api.updateCheckin(id, flightUpdate as any);
  };


  const refreshSettlements = async () => {
    const res = await fetchAllPages<CommissionSettlement>(api.listSettlements).catch(() => ({ data: [] as any[] }));
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
      fetchDashboard,
      invalidateDashboard,
      fetchClients,
      fetchUsers,
      fetchConfig,
      fetchFlights,
      flightsRefreshToken,
      fetchResponsables,
      fetchCommissionAgents,
      fetchSettlements,
      refreshData,
      addUser,
      updateUser,
      deleteUser,
      addClient,
      updateClient,
      toggleClientStatus,
      addResponsable,
      updateResponsable,
      deleteResponsable,
      refreshSettlements,
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
