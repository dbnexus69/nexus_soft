import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { FormField, Input, Select } from "../components/ui/Form";
import { useData } from "../context/DataContext";
import { usePermissions } from "../context/PermissionsContext";
import { formatCurrency } from "../utils/formatters";
import StatCard from "../components/ui/StatCard";

export default function CommissionAgents() {
  const { data, addCommissionAgent, updateCommissionAgent, deleteCommissionAgent, settleCommissions, refreshSettlements, fetchCommissionAgents } = useData();
  const { canCreate, canEdit, canDelete } = usePermissions();

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
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    reference: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Lazy Load Fetch
  useEffect(() => {
    fetchCommissionAgents();
  }, [fetchCommissionAgents]);

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // Calcular acumulados (solo ventas no liquidadas)
  const filteredAgents = useMemo(() => {
    const agents = data.commissionAgents || [];
    const sales = data.sales || [];
    console.log("Debug - CommissionAgents:", { agentsCount: agents.length, salesCount: sales.length });
    
    const mapped = agents.map((agent: any) => {
      const accumulated = sales
        .filter((s) => s.commissionAgentId?.toString() === agent.id?.toString() && !s.isSettled)
        .reduce((sum, s) => sum + (s.commissionAgentNetPayment || 0), 0);
      return { ...agent, accumulated };
    });

    const result = mapped.filter(
      (a: any) =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.docNumber?.includes(searchTerm)
    ).sort((a: any, b: any) => b.id - a.id);
    console.log("Debug - FilteredAgents:", result);
    return result;
  }, [data.commissionAgents, data.sales, searchTerm]);

  const stats = useMemo(() => {
    const totalAccumulated = filteredAgents.reduce((s: number, a: any) => s + (a.accumulated || 0), 0);
    const pendingLiquidation = filteredAgents.filter((a: any) => a.accumulated >= 50000).length;
    return {
      total: data.commissionAgents?.length || 0,
      totalAccumulated,
      pendingLiquidation,
    };
  }, [filteredAgents, data.commissionAgents]);

  const handleOpenModal = (agent?: any) => {
    setErrors({});
    if (agent) {
      setEditingAgent(agent);
      setFormData({ ...agent });
    } else {
      setEditingAgent(null);
      setFormData({ status: "Activo", type: "Comisionista", docType: data.config.documentTypes?.[0]?.abreviatura || "" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!formData.name) errs.name = "El nombre es obligatorio";
    if (!formData.docNumber) errs.docNumber = "El documento es obligatorio";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSaving(true);
    try {
      if (editingAgent) {
        await updateCommissionAgent(editingAgent.id, formData);
        notifySuccess("Aliado actualizado correctamente");
      } else {
        await addCommissionAgent(formData);
        notifySuccess("Aliado registrado correctamente");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al guardar el aliado");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este comisionista?")) return;
    try {
      await deleteCommissionAgent(id);
      notifySuccess("Aliado eliminado correctamente");
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Error al eliminar el aliado");
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  const openSettleModal = (agent: any) => {
    setSelectedAgent(agent);
    const defaultPM = (data.config.paymentMethods || []).find((pm: any) => pm.name === "Transferencia");
    setSettleData({
      date: new Date().toISOString().split("T")[0],
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
      await settleCommissions(selectedAgent.id, { ...settleData, agentName: selectedAgent.name });
      await refreshSettlements();
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

  return (
    <div className="space-y-6 relative pb-10">
      {/* Toast Notification */}
      {showSuccess && (
        <div className="fixed top-20 right-6 z-[100] bg-emerald-50 border border-emerald-200 text-emerald-700 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-emerald-500 text-white rounded-full p-1">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Operación Exitosa</p>
            <p className="text-xs opacity-90">{successMessage}</p>
          </div>
        </div>
      )}
      {showError && (
        <div className="fixed top-32 right-6 z-[100] bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <div className="bg-rose-500 text-white rounded-full p-1">
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Error</p>
            <p className="text-xs opacity-90">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Background Glow */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in relative z-10">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tight flex items-center gap-4">
            <div className="p-3 bg-primary rounded-2xl shadow-xl shadow-primary/20 text-white">
              <Coins size={32} />
            </div>
            Comisionistas
          </h1>
          <p className="text-gray-500 font-medium mt-2 max-w-lg">
            Sistema avanzado de gestión de aliados, control de liquidaciones y seguimiento financiero.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate('commissions') && (
            <Button onClick={() => handleOpenModal()} className="h-14 px-8 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 rounded-2xl transition-all hover:scale-105 active:scale-95 font-bold">
              <Plus size={20} /> Registrar Aliado
            </Button>
          )}
        </div>
      </div>



      {/* Tab Navigation */}
      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-100 shadow-sm self-start">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  isActive
                    ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105"
                    : "text-gray-500 hover:bg-white hover:text-primary"
                }`}
              >
                <Icon size={18} className={isActive ? "animate-pulse" : ""} />
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
                <div className="bg-white rounded-[2rem] border border-dashed border-gray-200 py-20 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 text-gray-200">
                    <Coins size={48} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">No se encontraron resultados</h3>
                  <p className="text-gray-400 mt-2 max-w-xs">
                    Intenta ajustar tu búsqueda o registra un nuevo aliado estratégico.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredAgents.map((agent: any) => {
                    const progress = Math.min((agent.accumulated / 50000) * 100, 100);
                    const isReady = agent.accumulated >= 50000;

                    return (
                      <div
                        key={agent.id}
                        className="group bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                      >
                        {/* Background Decor */}
                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none ${isReady ? 'bg-amber-500' : 'bg-primary'}`} />

                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-transform group-hover:scale-110 duration-500 ${
                              isReady ? 'bg-amber-500 text-white shadow-amber-200' : 'bg-primary text-white shadow-primary/20'
                            }`}>
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-800 text-lg leading-tight group-hover:text-primary transition-colors">{agent.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{agent.type || "Comisionista"}</span>
                                <span className={`w-1.5 h-1.5 rounded-full ${agent.status === "Activo" ? 'bg-green-500' : 'bg-gray-300'}`} />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 relative z-10">
                             {canEdit('commissions') && (
                               <button onClick={() => handleOpenModal(agent)} className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                                  <Pencil size={16} />
                               </button>
                             )}
                             {canDelete('commissions') && (
                               <button onClick={() => handleDelete(agent.id)} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                  <Trash2 size={16} />
                               </button>
                             )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Acumulado</p>
                              <p className={`text-2xl font-black ${isReady ? 'text-amber-600' : 'text-primary'}`}>
                                {formatCurrency(agent.accumulated)}
                              </p>
                            </div>
                            <p className="text-[10px] font-black text-gray-400 uppercase">Meta $50k</p>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ease-out ${isReady ? 'bg-amber-500' : 'bg-accent'}`} 
                                style={{ width: `${progress}%` }} 
                              />
                            </div>
                            {isReady && (
                              <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-100 animate-pulse">
                                <AlertCircle size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Listo para liquidar</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-400 font-bold uppercase">Documento</span>
                              <span className="text-xs font-medium text-gray-600">{agent.docType} {agent.docNumber}</span>
                            </div>
                            {isReady && (
                              <button 
                                onClick={() => openSettleModal(agent)}
                                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all hover:shadow-lg shadow-amber-200"
                              >
                                Liquidar <ChevronRight size={14} />
                              </button>
                            )}
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
              <div className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-gray-100 p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Pagos Pendientes</h2>
                    <p className="text-sm text-gray-500 font-medium">Aliados que han superado el umbral de liquidación.</p>
                  </div>
                </div>

                {filteredAgents.filter((a: any) => a.accumulated >= 50000).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredAgents.filter((a: any) => a.accumulated >= 50000).map((agent: any) => (
                      <div key={agent.id} className="relative group p-6 bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-3xl hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center font-bold">
                               {agent.name.charAt(0)}
                             </div>
                             <span className="font-bold text-gray-800">{agent.name}</span>
                          </div>
                          <span className="text-[10px] font-black text-amber-600 bg-white px-2 py-1 rounded-lg border border-amber-100 uppercase">Saldo Pendiente</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-3xl font-black text-gray-800">{formatCurrency(agent.accumulated)}</p>
                          <Button onClick={() => openSettleModal(agent)} className="bg-amber-500 hover:bg-amber-600 text-white px-6 rounded-xl font-bold h-12">
                            Pagar Ahora
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                    <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6 text-gray-300">
                      <CreditCard size={32} />
                    </div>
                    <p className="text-gray-500 font-bold text-lg">¡Todo al día!</p>
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
                    Las liquidaciones se habilitan automáticamente cuando un aliado acumula un neto de <span className="bg-white/20 px-2 py-1 rounded-lg text-white font-black">$50,000</span>. Esto optimiza los procesos administrativos y bancarios de la oficina.
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
            <Card className="animate-fade-in border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-md">
              <CardHeader className="bg-gray-50/50 p-8 border-b border-gray-100">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
                      <History size={20} />
                   </div>
                   <h2 className="text-2xl font-bold text-gray-800">Registro Histórico</h2>
                </div>
              </CardHeader>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/30">
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Fecha</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Beneficiario</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Método de Pago</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Referencia</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
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
                                <div className="w-10 h-10 rounded-2xl bg-white border border-gray-100 text-primary flex items-center justify-center text-sm font-black shadow-sm group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                  {s.agentName?.charAt(0) || "?"}
                                </div>
                                <span className="font-bold text-gray-800 text-sm">{s.agentName}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-wider border border-blue-100">{s.paymentMethod}</span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 font-medium">{s.reference || "Sín referencia"}</span>
                                {s.notes && <span className="text-[10px] text-gray-400 italic mt-1 line-clamp-1">{s.notes}</span>}
                              </div>
                            </td>
                            <td className="px-8 py-5 text-right">
                               <p className="text-base font-black text-gray-800">{formatCurrency(s.amount)}</p>
                               <span className="text-[9px] text-success font-bold uppercase tracking-widest">● Procesado</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-8 py-20 text-center">
                            <div className="flex flex-col items-center">
                               <FileText className="text-gray-200 mb-4" size={48} />
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

      {/* === MODAL CREAR/EDITAR ALIADO === */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAgent ? "Editar Perfil de Aliado" : "Registrar Nuevo Aliado Estratégico"}
        size="lg"
      >
        <div className="py-4 space-y-6">
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
             <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white">
                <User size={24} />
             </div>
             <div>
                <h4 className="font-bold text-primary">Información General</h4>
                <p className="text-xs text-gray-500">Completa los datos básicos para el seguimiento de comisiones.</p>
             </div>
          </div>

          <FormField label="Nombre Completo / Razón Social" error={errors.name}>
            <Input
              className="h-12 rounded-xl"
              value={formData.name || ""}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: "" }); }}
              placeholder="Ej. Juan Asesor o Agencia Viajes Plus"
              error={errors.name}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Categoría de Aliado">
              <Select
                className="h-12 rounded-xl"
                value={formData.type || ""}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                options={[
                  { value: "", label: "Seleccione un tipo" },
                  { value: "Comisionista", label: "Comisionista Independiente" },
                  { value: "Agencia Externa", label: "Agencia de Viajes Externa" },
                  { value: "Referido", label: "Referido / Amigo" },
                  { value: "Otro", label: "Otro Aliado" },
                ]}
              />
            </FormField>
            <FormField label="Estado de la Cuenta">
              <Select
                className="h-12 rounded-xl"
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
                className="h-12 rounded-xl"
                value={formData.docType || ""}
                onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                options={[
                  { value: "", label: "Seleccione" },
                  ...(data.config.documentTypes || []).map((dt: any) => ({ value: dt.abreviatura, label: dt.abreviatura })),
                ]}
              />
            </FormField>
            <FormField label="Número de Identificación" error={errors.docNumber}>
              <Input
                className="h-12 rounded-xl"
                value={formData.docNumber || ""}
                onChange={(e) => { setFormData({ ...formData, docNumber: e.target.value }); if (errors.docNumber) setErrors({ ...errors, docNumber: "" }); }}
                placeholder="Ej. 1234567890"
                error={errors.docNumber}
              />
            </FormField>
          </div>

          <div className="flex gap-4 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-12 px-8 rounded-xl font-bold" disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 px-10 h-12 rounded-xl font-bold shadow-lg shadow-primary/20 text-white" disabled={isSaving}>
              {isSaving ? "Guardando..." : editingAgent ? "Guardar Cambios" : "Confirmar Registro"}
            </Button>
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
              <Input
                type="date"
                className="h-12 rounded-xl"
                value={settleData.date}
                onChange={(e) => setSettleData({ ...settleData, date: e.target.value })}
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
    </div>
  );
}
