// Espejo de TASA_IVA en backend/src/services/saleTotals.js. Cambiar los dos
// juntos. El IVA que calcula esta función es una vista previa mientras se
// cotiza: el que se guarda siempre lo recalcula el servidor a partir de la
// TA, nunca el que mande el navegador (spec 003).
export const TASA_IVA = 0.19;

// Por servicio, no por venta/cotización entera (spec 041); por defecto `true`, igual que siempre.
export function calcularIva(ta: number, incluyeIva: boolean = true): number {
  if (!incluyeIva) return 0;
  return Math.round((ta || 0) * TASA_IVA * 100) / 100;
}
