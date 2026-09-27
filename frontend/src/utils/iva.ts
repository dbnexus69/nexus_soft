// Espejo de TASA_IVA en backend/src/services/saleTotals.js. Cambiar los dos
// juntos. El IVA que calcula esta función es una vista previa mientras se
// cotiza: el que se guarda siempre lo recalcula el servidor a partir de la
// TA, nunca el que mande el navegador (spec 003).
export const TASA_IVA = 0.19;

export function calcularIva(ta: number): number {
  return Math.round((ta || 0) * TASA_IVA * 100) / 100;
}
