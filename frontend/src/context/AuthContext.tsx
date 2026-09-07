import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, getMe } from '../api';
import type { LoginResponse } from '../api/auth';

interface AuthContextType {
  user: LoginResponse['user'] | null;
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('itea_token');

    if (token) {
      getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem('itea_token');
          localStorage.removeItem('itea_session_expiry');
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string, remember = false): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await apiLogin(email, password, remember);

      // Limpiar caché vieja antes de guardar el nuevo token
      localStorage.removeItem('itea_dashboard_cache');

      setUser(data.user);

      localStorage.setItem('itea_token', data.token);
      localStorage.setItem('itea_remember', String(remember));

      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Error al iniciar sesión';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    apiLogout().catch(() => {});
    setUser(null);
    localStorage.removeItem('itea_token');
    localStorage.removeItem('itea_user');
    localStorage.removeItem('itea_session_expiry');
    localStorage.removeItem('itea_remember');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
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
