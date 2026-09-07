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

interface ModuloEsquema {
  key: string;
  label: string;
  actions: AccionEsquema[];
}

interface Esquema {
  actions: { key: string; label: string }[];
  modules: ModuloEsquema[];
  scopes: { value: string; label: string }[];
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
 * El diseño anterior eran tarjetas, una por módulo, con sus interruptores
 * dentro. Dos problemas que la forma misma causaba:
 *
 * - **Declaraba los módulos a mano y solo cuatro de los nueve.** Panel,
 *   responsables, usuarios, gestión interna y permisos de rol no aparecían, así
 *   que no se podían conceder ni revocar aunque el backend los guarde y los
 *   aplique. Ahora los módulos vienen de `GET /roles/schema`: la pantalla pinta
 *   lo que el backend declara y no hay dos listas que discrepen.
 * - **Una tarjeta no puede mostrar una matriz.** Con tarjetas no se ve que el
 *   panel no tiene "crear" ni que vuelos no tiene "eliminar"; solo se ve lo que
 *   hay, nunca lo que no existe. En la matriz esa casilla va con un guion, y
 *   ese guion es información: dice que la acción no existe para ese módulo, que
 *   es distinto de existir y estar denegada.
 *
 * Aquí no hay nada llamativo a propósito: en una pantalla de permisos lo que
 * tiene que resaltar es qué está concedido, y para eso basta con que solo eso
 * lleve color.
 */

const CELDA = 'px-3 py-2 text-center';

/** Casilla de sí/no. Un botón de verdad, con su estado anunciado. */
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
      className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/40 ${
        activo
          ? 'border-highlight bg-highlight text-white'
          : 'border-gray-border bg-transparent text-transparent hover:border-slate-400'
      } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <Check size={13} strokeWidth={3} aria-hidden />
    </button>
  );
});

/** Ausencia de la acción en ese módulo. No es un permiso denegado. */
const NoAplica = () => (
  <span className="text-slate-300 dark:text-slate-600" title="Esta acción no existe para este módulo">
    —
  </span>
);

export default function PermissionsGrid({ permissions, onChange, readOnly = false }: PermissionsGridProps) {
  const [esquema, setEsquema] = useState<Esquema | null>(null);

  useEffect(() => {
    let vivo = true;
    api.getRolesSchema()
      .then((e: Esquema) => { if (vivo) setEsquema(e); })
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
        {Array.from({ length: 6 }, (_, i) => <div key={i} className={`${SKELETON} h-9`} />)}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-border">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-gray-border text-xs font-medium text-accent">
            <th scope="col" className="px-3 py-2 text-left">Módulo</th>
            {esquema.actions.map(a => (
              <th key={a.key} scope="col" className="px-3 py-2 text-center">{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {esquema.modules.map(mod => {
            const actuales = ((permissions as any)[mod.key] || {}) as Record<string, unknown>;
            return (
              <tr key={mod.key} className="border-b border-gray-border/60 last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-semibold text-primary dark:text-white">
                  {mod.label}
                </th>
                {esquema.actions.map(col => {
                  const decl = mod.actions.find(a => a.key === col.key);
                  if (!decl) return <td key={col.key} className={CELDA}><NoAplica /></td>;

                  const valor = actuales[col.key];
                  if (decl.type === 'scope') {
                    return (
                      <td key={col.key} className={CELDA}>
                        <select
                          value={typeof valor === 'string' ? valor : valor ? 'all' : 'none'}
                          disabled={readOnly}
                          aria-label={`${mod.label}: alcance de ${decl.label.toLowerCase()}`}
                          onChange={e => cambiar(mod.key, col.key, e.target.value)}
                          className="rounded-lg border border-gray-border bg-transparent px-2 py-1 text-xs font-medium text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight/40 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white"
                        >
                          {esquema.scopes.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} className={CELDA}>
                      <Casilla
                        activo={valor === true}
                        readOnly={readOnly}
                        etiqueta={`${mod.label}: ${decl.label.toLowerCase()}`}
                        onToggle={() => cambiar(mod.key, col.key, !(valor === true))}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
