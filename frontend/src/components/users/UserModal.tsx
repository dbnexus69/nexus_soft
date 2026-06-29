import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Shield } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Select, FormField } from "../ui/Form";
import AvatarPicker, { AVATARS } from "../ui/AvatarPicker";
import { DatePicker } from "../sales/forms/TicketForm";
import { User } from "../../types";
import { capitalizeName } from "../../utils/formatters";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: User | null;
  documentTypes: Array<{ id: number; nombre: string; abreviatura: string }>;
  existingUsers: User[];
  onSave: (user: Partial<User>) => Promise<void>;
}

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
    docType: documentTypes?.[0]?.abreviatura || "",
    docNumber: "",
    phone: "",
    birthDate: "",
    status: "active",
    avatar: AVATARS[0]
  });

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
        docType: editingUser.docType || documentTypes?.[0]?.abbreviation || documentTypes?.[0]?.abreviatura || "",
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
        docType: documentTypes?.[0]?.abbreviation || "",
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
    if (!formData.firstName.trim()) newErrors.firstName = "El nombre es obligatorio";
    if (!formData.lastName.trim()) newErrors.lastName = "El apellido es obligatorio";
    if (!formData.email.trim()) newErrors.email = "El correo es obligatorio";
    if (!editingUser && !formData.password.trim()) newErrors.password = "La contraseña es obligatoria";
    if (!formData.docNumber.trim()) newErrors.docNumber = "El número de documento es obligatorio";

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
      const payload: any = {
        ...formData,
        name: `${capitalizeName(formData.firstName)} ${capitalizeName(formData.lastName)}`.trim()
      };
      if (!payload.password) delete payload.password;
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingUser ? "Editar Usuario" : "Registrar Nuevo Usuario"}
    >
      <div className="space-y-4 p-1">
        <div className="flex justify-center mb-4">
          <AvatarPicker 
            value={formData.avatar || AVATARS[0]}
            onChange={(avatar) => setFormData(prev => ({ ...prev, avatar }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombres" error={errors.firstName} required>
            <Input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="Ej: Juan"
            />
          </FormField>

          <FormField label="Apellidos" error={errors.lastName} required>
            <Input
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Ej: Pérez"
            />
          </FormField>
        </div>

        <FormField label="Correo Electrónico" error={errors.email} required>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="juan.perez@samtur.com"
          />
        </FormField>

        {!editingUser && (
          <FormField label="Contraseña Temporal" error={errors.password} required>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </FormField>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Rol del Sistema" required>
            <Select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="asesor">Asesor</option>
              <option value="freelancer">Freelancer</option>
              <option value="admin">Administrador</option>
            </Select>
          </FormField>

          <FormField label="Tipo de Documento">
            <Select
              value={formData.docType}
              onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
            >
              {documentTypes.map((dt: any) => {
                const code = dt.abbreviation || dt.abreviatura || dt.name;
                const name = dt.name || dt.nombre || code;
                return (
                  <option key={dt.id} value={code}>
                    {code}
                  </option>
                );
              })}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Número de Documento" error={errors.docNumber} required>
            <Input
              value={formData.docNumber}
              onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
              placeholder="Ej: 1098765432"
            />
          </FormField>

          <FormField label="Teléfono / WhatsApp">
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="300 123 4567"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {editingUser ? "Guardar Cambios" : "Registrar Usuario"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
