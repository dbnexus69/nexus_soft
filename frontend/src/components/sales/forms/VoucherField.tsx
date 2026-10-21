import { LuFileText, LuSend, LuUser, LuUpload, LuX, LuFileCheck, LuDollarSign, LuBuilding, LuCreditCard, LuImage } from "react-icons/lu";
import { Input, Combobox , CurrencyInput, Select} from "../../ui/Form";
import { FormField } from "../../ui/Form";
import { useRef, useState } from "react";
import * as api from "../../../api";
import type { Client, ConfigData, Quote } from "../../../types";

interface VoucherFieldProps {
  voucher?: { name: string; base64: string };
  vouchers?: Array<{ name: string; base64: string }>;
  multiple?: boolean;
  sendVoucher?: boolean;
  onChange: (updates: { 
    voucher?: { name: string; base64: string } | undefined; 
    vouchers?: Array<{ name: string; base64: string }> | undefined;
    sendVoucher?: boolean 
  }) => void;
}

export function VoucherField({ voucher, vouchers, multiple, sendVoucher, onChange }: VoucherFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (multiple) {
        const newVouchers: Array<{ name: string; base64: string }> = vouchers ? [...vouchers] : [];
        let filesProcessed = 0;
        files.forEach(file => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              newVouchers.push({ name: file.name, base64: reader.result });
            }
            filesProcessed++;
            if (filesProcessed === files.length) {
              onChange({ vouchers: newVouchers });
              if (fileInputRef.current) fileInputRef.current.value = "";
            }
          };
          reader.readAsDataURL(file);
        });
      } else {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            onChange({ voucher: { name: file.name, base64: reader.result } });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeFile = (index?: number) => {
    if (multiple && vouchers && index !== undefined) {
      const newVouchers = vouchers.filter((_, i) => i !== index);
      onChange({ vouchers: newVouchers });
    } else {
      onChange({ voucher: undefined });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="mt-6 p-5 bg-accent/5 rounded-2xl border border-accent/10 space-y-4">
      <h4 className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-2">
        <LuFileText size={14} /> Gestión de Voucher
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label={multiple ? "Documentos del Voucher" : "Documento del Voucher"}>
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              multiple={multiple}
            />
            
            {(!multiple && !voucher) || (multiple && (!vouchers || vouchers.length === 0)) ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-accent/30 rounded-xl bg-white hover:bg-accent/5 hover:border-accent transition-all group"
              >
                <div className="p-2 bg-accent/10 rounded-lg group-hover:scale-110 transition-transform">
                  <LuUpload className="text-accent" size={18} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-700">{multiple ? "Subir Vouchers" : "Subir Voucher"}</p>
                  <p className="text-xs text-gray-500">PDF, Imágenes o DOC (Máx. 10MB)</p>
                </div>
              </button>
            ) : null}

            {/* List of Vouchers (Multiple) */}
            {multiple && vouchers && vouchers.length > 0 && (
              <div className="space-y-2 mt-2">
                {vouchers.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-accent/20 rounded-xl animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <LuFileCheck className="text-emerald-600" size={18} />
                      </div>
                      <div className="max-w-[150px] md:max-w-[200px]">
                        <p className="text-sm font-bold text-gray-700 truncate">{v.name}</p>
                        <p className="text-xs text-emerald-600 font-medium">Archivo listo</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-lg transition-colors"
                    >
                      <LuX size={18} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-2 py-2 text-xs font-bold text-accent border border-accent/20 rounded-lg hover:bg-accent/10 transition-colors"
                >
                  + Añadir otro documento
                </button>
              </div>
            )}

            {/* Single Voucher */}
            {!multiple && voucher && (
              <div className="flex items-center justify-between p-3 bg-white border border-accent/20 rounded-xl animate-fade-in mt-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <LuFileCheck className="text-emerald-600" size={18} />
                  </div>
                  <div className="max-w-[150px] md:max-w-[200px]">
                    <p className="text-sm font-bold text-gray-700 truncate">{voucher.name}</p>
                    <p className="text-xs text-emerald-600 font-medium">Archivo listo para enviar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile()}
                  className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-lg transition-colors"
                >
                  <LuX size={18} />
                </button>
              </div>
            )}
          </div>
        </FormField>
        
        <div className="flex items-center gap-3 pt-6">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={sendVoucher || false}
                onChange={(e) => onChange({ sendVoucher: e.target.checked })}
              />
              <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${sendVoucher ? 'bg-accent' : 'bg-gray-200'}`} />
              <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${sendVoucher ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-bold transition-colors ${sendVoucher ? 'text-accent' : 'text-gray-500'}`}>
                Enviar {multiple ? "Vouchers" : "Voucher"} al Cliente
              </span>
              <span className="text-xs text-gray-500">Se enviará automáticamente al finalizar</span>
            </div>
          </label>
        </div>
      </div>

      {sendVoucher && ((!multiple && voucher) || (multiple && vouchers && vouchers.length > 0)) && (
        <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg flex items-center gap-2">
          <LuSend size={12} /> Confirmado: {multiple ? `${vouchers?.length} documentos listos para enviar.` : `El archivo ${voucher?.name} se enviará al cliente.`}
        </div>
      )}
    </div>
  );
}

interface ClientInfoSectionProps {
  client: Partial<Pick<Client, 'name' | 'docNumber' | 'email' | 'phone' | 'docType'>>;
}

export function ClientInfoSection({ client }: ClientInfoSectionProps) {
  return (
    <div className="mb-6 p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
      <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
        <LuUser size={14} /> Información del Titular (Venta Principal)
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase">Nombre</p>
          <p className="text-xs font-bold text-gray-700">{client.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase">Documento</p>
          <p className="text-xs font-bold text-gray-700">{client.docType} {client.docNumber}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase">Email</p>
          <p className="text-xs font-bold text-gray-700 truncate">{client.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-bold uppercase">Teléfono</p>
          <p className="text-xs font-bold text-gray-700">{client.phone}</p>
        </div>
      </div>
    </div>
  );
}
interface FinancialSectionProps {
  supplierName?: string;
  supplierCost?: number;
  ta?: number;
  supplierPaymentMethod?: string;
  isPaymentMethodRequired?: boolean;
  paymentMethods?: ConfigData['cards'];
  suppliers?: { id: number; name: string }[];
  onChange: (updates: { supplierName?: string; supplierCost?: number; ta?: number; supplierPaymentMethod?: string }) => void;
  /**
   * Cotizando (spec 007): sin proveedor ni método de pago al proveedor — son
   * decisiones de compra que no hacen falta para cotizar, solo costo y ganancia.
   */
  cotizando?: boolean;
}

export function FinancialSection({ supplierName, supplierCost, ta, supplierPaymentMethod, isPaymentMethodRequired, paymentMethods = [], suppliers = [], onChange, cotizando = false }: FinancialSectionProps) {
  const supplierOptions = suppliers.map(s => ({ value: s.name, label: s.name }));

  const handleNumericChange = (field: 'supplierCost' | 'ta', value: string) => {
    // Convertimos a número, prevenimos negativos y manejamos valores vacíos
    const numValue = Math.max(0, parseFloat(value) || 0);
    onChange({ [field]: numValue });
  };

  const totalCost = (Number(supplierCost) || 0) + (Number(ta) || 0);

  return (
    <div className="mt-6 p-5 bg-emerald-50/50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
          <LuDollarSign size={14} /> Detalles Financieros del Servicio
        </h4>
        <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/30">
          Validación Activa
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!cotizando && (
        <FormField label="Proveedor">
          <div className="relative">
            <LuBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" size={16} />
            <Combobox
              value={supplierName || ""}
              onChange={(val) => onChange({ supplierName: val })}
              options={supplierOptions}
              placeholder="Seleccionar proveedor..."
              inputClassName="pl-8"
              preventNumbers={true}
            />
          </div>
        </FormField>
        )}
        <FormField label="Costo Proveedor">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
            <CurrencyInput 
              value={supplierCost || ""} 
              onChange={(val) => handleNumericChange('supplierCost', val)} 
              className={`pl-7 transition-all ${!supplierCost ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10' : 'border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 dark:focus:border-emerald-400 dark:bg-slate-900/50'}`}
              placeholder="0.00" 
            />
          </div>
        </FormField>
        <FormField label="Ganancia">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
            <CurrencyInput 
              value={ta || ""} 
              onChange={(val) => handleNumericChange('ta', val)} 
              className={`pl-7 transition-all ${!ta ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10' : 'border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 dark:focus:border-emerald-400 dark:bg-slate-900/50'}`}
              placeholder="0.00" 
            />
          </div>
        </FormField>
        {!cotizando && (
        <FormField label={`Método de Pago${isPaymentMethodRequired ? ' *' : ''}`}>
          <div className="relative group">
            <LuCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" size={16} />
            <Combobox
              value={supplierPaymentMethod || ""}
              onChange={(val) => onChange({ supplierPaymentMethod: val })}
              options={paymentMethods.map(m => ({
                value: String(m.id),
                label: m.lastFourDigits ? `${m.name} (**${m.lastFourDigits})` : m.name
              }))}
              placeholder="Seleccionar método..."
              inputClassName={`pl-8 ${isPaymentMethodRequired && !supplierPaymentMethod ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10' : 'border-emerald-200 dark:border-emerald-500/30 dark:bg-slate-900/50'}`}
              preventNumbers={false}
              direction="up"
            />
          </div>
        </FormField>
        )}
      </div>
      
      <div className="flex items-center justify-between p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm animate-fade-in">
        <div className="flex flex-col">
          <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tighter">Costo Total para la Agencia</span>
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">(Costo Proveedor + Ganancia)</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-lg font-black text-emerald-900 dark:text-emerald-300 leading-none">
            ${totalCost.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
          </span>
          {totalCost > 0 && <span className="text-xs text-emerald-600 font-bold uppercase">Valor Liquidado</span>}
        </div>
      </div>
    </div>
  );
}

interface ImagesFieldProps {
  images?: string[];
  /** Sin estos dos, la línea todavía no existe en el servidor (sin guardar) y no hay a dónde subir. */
  quoteId?: number;
  lineId?: string;
  onChange: (images: string[]) => void;
  onError?: (msg: string) => void;
}

const TIPOS_IMAGEN_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGENES_POR_SERVICIO = 5;
const MAX_BYTES_IMAGEN = 3 * 1024 * 1024;

/**
 * Hasta 5 fotos de un servicio cotizado, para que el cliente vea cómo es (spec 021). A
 * diferencia de todo lo demás del formulario, cada imagen sube y se borra al toque (no espera
 * al "Guardar" de la cotización): un archivo no puede viajar dentro del JSON de la cotización,
 * así que necesita el `lineId` que le puso el servidor al guardarla por primera vez — una línea
 * recién agregada, sin guardar, no lo tiene todavía, y el campo queda deshabilitado hasta
 * entonces (mismo límite que ya tienen los vouchers de producto de una venta real).
 *
 * Exclusivo de cotizar: cada uno de los 15 `forms/*.tsx` lo envuelve en `{cotizando && (...)}`,
 * al revés del resto de ese prop.
 */
export function ImagesField({ images = [], quoteId, lineId, onChange, onError }: ImagesFieldProps) {
  const [subiendo, setSubiendo] = useState(false);
  const [borrandoIdx, setBorrandoIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const puedeSubir = Boolean(quoteId && lineId);
  const imagenesDe = (cotizacion: Quote): string[] =>
    (cotizacion.lines.find((l) => l.id === lineId)?.detalle?.images as string[] | undefined) ?? [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file || !quoteId || !lineId) return;
    if (!TIPOS_IMAGEN_PERMITIDOS.includes(file.type)) {
      onError?.("La imagen tiene que ser PNG, JPG o WebP");
      return;
    }
    if (file.size > MAX_BYTES_IMAGEN) {
      onError?.("La imagen no puede pesar más de 3 MB");
      return;
    }
    setSubiendo(true);
    try {
      const cotizacion = await api.uploadQuoteLineImage(quoteId, lineId, file, file.name);
      onChange(imagenesDe(cotizacion));
    } catch (err: any) {
      onError?.(err?.response?.data?.error?.message || "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = async (idx: number) => {
    if (!quoteId || !lineId) return;
    setBorrandoIdx(idx);
    try {
      const cotizacion = await api.deleteQuoteLineImage(quoteId, lineId, idx);
      onChange(imagenesDe(cotizacion));
    } catch (err: any) {
      onError?.(err?.response?.data?.error?.message || "No se pudo borrar la imagen");
    } finally {
      setBorrandoIdx(null);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3">
      <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
        <LuImage size={14} /> Imágenes del Servicio
      </h4>
      {!puedeSubir ? (
        <p className="text-xs text-gray-500 italic">Guardá la cotización primero para poder agregar fotos.</p>
      ) : (
        <>
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {images.map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                  <img src={url} alt={`Imagen ${idx + 1} del servicio`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => quitar(idx)}
                    disabled={borrandoIdx !== null}
                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                    aria-label={`Quitar imagen ${idx + 1}`}
                  >
                    {borrandoIdx === idx
                      ? <span className="block w-3 h-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      : <LuX size={12} />}
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length < MAX_IMAGENES_POR_SERVICIO ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendo}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <LuUpload size={16} />
                {subiendo ? "Subiendo..." : "Agregar imagen"}
              </button>
            </>
          ) : (
            <p className="text-xs text-gray-500 italic">Ya tiene el máximo de {MAX_IMAGENES_POR_SERVICIO} imágenes.</p>
          )}
        </>
      )}
    </div>
  );
}
