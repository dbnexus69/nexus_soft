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
  Building,
  ShieldCheck,
  Briefcase,
  Plane,
  Users,
  DollarSign,
  CreditCard,
  Map,
} from "lucide-react";
import Datepicker from "react-tailwindcss-datepicker";
import { useData } from "../context/DataContext";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { AlertCircle } from "lucide-react";

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

  const stats = useMemo(() => {
    const d = dashboardData;
    const MONTH_NAMES = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];
    return {
      totalIngresos: d?.totalRevenue ?? 0,
      monthIngresos: d?.monthlyRevenue ?? 0,
      totalPendiente: d?.pendingBalance ?? 0,
      PendienteCount: d?.pendingCount ?? 0,
      totalProveedores: d?.suppliersTotal ?? 0,
      totalClients: d?.totalClients ?? 0,
      activeClients: d?.activeClients ?? 0,
      totalFlights: d?.totalFlights ?? 0,
      hotelesCount: d?.categoryBreakdown?.hoteles?.count ?? 0,
      hotelesIngresos: d?.categoryBreakdown?.hoteles?.revenue ?? 0,
      segurosCount: d?.categoryBreakdown?.seguros_viaje?.count ?? 0,
      segurosIngresos: d?.categoryBreakdown?.seguros_viaje?.revenue ?? 0,
      planesCount: d?.categoryBreakdown?.planes?.count ?? 0,
      planesIngresos: d?.categoryBreakdown?.planes?.revenue ?? 0,
      supplierCount: d?.supplierCount ?? 0,
      creditProveedores: d?.creditProveedores ?? 0,
      creditTa: d?.creditTa ?? 0,
      yearlyTrendData: MONTH_NAMES.map((monthName, index) => {
        const monthNum = index + 1;
        const apiMonth = d?.monthlyTrend?.find((m) => m.month === monthNum);
        return {
          name: monthName,
          current: apiMonth?.currentYear ?? 0,
          previous: apiMonth?.previousYear ?? 0,
        };
      }),
      recentSales: d?.recentSales ?? [],
      carteraData: d?.carteraStatus ?? [
        { name: "Pagado", value: 0, color: "#10b981" },
        { name: "Abonado", value: 0, color: "#3b82f6" },
        { name: "Pendiente", value: 0, color: "#f59e0b" },
      ],
    };
  }, [dashboardData]);

  const CARTERA_COLORS = ["#10b981", "#3b82f6", "#f59e0b"];

  return (
    <div className="space-y-8 pb-8">
      {/* Header Premium con Gradient */}
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 shadow-2xl z-10">
        {/* Capa de fondo con overflow-hidden para no recortar el contenido interactivo como el Datepicker */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl z-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500 rounded-full mix-blend-screen filter blur-[80px] opacity-40"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-[80px] opacity-40"></div>
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 drop-shadow-sm flex items-center gap-3">
              Panel de Control
            </h1>
            <p className="text-blue-100/80 text-sm mt-2 max-w-xl font-medium">
              Supervisa el rendimiento financiero y operativo en tiempo real. Todos los indicadores estratégicos de tu agencia, en un solo vistazo.
            </p>
          </div>
          <div className="flex items-center bg-white/10 backdrop-blur-md p-1.5 rounded-xl shadow-inner border border-white/20">
            <div className="w-72">
              <Datepicker
                value={dateRange as any}
                onChange={(newValue: any) => setDateRange(newValue)}
                showShortcuts={true}
                primaryColor={"indigo"}
                displayFormat={"DD/MMM/YYYY"}
                placeholder={"Selecciona un periodo"}
                separator={" - "}
                inputClassName="w-full text-sm font-semibold text-white bg-transparent border-none py-2 px-4 cursor-pointer focus:ring-0 placeholder-white/60"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modern Glassmorphism KPIs */}
      {dashboardLoading && !dashboardData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-2xl h-[140px]"></div>
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
              icon: <DollarSign size={24} />,
              gradient: "from-emerald-500 to-teal-400",
              lightBg: "bg-emerald-50 text-emerald-600",
            },
            {
              label: "CRÉDITO",
              value: formatCurrency(stats.totalPendiente),
              subtitle: "Cuentas por Cobrar",
              detail: `${stats.PendienteCount} cuentas`,
              icon: <CreditCard size={24} />,
              gradient: "from-orange-500 to-amber-400",
              lightBg: "bg-orange-50 text-orange-600",
              onClick: () => setIsCreditModalOpen(true),
            },
            {
              label: "PROVEEDORES",
              value: formatCurrency(stats.totalProveedores),
              subtitle: "Costos Operativos",
              detail: `${stats.supplierCount} activos`,
              icon: <Briefcase size={24} />,
              gradient: "from-rose-500 to-pink-400",
              lightBg: "bg-rose-50 text-rose-600",
            },
            {
              label: "CLIENTES",
              value: stats.totalClients,
              subtitle: "Total Registrados",
              detail: `${stats.activeClients} Activos`,
              icon: <Users size={24} />,
              gradient: "from-blue-600 to-indigo-500",
              lightBg: "bg-indigo-50 text-indigo-600",
            },
            {
              label: "TIQUETES AÉREOS",
              value: stats.totalFlights,
              subtitle: "Tramos Emitidos",
              icon: <Plane size={24} />,
              gradient: "from-cyan-500 to-blue-400",
              lightBg: "bg-cyan-50 text-cyan-600",
            },
            {
              label: "HOTELES",
              value: stats.hotelesCount,
              subtitle: "Reservas Generadas",
              detail: formatCurrency(stats.hotelesIngresos),
              icon: <Building size={24} />,
              gradient: "from-violet-500 to-purple-400",
              lightBg: "bg-violet-50 text-violet-600",
            },
            {
              label: "SEGUROS",
              value: stats.segurosCount,
              subtitle: "Pólizas Activas",
              detail: formatCurrency(stats.segurosIngresos),
              icon: <ShieldCheck size={24} />,
              gradient: "from-fuchsia-500 to-pink-500",
              lightBg: "bg-fuchsia-50 text-fuchsia-600",
            },
            {
              label: "PAQUETES",
              value: stats.planesCount,
              subtitle: "Paquetes Turísticos",
              detail: formatCurrency(stats.planesIngresos),
              icon: <Map size={24} />,
              gradient: "from-amber-500 to-yellow-400",
              lightBg: "bg-amber-50 text-amber-600",
            },
          ].map((kpi, i) => (
            <div
              key={i}
              onClick={kpi.onClick}
              className={`relative group bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden ${
                kpi.onClick ? "cursor-pointer hover:border-orange-200" : ""
              }`}
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${kpi.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[13px] font-black text-gray-700 uppercase tracking-widest">
                    {kpi.label}
                  </p>
                  <div className={`p-3 rounded-2xl ${kpi.lightBg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    {kpi.icon}
                  </div>
                </div>
                <h3 className="text-3xl font-black text-gray-800 mb-1 tracking-tight">
                  {kpi.value}
                </h3>
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-700 font-semibold truncate">
                    {kpi.subtitle}
                  </span>
                  {kpi.detail && (
                    <span className="text-[10px] font-bold text-gray-600 bg-gray-100/80 px-2 py-1 rounded-lg whitespace-nowrap shadow-sm">
                      {kpi.detail}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Advanced Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-blue-50 rounded-full blur-3xl"></div>
          <h2 className="text-lg font-black text-gray-800 mb-6">Comparativa de Ingresos</h2>
          <div className="h-72 w-full">
            {dashboardLoading && !dashboardData ? (
              <div className="w-full h-full bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.yearlyTrendData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} 
                    tickFormatter={(v) => {
                      if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
                      return `$${v}`;
                    }} 
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)} 
                    contentStyle={{ borderRadius: "16px", border: "1px solid #f1f5f9", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)", padding: "12px", fontWeight: "bold" }} 
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: 600, paddingTop: "20px" }} />
                  <Area type="monotone" dataKey="current" name="Año Actual" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorCurrent)" activeDot={{ r: 8, fill: "#4f46e5", stroke: "#fff", strokeWidth: 3, className: "drop-shadow-md" }} />
                  <Area type="monotone" dataKey="previous" name="Año Anterior" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPrev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 flex flex-col">
          <h2 className="text-lg font-black text-gray-800 mb-2">Estado de Cartera</h2>
          <div className="flex-grow flex flex-col justify-center">
            <div className="relative h-56 flex items-center justify-center">
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
                  <span className="text-[10px] uppercase font-extrabold text-gray-400 tracking-[0.2em] mb-1">Total</span>
                  <span className="text-xl font-black text-gray-800 bg-clip-text text-transparent bg-gradient-to-br from-gray-800 to-gray-500">{formatCurrency(stats.totalIngresos)}</span>
                </div>
              )}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {dashboardLoading && !dashboardData ? (
                <></>
              ) : (
                stats.carteraData.map((item: any, i: number) => (
                  <div key={i} className="flex flex-col items-center justify-center py-3 px-1 bg-gray-50/80 rounded-xl border border-gray-100/50 shadow-inner">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: CARTERA_COLORS[i] }} />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{item.name}</span>
                    </div>
                    <span className="text-sm font-black text-gray-800">{item.value}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modern Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-black text-gray-800">Últimas Ventas Aprobadas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white text-left text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Asesor</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Monto Total</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dashboardLoading && !dashboardData ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse bg-white">
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 rounded-md w-3/4"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 rounded-md w-1/2"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 rounded-md w-1/3"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-gray-100 rounded-md w-1/2"></div></td>
                    <td className="px-6 py-5"><div className="h-6 bg-gray-100 rounded-xl w-20"></div></td>
                  </tr>
                ))
              ) : (
                stats.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-gray-700">{sale.clientName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{sale.asesorName}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(sale.date)}</td>
                    <td className="px-6 py-4 font-black text-gray-800">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm ${
                          sale.status === "pagado"
                            ? "bg-green-100/80 text-green-700 border border-green-200/50"
                            : sale.status === "abonado"
                              ? "bg-blue-100/80 text-blue-700 border border-blue-200/50"
                              : "bg-orange-100/80 text-orange-700 border border-orange-200/50"
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
            <div className="p-5 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="p-3 bg-rose-500 text-white rounded-xl shadow-md shadow-rose-200">
                <Briefcase size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest mb-1">
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
            <div className="p-5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-200">
                <DollarSign size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest mb-1">
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
