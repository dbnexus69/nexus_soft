import { useEffect, useRef, useState } from 'react';
import { SKELETON } from '../ui/Skeleton';
import { Modal } from '../ui/Modal';
import { getConfigItem } from '../../api/config';
import type { DefinicionCatalogo } from './catalogos';

interface Uso {
  etiqueta: string;
  count: number;
}

interface CatalogDetailModalProps {
  def: DefinicionCatalogo;
  /** El registro de la fila. null cierra la modal. */
  item: any | null;
  onClose: () => void;
  onEditar: (item: any) => void;
}

/**
 * Detalle de un registro de catálogo.
 *
 * Muestra dos cosas que la fila no puede: los campos que no caben en la tabla
 * —observaciones de un proveedor, notas de una política, el país de un
 * aeropuerto— y **dónde se usa** el registro.
 *
 * Lo segundo es lo que le da sentido a la ventana. El aviso de borrado decía
 * "asegúrate de que este elemento no esté siendo referenciado por tiquetes o
 * ventas activas", es decir, le pasaba la comprobación al operador sin darle
 * forma de hacerla. `GET /config/:section/:id` la responde ahora con recuentos.
 *
 * Los campos van en el endpoint del elemento, que ya existía: el listado viene
 * ligero a propósito y el detalle completo se pide al abrirlo, así que no hace
 * falta ningún endpoint nuevo y la tabla no paga por lo que no muestra.
 */
export function CatalogDetailModal({ def, item, onClose, onEditar }: CatalogDetailModalProps) {
  const [completo, setCompleto] = useState<any>(null);
  const [usos, setUsos] = useState<Uso[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const peticion = useRef(0);

  const abierta = item !== null;

  useEffect(() => {
    if (!abierta || !item?.id) return;
    const mia = ++peticion.current;
    setCargando(true);
    // La guarda por número de petición evita que al abrir dos filas seguidas la
    // respuesta de la primera pise a la de la segunda.
    getConfigItem(def.seccion, item.id)
      .then((res: any) => {
        if (mia !== peticion.current) return;
        setCompleto(res);
        setUsos(res?.usage || []);
      })
      .catch(() => {
        // Se conserva lo que trajo la fila: es menos, pero es cierto.
        if (mia === peticion.current) { setCompleto(null); setUsos(null); }
      })
      .finally(() => { if (mia === peticion.current) setCargando(false); });
  }, [abierta, item?.id, def.seccion]);

  // Mientras llega el detalle se pintan los campos que ya trae la fila, en vez
  // de dejar la ventana vacía.
  const datos = completo || item || {};
  const campos = def.detalle || [];
  const sinUsar = completo?.unused === true;

  return (
    <Modal
      isOpen={abierta}
      onClose={onClose}
      title={datos.name || datos.airlineName || def.singular}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => { onEditar(item); onClose(); }}
            className="rounded-lg bg-highlight px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Editar
          </button>
        </div>
      }
    >
      <div className="space-y-6 px-1 py-1">
        <dl className="divide-y divide-slate-200 dark:divide-slate-800">
          {campos.map(c => (
            <div
              key={c.rotulo}
              className={c.ancho ? 'py-2.5' : 'flex items-baseline justify-between gap-4 py-2.5'}
            >
              <dt className="text-sm text-slate-500 dark:text-slate-400">{c.rotulo}</dt>
              <dd
                className={`text-sm text-slate-800 dark:text-slate-100 ${
                  c.ancho ? 'mt-1 whitespace-pre-line' : 'text-right'
                }`}
              >
                {c.render(datos)}
              </dd>
            </div>
          ))}
        </dl>

        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Dónde se usa
          </h3>
          {cargando && usos === null ? (
            <div className={`${SKELETON} mt-2 h-5 w-40`} />
          ) : usos === null ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              No se pudo comprobar. Vuelve a abrirlo en un momento.
            </p>
          ) : sinUsar ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Nada lo referencia todavía, así que se puede borrar sin romper nada.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
              {usos.map(u => (
                <li key={u.etiqueta} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{u.etiqueta}</span>
                  <span className="tabular-nums text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {u.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
