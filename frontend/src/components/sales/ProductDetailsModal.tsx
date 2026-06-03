import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatDate } from "../../utils/formatters";
import { type AirportInfo } from "../../utils/airportInfo";

// Format time in 12-hour AM/PM
const formatTimeAMPM = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

// Get full airport display name
const getAirport = (code: string, map?: Record<string, AirportInfo>) => {
  const info = map?.[code];
  return info ? `${info.city} (${code}) - ${info.name}` : code;
};

import {
  Plane,
  Building2,
  ShieldCheck,
  Package,
  ArrowRight,
  ArrowLeft,
  Luggage,
  FileInput,
  Smartphone,
  Car,
  TreePine,
  Compass,
  Music,
  UtensilsCrossed,
  FileText,
  PawPrint
} from "lucide-react";

interface ProductDetailsModalProps {
  product: { type: string; data: any[] } | null;
  onClose: () => void;
  airportMap?: Record<string, AirportInfo>;
}

function safe(val: any, fallback = "-") {
  return val ?? fallback;
}

function renderPassengers(items: any[]) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-3">
      <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Personas ({items.length})</p>
      <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
        {items.map((p: any, i: number) => (
          <li key={i}>
            {p.name || p.nombreCompleto || p.fullName || "-"}
            <span className="text-xs text-gray-400 ml-1">
              ({p.docType || p.tipoDocumento || p.idNumber || ""} {p.docNumber || p.nroDocumento || ""})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderGrid(items: { label: string; value: any }[]) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
      {items.map((item, i) => (
        <div key={i}>
          <span className="block text-xs text-gray-500">{item.label}</span>
          <span className="font-semibold text-sm text-gray-800">{safe(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProductDetailsModal({ product, onClose, airportMap }: ProductDetailsModalProps) {
  if (!product) return null;

  const renderContent = () => {
    switch (product.type) {
      case "Tiquetería":
        return product.data.map((ticket, idx) => {
          const passengerInfo = ticket.passengerInfo || ticket.passengers?. [0] || null;

          // Dynamically split flight segments into outbound and return
          const legs = ticket.legs || [];
          const flightMode = ticket.flightMode || "one_way";

          let outboundLegs = [...legs];
          let returnLegs: any[] = [];

          if (flightMode === "round_trip" && legs.length >= 2) {
            const originalOrigin = legs[0]?.origin;
            const N = legs.length;
            let splitIdx = N - 1;

            for (let i = N - 2; i >= 1; i--) {
              const prevLeg = legs[i];
              const currentLeg = legs[i + 1];

              // Check direct reversal
              const isReversal = prevLeg.origin === currentLeg.destination && prevLeg.destination === currentLeg.origin;
              if (isReversal) {
                splitIdx = i + 1;
                break;
              }

              // Extend return chain backwards
              if (prevLeg.destination === currentLeg.origin && prevLeg.origin !== originalOrigin) {
                splitIdx = i;
              } else {
                break;
              }
            }

            outboundLegs = legs.slice(0, splitIdx);
            returnLegs = legs.slice(splitIdx);
          } else if (ticket.returnLeg && flightMode === "round_trip") {
            // Fallback for older formats where returnLeg is explicitly defined
            returnLegs = [ticket.returnLeg];
          }

          const outboundTypeLabel = outboundLegs.length > 1 ? "Con Escalas" : "Directo";
          const returnTypeLabel = returnLegs.length > 1 ? "Con Escalas" : (returnLegs.length === 1 ? "Directo" : "");

          return (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
              <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
                <Plane size={16} className="text-accent" /> Ticket #{idx + 1}
                {passengerInfo?.name && ` - ${passengerInfo.name}`}
              </h4>
              {renderGrid([
                { label: "Aerolínea", value: ticket.airlineName || ticket.airline },
                { label: "Reserva", value: ticket.reservationNumber },
                { label: "Tiquete", value: ticket.ticketNumber },
                { label: "Vuelo", value: ticket.flightNumber },
              ])}

              {/* Outbound Flights (Trayecto de Ida) */}
              {outboundLegs.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-200">
                    <p className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
                      <ArrowRight size={11} className="text-primary" />
                      Trayecto de Ida
                    </p>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                      {outboundTypeLabel}
                    </span>
                  </div>
                  {outboundLegs.map((leg: any, lIdx: number) => (
                    <div key={lIdx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs mb-2 pb-2 last:border-0 last:pb-0 border-b border-gray-150 items-center">
                      <div className="font-semibold text-gray-800">{getAirport(leg.origin, airportMap)} <span className="text-gray-400 mx-1">→</span> {getAirport(leg.destination, airportMap)}</div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Salida</span>
                        {leg.date ? `${formatDate(leg.date)} ${formatTimeAMPM(leg.date)}` : "-"}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Llegada</span>
                        {leg.arrivalDate ? `${formatDate(leg.arrivalDate)} ${formatTimeAMPM(leg.arrivalDate)}` : "-"}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Vuelo</span>
                        <span className="font-medium text-gray-800">{leg.flightNumber || "-"}</span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Asiento</span>
                        <span className="font-medium text-gray-800">{leg.seat || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Return Flights (Trayecto de Regreso) */}
              {flightMode === "round_trip" && returnLegs.length > 0 && (
                <div className="bg-blue-50/40 rounded-lg p-3 mt-2.5 border border-blue-100/60">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-blue-100">
                    <p className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1">
                      <ArrowLeft size={11} />
                      Trayecto de Regreso
                    </p>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                      {returnTypeLabel}
                    </span>
                  </div>
                  {returnLegs.map((leg: any, lIdx: number) => (
                    <div key={lIdx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs mb-2 pb-2 last:border-0 last:pb-0 border-b border-blue-50 items-center">
                      <div className="font-semibold text-blue-800">{getAirport(leg.origin, airportMap)} <span className="text-gray-400 mx-1">→</span> {getAirport(leg.destination, airportMap)}</div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Salida</span>
                        {leg.date ? `${formatDate(leg.date)} ${formatTimeAMPM(leg.date)}` : "-"}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Llegada</span>
                        {leg.arrivalDate ? `${formatDate(leg.arrivalDate)} ${formatTimeAMPM(leg.arrivalDate)}` : "-"}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Vuelo</span>
                        <span className="font-medium text-blue-800">{leg.flightNumber || "-"}</span>
                      </div>
                      <div className="text-gray-600">
                        <span className="font-bold text-[10px] text-gray-400 block uppercase mb-0.5">Asiento</span>
                        <span className="font-medium text-blue-800">{leg.seat || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {passengerInfo && renderPassengers([passengerInfo])}
            </div>
          );
        });

      case "Hotelería":
        return product.data.map((hotel, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <Building2 size={16} className="text-accent" /> Hotel #{idx + 1} - {hotel.hotelName || "Sin Nombre"}
            </h4>
            {renderGrid([
              { label: "Destino", value: hotel.destination },
              { label: "Proveedor", value: hotel.supplier || hotel.hotelName },
              { label: "Reserva", value: hotel.reservationNumber },
              { label: "Fechas", value: hotel.startDate && hotel.endDate ? `${formatDate(hotel.startDate)} al ${formatDate(hotel.endDate)}` : (hotel.startDate ? formatDate(hotel.startDate) : (hotel.endDate ? formatDate(hotel.endDate) : "-")) },
            ])}
            {renderPassengers(hotel.guests || hotel.passengers)}
            {hotel.observations && (
              <p className="text-xs text-gray-500 mt-2 italic">{hotel.observations}</p>
            )}
          </div>
        ));

      case "Seguros":
        return product.data.map((ins, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <ShieldCheck size={16} className="text-accent" /> Seguro #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Plan", value: ins.planName || ins.insuranceType },
              { label: "Cobertura", value: ins.coverageAmount ? `$${Number(ins.coverageAmount).toLocaleString("es-CO")}` : ins.coverageAmount },
              { label: "Días", value: ins.coverageDays },
              { label: "Fecha Inicio", value: ins.startDate ? formatDate(ins.startDate) : "-" },
              { label: "Fecha Fin", value: ins.endDate ? formatDate(ins.endDate) : "-" },
              { label: "Contacto Emergencia", value: ins.contactName },
              { label: "Teléfono Emergencia", value: ins.contactNumber },
              { label: "Dirección Asegurado", value: ins.address },
            ].filter(item => {
              const val = item.value;
              return val !== undefined && val !== null && val !== "" && val !== 0 && val !== "0" && val !== "-";
            }))}
            {renderPassengers(ins.members || ins.passengers)}
          </div>
        ));

      case "Planes":
        return product.data.map((plan, idx) => {
          const formatDateTime = (dStr: string) => dStr ? `${formatDate(dStr)} ${new Date(dStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "-";
          return (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
              <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
                <Package size={16} className="text-accent" /> Paquete #{idx + 1} - {plan.planName || "Sin Nombre"}
              </h4>
              {renderGrid([
                ...(plan.packageName ? [{ label: "Paquete Base", value: plan.packageName }] : []),
                { label: "Hotel", value: plan.hotelName },
                { label: "Aerolínea", value: plan.airlineName || plan.airline },
                { label: "Reserva", value: plan.reservationNumber },
                { label: "Nro Tiquete", value: plan.ticketNumber },
                { label: "Confirmación", value: plan.confirmationNumber },
                { label: "Check-in Hotel", value: plan.startDate ? formatDateTime(plan.startDate) : "-" },
                { label: "Check-out Hotel", value: plan.endDate ? formatDateTime(plan.endDate) : "-" },
                { label: "Nro Vuelo", value: plan.flightNumber },
                { label: "Salida Ida", value: plan.flightDepartureDate ? formatDateTime(plan.flightDepartureDate) : "-" },
                { label: "Llegada Ida", value: plan.flightDepartureArrivalDate ? formatDateTime(plan.flightDepartureArrivalDate) : "-" },
                { label: "Salida Regreso", value: plan.flightReturnDate ? formatDateTime(plan.flightReturnDate) : "-" },
                { label: "Llegada Regreso", value: plan.flightReturnArrivalDate ? formatDateTime(plan.flightReturnArrivalDate) : "-" },
                { label: "Adultos", value: plan.adultsCount },
                { label: "Menores", value: plan.childrenCount !== undefined && plan.childrenCount !== null ? plan.childrenCount : 0 },
              ])}
              {renderPassengers(plan.guests || plan.passengers || plan.members)}
              {plan.observations && (
                <p className="text-xs text-gray-500 mt-2 italic">{plan.observations}</p>
              )}
            </div>
          );
        });

      case "CheckIn":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <Luggage size={16} className="text-accent" /> Check-in #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Vuelo o Reserva", value: item.flightOrReservation },
              { label: "Fecha de Viaje", value: item.travelDate ? formatDate(item.travelDate) : "-" },
              { label: "Asiento", value: item.seat },
              { label: "Equipaje/Maletas", value: item.baggage },
              { label: "Teléfono", value: item.phone },
              { label: "Usa Silla Ruedas", value: item.needsWheelchair ? "Sí" : "No" },
            ])}
            {item.specialNeeds && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="font-bold block text-[10px] text-gray-400 uppercase">Necesidades Especiales</span>
                {item.specialNeeds}
              </div>
            )}
          </div>
        ));

      case "Migración":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <FileInput size={16} className="text-accent" /> Migración #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Trámite Migratorio", value: item.requestedDocType },
              { label: "Nacionalidad", value: item.nationality },
              { label: "Nro Pasaporte", value: item.passportNumber },
              { label: "Vencimiento Pasaporte", value: item.passportExpiry ? formatDate(item.passportExpiry) : "-" },
              { label: "País Destino", value: item.destinationCountry },
            ])}
          </div>
        ));

      case "SimCard":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <Smartphone size={16} className="text-accent" /> SIM Card #{idx + 1}
            </h4>
            {renderGrid([
              { label: "País Destino", value: item.destinationCountry },
              { label: "Fecha de Llegada", value: item.arrivalDate ? formatDate(item.arrivalDate) : "-" },
              { label: "Duración Viaje", value: item.tripDuration },
              { label: "Plan de Datos", value: item.dataPlan },
              { label: "Tipo SIM", value: item.simType },
              { label: "Método de Entrega", value: item.deliveryMethod },
            ])}
          </div>
        ));

      case "AlquilerAutos":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <Car size={16} className="text-accent" /> Alquiler de Auto #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Conductor Nombre", value: item.mainDriver },
              { label: "Nro Licencia", value: item.licenseNumber },
              { label: "Fecha Recogida", value: item.pickupDate ? formatDate(item.pickupDate) : "-" },
              { label: "Fecha Devolución", value: item.returnDate ? formatDate(item.returnDate) : "-" },
              { label: "Lugar Recogida", value: item.pickupLocation },
              { label: "Categoría Auto", value: item.vehicleCategory },
              { label: "Cond. Adicionales", value: item.additionalDrivers },
              { label: "Tipo de Seguro", value: item.insuranceType },
              { label: "Garantía de Tarjeta", value: item.guaranteeCreditCard },
            ])}
          </div>
        ));

      case "Finca":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <TreePine size={16} className="text-accent" /> Renta de Finca #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Responsable Nombre", value: item.responsibleName },
              { label: "Documento Responsable", value: item.docNumber },
              { label: "Fecha Entrada", value: item.checkInDate ? formatDate(item.checkInDate) : "-" },
              { label: "Fecha Salida", value: item.checkOutDate ? formatDate(item.checkOutDate) : "-" },
              { label: "Adultos", value: item.adultsCount },
              { label: "Niños", value: item.childrenCount },
              { label: "Tiene Mascotas", value: item.hasPets ? "Sí" : "No" },
              { label: "Tipo Mascota", value: item.petType },
            ])}
            {item.additionalServices && item.additionalServices.length > 0 && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="font-bold block text-[10px] text-gray-400 uppercase">Servicios Adicionales</span>
                {Array.isArray(item.additionalServices) ? item.additionalServices.join(", ") : item.additionalServices}
              </div>
            )}
          </div>
        ));

      case "Tour":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <Compass size={16} className="text-accent" /> Actividad o Tour #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Tour Seleccionado", value: item.selectedTour },
              { label: "Fecha Preferida", value: item.preferredDate ? formatDate(item.preferredDate) : "-" },
              { label: "Adultos", value: item.adultsCount },
              { label: "Menores", value: item.childrenCount },
              { label: "Edades Menores", value: item.childrenAges },
              { label: "Idioma Guía", value: item.guideLanguage },
              { label: "Requiere Transporte", value: item.needsTransport ? "Sí" : "No" },
              { label: "Punto de Encuentro", value: item.pickupPoint },
              { label: "Teléfono", value: item.phone },
            ])}
            {item.medicalConditions && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="font-bold block text-[10px] text-gray-400 uppercase">Condiciones Médicas</span>
                {item.medicalConditions}
              </div>
            )}
          </div>
        ));

      case "Evento":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <Music size={16} className="text-accent" /> Convención o Evento #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Organización", value: item.organization },
              { label: "Nombre Contacto", value: item.contactName },
              { label: "Correo de Contacto", value: item.email },
              { label: "Fecha de Inicio", value: item.startDate ? formatDate(item.startDate) : "-" },
              { label: "Fecha de Fin", value: item.endDate ? formatDate(item.endDate) : "-" },
              { label: "Asistencia Estimada", value: item.estimatedAttendance },
              { label: "Espacio Requerido", value: item.requiredSpace },
              { label: "Tipo de Evento", value: item.eventType },
              { label: "Equipos AV", value: Array.isArray(item.avEquipment) ? item.avEquipment.join(", ") : item.avEquipment },
              { label: "Requiere Catering", value: item.hasCatering ? "Sí" : "No" },
            ])}
            {item.cateringNotes && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="font-bold block text-[10px] text-gray-400 uppercase">Notas de Catering</span>
                {item.cateringNotes}
              </div>
            )}
          </div>
        ));

      case "Restaurante":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <UtensilsCrossed size={16} className="text-accent" /> Reserva en Restaurante #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Nombre Reserva", value: item.reservationName },
              { label: "Fecha y Hora", value: item.dateTime ? formatDate(item.dateTime) + " " + new Date(item.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-" },
              { label: "Cantidad Personas", value: item.peopleCount },
              { label: "Preferencia Mesa", value: item.tablePreference },
              { label: "Tipo de Menú", value: item.menuType },
              { label: "Ocasión Especial", value: item.specialOccasion },
              { label: "Teléfono", value: item.phone },
            ])}
            {item.dietaryRestrictions && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="font-bold block text-[10px] text-gray-400 uppercase">Restricciones Alimenticias</span>
                {Array.isArray(item.dietaryRestrictions) ? item.dietaryRestrictions.join(", ") : item.dietaryRestrictions}
              </div>
            )}
          </div>
        ));

      case "Visa":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <FileText size={16} className="text-accent" /> Visa #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Nombre Completo", value: item.fullName },
              { label: "Fecha Nacimiento", value: item.birthDate ? formatDate(item.birthDate) : "-" },
              { label: "Nacionalidad", value: item.nationality },
              { label: "Nro Pasaporte", value: item.passportNumber },
              { label: "Vencimiento Pasaporte", value: item.passportExpiration ? formatDate(item.passportExpiration) : "-" },
              { label: "País Aplicación", value: item.countryApplying },
              { label: "Tipo de Visa", value: item.visaType },
              { label: "Viaje Estimado", value: item.estimatedTravelDate ? formatDate(item.estimatedTravelDate) : "-" },
              { label: "Correo", value: item.email },
            ])}
          </div>
        ));

      case "Pasaporte":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <FileText size={16} className="text-accent" /> Pasaporte #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Nombre Completo", value: item.fullName },
              { label: "Nro Documento", value: item.idNumber },
              { label: "Fecha Nacimiento", value: item.birthDate ? formatDate(item.birthDate) : "-" },
              { label: "Ciudad Residencia", value: item.residenceCity },
              { label: "Tipo Trámite", value: item.processType },
              { label: "Viaje Estimado", value: item.estimatedTravelDate ? formatDate(item.estimatedTravelDate) : "-" },
              { label: "Teléfono", value: item.phone },
            ])}
          </div>
        ));

      case "Mascotas":
        return product.data.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <h4 className="font-bold text-primary flex items-center gap-2 mb-3 pb-2 border-b">
              <PawPrint size={16} className="text-accent" /> Mascotas #{idx + 1}
            </h4>
            {renderGrid([
              { label: "Nombre Mascota", value: item.petName },
              { label: "Especie", value: item.species },
              { label: "Raza", value: item.breed },
              { label: "Peso (Kg)", value: item.weight ? `${item.weight} kg` : "-" },
              { label: "Tamaño", value: item.size },
              { label: "Tipo de Transporte", value: item.travelType },
              { label: "Fecha de Viaje", value: item.travelDate ? formatDate(item.travelDate) : "-" },
              { label: "País Destino", value: item.destinationCountry },
              { label: "Teléfono", value: item.phone },
            ])}
            {item.medicalConditions && (
              <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="font-bold block text-[10px] text-gray-400 uppercase">Condiciones Médicas</span>
                {item.medicalConditions}
              </div>
            )}
          </div>
        ));

      default:
        return (
          <div className="bg-gray-50 p-4 rounded-xl text-center text-gray-500 italic">
            Visualización detallada para {product.type} no disponible aún.
            {product.data && product.data.length > 0 && (
              <pre className="text-left text-xs mt-2 bg-white p-2 rounded border overflow-auto max-h-40">
                {JSON.stringify(product.data, null, 2)}
              </pre>
            )}
          </div>
        );
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Detalles de ${product.type}`} size="lg" footer={<Button onClick={onClose}>Cerrar</Button>}>
      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
        {renderContent()}
      </div>
    </Modal>
  );
}
