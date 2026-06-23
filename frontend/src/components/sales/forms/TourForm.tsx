import { useRef } from "react";
import { LuMap, LuFileText, LuUpload, LuFileCheck, LuX, LuSend } from "react-icons/lu";
import { Users, Trash2, PlusCircle } from "lucide-react";
import { FormField, Input, Combobox, Textarea, Select } from "../../ui/Form";
import { Button } from "../../ui/Button";
import { TourData, GuestInfo } from "../../../types";
import { ClientInfoSection, FinancialSection } from "./VoucherField";

interface TourFormProps {
  tour: TourData;
  mainClient: any;
  data: any;
  onChange: (updates: Partial<TourData>) => void;
  triggerError?: (msg: string) => void;
}

export function TourForm({ tour, mainClient, data, onChange, triggerError }: TourFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addGuest = () => {
    onChange({ guests: [...(tour.guests || []), { name: "", docType: "CC", docNumber: "" }] });
  };

  const removeGuest = (gIdx: number) => {
    const nextGuests = (tour.guests || []).filter((_, i) => i !== gIdx);
    onChange({ guests: nextGuests });
  };

  const updateGuest = (gIdx: number, gUpdates: Partial<GuestInfo>) => {
    const nextGuests = [...(tour.guests || [])];
    nextGuests[gIdx] = { ...nextGuests[gIdx], ...gUpdates };
    
    // For backward compatibility, update passengerName with the first guest's name
    const passengerName = gIdx === 0 ? (gUpdates.name || nextGuests[0]?.name || "") : (tour.passengerName || "");
    
    onChange({ guests: nextGuests, passengerName });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const currentVouchers = tour.vouchers || [];
      const newVouchers: Array<{ name: string; base64: string }> = [...currentVouchers];
      let filesProcessed = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            if (!newVouchers.some(v => v.name === file.name)) {
              newVouchers.push({ name: file.name, base64: reader.result });
            }
          }
          filesProcessed++;
          if (filesProcessed === files.length) {
            onChange({ vouchers: newVouchers });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const removeVoucherFile = (vIdx: number) => {
    const nextVouchers = (tour.vouchers || []).filter((_, i) => i !== vIdx);
    onChange({ vouchers: nextVouchers.length > 0 ? nextVouchers : undefined });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {mainClient && <ClientInfoSection client={mainClient} />}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
          <LuMap size={14} /> Tour Guiado
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Número de Adultos">
            <Input 
              type="text" 
              value={tour.adultsCount} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^0-9]/g, "");
                if (cleaned.length > 3) cleaned = cleaned.slice(0, 3);
                onChange({ adultsCount: cleaned === "" ? ("" as any) : parseInt(cleaned) });
              }} 
            />
          </FormField>
          <FormField label="Número de Niños">
            <Input 
              type="text" 
              value={tour.childrenCount} 
              onChange={(e) => {
                let cleaned = e.target.value.replace(/[^0-9]/g, "");
                if (cleaned.length > 3) cleaned = cleaned.slice(0, 3);
                onChange({ childrenCount: cleaned === "" ? ("" as any) : parseInt(cleaned) });
              }} 
            />
          </FormField>
          <FormField label="Edades de Niños (Opcional)">
            <Input 
              value={tour.childrenAges} 
              onChange={(e) => onChange({ childrenAges: e.target.value })} 
              placeholder="Ej: 5, 8, 12" 
              maxLength={40}
            />
          </FormField>
          <FormField label="Idioma del Guía">
            <Combobox
              value={tour.guideLanguage}
              onChange={(val) => onChange({ guideLanguage: val })}
              options={[
                { value: "español", label: "Español" },
                { value: "inglés", label: "Inglés" },
                { value: "portugués", label: "Portugués" },
                { value: "francés", label: "Francés" },
              ]}
            />
          </FormField>
          <FormField label="Teléfono">
            <Input value={tour.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+57 300 123 4567" />
          </FormField>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="needs-transport"
              checked={tour.needsTransport}
              onChange={(e) => onChange({ needsTransport: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="needs-transport" className="text-sm font-medium text-gray-700">
              Requiere Transporte
            </label>
          </div>
          <FormField label="Punto de Recogida">
            <Input 
              value={tour.pickupPoint} 
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "");
                onChange({ pickupPoint: cleaned });
              }} 
              placeholder="Hotel, Aeropuerto, etc." 
              maxLength={30}
            />
          </FormField>
          <FormField label="Condiciones Médicas">
            <Textarea value={tour.medicalConditions} onChange={(e) => onChange({ medicalConditions: e.target.value })} placeholder="Alergias, enfermedades, etc." rows={2} />
          </FormField>
          <FormField label="Toures" className="md:col-span-2">
            <Textarea value={tour.observations} onChange={(e) => onChange({ observations: e.target.value })} placeholder="Notas adicionales y desglose de toures aquí..." rows={6} />
          </FormField>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
            <Users size={14} />
            Integrantes del Tour
          </h4>
          <Button type="button" variant="outline" size="sm" onClick={addGuest}>
            <PlusCircle size={14} className="mr-1" />
            Agregar
          </Button>
        </div>
        <div className="space-y-3">
          {(tour.guests || []).map((guest, gIdx) => (
            <div key={gIdx} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Combobox
                  value={guest.name}
                  onChange={(val) => {
                    const cleaned = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
                    const client = (data?.clients || []).find(
                      (c: any) =>
                        (c.name === cleaned || `${c.firstName} ${c.lastName || ""}`.trim() === cleaned) &&
                        c.status === "active"
                    );
                    if (client) {
                      updateGuest(gIdx, {
                        name: client.name || `${client.firstName} ${client.lastName || ""}`.trim(),
                        docType: client.docType || guest.docType,
                        docNumber: client.docNumber || guest.docNumber,
                      });
                    } else {
                      updateGuest(gIdx, { name: cleaned });
                    }
                  }}
                  options={(data?.clients || [])
                    .filter((c: any) => c.status === "active" && String(c.id) !== String(mainClient?.id))
                    .map((c: any) => ({
                      value: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                      label: c.name || `${c.firstName} ${c.lastName || ""}`.trim(),
                    }))}
                  placeholder="Nombre completo"
                  preventNumbers={true}
                />
                <Select
                  value={guest.docType}
                  onChange={(e) => updateGuest(gIdx, { docType: e.target.value })}
                  options={data.config.documentTypes.map((d: any) => ({
                    value: d.abreviatura,
                    label: d.abreviatura,
                  }))}
                />
                <Input
                  value={guest.docNumber}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                    updateGuest(gIdx, { docNumber: cleaned });
                  }}
                  placeholder="Número de documento"
                  maxLength={20}
                />
              </div>
              {(tour.guests || []).length > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => removeGuest(gIdx)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <FinancialSection 
        supplierName={tour.supplierName}
        supplierCost={tour.supplierCost}
        supplierPaymentMethod={tour.supplierPaymentMethod}
        isPaymentMethodRequired={true}
        paymentMethods={data.config.cards}
        ta={tour.ta}
        suppliers={data.config.suppliers}
        onChange={(updates) => onChange(updates)}
      />

      <div className="mt-6 p-5 bg-accent/5 rounded-2xl border border-accent/10 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-accent uppercase tracking-widest flex items-center gap-2">
            <LuFileText size={14} /> Gestión de Vouchers (Múltiples Archivos)
          </h4>
          <span className="text-[10px] font-bold bg-accent/10 text-accent px-2 py-1 rounded-full border border-accent/20">
            Archivos Permitidos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Documentos de Vouchers">
            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                multiple
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-accent/30 rounded-xl bg-white hover:bg-accent/5 hover:border-accent transition-all group"
              >
                <div className="p-2 bg-accent/10 rounded-lg group-hover:scale-110 transition-transform">
                  <LuUpload className="text-accent" size={18} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-700">Subir Vouchers</p>
                  <p className="text-[10px] text-gray-400">PDF, Imágenes o DOC (Múltiples permitidos)</p>
                </div>
              </button>
            </div>
          </FormField>

          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={tour.sendVoucher || false}
                  onChange={(e) => onChange({ sendVoucher: e.target.checked })}
                />
                <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${tour.sendVoucher ? 'bg-accent' : 'bg-gray-200'}`} />
                <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${tour.sendVoucher ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-bold transition-colors ${tour.sendVoucher ? 'text-accent' : 'text-gray-500'}`}>
                  Enviar Vouchers al Cliente
                </span>
                <span className="text-[10px] text-gray-400">Se enviarán automáticamente al finalizar</span>
              </div>
            </label>
          </div>
        </div>

        {/* List of uploaded vouchers */}
        {tour.vouchers && tour.vouchers.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Archivos Adjuntos ({tour.vouchers.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tour.vouchers.map((v, vIdx) => (
                <div key={vIdx} className="flex items-center justify-between p-3 bg-white border border-accent/20 rounded-xl animate-fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                      <LuFileCheck className="text-emerald-600" size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-700 truncate" title={v.name}>{v.name}</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Archivo listo para enviar</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVoucherFile(vIdx)}
                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors shrink-0"
                  >
                    <LuX size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tour.sendVoucher && tour.vouchers && tour.vouchers.length > 0 && (
          <div className="mt-3 text-[10px] text-emerald-600 bg-emerald-50 p-2.5 rounded-lg flex items-center gap-2">
            <LuSend size={12} className="shrink-0" /> 
            <span>Confirmado: Se enviarán <strong>{tour.vouchers.length} archivo(s)</strong> de soporte al cliente.</span>
          </div>
        )}
      </div>
    </div>
  );
}