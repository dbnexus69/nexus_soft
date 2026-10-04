import { useState, useMemo, useEffect } from "react";
import type { CommissionAgent } from "../types";
import { createPortal } from "react-dom";
import {
  Coins,
  Search,
  Plus,
  Wallet,
  History,
  FileText,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  User,
  BadgeDollarSign,
  Calendar,
  CreditCard,
  Trash2,
  Pencil,
  Users,
  Loader2,
  X,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { FormField, Input, Select } from "../components/ui/Form";
import AvatarPicker, { AVATARS } from "../components/ui/AvatarPicker";
import { DatePicker } from "../components/sales/forms/TicketForm";
import { useData } from "../context/DataContext";
import { limpiarDocumento, mensajeDocumento, normalizarDocumento } from "../utils/datosPersona";
import { useCommissionsContext } from "../context/CommissionsContext";
import { usePermissions } from "../context/PermissionsContext";
import { formatCurrency, capitalizeName, todayStr } from "../utils/formatters";
import StatCard from "../components/ui/StatCard";
import { SkeletonRows } from "../components/ui/Table";
import { Pagination } from "../components/ui/Pagination";
import { AgentDetailsModal } from "../components/commissions/AgentDetailsModal";

export default function CommissionAgents() {
  const { data } = useData();
  const { 
    agents: commissionAgents, 
    settlements,
    handleCreateAgent: addCommissionAgent,
    handleUpdateAgent: updateCommissionAgent,
    handleDeleteAgent: deleteCommissionAgent,
    handleCreateSettlement: settleCommissions,
    fetchCommissionAgents,
    fetchSettlements,
    agentsMeta,
    settlementsMeta,
    loadingSettlements
  } = useCommissionsContext();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CommissionAgent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<CommissionAgent | null>(null);
  const [activeTab, setActiveTab] = useState<"agents" | "settlements" | "history">("agents");
  const [formData, setFormData] = useState<any>({});

  // Los tipos de documento vienen de la base (id, nombre, abreviatura); la regla del número usa la abreviatura.
  const tiposDocumento = data.config.documentTypes || [];
  // El mínimo que cada comisionista tiene que acumular para retirar; el servidor ya lo manda resuelto
  // (el suyo, o el de por defecto si no tiene). 50.000 solo si llegara uno de antes, sin el campo.
  const minimoDe = (agent?: CommissionAgent | null): number => Number(agent?.paymentThreshold) > 0 ? Number(agent?.paymentThreshold) : 50000;
  const puedeRetirar = (agent: CommissionAgent) => Number(agent?.accumulated || 0) >= minimoDe(agent);
  const abreviaturaDe = (dt?: { abbreviation?: string; name?: string }): string => dt?.abbreviation || dt?.name || "";
  const abreviatura = abreviaturaDe(tiposDocumento.find((dt) => String(dt.id) === String(formData.docTypeId)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [settleData, setSettleData] = useState<any>({
    date: todayStr(),
    paymentMethod: "",
    reference: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Los rechazos de la liquidación se enseñan dentro del modal, junto al botón
  // que los provocó: un aviso flotante de 3 s se pierde detrás del modal abierto.
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleFieldErrors, setSettleFieldErrors] = useState<{ paymentMethod?: string }>({});

  // Lazy Load Fetch
  useEffect(() => {
    Promise.all([
      fetchCommissionAgents(),
      fetchSettlements()
    ]).finally(() => setIsLoading(false));
  }, [fetchCommissionAgents, fetchSettlements]);

  const notifyError = (msg: string) => {
    setErrorMessage(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 4000);
  };

  // El mensaje de la API ya está escrito para quien usa la pantalla; el texto
  // propio solo cubre lo que no llega a la API (sin red, 500).
  const mensajeDeApi = (err: any, respaldo: string): string =>
    err?.response?.data?.error?.message || respaldo;

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Calcular acumulados (solo ventas no liquidadas)
  // El acumulado lo suma el backend sobre TODAS las ventas no liquidadas.
  // Antes se recalculaba aquí recorriendo data.sales, que solo trae una página:
  // con más ventas de las que cabían en ella, los totales salían cortos.
  const filteredAgents = useMemo(() => {
    const agents = commissionAgents || [];
    const q = (searchTerm || "").toLowerCase();
    return agents
      .filter((a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.docNumber || "").includes(searchTerm))
      .sort((a, b) => b.id - a.id);
  }, [commissionAgents, searchTerm]);

  const stats = useMemo(() => {
    const totalAccumulated = filteredAgents.reduce((s: number, a) => s + (a.accumulated || 0), 0);
    const pendingLiquidation = filteredAgents.filter(puedeRetirar).length;
    return {
      total: commissionAgents?.length || 0,
      totalAccumulated,
      pendingLiquidation,
    };
  }, [filteredAgents, commissionAgents]);

  const handleOpenModal = (agent?: CommissionAgent) => {
    setErrors({});
    if (agent) {
      setEditingAgent(agent);
      setFormData({
        ...agent,
        docTypeId: String(agent.docTypeId ?? tiposDocumento.find((dt) => abreviaturaDe(dt) === agent.docType)?.id ?? ""),
      });
    } else {
      setEditingAgent(null);
      setFormData({ status: "Activo", type: "Comisionista", avatar: AVATARS[0], docTypeId: String(tiposDocumento[0]?.id ?? ""), paymentThreshold: 50000 });
    }
    setIsModalOpen(true);
  };

  // Las reglas del número son las de las personas (utils/datosPersona), según la abreviatura del tipo elegido.
  const validateDocNumber = (value: string, abreviatura: string): string => {
    const numero = normalizarDocumento(value);
    if (!numero) return "El número de documento es obligatorio";
    const regla = mensajeDocumento(abreviatura, numero);
    if (regla) return regla;
    // Duplicate check against existing agents
    const isDuplicate = (commissionAgents || []).some(
      (a: any) => a.docNumber === numero && (!editingAgent || a.id !== editingAgent.id)
    );
    if (isDuplicate) return "Este número de documento ya está registrado";
    return "";
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!formData.name) errs.name = "El nombre es obligatorio";
    if (!formData.docTypeId) errs.docTypeId = "Seleccione un tipo de documento";
    const docErr = validateDocNumber(formData.docNumber || "", abreviatura);
    if (docErr) errs.docNumber = docErr;
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSaving(true);
    try {
      const { docTypeId, ...resto } = formData;
      const sanitizedData = {
        ...resto,
        name: capitalizeName(formData.name),
        docTypeId: Number(docTypeId),
        docNumber: normalizarDocumento(formData.docNumber || ""),
      };

      if (editingAgent) {
        await updateCommissionAgent(editingAgent.id, sanitizedData);
        notifySuccess("Comisionista actualizado correctamente");
      } else {
        await addCommissionAgent(sanitizedData);
        notifySuccess("Comisionista registrado correctamente");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      // Un error con campo (`error.details`) se pinta junto a su input; el resto, en el aviso.
      const detalles: Array<{ field: string; message: string }> = err?.response?.data?.error?.details || [];
      const porCampo: Record<string, string> = {};
      for (const d of detalles) if (["name", "docTypeId", "docNumber", "phone", "email", "paymentThreshold"].includes(d.field)) porCampo[d.field] = d.message;
      if (Object.keys(porCampo).length > 0) setErrors(porCampo);
      else notifyError(mensajeDeApi(err, "No se pudo guardar el comisionista. Revisa la conexión e inténtalo de nuevo."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteCommissionAgent(deleteConfirm.id);
      notifySuccess("Comisionista eliminado correctamente");
      setDeleteConfirm(null);
    } catch (err: any) {
      notifyError(mensajeDeApi(err, "No se pudo eliminar el comisionista. Revisa la conexión e inténtalo de nuevo."));
    } finally {
      setIsDeleting(false);
    }
  };

  const openSettleModal = (agent: CommissionAgent) => {
    setSelectedAgent(agent);
    setSettleError(null);
    setSettleFieldErrors({});
    const defaultPM = (data.config.paymentMethods || []).find((pm) => pm.name === "Transferencia");
    setSettleData({
      date: todayStr(),
      paymentMethod: defaultPM?.id?.toString() || "",
      amount: agent.accumulated,
      reference: "",
      notes: "",
    });
    setIsSettleModalOpen(true);
  };

  const handleSettle = async () => {
    if (!selectedAgent) return;
    setIsSaving(true);
    setSettleError(null);
    setSettleFieldErrors({});
    try {
      await settleCommissions({ agentId: selectedAgent.id, ...settleData, agentName: selectedAgent.name });
      await fetchSettlements();
      notifySuccess(`Liquidación de ${formatCurrency(selectedAgent.accumulated)} procesada`);
      setIsSettleModalOpen(false);
      setActiveTab("history");
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const actual = apiError?.details?.find((d: any) => d.field === "amount")?.value;
      setSettleError(mensajeDeApi(err, "No se pudo registrar la liquidación. Revisa la conexión e inténtalo de nuevo."));
      setSettleFieldErrors(
        apiError?.code === "PAYMENT_METHOD_NOT_FOUND" ? { paymentMethod: "Este canal ya no existe. Elige otro." } : {}
      );
      // El acumulado cambió (409) o ya no queda nada (400): el modal pasa a
      // enseñar la cifra que tiene la base y la lista se refresca por detrás,
      // para que confirmar otra vez pague lo que se ve.
      if (typeof actual === "number") {
        setSelectedAgent((a: any) => (a ? { ...a, accumulated: actual } : a));
        setSettleData((d: any) => ({ ...d, amount: actual }));
        fetchCommissionAgents({ page: agentsMeta.page, perPage: agentsMeta.perPage });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const TABS = [
    { id: "agents", label: "Directorio", icon: Coins },
    { id: "settlements", label: "Pendientes", icon: Wallet },
    { id: "history", label: "Historial", icon: History },
  ] as const;

  // Sin retorno temprano: la tabla trae su esqueleto y el alto no salta.
  return (
    <div className="space-y-6 relative pb-10">
      {/* Toast Notification */}
      {showSuccess && createPortal(
        <div className="fixed top-20 right-6 z-[9999] bg-emerald-50 border border-emerald-200 text-emerald-700 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-emerald-500 text-white rounded-full p-1">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>,
        document.body
      )}
      {showError && createPortal(
        <div className="fixed top-32 right-6 z-[9999] bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-rose-500 text-white rounded-full p-1">
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>,
        document.body
      )}

      <div className="mb-6 animate-fade-in">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold text-primary flex items-center justify-center gap-3">
              <Coins className="text-accent w-8 h-8" /> Gestión de Comisionistas
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Sistema avanzado de gestión de comisionistas, control de liquidaciones y seguimiento financiero.
            </p>
          </div>
        </div>
      </div>


      <Card className="animate-fade-in">
        <CardHeader actions={
          <div className="flex gap-3 items-center flex-wrap">
            {activeTab === 'agents' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input 
                  placeholder="Buscar por nombre o doc..." 
                  className="pl-10 pr-9 w-72"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600 p-0.5 rounded">
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            {canCreate('commissions') && (
              <Button 
                onClick={() => handleOpenModal()}
                className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 rounded-xl px-6 h-11 transition-all hover:scale-105 active:scale-95 ml-auto"
              >
                <Plus size={20} className="mr-1" /> Nuevo Comisionista
              </Button>
            )}
          </div>
        }>
          Directorio
        </CardHeader>
        
        <div className="p-4 sm:p-6">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-100 dark:border-slate-700 pb-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="min-h-[400px]">
            {/* === PESTAÑA DIRECTORIO === */}
            {activeTab === "agents" && (
              <div className="space-y-6 animate-fade-in-up">

              {filteredAgents.length === 0 ? (
                <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-700 py-20 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-gray-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-6 text-gray-200 dark:text-slate-600">
                    <Coins size={48} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">No se encontraron resultados</h3>
                  <p className="text-gray-500 mt-2 max-w-xs">
                    Intenta ajustar tu búsqueda o registra un nuevo comisionista estratégico.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredAgents.map((agent) => {
                    const progress = Math.min((Number(agent.accumulated || 0) / minimoDe(agent)) * 100, 100);
                    const isReady = puedeRetirar(agent);

                    return (
                      <div
                        key={agent.id}
                        className="group bg-[#ffffff] dark:bg-slate-800 border border-gray-100 dark:border-slate-700/50 rounded-2xl p-4 md:p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col md:flex-row items-center gap-6"
                      >
                        {/* 1. Avatar & Info */}
                        <div className="flex items-center gap-4 min-w-[280px] w-full md:w-auto">
                          <div className={`w-14 h-14 rounded-full flex flex-shrink-0 items-center justify-center font-black text-xl shadow-inner overflow-hidden transition-transform group-hover:scale-110 duration-500 ${
                            isReady ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-50 text-gray-500 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {agent.avatar ? (
                              <img src={agent.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              (agent.name || "C").charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-primary transition-colors">{agent.name || "Comisionista"}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{agent.type || "Comisionista"}</span>
                              <span className="text-xs font-medium text-gray-500">{agent.docType} {agent.docNumber}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Progress Bar (Center) */}
                        <div className="flex-1 w-full flex flex-col justify-center min-w-[200px]">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest">Mínimo para retirar</span>
                            <span className="text-xs font-black text-gray-500 dark:text-slate-500 uppercase">{formatCurrency(minimoDe(agent))}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                            <div 
                              className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out rounded-full ${isReady ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-primary'}`} 
                              style={{ width: `${progress}%` }} 
                            />
                          </div>
                        </div>

                        {/* 3. Stats & Actions (Right) */}
                        <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-4 md:mt-0">
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-0.5">Acumulado</p>
                            <p className={`text-xl font-black ${isReady ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                              {formatCurrency(agent.accumulated)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 border-l border-gray-100 dark:border-slate-700 pl-6">
                            {isReady ? (
                              <button 
                                onClick={() => openSettleModal(agent)}
                                className="flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-amber-200 dark:hover:shadow-amber-900/20 mr-2"
                              >
                                Liquidar
                              </button>
                            ) : (
                               <span className={`w-2.5 h-2.5 rounded-full mr-3 ${agent.status === "Activo" ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-300'}`} title={agent.status} />
                            )}
                            
                            <div className="flex flex-row gap-1">
                              <button onClick={() => { setSelectedAgent(agent); setIsDetailsModalOpen(true); }} className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors" title="Ver Detalles">
                                <FileText size={16} />
                              </button>
                              {canEdit('commissions') && (
                                <button onClick={() => handleOpenModal(agent)} className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Editar">
                                  <Pencil size={16} />
                                </button>
                              )}
                              {canDelete('commissions') && (
                                <button onClick={() => setDeleteConfirm(agent)} className="p-2 text-gray-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors" title="Eliminar">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* === PESTAÑA LIQUIDACIONES === */}
          {activeTab === "settlements" && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="bg-[#ffffff] dark:bg-slate-800 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Pagos Pendientes</h2>
                    <p className="text-sm text-gray-500 font-medium">Comisionistas que han superado el umbral de liquidación.</p>
                  </div>
                </div>

                {filteredAgents.filter(puedeRetirar).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredAgents.filter(puedeRetirar).map((agent) => (
                      <div key={agent.id} className="relative group p-6 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800 border border-amber-100 dark:border-amber-900/30 rounded-3xl hover:shadow-xl transition-all duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold overflow-hidden shadow-inner">
                               {agent.avatar ? (
                                 <img src={agent.avatar} alt="Avatar" className="w-full h-full object-cover" />
                               ) : (
                                 (agent.name || "C").charAt(0).toUpperCase()
                               )}
                             </div>
                             <span className="font-bold text-gray-800 dark:text-white">{agent.name || "Comisionista"}</span>
                          </div>
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-white dark:bg-amber-900/30 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-800/50 uppercase self-start sm:self-auto">Saldo Pendiente</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white">{formatCurrency(agent.accumulated)}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Mínimo para retirar: {formatCurrency(minimoDe(agent))}</p>
                          </div>
                          <Button onClick={() => openSettleModal(agent)} className="bg-amber-500 hover:bg-amber-600 text-white px-6 rounded-xl font-bold h-12 w-full sm:w-auto justify-center">
                            Pagar Ahora
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-gray-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6 text-gray-500 dark:text-slate-500">
                      <CreditCard size={32} />
                    </div>
                    <p className="text-gray-500 dark:text-slate-400 font-bold text-lg">¡Todo al día!</p>
                    <p className="text-gray-500 text-sm mt-1">Ningún comisionista ha llegado a su mínimo para retirar.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="bg-primary text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-transform hover:-translate-y-1">
                  <div className="absolute -top-10 -right-10 p-8 opacity-10 pointer-events-none">
                    <AlertCircle size={160} />
                  </div>
                  <h4 className="text-xl font-bold mb-4 flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                      <AlertCircle size={20} className="text-white" />
                    </div>
                    Regla de Negocio
                  </h4>
                  <p className="text-white/80 text-sm leading-relaxed relative z-10">
                    Cada comisionista tiene su <span className="bg-white/20 px-2 py-1 rounded-lg text-white font-black">mínimo para retirar</span>: la liquidación se habilita cuando su neto acumulado llega a ese mínimo. Se define en su ficha; si no tiene uno, es de $50.000.
                  </p>
                </div>
                <div className="bg-accent text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-transform hover:-translate-y-1">
                  <div className="absolute -top-10 -right-10 p-8 opacity-10 pointer-events-none">
                    <BadgeDollarSign size={160} />
                  </div>
                  <h4 className="text-xl font-bold mb-4 flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                      <BadgeDollarSign size={20} className="text-white" />
                    </div>
                    Cálculo Neto
                  </h4>
                  <p className="text-white/80 text-sm leading-relaxed relative z-10">
                    El monto a liquidar corresponde al valor neto después de aplicar el porcentaje de retención configurado en cada venta. Asegúrate de verificar el historial antes de confirmar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* === PESTAÑA HISTORIAL === */}
          {activeTab === "history" && (
            <Card className="animate-fade-in border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-[#ffffff] dark:bg-slate-800">
              <CardHeader className="bg-gray-50/50 dark:bg-slate-900/50 p-8 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
                      <History size={20} />
                   </div>
                   <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Registro Histórico</h2>
                </div>
              </CardHeader>
              <div className="p-0">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-gray-50/30 dark:bg-slate-800/30">
                        <th className="px-8 py-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Fecha</th>
                        <th className="px-8 py-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Beneficiario</th>
                        <th className="px-8 py-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Método de Pago</th>
                        <th className="px-8 py-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Referencia</th>
                        <th className="px-8 py-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                      {loadingSettlements && settlements.length === 0 && <SkeletonRows columnas={5} filas={5} />}
                      {/* La lista del hook, la que se refresca al liquidar. Antes se leía
                          `data.commissionSettlements` de DataContext, una segunda copia que
                          nadie actualizaba: la liquidación recién hecha no aparecía. */}
                      {settlements.length > 0 ? (
                        settlements.map((s) => (
                          <tr key={s.id} className="hover:bg-accent/5 transition-all group">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2 text-gray-500">
                                <Calendar size={14} />
                                <span className="text-xs font-bold font-mono">{s.date}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-primary flex items-center justify-center text-sm font-black shadow-sm group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                  {s.agentName?.charAt(0) || "?"}
                                </div>
                                <span className="font-bold text-gray-800 dark:text-white text-sm">{s.agentName}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-black uppercase tracking-wider border border-blue-100 dark:border-blue-800/50">{s.paymentMethod}</span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 font-medium">{s.reference || "Sín referencia"}</span>
                                {s.notes && <span className="text-xs text-gray-500 italic mt-1 line-clamp-1">{s.notes}</span>}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                               <p className="text-base font-black text-gray-800 dark:text-white">{formatCurrency(s.amount)}</p>
                               <span className="text-xs text-success font-bold uppercase tracking-widest">● Procesado</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center">
                               <FileText className="text-gray-200 dark:text-slate-600 mb-4" size={48} />
                               <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No hay registros aún</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  className="px-8 py-4"
                  currentPage={settlementsMeta.page}
                  totalPages={settlementsMeta.totalPages}
                  total={settlementsMeta.total}
                  perPage={settlementsMeta.perPage}
                  loading={loadingSettlements}
                  onPageChange={(page) => fetchSettlements({ page, perPage: settlementsMeta.perPage })}
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </Card>

      {/* === MODAL CREAR/EDITAR COMISIONISTA === */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAgent ? "Editar Perfil de Comisionista" : "Registrar Nuevo Comisionista Estratégico"}
        size="xl"
      >
        <div className="flex flex-col md:flex-row min-h-[500px]">
          {/* Panel Izquierdo - Avatar */}
          <div className="w-full md:w-1/3 bg-gray-50/50 dark:bg-slate-800/30 p-6 md:p-8 border-b md:border-b-0 md:border-r border-gray-100 dark:border-slate-700/50 flex flex-col items-center justify-start relative overflow-hidden">
            <div className="relative z-10 w-full">
              <AvatarPicker
                value={formData.avatar || AVATARS[0]}
                onChange={(avatar) => setFormData((prev: any) => ({ ...prev, avatar }))}
              />
              <div className="mt-6 text-center text-sm text-gray-500 bg-[#ffffff] dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700/50">
                <p>Selecciona un avatar premium para identificar a este comisionista en tu directorio y listados de pagos.</p>
              </div>
            </div>
          </div>

          {/* Panel Derecho - Formulario */}
          <div className="w-full md:w-2/3 p-6 md:p-8 flex flex-col">
            <div className="flex-1 space-y-6">
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                 <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-inner">
                    <User size={24} />
                 </div>
                 <div>
                    <h4 className="font-bold text-primary">Información General</h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Completa los datos básicos para el seguimiento de comisiones.</p>
                 </div>
              </div>

              <FormField label="Nombre Completo / Razón Social" error={errors.name}>
                <Input
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                  value={formData.name || ""}
                  onChange={(e) => { setFormData({ ...formData, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: "" }); }}
                  placeholder="Ej. Juan Asesor o Agencia Viajes Plus"
                  error={errors.name}
                />
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Categoría de Comisionista">
                  <Select
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.type || ""}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    options={[
                      { value: "", label: "Seleccione un tipo" },
                      { value: "Comisionista", label: "Comisionista Independiente" },
                      { value: "Agencia Externa", label: "Agencia de Viajes Externa" },
                      { value: "Referido", label: "Referido / Amigo" },
                      { value: "Otro", label: "Otro Comisionista" },
                    ]}
                  />
                </FormField>
                <FormField label="Mínimo para retirar" error={errors.paymentThreshold}>
                  <Input
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    type="number"
                    min={0}
                    step={1000}
                    value={formData.paymentThreshold ?? ""}
                    onChange={(e) => setFormData({ ...formData, paymentThreshold: e.target.value === "" ? "" : Number(e.target.value) })}
                    placeholder="50000"
                    error={errors.paymentThreshold}
                  />
                </FormField>
                <FormField label="Estado de la Cuenta">
                  <Select
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.status || "Activo"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={[
                      { value: "Activo", label: "Activo - Recibe Comisiones" },
                      { value: "Inactivo", label: "Inactivo - Suspendido" },
                    ]}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Tipo de Documento" error={errors.docTypeId}>
                  <Select
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.docTypeId || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, docTypeId: e.target.value, docNumber: "" });
                      if (errors.docTypeId) setErrors({ ...errors, docTypeId: "" });
                      if (errors.docNumber) setErrors((p) => ({ ...p, docNumber: "" }));
                    }}
                    options={[
                      { value: "", label: "Seleccione" },
                      ...tiposDocumento.map((dt) => ({ value: String(dt.id), label: dt.name || abreviaturaDe(dt) })),
                    ]}
                    error={errors.docTypeId}
                  />
                </FormField>
                <FormField label="Número de Identificación" error={errors.docNumber}>
                  <Input
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.docNumber || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, docNumber: limpiarDocumento(abreviatura, e.target.value) });
                      if (errors.docNumber) setErrors((p) => ({ ...p, docNumber: "" }));
                    }}
                    onBlur={(e) => {
                      const err = validateDocNumber(e.target.value, abreviatura);
                      if (err) setErrors((p) => ({ ...p, docNumber: err }));
                    }}
                    maxLength={20}
                    placeholder={
                      abreviatura.toUpperCase() === "NIT" ? "Ej. 900123456-8" :
                      abreviatura.toUpperCase() === "PA" ? "Ej. AB1234567" :
                      "Ej. 1234567890"
                    }
                    error={errors.docNumber}
                  />
                </FormField>
              </div>

              {/* Datos Bancarios */}
              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-inner">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-700 dark:text-emerald-400">Datos Bancarios</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Información de cuenta para pagos de comisiones.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField label="Banco">
                  <Input
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.banco || ""}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    placeholder="Ej. Bancolombia"
                  />
                </FormField>
                <FormField label="Tipo de Cuenta">
                  <Select
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.tipoCuenta || ""}
                    onChange={(e) => setFormData({ ...formData, tipoCuenta: e.target.value })}
                    options={[
                      { value: "", label: "Seleccione" },
                      { value: "Ahorros", label: "Cuenta de Ahorros" },
                      { value: "Corriente", label: "Cuenta Corriente" },
                      { value: "Nequi", label: "Nequi" },
                      { value: "Daviplata", label: "Daviplata" },
                      { value: "Otro", label: "Otro" },
                    ]}
                  />
                </FormField>
                <FormField label="Número de Cuenta">
                  <Input
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.numeroCuenta || ""}
                    onChange={(e) => setFormData({ ...formData, numeroCuenta: e.target.value.replace(/\D/g, "") })}
                    placeholder="Ej. 1234567890"
                    maxLength={20}
                  />
                </FormField>
              </div>
            </div>

            <div className="flex gap-4 justify-end pt-8 mt-4 border-t border-gray-100 dark:border-slate-800">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-12 px-8 rounded-xl font-bold border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800" disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 px-10 h-12 rounded-xl font-bold shadow-lg shadow-primary/20 text-white hover:scale-105 active:scale-95 transition-all" disabled={isSaving}>
                {isSaving ? "Guardando..." : editingAgent ? "Guardar Cambios" : "Confirmar Registro"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* === MODAL LIQUIDACIÓN (PAGO) === */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Validación de Liquidación"
        size="md"
      >
        <div className="space-y-4">
          {/* A quién y cuánto: lo primero que hay que confirmar antes de ver
              un solo campo del formulario. Mismo lenguaje que el resto de la
              app para tarjetas de resumen (SalePaymentsModal, AgentDetailsModal):
              tarjeta neutra con una franja de color, no una tarjeta "publicitaria". */}
          <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 p-4 shadow-sm">
            <div className="absolute top-0 left-0 h-full w-1 bg-amber-500" />
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                {(selectedAgent?.name || "C").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 dark:text-slate-400">Orden de pago para</p>
                <h3 className="truncate font-bold text-gray-900 dark:text-white">{selectedAgent?.name}</h3>
              </div>
              <span className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1 font-mono text-xs font-semibold text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                REF {new Date().getFullYear()}-{String(selectedAgent?.id ?? 0).padStart(3, "0")}
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-gray-200 pt-3 dark:border-slate-700">
              <span className="text-xs text-gray-500 dark:text-slate-400">Monto a liquidar</span>
              <span className="text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400">
                {formatCurrency(selectedAgent?.accumulated || 0)}
              </span>
            </div>
          </div>

          {/* El formulario, agrupado en una sola tarjeta en vez de repartido
              en secciones con su propia franja de color cada una. */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <Wallet size={13} /> Detalles del pago
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Fecha de ejecución" className="mb-0">
                <DatePicker
                  value={settleData.date}
                  onChange={(val) => { setSettleData({ ...settleData, date: val }); setSettleError(null); }}
                  fieldName="ejecución"
                />
              </FormField>
              <FormField label="Canal de pago" error={settleFieldErrors.paymentMethod} className="mb-0">
                <div className="relative">
                  <CreditCard className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                  <Select
                    className="pl-9"
                    value={settleData.paymentMethod?.toString() || ""}
                    onChange={(e) => {
                      setSettleData({ ...settleData, paymentMethod: e.target.value });
                      setSettleError(null);
                      setSettleFieldErrors({});
                    }}
                    options={[
                      { value: "", label: "Seleccione un canal" },
                      ...(data.config.paymentMethods || []).map((pm) => ({
                        value: pm.id.toString(),
                        label: pm.name,
                      })),
                    ]}
                  />
                </div>
              </FormField>
            </div>
            <FormField label="Referencia de transacción (opcional)" className="mb-0">
              <div className="relative">
                <FileText className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <Input
                  className="pl-9"
                  placeholder="Ej. N° de comprobante o PIN"
                  value={settleData.reference}
                  onChange={(e) => setSettleData({ ...settleData, reference: e.target.value })}
                />
              </div>
            </FormField>
            <FormField label="Notas del proceso" className="mb-0">
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-gray-border bg-white p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900"
                placeholder="Añade detalles adicionales..."
                value={settleData.notes}
                onChange={(e) => setSettleData({ ...settleData, notes: e.target.value })}
              />
            </FormField>
          </div>

          {/* Recapitula la operación antes de confirmar: es dinero saliendo de
              la agencia, y el formulario de arriba no deja verlo de un vistazo. */}
          {selectedAgent && selectedAgent.accumulated > 0 && settleData.paymentMethod && (
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Vas a liquidar <strong>{formatCurrency(selectedAgent.accumulated)}</strong> a{" "}
                <strong>{selectedAgent.name}</strong> por{" "}
                <strong>
                  {(data.config.paymentMethods || []).find((pm) => pm.id.toString() === settleData.paymentMethod?.toString())?.name || "el canal elegido"}
                </strong>
                .
              </p>
            </div>
          )}

          {settleError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{settleError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={() => setIsSettleModalOpen(false)} className="flex-1" disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="success" onClick={handleSettle} className="flex-1" disabled={isSaving || !((selectedAgent?.accumulated ?? 0) > 0)}>
              {isSaving ? "Procesando..." : "Confirmar liquidación"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ===== CONFIRMAR ELIMINACIÓN ===== */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Eliminar Comisionista"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              className="border-none"
              onClick={() => setDeleteConfirm(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 font-bold"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 size={16} className="animate-spin" />}
              {isDeleting ? "Eliminando..." : "Eliminar Comisionista"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            ¿Estás seguro de que deseas eliminar al comisionista <strong>{deleteConfirm?.name}</strong>?
            Esta acción removerá su perfil del sistema de comisiones.
          </p>
        </div>
      </Modal>

      <AgentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        agent={selectedAgent}
      />
    </div>
  );
}
