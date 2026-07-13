import React, { useState, useEffect } from "react";
import {
  Receipt, ShoppingBag, Wallet, Trash2,
  Plane, Hotel, Shield, Package, CheckSquare, Globe,
  Smartphone, Car, Home, Compass, Star, Utensils,
  FileCheck, BookOpen, PawPrint
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input, Select, Combobox, FormField, CurrencyInput } from "../ui/Form";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Sale, Client, User, PaymentRecord } from "../../types";

interface SaleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSale: Sale | null;
  clients: Client[];
  user: User | null;
  isAdmin: boolean;
  onUpdateSale?: (id: number, data: any) => void;
  onAddSale?: (data: any) => void;
  onRegisterPayment: (saleId: number, amount: number, method?: string, reference?: string) => Promise<any>;
  onDeletePayment: (saleId: number, paymentId: string) => Promise<void>;
  onDownloadVoucher: (sale: Sale) => void;
}

// ── Mapa de iconos y colores por tipo de servicio ──────────────────────────
const SERVICE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; text: string; border: string }> = {
  tiqueteria:   { icon: <Plane size={13} />,       bg: 'bg-sky-50 dark:bg-sky-950/40',      text: 'text-sky-700 dark:text-sky-300',      border: 'border-sky-200 dark:border-sky-800/50' },
  hoteleria:    { icon: <Hotel size={13} />,        bg: 'bg-amber-50 dark:bg-amber-950/40',    text: 'text-amber-700 dark:text-amber-300',    border: 'border-amber-200 dark:border-amber-800/50' },
  seguros:      { icon: <Shield size={13} />,       bg: 'bg-green-50 dark:bg-green-950/40',    text: 'text-green-700 dark:text-green-300',    border: 'border-green-200 dark:border-green-800/50' },
  planes:       { icon: <Package size={13} />,      bg: 'bg-purple-50 dark:bg-purple-950/40',   text: 'text-purple-700 dark:text-purple-300',   border: 'border-purple-200 dark:border-purple-800/50' },
  checkin:      { icon: <CheckSquare size={13} />,  bg: 'bg-teal-50 dark:bg-teal-950/40',     text: 'text-teal-700 dark:text-teal-300',     border: 'border-teal-200 dark:border-teal-800/50' },
  migracion:    { icon: <Globe size={13} />,        bg: 'bg-blue-50 dark:bg-blue-950/40',     text: 'text-blue-700 dark:text-blue-300',     border: 'border-blue-200 dark:border-blue-800/50' },
  simcard:      { icon: <Smartphone size={13} />,   bg: 'bg-indigo-50 dark:bg-indigo-950/40',   text: 'text-indigo-700 dark:text-indigo-300',   border: 'border-indigo-200 dark:border-indigo-800/50' },
  autos:        { icon: <Car size={13} />,          bg: 'bg-orange-50 dark:bg-orange-950/40',   text: 'text-orange-700 dark:text-orange-300',   border: 'border-orange-200 dark:border-orange-800/50' },
  fincas:       { icon: <Home size={13} />,         bg: 'bg-lime-50 dark:bg-lime-950/40',     text: 'text-lime-700 dark:text-lime-300',     border: 'border-lime-200 dark:border-lime-800/50' },
  tours:        { icon: <Compass size={13} />,      bg: 'bg-cyan-50 dark:bg-cyan-950/40',     text: 'text-cyan-700 dark:text-cyan-300',     border: 'border-cyan-200 dark:border-cyan-800/50' },
  eventos:      { icon: <Star size={13} />,         bg: 'bg-yellow-50 dark:bg-yellow-950/40',   text: 'text-yellow-700 dark:text-yellow-300',   border: 'border-yellow-200 dark:border-yellow-800/50' },
  restaurantes: { icon: <Utensils size={13} />,     bg: 'bg-rose-50 dark:bg-rose-950/40',     text: 'text-rose-700 dark:text-rose-300',     border: 'border-rose-200 dark:border-rose-800/50' },
  visas:        { icon: <FileCheck size={13} />,    bg: 'bg-violet-50 dark:bg-violet-950/40',   text: 'text-violet-700 dark:text-violet-300',   border: 'border-violet-200 dark:border-violet-800/50' },
  pasaportes:   { icon: <BookOpen size={13} />,     bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',  text: 'text-fuchsia-700 dark:text-fuchsia-300',  border: 'border-fuchsia-200 dark:border-fuchsia-800/50' },
  mascotas:     { icon: <PawPrint size={13} />,     bg: 'bg-pink-50 dark:bg-pink-950/40',     text: 'text-pink-700 dark:text-pink-300',     border: 'border-pink-200 dark:border-pink-800/50' },
};

function ServicesList({ sale }: { sale: Sale }) {
  const services = sale.servicesSummary;

  if (services && services.length > 0) {
    return (
      <div className="flex flex-wrap gap-2 mt-1">
        {services.map((s, i) => {
          const cfg = SERVICE_CONFIG[s.tipo] ?? {
            icon: <ShoppingBag size={13} />, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200'
          };
          return (
            <div
              key={i}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              <span className="shrink-0">{cfg.icon}</span>
              <span>{s.label}</span>
              {s.detail && <span className="font-normal opacity-70">· {s.detail}</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback a observaciones texto
  if (sale.observations) {
    return (
      <div className="bg-white p-3 rounded-lg border border-gray-100 max-h-24 overflow-y-auto custom-scrollbar mt-1">
        <ul className="space-y-1">
          {sale.observations.split('\n').filter(l => l.trim()).map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <p className="text-gray-400 italic text-sm mt-1">Sin servicios registrados</p>
  );
}

export default function SaleEditModal({
  isOpen,
  onClose,
  editingSale,
  clients,
  user,
  isAdmin,
  onUpdateSale,
  onRegisterPayment,
  onDeletePayment,
  onDownloadVoucher,
}: SaleEditModalProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    method: "Efectivo",
    reference: "",
  });
  const [localStatus, setLocalStatus] = useState<string>("");
  const [localCreditDueDate, setLocalCreditDueDate] = useState<string>("");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const saleId = editingSale?.id ?? null;

  // Sync payments, status and credit limits from pre-loaded sale data
  useEffect(() => {
    if (editingSale) {
      setPayments((editingSale.payments as PaymentRecord[]) || []);
      setLocalStatus(editingSale.status);
      setLocalCreditDueDate(
        editingSale.creditDueDate
          ? new Date(editingSale.creditDueDate).toISOString().split("T")[0]
          : ""
      );
      setLocalErrors({});
    }
  }, [editingSale]);

  const totalSaleAmount = editingSale?.total || 0;
  const totalPaidAmount = payments.reduce((acc, p) => acc + p.amount, 0);
  const remainingBalance = totalSaleAmount - totalPaidAmount;

  // Automatically force 'Finalizada' (pagado) state when sale total is covered by payments
  useEffect(() => {
    if (totalSaleAmount === 0) return;

    if (totalPaidAmount >= totalSaleAmount) {
      if (localStatus !== "pagado") {
        setLocalStatus("pagado");
      }
    } else if (totalPaidAmount === 0) {
      if (localStatus !== "credito") {
        setLocalStatus("credito");
      }
    } else {
      if (localStatus !== "abonado") {
        setLocalStatus("abonado");
      }
    }
  }, [totalPaidAmount, totalSaleAmount, localStatus]);

  if (!isOpen || !editingSale) return null;

  const sale = editingSale;

  const handleAddPayment = () => {
    const amount = Number(newPayment.amount);
    if (amount <= 0 || amount > remainingBalance) return;

    // Optimistic: add to UI immediately with a temp id
    const tempId = `temp_${Date.now()}`;
    const optimisticPayment: PaymentRecord = {
      id: tempId,
      date: new Date().toISOString(),
      amount,
      method: newPayment.method,
      reference: newPayment.reference,
    };
    setPayments(prev => [...prev, optimisticPayment]);
    setNewPayment({ amount: "", method: "Efectivo", reference: "" });

    // Fire-and-forget: sync with server in background
    onRegisterPayment(sale.id, amount, newPayment.method, newPayment.reference).then(result => {
      // Replace temp entry with real server data
      setPayments(prev => prev.map(p => p.id === tempId ? result.payment : p));
    }).catch(() => {
      // Rollback on error
      setPayments(prev => prev.filter(p => p.id !== tempId));
    });
  };

  const handleDeletePayment = (paymentId: string) => {
    // Optimistic: remove immediately
    const removed = payments.find(p => p.id === paymentId);
    setPayments(prev => prev.filter(p => p.id !== paymentId));

    // Fire-and-forget: sync with server
    onDeletePayment(sale.id, paymentId).catch(() => {
      // Rollback on error
      if (removed) setPayments(prev => [...prev, removed].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ));
    });
  };

  const getStatusOptions = () => {
    if (totalSaleAmount > 0 && totalPaidAmount >= totalSaleAmount) {
      return [{ value: "pagado", label: "Completada" }];
    }
    if (totalPaidAmount > 0 && totalPaidAmount < totalSaleAmount) {
      return [
        { value: "credito", label: "Crédito" },
        { value: "abonado", label: "Abonada" },
      ];
    }
    return [{ value: "credito", label: "Crédito" }];
  };

  const handleUpdate = async () => {
    if (payments.length === 0) return; // Do not allow update with 0 payments
    setIsSaving(true);
    try {
      if (onUpdateSale) {
        await onUpdateSale(sale.id, {
          status: localStatus,
          isCredit: localStatus === "credito" || localStatus === "abonado"
        });
      }
      onClose();
    } catch (err) {
      console.error("Error al actualizar abonos:", err);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestión de Abonos y Pagos"
      size="lg"
      footer={
        <>
           <Button 
            variant="outline" 
            onClick={onClose} 
            className="px-8 border-gray-200 text-gray-500 hover:bg-gray-50 font-medium"
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleUpdate} 
            className="px-8 font-medium bg-[#0b396b] hover:bg-[#072445] disabled:bg-slate-400 disabled:hover:bg-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || payments.length === 0}
          >
            {isSaving ? "Actualizando..." : "Actualizar"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
          {/* Sección Resumen Solo Lectura */}
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
              <h4 className="font-bold text-primary flex items-center gap-2">
                <Receipt size={18} /> Resumen de Venta #{sale.id}
              </h4>
              <Badge variant={sale.status}>
                {sale.status === "pagado"
                  ? "Finalizado"
                  : sale.status === "abonado"
                    ? "Abonado"
                    : "Crédito"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 block text-xs font-medium mb-0.5">
                  Fecha de Emisión
                </span>
                <span className="font-semibold text-gray-800">
                  {formatDate(sale.date)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs font-medium mb-0.5">
                  Cliente
                </span>
                <span className="font-semibold text-gray-800">
                  {sale.clientName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-xs font-medium mb-0.5">
                  Asesor
                </span>
                <span className="font-semibold text-gray-800">
                  {sale.asesorName}
                </span>
              </div>
              {sale.commissionAgentName && (
                <div>
                  <span className="text-gray-500 block text-xs font-medium mb-0.5">
                    Comisionista
                  </span>
                  <span className="font-semibold text-gray-800">
                    {sale.commissionAgentName}
                  </span>
                </div>
              )}
              <div className="col-span-2 sm:col-span-3 pt-3 mt-1 border-t border-gray-100">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ShoppingBag size={14} className="text-accent" /> Servicios incluidos
                </span>
                <ServicesList sale={sale} />
              </div>
            </div>
          </div>

          {/* Fila de Finanzas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                Valor Final
              </p>
              <p className="text-lg font-black text-gray-800 dark:text-white">
                {formatCurrency(sale.total)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                Pago Proveedores
              </p>
              <p className="text-lg font-black text-rose-600 dark:text-rose-400">
                {formatCurrency(sale.supplierCost || 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                Ganancias Oficina
              </p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  sale.total -
                    (sale.supplierCost || 0) -
                    (sale.commissionAgentNetPayment || 0),
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                Pagado por Cliente
              </p>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                {formatCurrency(totalPaidAmount)}
              </p>
            </div>
          </div>


          <div className="mt-2 border-t border-gray-200 dark:border-slate-700 pt-6 space-y-6">
            <h3 className="text-lg font-black text-primary dark:text-white flex items-center gap-2">
              <Wallet className="text-accent dark:text-teal-400" size={20} />
              Gestión de Pagos y Abonos
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-slate-800/80 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                  Valor a Pagar
                </p>
                <p className="text-xl font-black text-gray-800 dark:text-white mt-1">
                  {formatCurrency(totalSaleAmount)}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 shadow-sm">
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  Total Pagado
                </p>
                <p className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
                  {formatCurrency(totalPaidAmount)}
                </p>
              </div>
              <div
                className={`p-4 rounded-xl border shadow-sm ${remainingBalance > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40" : "bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/40"}`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-widest ${remainingBalance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  {remainingBalance > 0 ? "Pendiente por Pagar" : "Estado de Cobro"}
                </p>
                <p className={`text-xl font-black mt-1 ${remainingBalance > 0 ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}>
                  {remainingBalance > 0 ? formatCurrency(remainingBalance) : "Totalmente Pagado"}
                </p>
              </div>
            </div>

            {/* B. Formulario de Agregar Nuevo Abono */}
            {remainingBalance > 0 && sale.status !== "pagado" && (
              <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <h4 className="text-sm font-bold text-gray-800 mb-4">
                  Registrar Nuevo Abono
                </h4>
                <div className="flex flex-col sm:flex-row items-end gap-3">
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-600 mb-1 block">
                      Monto
                    </label>
                    <CurrencyInput
                      value={newPayment.amount}
                      onChange={(val) =>
                        setNewPayment({
                          ...newPayment,
                          amount: val,
                        })
                      }
                      placeholder="Ej: 500.000"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-600 mb-1 block">
                      Método de pago
                    </label>
                    <Select
                      value={newPayment.method}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          method: e.target.value,
                        })
                      }
                      options={[
                        { value: "Efectivo", label: "Efectivo" },
                        { value: "Transferencia", label: "Transferencia" },
                        {
                          value: "Tarjeta de Crédito",
                          label: "Tarjeta de Crédito",
                        },
                      ]}
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-gray-600 mb-1 block">
                      Ref. / Comprobante <span className="font-normal text-[10px] text-gray-400">(Opcional)</span>
                    </label>
                    <Input
                      value={newPayment.reference}
                      onChange={(e) =>
                        setNewPayment({
                          ...newPayment,
                          reference: e.target.value,
                        })
                      }
                      placeholder="Nro. Transferencia"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddPayment}
                    className="mb-0.5 w-full sm:w-auto whitespace-nowrap"
                    disabled={
                      !newPayment.amount ||
                      Number(newPayment.amount) <= 0 ||
                      Number(newPayment.amount) > remainingBalance
                    }
                  >
                    Registrar Abono
                  </Button>
                </div>
                {Number(newPayment.amount) > remainingBalance && (
                  <p className="text-[10px] text-red-500 font-bold mt-2">
                    El abono supera el saldo restante de{" "}
                    {formatCurrency(remainingBalance)}.
                  </p>
                )}
              </div>
            )}

            {/* C. Historial de Pagos */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3">
                Historial de Pagos
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {payments.length > 0 ? (
                  payments.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-2 rounded-lg border border-gray-200 text-gray-400">
                          <Receipt size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm">
                            {formatCurrency(p.amount)}
                          </span>
                          <p className="text-[11px] font-bold text-gray-800">{p.method}</p>
                          {p.reference && (
                            <p className="text-[10px] text-gray-500">Ref: {p.reference}</p>
                          )}
                          <p className="text-[10px] text-gray-400">
                            {formatDate(p.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center mt-2 sm:mt-0">
                        {isAdmin && sale.status !== "pagado" && (
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            className="text-xs py-1.5 px-2 h-auto border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                            onClick={() => handleDeletePayment(p.id)}
                            title="Eliminar abono"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No hay pagos registrados para esta venta.
                  </p>
                )}
              </div>
            </div>
            {/* CONFIGURACIÓN DEL ESTADO editable (Al final de la modal) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
              <FormField label="Estado de la Venta *" error={localErrors.status}>
                <Combobox
                  value={localStatus}
                  onChange={(val) => {
                    setLocalStatus(val);
                  }}
                  placeholder="Selecciona un estado..."
                  options={getStatusOptions()}
                  error={localErrors.status}
                />
              </FormField>
            </div>

            {/* Barra de progreso de pago */}
            {(() => {
              const progress =
                totalSaleAmount > 0
                  ? Math.min(
                      100,
                      Math.round((totalPaidAmount / totalSaleAmount) * 100),
                    )
                  : 0;
              return (
                <div className="mt-5 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                    <span>Progreso de Pago</span>
                    <span
                      className={
                        progress === 100 ? "text-green-600" : "text-blue-600"
                      }
                    >
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
    </Modal>
  );
}
