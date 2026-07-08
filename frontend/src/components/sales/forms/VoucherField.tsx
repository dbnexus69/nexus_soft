import { LuFileText, LuSend, LuUser, LuUpload, LuX, LuFileCheck, LuDollarSign, LuBuilding, LuCreditCard } from "react-icons/lu";
import { Input, Combobox , CurrencyInput, Select} from "../../ui/Form";
import { FormField } from "../../ui/Form";
import { useRef } from "react";

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
                  <p className="text-[10px] text-gray-400">PDF, Imágenes o DOC (Máx. 10MB)</p>
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
                        <p className="text-[10px] text-emerald-600 font-medium">Archivo listo</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
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
                    <p className="text-[10px] text-emerald-600 font-medium">Archivo listo para enviar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile()}
                  className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
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
              <span className="text-[10px] text-gray-400">Se enviará automáticamente al finalizar</span>
            </div>
          </label>
        </div>
      </div>

      {sendVoucher && ((!multiple && voucher) || (multiple && vouchers && vouchers.length > 0)) && (
        <div className="mt-3 text-[10px] text-emerald-600 bg-emerald-50 p-2 rounded-lg flex items-center gap-2">
          <LuSend size={12} /> Confirmado: {multiple ? `${vouchers?.length} documentos listos para enviar.` : `El archivo ${voucher?.name} se enviará al cliente.`}
        </div>
      )}
    </div>
  );
}

interface ClientInfoSectionProps {
  client: {
    name: string;
    docNumber: string;
    email: string;
    phone: string;
    docType: string;
  };
}

export function ClientInfoSection({ client }: ClientInfoSectionProps) {
  return (
    <div className="mb-6 p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
      <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
        <LuUser size={14} /> Información del Titular (Venta Principal)
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Nombre</p>
          <p className="text-xs font-bold text-gray-700">{client.name}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Documento</p>
          <p className="text-xs font-bold text-gray-700">{client.docType} {client.docNumber}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
          <p className="text-xs font-bold text-gray-700 truncate">{client.email}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Teléfono</p>
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
  paymentMethods?: any[];
  suppliers?: { id: number; name: string }[];
  onChange: (updates: { supplierName?: string; supplierCost?: number; ta?: number; supplierPaymentMethod?: string }) => void;
}

export function FinancialSection({ supplierName, supplierCost, ta, supplierPaymentMethod, isPaymentMethodRequired, paymentMethods = [], suppliers = [], onChange }: FinancialSectionProps) {
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
        <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/30">
          Validación Activa
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Proveedor">
          <div className="relative">
            <LuBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={16} />
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
        <FormField label="Costo Proveedor">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
            <CurrencyInput 
              value={supplierCost || ""} 
              onChange={(val) => handleNumericChange('supplierCost', val)} 
              className={`pl-7 transition-all ${!supplierCost ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10' : 'border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 dark:focus:border-emerald-400 dark:bg-slate-900/50'}`}
              placeholder="0.00" 
            />
          </div>
        </FormField>
        <FormField label="T.A (Tarifa Admin)">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
            <CurrencyInput 
              value={ta || ""} 
              onChange={(val) => handleNumericChange('ta', val)} 
              className={`pl-7 transition-all ${!ta ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10' : 'border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-500 dark:focus:border-emerald-400 dark:bg-slate-900/50'}`}
              placeholder="0.00" 
            />
          </div>
        </FormField>
        <FormField label={`Método de Pago${isPaymentMethodRequired ? ' *' : ''}`}>
          <div className="relative group">
            <LuCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={16} />
            <Combobox
              value={supplierPaymentMethod || ""}
              onChange={(val) => onChange({ supplierPaymentMethod: val })}
              options={paymentMethods.map(m => ({
                value: m.name,
                label: m.lastFourDigits ? `${m.name} (**${m.lastFourDigits})` : m.name
              }))}
              placeholder="Seleccionar método..."
              inputClassName={`pl-8 ${isPaymentMethodRequired && !supplierPaymentMethod ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10' : 'border-emerald-200 dark:border-emerald-500/30 dark:bg-slate-900/50'}`}
              preventNumbers={false}
              direction="up"
            />
          </div>
        </FormField>
      </div>
      
      <div className="flex items-center justify-between p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm animate-fade-in">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tighter">Costo Total para la Agencia</span>
          <span className="text-[9px] text-gray-400 dark:text-slate-400 font-medium">(Costo Proveedor + Tarifa Administrativa)</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-lg font-black text-emerald-900 dark:text-emerald-300 leading-none">
            ${totalCost.toLocaleString('es-CO', { minimumFractionDigits: 0 })}
          </span>
          {totalCost > 0 && <span className="text-[9px] text-emerald-600 font-bold uppercase">Valor Liquidado</span>}
        </div>
      </div>
    </div>
  );
}
