import { useMemo } from "react";
import { useData } from "../context/DataContext";

export function useDashboardStats() {
  const { dashboardData } = useData();

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
        const apiMonth = d?.monthlyTrend?.find((m: any) => m.month === monthNum);
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

  return stats;
}
