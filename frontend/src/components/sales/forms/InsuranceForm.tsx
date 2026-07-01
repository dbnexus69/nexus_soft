import React, { useEffect } from "react";
import { AlertCircle, Users, Briefcase, Trash2, PlusCircle } from "lucide-react";
import { FormField, Input, Select, CurrencyInput, Combobox } from "../../ui/Form";
import { Button } from "../../ui/Button";
import { InsuranceData, GuestInfo } from "../../../types";

interface InsuranceFormProps {
  insurance: InsuranceData;
  onChange: (updates: Partial<InsuranceData>) => void;
  data: any;
  client?: any;
}

export function InsuranceForm({ insurance, onChange, data, client }: InsuranceFormProps) {
  useEffect(() => {
    if (!insurance.phone && client?.phone) {
      onChange({ phone: client.phone });
    }
  }, [client?.phone, insurance.phone]);
  const addMember = () => {
    onChange({ members: [...insurance.members, { name: "", docType: "CC", docNumber: "" }] });
  };

  const removeMember = (mIdx: number) => {
    onChange({ members: insurance.members.filter((_, i) => i !== mIdx) });
  };

  const updateMember = (mIdx: number, mUpdates: Partial<GuestInfo>) => {
    const nextMembers = [...insurance.members];
    nextMembers[mIdx] = { ...nextMembers[mIdx], ...mUpdates };
    onChange({ members: nextMembers });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <AlertCircle size={14} />
          Datos del Seguro de Viaje
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Tipo de Seguro">
            <div className="relative pb-5">
              <Input
                value={insurance.insuranceType || ""}
                onChange={(e) => {
                  let cleaned = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                  if (cleaned.length > 0) {
                    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                  }
                  onChange({ insuranceType: cleaned });
                }}
                placeholder="Ej: Todo Riesgo, Básico"
                maxLength={40}
              />
              {insurance.insuranceType && insurance.insuranceType.length > 0 && insurance.insuranceType.length < 3 && (
                <p className="text-amber-500 text-xs mt-1 absolute bottom-0 left-0">⚠️ Mínimo 3 caracteres</p>
              )}
            </div>
          </FormField>
          <FormField label="Teléfono del Cliente">
            <Input
              value={insurance.phone}
              onChange={(e) => {
                // Only allow numbers, spaces, plus, minus, and parentheses
                const cleaned = e.target.value.replace(/[^0-9\s+\-()]/g, "");
                onChange({ phone: cleaned });
              }}
              placeholder="Ej: +57 300 123 4567"
              maxLength={20}
            />
          </FormField>
          <FormField label="Proveedor">
            <Combobox
              value={insurance.supplier}
              onChange={(val) => onChange({ supplier: val })}
              options={(data?.config?.suppliers || []).map((s: any) => ({ value: s.name, label: s.name }))}
              placeholder="Seleccionar proveedor..."
            />
          </FormField>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
            <Users size={14} />
            Miembros del Grupo
          </h4>
          <Button variant="outline" size="sm" onClick={addMember}>
            <PlusCircle size={14} className="mr-1" />
            Agregar
          </Button>
        </div>
        <div className="space-y-3">
          {insurance.members.map((member, mIdx) => (
            <div key={mIdx} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Combobox
                  value={member.name}
                  onChange={(val) => {
                    const client = (data?.clients || []).find(
                      (c: any) =>
                        (c.name === val || `${c.firstName} ${c.lastName || ""}`.trim() === val) &&
                        c.status === "active"
                    );
                    if (client) {
                      updateMember(mIdx, {
                        name: client.name || `${client.firstName} ${client.lastName || ""}`.trim(),
                        docType: client.docType || member.docType,
                        docNumber: client.docNumber || member.docNumber,
                      });
                    } else {
                      updateMember(mIdx, { name: val });
                    }
                  }}
                  options={(data?.clients || [])
                    .filter((c: any) => c.status === "active" && String(c.id) !== String(client?.id))
                    .map((c: any) => ({
                      value: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                      label: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                    }))}
                  placeholder="Nombre completo"
                />
                <Select
                  value={member.docType}
                  onChange={(e) => updateMember(mIdx, { docType: e.target.value })}
                  options={(data?.config?.documentTypes || []).map((d: any) => ({
                    value: d.abreviatura,
                    label: d.abreviatura,
                  }))}
                />
                <Input
                  value={member.docNumber}
                  onChange={(e) => updateMember(mIdx, { docNumber: e.target.value })}
                  placeholder="Número de documento"
                />
              </div>
              {insurance.members.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => removeMember(mIdx)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-emerald-50/20 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Briefcase size={14} /> Información Financiera
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Costo Proveedor">
            <CurrencyInput
              required
              value={insurance.supplierCost === 0 ? "" : insurance.supplierCost}
              onChange={(val) =>
                onChange({
                  supplierCost: val === "" ? 0 : Number(val),
                })
              }
            />
          </FormField>
          <FormField label="Valor TA">
            <CurrencyInput
              required
              value={insurance.ta === 0 ? "" : insurance.ta}
              onChange={(val) =>
                onChange({
                  ta: val === "" ? 0 : Number(val),
                })
              }
            />
          </FormField>
          <FormField label="Método de Pago">
            <Combobox
              value={insurance.supplierPaymentMethod || ""}
              onChange={(val) => onChange({ supplierPaymentMethod: val })}
              options={(data?.config?.cards || []).map((m: any) => ({
                value: m.name,
                label: m.lastFourDigits ? `${m.name} (**${m.lastFourDigits})` : m.name,
              }))}
              placeholder="Seleccionar método..."
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}