import { AlertCircle, CheckCircle2, ExternalLink, UploadCloud, X, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FormField } from '../ui/Form';
import { formatDate } from '../../utils/formatters';
import type { AppData, Flight } from '../../types';

/** Mínimo y máximo del motivo de cancelación; los mismos que valida el servidor. */
export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 255;

/** Los dos diálogos del check-in de la pantalla de vuelos: enviarlo al cliente y cancelarlo. */

interface PropsEnviar {
  abierto: boolean;
  enviando: boolean;
  vuelo: Flight | null;
  cliente: { docType?: string | null; docNumber?: string | null; email?: string | null } | null | undefined;
  aerolineas: AppData['config']['airlines'];
  archivos: File[];
  setArchivos: React.Dispatch<React.SetStateAction<File[]>>;
  onCerrar: () => void;
  onConfirmar: () => void;
}

export function ModalEnviarCheckin({ abierto, enviando, vuelo, cliente, aerolineas, archivos, setArchivos, onCerrar, onConfirmar }: PropsEnviar) {
  return (
    <Modal
      isOpen={abierto}
      onClose={() => !enviando && onCerrar()}
      title="Enviar Check-in"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirmar} 
            disabled={enviando}
            className="relative"
          >
            {enviando ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Enviando...
              </>
            ) : (
              'Enviar al Cliente'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Pasajero:</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{vuelo?.passenger}</p>
            {cliente && (
              <span className="text-xs bg-white/50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800/50 font-bold">
                {cliente.docType}: {cliente.docNumber}
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Ruta:</p>
            <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{vuelo?.route}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Fecha y Hora:</p>
            <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">
              {vuelo ? formatDate(vuelo.date) : ''} {vuelo?.time}
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Aerolínea:</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{vuelo?.airline}</p>
              {(() => {
                const airlineInfo = aerolineas.find((a) => a.name === vuelo?.airline);
                if (airlineInfo && airlineInfo.website) {
                  const url = airlineInfo.website.startsWith('http') ? airlineInfo.website : `https://${airlineInfo.website}`;
                  return (
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40 flex items-center gap-1 font-bold transition-colors"
                      title="Ir al sitio web de la aerolínea para Check-in"
                    >
                      <ExternalLink size={10} /> Link Check-in
                    </a>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Enviar a:</p>
            <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff] truncate" title={vuelo?.email || cliente?.email || undefined}>
              {vuelo?.email || cliente?.email || 'Sin correo registrado'}
            </p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Nº Vuelo:</p>
            <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff]">{vuelo?.flightNumber || 'No registrado'}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-border dark:border-slate-700 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Código Reserva (PNR):</p>
            <p className="text-sm font-bold text-gray-900 dark:!text-[#ffffff] font-mono select-all" title="Click para copiar">{vuelo?.reservationNumber || 'No registrado'}</p>
          </div>
        </div>

        {vuelo?.source === 'plan' ? (
          <p className="text-xs text-gray-500 dark:text-slate-400 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 p-4">
            Este vuelo se vendió dentro de un plan. El check-in se registra
            igual, pero todavía no se le pueden adjuntar documentos ni guardar
            la hora: al plan le faltan esas columnas.
          </p>
        ) : (
        <FormField label="Adjuntar Documentos de Check-in (Opcional)">
          <div className="relative group mb-3">
            <input
              type="file"
              multiple
              onChange={(e) => {
                const filesList = Array.from(e.target.files || []);
                setArchivos(prev => [...prev, ...filesList]);
                e.target.value = '';
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <div className="p-6 border-2 border-dashed border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 rounded-xl flex flex-col items-center justify-center gap-1 transition-all group-hover:border-primary group-hover:bg-primary/5">
              <UploadCloud size={28} className="text-gray-500 group-hover:text-primary transition-colors" />
              <p className="text-xs font-bold text-gray-500 uppercase">Seleccionar PDF o Imagen</p>
              <p className="text-xs text-gray-500">Haz clic o arrastra aquí (Soporta múltiples archivos)</p>
            </div>
          </div>

          {archivos.length > 0 && (
            <div className="space-y-2 border border-gray-border rounded-xl p-3 bg-gray-50/50 max-h-[160px] overflow-y-auto">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Archivos seleccionados ({archivos.length}):</p>
              {archivos.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-3 p-2 bg-white border border-gray-200 rounded-lg text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    <span className="font-medium text-gray-700 truncate" title={file.name}>{file.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setArchivos(prev => prev.filter((_, i) => i !== idx))} 
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                    title="Eliminar archivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </FormField>
        )}

        <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p>Al confirmar, el documento se enviará automáticamente al correo registrado del cliente.</p>
        </div>
      </div>
    </Modal>
  );
}

interface PropsCancelar {
  vuelo: Flight | null;
  motivo: string;
  setMotivo: (v: string) => void;
  cancelando: boolean;
  valido: boolean;
  onCerrar: () => void;
  onConfirmar: () => void;
}

export function ModalCancelarCheckin({ vuelo, motivo, setMotivo, cancelando, valido, onCerrar, onConfirmar }: PropsCancelar) {
  return (
    <Modal
      isOpen={!!vuelo}
      onClose={() => onCerrar()}
      title="Cancelar Check-in"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => onCerrar()} disabled={cancelando}>
            Volver
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={!valido || cancelando}
            className="bg-red-600 hover:bg-red-700 border-red-600"
          >
            <XCircle size={16} /> {cancelando ? 'Cancelando...' : 'Cancelar Check-in'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 rounded-lg">
          <p className="font-bold text-primary dark:text-white text-sm">{vuelo?.passenger}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {vuelo?.route} · {vuelo ? formatDate(vuelo.date) : ''} {vuelo?.time}
            {vuelo?.flightNumber ? ` · Vuelo ${vuelo.flightNumber}` : ''}
          </p>
        </div>

        <FormField label={`Motivo de la cancelación (mínimo ${MOTIVO_MIN} caracteres)`} required>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            maxLength={MOTIVO_MAX}
            rows={3}
            autoFocus
            placeholder="Ej: La aerolínea canceló el vuelo por mantenimiento"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-border dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:text-white resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <span className={`text-xs ${valido ? 'text-gray-500 dark:text-slate-500' : 'text-red-500'}`}>
              {valido ? 'Queda registrado junto a la cancelación.' : `Faltan ${MOTIVO_MIN - motivo.trim().length} caracteres.`}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-500">
              {motivo.length}/{MOTIVO_MAX}
            </span>
          </div>
        </FormField>

        <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-lg text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p>El vuelo pasará a estado cancelado y se mostrará en rojo en el calendario. No se enviará ningún correo al cliente.</p>
        </div>
      </div>
    </Modal>
  );
}
