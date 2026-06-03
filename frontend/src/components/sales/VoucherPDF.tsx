import React, { forwardRef } from 'react';
import { Sale, TicketData } from '../../types';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { type AirportInfo } from '../../utils/airportInfo';
import './VoucherPDF.css';

interface VoucherPDFProps {
  sale: Sale | null;
  airportMap?: Record<string, AirportInfo>;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  pagado:  { bg: '#16a34a', text: '#fff' },
  credito: { bg: '#f59e0b', text: '#fff' },
  abonado: { bg: '#0b396b', text: '#fff' },
  anulado: { bg: '#dc2626', text: '#fff' },
};

function FlightBlock({ ticket, idx, airportMap }: { ticket: TicketData; idx: number; airportMap?: Record<string, AirportInfo> }) {
  const mainLegs = ticket.legs && ticket.legs.length > 0 ? ticket.legs : [];
  const returnLeg = ticket.returnLeg ? [ticket.returnLeg] : [];
  const allLegs = [...mainLegs, ...returnLeg];

  const legsToRender = allLegs.length > 0 ? allLegs : [{
    origin: '—',
    destination: '—',
    flightNumber: ticket.flightNumber || '—',
    seat: ticket.seatNumber || '—',
    date: ticket.departureDate,
    time: undefined,
    arrivalDate: ticket.arrivalDate,
  }];

  return (
    <div className="v-flight-block">
      <div className="v-flight-header">✈ RECIBO DE TIQUETE ELECTRÓNICO</div>
      <div className="v-flight-notice">Hemos realizado las reservas requeridas y ya se encuentran emitidas. Agradecemos la compra realizada.</div>
      
      <table className="v-flight-table">
        <thead>
          <tr>
            <th>DESDE</th>
            <th>HASTA</th>
            <th>VUELO</th>
            <th>SALIDA</th>
            <th>LLEGADA</th>
            <th>N° RESERVA</th>
          </tr>
        </thead>
        <tbody>
          {legsToRender.map((leg, li) => {
            const formatTimeAMPM = (time24: string) => {
              if (!time24) return '—';
              const [hour, minute] = time24.split(':');
              let h = parseInt(hour, 10);
              const ampm = h >= 12 ? 'PM' : 'AM';
              h = h % 12;
              h = h ? h : 12;
              return `${h.toString().padStart(2, '0')}:${minute} ${ampm}`;
            };
            const originInfo = airportMap?.[leg.origin] || { city: '', name: '' };
            const destInfo = airportMap?.[leg.destination] || { city: '', name: '' };
            const originStr = leg.origin === '—' ? '—' : `${leg.origin}${originInfo.city ? ` - ${originInfo.city}` : ''}`;
            const destStr = leg.destination === '—' ? '—' : `${leg.destination}${destInfo.city ? ` - ${destInfo.city}` : ''}`;
            const originAirport = originInfo.name ? <div style={{fontSize: '8px', color: '#64748b', marginTop: '2px', fontWeight: 'normal'}}>{originInfo.name}</div> : null;
            const destAirport = destInfo.name ? <div style={{fontSize: '8px', color: '#64748b', marginTop: '2px', fontWeight: 'normal'}}>{destInfo.name}</div> : null;

            return (
              <tr key={`leg-${idx}-${li}`}>
                <td>
                  <div className="v-f-main">{originStr}</div>
                  {originAirport}
                </td>
                <td>
                  <div className="v-f-main">{destStr}</div>
                  {destAirport}
                </td>
                <td>
                  <div className="v-f-main">{leg.flightNumber || '—'}</div>
                </td>
                <td>
                  <div className="v-f-main">{leg.date ? formatDate(leg.date) : '—'}</div>
                  <div className="v-f-sub">Hora: {formatTimeAMPM((leg as any).time)}</div>
                </td>
                <td>
                  <div className="v-f-main">{(leg as any).arrivalDate ? formatDate((leg as any).arrivalDate) : (leg.date ? formatDate(leg.date) : '—')}</div>
                  <div className="v-f-sub">Hora: {formatTimeAMPM((leg as any).arrivalTime)}</div>
                </td>
              <td>
                <div className="v-f-main">{li === 0 ? (ticket.reservationNumber || '—') : '—'}</div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>

      <div className="v-flight-details-box">
        <div className="v-fd-row">
          <div className="v-fd-col">
            <span className="v-fd-label">Aerolínea:</span>
            <span className="v-badge-orange">{(ticket as any).airlineName || ticket.airline || '—'}</span>
          </div>
          <div className="v-fd-col">
            <span className="v-fd-label">Equipaje:</span>
            <span className="v-fd-val">{ticket.baggagePlan || 'No especificado'}</span>
          </div>
          <div className="v-fd-col">
            <span className="v-fd-label">Asiento:</span>
            <span className="v-fd-val">{ticket.seatNumber || '—'}</span>
          </div>
        </div>
      </div>
      
      <div className="v-flight-bottom-line">
        Estado: <strong>{(ticket as any).status || 'EMITIDO'}</strong> | N° Tiquete: <strong>{ticket.ticketNumber || '—'}</strong>
      </div>
    </div>
  );
}

export const VoucherPDF = forwardRef<HTMLDivElement, VoucherPDFProps>(({ sale, airportMap }, ref) => {
  if (!sale) return null;

  const currentDate = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const statusStyle = statusColors[sale.status] || { bg: '#07818e', text: '#fff' };

  // Use the data arrays directly — do NOT rely on sale.products which is often absent
  const tickets     = sale.ticketData      || [];
  const hotels      = sale.hotelData       || [];
  const insurances  = sale.insuranceData   || [];
  const plans       = sale.planData        || [];
  const checkIns    = sale.checkInData     || [];
  const migrations  = sale.migrationData   || [];
  const simCards    = sale.simCardData     || [];
  const carRentals  = sale.carRentalData   || [];
  const fincas      = sale.fincaData       || [];
  const tours       = sale.tourData        || [];
  const conventions = sale.conventionData  || [];
  const restaurants = sale.restaurantData  || [];
  const visas       = sale.visaData        || [];
  const passports   = sale.passportData    || [];
  const pets        = sale.petServiceData  || [];

  const hasAnyProduct = [
    tickets, hotels, insurances, plans, checkIns, migrations,
    simCards, carRentals, fincas, tours, conventions,
    restaurants, visas, passports, pets,
  ].some(arr => arr.length > 0);

  return (
    <div className="itea-voucher">
      <div className="v-page" ref={ref}>

        {/* ══ HEADER ══════════════════════════════════════════════════ */}
        <div className="v-header">
          <div className="v-logo-block">
            <img className="v-logo-img" src="/itea logo.png" alt="iTea Logo" crossOrigin="anonymous" />
          </div>
          <div className="v-header-right">
            <strong>iTea Travel Agency</strong><br />
            MEDELLÍN, ANTIOQUIA<br />
            Teléfono: +57 (312) 875 15 89<br />
            <strong>Fecha de Impresión:</strong> {currentDate}
          </div>
        </div>

        {/* ══ PASSENGER BAR ═══════════════════════════════════════════ */}
        <div className="v-top-bar">
          <div className="v-tb-item">
            <span className="v-tb-label">PASAJERO</span>
            <span className="v-tb-value">{sale.clientName}</span>
          </div>
          <div className="v-tb-item">
            <span className="v-tb-label">MODALIDAD</span>
            <span className="v-tb-value">{sale.paymentMethod || '—'}</span>
          </div>
          <div className="v-tb-item">
            <span className="v-tb-label">ASESOR</span>
            <span className="v-tb-value">{sale.asesorName}</span>
          </div>
          <div className="v-tb-item">
            <span className="v-tb-label">ORDEN</span>
            <span className="v-tb-value v-tb-order">
              #{sale.id} - {sale.status === 'credito' ? (
                <span className="v-badge-credito">CRÉDITO</span>
              ) : (
                <span className="v-status-badge" style={{ color: statusStyle.bg }}>
                  {sale.status}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* ══ TIQUETERÍA ══════════════════════════════════════════════ */}
        {tickets.map((ticket, i) => <FlightBlock key={`ticket-${i}`} ticket={ticket} idx={i} airportMap={airportMap} />)}

        {/* ══ SECTION TITLE FOR OTHER PRODUCTS ════════════════════════ */}
        {hasAnyProduct && (hotels.length > 0 || insurances.length > 0 || plans.length > 0 || checkIns.length > 0 || migrations.length > 0 || simCards.length > 0 || carRentals.length > 0 || fincas.length > 0 || tours.length > 0 || conventions.length > 0 || restaurants.length > 0 || visas.length > 0 || passports.length > 0 || pets.length > 0) && (
          <>
            <div className="v-section-title">✈ Otros Servicios Reservados</div>
            <div className="v-notice">
              A continuación se detallan los demás servicios incluidos en su compra.
            </div>
          </>
        )}

        {/* ══ HOTELERÍA ═══════════════════════════════════════════════ */}
        {hotels.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🏨 Hotelería</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Hotel</th><th className="text-left">Destino</th><th>Check-In</th><th>Check-Out</th><th>N° Reserva</th><th>Huéspedes</th></tr>
              </thead>
              <tbody>
                {hotels.map((hotel, i) => (
                  <tr key={`hotel-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{hotel.hotelName}</div><div className="v-cell-sub">{hotel.hotelType || ''}</div></td>
                    <td className="text-left">{hotel.destination}</td>
                    <td>{hotel.startDate ? formatDate(hotel.startDate) : '—'}</td>
                    <td>{hotel.endDate ? formatDate(hotel.endDate) : '—'}</td>
                    <td className="v-cell-main">{hotel.reservationNumber || 'Pendiente'}</td>
                    <td>{(hotel.guests || []).map(g => g.name).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ SEGUROS DE VIAJE ════════════════════════════════════════ */}
        {insurances.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🛡 Seguros de Viaje</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Contacto</th><th>Teléfono</th><th className="text-left">Dirección</th><th>Proveedor</th><th className="text-left">Asegurados</th></tr>
              </thead>
              <tbody>
                {insurances.map((ins, i) => (
                  <tr key={`ins-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{ins.contactName}</div></td>
                    <td>{ins.contactNumber}</td>
                    <td className="text-left">{ins.address}</td>
                    <td><span className="v-badge v-badge-accent">{ins.supplier}</span></td>
                    <td className="text-left">{(ins.members || []).map(m => m.name).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ PAQUETES ════════════════════════════════════════════════ */}
        {plans.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">📦 Paquetes</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Paquete / Hotel</th><th>Vuelo</th><th>Inicio</th><th>Fin</th><th>Adultos</th><th>Niños</th></tr>
              </thead>
              <tbody>
                {plans.map((plan, i) => (
                  <tr key={`plan-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{plan.planName}</div><div className="v-cell-sub">{plan.hotelName}</div></td>
                    <td>{plan.flightNumber || '—'}</td>
                    <td>{plan.startDate ? formatDate(plan.startDate) : '—'}</td>
                    <td>{plan.endDate ? formatDate(plan.endDate) : '—'}</td>
                    <td>{plan.adultsCount ?? '—'}</td>
                    <td>{plan.childrenCount ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ CHECK-IN ════════════════════════════════════════════════ */}
        {checkIns.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">✅ Check-In</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Pasajero</th><th>Documento</th><th>Vuelo / Reserva</th><th>Fecha de Viaje</th><th>Silla</th><th>Equipaje</th></tr>
              </thead>
              <tbody>
                {checkIns.map((ci, i) => (
                  <tr key={`ci-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{ci.passengerName}</div></td>
                    <td><div className="v-cell-sub">{ci.docType} {ci.docNumber}</div></td>
                    <td>{ci.flightOrReservation}</td>
                    <td>{ci.travelDate ? formatDate(ci.travelDate) : '—'}</td>
                    <td>{ci.seat || '—'}</td>
                    <td>{ci.baggage || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ DOCUMENTACIÓN MIGRATORIA ════════════════════════════════ */}
        {migrations.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">📋 Documentación Migratoria</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Pasajero</th><th>Nacionalidad</th><th>N° Pasaporte</th><th>Vencimiento</th><th>País Destino</th><th>Documento</th></tr>
              </thead>
              <tbody>
                {migrations.map((mig, i) => (
                  <tr key={`mig-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{mig.passengerName}</div></td>
                    <td>{mig.nationality}</td>
                    <td>{mig.passportNumber}</td>
                    <td>{mig.passportExpiry ? formatDate(mig.passportExpiry) : '—'}</td>
                    <td>{mig.destinationCountry}</td>
                    <td><span className="v-badge">{mig.requestedDocType}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ SIM CARD ════════════════════════════════════════════════ */}
        {simCards.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">📱 SIM Card</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Pasajero</th><th className="text-left">País Destino</th><th>Llegada</th><th className="text-left">Plan de Datos</th><th>Tipo SIM</th><th>Método Entrega</th></tr>
              </thead>
              <tbody>
                {simCards.map((sim, i) => (
                  <tr key={`sim-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{sim.passengerName}</div></td>
                    <td className="text-left">{sim.destinationCountry}</td>
                    <td>{sim.arrivalDate ? formatDate(sim.arrivalDate) : '—'}</td>
                    <td>{sim.dataPlan}</td>
                    <td><span className="v-badge">{sim.simType}</span></td>
                    <td>{sim.deliveryMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ RENTA DE VEHÍCULOS ══════════════════════════════════════ */}
        {carRentals.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🚗 Renta de Vehículos</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Conductor</th><th>N° Licencia</th><th className="text-left">Categoría</th><th>Recogida</th><th>Devolución</th><th>Seguro</th></tr>
              </thead>
              <tbody>
                {carRentals.map((car, i) => (
                  <tr key={`car-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{car.mainDriver}</div></td>
                    <td>{car.licenseNumber}</td>
                    <td className="text-left">{car.vehicleCategory}</td>
                    <td>{car.pickupDate ? formatDate(car.pickupDate) : '—'}</td>
                    <td>{car.returnDate ? formatDate(car.returnDate) : '—'}</td>
                    <td><span className="v-badge">{car.insuranceType === 'all_risk' ? 'Todo Riesgo' : 'Básico'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ RENTA DE FINCAS ═════════════════════════════════════════ */}
        {fincas.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🏡 Renta de Fincas</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Responsable</th><th>Check-In</th><th>Check-Out</th><th>Adultos</th><th>Niños</th><th>Mascotas</th></tr>
              </thead>
              <tbody>
                {fincas.map((finca, i) => (
                  <tr key={`finca-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{finca.responsibleName}</div></td>
                    <td>{finca.checkInDate ? formatDate(finca.checkInDate) : '—'}</td>
                    <td>{finca.checkOutDate ? formatDate(finca.checkOutDate) : '—'}</td>
                    <td>{finca.adultsCount}</td>
                    <td>{finca.childrenCount}</td>
                    <td>{finca.hasPets ? `Sí (${finca.petType})` : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ TOURS ═══════════════════════════════════════════════════ */}
        {tours.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🧭 Tours</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Pasajero</th><th className="text-left">Tour</th><th>Fecha Preferida</th><th>Adultos</th><th>Niños</th><th className="text-left">Punto Recogida</th></tr>
              </thead>
              <tbody>
                {tours.map((tour, i) => (
                  <tr key={`tour-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{tour.passengerName}</div></td>
                    <td className="text-left">{tour.selectedTour}</td>
                    <td>{tour.preferredDate ? formatDate(tour.preferredDate) : '—'}</td>
                    <td>{tour.adultsCount}</td>
                    <td>{tour.childrenCount}</td>
                    <td>{tour.pickupPoint || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ CENTROS DE CONVENCIÓN ═══════════════════════════════════ */}
        {conventions.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🏛 Centro de Convención</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Organización</th><th className="text-left">Contacto</th><th>Inicio</th><th>Fin</th><th>Asistentes</th><th>Tipo Evento</th></tr>
              </thead>
              <tbody>
                {conventions.map((conv, i) => (
                  <tr key={`conv-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{conv.organization}</div></td>
                    <td className="text-left">{conv.contactName}</td>
                    <td>{conv.startDate ? formatDate(conv.startDate) : '—'}</td>
                    <td>{conv.endDate ? formatDate(conv.endDate) : '—'}</td>
                    <td>{conv.estimatedAttendance}</td>
                    <td><span className="v-badge">{conv.eventType}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ RESTAURANTES ════════════════════════════════════════════ */}
        {restaurants.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🍽 Restaurantes</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Reserva a Nombre de</th><th>Fecha y Hora</th><th>Personas</th><th>Mesa</th><th>Tipo Menú</th></tr>
              </thead>
              <tbody>
                {restaurants.map((rest, i) => (
                  <tr key={`rest-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{rest.reservationName}</div></td>
                    <td>{rest.dateTime ? formatDate(rest.dateTime) : '—'}</td>
                    <td>{rest.peopleCount}</td>
                    <td>{rest.tablePreference || '—'}</td>
                    <td>{rest.menuType || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ VISAS ═══════════════════════════════════════════════════ */}
        {visas.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🪪 Trámite de Visa</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Solicitante</th><th>Nacionalidad</th><th>N° Pasaporte</th><th>País Destino</th><th>Tipo Visa</th><th>Viaje Estimado</th></tr>
              </thead>
              <tbody>
                {visas.map((visa, i) => (
                  <tr key={`visa-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{visa.fullName}</div></td>
                    <td>{visa.nationality}</td>
                    <td>{visa.passportNumber}</td>
                    <td>{visa.countryApplying}</td>
                    <td><span className="v-badge v-badge-accent">{visa.visaType || '—'}</span></td>
                    <td>{visa.estimatedTravelDate ? formatDate(visa.estimatedTravelDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ PASAPORTES ══════════════════════════════════════════════ */}
        {passports.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">📘 Trámite de Pasaporte</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Titular</th><th>N° Identificación</th><th className="text-left">Ciudad Residencia</th><th>Tipo Trámite</th><th>Viaje Estimado</th></tr>
              </thead>
              <tbody>
                {passports.map((passport, i) => (
                  <tr key={`passport-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{passport.fullName}</div></td>
                    <td>{passport.idNumber}</td>
                    <td className="text-left">{passport.residenceCity}</td>
                    <td><span className="v-badge v-badge-accent">{passport.processType?.toUpperCase() || '—'}</span></td>
                    <td>{passport.estimatedTravelDate ? formatDate(passport.estimatedTravelDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ TRANSPORTE DE MASCOTAS ═══════════════════════════════════ */}
        {pets.length > 0 && (
          <div className="v-product-block">
            <div className="v-product-label">🐾 Transporte de Mascotas</div>
            <table className="v-table">
              <thead>
                <tr><th className="text-left">Dueño</th><th className="text-left">Mascota</th><th>Especie / Raza</th><th>Peso / Tamaño</th><th>Tipo Viaje</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {pets.map((pet, i) => (
                  <tr key={`pet-${i}`}>
                    <td className="text-left"><div className="v-cell-main">{pet.ownerName}</div></td>
                    <td className="text-left">{pet.petName}</td>
                    <td>{pet.species} / {pet.breed}</td>
                    <td>{pet.weight} kg — {pet.size}</td>
                    <td><span className="v-badge">{pet.travelType}</span></td>
                    <td>{pet.travelDate ? formatDate(pet.travelDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sin productos */}
        {!hasAnyProduct && (
          <div style={{ padding: '24px 32px', textAlign: 'center', color: '#64748b', fontSize: '11px', fontStyle: 'italic' }}>
            Esta venta no tiene servicios detallados disponibles para mostrar.
          </div>
        )}

        {/* ══ FOOTNOTES ═══════════════════════════════════════════════ */}
        <div className="v-footnotes">
          Orden <strong>#{sale.id}</strong> — Fecha de emisión: <strong>{formatDate(sale.date)}</strong>
          {sale.observations && ` — Obs: ${sale.observations}`}
        </div>

        {/* ══ PAYMENT ═════════════════════════════════════════════════ */}
        <div className="v-payment">
          <div className="v-payment-col">
            <h4>Información de Pago</h4>
            <div className="v-payment-row"><label>Agencia:</label><span>iTea Travel Agency</span></div>
            <div className="v-payment-row"><label>Modalidad:</label><span>{sale.paymentMethod || '—'}</span></div>
            <div className="v-payment-row"><label>Atendido por:</label><span>{sale.asesorName}</span></div>
            <div className="v-endorsements">⚠ LOS SERVICIOS ESTÁN SUJETOS A LAS POLÍTICAS DE CADA PROVEEDOR</div>
          </div>
          <div className="v-payment-col">
            <h4>Resumen de Venta</h4>
            <div className="v-payment-row"><label>Subtotal:</label><span>{formatCurrency(sale.total)}</span></div>
            <div className="v-payment-row"><label>Impuestos:</label><span>Incluidos</span></div>
            {(sale.creditPaidAmount ?? 0) > 0 && (
              <div className="v-payment-row"><label>Abonado:</label><span>{formatCurrency(sale.creditPaidAmount!)}</span></div>
            )}
            <div className="v-payment-grand">
              <label>Total:</label>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>
        </div>

        {/* ══ LEGAL ═══════════════════════════════════════════════════ */}
        <div className="v-legal">
          <h4>Términos y Condiciones</h4>
          No olvide reconfirmar el horario de los vuelos y servicios entre 24 y 48 horas antes de la salida.
          Verifique que cuente con todos los documentos necesarios para viajar.<br /><br />
          <strong>iTea</strong> agradece que haya elegido nuestros servicios y le desea un excelente viaje.<br /><br />
          <strong>1.</strong> En vuelos nacionales, llegue como mínimo tres horas antes del vuelo para el chequeo y embarque.<br /><br />
          <strong>2.</strong> Todo pasajero deberá exhibir el documento de identidad pertinente ante la aerolínea y autoridades que lo requieran.
          <div className="v-company">
            iTea Travel Agency &nbsp;|&nbsp; Carrera 65A 13-157, Aeropuerto Olaya Herrera, Medellín &nbsp;|&nbsp; info@itea.com.co
          </div>
        </div>

        {/* ══ FOOTER ══════════════════════════════════════════════════ */}
        <div className="v-footer">
          <div>
            <div className="v-footer-brand">i<span>T</span>ea</div>
            <div className="v-footer-tagline">Travel Agency</div>
          </div>
          <div className="v-footer-right">
            Voucher Electrónico — Orden #{sale.id}<br />
            www.itea.com.co &nbsp;|&nbsp; info@itea.com.co<br />
            Impreso el {currentDate}
          </div>
        </div>

      </div>
    </div>
  );
});

VoucherPDF.displayName = 'VoucherPDF';
