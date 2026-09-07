import { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { FormField, CurrencyInput, Select, Input } from '../../ui/Form';
import { useData } from '../../../context/DataContext';
import * as api from '../../../api';
import { formatCurrency } from '../../../utils/formatters';

export interface CreditoACobrar {
  saleId: number;
  pendingAmount: number;
}

interface CollectPaymentDialogProps {
  credito: CreditoACobrar | null;
  clientName: string;
  onClose: () => void;
  /** Se llama tras un cobro registrado, para refrescar la cartera. */
  onCobrado: () => void;
}

/**
 * Registrar un cobro sobre un crédito, desde la propia pantalla de cartera.
 *
 * Antes había que salir a la lista de ventas, buscar la venta y abrir el modal
 * de EDICIÓN para llegar aquí: la pantalla de cobros no cobraba. Este diálogo
 * usa `POST /sales/:id/payments`, que ya existe y ya deriva el estado y el
 * pendiente de la base, así que no hace falta ningún endpoint nuevo.
 */
export function CollectPaymentDialog({
  credito,
  clientName,
  onClose,
  onCobrado,
}: CollectPaymentDialogProps) {
  const { data } = useData();
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const abierto = credito !== null;
  const pendiente = credito?.pendingAmount ?? 0;
  const valor = Number(monto) || 0;

  const cerrar = () => {
    setMonto(''); setMetodo(''); setReferencia(''); setError(null);
    onClose();
  };

  const enviar = async () => {
    if (!credito) return;
    if (valor <= 0) { setError('Indica cuánto se está cobrando.'); return; }
    if (valor > pendiente) {
      setError(`El cobro supera lo pendiente, que son ${formatCurrency(pendiente)}.`);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api.registerPayment(credito.saleId, {
        amount: valor,
        method: metodo || undefined,
        reference: referencia || undefined,
      });
      onCobrado();
      cerrar();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'No se pudo registrar el cobro.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      isOpen={abierto}
      onClose={cerrar}
      title={credito ? `Cobrar la venta ${credito.saleId}` : ''}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={enviar} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar cobro'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-1">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {clientName} debe{' '}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
            {formatCurrency(pendiente)}
          </span>{' '}
          de esta venta.
        </p>

        <FormField label="Cuánto se cobra">
          <CurrencyInput value={monto} onChange={(val: string) => setMonto(val)} placeholder="0" />
        </FormField>

        {/* Saldar del todo es el caso frecuente: se ofrece hecho en vez de
            obligar a teclear la cifra y arriesgar un céntimo de diferencia. */}
        <button
          type="button"
          onClick={() => setMonto(String(pendiente))}
          className="text-xs font-semibold text-primary underline-offset-2 hover:underline dark:text-accent"
        >
          Cobrar todo lo pendiente
        </button>

        <FormField label="Forma de pago">
          <Select
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
            options={[
              { value: '', label: 'Sin especificar' },
              // Por nombre, que es la convención que ya usa el modal de venta.
              ...(data.config.paymentMethods || []).map((p: any) => ({
                value: p.name,
                label: p.name,
              })),
            ]}
          />
        </FormField>

        <FormField label="Referencia (opcional)">
          <Input
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder="Número de transferencia, recibo…"
          />
        </FormField>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
