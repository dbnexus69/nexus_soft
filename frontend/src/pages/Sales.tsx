import { useState, useMemo, useEffect } from "react";
import { SKELETON } from '../components/ui/Skeleton';
import { useSearchParams } from "react-router-dom";
import * as api from "../api";
import {
  Plus,
  ShoppingBag,
  Receipt,
  TrendingUp,
  Wallet,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Ban,
  Search,
  X,
} from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useData } from "../context/DataContext";
import { useSalesContext } from "../context/SalesContext";
import { useClientsContext } from "../context/ClientsContext";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionsContext";
import { formatSaleId, formatCurrency, formatDate, formatId, todayStr } from "../utils/formatters";
import { Sale } from "../types";
import { DatePicker } from "../components/sales/forms/TicketForm";
import NewSaleWizard from "../components/sales/NewSaleWizard";
import SaleDetailModal from "../components/sales/SaleDetailModal";
import SalePaymentsModal from "../components/sales/SalePaymentsModal";
import SalesTable from "../components/sales/SalesTable";
import { Pagination } from "../components/ui/Pagination";
import StatCard from "../components/ui/StatCard";
import CreditDashboard from "../components/sales/CreditDashboard";

export default function Sales() {
  const { data } = useData(); // para airports, config, etc.
  const {
    sales,
    meta,
    loading: salesLoading,
    error: salesError,
    fetchSales,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    handleUpdateSale: updateSale,
    handleVoidSale: voidSale,
    handleRegisterPayment: registerCreditPayment,
    handleDeletePayment: deleteSalePayment,
    handleToggleReviewStatus: updateReviewStatus
  } = useSalesContext();
  const { fetchClients } = useClientsContext();
  const { user, isAdmin, marca } = useAuth();
  const { canCreate, canEdit } = usePermissions();
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [paymentsSale, setPaymentsSale] = useState<Sale | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [salesDetails, setSalesDetails] = useState<Record<number, Sale>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  // La pestaña viaja en la URL: así se puede enlazar directamente a la cartera
  // —lo hace el desglose del panel— y el botón de atrás del navegador funciona.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: 'list' | 'credit' = searchParams.get('tab') === 'credit' ? 'credit' : 'list';
  const setActiveTab = (tab: 'list' | 'credit') => {
    const siguiente = new URLSearchParams(searchParams);
    if (tab === 'credit') siguiente.set('tab', 'credit');
    else siguiente.delete('tab');
    setSearchParams(siguiente, { replace: true });
  };
  const [voidConfirm, setVoidConfirm] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [voucherSale, setVoucherSale] = useState<Sale | null>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isSendingVoucher, setIsSendingVoucher] = useState(false);

  // Búsqueda, estado, fechas, orden y alcance por rol los resuelve el servidor.
  // La tabla pinta la página que recibe, sin volver a filtrarla.
  const filteredSales = sales;

  // La búsqueda se escribe aquí y viaja al servidor cuando se deja de teclear: antes cada tecla lanzaba
  // una petición. Sin espacios a los lados; el tope (100) es el mismo que valida el backend.
  const [busqueda, setBusqueda] = useState(searchTerm);
  useEffect(() => {
    const espera = setTimeout(() => {
      const limpia = busqueda.trim();
      if (limpia !== searchTerm) setSearchTerm(limpia);
    }, 350);
    return () => clearTimeout(espera);
  }, [busqueda]);

  // Fechas: "Desde" no pasa de "Hasta" ni de hoy, y "Hasta" no baja de "Desde" (el calendario ya no deja
  // elegirlas al revés). Una fecha escrita incompleta o fuera de rango se avisa debajo del campo.
  const hoy = todayStr();
  const [errorFechas, setErrorFechas] = useState<string | null>(null);
  const rangoAlReves = !!startDate && !!endDate && startDate > endDate;
  const mensajeFechas = errorFechas || (rangoAlReves ? 'La fecha "Hasta" no puede ser anterior a "Desde".' : null);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);



  // Eliminamos el prefetch silencioso para evitar peticiones "fantasma" que colapsan la red y el backend.
  // La carga detallada se hará estrictamente "On Demand" (bajo demanda) cuando el usuario pase el mouse o haga click.

  // Sin prefetch: la tabla no pide detalle. El modal carga la cabecera al abrirse
  // y cada categoría de producto cuando el usuario la despliega.

  const canManagePayments = (sale: Sale): boolean => {
    // El permiso se llama `sales.edit` porque así está guardado en
    // `permisos_rol`, y es el que el backend exige para cobrar; lo que se
    // gestiona aquí son abonos, y solo si queda algo por cobrar.
    if (!canEdit("sales")) return false;
    if (sale.status === "pagado" || sale.status === "anulado") return false;
    if (isAdmin) return true;
    return sale.asesorId === user?.id;
  };

  const handleOpenNewSale = () => {
    setIsWizardOpen(true);
  };

  const handleOpenPayments = (sale: Sale) => {
    if (!canManagePayments(sale)) return;
    setPaymentsSale(sale);
    setIsPaymentsOpen(true);
  };

  const handleViewDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailOpen(true);
  };

  const handleDownloadVoucher = (sale: Sale) => setVoucherSale(sale);

  // El voucher lo genera y lo guarda el servidor (spec 011): descargar es abrir una URL firmada y enviar no lleva cuerpo.
  const executeDownloadPDF = async () => {
    if (!voucherSale) return;
    setIsPdfGenerating(true);
    try {
      const { url } = await api.getVoucherUrl(voucherSale.id);
      // Navegar a la URL y no `window.open`: tras el `await` ya no cuenta como clic del usuario y el bloqueador
      // de ventanas emergentes lo frenaba en silencio. La URL responde como adjunto, así que la página no se va.
      window.location.assign(url);
      setVoucherSale(null);
    } catch (err: any) {
      setSuccessMessage(err?.response?.data?.error?.message || 'No se pudo generar el voucher');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const executeSendVoucher = async () => {
    if (!voucherSale) return;
    setIsSendingVoucher(true);
    try {
      const { enviadoA } = await api.sendVoucher(voucherSale.id);
      setSuccessMessage(`Voucher enviado a ${enviadoA}`);
      setVoucherSale(null);
    } catch (err: any) {
      setSuccessMessage(err?.response?.data?.error?.message || 'Error al enviar el voucher');
    } finally {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
      setIsSendingVoucher(false);
    }
  };

  const handleVoidSale = async () => {
    if (!voidConfirm || !voidReason.trim() || isVoiding) return;
    setIsVoiding(true);
    try {
      await voidSale(voidConfirm.id, voidReason);
      setSuccessMessage(`Venta #${formatSaleId(voidConfirm.numero ?? voidConfirm.id)} anulada correctamente`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setVoidConfirm(null);
      setVoidReason("");
    } catch {
      setSuccessMessage(`Error al anular la venta #${voidConfirm.id}`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsVoiding(false);
    }
  };

  // Sin retorno temprano: la tabla trae su esqueleto y el alto no salta.

  return (
    <div className="space-y-6 relative">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[200] flex justify-center">
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
        <div className="fixed top-20 right-6 z-[200] bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-green-500 text-white rounded-full p-1">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="mb-6 animate-fade-in flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2B2D42] dark:text-white font-heading tracking-tight flex items-center gap-3">
            <Wallet className="text-[#8D99AE] w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Gestión de Ventas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-medium">
            Control de ingresos, facturación y estados de pago de tus clientes en tiempo real.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner w-fit animate-fade-in">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-250 ${
              activeTab === 'list' 
                ? 'bg-[#2B2D42] dark:bg-[#8D99AE] text-white shadow-md' 
                : 'text-slate-500 dark:text-slate-400 hover:text-[#2B2D42] dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            <FileText size={18} /> Listado de Ventas
          </button>
          <button
            onClick={() => setActiveTab('credit')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-250 ${
              activeTab === 'credit' 
                ? 'bg-[#2B2D42] dark:bg-[#8D99AE] text-white shadow-md' 
                : 'text-slate-500 dark:text-slate-400 hover:text-[#2B2D42] dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'
            }`}
          >
            <CreditCard size={18} /> Crédito y Cobros
          </button>
        </div>
      </div>

      {activeTab === 'list' ? (
        <>
          <Card className="animate-fade-in !rounded-[28px] overflow-hidden border-slate-200/50 dark:border-slate-800/70 bg-slate-100/60 dark:bg-[#151722]">
            <CardHeader
              actions={
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center flex-wrap w-full lg:w-auto font-body">
                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="search"
                      aria-label="Buscar ventas por cliente, asesor, comisionista o número"
                      placeholder="Buscar por cliente, asesor, comisionista..." 
                      maxLength={100}
                      className="text-sm border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8D99AE]/25 w-full transition-all"
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                    />
                    {busqueda && (
                      <button onClick={() => { setBusqueda(''); setSearchTerm(''); }} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 p-0.5 rounded">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label="Filtrar por estado"
                    value={statusFilter || "all"}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-[#1c1d26] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#8D99AE]/25 w-full lg:w-auto cursor-pointer"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="pagado">Finalizado</option>
                    <option value="abonado">Abonado</option>
                    <option value="credito">En Crédito</option>
                    <option value="anulado">Anulado</option>
                  </select>
                  <div className="flex flex-col gap-1 w-full lg:w-auto">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto"
                    role="group"
                    aria-label="Rango de fechas"
                    aria-describedby={mensajeFechas ? "error-rango-fechas" : undefined}
                  >
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Desde:</span>
                      <div className="w-full sm:w-36">
                        <DatePicker
                          value={startDate}
                          onChange={(v) => { setErrorFechas(null); setStartDate(v); }}
                          max={endDate && endDate < hoy ? endDate : hoy}
                          triggerError={setErrorFechas}
                          fieldName="Fecha Inicial"
                          popoverDirection="down"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Hasta:</span>
                      <div className="w-full sm:w-36">
                        <DatePicker
                          value={endDate}
                          onChange={(v) => { setErrorFechas(null); setEndDate(v); }}
                          min={startDate || undefined}
                          max={hoy}
                          triggerError={setErrorFechas}
                          fieldName="Fecha Final"
                          popoverDirection="down"
                        />
                      </div>
                    </div>
                    {(startDate || endDate) && (
                      <button 
                        aria-label="Limpiar fechas"
                        onClick={() => { setErrorFechas(null); setStartDate(""); setEndDate(""); }}
                        className="text-red-500 dark:text-red-300 hover:text-red-600 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center justify-center h-[38px] w-[38px] shrink-0 border border-red-100 dark:border-red-900/40 transition-colors shadow-sm"
                        title="Limpiar fechas"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {mensajeFechas && (
                    <p id="error-rango-fechas" role="alert" className="text-xs font-medium text-red-600 dark:text-red-300">
                      {mensajeFechas}
                    </p>
                  )}
                  </div>
                  {canCreate("sales") && (
                    <Button onClick={handleOpenNewSale} className="w-full lg:w-auto justify-center bg-[#2B2D42] hover:bg-[#1e202f] dark:bg-[#8D99AE] dark:hover:bg-[#b2bccb] text-white rounded-xl shadow-md px-5 py-2.5 font-bold">
                      <Plus size={18} />
                      Nueva Venta
                    </Button>
                  )}
                </div>
              }
            >
              Lista de Ventas {isAdmin ? "(Todas)" : "(Mis Ventas)"}
            </CardHeader>
            {salesError && (
              <p role="alert" className="mx-4 mb-3 rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
                {salesError}
              </p>
            )}

            {salesLoading && filteredSales.length === 0 ? (
              <div className={`${SKELETON} p-4 space-y-3`}>
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-200 rounded w-1/3" style={{ animationDelay: `${i * 60}ms` }} />
                      <div className="h-2.5 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-16" />
                    <div className="h-3 bg-gray-200 rounded w-20" />
                    <div className="h-3 bg-gray-200 rounded w-14" />
                    <div className="h-6 bg-gray-100 rounded-full w-20" />
                    <div className="flex gap-1.5">
                      <div className="h-8 w-8 rounded-lg bg-gray-100" />
                      <div className="h-8 w-8 rounded-lg bg-gray-100" />
                      <div className="h-8 w-8 rounded-lg bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-white rounded-b-2xl border-t border-gray-100">
                <Ban size={48} className="text-gray-200 mb-4 animate-bounce" />
                <p className="text-lg font-bold text-gray-700">Venta no encontrada</p>
                <p className="text-sm text-gray-500 mt-1">Prueba ajustando los términos de búsqueda o los filtros de fecha.</p>
              </div>
            ) : (
              <SalesTable
                loading={salesLoading && sales.length === 0}
                sales={filteredSales}
                onViewDetail={handleViewDetail}
                onDownloadVoucher={handleDownloadVoucher}
                onManagePayments={handleOpenPayments}
                onDelete={(sale) => setVoidConfirm(sale)}
                canManagePayments={canManagePayments}
                isAdmin={isAdmin}
                onReviewStatusChange={(saleId, isReviewed) => {
                  updateReviewStatus(saleId, isReviewed)
                    .then(() => {
                      setSuccessMessage("Estado de revisión actualizado");
                      setShowSuccess(true);
                      setTimeout(() => setShowSuccess(false), 3000);
                    })
                    .catch((err: any) => {
                      const msg = err.response?.data?.error?.message || "Error al actualizar estado";
                      setSuccessMessage(msg);
                      setShowSuccess(true);
                      setTimeout(() => setShowSuccess(false), 4000);
                    });
                }}
              />
            )}

            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              perPage={meta.perPage}
              loading={salesLoading}
              onPageChange={setPage}
              className="px-4 py-3 bg-white border-t border-gray-100 rounded-b-2xl mt-0"
            />
          </Card>
        </>
      ) : (
        <CreditDashboard />
      )}

      {/* ===== WIZARD MODAL (Nueva Venta) ===== */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Nueva Venta"
        size="panel"
      >
        <NewSaleWizard
          onClose={() => setIsWizardOpen(false)}
          onSuccess={(msg) => {
            setSuccessMessage(msg);
            setShowSuccess(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            setTimeout(() => setShowSuccess(false), 3000);
          }}
        />
      </Modal>

      {/* ===== ABONOS ===== */}
      <SalePaymentsModal
        isOpen={isPaymentsOpen}
        onClose={() => setIsPaymentsOpen(false)}
        sale={paymentsSale}
        isAdmin={isAdmin}
        onUpdateSale={updateSale}
        onRegisterPayment={(saleId, amount, method, reference) => registerCreditPayment(Number(saleId), { amount, method, reference })}
        onDeletePayment={(saleId, paymentId) => deleteSalePayment(saleId, paymentId)}
        onDownloadVoucher={handleDownloadVoucher}
      />

      {/* ===== DETAIL MODAL (Ver Detalle) ===== */}
      {/* El detalle de cada servicio se despliega dentro de este modal: ya no
          hay un segundo modal por categoría. */}
      <SaleDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        selectedSale={salesDetails[selectedSale?.id || 0] || selectedSale}
      />

      {/* ===== CONFIRMAR ANULACIÓN ===== */}
      <Modal
        isOpen={!!voidConfirm}
        onClose={() => setVoidConfirm(null)}
        title="Anular Venta"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              className="border-none"
              onClick={() => setVoidConfirm(null)}
              disabled={isVoiding}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              onClick={handleVoidSale}
              disabled={!voidReason.trim() || isVoiding}
            >
              {isVoiding && <Loader2 size={16} className="animate-spin" />}
              {isVoiding ? "Anulando..." : "Anular Venta"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            ¿Estás seguro de que deseas anular la venta <strong>#{voidConfirm?.id}</strong>?
            El registro se conservará pero su estado pasará a "Anulado".
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de anulación <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full text-sm border border-gray-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px]"
              placeholder="Escribe la razón detallada para anular esta venta..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ===== VOUCHER MODAL (Opciones de Voucher) ===== */}
      <Modal
        isOpen={!!voucherSale}
        onClose={() => { if (!isPdfGenerating && !isSendingVoucher) { setVoucherSale(null); } }}
        title="Opciones de Voucher"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm text-center">
            ¿Qué deseas hacer con el voucher de la venta <strong>#{voucherSale?.id}</strong>?
          </p>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white flex justify-center items-center gap-2"
              onClick={executeSendVoucher}
              disabled={isSendingVoucher || isPdfGenerating}
            >
              {isSendingVoucher ? (
                <><Loader2 size={16} className="animate-spin" /> Enviando...</>
              ) : (
                <>Enviar al Cliente</>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full flex justify-center items-center gap-2"
              onClick={executeDownloadPDF}
              disabled={isPdfGenerating || isSendingVoucher}
            >
              {isPdfGenerating ? (
                <><Loader2 size={16} className="animate-spin" /> Generando PDF...</>
              ) : (
                <>&#8595; Descargar Voucher</>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full text-gray-500 mt-2 border-none"
              onClick={() => { setVoucherSale(null); }}
              disabled={isSendingVoucher || isPdfGenerating}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* COMPONENTE OCULTO PARA GENERAR PDF - usa la venta completa cargada del API */}
    </div>
  );
}
