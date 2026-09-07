import React, { useState, useMemo } from "react";
import { ShieldCheck, Plus, Search, X } from "lucide-react";
import { useData } from "../context/DataContext";
import { useUsersContext } from "../context/UsersContext";
import { usePermissions } from "../context/PermissionsContext";
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

export default function Users() {
  const { data, fetchConfig } = useData(); // Dejamos data para referencias a config que no hemos migrado aun si las hubiera
  const { 
    users, 
    loading: usersLoading,
    handleCreateUser: addUser, 
    handleUpdateUser: updateUser, 
    handleDeleteUser: deleteUser, 
    handleSaveRolePermissions: updateRolePermissions, 
    fetchUsers
  } = useUsersContext();
  const { success, error: toastError } = useToast();
  const { canEdit } = usePermissions();

  // Solo el superadministrador tiene `permissions.edit`. Al admin se le muestra
  // la pantalla en lectura: puede ver qué puede hacer cada rol, no cambiarlo.
  const puedeEditarPermisos = canEdit("permissions");

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
      // Releer de la base: lo que se muestra debe ser lo que quedó guardado,
      // no lo que el formulario tenía en pantalla.
      await fetchConfig();
      success("Permisos actualizados");
    } catch (err: any) {
      toastError(err?.response?.data?.error?.message || "Error al guardar permisos");
    }
  };

  // Sin retorno temprano: la página se pinta y la tabla trae su esqueleto,
  // así el alto no salta ni desaparecen los filtros en cada carga.
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
                  className="bg-primary hover:bg-primary-dark text-white shadow-md rounded-xl px-6 h-11 transition-colors"
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
          loading={usersLoading && users.length === 0}
              users={filteredUsers}
              sortBy={sortConfig.key}
              sortOrder={sortConfig.direction}
              onSort={handleSort}
              onViewDetail={(u) => { setEditingUser(u); setIsDetailModalOpen(true); }}
              onEdit={(u) => handleOpenModal(u)}
              onDelete={handleDeleteUser}
            />
          </div>
        </Card>
      ) : (
        <div className="animate-fade-in space-y-5">
          {/* Los roles pasan a pestañas, no a un panel de un tercio de pantalla.
              Eran cuatro botones de una palabra ocupando una columna entera,
              con icono, `font-bold text-lg`, `shadow-xl` y `scale-[1.02]`,
              mientras la matriz —que tiene cinco columnas— se apretaba en los
              dos tercios restantes. Es el mismo patrón de pestañas subrayadas
              de Gestión Interna: selección de sección, no filtro. */}
          <nav
            className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-border px-1"
            aria-label="Roles"
          >
            {[
              { id: 'asesor', name: 'Asesores' },
              { id: 'freelancer', name: 'Freelancers' },
            ].map(role => {
              const activo = editingRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    setEditingRole(role.id);
                    setEditingUserPermissions(data.config.rolePermissions[role.id]);
                  }}
                  aria-current={activo ? 'page' : undefined}
                  className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight ${
                    activo
                      ? 'border-highlight text-highlight'
                      : 'border-transparent text-accent hover:border-gray-border hover:text-primary dark:hover:text-white'
                  }`}
                >
                  {role.name}
                </button>
              );
            })}
          </nav>

          {/* Una sola superficie. Antes eran tres anidadas: la tarjeta, un panel
              gris dentro y la tabla con su propio borde y radio encima. */}
          <div className="rounded-2xl border border-gray-border bg-white p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-lg font-semibold text-primary dark:text-white">
                  Qué puede hacer un <span className="capitalize">{editingRole}</span>
                </h3>
                <p className="mt-0.5 text-sm text-accent">
                  Se aplica a todos los usuarios con este rol. Se guarda en la base de datos.
                </p>
              </div>
              {/* Solo superadmin: el backend responde 403 a los demás, así que
                  mostrar un botón activo sería prometer algo que no va a pasar. */}
              {puedeEditarPermisos ? (
                <Button size="sm" onClick={handleSaveRolePermissions}>
                  Guardar cambios
                </Button>
              ) : (
                <p className="max-w-xs text-xs text-accent">
                  Solo el superadministrador puede cambiar los permisos de un rol.
                  Aquí se ven, pero no se editan.
                </p>
              )}
            </div>

            {editingUserPermissions && (
              <PermissionsGrid
                permissions={editingUserPermissions}
                onChange={setEditingUserPermissions}
                readOnly={!puedeEditarPermisos}
              />
            )}
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
        />
      )}

    </div>
  );
}
