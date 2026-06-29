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
      title={editingClient ? "Editar Cliente" : "Nuevo Cliente"}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {errors.submit && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{errors.submit}</div>
        )}
        
        <div className="flex justify-center mb-6">
          <AvatarPicker
            value={formData.avatar || AVATARS[0]}
            onChange={(avatar) => setFormData((prev) => ({ ...prev, avatar }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Nombres" required error={errors.firstName}>
            <Input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              onBlur={(e) => validateField("firstName", e.target.value)}
              placeholder="Ej: Juan Pablo"
            />
          </FormField>
          <FormField label="Apellidos" required error={errors.lastName}>
            <Input
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              onBlur={(e) => validateField("lastName", e.target.value)}
              placeholder="Ej: Pérez Gómez"
            />
          </FormField>
          <FormField label="Tipo Doc" required error={errors.docType}>
            <Select
              value={formData.docType}
              onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
              onBlur={(e) => validateField("docType", e.target.value)}
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
            />
          </FormField>
          <FormField label="Email" required error={errors.email}>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              onBlur={(e) => validateField("email", e.target.value)}
            />
          </FormField>
          <FormField label="Teléfono" required error={errors.phone}>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              onBlur={(e) => validateField("phone", e.target.value)}
            />
          </FormField>

          <FormField label="Fecha Nacimiento">
            <DatePicker
              value={formData.birthDate || ""}
              onChange={(date) => setFormData({ ...formData, birthDate: date })}
              max={todayStr}
              popoverDirection="up"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar Cliente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
