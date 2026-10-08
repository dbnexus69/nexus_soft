import { useState, useEffect, type ReactNode } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Plane, Loader2, Phone, Mail, IdCard, CalendarDays, Receipt } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Responsable, Sale } from '../../types';
import { Pagination } from '../ui/Pagination';
import { listSales } from '../../api/sales';

interface ResponsableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  responsable: Responsable | null;
  responsableFlights: any[];
}

// El estado de una venta en palabras: antes salía el valor crudo ("credito").
const ESTADO_VENTA: Record<string, string> = {
  credito: 'En crédito', abonado: 'Abonado', pagado: 'Pagado', anulado: 'Anulada',
};

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

/** Un dato de contacto: etiqueta arriba, valor debajo; si falta, se dice. */
function Dato({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-3">
      <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true">{icono}</span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{etiqueta}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-slate-900 dark:text-white">{children}</dd>
      </div>
    </div>
  );
}

const sinDato = <span className="font-normal text-slate-400 dark:text-slate-500">Sin registrar</span>;

export default function ResponsableDetailModal({ isOpen, onClose, responsable, responsableFlights }: ResponsableDetailModalProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorVentas, setErrorVentas] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && responsable) {
      fetchSales();
    }
    // Dependencia primitiva: con el objeto en la lista basta con que el padre
    // pase una identidad nueva en un render para repetir la petición.
  }, [isOpen, responsable?.id, page]);

  useEffect(() => {
    if (!isOpen) {
      setPage(1);
      setSales([]);
      setErrorVentas(null);
    }
  }, [isOpen]);

  const fetchSales = async () => {
    if (!responsable) return;
    setIsLoading(true);
    setErrorVentas(null);
    try {
      const res = await listSales({
        responsableId: responsable.id,
        page,
        perPage: 5,
        sortOrder: 'desc',
        sortBy: 'creadoAt'
      });
      if (res && res.data) {
        setSales(res.data);
        if (res.meta) {
          setTotalPages(res.meta.totalPages || 1);
          setTotalRecords(res.meta.total || 0);
        }
      }
    } catch (e: any) {
      setErrorVentas(e?.response?.data?.error?.message || 'No se pudieron cargar sus ventas. Vuelve a abrir el detalle en un momento.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!responsable) return null;

  const activo = responsable.status === 'active';
  const deuda = responsable.deudaTotal || 0;
  const documento = [responsable.docType, responsable.docNumber].filter(Boolean).join(' ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle del responsable"
      size="xl"
      footer={<Button variant="outline" onClick={onClose}>Cerrar</Button>}
    >
      <div className="flex flex-col md:flex-row">
        {/* Identidad y cifras: lo que se busca al abrir el detalle. */}
        <aside className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/30 p-6 flex flex-col items-center text-center gap-4">
          <div
            className="w-24 h-24 rounded-full bg-primary/10 dark:bg-white/10 border-4 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-3xl font-bold text-primary dark:text-white"
            aria-hidden="true"
          >
            {iniciales(responsable.name)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{responsable.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Responsable de pago{responsable.numero ? ` · N.º ${String(responsable.numero).padStart(4, '0')}` : ''}
            </p>
          </div>
          <Badge variant={responsable.status}>{activo ? 'Activo' : 'Inactivo'}</Badge>

          <dl className="w-full grid grid-cols-2 md:grid-cols-1 gap-3 mt-2">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Deuda pendiente</dt>
              <dd className={`mt-1 text-xl font-bold tabular-nums ${deuda > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(deuda)}
              </dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">{deuda > 0 ? 'En ventas a crédito o abonadas' : 'Al día'}</dd>
            </div>
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ventas a su cargo</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{totalRecords}</dd>
            </div>
          </dl>
        </aside>

        <div className="w-full md:w-2/3 p-6 space-y-8">
          <section aria-labelledby="resp-contacto">
            <h3 id="resp-contacto" className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">Datos de contacto</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Dato icono={<IdCard size={18} />} etiqueta="Documento">{documento || sinDato}</Dato>
              <Dato icono={<Phone size={18} />} etiqueta="Teléfono">
                {responsable.phone
                  ? <a href={`tel:${responsable.phone}`} className="text-primary dark:text-sky-300 underline-offset-2 hover:underline">{responsable.phone}</a>
                  : sinDato}
              </Dato>
              <Dato icono={<Mail size={18} />} etiqueta="Correo">
                {responsable.email
                  ? <a href={`mailto:${responsable.email}`} className="text-primary dark:text-sky-300 underline-offset-2 hover:underline break-all">{responsable.email}</a>
                  : sinDato}
              </Dato>
              <Dato icono={<CalendarDays size={18} />} etiqueta="Registrado el">
                {responsable.creadoAt ? formatDate(responsable.creadoAt) : sinDato}
              </Dato>
            </dl>
          </section>

          <section aria-labelledby="resp-ventas" aria-busy={isLoading}>
            <h3 id="resp-ventas" className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">Ventas a su cargo</h3>
            <div className="min-h-[12rem]">
              {isLoading ? (
                <div role="status" className="flex items-center justify-center py-10 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="animate-spin mr-2" size={18} aria-hidden="true" />
                  Cargando ventas…
                </div>
              ) : errorVentas ? (
                <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">{errorVentas}</p>
              ) : sales.length > 0 ? (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-700/60">
                    <table className="w-full min-w-[28rem] text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-semibold">N.º</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Fecha</th>
                          <th scope="col" className="px-4 py-3 font-semibold text-right">Valor</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {sales.map(s => (
                          <tr key={s.id} className="bg-white dark:bg-slate-900">
                            <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">#{(s.numero ?? s.id).toString().padStart(4, '0')}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDate(s.date)}</td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(s.total)}</td>
                            <td className="px-4 py-3"><Badge variant={s.status}>{ESTADO_VENTA[s.status] || s.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3">
                    <Pagination
                      currentPage={page}
                      totalPages={totalPages}
                      total={totalRecords}
                      perPage={5}
                      onPageChange={setPage}
                      // Con pocas ventas hay una sola página y el paginador se ocultaría, total incluido.
                      alwaysShowRange
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-10 px-6 text-center">
                  <Receipt size={28} className="text-slate-300 dark:text-slate-600 mb-2" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aún no tiene ventas a su cargo</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Aparecerán aquí cuando se le asigne como responsable de pago en una venta.</p>
                </div>
              )}
            </div>
          </section>

          {responsableFlights.length > 0 && (
            <section aria-labelledby="resp-vuelos">
              <h3 id="resp-vuelos" className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">
                Vuelos ({responsableFlights.length})
              </h3>
              <ul className="space-y-2">
                {responsableFlights.map(flight => {
                  const ida = flight.type === 'ida';
                  const hecho = flight.checkin === 'realizado';
                  return (
                    <li key={flight.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900 px-4 py-3 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <Plane size={16} className={`shrink-0 text-slate-500 dark:text-slate-400 ${ida ? '' : 'rotate-180'}`} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mr-2">{ida ? 'Ida' : 'Regreso'}</span>
                            {flight.route}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {[formatDate(flight.date), flight.time, flight.airline].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={hecho ? 'realizado' : 'pendiente-check'}>{hecho ? 'Check-in realizado' : 'Check-in pendiente'}</Badge>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
}
