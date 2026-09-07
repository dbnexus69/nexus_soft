import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import * as api from '../../api';
import { usePermissions } from '../../context/PermissionsContext';
import { useSalesContext } from '../../context/SalesContext';
import { useData } from '../../context/DataContext';
import { formatCurrency } from '../../utils/formatters';
import { Pagination } from '../ui/Pagination';
import { AgingBar } from './credit/AgingBar';
import { ClientCreditRow, type ClienteEnCartera } from './credit/ClientCreditRow';
import { CollectPaymentDialog, type CreditoACobrar } from './credit/CollectPaymentDialog';
import { AGING_VACIO, TRAMOS, TRAMO, type Aging, type Tramo } from './credit/aging';

const PER_PAGE = 12;

/** Filtros de la cabecera. `overdue` agrupa los cuatro tramos de mora. */
const FILTROS: { valor: string; etiqueta: string }[] = [
  { valor: 'all', etiqueta: 'Todos' },
  { valor: 'overdue', etiqueta: 'En mora' },
  { valor: 'current', etiqueta: 'Corriente' },
  { valor: 'undated', etiqueta: 'Sin fecha' },
];

const TOTALES_VACIOS = {
  clientsCount: 0,
  totalPending: 0,
  totalOverdue: 0,
  maxDaysOverdue: 0,
  aging: AGING_VACIO as Aging,
  bucketCounts: AGING_VACIO as Record<Tramo, number>,
};

/**
 * Cartera y cobros.
 *
 * La forma viene del informe de antigüedad, que es como se mira una cartera en
 * cobranza: importes alineados con numerales tabulares, filas regladas y los
 * tramos de mora como columnas. El diseño anterior era el kit de tarjetas
 * —una tarjeta por fila con su sombra, un icono idéntico repetido en todas,
 * rótulos en mayúsculas espaciadas y un panel lateral que repetía la fila en
 * cuatro cajas grises—, y sobre todo era un informe pasivo: para registrar un
 * cobro había que salir a la lista de ventas y abrir el modal de edición.
 *
 * Tres decisiones que lo sostienen:
 *
 * - Las cifras exactas de cada tramo viven UNA vez, en el resumen de arriba.
 *   Repetirlas por fila serían nueve columnas de números; en la fila va la
 *   barra, que dice la forma de la deuda sin cifras.
 * - La fila se despliega en su sitio en vez de pintar un panel al lado: el ojo
 *   se queda donde hizo clic, y es el patrón del detalle de venta.
 * - El color solo codifica antigüedad, y solo el tramo de más de 90 días llega
 *   a saturarse. Antes competían rojo, naranja, amarillo y el color de marca.
 */
export default function CreditDashboard() {
  const { canEdit } = usePermissions();
  // Cobrar es editar la venta: mismo permiso, decidido así a propósito.
  const puedeCobrar = canEdit('sales');

  // Un cobro no solo mueve la cartera: cambia la venta en el listado y las
  // cifras de crédito del panel. Sin avisarles, la pantalla de cartera se
  // actualizaba y el resto de la aplicación seguía mostrando el importe viejo.
  const { fetchSales } = useSalesContext();
  const { invalidateDashboard } = useData();

  const [filtro, setFiltro] = useState('all');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);

  const [clientes, setClientes] = useState<ClienteEnCartera[]>([]);
  const [totales, setTotales] = useState(TOTALES_VACIOS);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [cargando, setCargando] = useState(true);

  const [abierta, setAbierta] = useState<number | null>(null);
  const [cobrando, setCobrando] = useState<CreditoACobrar | null>(null);
  const [tokenRefresco, setTokenRefresco] = useState(0);

  useEffect(() => { setPage(1); }, [busqueda, filtro]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const t = setTimeout(() => {
      api.getCreditPortfolio({
        page,
        perPage: PER_PAGE,
        search: busqueda.trim() || undefined,
        bucket: filtro !== 'all' ? filtro : undefined,
      })
        .then((res: any) => {
          if (!vivo) return;
          setClientes(res?.data || []);
          setMeta({ total: res?.meta?.total || 0, totalPages: res?.meta?.totalPages || 0 });
          setTotales({ ...TOTALES_VACIOS, ...(res?.meta?.totals || {}) });
        })
        .catch(() => { if (vivo) setClientes([]); })
        .finally(() => { if (vivo) setCargando(false); });
    }, busqueda ? 300 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [page, busqueda, filtro, tokenRefresco]);

  const alternar = useCallback((clientId: number) => {
    setAbierta(actual => (actual === clientId ? null : clientId));
  }, []);

  const alCobrar = useCallback(() => {
    setTokenRefresco(n => n + 1);
    fetchSales();
    invalidateDashboard();
  }, [fetchSales, invalidateDashboard]);

  // Los tramos con dinero, para no pintar columnas en cero en el resumen.
  const tramosConDinero = useMemo(
    () => TRAMOS.filter(t => (totales.aging[t] || 0) > 0),
    [totales.aging],
  );

  const sinResultados = !cargando && clientes.length === 0;

  return (
    <div className="animate-fade-in space-y-5">
      {/* ── Resumen: las dos cifras que importan, y el informe de antigüedad ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-heading text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(totales.totalPending)}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              por cobrar a {totales.clientsCount}{' '}
              {totales.clientsCount === 1 ? 'cliente' : 'clientes'}
            </p>
          </div>

          {totales.totalOverdue > 0 && (
            <div className="text-right">
              <p className="font-heading text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrency(totales.totalOverdue)}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                en mora, hasta {totales.maxDaysOverdue}{' '}
                {totales.maxDaysOverdue === 1 ? 'día' : 'días'} de atraso
              </p>
            </div>
          )}
        </div>

        {tramosConDinero.length > 0 && (
          <div className="mt-5">
            <AgingBar aging={totales.aging} grosor="gruesa" />
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              {tramosConDinero.map(t => (
                <div key={t} className="flex items-baseline gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${TRAMO[t].barra}`}
                    aria-hidden
                  />
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{TRAMO[t].corto}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    {formatCurrency(totales.aging[t])}
                  </dd>
                </div>
              ))}
            </dl>
            {totales.aging.undated > 0 && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                {formatCurrency(totales.aging.undated)} sin fecha de vencimiento. Esa deuda no
                vence nunca, así que no entra en ningún tramo ni en ninguna alerta.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="relative w-full sm:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
              aria-hidden
            />
            <input
              placeholder="Buscar cliente, documento o venta"
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-8 text-sm text-slate-700 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {FILTROS.map(f => {
              const activo = filtro === f.valor;
              const cifra = f.valor === 'all'
                ? totales.clientsCount
                : f.valor === 'overdue'
                  ? (['days1_30', 'days31_60', 'days61_90', 'days90plus'] as Tramo[])
                      .reduce((s, t) => s + (totales.bucketCounts[t] || 0), 0)
                  : totales.bucketCounts[f.valor as Tramo] || 0;
              return (
                <button
                  key={f.valor}
                  onClick={() => setFiltro(f.valor)}
                  aria-pressed={activo}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    activo
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {f.etiqueta}{' '}
                  <span className="tabular-nums opacity-60">{cifra}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="text-xs font-medium text-slate-500 dark:text-slate-400">
                <th scope="col" className="px-3 py-2 text-left">Cliente</th>
                <th scope="col" className="px-3 py-2 text-right">Créditos</th>
                <th scope="col" className="px-3 py-2 text-right">Vencido</th>
                <th scope="col" className="px-3 py-2 text-right">Pendiente</th>
                <th scope="col" className="px-3 py-2 text-left">Mora</th>
                <th scope="col" className="px-3 py-2 text-left">Antigüedad</th>
              </tr>
            </thead>
            <tbody>
              {cargando && clientes.length === 0 ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
                    <td colSpan={6} className="px-3 py-3">
                      <div className="h-6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : sinResultados ? (
                <tr className="border-t border-slate-200 dark:border-slate-800">
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {busqueda.trim()
                        ? 'Ningún cliente coincide con la búsqueda'
                        : filtro === 'all'
                          ? 'No hay nada por cobrar'
                          : `Ningún cliente en ${FILTROS.find(f => f.valor === filtro)?.etiqueta.toLowerCase()}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {busqueda.trim()
                        ? 'Prueba con el documento o el número de venta.'
                        : filtro === 'all'
                          ? 'Toda la cartera está al día.'
                          : 'Prueba con otro tramo.'}
                    </p>
                  </td>
                </tr>
              ) : (
                clientes.map(fila => (
                  <ClientCreditRow
                    key={fila.client.id}
                    fila={fila}
                    abierta={abierta === fila.client.id}
                    onAlternar={alternar}
                    puedeCobrar={puedeCobrar}
                    onCobrar={setCobrando}
                    tokenRefresco={tokenRefresco}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={meta.totalPages}
          total={meta.total}
          perPage={PER_PAGE}
          loading={cargando}
          onPageChange={setPage}
          className="border-t border-slate-200 px-4 py-3 dark:border-slate-800"
        />
      </div>

      <CollectPaymentDialog
        credito={cobrando}
        clientName={clientes.find(c => c.client.id === abierta)?.client.name || ''}
        onClose={() => setCobrando(null)}
        onCobrado={alCobrar}
      />
    </div>
  );
}
