import React, { useState, useMemo } from "react";
import { ShieldCheck, Plus, Search, X } from "lucide-react";
import { useData } from "../context/DataContext";
import { useUsersContext } from "../context/UsersContext";
import { useToast } from "../context/ToastContext";
import { Button } from "../components/ui/Button";
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-3">
            <ShieldCheck className="text-accent w-8 h-8" /> Gestión de Usuarios
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Administra los accesos, roles y permisos de tu equipo.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-primary/20">
          <Plus size={18} /> Nuevo Usuario
        </Button>
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
              <div className="flex flex-col sm:flex-row gap-3">
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
              onManagePermissions={() => {}}
            />
          </div>
        </Card>
      ) : (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
              <span>Configuración Global de Permisos</span>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={editingRole}
                  onChange={(e) => {
                    setEditingRole(e.target.value);
                    setEditingUserPermissions(data.config.rolePermissions[e.target.value]);
                  }}
                  className="text-sm border border-gray-border rounded-lg px-3 py-2 bg-white flex-1"
                >
                  <option value="asesor">Asesores</option>
                  <option value="freelancer">Freelancers</option>
                </select>
                <Button onClick={handleSaveRolePermissions} size="sm">Guardar Cambios</Button>
              </div>
            </div>
          </CardHeader>
          <div className="p-4 sm:p-6 bg-gray-50/50">
            {editingUserPermissions && (
              <PermissionsGrid
                permissions={editingUserPermissions}
                onChange={(cat, act, val) => {
                  const newPerms = { ...editingUserPermissions };
                  newPerms[cat][act] = val;
                  setEditingUserPermissions(newPerms);
                }}
              />
            )}
          </div>
        </Card>
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
    </div>
  );
}
