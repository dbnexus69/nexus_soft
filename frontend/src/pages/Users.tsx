import React, { useState, useMemo } from "react";
import { ShieldCheck, Plus, Search, X, Users as UsersIcon } from "lucide-react";
import { useData } from "../context/DataContext";
import { useUsersContext } from "../context/UsersContext";
import { useToast } from "../context/ToastContext";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Card, CardHeader } from "../components/ui/Card";
import { Input } from "../components/ui/Form";
import StatCard from "../components/ui/StatCard";
import PermissionsGrid from "../components/users/PermissionsGrid";
import UserDetailModal from "../components/users/UserDetailModal";
import { UserTable } from "../components/users/UserTable";
import { UserModal } from "../components/users/UserModal";
import { User } from "../types";
import LoadingScreen from "../components/ui/LoadingScreen";

export default function Users() {
  const { data } = useData(); // Dejamos data para referencias a config que no hemos migrado aun si las hubiera
  const { 
    users, 
    loading: usersLoading,
    handleCreateUser: addUser, 
    handleUpdateUser: updateUser, 
    handleDeleteUser: deleteUser, 
    handleSaveRolePermissions: updateRolePermissions, 
    handleSaveUserPermissions: updateUserPermissions,
    fetchUsers
  } = useUsersContext();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<"users" | "permissions">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: "asc" | "desc" }>({
    key: "id",
    direction: "desc",
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Permissions state
  const [editingRole, setEditingRole] = useState("asesor");
  const [editingUserPermissions, setEditingUserPermissions] = useState<any>(null);

  // Individual permissions state
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [permissionsModalUser, setPermissionsModalUser] = useState<User | null>(null);
  const [individualPermissions, setIndividualPermissions] = useState<any>(null);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    let filtered = [...users];
    if (filterRole !== "all") {
      filtered = filtered.filter((u) => u.role === filterRole);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(lower)) ||
          (u.docNumber && String(u.docNumber).toLowerCase().includes(lower)) ||
          (u.email && u.email.toLowerCase().includes(lower))
      );
    }
    filtered.sort((a, b) => {
      const aVal = String(a[sortConfig.key] || "").toLowerCase();
      const bVal = String(b[sortConfig.key] || "").toLowerCase();
      return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }, [users, filterRole, searchTerm, sortConfig]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
    } else {
      setEditingUser(null);
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (userUpdates: Partial<User>) => {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, userUpdates);
        success("Usuario actualizado exitosamente");
      } else {
        await addUser(userUpdates);
        success("Usuario creado exitosamente");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toastError(err.message || "Error al guardar usuario");
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (window.confirm(`¿Estás seguro de inhabilitar al usuario ${user.name}?`)) {
      try {
        await deleteUser(user.id);
        success("Usuario inhabilitado");
      } catch (err: any) {
        toastError("Error al eliminar usuario");
      }
    }
  };

  const handleSaveRolePermissions = async () => {
    try {
      await updateRolePermissions(editingRole, editingUserPermissions);
      success("Permisos actualizados");
    } catch (err: any) {
      toastError("Error al guardar permisos");
    }
  };

  if (usersLoading && users.length === 0) {
    return <LoadingScreen fullScreen={false} />;
  }

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      key: field as keyof User,
      direction: prev.key === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="space-y-6 relative animate-fade-in">
      {/* Header */}
      <div className="flex flex-col items-center justify-center gap-4 mb-6 text-center">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center justify-center gap-3">
            <ShieldCheck className="text-accent w-8 h-8" /> Gestión de Usuarios
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Administra los accesos, roles y permisos de tu equipo.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full sm:w-auto overflow-x-auto border-b border-gray-border scrollbar-none">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 sm:flex-initial text-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "users" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-primary"
          }`}
        >
          Lista de Usuarios
        </button>
        <button
          onClick={() => {
            setActiveTab("permissions");
            setEditingRole("asesor");
            setEditingUserPermissions(data.config.rolePermissions.asesor);
          }}
          className={`flex-1 sm:flex-initial text-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "permissions" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-primary"
          }`}
        >
          Permisos por Rol
        </button>
      </div>

      {activeTab === "users" ? (
        <Card className="animate-fade-in">
          <CardHeader
            actions={
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-end flex-wrap">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    placeholder="Buscar usuario..."
                    className="pl-10 pr-9 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="text-sm border border-gray-border rounded-lg px-3 py-2 bg-white"
                >
                  <option value="all">Todos los Roles</option>
                  <option value="admin">Admins</option>
                  <option value="asesor">Asesores</option>
                </select>
                <Button 
                  onClick={() => handleOpenModal()} 
                  className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 rounded-xl px-6 h-11 transition-all hover:scale-105 active:scale-95 w-full sm:w-auto sm:ml-auto"
                >
                  <Plus size={20} className="mr-1" /> Nuevo Usuario
                </Button>
              </div>
            }
          >
            Personal de la Agencia
          </CardHeader>
          <div className="overflow-x-auto">
            <UserTable
              users={filteredUsers}
              sortBy={sortConfig.key}
              sortOrder={sortConfig.direction}
              onSort={handleSort}
              onViewDetail={(u) => { setEditingUser(u); setIsDetailModalOpen(true); }}
              onEdit={(u) => handleOpenModal(u)}
              onDelete={handleDeleteUser}
              onManagePermissions={(u) => {
                setPermissionsModalUser(u);
                
                let parsedCustom = null;
                if (u.customPermissions) {
                  try {
                    parsedCustom = typeof u.customPermissions === 'string' 
                      ? JSON.parse(u.customPermissions) 
                      : u.customPermissions;
                  } catch (e) {
                    console.error("Error parsing custom permissions", e);
                  }
                }

                const defaultRolePerms = data?.config?.rolePermissions?.[u.role] || data?.config?.rolePermissions?.asesor || {
                  sales: { view: 'own', create: true, edit: 'own', delete: 'none' },
                  clients: { view: 'all', create: true, edit: 'own', delete: 'none' },
                  itineraries: { view: 'own', create: true, edit: 'own', delete: 'none' },
                  commissions: { view: 'own', create: false, edit: 'none', delete: 'none' },
                  dashboard: { view: true }
                };
                
                const mergedPerms = { ...defaultRolePerms };
                if (parsedCustom) {
                  for (const key in parsedCustom) {
                    mergedPerms[key] = { ...(mergedPerms[key] || {}), ...parsedCustom[key] };
                  }
                }
                
                setIndividualPermissions(mergedPerms);
                setIsPermissionsModalOpen(true);
              }}
            />
          </div>
        </Card>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 animate-fade-in">
          {/* Panel Izquierdo: Lista de Roles */}
          <div className="w-full md:w-1/3 lg:w-1/4">
            <Card className="h-full">
              <CardHeader className="pb-4">
                Roles de Sistema
              </CardHeader>
              <div className="p-4 space-y-3">
                {[
                  { id: "asesor", name: "Asesores", icon: <UsersIcon size={20} /> },
                  { id: "freelancer", name: "Freelancers", icon: <ShieldCheck size={20} /> }
                ].map(role => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setEditingRole(role.id);
                      setEditingUserPermissions(data.config.rolePermissions[role.id]);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                      editingRole === role.id 
                        ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-[1.02]' 
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-gray-100 dark:border-slate-700'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl transition-colors ${editingRole === role.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary dark:bg-slate-700 dark:text-blue-400'}`}>
                      {role.icon}
                    </div>
                    <span className="font-bold text-lg">{role.name}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Panel Derecho: Permisos */}
          <div className="w-full md:w-2/3 lg:w-3/4">
            <Card className="h-full flex flex-col shadow-sm border border-gray-100 dark:border-slate-700/50">
              <div className="p-6 md:p-8 border-b border-gray-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white dark:bg-slate-800 rounded-t-2xl">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
                    Políticas de Acceso: <span className="text-primary capitalize bg-primary/10 px-3 py-1 rounded-lg">{editingRole}</span>
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    Configura los privilegios predeterminados que tendrán todos los usuarios bajo este rol.
                  </p>
                </div>
                <Button 
                  onClick={handleSaveRolePermissions} 
                  className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-white font-bold px-8 h-12 rounded-xl hover:scale-105 active:scale-95 transition-all w-full sm:w-auto"
                >
                  Guardar Políticas
                </Button>
              </div>
              <div className="p-6 md:p-8 bg-gray-50/50 dark:bg-slate-800/30 flex-1 rounded-b-2xl">
                {editingUserPermissions && (
                  <PermissionsGrid
                    permissions={editingUserPermissions}
                    onChange={setEditingUserPermissions}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingUser={editingUser}
        documentTypes={(data.config.documentTypes as any) || []}
        existingUsers={users}
        onSave={handleSaveUser}
      />

      {editingUser && (
        <UserDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          user={editingUser}
          userSales={(data.sales as any).filter((s: any) => s.asesorId === editingUser.id || s.commissionAgentId === editingUser.id)}
        />
      )}

      {permissionsModalUser && (
        <Modal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          title={`Gestión de Accesos: ${permissionsModalUser.name}`}
          size="xl"
        >
          <div className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-inner">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-primary text-lg">Permisos Individuales</h4>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Estás ajustando los accesos específicos de este usuario. Al guardar, se sobrescribirán los permisos predeterminados de su rol (<strong className="capitalize">{permissionsModalUser.role}</strong>).
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50/80 dark:bg-slate-800/80 p-6 rounded-3xl border border-gray-100 dark:border-slate-700/50 max-h-[55vh] overflow-y-auto scrollbar-thin shadow-inner">
              {individualPermissions && (
                <PermissionsGrid
                  permissions={individualPermissions}
                  onChange={setIndividualPermissions}
                />
              )}
            </div>
            <div className="flex justify-end gap-4 pt-4 mt-6 border-t border-gray-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsPermissionsModalOpen(false)} className="h-12 px-8 rounded-xl font-bold border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">Cancelar</Button>
              <Button onClick={() => {
                if (permissionsModalUser) {
                  updateUserPermissions(permissionsModalUser.id, individualPermissions)
                    .then(() => {
                      success("Permisos individuales actualizados con éxito");
                      setIsPermissionsModalOpen(false);
                    })
                    .catch((err) => toastError(err.message || "Error al actualizar permisos"));
                }
              }} className="bg-primary hover:bg-primary/90 px-10 h-12 rounded-xl font-bold shadow-lg shadow-primary/20 text-white hover:scale-105 active:scale-95 transition-all">
                Guardar Privilegios
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
