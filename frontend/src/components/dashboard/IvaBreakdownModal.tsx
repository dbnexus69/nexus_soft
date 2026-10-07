import { useEffect, useRef, useState } from 'react';
import { SKELETON } from '../ui/Skeleton';
import { Modal } from '../ui/Modal';
import { Pagination } from '../ui/Pagination';
import * as api from '../../api';
import type { RespuestaIva } from '../../api/stats';
import { formatCurrency, formatDate, formatSaleId } from '../../utils/formatters';

interface IvaBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mismo rango que el dashboard, para que el IVA de la modal coincida con la tarjeta. */
  dateFrom?: string;
  dateTo?: string;
}

const POR_PAGINA = 10;

/**
 * IVA de las ventas vigentes del periodo. La cifra arriba es del rango entero;
 * la lista es solo la página que se ve.
 */
export function IvaBreakdownModal({ isOpen, onClose, dateFrom, dateTo }: IvaBreakdownModalProps) {
  const [pagina, setPagina] = useState(1);
  const [respuesta, setRespuesta] = useState<RespuestaIva | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const peticion = useRef(0);

  // Otro rango empieza por la primera página.
  useEffect(() => { setPagina(1); }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!isOpen) return;
    const mia = ++peticion.current;
    setCargando(true);
    setFallo(false);
    api.getIva({ dateFrom, dateTo, page: pagina, perPage: POR_PAGINA })
      .then(r => { if (mia === peticion.current) setRespuesta(r); })
      .catch(() => {
        if (mia === peticion.current) { setRespuesta(null); setFallo(true); }
      })
      .finally(() => { if (mia === peticion.current) setCargando(false); });
  }, [isOpen, dateFrom, dateTo, pagina]);

  const totales = respuesta?.meta.totals;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="IVA del periodo" size="lg">
      <div className="px-1 py-1 space-y-6">
        {cargando && !respuesta ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`${SKELETON} h-10`} />
            ))}
          </div>
        ) : fallo || !respuesta || !totales ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No se pudo cargar el IVA. Vuelve a abrirlo en un momento.
          </p>
        ) : totales.ventas === 0 ? (
          <div className="py-10 text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-200">No hay ventas en este periodo</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cambia el rango de fechas para ver el IVA de otras ventas.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="font-heading text-3xl font-semibold tabular-nums text-primary dark:text-white">
                {formatCurrency(totales.iva)}
              </p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                de IVA en {totales.ventas} {totales.ventas === 1 ? 'venta' : 'ventas'}, sobre {formatCurrency(totales.total)} vendidos
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="py-2 font-semibold">Venta</th>
                    <th className="py-2 font-semibold">Fecha</th>
                    <th className="py-2 font-semibold">Cliente</th>
                    <th className="py-2 text-right font-semibold">Total venta</th>
                    <th className="py-2 text-right font-semibold">IVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {respuesta.data.map(v => (
                    <tr key={v.id}>
                      <td className="py-2 font-medium text-slate-800 dark:text-slate-100">
                        {v.numero != null ? formatSaleId(v.numero) : '—'}
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{formatDate(v.fecha)}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{v.cliente || '—'}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(v.total)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(v.iva)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={respuesta.meta.page}
              totalPages={respuesta.meta.totalPages}
              onPageChange={setPagina}
              total={respuesta.meta.total}
              perPage={respuesta.meta.perPage}
              loading={cargando}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
