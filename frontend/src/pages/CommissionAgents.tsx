import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { FormField, Input, Select } from "../components/ui/Form";
import AvatarPicker, { AVATARS } from "../components/ui/AvatarPicker";
import { DatePicker } from "../components/sales/forms/TicketForm";
import { useData } from "../context/DataContext";
import { useCommissionsContext } from "../context/CommissionsContext";
import { usePermissions } from "../context/PermissionsContext";
import { formatCurrency, capitalizeName, todayStr } from "../utils/formatters";
import StatCard from "../components/ui/StatCard";
import LoadingScreen from "../components/ui/LoadingScreen";

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
    fetchSettlements
  } = useCommissionsContext();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"agents" | "settlements" | "history">("agents");
  const [formData, setFormData] = useState<any>({});
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

  // Lazy Load Fetch
  useEffect(() => {
    Promise.all([
      fetchCommissionAgents(),
      fetchSettlements()
    ]).finally(() => setIsLoading(false));
  }, [fetchCommissionAgents, fetchSettlements]);

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Calcular acumulados (solo ventas no liquidadas)
  const filteredAgents = useMemo(() => {
    const agents = commissionAgents || [];
    const sales = data.sales || [];
    console.log("Debug - CommissionAgents:", { agentsCount: agents.length, salesCount: sales.length });
    
    // Create map for O(N + M) complexity instead of O(N * M)
    const accumulatedByAgent = sales.reduce((acc: Record<string, number>, s: any) => {
      if (!s.isSettled && s.commissionAgentId) {
        const id = s.commissionAgentId.toString();
        acc[id] = (acc[id] || 0) + (s.commissionAgentNetPayment || 0);
      }
      return acc;
    }, {});

    const mapped = agents.map((agent: any) => {
      return { 
        ...agent, 
        accumulated: accumulatedByAgent[agent.id?.toString()] || 0 
      };
    });

    const result = mapped.filter(
      (a: any) =>
        (a.name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
        (a.docNumber || "").includes(searchTerm)
    ).sort((a: any, b: any) => b.id - a.id);
    
    console.log("Debug - FilteredAgents:", result);
    return result;
  }, [commissionAgents, data.sales, searchTerm]);

  const stats = useMemo(() => {
    const totalAccumulated = filteredAgents.reduce((s: number, a: any) => s + (a.accumulated || 0), 0);
    const pendingLiquidation = filteredAgents.filter((a: any) => a.accumulated >= 50000).length;
    return {
      total: commissionAgents?.length || 0,
      totalAccumulated,
      pendingLiquidation,
    };
  }, [filteredAgents, commissionAgents]);

  const handleOpenModal = (agent?: any) => {
    setErrors({});
    if (agent) {
      setEditingAgent(agent);
      setFormData({ ...agent });
    } else {
      setEditingAgent(null);
      setFormData({ status: "Activo", type: "Comisionista", avatar: AVATARS[0], docType: data.config.documentTypes?.[0]?.abreviatura || "" });
    }
    setIsModalOpen(true);
  };

  const validateDocNumber = (value: string, docType: string): string => {
    if (!value.trim()) return "El número de documento es obligatorio";
    const typeUpper = docType ? docType.toUpperCase() : "";
    if (typeUpper === "PASAPORTE" || typeUpper === "PP" || typeUpper === "PAS") {
      if (value.length < 9 || value.length > 12) return "El pasaporte debe tener entre 9 y 12 caracteres";
      if (!/^[a-zA-Z0-9]+$/.test(value)) return "El pasaporte solo debe contener caracteres alfanuméricos";
    } else if (typeUpper === "NIT" || typeUpper === "RUT") {
      if (value.length !== 11) return "El NIT/RUT debe tener exactamente 11 caracteres (9 dígitos + guion + 1 dígito)";
      if (!/^\d{9}-\d{1}$/.test(value)) return "El NIT/RUT debe tener formato 9 dígitos - guion - 1 dígito de verificación (ej: 123456789-0)";
    } else if (typeUpper === "CC") {
      if (value.length < 8 || value.length > 10) return "La cédula de ciudadanía debe tener entre 8 y 10 dígitos";
      if (!/^\d+$/.test(value)) return "La cédula de ciudadanía solo debe contener números";
    } else if (value.length > 15) {
      return "El documento no puede exceder 15 caracteres";
    }
    // Duplicate check against existing agents
    const isDuplicate = (commissionAgents || []).some(
      (a: any) => a.docNumber === value && (!editingAgent || a.id !== editingAgent.id)
    );
    if (isDuplicate) return "Este número de documento ya está registrado";
    return "";
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!formData.name) errs.name = "El nombre es obligatorio";
    if (!formData.docType) errs.docType = "Seleccione un tipo de documento";
    const docErr = validateDocNumber(formData.docNumber || "", formData.docType || "");
    if (docErr) errs.docNumber = docErr;
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSaving(true);
    try {
      const sanitizedData = {
        ...formData,
        name: capitalizeName(formData.name),
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
      setErrorMessage(err?.response?.data?.message || "Error al guardar el comisionista");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
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
      setErrorMessage(err?.response?.data?.message || "Error al eliminar el comisionista");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const openSettleModal = (agent: any) => {
    setSelectedAgent(agent);
    const defaultPM = (data.config.paymentMethods || []).find((pm: any) => pm.name === "Transferencia");
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
    try {
      await settleCommissions({ agentId: selectedAgent.id, ...settleData, agentName: selectedAgent.name });
      await fetchSettlements();
      notifySuccess(`Liquidación de ${formatCurrency(selectedAgent.accumulated)} procesada`);
      setIsSettleModalOpen(false);
      setActiveTab("history");
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al procesar la liquidación");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const TABS = [
    { id: "agents", label: "Directorio", icon: Coins },
    { id: "settlements", label: "Pendientes", icon: Wallet },
    { id: "history", label: "Historial", icon: History },
  ] as const;

  if (isLoading && commissionAgents.length === 0) {
    return <LoadingScreen fullScreen={false} />;
  }

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

      {/* Background Glow */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col items-center justify-center gap-4 animate-fade-in relative z-10 text-center">
        <div className="flex flex-col items-center justify-center">
          <h1 className="text-2xl sm:text-4xl font-black text-primary tracking-tight flex items-center justify-center gap-3 sm:gap-4">
            <div className="p-2.5 sm:p-3 bg-primary rounded-xl sm:rounded-2xl shadow-xl shadow-primary/20 text-white shrink-0">
              <Coins size={24} className="sm:hidden" />
              <Coins size={32} className="hidden sm:block" />
            </div>
            Comisionistas
          </h1>
          <p className="text-gray-500 font-medium mt-1 sm:mt-2 max-w-lg text-xs sm:text-sm">
            Sistema avanzado de gestión de comisionistas, control de liquidaciones y seguimiento financiero.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          {canCreate('commissions') && (
            <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 rounded-xl sm:rounded-2xl transition-all hover:scale-105 active:scale-95 font-bold justify-center text-xs sm:text-sm">
              <Plus size={20} /> Registrar Comisionista
            </Button>
          )}
        </div>
      </div>



      {/* Tab Navigation */}
      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm w-full sm:w-auto self-start">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                  isActive
                    ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105"
                    : "text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-primary dark:hover:text-primary"
                }`}
              >
                <Icon size={16} className={isActive ? "animate-pulse" : ""} />
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
              {/* Search Bar */}
              <div className="relative group max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-accent transition-colors" size={20} />
                <Input
                  className="pl-12 h-14 rounded-2xl border-gray-100 bg-white/80 backdrop-blur-sm shadow-sm focus:shadow-md transition-all text-sm"
                  placeholder="Buscar por nombre o documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {filteredAgents.length === 0 ? (
                <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-700 py-20 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-gray-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-6 text-gray-200 dark:text-slate-600">
                    <Coins size={48} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">No se encontraron resultados</h3>
                  <p className="text-gray-400 mt-2 max-w-xs">
                    Intenta ajustar tu búsqueda o registra un nuevo comisionista estratégico.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredAgents.map((agent: any) => {
                    const progress = Math.min((agent.accumulated / 50000) * 100, 100);
                    const isReady = agent.accumulated >= 50000;

                    return (
                      <div
                        key={agent.id}
                        className="group bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-gray-100 dark:border-slate-700/50 rounded-2xl p-4 md:p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col md:flex-row items-center gap-6"
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
                              <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{agent.type || "Comisionista"}</span>
                              <span className="text-[11px] font-medium text-gray-400">{agent.docType} {agent.docNumber}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Progress Bar (Center) */}
                        <div className="flex-1 w-full flex flex-col justify-center min-w-[200px]">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Progreso Meta</span>
                            <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase">$50k</span>
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
                            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Acumulado</p>
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
                              {canEdit('commissions') && (
                                <button onClick={() => handleOpenModal(agent)} className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Editar">
                                  <Pencil size={16} />
                                </button>
                              )}
                              {canDelete('commissions') && (
                                <button onClick={() => setDeleteConfirm(agent)} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors" title="Eliminar">
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
              <div className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-md rounded-[2.5rem] border border-gray-100 dark:border-slate-700 p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Pagos Pendientes</h2>
                    <p className="text-sm text-gray-500 font-medium">Comisionistas que han superado el umbral de liquidación.</p>
                  </div>
                </div>

                {filteredAgents.filter((a: any) => a.accumulated >= 50000).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredAgents.filter((a: any) => a.accumulated >= 50000).map((agent: any) => (
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
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-white dark:bg-amber-900/30 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-800/50 uppercase self-start sm:self-auto">Saldo Pendiente</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white">{formatCurrency(agent.accumulated)}</p>
                          <Button onClick={() => openSettleModal(agent)} className="bg-amber-500 hover:bg-amber-600 text-white px-6 rounded-xl font-bold h-12 w-full sm:w-auto justify-center">
                            Pagar Ahora
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-gray-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mx-auto mb-6 text-gray-300 dark:text-slate-500">
                      <CreditCard size={32} />
                    </div>
                    <p className="text-gray-500 dark:text-slate-400 font-bold text-lg">¡Todo al día!</p>
                    <p className="text-gray-400 text-sm mt-1">No hay liquidaciones pendientes por encima de $50,000.</p>
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
                    Las liquidaciones se habilitan automáticamente cuando un comisionista acumula un neto de <span className="bg-white/20 px-2 py-1 rounded-lg text-white font-black">$50,000</span>. Esto optimiza los procesos administrativos y bancarios de la oficina.
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
            <Card className="animate-fade-in border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
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
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Fecha</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Beneficiario</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Método de Pago</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">Referencia</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                      {(data.commissionSettlements || []).length > 0 ? (
                        [...(data.commissionSettlements || [])].reverse().map((s: any) => (
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
                              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-black uppercase tracking-wider border border-blue-100 dark:border-blue-800/50">{s.paymentMethod}</span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 font-medium">{s.reference || "Sín referencia"}</span>
                                {s.notes && <span className="text-[10px] text-gray-400 italic mt-1 line-clamp-1">{s.notes}</span>}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                               <p className="text-base font-black text-gray-800 dark:text-white">{formatCurrency(s.amount)}</p>
                               <span className="text-[9px] text-success font-bold uppercase tracking-widest">● Procesado</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center">
                               <FileText className="text-gray-200 dark:text-slate-600 mb-4" size={48} />
                               <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No hay registros aún</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

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
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10 w-full">
              <AvatarPicker
                value={formData.avatar || AVATARS[0]}
                onChange={(avatar) => setFormData((prev: any) => ({ ...prev, avatar }))}
              />
              <div className="mt-6 text-center text-sm text-gray-500 bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700/50">
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
                <FormField label="Tipo de Documento" error={errors.docType}>
                  <Select
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.docType || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, docType: e.target.value, docNumber: "" });
                      if (errors.docType) setErrors({ ...errors, docType: "" });
                      if (errors.docNumber) setErrors((p) => ({ ...p, docNumber: "" }));
                    }}
                    options={[
                      { value: "", label: "Seleccione" },
                      ...(data.config.documentTypes || []).map((dt: any) => {
                        const code = dt.abbreviation || dt.abreviatura || dt.name || '';
                        const labelStr = code;
                        return { value: code, label: labelStr };
                      }),
                    ]}
                    error={errors.docType}
                  />
                </FormField>
                <FormField label="Número de Identificación" error={errors.docNumber}>
                  <Input
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 focus:bg-gray-50 dark:focus:bg-slate-800 transition-colors"
                    value={formData.docNumber || ""}
                    onChange={(e) => {
                      let val = e.target.value;
                      const typeUpper = formData.docType ? formData.docType.toUpperCase() : "";
                      if (typeUpper === "CC") {
                        val = val.replace(/\D/g, "");
                      } else if (typeUpper === "PASAPORTE" || typeUpper === "PP" || typeUpper === "PAS") {
                        val = val.replace(/[^a-zA-Z0-9]/g, "");
                      } else if (typeUpper === "NIT" || typeUpper === "RUT") {
                        val = val.replace(/[^0-9-]/g, "");
                      } else {
                        val = val.replace(/[^\w-]/gi, "");
                      }
                      setFormData({ ...formData, docNumber: val });
                      if (errors.docNumber) setErrors((p) => ({ ...p, docNumber: "" }));
                    }}
                    onBlur={(e) => {
                      const err = validateDocNumber(e.target.value, formData.docType || "");
                      if (err) setErrors((p) => ({ ...p, docNumber: err }));
                    }}
                    maxLength={
                      formData.docType ? (
                        formData.docType.toUpperCase() === "CC" ? 10 :
                        ["PASAPORTE", "PP", "PAS"].includes(formData.docType.toUpperCase()) ? 12 :
                        ["NIT", "RUT"].includes(formData.docType.toUpperCase()) ? 11 : 15
                      ) : 15
                    }
                    placeholder={
                      formData.docType?.toUpperCase() === "CC" ? "Ej. 1234567890" :
                      ["NIT", "RUT"].includes(formData.docType?.toUpperCase() || "") ? "Ej. 123456789-0" :
                      ["PASAPORTE", "PP", "PAS"].includes(formData.docType?.toUpperCase() || "") ? "Ej. AB1234567" :
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
        <div className="space-y-6">
          <div className="relative p-6 bg-gradient-to-br from-amber-500 to-amber-600 rounded-[2rem] text-white shadow-xl shadow-amber-200 overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-20 transform rotate-12">
               <BadgeDollarSign size={140} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80 mb-2">Orden de Pago para</p>
            <h3 className="text-2xl font-black mb-4 truncate">{selectedAgent?.name}</h3>
            <div className="flex items-end justify-between">
               <div>
                  <p className="text-[10px] font-bold uppercase opacity-80">Monto Total</p>
                  <p className="text-4xl font-black">{formatCurrency(selectedAgent?.accumulated || 0)}</p>
               </div>
               <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-bold border border-white/20">
                  REF: {new Date().getFullYear()}-00{selectedAgent?.id}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Fecha de Ejecución">
              <DatePicker
                value={settleData.date}
                onChange={(val) => setSettleData({ ...settleData, date: val })}
                fieldName="ejecución"
                className="h-12 rounded-xl"
              />
            </FormField>
            <FormField label="Canal de Pago">
              <Select
                className="h-12 rounded-xl"
                value={settleData.paymentMethod?.toString() || ""}
                onChange={(e) => setSettleData({ ...settleData, paymentMethod: e.target.value })}
                options={[
                  { value: "", label: "Seleccione un canal" },
                  ...(data.config.paymentMethods || []).map((pm: any) => ({
                    value: pm.id.toString(),
                    label: pm.name,
                  })),
                ]}
              />
            </FormField>
          </div>

          <FormField label="Referencia de Transacción (Opcional)">
            <Input
              className="h-12 rounded-xl"
              placeholder="Ej. N° de comprobante o PIN"
              value={settleData.reference}
              onChange={(e) => setSettleData({ ...settleData, reference: e.target.value })}
            />
          </FormField>

          <FormField label="Notas del Proceso">
            <textarea
              className="w-full p-4 rounded-2xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-sm min-h-[100px]"
              placeholder="Añade detalles adicionales..."
              value={settleData.notes}
              onChange={(e) => setSettleData({ ...settleData, notes: e.target.value })}
            />
          </FormField>

          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleSettle} className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-95" disabled={isSaving}>
              {isSaving ? "Procesando..." : "Confirmar y Saldar Cuentas"}
            </Button>
            <Button variant="outline" onClick={() => setIsSettleModalOpen(false)} className="h-12 rounded-xl border-gray-200 text-gray-400 font-bold" disabled={isSaving}>
              Cancelar Operación
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
    </div>
  );
}
