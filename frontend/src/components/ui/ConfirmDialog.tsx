import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Qué va a pasar. En frase, no un "¿estás seguro?". */
  children: React.ReactNode;
  /** Texto del botón que ejecuta. Debe nombrar la acción, no decir "Sí". */
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` para lo que destruye datos. */
  variant?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación de una acción, en la interfaz y no en el navegador.
 *
 * Sustituye a `window.confirm`, que no se puede leer con el tema de la
 * aplicación, no cabe explicar en él qué va a ocurrir y bloquea el hilo.
 *
 * El botón nombra la acción —"Dar de baja", "Eliminar"— en vez de decir "Sí":
 * quien lo lee sabe qué va a pasar sin releer la pregunta, que es lo que
 * importa cuando lo que hay detrás borra datos.
 */
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Un momento…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="px-1 py-1 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </Modal>
  );
}
