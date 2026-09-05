import { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import Datepicker from "react-tailwindcss-datepicker";
import { Plane, BedDouble, ShieldCheck, Package } from "lucide-react";
import { formatCurrency, getCurrentMonth } from "../utils/formatters";
import { useData } from "../context/DataContext";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { AttentionPanel } from "../components/dashboard/AttentionPanel";
import * as api from "../api";
import { AttentionSummary } from "../types";

/**
 * Dashboard.
 *
 * La jerarquía dice qué importa: primero el dinero (lo que entró y lo que falta
 * por cobrar), luego los contadores operativos en una tira compacta, luego las
 * dos gráficas y al final lo que requiere acción.
 *
 * Antes eran ocho tarjetas KPI del mismo tamaño y el mismo peso —con lo que
 * ninguna mandaba—, un encabezado "premium" de `text-4xl font-black` sobre
 * destellos de degradado, y `font-black` dieciséis veces en el archivo. Las
 * métricas son las mismas; lo que cambia es cuál grita.
 */

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Colores de la cartera: pagado, abonado, pendiente. */
const CARTERA_COLORS = ["#16a34a", "var(--color-accent)", "var(--color-highlight)"];

// ── Piezas ──────────────────────────────────────────────────────────────────

/**
 * Cifra de titular. Dos por dashboard y nada más: si todo va grande, nada va
 * grande. `tabular-nums` para poder comparar entre periodos.
 */
const Titular = memo(function Titular({
  etiqueta, valor, apoyo, acento, cargando,
}: { etiqueta: string; valor: number; apoyo: string; acento?: boolean; cargando: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-accent dark:text-slate-400">{etiqueta}</p>
      {cargando ? (
        <div className="h-9 w-48 max-w-full rounded bg-gray-200 dark:bg-slate-700/60 animate-pulse motion-reduce:animate-none mt-1.5" />
      ) : (
        <p className={`font-heading text-[2.125rem] leading-none font-bold tabular-nums mt-1.5 ${acento ? "text-highlight" : "text-primary dark:text-white"}`}>
          {formatCurrency(valor)}
        </p>
      )}
      <p className="text-xs text-accent dark:text-slate-400 mt-2">{apoyo}</p>
    </div>
  );
});

/**
 * Contadores operativos. Antes eran cuatro tarjetas del mismo tamaño que las
 * financieras, lo que les daba un peso que no tienen: son apoyo, no titular.
 */
const Contador = memo(function Contador({
  Icono, etiqueta, valor, cargando,
}: { Icono: typeof Plane; etiqueta: string; valor: number; cargando: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Icono size={16} className="shrink-0 text-accent dark:text-slate-500" />
      <span className="text-sm text-accent dark:text-slate-400 truncate">{etiqueta}</span>
      {cargando ? (
        <span className="h-4 w-8 rounded bg-gray-200 dark:bg-slate-700/60 animate-pulse motion-reduce:animate-none" />
      ) : (
        <span className="font-semibold text-primary dark:text-white tabular-nums ml-auto">{valor}</span>
      )}
    </div>
  );
});

const Panel = ({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) => (
  <section className={`bg-white/95 dark:bg-[#131524]/95 border border-gray-border dark:border-slate-800 rounded-2xl ${className}`}>
    <h2 className="font-heading text-sm font-semibold text-primary dark:text-white px-5 py-4 border-b border-gray-border dark:border-slate-800">
      {titulo}
    </h2>
    <div className="p-5">{children}</div>
  </section>
);

// ── La página ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { dashboardData, dashboardLoading, fetchDashboard } = useData();
  const stats = useDashboardStats();

  const [dateRange, setDateRange] = useState<any>(() => {
    const guardado = localStorage.getItem("dashboard_date_range");
    if (guardado) {
      try {
        const p = JSON.parse(guardado);
        if (p?.startDate && p?.endDate) return p;
      } catch { /* si está corrupto se usa el mes en curso */ }
    }
    const { start, end } = getCurrentMonth();
    return { startDate: start, endDate: end };
  });

  const [atencion, setAtencion] = useState<AttentionSummary | null>(null);
  const [atencionCargando, setAtencionCargando] = useState(true);
  const primeraCarga = useRef(true);

  /** Los parámetros de fecha, derivados del rango elegido. */
  const paramsDeFecha = useCallback(() => {
    const params: Record<string, unknown> = {};
    const aIso = (v: any, finDeDia: boolean) => {
      const s = typeof v === "string" ? v.replace(/-/g, "/") : v;
      const d = new Date(s);
      if (isNaN(d.getTime())) return null;
      finDeDia ? d.setHours(23, 59, 59, 999) : d.setHours(0, 0, 0, 0);
      return d.toISOString();
    };
    if (dateRange?.startDate) {
      const v = aIso(dateRange.startDate, false);
      if (v) params.dateFrom = v;
    }
    if (dateRange?.endDate) {
      const v = aIso(dateRange.endDate, true);
      if (v) params.dateTo = v;
    }
    return params;
  }, [dateRange]);

  useEffect(() => {
    if (dateRange) localStorage.setItem("dashboard_date_range", JSON.stringify(dateRange));

    // En la primera carga con caché ya pintada, el refresco va en segundo plano
    // para no vaciar la pantalla.
    fetchDashboard(paramsDeFecha(), primeraCarga.current && dashboardData !== null);
    primeraCarga.current = false;

    const t = setInterval(() => fetchDashboard(paramsDeFecha(), true), 300_000);
    return () => clearInterval(t);
    // `dashboardData` fuera de las dependencias a propósito: solo se consulta
    // para decidir si el primer refresco es en segundo plano, y ponerlo aquí
    // provocaría un bucle (el fetch lo cambia).
  }, [dateRange, fetchDashboard, paramsDeFecha]);

  /**
   * `attention` va en su propia petición, no dentro del dashboard.
   *
   * No depende del rango de fechas —un crédito vencido lo está hoy, mire uno el
   * mes que mire— así que meterlo en /stats/dashboard obligaría a recalcularlo
   * en cada cambio de filtro sin que su respuesta cambie.
   */
  useEffect(() => {
    let vivo = true;
    setAtencionCargando(true);
    api.getAttention()
      .then(d => { if (vivo) setAtencion(d); })
      .catch(() => { if (vivo) setAtencion(null); })
      .finally(() => { if (vivo) setAtencionCargando(false); });
    return () => { vivo = false; };
  }, []);

  const cargando = dashboardLoading && !dashboardData;

  const tendencia = stats.yearlyTrendData;
  const anioActual = new Date().getFullYear();

  return (
    <div className="space-y-6 pb-8">

      {/* ── Titular: qué entró y qué falta por cobrar ─────────────────── */}
      <section className="bg-white/95 dark:bg-[#131524]/95 border border-gray-border dark:border-slate-800 rounded-2xl px-5 sm:px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            <Titular
              etiqueta="Ingresado en el periodo"
              valor={stats.totalIngresos}
              apoyo={`${stats.totalOperaciones} ${stats.totalOperaciones === 1 ? "operación" : "operaciones"}`}
              cargando={cargando}
            />
            {/* El acento marca lo que pide atención, no decora. */}
            <Titular
              etiqueta="Por cobrar"
              valor={stats.totalPendiente}
              apoyo={`${stats.PendienteCount} ${stats.PendienteCount === 1 ? "venta a crédito" : "ventas a crédito"}`}
              acento
              cargando={cargando}
            />
          </div>

          <div className="w-full sm:w-72 shrink-0">
            <Datepicker
              value={dateRange}
              onChange={setDateRange}
              showShortcuts
              primaryColor="teal"
              displayFormat="DD/MM/YYYY"
              inputClassName="w-full text-sm rounded-lg border border-gray-border dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-highlight/40"
            />
          </div>
        </div>

        {/* Costos y clientes: cifras de contexto, no titulares. */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 mt-7 pt-6 border-t border-gray-border dark:border-slate-800">
          <div>
            <dt className="text-xs text-accent dark:text-slate-400">Costos de proveedor</dt>
            <dd className="text-base font-semibold text-primary dark:text-white tabular-nums">{formatCurrency(stats.totalProveedores)}</dd>
          </div>
          <div>
            <dt className="text-xs text-accent dark:text-slate-400">Proveedores activos</dt>
            <dd className="text-base font-semibold text-primary dark:text-white tabular-nums">{stats.supplierCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-accent dark:text-slate-400">Clientes registrados</dt>
            <dd className="text-base font-semibold text-primary dark:text-white tabular-nums">{stats.totalClients}</dd>
          </div>
          <div>
            <dt className="text-xs text-accent dark:text-slate-400">Clientes activos</dt>
            <dd className="text-base font-semibold text-primary dark:text-white tabular-nums">{stats.activeClients}</dd>
          </div>
        </dl>
      </section>

      {/* ── Tira operativa: apoyo, no titular ─────────────────────────── */}
      <section className="bg-white/95 dark:bg-[#131524]/95 border border-gray-border dark:border-slate-800 rounded-2xl px-5 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3">
          <Contador Icono={Plane} etiqueta="Tramos emitidos" valor={stats.totalFlights} cargando={cargando} />
          <Contador Icono={BedDouble} etiqueta="Reservas de hotel" valor={stats.hotelesCount} cargando={cargando} />
          <Contador Icono={ShieldCheck} etiqueta="Pólizas emitidas" valor={stats.segurosCount} cargando={cargando} />
          <Contador Icono={Package} etiqueta="Paquetes" valor={stats.planesCount} cargando={cargando} />
        </div>
      </section>

      {/* ── Gráficas ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel titulo={`Ingresos ${anioActual} frente a ${anioActual - 1}`} className="lg:col-span-2">
          <div className="h-72 w-full">
            {cargando ? (
              <div className="w-full h-full rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tendencia} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-highlight)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--color-highlight)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-main)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : `${Math.round(v / 1000)}k`)}
                  />
                  <Tooltip
                    formatter={(v: any) => formatCurrency(Number(v))}
                    contentStyle={{
                      background: "var(--color-bg-card)",
                      border: "1px solid var(--color-border-main)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  {/* El año en curso lleva el acento; el anterior queda en gris
                      discontinuo, que es lo que se compara contra. */}
                  <Area type="monotone" dataKey="current" name={String(anioActual)} stroke="var(--color-highlight)" strokeWidth={2} fill="url(#areaActual)" />
                  <Area type="monotone" dataKey="previous" name={String(anioActual - 1)} stroke="var(--color-accent)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel titulo="Estado de cartera">
          <div className="h-44 w-full">
            {cargando ? (
              <div className="w-full h-full rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" />
            ) : (
              <ResponsiveContainer width="99%" height="100%">
                <PieChart>
                  <Pie data={stats.carteraData} cx="50%" cy="50%" innerRadius="64%" outerRadius="86%" paddingAngle={3} dataKey="value" stroke="none">
                    {stats.carteraData.map((_, i) => (
                      <Cell key={i} fill={CARTERA_COLORS[i % CARTERA_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border-main)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <dl className="mt-4 space-y-2">
            {stats.carteraData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CARTERA_COLORS[i % CARTERA_COLORS.length] }} />
                <dt className="text-accent dark:text-slate-400">{c.name}</dt>
                <dd className="ml-auto font-semibold text-primary dark:text-white tabular-nums">{formatCurrency(c.value)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {/* ── Lo que requiere acción ────────────────────────────────────── */}
      <AttentionPanel resumen={atencion} cargando={atencionCargando} />
    </div>
  );
}
