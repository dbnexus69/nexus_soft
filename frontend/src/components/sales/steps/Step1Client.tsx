import { useCallback, useState } from "react";
import { Users } from "lucide-react";
import { FormField, Input, Combobox, Select } from "../../ui/Form";
import { AsyncCombobox } from "../../ui/AsyncCombobox";
import { WizardFormData } from "../wizardData";
import { getAvatarGradient } from "../../../utils/formatters";
import * as api from "../../../api";

export function Step1Client({ form, set, data, errors }: any) {
  // El cliente elegido se guarda aquí: ya no se puede buscar en data.clients,
  // porque el catálogo completo ya no viaja al navegador.
  const [clienteElegido, setClienteElegido] = useState<any>(null);

  const buscarClientes = useCallback(async (q: string) => {
    const res: any = await api.listClients({ search: q || undefined, perPage: 20, status: 'active' });
    return (res?.data || []).map((c: any) => ({ value: c.name, label: c.name, data: c }));
  }, []);

  const buscarAsesores = useCallback(async (q: string) => {
    const res: any = await api.listUsers({ search: q || undefined, perPage: 20 });
    return (res?.data || [])
      .filter((u: any) => u.status === 'active')
      .map((u: any) => ({ value: u.name, label: u.name, data: u }));
  }, []);

  const buscarComisionistas = useCallback(async (q: string) => {
    const res: any = await api.listCommissionAgents({ search: q || undefined, perPage: 20 });
    return (res?.data || []).map((a: any) => ({ value: a.name, label: a.name, data: a }));
  }, []);

  return (
    <div className="animate-fade-in space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-primary text-base">
              Cliente y Comisionista
            </h3>
            <p className="text-xs text-gray-500">
              Selecciona el cliente y los datos del comisionista si aplica.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Cliente *" error={errors.clientId}>
            <AsyncCombobox
              value={form.clientId}
              onChange={(val, opt) => {
                set("clientId", val);
                set("clientData", opt?.data);
                setClienteElegido(opt?.data ?? null);
              }}
              fetchOptions={buscarClientes}
              placeholder="Escribe para buscar un cliente..."
              emptyText="Ningún cliente coincide"
              error={errors.clientId}
            />
          </FormField>

          <FormField label="Asesor *">
            <AsyncCombobox
              value={form.asesorName}
              onChange={(val, opt) => {
                if (opt?.data) {
                  set("asesorId", String(opt.data.id));
                  set("asesorName", opt.data.name);
                } else {
                  set("asesorName", val);
                }
              }}
              fetchOptions={buscarAsesores}
              placeholder="¿Quién realiza la venta?"
              emptyText="Ningún asesor coincide"
            />
          </FormField>

          <FormField label="Comisionista / Referido" error={errors.commissionAgent}>
            <AsyncCombobox
              value={form.commissionAgentName || ""}
              onChange={(val, opt) => {
                if (!val) {
                  set("commissionAgentId", "");
                  set("commissionAgentName", "");
                  set("commissionAgentAmount", "0");
                  set("commissionAgentRetentionPercentage", "0");
                  set("commissionAgentNetPayment", "0");
                } else {
                  if (opt?.data) {
                    set("commissionAgentId", String(opt.data.id));
                    set("commissionAgentName", opt.data.name);
                  } else {
                    set("commissionAgentId", "");
                    set("commissionAgentName", val);
                  }
                }
              }}
              fetchOptions={buscarComisionistas}
              placeholder="Venta Directa (Sin Comisionista)"
              emptyText="Ningún comisionista coincide"
              error={errors.commissionAgent}
            />
          </FormField>
        </div>

        {/* Client preview card */}
        {form.clientId && (() => {
          // El cliente lo devuelve el propio selector, no una lista global.
          const client = (clienteElegido ?? form.clientData);
          if (!client || client.name !== form.clientId) return null;
          if (!client) return null;
          const gradient = getAvatarGradient(client.name);
          const initials = client.name.split(" ").filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">
                  {client.name}
                </p>
                <p className="text-xs text-gray-500">
                  {client.docType} {client.docNumber} · {client.email}
                </p>
              </div>
            </div>
          );
        })()}
      </div>
  );
}
