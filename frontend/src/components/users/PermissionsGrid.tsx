import { memo, useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import * as api from '../../api';
import { SKELETON } from '../ui/Skeleton';
import { RolePermissions } from '../../types';

interface AccionEsquema {
  key: string;
  label: string;
  type: 'boolean' | 'scope';
}

export interface ModuloEsquema {
  key: string;
  label: string;
  actions: AccionEsquema[];
}

export interface EsquemaPermisos {
  actions: { key: string; label: string }[];
  modules: ModuloEsquema[];
  scopes: { value: string; label: string }[];
  roles: { name: string; editable: boolean }[];
}

interface PermissionsGridProps {
  permissions: RolePermissions;
  onChange: (p: RolePermissions) => void;
  /** Sin `permissions.edit` la matriz se muestra, pero no se toca. */
  readOnly?: boolean;
}

/**
 * Los permisos de un rol, como matriz de acceso.
 *
 * Los módulos y sus acciones vienen de `GET /roles/schema`: la pantalla pinta
 * lo que el backend declara, así que no hay dos listas que puedan discrepar.
 *
 * Dos decisiones de forma:
 *
 * - **Lo concedido se ve; lo denegado se retira.** Una casilla concedida es un
 *   bloque sólido con su marca; una denegada es un contorno muy tenue. Así,
 *   bajando por una columna, se lee la FORMA de lo que puede hacer el rol sin
 *   leer una sola etiqueta. Con casillas vacías todas iguales, 26 controles del
 *   mismo peso, no se distinguía nada de un vistazo.
 * - **El alcance es un control segmentado, no un desplegable.** Los tres
 *   valores están a la vista, que es lo que hace falta para comparar filas; y
 *   un `<select>` nativo arrastra el tema del navegador en su lista de
 *   opciones, que en modo oscuro se sale de la paleta.
 *
 * Aquí no hay nada llamativo a propósito: en una pantalla de permisos lo único
 * que debe resaltar es qué está concedido.
 */

const CELDA = 'px-3 py-2.5 text-center';

const Casilla = memo(function Casilla({
  activo, onToggle, readOnly, etiqueta,
}: { activo: boolean; onToggle: () => void; readOnly: boolean; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={readOnly}
      onClick={onToggle}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/40 ${
        activo
          ? 'border-highlight bg-highlight text-white'
          : 'border-gray-border text-transparent hover:border-accent'
      } ${readOnly ? 'cursor-not-allowed' : ''}`}
    >
      <Check size={14} strokeWidth={3} aria-hidden />
    </button>
  );
});

const Alcance = memo(function Alcance({
  valor, opciones, onChange, readOnly, etiqueta,
}: {
  valor: string;
  opciones: { value: string; label: string }[];
  onChange: (v: string) => void;
  readOnly: boolean;
  etiqueta: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex overflow-hidden rounded-md border border-gray-border"
    >
      {opciones.map(o => {
        const activo = valor === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={readOnly}
            onClick={() => onChange(o.value)}
            className={`px-2 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-highlight/40 ${
              activo
                ? 'bg-highlight text-white'
                : 'text-accent hover:bg-gray-light dark:hover:bg-white/5'
            } ${readOnly ? 'cursor-not-allowed' : ''}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
});

/** Ausencia de la acción en ese módulo. No es un permiso denegado. */
const NoAplica = memo(function NoAplica() {
  return (
    <span
      className="select-none text-gray-border"
      title="Esta acción no existe para este módulo"
      aria-label="No aplica"
    >
      –
    </span>
  );
});

interface FilaProps {
  modulo: ModuloEsquema;
  columnas: { key: string; label: string }[];
  valores: Record<string, unknown>;
  scopes: { value: string; label: string }[];
  readOnly: boolean;
  onCambiar: (modulo: string, accion: string, valor: unknown) => void;
}

const Fila = memo(function Fila({
  modulo, columnas, valores, scopes, readOnly, onCambiar,
}: FilaProps) {
  return (
    <tr className="border-t border-gray-border/60 hover:bg-gray-light/60 dark:hover:bg-white/[0.03]">
      <th scope="row" className="px-3 py-2.5 text-left font-semibold text-primary dark:text-white">
        {modulo.label}
      </th>
      {columnas.map(col => {
        const decl = modulo.actions.find(a => a.key === col.key);
        if (!decl) return <td key={col.key} className={CELDA}><NoAplica /></td>;

        const valor = valores[col.key];
        return (
          <td key={col.key} className={CELDA}>
            {decl.type === 'scope' ? (
              <Alcance
                valor={typeof valor === 'string' ? valor : valor ? 'all' : 'none'}
                opciones={scopes}
                readOnly={readOnly}
                etiqueta={`${modulo.label}: alcance de ${decl.label.toLowerCase()}`}
                onChange={v => onCambiar(modulo.key, col.key, v)}
              />
            ) : (
              <Casilla
                activo={valor === true}
                readOnly={readOnly}
                etiqueta={`${modulo.label}: ${decl.label.toLowerCase()}`}
                onToggle={() => onCambiar(modulo.key, col.key, !(valor === true))}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
});

export default function PermissionsGrid({ permissions, onChange, readOnly = false }: PermissionsGridProps) {
  const [esquema, setEsquema] = useState<EsquemaPermisos | null>(null);

  useEffect(() => {
    let vivo = true;
    api.getRolesSchema()
      .then((e: EsquemaPermisos) => { if (vivo) setEsquema(e); })
      .catch(() => { if (vivo) setEsquema(null); });
    return () => { vivo = false; };
  }, []);

  const cambiar = useCallback((modulo: string, accion: string, valor: unknown) => {
    if (readOnly) return;
    onChange({
      ...permissions,
      [modulo]: { ...((permissions as any)[modulo] || {}), [accion]: valor },
    } as RolePermissions);
  }, [permissions, onChange, readOnly]);

  if (!esquema) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className={`${SKELETON} h-10`} />)}
      </div>
    );
  }

  return (
    // Sin borde ni radio propios: la tabla se apoya directamente en la tarjeta
    // que la contiene. Antes había tres superficies anidadas —tarjeta, panel
    // gris y tabla enmarcada— y el marco de más era lo que hacía que pareciera
    // un recorte pegado encima.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[38rem] text-sm">
        <thead>
          <tr className="text-xs font-medium text-accent">
            <th scope="col" className="px-3 pb-2 text-left">Módulo</th>
            {esquema.actions.map(a => (
              <th key={a.key} scope="col" className="px-3 pb-2 text-center">{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {esquema.modules.map(mod => (
            <Fila
              key={mod.key}
              modulo={mod}
              columnas={esquema.actions}
              valores={((permissions as any)[mod.key] || {}) as Record<string, unknown>}
              scopes={esquema.scopes}
              readOnly={readOnly}
              onCambiar={cambiar}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
