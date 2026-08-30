import { createContext, useContext, ReactNode, useMemo } from 'react';
import { User, RolePermissions, ADMIN_PERMISSIONS, DEFAULT_ASESOR_PERMISSIONS, DEFAULT_FREELANCER_PERMISSIONS, normalizeRolePermissions } from '../types';
import { useData } from './DataContext';

type ModulePermission = {
  [key: string]: unknown;
};

interface PermissionsContextType {
  permissions: RolePermissions;
  can: (module: keyof RolePermissions, action: string) => boolean;
  canEdit: (module: keyof RolePermissions) => boolean;
  canDelete: (module: keyof RolePermissions) => boolean;
  canCreate: (module: keyof RolePermissions) => boolean;
  canView: (module: keyof RolePermissions) => boolean;
}

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

    const deLaBase = data.config.rolePermissions?.[user.role];
    if (deLaBase) return deLaBase;

    if (user.role === 'admin') return ADMIN_PERMISSIONS;
    return user.role === 'freelancer' ? DEFAULT_FREELANCER_PERMISSIONS : DEFAULT_ASESOR_PERMISSIONS;
  }, [user, data.config.rolePermissions]);

  const can = (module: keyof RolePermissions, action: string): boolean => {
    const modulePerms = permissions[module] as ModulePermission;
    if (!modulePerms) return user?.role === 'admin';
    const actionValue = modulePerms[action];
    if (typeof actionValue === 'boolean') return actionValue;
    if (actionValue === 'all') return true;
    if (actionValue === 'own') return true;
    return false;
  };

  const canEdit = (module: keyof RolePermissions): boolean => {
    if (user?.role === 'admin') return true;
    const perm = permissions[module] as ModulePermission;
    if (!perm) return false;
    if ('edit' in perm) {
      const editVal = perm.edit;
      if (typeof editVal === 'boolean') return editVal;
      return editVal !== 'none';
    }
    return false;
  };

  const canDelete = (module: keyof RolePermissions): boolean => {
    if (user?.role === 'admin') return true;
    const perm = permissions[module] as ModulePermission;
    if (!perm) return false;
    if ('delete' in perm) return perm.delete === true;
    return false;
  };

  const canCreate = (module: keyof RolePermissions): boolean => {
    if (user?.role === 'admin') return true;
    const perm = permissions[module] as ModulePermission;
    if (!perm) return false;
    if ('create' in perm) return perm.create === true;
    return false;
  };

  const canView = (module: keyof RolePermissions): boolean => {
    if (user?.role === 'admin') return true;
    const perm = permissions[module] as ModulePermission;
    if (!perm) return true;
    if ('view' in perm) {
      const viewVal = perm.view;
      if (typeof viewVal === 'boolean') return viewVal;
      return viewVal === 'all' || viewVal === 'own';
    }
    return true;
  };

  return (
    <PermissionsContext.Provider value={{ permissions, can, canEdit, canDelete, canCreate, canView }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) throw new Error('usePermissions must be used within PermissionsProvider');
  return context;
}
