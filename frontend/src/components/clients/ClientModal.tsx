import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Select, FormField } from "../ui/Form";
import { DatePicker } from "../sales/forms/TicketForm";
import AvatarPicker, { AVATARS } from "../ui/AvatarPicker";
import { Client } from "../../types";
import { capitalizeName, todayStr } from "../../utils/formatters";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingClient: Client | null;
  documentTypes: Array<{ id: number; name: string; abbreviation: string }>;
  onSave: (clientData: Partial<Client>) => Promise<void>;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  editingClient,
  documentTypes,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Client>>({
    firstName: "",
    lastName: "",
    docType: "",
    docNumber: "",
    email: "",
    phone: "",
    address: "",
    birthDate: "",
    avatar: AVATARS[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingClient) {
      setFormData({
        firstName: editingClient.firstName || editingClient.name.split(" ")[0],
        lastName: editingClient.lastName || editingClient.name.split(" ").slice(1).join(" "),
        docType: editingClient.docType,
        docNumber: editingClient.docNumber,
        email: editingClient.email,
        phone: editingClient.phone,
        address: editingClient.address,
        birthDate: editingClient.birthDate,
        avatar: editingClient.avatar || AVATARS[0],
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        docType: "",
        docNumber: "",
        email: "",
        phone: "",
        address: "",
        birthDate: "",
        avatar: AVATARS[0],
      });
    }
    setErrors({});
  }, [editingClient, isOpen]);

  const validateField = (name: string, value: string) => {
    let errorMsg = "";
    switch (name) {
      case "firstName":
      case "lastName":
        if (!value.trim()) errorMsg = "Obligatorio";
        else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value)) errorMsg = "Solo letras";
        else if (value.length > 40) errorMsg = "Máx 40 caracteres";
        break;
      case "docType":
        if (!value) errorMsg = "Seleccione tipo";
        break;
      case "docNumber":
        if (!value.trim()) errorMsg = "Obligatorio";
        else if (!/^[a-zA-Z0-9]+$/.test(value)) errorMsg = "Alfanumérico";
        else if (value.length < 5 || value.length > 20) errorMsg = "5-20 caracteres";
        break;
      case "email":
        if (!value.trim()) errorMsg = "Obligatorio";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errorMsg = "Email inválido";
        break;
      case "phone":
        if (!value.trim()) errorMsg = "Obligatorio";
        else if (!/^[0-9+\s-]{7,15}$/.test(value)) errorMsg = "7-15 dígitos";
        break;
    }
    setErrors((prev) => ({ ...prev, [name]: errorMsg }));
    return !errorMsg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldsToValidate = ["firstName", "lastName", "docType", "docNumber", "email", "phone"];
    let isValid = true;
    fieldsToValidate.forEach((field) => {
      if (!validateField(field, (formData as any)[field] || "")) {
        isValid = false;
      }
    });

    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        firstName: capitalizeName(formData.firstName || ""),
        lastName: capitalizeName(formData.lastName || ""),
        name: `${capitalizeName(formData.firstName || "")} ${capitalizeName(formData.lastName || "")}`.trim(),
        email: formData.email?.toLowerCase(),
      };
      await onSave(dataToSave);
      onClose();
    } catch (err: any) {
      setErrors({ submit: err.message || "Error al guardar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingClient ? "Editar Perfil del Cliente" : "Crear Perfil de Cliente"}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row min-h-[500px]">
        {/* Left Column - Avatar */}
        <div className="w-full md:w-1/3 bg-gray-50/50 dark:bg-slate-800/30 p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700/50 flex flex-col items-center justify-start relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 w-full">
            <AvatarPicker
              value={formData.avatar || AVATARS[0]}
              onChange={(avatar) => setFormData((prev) => ({ ...prev, avatar }))}
            />
            <div className="mt-6 text-center text-sm text-gray-500 bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700/50">
              <p>Selecciona un avatar moderno y premium que represente a tu cliente.</p>
            </div>
          </div>
        </div>

        {/* Right Column - Form Data */}
        <div className="w-full md:w-2/3 p-6 md:p-8 flex flex-col justify-between bg-white dark:bg-slate-900">
          <div className="space-y-8">
            {errors.submit && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4 border border-red-100 flex items-center gap-2">
                <span className="font-bold">Error:</span> {errors.submit}
              </div>
            )}
            
            {/* Personal Info Section */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-6 w-1 bg-primary rounded-full"></div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Información Personal
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label="Nombres" required error={errors.firstName}>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    onBlur={(e) => validateField("firstName", e.target.value)}
                    placeholder="Ej: Juan Pablo"
                    className="bg-gray-50/50"
                  />
                </FormField>
                <FormField label="Apellidos" required error={errors.lastName}>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    onBlur={(e) => validateField("lastName", e.target.value)}
                    placeholder="Ej: Pérez Gómez"
                    className="bg-gray-50/50"
                  />
                </FormField>
                
                <FormField label="Tipo Doc" required error={errors.docType}>
                  <Select
                    value={formData.docType}
                    onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                    onBlur={(e) => validateField("docType", e.target.value)}
                    className="bg-gray-50/50"
                  >
                    <option value="">Seleccione...</option>
                    {(documentTypes || []).map((dt: any) => (
                      <option key={dt.id} value={dt.abbreviation}>
                        {dt.abbreviation}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="No. Documento" required error={errors.docNumber}>
                  <Input
                    value={formData.docNumber}
                    onChange={(e) => setFormData({ ...formData, docNumber: e.target.value.toUpperCase() })}
                    onBlur={(e) => validateField("docNumber", e.target.value)}
                    className="bg-gray-50/50"
                  />
                </FormField>
                <FormField label="Fecha Nacimiento">
                  <DatePicker
                    value={formData.birthDate || ""}
                    onChange={(date) => setFormData({ ...formData, birthDate: date })}
                    max={todayStr()}
                    popoverDirection="up"
                    fieldName="birthDate"
                  />
                </FormField>
              </div>
            </div>

            {/* Contact Info Section */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="h-6 w-1 bg-accent rounded-full"></div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Información de Contacto
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label="Email" required error={errors.email}>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={(e) => validateField("email", e.target.value)}
                    className="bg-gray-50/50"
                  />
                </FormField>
                <FormField label="Teléfono" required error={errors.phone}>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={(e) => validateField("phone", e.target.value)}
                    className="bg-gray-50/50"
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-gray-100 dark:border-slate-700/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="min-w-[120px]">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[160px] shadow-lg shadow-primary/20">
              {isSubmitting ? "Guardando..." : "Guardar Cliente"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
