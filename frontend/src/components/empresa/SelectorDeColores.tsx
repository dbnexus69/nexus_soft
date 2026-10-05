import { Palette } from 'lucide-react';

/** El selector de los tres colores de marca, compartido por Agencias (alta y ficha) y Mi empresa. */
export function SelectorDeColores({ colores, onChange }: {
  colores: { primario: string; acento: string; realce: string };
  onChange: (clave: 'primario' | 'acento' | 'realce', valor: string) => void;
}) {
  return (
    <fieldset>
      <legend className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
        <Palette size={13} /> Colores de la marca
      </legend>
      {/* Dice dónde se ven, que es lo que hay que saber al elegirlos: si no,
          quien los elige espera que cambien la aplicación entera. */}
      <p className="mt-1 text-xs text-accent">
        Se usan en el voucher que recibe su cliente. La aplicación mantiene siempre
        los mismos colores; el logo y el nombre sí son los de la agencia.
      </p>
      <div className="mt-3 flex flex-wrap gap-5">
        {([['primario', 'Principal'], ['acento', 'Acento'], ['realce', 'Realce']] as const).map(([clave, etiqueta]) => (
          <label key={clave} className="group flex cursor-pointer flex-col items-center gap-1.5">
            {/* El círculo ES el color, no una muestra al lado de un input nativo
                diminuto: aquí el color es lo que se está eligiendo, así que es
                lo que debe verse primero. El input real sigue encima, invisible,
                para que el clic abra el selector del sistema. */}
            <span
              className="relative block h-11 w-11 rounded-full shadow-sm ring-2 ring-white transition-transform group-hover:scale-105 dark:ring-slate-900"
              style={{ backgroundColor: colores[clave] }}
            >
              <input
                type="color"
                value={colores[clave]}
                onChange={e => onChange(clave, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
