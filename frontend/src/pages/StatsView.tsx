import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
} from "recharts";
import { formatCurrency } from "../utils/formatters";
import { Users, Award, PieChart as PieChartIcon, Loader2 } from "lucide-react";
import { getTopClients, getAsesorPerformance, getCategoryDistribution } from "../api/stats";

// --- Estilos Compartidos de Tooltip Premium ---
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-gray-100 dark:border-slate-700 rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] p-5 min-w-[200px]">
      {label && (
        <p className="text-sm font-black text-gray-800 dark:text-slate-100 mb-3 border-b border-gray-100 dark:border-slate-700 pb-2 tracking-tight">
          {label}
        </p>
      )}
      <div className="space-y-3">
        {payload.map((entry: any, index: number) => {
          const nameStr = (entry.name || "").toLowerCase();
          const isCount = nameStr.includes("cantidad") || nameStr.includes("vendidos");

          let displayValue = entry.value;
          if (!isCount) {
            displayValue = formatCurrency(entry.value);
          }

          return (
            <div
              key={index}
              className="flex items-center justify-between gap-6 text-xs font-semibold"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: entry.color || entry.fill }}
                />
                <span className="text-gray-500 dark:text-slate-400 uppercase tracking-wider">{entry.name || "Valor"}</span>
              </div>
              <span className="font-black text-gray-800 dark:text-slate-100 text-sm">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopClients() {
  const [data, setData] = useState<{ name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTopClients({ limit: 8 })
      .then((res) => {
        if (!cancelled) {
          setData((res as any[]).map((c: any) => ({
            name: c.name,
            total: c.total,
          })));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-[300px] w-full mt-2">
      {loading ? (
        <div className="h-full flex items-center justify-center text-blue-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-full mb-3">
            <Users className="w-6 h-6 text-gray-300 dark:text-slate-600" />
          </div>
          <span className="text-sm font-semibold">No hay clientes suficientes</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradientClient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} content={<CustomTooltip />} />
            <Bar
              dataKey="total"
              name="Total Invertido"
              radius={[0, 8, 8, 0] as any}
              barSize={24}
              background={{ fill: "rgba(148, 163, 184, 0.15)", radius: [0, 8, 8, 0] as any }}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill="url(#gradientClient)" className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-sm" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function TopAsesores() {
  const [data, setData] = useState<{ name: string; total: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAsesorPerformance()
      .then((res) => {
        if (!cancelled) {
          const mapped = (res as any[])
            .map((a: any) => ({
              name: a.asesorName,
              total: a.totalIngresos,
              count: a.totalVentas,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);
          setData(mapped);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="h-[340px] w-full mt-4">
      {loading ? (
        <div className="h-full flex items-center justify-center text-amber-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-full mb-3">
            <Award className="w-6 h-6 text-gray-300 dark:text-slate-600" />
          </div>
          <span className="text-sm font-semibold">No hay ventas de asesores registradas</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradientAsesor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b", fontWeight: 700 }} dy={10} />
            <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
            <Legend wrapperStyle={{ fontSize: "12px", fontWeight: 700, paddingTop: "20px" }} iconType="circle" />
            <Bar yAxisId="left" dataKey="total" name="Ingresos Generados" fill="url(#gradientAsesor)" radius={[8, 8, 0, 0] as any} maxBarSize={50} className="hover:opacity-90 drop-shadow-sm transition-opacity cursor-pointer" />
            <Line yAxisId="right" type="monotone" dataKey="count" name="Ventas (Cantidad)" stroke="#10b981" strokeWidth={4} dot={{ r: 6, strokeWidth: 3, fill: "#fff", className: "drop-shadow-md" }} activeDot={{ r: 8, fill: "#10b981", stroke: "#fff" }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function CategoryDistribution() {
  const [data, setData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCategoryDistribution()
      .then((res) => {
        if (!cancelled) {
          setData((res as any[]).filter((d: any) => d.value > 0));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#8b5cf6", "#f43f5e", "#f59e0b"];

  return (
    <div className="h-[300px] w-full mt-2">
      {loading ? (
        <div className="h-full flex items-center justify-center text-emerald-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
          <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-full mb-3">
            <PieChartIcon className="w-6 h-6 text-gray-300 dark:text-slate-600" />
          </div>
          <span className="text-sm font-semibold">No hay categorías registradas</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={85} outerRadius={110} paddingAngle={6} dataKey="value" stroke="none" cornerRadius={10}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="drop-shadow-sm hover:opacity-80 transition-opacity cursor-pointer" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", fontWeight: 700 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function StatsView() {
  return (
    <div className="space-y-8 pb-8 animate-fade-in">
      
      {/* Header Info Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800 dark:text-slate-100 flex items-center gap-3 tracking-tight">
            Análisis de Rendimiento
          </h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Métricas detalladas sobre la efectividad del equipo y las preferencias de los clientes.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 dark:bg-amber-500/10 rounded-full blur-3xl opacity-50 -z-10 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20 transition-colors duration-500"></div>
        <div className="p-8 border-b border-gray-50 dark:border-slate-700 flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20 rounded-2xl shadow-inner">
            <Award className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-800 dark:text-slate-100">Líderes de Ventas</h3>
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Ingresos vs Volumen Comercial</span>
          </div>
        </div>
        <div className="p-8 pt-4">
          <TopAsesores />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative group">
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-50 dark:bg-blue-500/10 rounded-full blur-3xl opacity-50 -z-10 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors duration-500"></div>
          <div className="p-8 border-b border-gray-50 dark:border-slate-700 flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl shadow-inner">
              <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-800 dark:text-slate-100">Top Clientes</h3>
              <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Mayor Inversión Acumulada</span>
            </div>
          </div>
          <div className="p-8 pt-4">
            <TopClients />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-50 dark:bg-emerald-500/10 rounded-full blur-3xl opacity-50 -z-10 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 transition-colors duration-500"></div>
          <div className="p-8 border-b border-gray-50 dark:border-slate-700 flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20 rounded-2xl shadow-inner">
              <PieChartIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-800 dark:text-slate-100">Distribución</h3>
              <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Participación por Categoría</span>
            </div>
          </div>
          <div className="p-8 pt-4">
            <CategoryDistribution />
          </div>
        </div>
      </div>
    </div>
  );
}
