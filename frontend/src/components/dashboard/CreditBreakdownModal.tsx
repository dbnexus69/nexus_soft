import { useEffect, useRef, useState } from 'react';
import { SKELETON } from '../ui/Skeleton';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { SegmentedBar, type Segmento } from '../ui/SegmentedBar';
import * as api from '../../api';
import { formatCurrency } from '../../utils/formatters';

interface Proveedor {
  id: number | null;
  name: string | null;
  pending: number;
  salesCount: number;
}

interface Desglose {
  pending: number;
  composition: { supplier: number; agency: number; unclassified: number };
  salesCount: number;
  salesWithoutBreakdown: number;
  suppliersCount: number;
  suppliers: Proveedor[];
}

interface ClienteDeudor {
  client: { id: number; name: string };
  pendingAmount: number;
  overdueAmount: number;
  activeCredits: number;
}

interface CreditBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mismo rango que el dashboard, para que las cifras coincidan. */
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Las tres partes del pendiente.
 *
 * No son una escala como los tramos de antigüedad: son tres cosas distintas
 * según de quién sea el dinero. El coste de proveedor es un neutro —no es un
 * problema, es dinero de paso—, el margen lleva el acento porque es la única
 * parte que se queda la oficina, y lo no desglosado va en ámbar, que en esta
 * interfaz ya significa "esto hay que atenderlo".
 */
const PARTES = [
  {
    clave: 'supplier' as const,
    titulo: 'Para los proveedores',
    apoyo: 'Coste de servicios ya comprados que habrá que pagarles.',
    barra: 'bg-slate-400 dark:bg-slate-500',
    punto: 'bg-slate-400 dark:bg-slate-500',
    texto: 'text-slate-700 dark:text-slate-200',
  },
  {
    clave: 'agency' as const,
    titulo: 'Margen de la agencia',
    apoyo: 'La única parte que se queda la oficina cuando se cobre.',
    barra: 'bg-highlight',
    punto: 'bg-highlight',
    texto: 'text-highlight-ink dark:text-highlight',
  },
  {
    clave: 'unclassified' as const,
    titulo: 'Sin desglosar',
    apoyo: 'Ventas cuyo precio se guardó sin separar coste y margen.',
    barra: 'bg-amber-400 dark:bg-amber-500/80',
    punto: 'bg-amber-400 dark:bg-amber-500/80',
    texto: 'text-amber-700 dark:text-amber-300',
  },
];

const FILA = 'flex items-baseline justify-between gap-4 py-2.5';
const IMPORTE = 'shrink-0 tabular-nums font-semibold';

export function CreditBreakdownModal({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
}: CreditBreakdownModalProps) {
  const [desglose, setDesglose] = useState<Desglose | null>(null);
  const [deudores, setDeudores] = useState<ClienteDeudor[]>([]);
  const [cargando, setCargando] = useState(false);
  const peticion = useRef(0);

  // Se pide al abrir, no con el dashboard: es el detalle de una cifra y la
  // mayoría de las visitas al panel no lo abren.
  //
  // Los clientes salen de `/sales/credit`, la MISMA fuente que la pantalla de
  // cartera. Calcularlos aquí aparte sería una segunda implementación de la
  // misma agregación, y las dos pantallas acabarían discrepando.
  useEffect(() => {
    if (!isOpen) return;
    const mia = ++peticion.current;
    setCargando(true);
    Promise.all([
      api.getCreditBreakdown({ dateFrom, dateTo, limit: 6 }),
      api.getCreditPortfolio({ perPage: 5, sortBy: 'pending', sortOrder: 'desc' }),
    ])
      .then(([d, cartera]: [Desglose, any]) => {
        if (mia !== peticion.current) return;
        setDesglose(d);
        setDeudores(cartera?.data || []);
      })
      .catch(() => {
        if (mia === peticion.current) { setDesglose(null); setDeudores([]); }
      })
      .finally(() => { if (mia === peticion.current) setCargando(false); });
  }, [isOpen, dateFrom, dateTo]);

  const c = desglose?.composition;
  const partesConDinero = c ? PARTES.filter(p => c[p.clave] > 0) : [];
  const segmentos: Segmento[] = partesConDinero.map(p => ({
    clave: p.clave,
    valor: c![p.clave],
    color: p.barra,
    etiqueta: `${p.titulo}: ${formatCurrency(c![p.clave])}`,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="De quién es el dinero por cobrar" size="lg">
      <div className="px-1 py-1">
        {cargando && !desglose ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`${SKELETON} h-10`} />
            ))}
          </div>
        ) : !desglose ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No se pudo cargar el desglose. Vuelve a abrirlo en un momento.
          </p>
        ) : desglose.pending <= 0 ? (
          <div className="py-10 text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              No hay nada por cobrar
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Toda la cartera está liquidada en este periodo.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {/* La cifra y su reparto: el único elemento con peso visual. */}
            <div>
              <p className="font-heading text-3xl font-semibold tabular-nums text-primary dark:text-white">
                {formatCurrency(desglose.pending)}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                pendiente en {desglose.salesCount}{' '}
                {desglose.salesCount === 1 ? 'venta a crédito' : 'ventas a crédito'}
              </p>
              <SegmentedBar
                segmentos={segmentos}
                grosor="gruesa"
                titulo="Reparto de lo pendiente"
                className="mt-4"
              />
            </div>

            <dl className="divide-y divide-slate-200 dark:divide-slate-800">
              {partesConDinero.map(p => (
                <div key={p.clave} className={FILA}>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${p.punto}`} aria-hidden />
                      {p.titulo}
                    </dt>
                    <p className="mt-0.5 pl-4 text-xs text-slate-500 dark:text-slate-400">
                      {p.apoyo}
                      {p.clave === 'unclassified' && desglose.salesWithoutBreakdown > 0 && (
                        <> Son {desglose.salesWithoutBreakdown}{' '}
                        {desglose.salesWithoutBreakdown === 1 ? 'venta' : 'ventas'}.</>
                      )}
                    </p>
                  </div>
                  <dd className={`${IMPORTE} ${p.texto}`}>{formatCurrency(c![p.clave])}</dd>
                </div>
              ))}
            </dl>

            {/* Dos listas, no dos tarjetas: son rankings, y lo que se compara
                es la columna de importes. */}
            {desglose.suppliers.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  A quién se le debe más
                </h3>
                {desglose.suppliers.length < desglose.suppliersCount && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Los {desglose.suppliers.length} mayores de {desglose.suppliersCount} proveedores.
                  </p>
                )}
                <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                  {desglose.suppliers.map(p => (
                    <li key={p.id ?? 'sin-proveedor'} className={FILA}>
                      <div className="min-w-0">
                        <span className="block truncate text-sm text-slate-800 dark:text-slate-100">
                          {p.name || 'Sin proveedor asignado'}
                        </span>
                        {!p.id && (
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            Estas líneas de venta no dicen a quién se le compró el servicio.
                          </span>
                        )}
                      </div>
                      <span className={`${IMPORTE} text-slate-700 dark:text-slate-200`}>
                        {formatCurrency(p.pending)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {deudores.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Quién debe más
                </h3>
                <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                  {deudores.map(d => (
                    <li key={d.client.id} className={FILA}>
                      <div className="min-w-0">
                        <span className="block truncate text-sm text-slate-800 dark:text-slate-100">
                          {d.client.name}
                        </span>
                        {d.overdueAmount > 0 && (
                          <span className="text-xs text-rose-600 dark:text-rose-400">
                            {formatCurrency(d.overdueAmount)} en mora
                          </span>
                        )}
                      </div>
                      <span className={`${IMPORTE} text-slate-700 dark:text-slate-200`}>
                        {formatCurrency(d.pendingAmount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Un cierre que lleva a algún sitio. El anterior era un botón
                "Entendido" que solo cerraba la ventana. */}
            <Link
              to="/sales?tab=credit"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline dark:text-accent"
            >
              Ir a la cartera para cobrar
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </Modal>
  );
}
