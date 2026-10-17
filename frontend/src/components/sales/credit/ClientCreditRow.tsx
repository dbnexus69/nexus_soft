import { memo, useEffect, useRef, useState } from 'react';
import { SKELETON } from '../../ui/Skeleton';
import { ChevronRight, Mail, MessageCircle, Phone, UserRound, Wallet } from 'lucide-react';
import * as api from '../../../api';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { AgingBar } from './AgingBar';
import { TRAMO, textoVencimiento, type Aging, type Tramo } from './aging';
import { N_COLUMNAS } from './tabla';
import type { CreditoACobrar } from './CollectPaymentDialog';

export interface ClienteEnCartera {
  client: { id: number; name: string; docNumber?: string | null; email?: string | null; phone?: string | null };
  pendingAmount: number;
  overdueAmount: number;
  daysOverdue: number;
  activeCredits: number;
  nextDueDate: string | null;
  aging: Aging;
  agingBucket: Tramo;
}

export interface Credito {
  saleId: number;
  /** El número de la venta en la agencia; `saleId` es el id global y no se muestra. */
  numero?: number | null;
  advisor?: { id: number; name: string | null } | null;
  lastPayment?: { date: string; amount: number } | null;
  dueDate: string | null;
  total: number;
  paidAmount: number;
  pendingAmount: number;
  daysOverdue: number;
  agingBucket: Tramo;
}

interface ClientCreditRowProps {
  fila: ClienteEnCartera;
  abierta: boolean;
  onAlternar: (clientId: number) => void;
  /** Si puede cobrar una venta, por el asesor que la atendió (spec 020). */
  puedeCobrar: (asesorId?: number | null) => boolean;
  onCobrar: (credito: CreditoACobrar) => void;
  /** Cambia tras cada cobro para que el desplegable abierto se recargue. */
  tokenRefresco: number;
  /** Con alcance "solo las suyas" todas son del mismo asesor: no hace falta decirlo. */
  mostrarAsesor: boolean;
}

/**
 * Enlace de WhatsApp. ponytail: un móvil colombiano de 10 dígitos (3xx) recibe el 57;
 * otro número sin "+" se usa tal cual. Si hay clientes de otros países sin "+", habría
 * que guardar el indicativo aparte.
 */
function enlaceWhatsApp(telefono: string) {
  const digitos = telefono.replace(/\D/g, '');
  const conPais = !telefono.trim().startsWith('+') && /^3\d{9}$/.test(digitos) ? `57${digitos}` : digitos;
  return `https://wa.me/${conPais}`;
}

const ENLACE_CONTACTO = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-accent dark:hover:text-accent';

const CELDA_DINERO = 'px-3 py-2.5 text-right tabular-nums whitespace-nowrap';

export const ClientCreditRow = memo(function ClientCreditRow({
  fila,
  abierta,
  onAlternar,
  puedeCobrar,
  onCobrar,
  tokenRefresco,
  mostrarAsesor,
}: ClientCreditRowProps) {
  const [creditos, setCreditos] = useState<Credito[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const peticion = useRef(0);

  // Los créditos se piden solo al abrir la fila, no con el listado: la mayoría
  // de las filas nunca se abren, y pedirlos todos por adelantado sería una
  // petición por cliente para nada.
  useEffect(() => {
    if (!abierta) return;
    const mia = ++peticion.current;
    setCargando(true);
    api.getClientCredits(fila.client.id, { perPage: 50 })
      .then((res) => {
        if (mia !== peticion.current) return;
        setCreditos(res?.data || []);
      })
      .catch(() => { if (mia === peticion.current) setCreditos([]); })
      .finally(() => { if (mia === peticion.current) setCargando(false); });
  }, [abierta, fila.client.id, tokenRefresco]);

  const tramo = TRAMO[fila.agingBucket];
  const vencimiento = textoVencimiento(fila.nextDueDate, fila.daysOverdue);

  return (
    <>
      <tr className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
        <td className="px-3 py-1">
          {/* Un botón de verdad, no un `onClick` en la fila: el desplegable tiene
              que poder abrirse con el teclado y anunciar su estado. */}
          <button
            type="button"
            onClick={() => onAlternar(fila.client.id)}
            aria-expanded={abierta}
            className="flex w-full items-center gap-2 rounded py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ChevronRight
              size={14}
              className={`shrink-0 text-slate-500 transition-transform ${abierta ? 'rotate-90' : ''}`}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900 dark:text-white">
                {fila.client.name}
              </span>
              {fila.client.docNumber && (
                <span className="block truncate text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {fila.client.docNumber}
                </span>
              )}
            </span>
          </button>
        </td>

        <td className={`${CELDA_DINERO} text-slate-500 dark:text-slate-400`}>
          {fila.activeCredits}
        </td>

        <td className={CELDA_DINERO}>
          {fila.overdueAmount > 0 ? (
            <span className={`font-semibold ${tramo.texto}`}>
              {formatCurrency(fila.overdueAmount)}
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-600">—</span>
          )}
        </td>

        <td className={`${CELDA_DINERO} font-semibold text-slate-900 dark:text-white`}>
          {formatCurrency(fila.pendingAmount)}
        </td>

        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tramo.insignia}`}>
            {fila.daysOverdue > 0 ? `${fila.daysOverdue} d` : tramo.corto}
          </span>
        </td>

        <td className="w-40 px-3 py-2.5">
          <AgingBar aging={fila.aging} />
          {/* Solo cuando no hay mora: con mora, la columna Mora ya dice los días
              y repetirlo aquí es la misma cifra dos veces en la misma fila. */}
          {fila.daysOverdue === 0 && vencimiento && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Vence {vencimiento}
            </div>
          )}
        </td>
      </tr>

      {abierta && (
        <tr className="bg-slate-50/60 dark:bg-slate-900/40">
          <td colSpan={N_COLUMNAS} className="px-3 pb-4 pt-1">
            {(fila.client.phone || fila.client.email) && (
              <div className="flex flex-wrap items-center gap-2 py-2 pl-6">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Contactar:</span>
                {fila.client.phone && (
                  <>
                    <a href={`tel:${fila.client.phone.replace(/[^\d+]/g, '')}`} className={ENLACE_CONTACTO}>
                      <Phone size={14} aria-hidden /> <span className="tabular-nums">{fila.client.phone}</span>
                    </a>
                    <a
                      href={enlaceWhatsApp(fila.client.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir WhatsApp con ${fila.client.name} (se abre en otra pestaña)`}
                      className={ENLACE_CONTACTO}
                    >
                      <MessageCircle size={14} aria-hidden /> WhatsApp
                    </a>
                  </>
                )}
                {fila.client.email && (
                  <a href={`mailto:${fila.client.email}`} className={`${ENLACE_CONTACTO} min-w-0`}>
                    <Mail size={14} aria-hidden /> <span className="truncate">{fila.client.email}</span>
                  </a>
                )}
              </div>
            )}
            {cargando && !creditos ? (
              <div className="space-y-2 py-2">
                {[0, 1].map(i => (
                  <div key={i} className={`${SKELETON} h-9`} />
                ))}
              </div>
            ) : creditos && creditos.length > 0 ? (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {creditos.map(c => {
                  const t = TRAMO[c.agingBucket];
                  const sinFecha = c.agingBucket === 'undated';
                  return (
                    <div
                      key={c.saleId}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 pl-6 text-sm"
                    >
                      <span className="w-20 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        Venta #{c.numero ?? '—'}
                      </span>

                      {mostrarAsesor && (
                        <span
                          className="flex w-40 min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
                          title={c.advisor?.name ? `Atendió: ${c.advisor.name}` : undefined}
                        >
                          <UserRound size={13} className="shrink-0" aria-hidden />
                          <span className="truncate">{c.advisor?.name ? `Atendió: ${c.advisor.name}` : 'Sin asesor'}</span>
                        </span>
                      )}

                      <span className={`w-48 text-xs ${sinFecha ? t.texto : 'text-slate-500 dark:text-slate-400'}`}>
                        {sinFecha
                          ? 'Sin fecha de vencimiento: no se puede reclamar'
                          : `${c.daysOverdue > 0 ? 'Venció el' : 'Vence el'} ${formatDate(c.dueDate || '')}`}
                      </span>

                      <span className="flex w-44 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Wallet size={13} className="shrink-0" aria-hidden />
                        {c.lastPayment
                          ? <span>Último abono: {formatDate(c.lastPayment.date)} · <span className="tabular-nums">{formatCurrency(c.lastPayment.amount)}</span></span>
                          : <span>Sin abonos</span>}
                      </span>

                      <span className="flex-1 min-w-[10rem] text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {formatCurrency(c.pendingAmount)}
                        <span className="text-slate-500 dark:text-slate-500">
                          {' '}de {formatCurrency(c.total)}
                        </span>
                      </span>

                      {puedeCobrar(c.advisor?.id) && (
                        <button
                          type="button"
                          onClick={() => onCobrar({ saleId: c.saleId, numero: c.numero, pendingAmount: c.pendingAmount })}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-200 dark:hover:border-accent dark:hover:text-accent"
                        >
                          Cobrar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-3 pl-6 text-sm text-slate-500 dark:text-slate-400">
                No se pudieron cargar los créditos de este cliente.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
});
