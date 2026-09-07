import { memo, useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Pagination } from '../ui/Pagination';
import { SKELETON } from '../ui/Skeleton';
import { formatCurrency, formatDate } from '../../utils/formatters';
import * as api from '../../api';
import { User, Sale } from '../../types';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const PER_PAGE = 5;

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadministrador',
  admin: 'Administrador',
  asesor: 'Asesor',
  freelancer: 'Freelancer',
};

/** Un hueco vacío dice "no hay dato" mejor que la palabra "N/A". */
const Vacio = () => <span className="text-slate-300 dark:text-slate-600">—</span>;

const Dato = memo(function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-accent">{rotulo}</dt>
      <dd className="truncate text-sm font-semibold text-primary dark:text-white">{children}</dd>
    </div>
  );
});

const FilaVenta = memo(function FilaVenta({ venta }: { venta: Sale }) {
  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(venta.date)}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary dark:text-white">
        {formatCurrency(venta.total)}
      </td>
      <td className="px-3 py-2 text-right">
        <Badge variant={venta.status}>{venta.status}</Badge>
      </td>
    </tr>
  );
});

/**
 * Detalle de un usuario interno: quién es y qué ha vendido.
 *
 * Reescrito por tres motivos.
 *
 * **Clases que no generaban CSS.** `border-accent/20`, `bg-accent/10` y
 * `bg-primary/10` no existen en el bundle: los colores del tema son `var()`
 * pelado y Tailwind 3 no les aplica el modificador de opacidad. El degradado
 * de la cabecera no se pintaba, el fondo del avatar tampoco, y el borde sin
 * color caía a `currentColor`, así que la cabecera iba rodeada de una línea del
 * color del texto —casi blanca en oscuro—.
 *
 * **`dark:!text-[#ffffff]` diez veces.** Un hex con `!important` repetido para
 * forzar el blanco, cuando `index.css` ya reescribe `text-gray-900` al color de
 * texto del tema en oscuro. Se usa el token, una vez por dato.
 *
 * **Repetía lo que ya se sabe.** La modal se titula con el nombre y la cabecera
 * lo repetía en grande; y el rol salía dos veces, como insignia y como campo.
 * Lo que sí falta al abrir el detalle de un asesor es cuánto ha vendido, así
 * que eso es lo que encabeza.
 */
export default function UserDetailModal({ isOpen, onClose, user }: UserDetailModalProps) {
  // Las ventas se piden paginadas y filtradas por su id. Antes llegaban por
  // props filtrando la lista global, que solo trae una página.
  const [userSales, setUserSales] = useState<Sale[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [resumen, setResumen] = useState<{ salesCount?: number; salesTotal?: number }>({});
  const [loading, setLoading] = useState(false);

  // La página vuelve a 1 al cambiar de usuario, en su propio efecto: mezclarlo
  // con la carga obligaba a que el efecto que depende de `page` lo reiniciara.
  useEffect(() => { setPage(1); }, [user?.id, isOpen]);

  useEffect(() => {
    if (!isOpen || !user) { setUserSales([]); setResumen({}); return; }
    let vivo = true;
    setLoading(true);
    Promise.all([
      api.listSales({ asesorId: user.id, page, perPage: PER_PAGE, sortOrder: 'desc' }),
      // El resumen es del asesor entero, así que se pide una vez y no por página.
      page === 1 ? api.getUser(user.id) : Promise.resolve(null),
    ])
      .then(([lista, detalle]: any[]) => {
        if (!vivo) return;
        setUserSales(lista?.data || []);
        if (lista?.meta) setMeta({ total: lista.meta.total, totalPages: lista.meta.totalPages });
        if (detalle) setResumen({ salesCount: detalle.salesCount, salesTotal: detalle.salesTotal });
      })
      .catch(() => { if (vivo) setUserSales([]); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
    // Dependencia primitiva: con el objeto en la lista basta con que el padre
    // pase una identidad nueva en un render para repetir la petición.
  }, [isOpen, user?.id, page]);

  if (!user) return null;

  // Totales de todas las ventas del asesor, no solo de la página visible.
  const numeroVentas = resumen.salesCount ?? meta.total;
  const totalFacturado = resumen.salesTotal ?? 0;
  const activo = user.status === 'active';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user.name}
      size="md"
      footer={<Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-6 px-1 py-1">
        {/* Lo que distingue a un asesor de otro es cuánto ha vendido, así que
            esa es la cifra que encabeza. El nombre no se repite: ya es el
            título de la ventana. */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-heading text-2xl font-semibold tabular-nums text-primary dark:text-white">
              {formatCurrency(totalFacturado)}
            </p>
            <p className="mt-0.5 text-sm text-accent">
              facturado en {numeroVentas} {numeroVentas === 1 ? 'venta' : 'ventas'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="accent">{ROLE_LABELS[user.role] || user.role}</Badge>
            {/* Punto y etiqueta, el mismo tratamiento de estado de los
                catálogos. Antes decía "USUARIO ACTIVO" en mayúsculas. */}
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span
                className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                aria-hidden
              />
              {activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        {/* Los datos de identidad y contacto. El rol ya está arriba y no se
            repite aquí, como hacía antes. */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-3">
          <Dato rotulo="Documento">
            {user.docNumber
              ? <span className="tabular-nums">{user.docType} {user.docNumber}</span>
              : <Vacio />}
          </Dato>
          <Dato rotulo="Teléfono">
            {user.phone ? <span className="tabular-nums">{user.phone}</span> : <Vacio />}
          </Dato>
          <Dato rotulo="Nacimiento">
            {user.birthDate ? formatDate(user.birthDate) : <Vacio />}
          </Dato>
          <div className="col-span-2 min-w-0 sm:col-span-3">
            <dt className="text-xs text-accent">Correo</dt>
            <dd className="break-all text-sm font-semibold text-primary dark:text-white">
              {user.email || <Vacio />}
            </dd>
          </div>
        </dl>

        <section>
          <h3 className="text-sm font-semibold text-primary dark:text-white">Ventas</h3>

          {loading && userSales.length === 0 ? (
            <div className="mt-2 space-y-2">
              {[0, 1, 2].map(i => <div key={i} className={`${SKELETON} h-8`} />)}
            </div>
          ) : userSales.length === 0 ? (
            <p className="mt-1 text-sm text-accent">
              Este usuario todavía no ha registrado ninguna venta.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-accent">
                    <th scope="col" className="px-3 pb-2 text-left">Fecha</th>
                    <th scope="col" className="px-3 pb-2 text-right">Valor</th>
                    <th scope="col" className="px-3 pb-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {userSales.map(s => <FilaVenta key={s.id} venta={s} />)}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={page}
            totalPages={meta.totalPages}
            total={meta.total}
            perPage={PER_PAGE}
            loading={loading}
            onPageChange={setPage}
            // Con pocas ventas hay una sola página y el paginador se ocultaba
            // entero, el total incluido.
            alwaysShowRange
          />
        </section>
      </div>
    </Modal>
  );
}
