import React from 'react';
import { LayoutDashboard, ShoppingBag, Users as UsersGroup, Map, Lock, Settings } from 'lucide-react';
import { RolePermissions } from '../../types';

interface PermissionsGridProps {
  permissions: RolePermissions;
  onChange: (p: RolePermissions) => void;
}

export default function PermissionsGrid({ permissions, onChange }: PermissionsGridProps) {
  const toggle = (module: keyof RolePermissions, type: string) => {
    const next = { ...permissions };
    const modulePerms = { ...next[module] } as any;
    if (type in modulePerms) {
      if (typeof modulePerms[type] === 'boolean') {
        modulePerms[type] = !modulePerms[type];
      } else {
        if (modulePerms[type] === 'all') modulePerms[type] = 'own';
        else if (modulePerms[type] === 'own') modulePerms[type] = 'none';
        else modulePerms[type] = 'all';
      }
      (next as any)[module] = modulePerms;
      onChange(next);
    }
  };

  const modules: { id: keyof RolePermissions, label: string, icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'sales', label: 'Ventas', icon: <ShoppingBag size={18} /> },
    { id: 'clients', label: 'Clientes', icon: <UsersGroup size={18} /> },
    { id: 'itineraries', label: 'Itinerarios', icon: <Map size={18} /> },
    { id: 'users', label: 'Usuarios', icon: <Lock size={18} /> },
    { id: 'config', label: 'Configuración', icon: <Settings size={18} /> }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {modules.map(mod => (
        <div key={mod.id} className="p-5 border border-gray-border rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-100">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">{mod.icon}</div>
            <span className="font-bold text-base text-gray-800">{mod.label}</span>
          </div>
          <div className="flex flex-col gap-3">
            {Object.keys(permissions[mod.id]).map(permKey => {
              const val = (permissions[mod.id] as any)[permKey];
              const permLabels: Record<string, string> = {
                view: 'Ver', create: 'Crear', edit: 'Editar', delete: 'Eliminar'
              };
              const displayLabel = permLabels[permKey] || permKey;
              
              return (
                <div key={permKey} className="flex items-center justify-between p-2.5 bg-gray-50/50 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                  <span className="text-xs font-bold text-gray-600 capitalize">{displayLabel}</span>
                  {typeof val === 'boolean' ? (
                    <div 
                      className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${val ? 'bg-green-500' : 'bg-gray-300'}`}
                      onClick={() => toggle(mod.id, permKey)}
                    >
                      <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform duration-300 ${val ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  ) : (
                    <select 
                      className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      value={val}
                      onChange={(e) => {
                        const next = { ...permissions };
                        const modulePerms = { ...(next[mod.id] as any) };
                        modulePerms[permKey] = e.target.value;
                        (next as any)[mod.id] = modulePerms;
                        onChange(next);
                      }}
                    >
                      <option value="all">Todos</option>
                      <option value="own">Propios</option>
                      <option value="none">Ninguno</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
