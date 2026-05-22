import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Users as UsersIcon,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle,
  Shield,
  Eye,
  EyeOff,
  ShieldCheck,
  Briefcase,
  Key,
  Trash2,
  AlertTriangle,
  Edit,
} from "lucide-react";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Table, TableRow, TableCell } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { Input, Select, FormField } from "../components/ui/Form";
import {
  User,
  RolePermissions,
  DEFAULT_ASESOR_PERMISSIONS,
  ADMIN_PERMISSIONS,
  normalizeRolePermissions,
} from "../types";
import StatCard from "../components/ui/StatCard";
import PermissionsGrid from "../components/users/PermissionsGrid";

import AvatarPicker, { AVATARS } from "../components/ui/AvatarPicker";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  asesor: "Asesor",
  freelancer: "Freelancer",
  vendor: "Asesor",
  vendedor: "Asesor",
};

export default function Users() {
  const {
    data,
    addUser,
    updateUser,
    deleteUser,
    updateRolePermissions,
    updateUserPermissions,
  } = useData();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<"users" | "permissions">("users");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserForDetail, setSelectedUserForDetail] =
    useState<User | null>(null);
  const [selectedUserForPermissions, setSelectedUserForPermissions] =
    useState<User | null>(null);
  const [editingUserPermissions, setEditingUserPermissions] =
    useState<RolePermissions>(
      data.config.rolePermissions?.asesor || DEFAULT_ASESOR_PERMISSIONS,
    );
  const [editingRole, setEditingRole] = useState<'asesor' | 'freelancer'>('asesor');

  // Eliminación
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof User;
    direction: "asc" | "desc";
  }>({ key: "name", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "asesor" as "admin" | "asesor" | "freelancer",
    docType: "CC",
    docNumber: "",
    phone: "",
    birthDate: "",
    status: "active" as "active" | "inactive",
    avatar: AVATARS[0],
  });

  const stats = useMemo(() => {
    return {
      total: data.users.length,
      active: data.users.filter((u) => u.status === "active").length,
      inactive: data.users.filter((u) => u.status === "inactive").length,
      admins: data.users.filter((u) => u.role === "admin").length,
      asesores: data.users.filter((u) => u.role === "asesor").length,
      freelancers: data.users.filter((u) => u.role === "freelancer").length,
    };
  }, [data.users]);

  // Filtrado y Ordenado de usuarios
  const filteredUsers = useMemo(() => {
    const filtered = data.users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.docNumber.includes(searchTerm);
      const matchesRole = filterRole === "all" || user.role === filterRole;
      const matchesStatus =
        filterStatus === "all" || user.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [data.users, searchTerm, filterRole, filterStatus, sortConfig]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      const nameParts = user.name.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      setFormData({
        firstName,
        lastName,
        email: user.email,
        password: user.password,
        role: user.role,
        docType: user.docType || "CC",
        docNumber: user.docNumber || "",
        phone: user.phone || "",
        birthDate: user.birthDate || "",
        status: user.status,
        avatar: user.avatar || AVATARS[0],
      });
    } else {
      setEditingUser(null);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "asesor",
        docType: data.config.documentTypes?.[0]?.abreviatura || "",
        docNumber: "",
        phone: "",
        birthDate: "",
        status: "active",
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      });
    }
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim())
      newErrors.firstName = "El nombre es obligatorio";
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.firstName))
      newErrors.firstName = "El nombre solo debe contener letras";
    else if (formData.firstName.length > 40)
      newErrors.firstName = "El nombre no puede exceder 40 caracteres";

    if (!formData.lastName.trim())
      newErrors.lastName = "El apellido es obligatorio";
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.lastName))
      newErrors.lastName = "El apellido solo debe contener letras";
    else if (formData.lastName.length > 40)
      newErrors.lastName = "El apellido no puede exceder 40 caracteres";

    if (!formData.email.trim()) newErrors.email = "El correo es obligatorio";
    else if (
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)
    )
      newErrors.email = "El correo no es valido";
    else if (formData.email.length > 40)
      newErrors.email = "El correo no puede exceder 40 caracteres";

    if (!editingUser && !formData.password.trim())
      newErrors.password = "La contraseña es obligatoria";

    if (!formData.docNumber.trim())
      newErrors.docNumber = "El numero de documento es obligatorio";
    else if (formData.docNumber.length > 15)
      newErrors.docNumber = "El documento no puede exceder 15 caracteres";

    if (!formData.phone.trim()) newErrors.phone = "El telefono es obligatorio";
    else if (!/^\d+$/.test(formData.phone))
      newErrors.phone = "El telefono solo debe contener numeros";
    else if (formData.phone.length > 15)
      newErrors.phone = "El telefono no puede exceder 15 caracteres";

    if (!formData.birthDate)
      newErrors.birthDate = "La fecha de nacimiento es obligatoria";

    const isDuplicateEmail = data.users.some(
      (u) =>
        u.email.toLowerCase() === formData.email.toLowerCase() &&
        (!editingUser || u.id !== editingUser.id),
    );
    if (isDuplicateEmail) newErrors.email = "Este correo ya esta registrado";

    const isDuplicateDoc = data.users.some(
      (u) =>
        u.docNumber === formData.docNumber &&
        (!editingUser || u.id !== editingUser.id),
    );
    if (isDuplicateDoc)
      newErrors.docNumber = "Este numero de documento ya esta registrado";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          ...formData,
          name: `${formData.firstName} ${formData.lastName}`.trim(),
        });
        setSuccessMessage("Usuario actualizado exitosamente");
      } else {
        await addUser({
          ...formData,
          name: `${formData.firstName} ${formData.lastName}`.trim(),
        } as any);
        setSuccessMessage("Nuevo usuario registrado correctamente");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
      setShowSuccess(true);
      setIsModalOpen(false);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al guardar el usuario");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const action = user.status === "active" ? "desactivado" : "activado";
      await updateUser(user.id, {
        status: user.status === "active" ? "inactive" : "active",
      });
      setSuccessMessage(`Usuario ${user.name} ${action} correctamente`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al cambiar estado");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  const handleDeleteRequest = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setIsSaving(true);
    try {
      await deleteUser(userToDelete.id);
      setSuccessMessage("Usuario eliminado correctamente");
      setShowSuccess(true);
      setIsDeleteModalOpen(false);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al eliminar el usuario");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPermissions = (user: User) => {
    setSelectedUserForPermissions(user);
    const defaultPerms =
      user.role === "admin"
        ? ADMIN_PERMISSIONS
        : user.role === "freelancer"
          ? data.config.rolePermissions.freelancer
          : data.config.rolePermissions.asesor;
    setEditingUserPermissions(
      user.customPermissions
        ? normalizeRolePermissions(user.customPermissions)
        : defaultPerms
    );
    setIsPermissionsModalOpen(true);
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUserForPermissions) return;
    setIsSaving(true);
    try {
      await updateUserPermissions(selectedUserForPermissions.id, editingUserPermissions);
      setSuccessMessage(`Permisos de ${selectedUserForPermissions.name} actualizados`);
      setShowSuccess(true);
      setIsPermissionsModalOpen(false);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al guardar permisos");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRolePermissions = async () => {
    setIsSaving(true);
    try {
      await updateRolePermissions(editingRole, editingUserPermissions);
      setSuccessMessage(`Permisos globales del rol ${editingRole === "asesor" ? "Asesor" : "Freelancer"} actualizados`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al guardar permisos globales");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative animate-fade-in">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[100] flex justify-center">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="animate-confetti absolute top-0 text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                color: ["#FFD700", "#FF4500", "#00BFFF", "#32CD32", "#FF69B4"][
                  Math.floor(Math.random() * 5)
                ],
              }}
            >
              ★
            </div>
          ))}
        </div>
      )}

      {showSuccess && (
        <div className="fixed top-20 right-6 z-[100] bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-green-500 text-white rounded-full p-1">
            <CheckCircle size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}
      {showError && (
        <div className="fixed top-32 right-6 z-[100] bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-rose-500 text-white rounded-full p-1">
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Header de Sección */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
            <ShieldCheck className="text-accent w-8 h-8" /> Gestión de Usuarios
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Administra los accesos, roles y permisos de tu equipo corporativo.
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="shadow-lg shadow-primary/20"
        >
          <Plus size={18} /> Nuevo Usuario
        </Button>
      </div>



      <div className="flex gap-2 border-b border-gray-border">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "users" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-primary"}`}
        >
          Lista de Usuarios
        </button>
        <button
          onClick={() => {
            setActiveTab("permissions");
            setEditingRole('asesor');
            setEditingUserPermissions(data.config.rolePermissions.asesor);
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "permissions" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-primary"}`}
        >
          Permisos por Rol
        </button>
      </div>

      {activeTab === "users" ? (
        <Card>
          <CardHeader
            actions={
              <div className="flex gap-2">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    className="pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  options={[
                    { value: "all", label: "Todos los Roles" },
                    { value: "admin", label: "Admins" },
                    { value: "asesor", label: "Asesores" },
                    { value: "freelancer", label: "Freelancers" },
                  ]}
                  className="w-32 py-1.5"
                />
              </div>
            }
          >
            Personal de la Agencia
          </CardHeader>
          <Table
            headers={[
              "#",
              "Usuario",
              "Rol",
              "Documento",
              "Teléfono",
              "Estado",
              "Acciones",
            ]}
          >
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar}
                      className="w-8 h-8 rounded-full border border-gray-200"
                      alt={user.name}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-primary leading-tight">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.role === "admin" ? "active" : "inactive"}
                    className="uppercase text-[9px]"
                  >
                    {ROLE_LABELS[user.role] || user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {user.docType} {user.docNumber}
                </TableCell>
                <TableCell className="text-xs">{user.phone}</TableCell>
                <TableCell>
                  <Badge variant={user.status}>
                    {user.status === "active" ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenModal(user)}
                      title="Editar"
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenPermissions(user)}
                      title="Permisos"
                    >
                      <Key size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(user)}
                      title={
                        user.status === "active" ? "Desactivar" : "Activar"
                      }
                    >
                      {user.status === "active" ? (
                        <UserX size={14} className="text-red-500" />
                      ) : (
                        <UserCheck size={14} className="text-green-500" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRequest(user)}
                      title="Eliminar"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </Card>
      ) : (
        <Card className="animate-fade-in">
          <CardHeader
            actions={
              <Button onClick={handleSaveRolePermissions} disabled={isSaving}>
                <ShieldCheck size={18} /> {isSaving ? "Guardando..." : "Guardar Cambios Globales"}
              </Button>
            }
          >
            Configuración de Permisos por Defecto
          </CardHeader>
          <CardBody>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-6 flex gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <p className="text-xs text-amber-700 leading-relaxed">
                Aquí defines los permisos predeterminados. Los cambios aplicarán
                a todos los usuarios del rol seleccionado que no tengan permisos
                personalizados.
              </p>
            </div>
            <div className="flex gap-4 mb-6">
              <Button
                variant={
                  editingRole === 'asesor'
                    ? "primary"
                    : "outline"
                }
                onClick={() => {
                  setEditingRole('asesor');
                  setEditingUserPermissions(data.config.rolePermissions.asesor);
                }}
              >
                Rol Asesor
              </Button>
              <Button
                variant={
                  editingRole === 'freelancer'
                    ? "primary"
                    : "outline"
                }
                onClick={() => {
                  setEditingRole('freelancer');
                  setEditingUserPermissions(
                    data.config.rolePermissions.freelancer,
                  );
                }}
              >
                Rol Freelancer
              </Button>
            </div>
            <PermissionsGrid
              permissions={editingUserPermissions}
              onChange={setEditingUserPermissions}
            />
          </CardBody>
        </Card>
      )}

      {/* Modales */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? "Editar Usuario" : "Nuevo Usuario"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </>
        }
      >
        <AvatarPicker
          value={formData.avatar}
          onChange={(avatar) => setFormData({ ...formData, avatar })}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nombres" error={errors.firstName}>
            <Input
              maxLength={40}
              value={formData.firstName}
              onChange={(e) => {
                setFormData({ ...formData, firstName: e.target.value });
                if (errors.firstName)
                  setErrors((p) => ({ ...p, firstName: "" }));
              }}
            />
          </FormField>
          <FormField label="Apellidos" error={errors.lastName}>
            <Input
              maxLength={40}
              value={formData.lastName}
              onChange={(e) => {
                setFormData({ ...formData, lastName: e.target.value });
                if (errors.lastName) setErrors((p) => ({ ...p, lastName: "" }));
              }}
            />
          </FormField>
          <FormField label="Correo" error={errors.email}>
            <Input
              maxLength={40}
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                if (errors.email) setErrors((p) => ({ ...p, email: "" }));
              }}
            />
          </FormField>
          <FormField label="Contraseña" error={errors.password}>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: "" }));
                }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>
          <FormField label="Rol">
            <Select
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value as "admin" | "asesor" | "freelancer",
                })
              }
              options={[
                { value: "admin", label: "Administrador" },
                { value: "asesor", label: "Asesor" },
                { value: "freelancer", label: "Freelancer" },
              ]}
            />
          </FormField>
          <FormField label="Tipo Doc">
            <Select
              value={formData.docType}
              onChange={(e) =>
                setFormData({ ...formData, docType: e.target.value })
              }
              options={[
                { value: "", label: "Seleccione" },
                ...(data.config.documentTypes || []).map((d: any) => ({
                  value: d.abreviatura,
                  label: `${d.abreviatura} - ${d.nombre}`,
                })),
              ]}
            />
          </FormField>
          <FormField label="Documento" error={errors.docNumber}>
            <Input
              maxLength={15}
              value={formData.docNumber}
              onChange={(e) => {
                setFormData({ ...formData, docNumber: e.target.value });
                if (errors.docNumber)
                  setErrors((p) => ({ ...p, docNumber: "" }));
              }}
            />
          </FormField>
          <FormField label="Teléfono" error={errors.phone}>
            <Input
              maxLength={15}
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: e.target.value });
                if (errors.phone) setErrors((p) => ({ ...p, phone: "" }));
              }}
            />
          </FormField>
          <FormField label="Fecha Nacimiento" error={errors.birthDate}>
            <Input
              type="date"
              value={formData.birthDate}
              onChange={(e) => {
                setFormData({ ...formData, birthDate: e.target.value });
                if (errors.birthDate)
                  setErrors((p) => ({ ...p, birthDate: "" }));
              }}
            />
          </FormField>
          <FormField label="Estado">
            <Select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "active" | "inactive",
                })
              }
              options={[
                { value: "active", label: "Activo" },
                { value: "inactive", label: "Inactivo" },
              ]}
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        title={`Permisos: ${selectedUserForPermissions?.name}`}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsPermissionsModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveUserPermissions} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Actualizar Permisos"}
            </Button>
          </>
        }
      >
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
          <ShieldCheck className="text-blue-500 shrink-0" size={24} />
          <div>
            <p className="text-sm font-bold text-blue-900">
              Configuración Personalizada
            </p>
            <p className="text-xs text-blue-700">
              Estos permisos sobrescriben la configuración global para este
              usuario específico.
            </p>
          </div>
        </div>
        <PermissionsGrid
          permissions={editingUserPermissions}
          onChange={setEditingUserPermissions}
        />
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Usuario"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={isSaving}>
              {isSaving ? "Eliminando..." : "Confirmar Eliminación"}
            </Button>
          </>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">¿Estás seguro?</h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Esta acción eliminará permanentemente al usuario{" "}
            <b>{userToDelete?.name}</b>. Esta acción no se puede deshacer.
          </p>
        </div>
      </Modal>
    </div>
  );
}
