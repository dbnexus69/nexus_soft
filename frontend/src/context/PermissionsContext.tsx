import { createContext, useContext, ReactNode, useMemo } from 'react';
import { User, RolePermissions, ADMIN_PERMISSIONS, SUPERADMIN_PERMISSIONS, DEFAULT_ASESOR_PERMISSIONS, DEFAULT_FREELANCER_PERMISSIONS, normalizeRolePermissions, tieneAlcance } from '../types';
import { useData } from './DataContext';

type ModulePermission = {
  [key: string]: unknown;
};

interface PermissionsContextType {
  permissions: RolePermissions;
  canEdit: (module: keyof RolePermissions) => boolean;
  canDelete: (module: keyof RolePermissions) => boolean;
  canCreate: (module: keyof RolePermissions) => boolean;
  canView: (module: keyof RolePermissions) => boolean;
  /**
   * Sobre qué registros puede hacer `action` (spec 020): el de la acción, con el tope
   * del de ver si tiene alcance, igual que `authorize`. 'all' en las acciones sí/no
   * concedidas; 'none' en las denegadas.
   */
  scopeOf: (module: keyof RolePermissions, action: string) => 'all' | 'own' | 'none';
}

const RANGO = { none: 0, own: 1, all: 2 } as const;
const aAlcance = (v: unknown): 'all' | 'own' | 'none' =>
  v === 'all' || v === 'own' || v === 'none' ? v : v === true || v === 'true' ? 'all' : 'none';

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);


export function PermissionsProvider({
  children,
  user
}: {
  children: ReactNode;
  user: User | null;
}) {
  const { data } = useData();

  // Los permisos de cada rol vienen de la base (GET /roles/:rol/permissions) y
  // cambian cuando alguien los edita en la pantalla de Usuarios. Las constantes
  // de abajo son solo la red de seguridad para cuando esa petición aún no ha
  // respondido o ha fallado: nunca la fuente.
  const permissions = useMemo(() => {
    if (!user) return DEFAULT_ASESOR_PERMISSIONS;

    // Lo que aplica el servidor a este usuario (spec 027). Los del panel de roles solo los lee
    // quien tiene `permissions.view`, así que un asesor o un freelancer nunca los tendría.
    const propios = data.config.misPermisos;
    if (propios) return propios;
    const deLaBase = (data.config.rolePermissions as Record<string, RolePermissions | undefined> | undefined)?.[user.role];
    if (deLaBase) return deLaBase;

    if (user.role === 'superadmin') return SUPERADMIN_PERMISSIONS;
    if (user.role === 'admin') return ADMIN_PERMISSIONS;
    return user.role === 'freelancer' ? DEFAULT_FREELANCER_PERMISSIONS : DEFAULT_ASESOR_PERMISSIONS;
  }, [user, data.config.misPermisos, data.config.rolePermissions]);

  /**
   * El atajo que concede todo sin mirar los permisos.
   *
   * `superadmin` lo tiene entero. `admin` lo tiene para todo MENOS
   * `permissions`: si no, la pantalla le mostraría el botón de guardar y el
   * backend le devolvería un 403 al pulsarlo, que es la peor combinación.
   */
  const atajo = (module: keyof RolePermissions) =>
    user?.role === 'superadmin' || (user?.role === 'admin' && module !== 'permissions');

  /**
   * La única lectura de un permiso en la pantalla (spec 033), como `leerValor` en el servidor: el
   * de la acción y, si es una acción con alcance (`SCOPED_ACTIONS`), con el tope del de ver, igual
   * que `authorize`. Si el módulo o la acción no existen, 'none': cierra, no abre.
   */
  const scopeOf = (module: keyof RolePermissions, action: string): 'all' | 'own' | 'none' => {
    if (atajo(module)) return 'all';
    const perm = permissions[module] as ModulePermission | undefined;
    if (!perm || !(action in perm)) return 'none';
    const accion = aAlcance(perm[action]);
    if (action === 'view' || !tieneAlcance(module, action) || typeof perm.view !== 'string') return accion;
    const ver = aAlcance(perm.view);
    return RANGO[accion] <= RANGO[ver] ? accion : ver;
  };

  const canView = (module: keyof RolePermissions) => scopeOf(module, 'view') !== 'none';
  const canCreate = (module: keyof RolePermissions) => scopeOf(module, 'create') !== 'none';
  const canEdit = (module: keyof RolePermissions) => scopeOf(module, 'edit') !== 'none';
  const canDelete = (module: keyof RolePermissions) => scopeOf(module, 'delete') !== 'none';

  return (
    <PermissionsContext.Provider value={{ permissions, canEdit, canDelete, canCreate, canView, scopeOf }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error('usePermissions must be used within PermissionsProvider');
  return context;
}
