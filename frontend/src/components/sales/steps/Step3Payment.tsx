import { useState, useEffect } from "react";
import { CreditCard, Coins, Plus, Trash2, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { FormField, Input, Select, Textarea, Combobox, CurrencyInput } from "../../ui/Form";
import { Button } from "../../ui/Button";
import { DatePicker } from "../forms/TicketForm";
import { todayStr } from "../../../utils/formatters";

export function Step3Payment({ form, set, data, errors }: any) {
  // Local state for the new payment item being added
  const [payMethodId, setPayMethodId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [isTouched, setIsTouched] = useState(false);

  const totalSale = Number(form.total) || 0;
  const paymentsList = form.payments || [];
  const totalPaid = paymentsList.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remaining = totalSale - totalPaid;

  // Autofill amount with remaining balance when payment method is selected (triggered once per selection)
  useEffect(() => {
    if (payMethodId && remaining > 0) {
      setPayAmount(remaining.toString());
      setIsTouched(true); // User selected a method, start live validation
    }
  }, [payMethodId]);

  // Live real-time validation
  useEffect(() => {
    if (!isTouched) return;

    const newErrors: Record<string, string> = {};
    if (!payMethodId) {
      newErrors.method = "Seleccione una forma de pago.";
    }

    const amt = Number(payAmount) || 0;
    if (!payAmount) {
      newErrors.amount = "El monto es obligatorio.";
    } else if (amt <= 0) {
      newErrors.amount = "El monto debe ser mayor a cero.";
    } else if (amt > remaining + 0.01) {
      newErrors.amount = `El monto no puede superar el saldo restante ($${remaining.toLocaleString("es-CO")}).`;
    }

    setLocalErrors(newErrors);
  }, [payAmount, payMethodId, remaining, isTouched]);


  const handleAddPayment = () => {
    setIsTouched(true);

    const newErrors: Record<string, string> = {};
    if (!payMethodId) {
      newErrors.method = "Seleccione una forma de pago.";
    }

    const amt = Number(payAmount) || 0;
    if (!payAmount) {
      newErrors.amount = "El monto es obligatorio.";
    } else if (amt <= 0) {
      newErrors.amount = "El monto debe ser mayor a cero.";
    } else if (amt > remaining + 0.01) {
      newErrors.amount = `El monto no puede superar el saldo restante ($${remaining.toLocaleString("es-CO")}).`;
    }

    if (Object.keys(newErrors).length > 0) {
      setLocalErrors(newErrors);
      return;
    }

    const selectedMethod = data.config.paymentMethods.find(
      (p: any) => String(p.id) === String(payMethodId)
    );

    const newPayment = {
      amount: amt,
      methodId: payMethodId,
      methodName: selectedMethod ? selectedMethod.name : "Otro",
      reference: payReference,
    };

    set("payments", [...paymentsList, newPayment]);

    // Reset local inputs
    setPayMethodId("");
    setPayAmount("");
    setPayReference("");
    setIsTouched(false);
    setLocalErrors({});
  };

  const handleRemovePayment = (index: number) => {
    const updated = [...paymentsList];
    updated.splice(index, 1);
    set("payments", updated);
  };

  // Automated state handler based on payment progress
  useEffect(() => {
    if (totalSale === 0) return;

    if (totalPaid === 0) {
      if (form.status !== "credito") {
        set("status", "credito");
        set("isCredit", true);
      }
    } else if (totalPaid >= totalSale) {
      if (form.status !== "pagado") {
        set("status", "pagado");
        set("isCredit", false);
      }
    } else {
      // Partial payment: if currently on completed (pagado) state, force it back to abonado (Abonada)
      if (form.status !== "abonado" && form.status !== "credito") {
        set("status", "abonado");
        set("isCredit", true);
      }
    }
  }, [totalPaid, totalSale, form.status, set]);

  const getStatusOptions = () => {
    if (totalSale > 0 && totalPaid >= totalSale) {
      return [{ value: "pagado", label: "Completada" }];
    }
    if (totalPaid > 0 && totalPaid < totalSale) {
      return [
        { value: "credito", label: "Crédito" },
        { value: "abonado", label: "Abonada" },
      ];
    }
    return [{ value: "credito", label: "Crédito" }];
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <CreditCard size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-primary text-base">
            Observaciones y Pagos
          </h3>
          <p className="text-xs text-gray-500">
            Comentarios de la venta y distribución de formas de pago.
          </p>
        </div>
      </div>


      {/* PANEL DE PAGOS MÚLTIPLES */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
            Distribución de Pagos del Cliente
          </h4>
          <span className="text-[10px] text-slate-400 font-bold bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            {paymentsList.length} Pago(s) Registrado(s)
          </span>
        </div>

        {/* Tabla de Pagos Agregados */}
        {paymentsList.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="px-4 py-3 text-left">Método de Pago</th>
                  <th className="px-4 py-3 text-left">Referencia</th>
                  <th className="px-4 py-3 text-left">Monto</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentsList.map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {p.methodName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.reference || "-"}
                    </td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">
                      ${p.amount.toLocaleString("es-CO")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemovePayment(idx)}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar pago"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="text-amber-500 mb-2" size={24} />
            <p className="text-xs font-medium text-slate-600">No hay pagos registrados aún</p>
            <p className="text-[11px] text-slate-400 mt-0.5">La venta se registrará bajo el estado inicial de "Crédito"</p>
          </div>
        )}

        {/* Sección para agregar pagos (se muestra solo si hay saldo restante) */}
        {remaining > 0.01 ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Plus size={16} className="text-primary" /> Registrar Nuevo Abono
            </h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <FormField label="Forma de Pago" error={localErrors.method}>
                <Combobox
                  value={payMethodId}
                  onChange={(val) => {
                    setPayMethodId(val);
                    setIsTouched(true);
                  }}
                  options={data.config.paymentMethods.map((p: any) => ({
                    value: String(p.id),
                    label: p.name,
                  }))}
                  placeholder="Selecciona método..."
                  error={localErrors.method}
                />
              </FormField>

              <FormField label="Monto" error={localErrors.amount}>
                <CurrencyInput
                  value={payAmount}
                  onChange={(val) => {
                    setPayAmount(val);
                    setIsTouched(true);
                  }}
                  placeholder="Ej. 500.000"
                  error={localErrors.amount}
                />
              </FormField>

              <FormField label={<span>Ref. / Comprobante <span className="font-normal text-[10px] text-slate-400">(Opcional)</span></span>}>
                <Input
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="Nro. Transferencia"
                />
              </FormField>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="button" size="sm" onClick={handleAddPayment}>
                <Plus size={14} className="mr-1" /> Agregar
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
            <CheckCircle className="text-emerald-500 shrink-0" size={20} />
            <div>
              <p className="text-xs font-bold">¡Pago Completado!</p>
              <p className="text-[11px] opacity-90">El valor total de la venta ha sido completamente cubierto por los pagos registrados.</p>
            </div>
          </div>
        )}

        {/* Resumen de Estado de Cobro */}
        <div className="grid grid-cols-3 gap-3 pt-2 text-center">
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Venta</p>
            <p className="text-sm font-black text-slate-800 dark:text-white">${totalSale.toLocaleString("es-CO")}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Abonado</p>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${totalPaid.toLocaleString("es-CO")}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Restante</p>
            <p className={`text-sm font-black ${remaining > 0.01 ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              ${remaining.toLocaleString("es-CO")}
            </p>
          </div>
        </div>
      </div>

      {/* CONFIGURACIÓN DEL ESTADO Y CRÉDITO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Estado de la Venta *" error={errors.status}>
          <Combobox
            value={form.status}
            onChange={(val) => {
              set("status", val);
              set("isCredit", val === "credito" || val === "abonado");
            }}
            placeholder="Selecciona un estado..."
            options={getStatusOptions()}
            error={errors.status}
          />
        </FormField>

        {(form.status === "credito" || form.status === "abonado") && (
          <FormField label="Fecha Límite del Crédito *" error={errors.creditDueDate}>
            <DatePicker
              value={form.creditDueDate}
              onChange={(val) => set("creditDueDate", val)}
              min={todayStr()}
              fieldName="Fecha límite del crédito"
              popoverDirection="up"
            />
          </FormField>
        )}

        {/* Responsable (Sólo si es crédito o abonado) */}
        {(form.status === "credito" || form.status === "abonado") && (
          <FormField label="Responsable del Crédito (Opcional)">
            <Combobox
              value={form.responsableId || ""}
              onChange={(val) => set("responsableId", val)}
              options={data.responsables
                .filter((r: any) => r.status === 'active')
                .map((r: any) => ({
                  value: String(r.id),
                  label: r.name,
                }))}
              placeholder="Seleccione el responsable de la deuda..."
            />
          </FormField>
        )}
      </div>

      {/* Sección Comisionista */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/70 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/50 p-4 rounded-xl shadow-sm transition-all">
        {form.commissionAgentId ? (
          <div className="col-span-2 flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Coins size={16} />
            </div>
            <p className="text-sm font-bold text-primary dark:text-blue-300">Comisionista: {form.commissionAgentName}</p>
          </div>
        ) : (
          <div className="col-span-2 flex items-center gap-2.5 py-1">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-400/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Coins size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200">Venta Directa</p>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 font-medium">Sin comisionista externo asignado a esta operación</p>
            </div>
          </div>
        )}

        {form.commissionAgentId && (
          <>
            <FormField label="% Comisión Bruta (sobre T.A.)">
              <Input
                type="number"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={form.commissionAgentPercentage}
                onChange={(e) => {
                  let val = e.target.value;
                  let percentage = parseFloat(val) || 0;
                  if (percentage < 0) percentage = 0;
                  if (percentage > 100) { percentage = 100; val = "100"; }
                  
                  const ta = parseFloat(form.ta) || 0;
                  const gross = ta * (percentage / 100);
                  
                  const retention = parseFloat(form.commissionAgentRetentionPercentage) || 0;
                  const net = gross * (1 - retention / 100);
                  
                  set("commissionAgentPercentage", val);
                  set("commissionAgentAmount", gross.toString());
                  set("commissionAgentNetPayment", net.toString());
                }}
                min="0"
                max="100"
                step="0.01"
                placeholder="Ej. 10"
              />
            </FormField>
            <FormField label="% Retención para Oficina">
              <Input
                type="number"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={form.commissionAgentRetentionPercentage}
                onChange={(e) => {
                  let val = e.target.value;
                  let retention = parseFloat(val) || 0;
                  if (retention > 100) {
                    retention = 100;
                    val = "100";
                  }
                  const gross = parseFloat(form.commissionAgentAmount) || 0;
                  const net = gross * (1 - retention / 100);
                  set("commissionAgentRetentionPercentage", val);
                  set("commissionAgentNetPayment", net.toString());
                }}
                min="0"
                max="100"
                placeholder="Ej. 10.5"
              />
            </FormField>
            <FormField label="Neto a Pagar al Comisionista">
              <CurrencyInput
                value={form.commissionAgentNetPayment}
                readOnly
                className="bg-gray-100 font-bold text-emerald-600"
                placeholder="0"
              />
            </FormField>
          </>
        )}
      </div>

      {/* Summary card */}
      {Number(form.total) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mt-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Resumen Financiero
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">
                Total
              </p>
              <p className="font-black text-gray-800">
                ${Number(form.total).toLocaleString("es-CO")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">
                Proveedores
              </p>
              <p className="font-black text-rose-600">
                ${(Number(form.supplierCost) || 0).toLocaleString("es-CO")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">
                Comisionista
              </p>
              <p className="font-black text-amber-600">
                ${(Number(form.commissionAgentNetPayment) || 0).toLocaleString("es-CO")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">
                Ganancia Oficina
              </p>
              <p className="font-black text-emerald-600">
                $
                {(
                  Number(form.total) -
                  (Number(form.supplierCost) || 0) -
                  (Number(form.commissionAgentNetPayment) || 0)
                ).toLocaleString("es-CO")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Observaciones */}
      <div className="pt-2">
        <FormField label="Observaciones / Comentarios">
          <Textarea
            value={form.observations}
            onChange={(e) => set("observations", e.target.value)}
            placeholder="Detalles adicionales sobre los productos seleccionados..."
            rows={3}
          />
        </FormField>
      </div>
    </div>
  );
}
