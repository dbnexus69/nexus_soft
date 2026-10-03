import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Shield } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Select, FormField } from "../ui/Form";
import AvatarPicker, { AVATARS } from "../ui/AvatarPicker";
import Datepicker from "react-tailwindcss-datepicker";
import { User } from "../../types";
import { capitalizeName } from "../../utils/formatters";
import {
  limpiarDocumento, limpiarNombre, limpiarTelefono,
  mensajeDocumento, mensajeNacimiento, mensajeNombre, mensajeTelefono,
  normalizarDocumento, normalizarNombre,
} from "../../utils/datosPersona";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: User | null;
  documentTypes: Array<{ id: number; name?: string; nombre?: string; abbreviation?: string; abreviatura?: string }>;
  existingUsers: User[];
  onSave: (user: Partial<User>) => Promise<void>;
}

const CAMPOS = ["firstName", "lastName", "email", "password", "docTypeId", "docNumber", "phone", "birth_date"];

// Los tipos vienen de la base (id, nombre, abreviatura); las dos formas de escribirlos conviven en el contexto.
const abreviaturaDe = (dt?: { abbreviation?: string; abreviatura?: string; name?: string }) => dt?.abbreviation || dt?.abreviatura || dt?.name || "";
const nombreDe = (dt: { name?: string; nombre?: string; abbreviation?: string; abreviatura?: string }) => dt.name || dt.nombre || abreviaturaDe(dt);

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  editingUser,
  documentTypes,
  existingUsers,
  onSave
}) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "asesor",
    docTypeId: String(documentTypes?.[0]?.id ?? ""),
    docNumber: "",
    phone: "",
    birthDate: "",
    status: "active",
    avatar: AVATARS[0]
  });

  // La regla del número depende del tipo, y el tipo es un id: aquí se busca su abreviatura.
  const tipoElegido = documentTypes.find(dt => String(dt.id) === String(formData.docTypeId));
  const abreviatura = abreviaturaDe(tipoElegido);

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setFormData({
        firstName: editingUser.firstName || editingUser.name?.split(" ")[0] || "",
        lastName: editingUser.lastName || editingUser.name?.split(" ").slice(1).join(" ") || "",
        email: editingUser.email || "",
        password: "",
        role: editingUser.role || "asesor",
        docTypeId: String(
          editingUser.docTypeId
            ?? documentTypes.find(dt => abreviaturaDe(dt) === editingUser.docType)?.id
            ?? documentTypes?.[0]?.id ?? ""
        ),
        docNumber: editingUser.docNumber || "",
        phone: editingUser.phone || "",
        birthDate: editingUser.birthDate ? String(editingUser.birthDate).split("T")[0] : "",
        status: editingUser.status || "active",
        avatar: editingUser.avatar || AVATARS[0]
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "asesor",
        docTypeId: String(documentTypes?.[0]?.id ?? ""),
        docNumber: "",
        phone: "",
        birthDate: "",
        status: "active",
        avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)]
      });
    }
    setErrors({});
  }, [editingUser, isOpen, documentTypes]);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    const nombres = normalizarNombre(formData.firstName);
    const apellidos = normalizarNombre(formData.lastName);
    const docNumber = normalizarDocumento(formData.docNumber);
    if (!nombres) newErrors.firstName = "El nombre es obligatorio";
    else if (mensajeNombre(nombres)) newErrors.firstName = mensajeNombre(nombres)!;
    if (!apellidos) newErrors.lastName = "El apellido es obligatorio";
    else if (mensajeNombre(apellidos)) newErrors.lastName = mensajeNombre(apellidos)!;
    if (!formData.email.trim()) newErrors.email = "El correo es obligatorio";
    if (!editingUser && !formData.password.trim()) newErrors.password = "La contraseña es obligatoria";
    if (!formData.docTypeId) newErrors.docTypeId = "Seleccione el tipo de documento";
    if (!docNumber) newErrors.docNumber = "El número de documento es obligatorio";
    else if (formData.docTypeId && mensajeDocumento(abreviatura, docNumber)) newErrors.docNumber = mensajeDocumento(abreviatura, docNumber)!;
    if (mensajeTelefono(formData.phone.trim())) newErrors.phone = mensajeTelefono(formData.phone.trim())!;
    if (mensajeNacimiento(formData.birthDate)) newErrors.birthDate = mensajeNacimiento(formData.birthDate)!;

    const isDuplicateEmail = existingUsers.some(
      u => u.email.toLowerCase() === formData.email.toLowerCase() && (!editingUser || u.id !== editingUser.id)
    );
    if (isDuplicateEmail) newErrors.email = "Este correo ya está registrado";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const firstName = capitalizeName(normalizarNombre(formData.firstName));
      const lastName = capitalizeName(normalizarNombre(formData.lastName));
      const { docTypeId, ...resto } = formData;
      const payload: any = {
        ...resto,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        docTypeId: Number(docTypeId),
        docNumber,
        phone: formData.phone.trim(),
      };
      if (!payload.password) delete payload.password;
      await onSave(payload);
      onClose();
    } catch (err: any) {
      // El servidor manda cada error con su campo (`error.details`): se pinta junto al input, no en un aviso general.
      const respuesta = err?.response?.data?.error;
      const detalles: Array<{ field: string; message: string }> = Array.isArray(respuesta?.details) ? respuesta.details : [];
      const porCampo: Record<string, string> = {};
      const sueltos: string[] = [];
      for (const d of detalles) {
        if (CAMPOS.includes(d.field)) porCampo[d.field] = d.message;
        else sueltos.push(d.message);
      }
      const general = detalles.length === 0 ? respuesta?.message || err?.message || "Error al guardar" : sueltos.join(". ");
      setErrors({ ...porCampo, ...(general ? { submit: general } : {}) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingUser ? "Editar Usuario" : "Registrar Nuevo Usuario"}
      size="xl"
    >
      <div className="flex flex-col md:flex-row min-h-[500px]">
        {/* Panel Izquierdo - Avatar */}
        <div className="w-full md:w-1/3 bg-gray-50/50 dark:bg-slate-800/30 p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700/50 flex flex-col items-center justify-start relative overflow-hidden">
          <div className="relative z-10 w-full flex flex-col items-center">
            <AvatarPicker 
              value={formData.avatar || AVATARS[0]}
              onChange={(avatar) => setFormData(prev => ({ ...prev, avatar }))}
            />
            <div className="mt-6 text-center text-sm text-gray-500 bg-[#ffffff] dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700/50">
              <p>Selecciona un avatar moderno y premium para representar a este usuario en la plataforma.</p>
            </div>
          </div>
        </div>

        {/* Panel Derecho - Formulario */}
        <div className="w-full md:w-2/3 p-6 md:p-8 flex flex-col">
          <div className="flex-1 space-y-6">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-inner">
                <Shield size={24} />
              </div>
              <div>
                <h4 className="font-bold text-primary">Información de la Cuenta</h4>
                <p className="text-xs text-gray-500 dark:text-slate-400">Credenciales y configuración de acceso.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Nombres" error={errors.firstName} required>
                <Input
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: limpiarNombre(e.target.value) })}
                  placeholder="Ej: Juan"
                />
              </FormField>

              <FormField label="Apellidos" error={errors.lastName} required>
                <Input
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: limpiarNombre(e.target.value) })}
                  placeholder="Ej: Pérez"
                />
              </FormField>
            </div>

            <FormField label="Correo Electrónico" error={errors.email} required>
              <Input
                className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="juan.perez@nexus.com"
              />
            </FormField>

            {!editingUser && (
              <FormField label="Contraseña Temporal" error={errors.password} required>
                <div className="relative">
                  <Input
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors pr-10"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-primary transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormField>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Rol del Sistema" required>
                <Select
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="asesor">Asesor</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="admin">Administrador</option>
                </Select>
              </FormField>

              <FormField label="Tipo de Documento" error={errors.docTypeId}>
                <Select
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                  value={formData.docTypeId}
                  onChange={(e) => {
                    const docTypeId = e.target.value;
                    setFormData({ ...formData, docTypeId });
                    // Al cambiar el tipo se revalida el número ya escrito, sin borrarlo.
                    const nuevo = abreviaturaDe(documentTypes.find(dt => String(dt.id) === docTypeId));
                    const numero = normalizarDocumento(formData.docNumber);
                    setErrors((prev) => ({ ...prev, docNumber: numero ? mensajeDocumento(nuevo, numero) || "" : "" }));
                  }}
                >
                  {documentTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {nombreDe(dt)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Número de Documento" error={errors.docNumber} required>
                <Input
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                  value={formData.docNumber}
                  onChange={(e) => setFormData({ ...formData, docNumber: limpiarDocumento(abreviatura, e.target.value) })}
                  placeholder="Ej: 1098765432"
                />
              </FormField>

              <FormField label="Teléfono / WhatsApp" error={errors.phone}>
                <Input
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: limpiarTelefono(e.target.value) })}
                  placeholder="300 123 4567"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Fecha de Nacimiento" error={errors.birthDate || errors.birth_date}>
                <Datepicker
                  useRange={false}
                  asSingle={true}
                  value={{ startDate: formData.birthDate ? new Date(formData.birthDate) : null, endDate: formData.birthDate ? new Date(formData.birthDate) : null } as any}
                  onChange={(newValue: any) => setFormData({ ...formData, birthDate: newValue?.startDate || "" })}
                  primaryColor={"indigo"}
                  displayFormat={"DD/MM/YYYY"}
                  maxDate={new Date()}
                  placeholder={"DD/MM/YYYY"}
                  popoverDirection="up"
                  containerClassName="relative"
                  inputClassName="w-full h-12 text-sm font-medium text-gray-800 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all placeholder-gray-400"
                  toggleClassName="absolute right-3 top-3.5 text-gray-400 hover:text-primary transition-colors"
                />
              </FormField>
            </div>
          </div>

          {errors.submit && (
            <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {errors.submit}
            </p>
          )}
          <div className="flex gap-4 justify-end pt-8 mt-4 border-t border-gray-100 dark:border-slate-800">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="bg-primary hover:bg-primary/90 px-10 h-12 rounded-xl font-bold shadow-lg shadow-primary/20 text-white hover:scale-105 active:scale-95 transition-all">
              {isSaving ? "Guardando..." : editingUser ? "Guardar Cambios" : "Registrar Usuario"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
