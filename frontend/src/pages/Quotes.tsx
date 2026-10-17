import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Send, Check, X, Copy, Trash2, Download, ArrowRightCircle, FileText,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { FormField, Input, Select, Textarea } from "../components/ui/Form";
import { AsyncCombobox } from "../components/ui/AsyncCombobox";
import { DatePicker } from "../components/sales/forms/TicketForm";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { Step2Products } from "../components/sales/steps/Step2Products";
import { ProductFormsModal } from "../components/sales/wizard/ProductFormsModal";
import { useQuotesContext } from "../context/QuotesContext";
import { usePermissions } from "../context/PermissionsContext";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useSaleCalculations } from "../hooks/useSaleCalculations";
import { formatCurrency, formatDate, todayStr } from "../utils/formatters";
import { type Quote, type SaleProductId } from "../types";
import { INITIAL_FORM, type WizardFormData, type FijarCampo } from "../components/sales/wizardData";
import * as api from "../api";

const ESTADO_BADGE: Record<string, string> = {
  borrador: "pendiente", enviada: "abonado", aceptada: "pagado", rechazada: "danger", vencida: "inactive",
};
const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida",
};

/**
 * Cada categoría, a qué array de `WizardFormData` corresponde y con qué clave viaja en el
 * cuerpo de la petición (`ticketData`, `hotelData`...) — el mismo cuerpo que usa una venta,
 * reutilizado tal cual por la cotización (spec 007, replanificada).
 */
const CATEGORIA_A_ARRAY: Record<string, { key: keyof WizardFormData; requestKey: string }> = {
  ticket: { key: "tickets", requestKey: "ticketData" },
  hotel: { key: "hotels", requestKey: "hotelData" },
  insurance: { key: "insurances", requestKey: "insuranceData" },
  plan: { key: "plans", requestKey: "planData" },
  checkin: { key: "checkIns", requestKey: "checkInData" },
  migration: { key: "migrations", requestKey: "migrationData" },
  simcard: { key: "simCards", requestKey: "simCardData" },
  car: { key: "carRentals", requestKey: "carRentalData" },
  finca: { key: "fincas", requestKey: "fincaData" },
  tour: { key: "tours", requestKey: "tourData" },
  convention: { key: "conventions", requestKey: "conventionData" },
  restaurant: { key: "restaurants", requestKey: "restaurantData" },
  visa: { key: "visas", requestKey: "visaData" },
  passport: { key: "passports", requestKey: "passportData" },
  pet: { key: "petServices", requestKey: "petServiceData" },
};

export default function Quotes() {
  const {
    quotes, quotesMeta, loadingQuotes, fetchQuotes,
    handleCreateQuote, handleUpdateQuote, handleDeleteQuote,
    handleDuplicateQuote, handleSendQuote, handleRespondQuote,
  } = useQuotesContext();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { user } = useAuth();
  const { data, fetchConfig } = useData();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Quote | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  // Aceptada o rechazada: el backend ya no deja editarla, así que se muestra en
  // una vista de solo lectura en vez del mismo formulario de edición.
  const [readOnlyView, setReadOnlyView] = useState(false);

  // El mismo cuerpo que arma el asistente de venta, salvo el cliente: una cotización
  // no pide ninguno (no se sabe si se va a cerrar) — se elige uno solo al convertirla
  // en venta, en el asistente de siempre.
  const [name, setName] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [draft, setDraft] = useState<WizardFormData>(() => ({ ...INITIAL_FORM }));
  const [showOtherProducts, setShowOtherProducts] = useState(false);
  const [activeForm, setActiveForm] = useState<SaleProductId | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useSaleCalculations(draft, setDraft);

  const pedir = useCallback((page?: number) => {
    fetchQuotes({
      page: page ?? quotesMeta.page, perPage: quotesMeta.perPage,
      search: search || undefined, status: status || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, quotesMeta.perPage]);

  useEffect(() => { pedir(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // La búsqueda espera a que se deje de escribir, mismo patrón que el resto del sistema.
  useEffect(() => {
    const t = setTimeout(() => pedir(1), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  // Solo hace falta al crear: el backend no reasigna el asesor al editar
  // (`updateQuoteSchema` omite `asesorId`). Sin este selector, quien suplanta no
  // tiene cómo mandar un asesor y el alta siempre daba 400 ("Elige un asesor...").
  const buscarAsesores = useCallback(async (q: string) => {
    const res = await api.listUsers({ search: q || undefined, perPage: 20 });
    return (res?.data || [])
      .filter((u: any) => u.status === "active")
      .map((u: any) => ({ value: u.name, label: u.name, data: u }));
  }, []);

  const set: FijarCampo = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const toggleProduct = (id: SaleProductId) => {
    setDraft((prev) => {
      const isSelecting = !prev.selectedProducts.includes(id);
      const nextProducts = isSelecting
        ? [...prev.selectedProducts, id]
        : prev.selectedProducts.filter((p) => p !== id);
      return { ...prev, selectedProducts: nextProducts };
    });
  };

  const actions = {
    showOtherProducts, setShowOtherProducts,
    activeForm, activeIdx,
    openForm: (type: SaleProductId | null, idx: number | null) => {
      setActiveForm(type);
      setActiveIdx(idx);
    },
  };

  const puedeEditar = (q: Quote) => q.estado === "borrador" || q.estado === "enviada" || q.estado === "vencida";

  const resetForm = () => {
    setEditing(null);
    setName("");
    setFechaVencimiento("");
    setReadOnlyView(false);
    // Mismo valor por defecto que `NewSaleWizard.tsx`: el propio usuario. Quien
    // suplanta tiene que cambiarlo por un asesor real de la agencia suplantada
    // (el backend rechaza dejarlo sin elegir mientras se suplanta).
    setDraft({ ...INITIAL_FORM, asesorId: user?.id ? String(user.id) : "", asesorName: user?.name || "" });
    setShowOtherProducts(false);
    setActiveForm(null);
    setActiveIdx(null);
    setErrorMsg("");
  };

  const openCreate = () => { resetForm(); setIsModalOpen(true); };

  // Una cotización aceptada o rechazada ya no se puede editar (el backend la
  // rechaza con 400): se abre en una vista de solo lectura, no en el mismo
  // formulario — antes se podía intentar "Guardar" y el único aviso era ese 400
  // genérico después de tocar todo.
  const openEdit = (q: Quote) => {
    setEditing(q);
    setReadOnlyView(!puedeEditar(q));
    setName(q.name || "");
    setFechaVencimiento(q.fechaVencimiento ? q.fechaVencimiento.slice(0, 10) : "");

    // El formulario ya no pide cliente, pero si la cotización ya tenía uno (de antes
    // de este cambio, o puesto por la API), se conserva sin mostrarlo: guardar no
    // debe borrarlo en silencio.
    const next: WizardFormData = {
      ...INITIAL_FORM,
      ...(q.clientId ? { clientId: String(q.clientId) } : {}),
      observations: q.observations || "",
    };
    const seleccionadas: SaleProductId[] = [];
    for (const linea of q.lines) {
      const mapa = CATEGORIA_A_ARRAY[linea.categoria];
      if (!mapa || !linea.detalle) continue;
      if (!seleccionadas.includes(linea.categoria)) seleccionadas.push(linea.categoria);
      (next as any)[mapa.key] = [...(next as any)[mapa.key], linea.detalle];
    }
    next.selectedProducts = seleccionadas;
    setDraft(next);
    setShowOtherProducts(false);
    setActiveForm(null);
    setActiveIdx(null);
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const body: Record<string, unknown> = {
        clientId: draft.clientId,
        name: name.trim() || null,
        fechaVencimiento: fechaVencimiento || null,
        observations: draft.observations || null,
        // Solo al crear: editar no reasigna el asesor (`updateQuoteSchema` lo omite).
        ...(editing ? {} : { asesorId: draft.asesorId || undefined }),
      };
      for (const categoria of Object.keys(CATEGORIA_A_ARRAY)) {
        const { key, requestKey } = CATEGORIA_A_ARRAY[categoria];
        const items = (draft as any)[key] as unknown[];
        if (items && items.length > 0) body[requestKey] = items;
      }
      if (editing) await handleUpdateQuote(editing.id, body);
      else await handleCreateQuote(body);
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || "No se pudo guardar la cotización");
    } finally {
      setSaving(false);
    }
  };

  const accionar = async (id: number, fn: () => Promise<unknown>) => {
    setActionId(id);
    setErrorMsg("");
    try {
      await fn();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || "No se pudo completar la acción");
    } finally {
      setActionId(null);
    }
  };

  const confirmarBorrar = async () => {
    if (!confirmDelete) return;
    await accionar(confirmDelete.id, () => handleDeleteQuote(confirmDelete.id));
    setConfirmDelete(null);
  };

  const descargarPdf = async (q: Quote) => {
    setErrorMsg("");
    try {
      const { url } = await api.getQuotePdfUrl(q.id);
      // Navegar a la URL y no `window.open`: tras el `await` ya no cuenta como clic del
      // usuario y el bloqueador de ventanas emergentes lo frena en silencio.
      window.location.assign(url);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || "No se pudo generar el PDF");
    }
  };

  // No escribe ninguna venta: deja el borrador listo en la misma clave que usa el
  // asistente, con el detalle completo de cada servicio ya en la forma que esperan
  // Step2Products/ProductFormsModal — una asignación directa, sin reconstruir nada.
  const convertirEnVenta = async (q: Quote) => {
    setActionId(q.id);
    setErrorMsg("");
    try {
      const borrador = await api.convertQuoteToSale(q.id);
      const draftKey = `nexus_new_sale_draft_${user?.empresaId || "sin-empresa"}_${user?.id || "unknown"}`;

      // La cotización puede no tener cliente (no es obligatorio): si no lo tenía, el
      // asistente lo pide igual que en cualquier venta nueva, en su primer paso.
      const form: WizardFormData = {
        ...INITIAL_FORM,
        ...(borrador.clientId ? { clientId: String(borrador.clientId), clientData: borrador.client as any } : {}),
        asesorId: user?.id ? String(user.id) : "",
        asesorName: user?.name || "",
      };
      const seleccionadas: SaleProductId[] = [];
      for (const [categoria, items] of Object.entries(borrador.products || {})) {
        const mapa = CATEGORIA_A_ARRAY[categoria];
        if (!mapa || !items?.length) continue;
        seleccionadas.push(categoria as SaleProductId);
        (form as any)[mapa.key] = items;
      }
      form.selectedProducts = seleccionadas;

      localStorage.setItem(draftKey, JSON.stringify(form));
      navigate(`/sales?fromQuote=${q.id}`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || "No se pudo convertir la cotización");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          actions={canCreate("quotes") && (
            <Button onClick={openCreate}>
              <Plus size={16} /> Nueva Cotización
            </Button>
          )}
        >
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h2 className="font-bold text-primary text-lg">Cotizaciones</h2>
          </div>
        </CardHeader>
        <CardBody>
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente..."
              maxLength={100}
              className="max-w-xs"
            />
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "", label: "Todos los estados" },
                { value: "borrador", label: "Borrador" },
                { value: "enviada", label: "Enviada" },
                { value: "aceptada", label: "Aceptada" },
                { value: "rechazada", label: "Rechazada" },
              ]}
              className="max-w-[200px]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">N.º</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Vencimiento</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {loadingQuotes && quotes.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-500">Cargando…</td></tr>
                ) : quotes.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-500">No hay cotizaciones.</td></tr>
                ) : quotes.map(q => (
                  <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 pr-3 font-semibold text-primary">#{q.numero ?? q.id}</td>
                    <td className="py-2 pr-3">{q.name || "—"}</td>
                    <td className="py-2 pr-3">{q.clientName || "—"}</td>
                    <td className="py-2 pr-3"><Badge variant={ESTADO_BADGE[q.estado]}>{ESTADO_LABEL[q.estado]}</Badge></td>
                    <td className="py-2 pr-3">{q.fechaVencimiento ? formatDate(q.fechaVencimiento) : "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums">{formatCurrency(q.totals.total)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          title={puedeEditar(q) && canEdit("quotes") ? "Editar" : "Ver"}
                          onClick={() => openEdit(q)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-800"
                        >
                          <FileText size={15} />
                        </button>
                        {canCreate("quotes") && (
                          <button
                            type="button"
                            title="Duplicar"
                            disabled={actionId === q.id}
                            onClick={() => accionar(q.id, () => handleDuplicateQuote(q.id))}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Copy size={15} />
                          </button>
                        )}
                        {canEdit("quotes") && (q.estado === "borrador" || q.estado === "enviada" || q.estado === "vencida") && (
                          <button
                            type="button"
                            title="Enviar"
                            disabled={actionId === q.id}
                            onClick={() => accionar(q.id, () => handleSendQuote(q.id))}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50"
                          >
                            <Send size={15} />
                          </button>
                        )}
                        {canEdit("quotes") && (q.estado === "enviada" || q.estado === "vencida") && (
                          <>
                            <button
                              type="button"
                              title="Marcar aceptada"
                              disabled={actionId === q.id}
                              onClick={() => accionar(q.id, () => handleRespondQuote(q.id, true))}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              title="Marcar rechazada"
                              disabled={actionId === q.id}
                              onClick={() => accionar(q.id, () => handleRespondQuote(q.id, false))}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                            >
                              <X size={15} />
                            </button>
                          </>
                        )}
                        {q.estado === "aceptada" && !q.ventaId && canCreate("sales") && (
                          <button
                            type="button"
                            title="Convertir en venta"
                            disabled={actionId === q.id}
                            onClick={() => convertirEnVenta(q)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50"
                          >
                            <ArrowRightCircle size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Descargar PDF"
                          onClick={() => descargarPdf(q)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-800"
                        >
                          <Download size={15} />
                        </button>
                        {canDelete("quotes") && (
                          <button
                            type="button"
                            title="Borrar"
                            onClick={() => setConfirmDelete(q)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={quotesMeta.page}
            totalPages={quotesMeta.totalPages}
            onPageChange={(page) => pedir(page)}
            total={quotesMeta.total}
            perPage={quotesMeta.perPage}
            loading={loadingQuotes}
            className="mt-4"
          />
        </CardBody>
      </Card>

      {/* ===== MODAL: crear/editar — mismo cuerpo de productos que el asistente de venta ===== */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="" size="panel">
        <div className="flex flex-col h-full">
          {activeForm ? (
            <ProductFormsModal
              activeForm={activeForm}
              activeIdx={activeIdx}
              form={draft}
              data={data}
              set={set}
              onCloseForm={() => { setActiveForm(null); setActiveIdx(null); }}
              onSwitchForm={(productId, idx) => { setActiveForm(productId); setActiveIdx(idx); }}
              triggerError={(msg) => setErrorMsg(msg)}
              cotizando
            />
          ) : readOnlyView && editing ? (
            <>
              <div
                className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
                style={{ background: "linear-gradient(135deg, #2B2D42 0%, #3d4060 100%)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-base sm:text-lg font-heading font-semibold text-white truncate tracking-wide">
                    {editing.name || `Cotización #${editing.numero ?? editing.id}`}
                  </h2>
                  <Badge variant={ESTADO_BADGE[editing.estado]}>{ESTADO_LABEL[editing.estado]}</Badge>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Cerrar"
                  className="text-white/60 hover:text-white transition-all p-1.5 rounded-lg hover:bg-white/10 hover:scale-110"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
                <p className="text-xs text-gray-500 bg-gray-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg">
                  Una cotización {ESTADO_LABEL[editing.estado].toLowerCase()} ya no se puede editar.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">N.º: </span>#{editing.numero ?? editing.id}</div>
                  {editing.clientName && (
                    <div><span className="text-gray-500">Cliente: </span>{editing.clientName}</div>
                  )}
                  <div><span className="text-gray-500">Vencimiento: </span>{editing.fechaVencimiento ? formatDate(editing.fechaVencimiento) : "—"}</div>
                </div>
                {editing.observations && (
                  <div className="text-sm"><span className="text-gray-500">Observaciones: </span>{editing.observations}</div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-800 text-left text-xs uppercase text-gray-500">
                        <th className="py-2 pr-3">Servicio</th>
                        <th className="py-2 pr-3 text-right">Precio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {editing.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2 pr-3">{l.descripcion}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(l.precio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-xl bg-primary/5 px-4 py-3 text-right">
                  <span className="text-xs font-bold uppercase text-gray-500 mr-2">Total</span>
                  <span className="font-black tabular-nums text-primary">{formatCurrency(editing.totals.total)}</span>
                </div>
              </div>

              <div className="px-5 sm:px-6 py-4 bg-white border-t border-gray-100 flex justify-end flex-shrink-0 rounded-b-2xl">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cerrar</Button>
              </div>
            </>
          ) : (
            <>
              <div
                className="px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-2xl"
                style={{ background: "linear-gradient(135deg, #2B2D42 0%, #3d4060 100%)" }}
              >
                <h2 className="text-base sm:text-lg font-heading font-semibold text-white truncate tracking-wide">
                  {editing ? (editing.name || `Cotización #${editing.numero ?? editing.id}`) : "Nueva Cotización"}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Cerrar"
                  className="text-white/60 hover:text-white transition-all p-1.5 rounded-lg hover:bg-white/10 hover:scale-110"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
                {errorMsg && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
                    {errorMsg}
                  </div>
                )}

                <FormField label="Nombre (opcional)">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Cartagena plan para 2"
                    maxLength={120}
                  />
                </FormField>

                <div className={`grid grid-cols-1 gap-4 ${!editing ? "md:grid-cols-2" : ""}`}>
                  {!editing && (
                    <FormField label="Asesor">
                      <AsyncCombobox
                        value={draft.asesorName}
                        onChange={(val, opt) => {
                          if (opt?.data) {
                            set("asesorId", String(opt.data.id));
                            set("asesorName", opt.data.name);
                          } else {
                            set("asesorName", val);
                          }
                        }}
                        fetchOptions={buscarAsesores}
                        placeholder="¿Quién cotiza?"
                        emptyText="Ningún asesor coincide"
                      />
                    </FormField>
                  )}
                  <FormField label="Fecha de vencimiento (opcional)">
                    <DatePicker
                      value={fechaVencimiento}
                      onChange={setFechaVencimiento}
                      min={todayStr()}
                      fieldName="Fecha de vencimiento"
                    />
                  </FormField>
                </div>

                <FormField label="Observaciones">
                  <Textarea value={draft.observations} onChange={(e) => set("observations", e.target.value)} rows={2} maxLength={300} />
                </FormField>

                <Step2Products form={draft} set={set} data={data} errors={{}} toggleProduct={toggleProduct} actions={actions} />
              </div>

              <div className="px-5 sm:px-6 py-4 bg-white border-t border-gray-100 flex flex-wrap justify-end gap-2 flex-shrink-0 rounded-b-2xl">
                <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || draft.selectedProducts.length === 0}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ===== MODAL: confirmar borrado ===== */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Borrar cotización" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            ¿Borrar la cotización #{confirmDelete?.numero ?? confirmDelete?.id}? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmarBorrar} disabled={actionId === confirmDelete?.id}>
              Borrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
