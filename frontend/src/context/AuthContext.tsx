import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getMe, getBranding } from '../api';
import { aplicarMarca, type Marca } from '../utils/marca';
import { invalidateClientsCache } from '../utils/clientsCache';
import { invalidateUsersCache } from '../utils/usersCache';
import { invalidateConfigCache } from '../utils/configCache';
import { invalidateDashboardCache } from '../utils/dashboardCache';
import type { LoginResponse } from '../api/auth';
import { SESION_CADUCADA } from '../api/client';

// El título de `index.html`, leído antes de que ninguna agencia lo cambie.
const TITULO_POR_DEFECTO = document.title;

/** Lo que se muestra como "quién soy" en el menú: el usuario, o la agencia cuando el superadmin la suplanta. */
export interface PerfilVisible {
  nombre: string;
  avatar: string | null;
  rol: string;
  /** Una línea de contexto: quién es de verdad quien opera, cuando es una suplantación. */
  detalle: string | null;
  suplantando: boolean;
}

interface AuthContextType {
  perfil: PerfilVisible | null;
  user: LoginResponse['user'] | null;
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
  /** Nombre, logo y colores de la agencia en la que estás. */
  marca: Marca | null;
  /** Por qué se cerró la sesión sin que el usuario lo pidiera (caducó, se revocó). */
  avisoSesion: string | null;
  limpiarAvisoSesion: () => void;
  /** Vuelve a leer la marca (tras cambiar el logo o el nombre en Mi empresa). */
  refrescarMarca: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avisoSesion, setAvisoSesion] = useState<string | null>(null);
  const [marca, setMarca] = useState<Marca | null>(null);

  /** La marca se guarda para pintarla y se aplica sobre el tema, a la vez. */
  const ponerMarca = (m: Marca | null) => {
    setMarca(m);
    aplicarMarca(m);
    // La pestaña lleva el nombre de la agencia; sin marca, el de `index.html`.
    document.title = m ? `${m.nombre} | Software de Agencias de Viajes` : TITULO_POR_DEFECTO;
  };

  useEffect(() => {
    const token = localStorage.getItem('nexus_token');

    if (token) {
      getMe()
        .then(async (userData) => {
          setUser(userData);
          // La marca se pide después de saber quién eres: depende de la empresa
          // del token, no de la URL. La pantalla de entrada es común a todas.
          await getBranding().then(ponerMarca).catch(() => {});
        })
        .catch(() => {
          localStorage.removeItem('nexus_token');
          localStorage.removeItem('nexus_session_expiry');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string, remember = false): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await apiLogin(email, password, remember);

      // El token primero, porque la marca se pide con él; y la marca antes de
      // `setUser`, para que la primera pantalla ya lleve la de la agencia en vez
      // de pintar la de la casa y cambiarla un instante después.
      localStorage.setItem('nexus_token', data.token);
      localStorage.setItem('nexus_remember', String(remember));
      await getBranding().then(ponerMarca).catch(() => {});
      setUser(data.user);

      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Error al iniciar sesión';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    apiLogout(localStorage.getItem('nexus_token')).catch(() => {});
    cerrarSesionLocal();
  };

  /** Lo que `logout` hace en el navegador, sin avisar al servidor. */
  const cerrarSesionLocal = () => {
    setUser(null);
    // Fuera la marca: la pantalla de entrada es común, y dejarla puesta haría
    // que quien sale de una agencia viera sus colores al ir a entrar en otra.
    ponerMarca(null);
    // Los cachés, ANTES de borrar el token: cada uno compone su clave con la
    // empresa y el usuario que lee del token, así que sin él borrarían la clave
    // anónima y dejarían intactos los datos de la agencia.
    invalidateClientsCache();
    invalidateUsersCache();
    invalidateConfigCache();
    invalidateDashboardCache();
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_session_expiry');
    localStorage.removeItem('nexus_remember');
    // El token del superadministrador guardado al suplantar. Es un token válido
    // por su cuenta: dejarlo aquí significa que cerrar sesión dentro de una
    // agencia deja en el navegador una sesión de superadministrador lista para
    // restaurarse a mano.
    localStorage.removeItem('nexus_original_token');
  };

  // La sesión caducó (30 min sin actividad) o se cerró en el servidor: fuera,
  // al login, con el motivo. Muchas peticiones fallan a la vez; da igual, el
  // cierre es idempotente. El borrador de una venta a medias sobrevive: vive
  // en localStorage con su propia clave.
  useEffect(() => {
    const alCaducar = (e: Event) => {
      const mensaje = (e as CustomEvent).detail?.mensaje;
      setAvisoSesion(mensaje || 'Tu sesión terminó. Vuelve a entrar para seguir.');
      cerrarSesionLocal();
    };
    window.addEventListener(SESION_CADUCADA, alCaducar);
    return () => window.removeEventListener(SESION_CADUCADA, alCaducar);
  }, []);

  // Dentro de una agencia suplantada la sesión sigue siendo la del superadministrador (es lo que da sus
  // permisos), pero lo que se ve es la agencia en la que opera: su nombre y su logo, no el perfil de quien
  // entra. La línea de abajo dice quién es de verdad.
  const perfil = useMemo<PerfilVisible | null>(() => {
    if (!user) return null;
    if (user.suplantacionId) {
      return {
        nombre: marca?.nombre || user.empresaNombre || user.empresaSlug,
        avatar: marca?.logoUrl ?? null,
        rol: 'Superadmin en la agencia',
        detalle: `Entraste como ${user.name}`,
        suplantando: true,
      };
    }
    return { nombre: user.name, avatar: user.avatar, rol: user.role, detalle: null, suplantando: false };
  }, [user, marca]);

  return (
    <AuthContext.Provider value={{
      user,
      perfil,
      login,
      logout,
      marca,
      avisoSesion,
      limpiarAvisoSesion: () => setAvisoSesion(null),
      refrescarMarca: () => getBranding().then(ponerMarca).catch(() => {}),
      // Rol administrativo, no el rol llamado 'admin'. `superadmin` se creó
      // como un admin con MÁS permisos, pero esta comparación exacta lo dejaba
      // fuera: al pasar el usuario 1 a superadmin desapareció del menú la
      // sección de Usuarios, Responsables y Gestión Interna, se perdió el
      // acceso a las rutas protegidas por `isAdmin` en App.tsx y el listado de
      // ventas se redujo a "Mis Ventas".
      //
      // Lo exclusivo de superadmin no se decide aquí: es `canEdit('permissions')`
      // de PermissionsContext, que ya distingue los dos roles.
      isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
