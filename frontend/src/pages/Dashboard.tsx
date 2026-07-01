import React, { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { formatCurrency, getCurrentMonth, formatDate } from "../utils/formatters";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Clock,
  Store,
  Contact,
  Ticket,
  BedDouble,
  HeartPulse,
  Palmtree,
  Briefcase,
  DollarSign,
  CreditCard,
} from "lucide-react";
import Datepicker from "react-tailwindcss-datepicker";
import { useData } from "../context/DataContext";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { AlertCircle } from "lucide-react";
import LoadingScreen from "../components/ui/LoadingScreen";

export default function Dashboard() {
  const { dashboardData, dashboardLoading, fetchDashboard } = useData();
  const { start, end } = getCurrentMonth();
  const [dateRange, setDateRange] = useState<any>({
    startDate: new Date(start),
    endDate: new Date(end),
  });
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const isInitialMount = React.useRef(true);

  useEffect(() => {
    const params: Record<string, unknown> = {};
    if (dateRange?.startDate) {
      const s = typeof dateRange.startDate === 'string' ? dateRange.startDate.replace(/-/g, '/') : dateRange.startDate;
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        params.dateFrom = d.toISOString();
      }
    }
    if (dateRange?.endDate) {
      const s = typeof dateRange.endDate === 'string' ? dateRange.endDate.replace(/-/g, '/') : dateRange.endDate;
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        params.dateTo = d.toISOString();
      }
    }
    
    const isBackground = isInitialMount.current && dashboardData !== null;
    fetchDashboard(params, isBackground);
    
    isInitialMount.current = false;
  }, [dateRange, fetchDashboard]);

  const stats = useDashboardStats();

  if (dashboardLoading && !dashboardData) {
    return <LoadingScreen fullScreen={false} />;
  }

  const CARTERA_COLORS = ["#8D99AE", "#2B2D42", "#f59e0b"];

  return (
    <div className="space-y-8 pb-8">
      {/* Header Premium con Estilo de Lujo DB NEXUS */}
      <div className="relative rounded-3xl bg-white dark:bg-[#1a1b22] p-8 shadow-xl border border-slate-200/50 dark:border-slate-800/60 transition-all duration-300">
        {/* Capa de fondo con destellos de gradiente */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl z-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#8D99AE] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[80px] opacity-10 dark:opacity-20"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#2B2D42] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[80px] opacity-5 dark:opacity-20"></div>
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center gap-6 text-center">
          <div className="flex flex-col items-center justify-center">
            <h1 className="text-4xl font-black text-[#2B2D42] dark:text-white font-heading tracking-tight flex items-center justify-center">
              Panel de Control
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xl font-medium">
              Supervisa el rendimiento financiero y operativo en tiempo real. Todos los indicadores estratégicos de tu agencia, en un solo vistazo.
            </p>
          </div>
          <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 rounded-xl transition-all shadow-inner">
            <div className="w-72 datepicker-container datepicker-transparent">
              <Datepicker
                value={dateRange as any}
                onChange={(newValue: any) => setDateRange(newValue)}
                showShortcuts={true}
                primaryColor={"indigo"}
                displayFormat={"DD/MMM/YYYY"}
                placeholder={"Selecciona un periodo"}
                separator={" - "}
                containerClassName="relative !bg-transparent"
                inputClassName="w-full text-sm font-semibold text-[#2B2D42] dark:text-white !bg-transparent border-none py-2 px-4 cursor-pointer focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sección 1: Indicadores Financieros Estratégicos */}
      {dashboardLoading && !dashboardData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-150 dark:bg-slate-800 rounded-3xl h-[160px]"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              label: "T.A INGRESADA",
              value: formatCurrency(stats.totalIngresos),
              subtitle: "Ventas Totales",
              detail: `+${formatCurrency(stats.monthIngresos)} mes`,
              icon: <TrendingUp size={24} />,
              gradient: "from-[#2B2D42] to-[#454866]",
              lightBg: "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200",
            },
            {
              label: "CRÉDITO",
              value: formatCurrency(stats.totalPendiente),
              subtitle: "Cuentas por Cobrar",
              detail: `${stats.PendienteCount} cuentas`,
              icon: <Clock size={24} />,
              gradient: "from-amber-500 to-yellow-400",
              lightBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-350",
              onClick: () => setIsCreditModalOpen(true),
            },
            {
              label: "PROVEEDORES",
              value: formatCurrency(stats.totalProveedores),
              subtitle: "Costos Operativos",
              detail: `${stats.supplierCount} activos`,
              icon: <Store size={24} />,
              gradient: "from-rose-500 to-pink-400",
              lightBg: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-350",
            },
            {
              label: "CLIENTES",
              value: stats.totalClients,
              subtitle: "Total Registrados",
              detail: `${stats.activeClients} Activos`,
              icon: <Contact size={24} />,
              gradient: "from-[#8D99AE] to-[#b0b9c7]",
              lightBg: "bg-blue-50 dark:bg-blue-950/40 text-[#8D99AE] dark:text-blue-300",
            },
          ].map((kpi, i) => (
            <div
              key={i}
              onClick={kpi.onClick}
              className={`relative group bg-white dark:bg-[#1a1b22] border border-slate-200/50 dark:border-slate-800/70 rounded-[28px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden ${
                kpi.onClick ? "cursor-pointer hover:border-amber-300 dark:hover:border-amber-500/40" : ""
              }`}
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${kpi.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {kpi.label}
                  </p>
                  <div className={`p-3 rounded-2xl ${kpi.lightBg} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                    {kpi.icon}
                  </div>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-850 dark:text-white mb-1 tracking-tight font-heading">
                  {kpi.value}
                </h3>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate">
                    {kpi.subtitle}
                  </span>
                  {kpi.detail && (
                    <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg whitespace-nowrap shadow-sm">
                      {kpi.detail}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sección 2: Ventas Operativas por Categoría (Horizontal Rows) */}
      <div className="bg-slate-50/50 dark:bg-[#1a1b22]/40 backdrop-blur-md rounded-3xl p-6 border border-slate-200/50 dark:border-slate-800/60">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-1">
          Rendimiento por Categoría de Servicio
        </h3>
        
        {dashboardLoading && !dashboardData ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-150 dark:bg-slate-800 rounded-2xl h-[80px]"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "TIQUETES AÉREOS",
                value: `${stats.totalFlights} tramos`,
                subtitle: "Tramos Emitidos",
                icon: <Ticket size={20} />,
                lightBg: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-300",
              },
              {
                label: "HOTELES",
                value: `${stats.hotelesCount} reserv.`,
                subtitle: "Reservas Activas",
                detail: formatCurrency(stats.hotelesIngresos),
                icon: <BedDouble size={20} />,
                lightBg: "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300",
              },
              {
                label: "SEGUROS",
                value: `${stats.segurosCount} pólizas`,
                subtitle: "Pólizas Emitidas",
                detail: formatCurrency(stats.segurosIngresos),
                icon: <HeartPulse size={20} />,
                lightBg: "bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-600 dark:text-fuchsia-300",
              },
              {
                label: "PAQUETES",
                value: `${stats.planesCount} planes`,
                subtitle: "Paquetes Turísticos",
                detail: formatCurrency(stats.planesIngresos),
                icon: <Palmtree size={20} />,
                lightBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-350",
              },
            ].map((kpi, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4.5 bg-white dark:bg-[#1a1b22]/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 group"
              >
                <div className={`p-2.5 rounded-xl ${kpi.lightBg} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                  {kpi.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider truncate">
                    {kpi.label}
                  </p>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white mt-0.5 truncate font-heading">
                    {kpi.value}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 truncate mt-0.5 font-medium">
                    {kpi.detail ? kpi.detail : kpi.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#1a1b22] border border-slate-200/50 dark:border-slate-800/70 rounded-3xl shadow-sm p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-slate-300/10 dark:bg-slate-800/10 rounded-full blur-3xl"></div>
          <h2 className="text-lg font-black text-slate-850 dark:text-white mb-6 font-heading">Comparativa de Ingresos</h2>
          <div className="h-72 w-full font-body">
            {dashboardLoading && !dashboardData ? (
              <div className="w-full h-full bg-gray-50 dark:bg-slate-850 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.yearlyTrendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#8D99AE", fontWeight: 600 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: "#8D99AE", fontWeight: 600 }} 
                    tickFormatter={(v) => {
                      if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
                      return `$${v}`;
                    }} 
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)} 
                    contentStyle={{ borderRadius: "16px", border: "1px solid #e2e8f0", backgroundColor: "rgba(11, 15, 25, 0.95)", color: "#fff", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.15)", padding: "12px", fontWeight: "bold" }} 
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: 600, paddingTop: "20px" }} />
                  <Area type="monotone" dataKey="current" name="Año Actual" stroke="var(--color-primary)" strokeWidth={4} fillOpacity={1} fill="url(#colorCurrent)" activeDot={{ r: 8, fill: "var(--color-primary)", stroke: "var(--color-bg-card)", strokeWidth: 3, className: "drop-shadow-md" }} />
                  <Area type="monotone" dataKey="previous" name="Año Anterior" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPrev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1b22] border border-slate-200/50 dark:border-slate-800/70 rounded-3xl shadow-sm p-4 sm:p-6 flex flex-col">
          <h2 className="text-lg font-black text-slate-850 dark:text-white mb-2 font-heading">Estado de Cartera</h2>
          <div className="flex-grow flex flex-col justify-center">
            <div className="relative h-56 flex items-center justify-center font-body">
              {dashboardLoading && !dashboardData ? (
                <div className="w-40 h-40 rounded-full border-[20px] border-gray-50 animate-pulse" />
              ) : (
                <ResponsiveContainer width="99%" height="100%">
                  <PieChart>
                    <Pie data={stats.carteraData} cx="50%" cy="50%" innerRadius="65%" outerRadius="85%" paddingAngle={5} dataKey="value" stroke="none" cornerRadius={8}>
                      {stats.carteraData.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={CARTERA_COLORS[index % CARTERA_COLORS.length]} className="drop-shadow-sm hover:opacity-80 transition-opacity" />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(v: number) => `${v}%`} 
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)", padding: "8px 16px" }} 
                      itemStyle={{ color: "#1e293b", fontWeight: "900", fontSize: "16px" }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {(!dashboardLoading || dashboardData) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none drop-shadow-sm">
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 dark:text-slate-500 tracking-[0.2em] mb-1">Total</span>
                  <span className="text-lg font-black text-slate-800 dark:text-slate-100">{formatCurrency(stats.totalIngresos)}</span>
                </div>
              )}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 font-body">
              {dashboardLoading && !dashboardData ? (
                <></>
              ) : (
                stats.carteraData.map((item: any, i: number) => (
                  <div key={i} className="flex flex-col items-center justify-center py-3 px-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100/50 dark:border-slate-800/40 shadow-inner">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: CARTERA_COLORS[i] }} />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">{item.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-850 dark:text-white">{item.value}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Modern Table */}
      <div className="bg-white/90 dark:bg-[#131524]/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-lg font-black text-gray-800 dark:text-white">Últimas Ventas Aprobadas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-transparent text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/50 dark:border-slate-800/80">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Asesor</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Monto Total</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/40">
              {dashboardLoading && !dashboardData ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse bg-white dark:bg-slate-800">
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 dark:bg-slate-700 rounded-md w-3/4"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 dark:bg-slate-700 rounded-md w-1/2"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 dark:bg-slate-700 rounded-md w-1/3"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 dark:bg-slate-700 rounded-md w-1/2"></div></td>
                    <td className="px-6 py-5"><div className="h-6 bg-gray-100 dark:bg-slate-700 rounded-xl w-20"></div></td>
                  </tr>
                ))
              ) : (
                stats.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-[#1c1e30]/30 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-gray-700 dark:text-slate-200">{sale.clientName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">{sale.asesorName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">{formatDate(sale.date)}</td>
                    <td className="px-6 py-4 font-black text-gray-800 dark:text-white">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm ${
                          sale.status === "pagado"
                            ? "bg-green-100/80 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200/50 dark:border-green-800/50"
                            : sale.status === "abonado"
                              ? "bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50"
                              : "bg-orange-100/80 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200/50 dark:border-orange-800/50"
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL DETALLE CRÉDITO / CARTERA ===== */}
      <Modal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        title="Desglose de Cartera en Crédito"
        size="md"
      >
        <div className="space-y-6 py-2">
          {/* Tarjeta de Encabezado con Balance */}
          <div className="relative p-6 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl text-white shadow-xl shadow-orange-100 overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-10 transform rotate-12 pointer-events-none">
              <CreditCard size={140} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-90 mb-1">
              Cuentas por Cobrar Totales
            </p>
            <h3 className="text-3xl font-black mb-1">
              {formatCurrency(stats.totalPendiente)}
            </h3>
            <p className="text-xs opacity-80 font-medium">
              Suma del balance pendiente de cobro de {stats.PendienteCount} cuentas activas en Crédito y Abonado.
            </p>
          </div>

          {/* Grid de Desglose */}
          <div className="grid grid-cols-1 gap-4">
            {/* Proveedores */}
            <div className="p-5 bg-rose-50/50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 rounded-2xl flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="p-3 bg-rose-500 text-white rounded-xl shadow-md shadow-rose-200 dark:shadow-none">
                <Briefcase size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold text-rose-500 dark:text-rose-400 uppercase tracking-widest mb-1">
                  Deuda con Proveedores
                </p>
                <h4 className="text-xl font-black text-gray-800 mb-1">
                  {formatCurrency(stats.creditProveedores)}
                </h4>
                <p className="text-xs text-gray-500 font-medium">
                  Costo neto de servicios turísticos adquiridos con operadores proveedores pendientes de pago.
                </p>
              </div>
            </div>

            {/* TA Crédito */}
            <div className="p-5 bg-emerald-50/50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 rounded-2xl flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-200 dark:shadow-none">
                <DollarSign size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">
                  Crédito de T.A. (Comisión de la Agencia)
                </p>
                <h4 className="text-xl font-black text-gray-800 mb-1">
                  {formatCurrency(stats.creditTa)}
                </h4>
                <p className="text-xs text-gray-500 font-medium">
                  T.A. de la agencia pendiente de recaudar. Corresponde a la ganancia de la oficina.
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico/Progreso Segmentado */}
          {stats.creditProveedores + stats.creditTa > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>Proveedores ({Math.round((stats.creditProveedores / (stats.creditProveedores + stats.creditTa)) * 100)}%)</span>
                <span>TA ({Math.round((stats.creditTa / (stats.creditProveedores + stats.creditTa)) * 100)}%)</span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                <div 
                  className="bg-rose-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${(stats.creditProveedores / (stats.creditProveedores + stats.creditTa)) * 100}%` }} 
                />
                <div 
                  className="bg-emerald-500 transition-all duration-1000 ease-out" 
                  style={{ width: `${(stats.creditTa / (stats.creditProveedores + stats.creditTa)) * 100}%` }} 
                />
              </div>
            </div>
          )}

          {/* Alerta/Nota informativa */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3 text-xs text-gray-500">
            <AlertCircle size={16} className="text-gray-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Las cuentas en <strong>Crédito</strong> y <strong>Abonado</strong> se sincronizan automáticamente con las finanzas del sistema. El balance se actualiza en tiempo real al registrar abonos de pago.
            </p>
          </div>

          {/* Botón de cerrar */}
          <div className="pt-2">
            <Button
              onClick={() => setIsCreditModalOpen(false)}
              className="w-full h-12 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold shadow-md"
            >
              Entendido
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
