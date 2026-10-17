import { useCallback, useId, useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { AsyncCombobox } from '../ui/AsyncCombobox';
import { suggestDestinations } from '../../api/clients';

/** Mismo tope y largo que `backend/src/utils/destinos.js`; el servidor decide (spec 017). */
export const MAX_DESTINOS = 5;
const MIN_LARGO = 2;
const MAX_LARGO = 60;

const limpiar = (v: string) => v.trim().replace(/\s+/g, ' ');

/**
 * Añade un destino al final (el reciente). Un repetido, sin mayúsculas, no se duplica:
 * se mueve al final, igual que hace el servidor.
 */
export function anadirDestino(lista: string[], texto: string): string[] {
  const d = limpiar(texto);
  return [...lista.filter(x => x.toLowerCase() !== d.toLowerCase()), d];
}

interface DestinosFieldProps {
  value: string[];
  onChange: (destinos: string[]) => void;
  error?: string;
}

/** "Destinos de preferencia": texto con sugerencias, "+" (o Enter) y etiquetas que se quitan. */
export function DestinosField({ value, onChange, error }: DestinosFieldProps) {
  const idEtiqueta = useId();
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState('');
  const lleno = value.length >= MAX_DESTINOS;

  const buscar = useCallback(
    async (q: string) => (await suggestDestinations(q)).map(d => ({ value: d, label: d })),
    [],
  );

  const anadir = (t: string) => {
    const d = limpiar(t);
    if (!d) return;
    if (d.length < MIN_LARGO || d.length > MAX_LARGO) {
      setAviso(`Entre ${MIN_LARGO} y ${MAX_LARGO} caracteres`);
      return;
    }
    const nueva = anadirDestino(value, d);
    if (nueva.length > MAX_DESTINOS) {
      setAviso(`Máximo ${MAX_DESTINOS} destinos`);
      return;
    }
    onChange(nueva);
    setTexto('');
    setAviso('');
  };

  const mensaje = aviso || error;
  // Del más nuevo al más viejo: el primero es el reciente.
  const recientesPrimero = [...value].reverse();

  return (
    <div className="mb-4">
      <span id={idEtiqueta} className={`block text-sm font-medium mb-1 ${mensaje ? 'text-red-500' : 'text-gray-700'}`}>
        Destinos de preferencia
      </span>
      <div
        className="flex gap-2"
        onKeyDown={(e) => {
          // Enter añade en vez de enviar el formulario.
          if (e.key === 'Enter') { e.preventDefault(); if (!lleno) anadir(texto); }
        }}
      >
        <AsyncCombobox
          className="flex-1"
          inputClassName="bg-gray-50/50"
          value={texto}
          onChange={(v, opcion) => {
            setTexto(v);
            setAviso('');
            if (opcion) anadir(opcion.value);
          }}
          fetchOptions={buscar}
          placeholder={lleno ? `Máximo ${MAX_DESTINOS} destinos` : 'Ej: Cartagena'}
          emptyText="Sin sugerencias: Enter o + para añadirlo"
          disabled={lleno}
          ariaLabel="Destinos de preferencia"
        />
        <button
          type="button"
          onClick={() => anadir(texto)}
          disabled={lleno || !limpiar(texto)}
          aria-label="Añadir destino"
          className="shrink-0 w-11 h-11 rounded-lg border border-gray-border flex items-center justify-center text-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      {mensaje ? (
        <p role="alert" className="mt-1 text-sm text-red-600">{mensaje}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          {value.length}/{MAX_DESTINOS} · el último añadido es el reciente
        </p>
      )}

      {recientesPrimero.length > 0 && (
        <ul aria-labelledby={idEtiqueta} className="mt-2 flex flex-wrap gap-2">
          {recientesPrimero.map((d, i) => (
            <li
              key={d}
              className={`flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm border ${
                i === 0 ? 'bg-primary/10 border-primary/30 text-primary font-semibold' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              <MapPin size={14} aria-hidden="true" />
              {d}
              {i === 0 && <span className="text-xs font-normal">(reciente)</span>}
              <button
                type="button"
                onClick={() => onChange(value.filter(x => x !== d))}
                aria-label={`Quitar ${d}`}
                className="ml-1 w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/5"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
