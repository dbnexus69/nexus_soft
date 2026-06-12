import { Boxes, PlaneTakeoff, Building2, Coins, Database, MapPin, Luggage, ShieldCheck, Info, Briefcase, ArrowRight, ArrowLeftRight, ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import * as LuIcons from "react-icons/lu";
import { FormField, Input, Select, Combobox } from '../ui/Form';
import { Button } from '../ui/Button';

export default function ConfigForms({ section, formData, setFormData, errors, setErrors, data }: any) {
  switch (section) {
    case 'cards':
      return (
        <>
          <FormField label="Nombre" error={errors.name}>
            <Input 
              value={formData.name || ''} 
              onChange={e => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }} 
              placeholder="Ej. Bancolombia Principal"
              error={errors.name}
            />
          </FormField>
          <FormField label="Método de Pago" error={errors.paymentMethod}>
            <Select
              value={formData.paymentMethod || ''}
              onChange={e => {
                setFormData({ ...formData, paymentMethod: e.target.value });
                if (errors.paymentMethod) setErrors({ ...errors, paymentMethod: '' });
              }}
              options={[
                { value: '', label: 'Seleccione un método de pago' },
                { value: 'Llaves', label: 'Llaves' },
                { value: 'Tarjeta de Bancolombia', label: 'Tarjeta de Bancolombia' },
                { value: 'Tarjeta Davivienda', label: 'Tarjeta Davivienda' },
                { value: 'Tarjeta de Crédito', label: 'Tarjeta de Crédito' },
                { value: 'Tarjeta de Débito', label: 'Tarjeta de Débito' },
                { value: 'Transferencia', label: 'Transferencia' }
              ]}
              error={errors.paymentMethod}
            />
          </FormField>
          <FormField label="Últimos 4 Dígitos" error={errors.lastFourDigits}>
            <Input 
              value={formData.lastFourDigits || ''} 
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setFormData({ ...formData, lastFourDigits: val });
                if (errors.lastFourDigits) setErrors({ ...errors, lastFourDigits: '' });
              }} 
              placeholder="Ej. 4321"
              maxLength={4}
              error={errors.lastFourDigits}
            />
          </FormField>
          <FormField label="Estado" error={errors.status}>
            <Select
              value={formData.status || ''}
              onChange={e => {
                setFormData({ ...formData, status: e.target.value });
                if (errors.status) setErrors({ ...errors, status: '' });
              }}
              options={[
                { value: '', label: 'Seleccione un estado' },
                { value: 'Activo', label: 'Activo' },
                { value: 'Inactivo', label: 'Inactivo' }
              ]}
              error={errors.status}
            />
          </FormField>
          <FormField label="Descripción" error={errors.description}>
            <Input 
              value={formData.description || ''} 
              onChange={e => {
                setFormData({ ...formData, description: e.target.value });
                if (errors.description) setErrors({ ...errors, description: '' });
              }} 
              placeholder="Ej. Tarjeta corporativa para compras principales..."
              error={errors.description}
            />
          </FormField>
        </>
      );
    case 'paymentMethods':
      return (
        <FormField label="Nombre" error={errors.name}>
          <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} error={errors.name} />
        </FormField>
      );
    case 'documentTypes':
      return (
        <FormField label="Nombre" error={errors.name}>
          <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} error={errors.name} />
        </FormField>
      );
    case 'airlines':
      return (
        <>
          <FormField label="Nombre" error={errors.name}>
            <Input 
              value={formData.name || ''} 
              onChange={e => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }} 
              placeholder="Ej. Avianca"
              error={errors.name}
            />
          </FormField>
          <FormField label="Código IATA" error={errors.code}>
            <Input 
              value={formData.code || ''} 
              onChange={e => {
                setFormData({ ...formData, code: e.target.value.toUpperCase().slice(0, 3) });
                if (errors.code) setErrors({ ...errors, code: '' });
              }} 
              placeholder="Ej. AV"
              maxLength={3}
              error={errors.code}
            />
          </FormField>
          <FormField label="Cobertura" error={errors.type}>
            <Select
              value={formData.type || ''}
              onChange={e => {
                setFormData({ ...formData, type: e.target.value });
                if (errors.type) setErrors({ ...errors, type: '' });
              }}
              options={[
                { value: '', label: 'Seleccione una cobertura' },
                { value: 'Nacional', label: 'Nacional' },
                { value: 'Internacional', label: 'Internacional' }
              ]}
              error={errors.type}
            />
          </FormField>
          <FormField label="Enlace del Sitio Web (Link)" error={errors.website}>
            <Input 
              value={formData.website || ''} 
              onChange={e => {
                setFormData({ ...formData, website: e.target.value });
                if (errors.website) setErrors({ ...errors, website: '' });
              }} 
              placeholder="Ej. https://www.avianca.com"
              error={errors.website}
            />
          </FormField>
        </>
      );
    case 'suppliers':
      return (
        <>
          <FormField label="Nombre" error={errors.name}>
            <Input 
              value={formData.name || ''} 
              onChange={e => {
                const val = e.target.value.replace(/[0-9]/g, "");
                setFormData({ ...formData, name: val });
                if (errors.name) setErrors({ ...errors, name: '' });
              }} 
              placeholder="Ej. Hotel Dann Carlton"
              error={errors.name} 
            />
          </FormField>
          <FormField label="Tipo" error={errors.type}>
            <Select
              value={formData.type || ''}
              onChange={e => {
                setFormData({ ...formData, type: e.target.value });
                if (errors.type) setErrors({ ...errors, type: '' });
              }}
              options={[
                { value: '', label: 'Seleccione un tipo' },
                { value: 'Hotel', label: 'Hotel' }, 
                { value: 'Operador', label: 'Operador' }, 
                { value: 'Operador Internacional', label: 'Operador Internacional' },
                { value: 'Aerolinea', label: 'Aerolínea' },
                { value: 'Consolidadores', label: 'Consolidadores' },
                { value: 'Asistencia de viajes', label: 'Asistencia de Viajes' }
              ]}
              error={errors.type}
            />
          </FormField>
          <FormField label="Email de Contacto (Opcional)" error={errors.email}>
            <Input 
              value={formData.email || ''} 
              onChange={e => {
                setFormData({ ...formData, email: e.target.value.replace(/\s/g, '').toLowerCase() });
                if (errors.email) setErrors({ ...errors, email: '' });
              }} 
              placeholder="Ej. reservas@danncarlton.com"
              error={errors.email} 
            />
          </FormField>
          <FormField label="Teléfono de Contacto (Opcional)" error={errors.phone}>
            <Input 
              value={formData.phone || ''} 
              onChange={e => {
                setFormData({ ...formData, phone: e.target.value });
                if (errors.phone) setErrors({ ...errors, phone: '' });
              }} 
              placeholder="Ej. 601-744-4444"
              error={errors.phone} 
            />
          </FormField>
          <FormField label="Enlace del Sitio Web (Link)" error={errors.website}>
            <Input 
              value={formData.website || ''} 
              onChange={e => {
                setFormData({ ...formData, website: e.target.value });
                if (errors.website) setErrors({ ...errors, website: '' });
              }} 
              placeholder="Ej. https://www.danncarlton.com"
              error={errors.website} 
            />
          </FormField>
        </>
      );
    case 'airports':
      return (
        <>
          <FormField label="Nombre del Aeropuerto" error={errors.name}>
            <Input 
              value={formData.name || ''} 
              onChange={e => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }} 
              placeholder="Ej. Aeropuerto Internacional El Dorado"
              error={errors.name}
            />
          </FormField>
          <FormField label="Ciudad" error={errors.city}>
            <Input 
              value={formData.city || ''} 
              onChange={e => {
                setFormData({ ...formData, city: e.target.value });
                if (errors.city) setErrors({ ...errors, city: '' });
              }} 
              placeholder="Ej. Bogotá"
              error={errors.city}
            />
          </FormField>
          <FormField label="País" error={errors.country}>
            <Input 
              value={formData.country || ''} 
              onChange={e => {
                setFormData({ ...formData, country: e.target.value });
                if (errors.country) setErrors({ ...errors, country: '' });
              }} 
              placeholder="Ej. Colombia"
              error={errors.country}
            />
          </FormField>
          <FormField label="Abreviación IATA" error={errors.abbreviation}>
            <Input 
              value={formData.abbreviation || ''} 
              onChange={e => {
                setFormData({ ...formData, abbreviation: e.target.value.toUpperCase().slice(0, 3) });
                if (errors.abbreviation) setErrors({ ...errors, abbreviation: '' });
              }} 
              placeholder="Ej. BOG"
              maxLength={3}
              error={errors.abbreviation}
            />
          </FormField>
          <FormField label="Cobertura / Tipo" error={errors.type}>
            <Select
              value={formData.type || ''}
              onChange={e => {
                setFormData({ ...formData, type: e.target.value });
                if (errors.type) setErrors({ ...errors, type: '' });
              }}
              options={[
                { value: '', label: 'Seleccione tipo de cobertura' },
                { value: 'Nacional', label: 'Nacional' },
                { value: 'Internacional', label: 'Internacional' },
                { value: 'Ambos', label: 'Ambos (Nacional e Internacional)' }
              ]}
              error={errors.type}
            />
          </FormField>
          <FormField label="Estado" error={errors.status}>
            <Select
              value={formData.status || ''}
              onChange={e => {
                setFormData({ ...formData, status: e.target.value });
                if (errors.status) setErrors({ ...errors, status: '' });
              }}
              options={[
                { value: '', label: 'Seleccione estado' },
                { value: 'Activo', label: 'Activo' },
                { value: 'Inactivo', label: 'Inactivo' }
              ]}
              error={errors.status}
            />
          </FormField>
        </>
      );
    case 'baggage':
      return (
        <>
          <FormField label="Aerolínea" error={errors.airlineName}>
            <Combobox
              value={formData.airlineName || ''}
              onChange={val => {
                setFormData({ ...formData, airlineName: val });
                if (errors.airlineName) setErrors({ ...errors, airlineName: '' });
              }}
              options={data.config.airlines.map((a: any) => ({ value: a.name, label: a.name }))}
              placeholder="Seleccione o escriba aerolínea"
            />
          </FormField>
          <FormField label="Tipo de Tarifa / Cabina" error={errors.fareType}>
            <Input 
              value={formData.fareType || ''} 
              onChange={e => {
                setFormData({ ...formData, fareType: e.target.value });
                if (errors.fareType) setErrors({ ...errors, fareType: '' });
              }} 
              placeholder="Ej. Classic (M) o Light (S)"
              error={errors.fareType} 
            />
          </FormField>
          <FormField label="Artículo Personal (Morral/Bolso)" error={errors.personalItem}>
            <Input 
              value={formData.personalItem || ''} 
              onChange={e => {
                setFormData({ ...formData, personalItem: e.target.value });
                if (errors.personalItem) setErrors({ ...errors, personalItem: '' });
              }} 
              placeholder="Ej. Incluido (45 x 35 x 20 cm)"
              error={errors.personalItem} 
            />
          </FormField>
          <FormField label="Equipaje de Mano (Cabina)" error={errors.carryOn}>
            <Input 
              value={formData.carryOn || ''} 
              onChange={e => {
                setFormData({ ...formData, carryOn: e.target.value });
                if (errors.carryOn) setErrors({ ...errors, carryOn: '' });
              }} 
              placeholder="Ej. 10 kg (55 x 35 x 25 cm) Incluido o No incluido"
              error={errors.carryOn} 
            />
          </FormField>
          <FormField label="Equipaje Documentado (Bodega)" error={errors.checkedBag}>
            <Input 
              value={formData.checkedBag || ''} 
              onChange={e => {
                setFormData({ ...formData, checkedBag: e.target.value });
                if (errors.checkedBag) setErrors({ ...errors, checkedBag: '' });
              }} 
              placeholder="Ej. 23 kg (158 cm lineales) Incluido o No incluido"
              error={errors.checkedBag} 
            />
          </FormField>
          <FormField label="Descripción / Notas Adicionales" error={errors.notes}>
            <Input 
              value={formData.notes || ''} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              placeholder="Ej. Sujeto a cambios de la aerolínea"
              error={errors.notes} 
            />
          </FormField>
        </>
      );
    case 'packages':
      return (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
          {/* Información Básica */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
              <Boxes size={14} className="text-accent" /> Información Básica del Paquete
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nombre del Paquete" error={errors.name}>
                <Input 
                  value={formData.name || ''} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="Ej. Cancún Mágico"
                />
              </FormField>
              <FormField label="Destino" error={errors.destination}>
                <Input 
                  value={formData.destination || ''} 
                  onChange={e => setFormData({ ...formData, destination: e.target.value })} 
                  placeholder="Ej. Cancún, México"
                />
              </FormField>
              <FormField label="Noches" error={errors.nights}>
                <Input 
                  type="number"
                  value={formData.nights || ''} 
                  onChange={e => setFormData({ ...formData, nights: parseInt(e.target.value) })} 
                  placeholder="Ej. 5"
                />
              </FormField>
            </div>
          </div>

          {/* Vuelo - Estilo TicketForm Completo */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-6">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <PlaneTakeoff size={14} className="text-blue-600" /> Detalles del Vuelo (Plantilla)
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Aerolínea">
                <Combobox 
                  value={formData.flight?.airline || ''} 
                  onChange={val => setFormData({ ...formData, flight: { ...formData.flight, airline: val } })} 
                  options={data.config.airlines.map((a: any) => ({ value: a.name, label: a.name }))}
                  placeholder="Seleccionar aerolínea..."
                />
              </FormField>
              <FormField label="Ruta Resumen">
                <Input 
                  value={formData.flight?.route || ''} 
                  onChange={e => setFormData({ ...formData, flight: { ...formData.flight, route: e.target.value } })} 
                  placeholder="Ej. BOG-CUN-BOG"
                />
              </FormField>
            </div>

            {/* Tramos de Ida */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[10px] font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2">
                  <ArrowRight size={12} className="text-primary" /> Trayectos de Ida
                </h5>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px]"
                  onClick={() => {
                    const legs = formData.flight?.legs || [];
                    setFormData({
                      ...formData,
                      flight: {
                        ...formData.flight,
                        flightMode: 'round_trip',
                        legs: [...legs, { origin: '', destination: '', flightNumber: '', seat: '' }]
                      }
                    });
                  }}
                >
                  <PlusCircle size={11} className="mr-1" /> Añadir Tramo
                </Button>
              </div>

              {(formData.flight?.legs || [{ origin: '', destination: '', flightNumber: '', seat: '' }]).map((leg: any, idx: number) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 relative group border border-gray-100">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const legs = formData.flight.legs.filter((_: any, i: number) => i !== idx);
                        setFormData({ ...formData, flight: { ...formData.flight, legs } });
                      }}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FormField label="Origen">
                      <Combobox 
                        value={leg.origin} 
                        onChange={val => {
                          const nextLegs = [...(formData.flight?.legs || [{ origin: '', destination: '', flightNumber: '', seat: '' }])];
                          nextLegs[idx] = { ...nextLegs[idx], origin: val };
                          setFormData({ ...formData, flight: { ...formData.flight, legs: nextLegs, flightMode: 'round_trip' } });
                        }}
                        options={data.config.airports.map((a: any) => ({ value: a.abbreviation, label: `${a.abbreviation} - ${a.name}` }))}
                        placeholder="Ej. BOG"
                      />
                    </FormField>
                    <FormField label="Destino">
                      <Combobox 
                        value={leg.destination} 
                        onChange={val => {
                          const nextLegs = [...(formData.flight?.legs || [{ origin: '', destination: '', flightNumber: '', seat: '' }])];
                          nextLegs[idx] = { ...nextLegs[idx], destination: val };
                          setFormData({ ...formData, flight: { ...formData.flight, legs: nextLegs, flightMode: 'round_trip' } });
                        }}
                        options={data.config.airports.map((a: any) => ({ value: a.abbreviation, label: `${a.abbreviation} - ${a.name}` }))}
                        placeholder="Ej. CUN"
                      />
                    </FormField>
                    <FormField label="N° Vuelo">
                      <Input 
                        value={leg.flightNumber} 
                        onChange={e => {
                          const nextLegs = [...(formData.flight?.legs || [{ origin: '', destination: '', flightNumber: '', seat: '' }])];
                          nextLegs[idx] = { ...nextLegs[idx], flightNumber: e.target.value };
                          setFormData({ ...formData, flight: { ...formData.flight, legs: nextLegs, flightMode: 'round_trip' } });
                        }}
                        placeholder="Ej. AV93"
                      />
                    </FormField>
                    <FormField label="Asiento">
                      <Input 
                        value={leg.seat} 
                        onChange={e => {
                          const nextLegs = [...(formData.flight?.legs || [{ origin: '', destination: '', flightNumber: '', seat: '' }])];
                          nextLegs[idx] = { ...nextLegs[idx], seat: e.target.value };
                          setFormData({ ...formData, flight: { ...formData.flight, legs: nextLegs, flightMode: 'round_trip' } });
                        }}
                        placeholder="Ej. 12A"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>

            {/* Trayecto de Regreso - Siempre visible para paquetes */}
            <div className="bg-blue-50/30 rounded-xl border border-blue-100 p-4 space-y-3">
              <h5 className="text-[10px] font-bold text-blue-700 uppercase tracking-widest flex items-center gap-2">
                <ArrowLeft size={12} /> Trayecto de Regreso (Ida y Vuelta)
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FormField label="Origen">
                  <Combobox 
                    value={formData.flight?.returnLeg?.origin || ''} 
                    onChange={val => setFormData({ ...formData, flight: { ...formData.flight, returnLeg: { ...formData.flight?.returnLeg, origin: val }, flightMode: 'round_trip' } })}
                    options={data.config.airports.map((a: any) => ({ value: a.abbreviation, label: `${a.abbreviation} - ${a.name}` }))}
                    placeholder="Ej. CUN"
                  />
                </FormField>
                <FormField label="Destino">
                  <Combobox 
                    value={formData.flight?.returnLeg?.destination || ''} 
                    onChange={val => setFormData({ ...formData, flight: { ...formData.flight, returnLeg: { ...formData.flight?.returnLeg, destination: val }, flightMode: 'round_trip' } })}
                    options={data.config.airports.map((a: any) => ({ value: a.abbreviation, label: `${a.abbreviation} - ${a.name}` }))}
                    placeholder="Ej. BOG"
                  />
                </FormField>
                <FormField label="N° Vuelo">
                  <Input 
                    value={formData.flight?.returnLeg?.flightNumber || ''} 
                    onChange={e => setFormData({ ...formData, flight: { ...formData.flight, returnLeg: { ...formData.flight?.returnLeg, flightNumber: e.target.value }, flightMode: 'round_trip' } })}
                    placeholder="Ej. AV94"
                  />
                </FormField>
                <FormField label="Asiento">
                  <Input 
                    value={formData.flight?.returnLeg?.seat || ''} 
                    onChange={e => setFormData({ ...formData, flight: { ...formData.flight, returnLeg: { ...formData.flight?.returnLeg, seat: e.target.value }, flightMode: 'round_trip' } })}
                    placeholder="Ej. 14C"
                  />
                </FormField>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Plan de Equipaje">
                <Select
                  value={formData.flight?.baggagePlan || ''}
                  onChange={(e) => {
                    const plan = data.config.baggage.find((b: any) => `${b.airlineName} - ${b.fareType}` === e.target.value);
                    setFormData({ 
                      ...formData, 
                      flight: { 
                        ...formData.flight, 
                        baggagePlan: e.target.value,
                        cabinBaggage: plan ? plan.carryOn : formData.flight?.cabinBaggage,
                        checkedBaggage: plan ? plan.checkedBag : formData.flight?.checkedBaggage
                      } 
                    });
                  }}
                  options={[
                    { value: '', label: 'Seleccionar plan...' },
                    ...data.config.baggage.map((b: any) => ({
                      value: `${b.airlineName} - ${b.fareType}`,
                      label: `${b.airlineName} - ${b.fareType}`,
                    })),
                  ]}
                />
              </FormField>
              
            </div>
          </div>

          {/* Alojamiento - Estilo HotelForm */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
              <Building2 size={14} className="text-emerald-600" /> Alojamiento (Plantilla)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nombre del Hotel">
                <Input 
                  value={formData.accommodation?.hotel || ''} 
                  onChange={e => setFormData({ ...formData, accommodation: { ...formData.accommodation, hotel: e.target.value } })} 
                  placeholder="Ej. Grand Oasis"
                />
              </FormField>
              <FormField label="Proveedor">
                <Combobox
                  value={formData.accommodation?.supplier || ''}
                  onChange={(val) => setFormData({ ...formData, accommodation: { ...formData.accommodation, supplier: val } })}
                  options={data.config.suppliers.map((s: any) => ({ value: s.name, label: s.name }))}
                  placeholder="Seleccionar proveedor..."
                  preventNumbers={true}
                />
              </FormField>
              <FormField label="Tipo de Hotel">
                <Select
                  value={formData.accommodation?.hotelType || ""}
                  onChange={(e) => setFormData({ ...formData, accommodation: { ...formData.accommodation, hotelType: e.target.value } })}
                  options={[
                    { value: "", label: "Seleccionar tipo..." },
                    { value: "hotel", label: "Hotel" },
                    { value: "hotel_turistico", label: "Hotel Turístico" },
                    { value: "resort", label: "Resort / Todo Incluido" },
                    { value: "boutique", label: "Hotel Boutique" },
                    { value: "apartamento", label: "Apartamento / AirBnB" },
                    { value: "hostal", label: "Hostal / Albergue" },
                    { value: "fincas", label: "Finca / Casa Rural" },
                  ]}
                />
              </FormField>
              <FormField label="Régimen Alimenticio">
                <Select
                  value={formData.accommodation?.mealPlan || ''}
                  onChange={e => setFormData({ ...formData, accommodation: { ...formData.accommodation, mealPlan: e.target.value } })}
                  options={[
                    { value: '', label: 'Seleccionar régimen...' },
                    { value: 'solo_desayuno', label: 'Solo Desayuno' },
                    { value: 'media_pension', label: 'Media Pensión' },
                    { value: 'full', label: 'Pensión Completa' },
                    { value: 'todo_incluido', label: 'Todo Incluido' },
                    { value: 'sin_alimentacion', label: 'Solo Alojamiento' }
                  ]}
                />
              </FormField>
            </div>
          </div>

          {/* Servicios - Estilo Observaciones */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <LuIcons.LuFileText size={14} /> Servicios Incluidos
              </h4>
              <textarea 
                className="w-full h-24 p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                value={formData.includedServices || ''} 
                onChange={e => setFormData({ ...formData, includedServices: e.target.value })} 
                placeholder="Listado de servicios incluidos..."
              />
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                <LuIcons.LuFileText size={14} className="text-red-400" /> No Incluye
              </h4>
              <textarea 
                className="w-full h-24 p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                value={formData.notIncluded || ''} 
                onChange={e => setFormData({ ...formData, notIncluded: e.target.value })} 
                placeholder="Listado de exclusiones..."
              />
            </div>
          </div>

          {/* Otros Detalles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-amber-50/20 p-4 rounded-xl border border-amber-100">
              <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldCheck size={14} /> Asistencia Médica
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <FormField label="Monto Cobertura (USD) (Opcional)">
                  <Input 
                    type="number"
                    value={formData.medicalAssistance?.amountUsd || ''} 
                    onChange={e => setFormData({ ...formData, medicalAssistance: { ...formData.medicalAssistance, amountUsd: parseInt(e.target.value) } })} 
                    placeholder="Ej. 50000"
                  />
                </FormField>
                <FormField label="Días de Cobertura (Opcional)">
                  <Input 
                    type="number"
                    value={formData.medicalAssistance?.coverageDays || ''} 
                    onChange={e => setFormData({ ...formData, medicalAssistance: { ...formData.medicalAssistance, coverageDays: parseInt(e.target.value) } })} 
                    placeholder="Ej. 6"
                  />
                </FormField>
              </div>
            </div>

            <div className="bg-emerald-50/20 p-4 rounded-xl border border-emerald-100">
              <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Briefcase size={14} /> Tarifas Base del Catálogo
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <FormField label="Tarifa Adulto">
                  <Input 
                    type="number"
                    value={formData.rates?.adult || ''} 
                    onChange={e => setFormData({ ...formData, rates: { ...formData.rates, adult: parseInt(e.target.value) } })} 
                    placeholder="Ej. 3500000"
                  />
                </FormField>
                <FormField label="Tarifa Menor">
                  <Input 
                    type="number"
                    value={formData.rates?.child || ''} 
                    onChange={e => setFormData({ ...formData, rates: { ...formData.rates, child: parseInt(e.target.value) } })} 
                    placeholder="Ej. 2800000"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}
