import { Users } from "lucide-react";
import { FormField, Input, Combobox, Select } from "../../ui/Form";
import { WizardFormData } from "../wizardData";
import { getAvatarGradient } from "../../../utils/formatters";

export function Step1Client({ form, set, data, errors }: any) {
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
            <Combobox
              value={form.clientId}
              onChange={(val) => set("clientId", val)}
              options={data.clients
                .filter((c: any) => c.status === "active")
                .map((c: any) => ({
                  value: c.name,
                  label: c.name,
                }))}
              placeholder="Seleccionar o escribir nombre..."
              error={errors.clientId}
            />
          </FormField>

          <FormField label="Asesor *">
            <Combobox
              value={form.asesorName}
              onChange={(val) => {
                const selected = data.users.find((u: any) => u.name === val);
                if (selected) {
                  set("asesorId", String(selected.id));
                  set("asesorName", selected.name);
                } else {
                  set("asesorName", val);
                }
              }}
              options={data.users
                .filter((u: any) => u.status === "active")
                .map((u: any) => ({
                  value: u.name,
                  label: u.name,
                }))}
              placeholder="¿Quién realiza la venta?"
            />
          </FormField>

          <FormField label="Comisionista / Referido" error={errors.commissionAgent}>
            <Combobox
              value={form.commissionAgentName || ""}
              onChange={(val) => {
                if (!val) {
                  set("commissionAgentId", "");
                  set("commissionAgentName", "");
                  set("commissionAgentAmount", "0");
                  set("commissionAgentRetentionPercentage", "0");
                  set("commissionAgentNetPayment", "0");
                } else {
                  const agent = (data.commissionAgents || []).find((a: any) => a.name === val);
                  if (agent) {
                    set("commissionAgentId", String(agent.id));
                    set("commissionAgentName", agent.name);
                  } else {
                    set("commissionAgentId", "");
                    set("commissionAgentName", val);
                  }
                }
              }}
              options={(data.commissionAgents || []).map((a: any) => ({
                value: a.name,
                label: a.name,
              }))}
              placeholder="Venta Directa (Sin Comisionista)"
              error={errors.commissionAgent}
            />
          </FormField>
        </div>

        {/* Client preview card */}
        {form.clientId && (() => {
          const client = data.clients.find(
            (c: any) => c.name === form.clientId,
          );
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
