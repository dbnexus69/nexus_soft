import React, { forwardRef } from 'react';
import { Sale, TicketData } from '../../types';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters';
import { type AirportInfo } from '../../utils/airportInfo';
import './VoucherPDF.css';

interface VoucherPDFProps {
  sale: Sale | null;
  airportMap?: Record<string, AirportInfo>;
  baggageList?: any[];
}

function DataCell({ label, value, highlight, fullWidth }: { label: string; value: React.ReactNode; highlight?: boolean; fullWidth?: boolean }) {
  return (
    <div className="v-data-cell" style={fullWidth ? { gridColumn: 'span 3', borderRight: 'none' } : undefined}>
      <div className="v-data-cell-label">{label}</div>
      <div className={`v-data-cell-value${highlight ? ' highlight' : ''}`}>{value || '—'}</div>
    </div>
  );
}

function ProductCard({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="v-product-block">
      <div className="v-product-label">{emoji}&nbsp;&nbsp;{title}</div>
      {children}
    </div>
  );
}

function FlightBlock({ ticket, idx, airportMap, baggageList }: { ticket: TicketData; idx: number; airportMap?: Record<string, AirportInfo>; baggageList?: any[] }) {
  const mainLegs = ticket.legs && ticket.legs.length > 0 ? ticket.legs : [];
  const returnLeg = ticket.returnLeg ? [ticket.returnLeg] : [];
  const hasStopsField = (ticket.outboundStops && ticket.outboundStops.length > 0) || ticket.returnLeg || (ticket.returnStops && ticket.returnStops.length > 0);
  
  const legsToRender = mainLegs.length > 0
    ? (hasStopsField
        ? [
            ...mainLegs,
            ...(ticket.outboundStops || []),
            ...returnLeg,
            ...(ticket.returnStops || [])
          ]
        : mainLegs)
    : [{
        origin: '—',
        destination: '—',
        flightNumber: ticket.flightNumber || '—',
        seat: ticket.seatNumber || '—',
        date: ticket.departureDate,
        time: undefined,
        arrivalDate: ticket.arrivalDate,
      }];

  const formatTimeAMPM = (time24: string) => {
    if (!time24) return '—';
    const [hour, minute] = time24.split(':');
    let h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h.toString().padStart(2, '0')}:${minute} ${ampm}`;
  };

  return (
    <div className="v-flight-block">
      <div className="v-flight-header">✈&nbsp;&nbsp;RECIBO DE TIQUETE ELECTRÓNICO</div>
      <div className="v-flight-notice">Hemos realizado las reservas requeridas y ya se encuentran emitidas. Agradecemos la compra realizada.</div>
      
      {/* Flight table */}
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
            const originInfo = airportMap?.[leg.origin] || { city: '', name: '' };
            const destInfo = airportMap?.[leg.destination] || { city: '', name: '' };
            const originStr = leg.origin === '—' ? '—' : `${leg.origin}${originInfo.city ? ` — ${originInfo.city}` : ''}`;
            const destStr = leg.destination === '—' ? '—' : `${leg.destination}${destInfo.city ? ` — ${destInfo.city}` : ''}`;
            return (
              <tr key={`leg-${idx}-${li}`}>
                <td>
                  <div className="v-f-main">{originStr}</div>
                  {originInfo.name && <div className="v-f-sub">{originInfo.name}</div>}
                </td>
                <td>
                  <div className="v-f-main">{destStr}</div>
                  {destInfo.name && <div className="v-f-sub">{destInfo.name}</div>}
                </td>
                <td><div className="v-f-main">{leg.flightNumber || '—'}</div></td>
                <td>
                  <div className="v-f-main">{leg.date ? formatDate(leg.date) : '—'}</div>
                  <div className="v-f-sub">Hora: {formatTimeAMPM((leg as any).time)}</div>
                </td>
                <td>
                  <div className="v-f-main">{(leg as any).arrivalDate ? formatDate((leg as any).arrivalDate) : (leg.date ? formatDate(leg.date) : '—')}</div>
                  <div className="v-f-sub">Hora: {formatTimeAMPM((leg as any).arrivalTime)}</div>
                </td>
                <td><div className="v-f-main">{ticket.reservationNumber || '—'}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="v-flight-details-box" style={{ flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
        {legsToRender.map((leg, li) => {
          const legAirlineName = leg.airline || (ticket as any).airlineName || ticket.airline || '—';
          const legBaggagePlan = leg.baggagePlan || ticket.baggagePlan;
          const bg = baggageList?.find(b => b.fareType === legBaggagePlan && (b.airlineName === legAirlineName || !legAirlineName));
          return (
            <div key={`leg-details-${idx}-${li}`} style={{ display: 'flex', width: '100%', gap: '15px', flexWrap: 'wrap', paddingBottom: li < legsToRender.length - 1 ? '10px' : '0', borderBottom: li < legsToRender.length - 1 ? '1px dashed #e5e7eb' : 'none' }}>
              <div style={{ minWidth: '150px' }}>
                <span className="v-fd-label">{leg.origin && leg.destination ? `${leg.origin} → ${leg.destination}` : 'Información'}:</span>
                <span className="v-badge-orange">{legAirlineName}</span>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <span className="v-fd-label">Equipaje:</span>
                <span className="v-fd-val">
                  <strong style={{ display: 'block', color: '#111827' }}>{legBaggagePlan || 'No especificado'}</strong>
                  {bg && (
                    <span style={{ fontSize: '0.85em', color: '#6b7280', display: 'block', marginTop: '2px' }}>
                      Personal: {bg.personalItem || 'N/A'} &bull; Cabina: {bg.carryOn || 'N/A'} &bull; Bodega: {bg.checkedBag || 'N/A'}
                    </span>
                  )}
                </span>
              </div>
              <div style={{ minWidth: '80px' }}>
                <span className="v-fd-label">Asiento:</span>
                <span className="v-fd-val">{leg.seat || ticket.seatNumber || '—'}</span>
              </div>
              {(leg.ticketNumber || ticket.ticketNumber || (ticket.passengers && ticket.passengers[0]?.nroTiquete)) && (
                <div style={{ minWidth: '100px' }}>
                  <span className="v-fd-label">N° Tiquete:</span>
                  <span className="v-fd-val">
                    <strong style={{ color: '#111827' }}>
                      {leg.ticketNumber || ticket.ticketNumber || (ticket.passengers && ticket.passengers[0]?.nroTiquete)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {ticket.passengers && ticket.passengers.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>
            PASAJEROS DEL VUELO:
          </div>
          <table className="v-flight-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px' }}>NOMBRE</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px' }}>DOCUMENTO</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px' }}>N° RESERVA</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px' }}>N° TIQUETE</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px' }}>ASIENTO</th>
              </tr>
            </thead>
            <tbody>
              {ticket.passengers.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>
                    {p.name}
                    {p.esTitular && (
                      <span style={{ marginLeft: '8px', padding: '2px 8px',  color: '#0369a1', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold' }}>PASAJERO PRINCIPAL</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1f2937' }}>{p.docNumber || '—'}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1f2937' }}>{p.nroReserva || '—'}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1f2937' }}>{p.nroTiquete || '—'}</td>
                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1f2937' }}>{p.asiento || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const VoucherPDF = forwardRef<HTMLDivElement, VoucherPDFProps>(({ sale, airportMap, baggageList }, ref) => {
  if (!sale) {
    return <div className="itea-voucher"><div ref={ref} /></div>;
  }

  const currentDate = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

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

  const hasOtherProducts = [hotels, insurances, plans, checkIns, migrations, simCards, carRentals, fincas, tours, conventions, restaurants, visas, passports, pets].some(a => a.length > 0);
  const hasAnyProduct = tickets.length > 0 || hasOtherProducts;

  return (
    <div className="itea-voucher">
      <div className="v-page" ref={ref}>

        {/* ══ HEADER ══════════════════════════════════════════════════ */}
        <div className="v-header">
          <div className="v-logo-block">
            <img className="v-logo-img" src="/samtur_nuevo.png.png" alt="Samtur Logo" crossOrigin="anonymous" />
          </div>
          <div className="v-header-right">
            <strong>Samtur Travel Agency</strong>
            <br />
            NIT: 902062715-5<br />
            
            Direccioón: Calle 18 #18 143 Mall Estación de Servicios Medrano<br />
            Teléfono: +57 (312) 633 99 19<br />
            <strong>Fecha de Impresión:</strong> {currentDate}<br />
            <strong>Fecha de Venta:</strong> {formatDate(sale.date)}
          </div>
        </div>

        {/* ══ PASSENGER BAR ═══════════════════════════════════════════ */}
        <div className="v-top-bar">
          <div className="v-tb-item">
            <span className="v-tb-label">PASAJERO</span>
            <span className="v-tb-value">{sale.clientName}</span>
          </div>
          <div className="v-tb-item">
            <span className="v-tb-label">FORMA DE PAGO</span>
            <span className="v-tb-value">
              {sale.paymentMethod 
                ? sale.paymentMethod 
                : (sale.payments && sale.payments.length > 0 
                    ? (sale.payments.length > 1 ? 'Mixto' : sale.payments[0].method) 
                    : '—')}
            </span>
          </div>
          <div className="v-tb-item">
            <span className="v-tb-label">ASESOR</span>
            <span className="v-tb-value">{sale.asesorName}</span>
          </div>
          <div className="v-tb-item">
            <span className="v-tb-label">ORDEN</span>
            <span className="v-tb-value v-tb-order">
              #{sale.id}
              {sale.status === 'credito' ? (
                <span className="v-badge-status v-status-credito">CRÉDITO</span>
              ) : (
                <span className={`v-badge-status v-status-${sale.status}`}>
                  {sale.status?.toUpperCase()}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* ══ TIQUETERÍA ══════════════════════════════════════════════ */}
        {tickets.map((ticket, i) => <FlightBlock key={`ticket-${i}`} ticket={ticket} idx={i} airportMap={airportMap} baggageList={baggageList} />)}

        {/* ══ SECTION TITLE FOR OTHER PRODUCTS ════════════════════════ */}
        {hasOtherProducts && (
          <>
            <div className="v-section-title">✈&nbsp;&nbsp;Otros Servicios Reservados</div>
            <div className="v-notice">A continuación se detallan los demás servicios incluidos en su compra.</div>
          </>
        )}

        {/* ══ HOTELERÍA ═══════════════════════════════════════════════ */}
        {hotels.length > 0 && (
          <ProductCard emoji="🏨" title="Hotelería">
            {hotels.map((hotel, i) => (
              <React.Fragment key={`hotel-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Hotel" value={hotel.hotelName} highlight />
                  <DataCell label="Destino" value={hotel.destination} />
                  <DataCell label="Tipo" value={hotel.hotelType} />
                  <DataCell label="Check-In" value={hotel.startDate ? formatDateTime(hotel.startDate) : null} />
                  <DataCell label="Check-Out" value={hotel.endDate ? formatDateTime(hotel.endDate) : null} />
                  <DataCell label="N° Reserva" value={hotel.reservationNumber || 'Pendiente'} />
                  <DataCell label="Huéspedes" value={(hotel.guests || []).map(g => g.name).join(', ') || '—'} />
                  {hotel.observations && <DataCell label="Observaciones" value={hotel.observations} />}
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ SEGUROS DE VIAJE ════════════════════════════════════════ */}
        {insurances.length > 0 && (
          <ProductCard emoji="🛡️" title="Seguros de Viaje">
            {insurances.map((ins, i) => (
              <React.Fragment key={`ins-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Tipo de Seguro" value={ins.insuranceType} highlight />
                  <DataCell label="Teléfono" value={ins.phone} />
                  <DataCell label="Proveedor" value={ins.supplier} />
                  <DataCell label="Asegurados" value={(ins.members || []).map(m => m.name).join(', ') || '—'} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ PAQUETES ════════════════════════════════════════════════ */}
        {plans.length > 0 && (
          <ProductCard emoji="📦" title="Paquetes">
            {plans.map((plan, i) => (
              <React.Fragment key={`plan-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  {plan.packageType === "supplier" ? (
                    <>
                      <DataCell label="Nombre del Plan / Paquete" value={plan.planName || plan.packageName} highlight />
                      <DataCell label="Proveedor / Operador" value={plan.supplier} />
                      <DataCell label="Tipo de Paquete" value="Por Proveedor" />
                      <DataCell 
                        label="Lista de Pasajeros / Huéspedes" 
                        value={(plan.guests || []).map((g: any) => `${g.name} (${g.docType || 'DOC'}: ${g.docNumber})`).join(', ') || '—'} 
                        fullWidth={true} 
                      />
                      {plan.observations && (
                        <DataCell 
                          label="Observaciones" 
                          value={plan.observations} 
                          fullWidth={true} 
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <DataCell label="Nombre del Plan / Paquete" value={plan.planName || plan.packageName} highlight />
                      <DataCell label="Hotel Incluido" value={plan.hotelName} />
                      <DataCell label="Proveedor / Operador" value={plan.supplier} />
                      
                      <DataCell label="Fecha Inicio Viaje" value={plan.startDate ? formatDate(plan.startDate) : null} />
                      <DataCell label="Fecha Fin Viaje" value={plan.endDate ? formatDate(plan.endDate) : null} />
                      <DataCell label="Pasajeros (Resumen)" value={`${plan.adultsCount ?? 0} adulto(s) / ${plan.childrenCount ?? 0} niño(s)`} />

                      <DataCell label="Aerolínea" value={(plan as any).airlineName || plan.airline} />
                      <DataCell label="N° Vuelo" value={plan.flightNumber} />
                      <DataCell label="Localizador / N° Reserva" value={plan.reservationNumber} />

                      <DataCell label="N° Tiquete" value={plan.ticketNumber} />
                      <DataCell label="N° Confirmación" value={plan.confirmationNumber} />
                      <DataCell label="" value={<span />} />

                      <DataCell label="Fecha Salida Vuelo (Ida)" value={plan.flightDepartureDate ? formatDateTime(plan.flightDepartureDate) : null} />
                      <DataCell label="Llegada Vuelo Ida" value={plan.flightDepartureArrivalDate ? formatDateTime(plan.flightDepartureArrivalDate) : null} />
                      <DataCell label="" value={<span />} />

                      <DataCell label="Fecha Regreso Vuelo (Regreso)" value={plan.flightReturnDate ? formatDateTime(plan.flightReturnDate) : null} />
                      <DataCell label="Llegada Vuelo Regreso" value={plan.flightReturnArrivalDate ? formatDateTime(plan.flightReturnArrivalDate) : null} />
                      <DataCell label="" value={<span />} />

                      <DataCell 
                        label="Lista de Pasajeros / Huéspedes" 
                        value={(plan.guests || []).map((g: any) => `${g.name} (${g.docType || 'DOC'}: ${g.docNumber})`).join(', ') || '—'} 
                        fullWidth={true} 
                      />

                      {plan.observations && (
                        <DataCell 
                          label="Observaciones" 
                          value={plan.observations} 
                          fullWidth={true} 
                        />
                      )}
                    </>
                  )}
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ CHECK-IN ════════════════════════════════════════════════ */}
        {checkIns.length > 0 && (
          <ProductCard emoji="✅" title="Check-In">
            {checkIns.map((ci, i) => (
              <React.Fragment key={`ci-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Pasajero" value={ci.passengerName} highlight />
                  <DataCell label="Documento" value={ci.docType && ci.docNumber ? `${ci.docType}: ${ci.docNumber}` : ci.docNumber} />
                  <DataCell label="Vuelo / Reserva" value={ci.flightOrReservation} />
                  <DataCell label="Fecha de Viaje" value={ci.travelDate ? formatDate(ci.travelDate) : null} />
                  <DataCell label="Silla" value={ci.seat} />
                  <DataCell label="Equipaje" value={ci.baggage} />
                  {ci.specialNeeds && <DataCell label="Necesidades Especiales" value={ci.specialNeeds} />}
                  {ci.needsWheelchair && <DataCell label="Silla de Ruedas" value="Sí, requerida" />}
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ DOCUMENTACIÓN MIGRATORIA ════════════════════════════════ */}
        {migrations.length > 0 && (
          <ProductCard emoji="📋" title="Documentación Migratoria">
            {migrations.map((mig, i) => (
              <React.Fragment key={`mig-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Pasajero" value={mig.passengerName} highlight />
                  <DataCell label="Nacionalidad" value={mig.nationality} />
                  <DataCell label="Documento Solicitado" value={mig.requestedDocType} />
                  <DataCell label="N° Pasaporte" value={mig.docNumber} />
                  <DataCell label="Vencimiento Pasaporte" value={mig.passportExpiry ? formatDate(mig.passportExpiry) : null} />
                  <DataCell label="País Destino" value={mig.destinationCountry} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ SIM CARD ════════════════════════════════════════════════ */}
        {simCards.length > 0 && (
          <ProductCard emoji="📱" title="SIM Card">
            {simCards.map((sim, i) => (
              <React.Fragment key={`sim-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Pasajero" value={sim.passengerName} highlight />
                  <DataCell label="País Destino" value={sim.destinationCountry} />
                  <DataCell label="Fecha de Llegada" value={sim.arrivalDate ? formatDate(sim.arrivalDate) : null} />
                  <DataCell label="Plan de Datos" value={sim.dataPlan} />
                  <DataCell label="Tipo de SIM" value={sim.simType ? <span className="v-badge v-badge-accent">{sim.simType}</span> : null} />
                  <DataCell label="Método de Entrega" value={sim.deliveryMethod} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ RENTA DE VEHÍCULOS ══════════════════════════════════════ */}
        {carRentals.length > 0 && (
          <ProductCard emoji="🚗" title="Renta de Vehículos">
            {carRentals.map((car, i) => (
              <React.Fragment key={`car-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Conductor Principal" value={car.mainDriver} highlight />
                  <DataCell label="N° Licencia" value={car.licenseNumber} />
                  <DataCell label="Categoría Vehículo" value={car.vehicleCategory} />
                  <DataCell label="Recogida" value={car.pickupDate ? formatDate(car.pickupDate) : null} />
                  <DataCell label="Devolución" value={car.returnDate ? formatDate(car.returnDate) : null} />
                  <DataCell label="Lugar de Recogida" value={car.pickupLocation} />
                  <DataCell label="Tipo de Seguro" value={car.insuranceType ? <span className="v-badge">{(car.insuranceType as string) === 'all_risk' || (car.insuranceType as string) === 'todo_riesgo' ? 'Todo Riesgo' : 'Básico'}</span> : null} />
                  <DataCell label="Conductores Adicionales" value={car.additionalDrivers?.toString()} />
                  {car.guaranteeCreditCard && <DataCell label="Tarjeta Garantía" value={car.guaranteeCreditCard} />}
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ RENTA DE FINCAS ═════════════════════════════════════════ */}
        {fincas.length > 0 && (
          <ProductCard emoji="🏡" title="Renta de Fincas">
            {fincas.map((finca, i) => (
              <React.Fragment key={`finca-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Responsable" value={finca.responsibleName} highlight />
                  <DataCell label="Documento" value={finca.docNumber} />
                  <DataCell label="Check-In" value={finca.checkInDate ? formatDate(finca.checkInDate) : null} />
                  <DataCell label="Check-Out" value={finca.checkOutDate ? formatDate(finca.checkOutDate) : null} />
                  <DataCell label="Adultos" value={finca.adultsCount?.toString()} />
                  <DataCell label="Niños" value={finca.childrenCount?.toString()} />
                  <DataCell label="Mascotas" value={finca.hasPets ? `Sí — ${finca.petType}` : 'No'} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ TOURS ═══════════════════════════════════════════════════ */}
        {tours.length > 0 && (
          <ProductCard emoji="🧭" title="Tours">
            {tours.map((tour, i) => (
              <React.Fragment key={`tour-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Adultos" value={tour.adultsCount?.toString()} />
                  <DataCell label="Niños" value={tour.childrenCount?.toString()} />
                  <DataCell label="Punto de Recogida" value={tour.pickupPoint} />
                  <DataCell label="Idioma Guía" value={tour.guideLanguage} />
                  <DataCell label="Transporte" value={tour.needsTransport ? 'Incluido' : 'No requiere'} />
                  <DataCell 
                    label="Integrantes del Tour" 
                    value={(tour.guests || []).map((g: any) => `${g.name} (${g.docType || 'DOC'}: ${g.docNumber})`).join(', ') || tour.passengerName} 
                    fullWidth={true} 
                  />
                  {tour.observations && (
                    <DataCell label="Toures" value={tour.observations} fullWidth={true} />
                  )}
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ CENTROS DE CONVENCIÓN ═══════════════════════════════════ */}
        {conventions.length > 0 && (
          <ProductCard emoji="🏛️" title="Centro de Convención">
            {conventions.map((conv, i) => (
              <React.Fragment key={`conv-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Organización" value={conv.organization} highlight />
                  <DataCell label="Contacto" value={conv.contactName} />
                  <DataCell label="Tipo de Evento" value={conv.eventType} />
                  <DataCell label="Inicio" value={conv.startDate ? formatDate(conv.startDate) : null} />
                  <DataCell label="Fin" value={conv.endDate ? formatDate(conv.endDate) : null} />
                  <DataCell label="Asistentes Estimados" value={conv.estimatedAttendance?.toString()} />
                  <DataCell label="Espacio Requerido" value={conv.requiredSpace} />
                  <DataCell label="Catering" value={conv.hasCatering ? `Sí — ${conv.cateringNotes || ''}` : 'No'} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ RESTAURANTES ════════════════════════════════════════════ */}
        {restaurants.length > 0 && (
          <ProductCard emoji="🍽️" title="Restaurantes">
            {restaurants.map((rest, i) => (
              <React.Fragment key={`rest-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Reserva a Nombre de" value={rest.reservationName} highlight />
                  <DataCell label="Fecha y Hora" value={rest.dateTime ? formatDate(rest.dateTime) : null} />
                  <DataCell label="N° Personas" value={rest.peopleCount?.toString()} />
                  <DataCell label="Mesa Preferida" value={rest.tablePreference} />
                  <DataCell label="Tipo de Menú" value={rest.menuType} />
                  <DataCell label="Restricciones" value={Array.isArray(rest.dietaryRestrictions) ? rest.dietaryRestrictions.join(', ') : rest.dietaryRestrictions} />
                  {rest.specialOccasion && <DataCell label="Ocasión Especial" value={rest.specialOccasion} />}
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ VISAS ═══════════════════════════════════════════════════ */}
        {visas.length > 0 && (
          <ProductCard emoji="🪪" title="Trámite de Visa">
            {visas.map((visa, i) => (
              <React.Fragment key={`visa-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Solicitante" value={visa.fullName} highlight />
                  <DataCell label="Nacionalidad" value={visa.nationality} />
                  <DataCell label="N° Pasaporte" value={visa.docNumber} />
                  <DataCell label="País al que Aplica" value={visa.countryApplying} />
                  <DataCell label="Tipo de Visa" value={visa.visaType ? <span className="v-badge v-badge-accent">{visa.visaType}</span> : null} />
                  <DataCell label="Viaje Estimado" value={visa.estimatedTravelDate ? formatDate(visa.estimatedTravelDate) : null} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ PASAPORTES ══════════════════════════════════════════════ */}
        {passports.length > 0 && (
          <ProductCard emoji="📘" title="Trámite de Pasaporte">
            {passports.map((passport, i) => (
              <React.Fragment key={`passport-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Titular" value={passport.fullName} highlight />
                  <DataCell label="N° Identificación" value={passport.idNumber} />
                  <DataCell label="Ciudad de Residencia" value={passport.residenceCity} />
                  <DataCell label="Tipo de Trámite" value={passport.processType ? <span className="v-badge v-badge-accent">{passport.processType.toUpperCase()}</span> : null} />
                  <DataCell label="Viaje Estimado" value={passport.estimatedTravelDate ? formatDate(passport.estimatedTravelDate) : null} />
                  <DataCell label="Teléfono" value={passport.phone} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* ══ TRANSPORTE DE MASCOTAS ═══════════════════════════════════ */}
        {pets.length > 0 && (
          <ProductCard emoji="🐾" title="Transporte de Mascotas">
            {pets.map((pet, i) => (
              <React.Fragment key={`pet-${i}`}>
                {i > 0 && <div className="v-item-divider" />}
                <div className="v-data-grid">
                  <DataCell label="Dueño" value={pet.ownerName} highlight />
                  <DataCell label="Nombre de la Mascota" value={pet.petName} />
                  <DataCell label="Especie / Raza" value={`${pet.species || '—'} / ${pet.breed || '—'}`} />
                  <DataCell label="Peso / Tamaño" value={`${pet.weight ?? '—'} kg — ${pet.size || '—'}`} />
                  <DataCell label="Tipo de Viaje" value={pet.travelType ? <span className="v-badge">{pet.travelType}</span> : null} />
                  <DataCell label="Fecha" value={pet.travelDate ? formatDate(pet.travelDate) : null} />
                  <DataCell label="País Destino" value={pet.destinationCountry} />
                </div>
              </React.Fragment>
            ))}
          </ProductCard>
        )}

        {/* Sin productos */}
        {!hasAnyProduct && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '11px', fontStyle: 'italic' }}>
            Esta venta no tiene servicios detallados disponibles para mostrar.
          </div>
        )}

        {/* ══ FOOTNOTES ═══════════════════════════════════════════════ */}
        <div className="v-footnotes">
          Orden <strong>#{sale.id}</strong>
          
        </div>

        {/* ══ PAYMENT ═════════════════════════════════════════════════ */}
        <div className="v-payment">
          <div className="v-payment-col">
            <h4>Información de Pago</h4>
            <div className="v-payment-row"><label>Agencia:</label><span>Samtur Travel</span></div>
            <div className="v-payment-row">
              <label>Forma de Pago:</label>
              <span>
                {sale.paymentMethod 
                  ? sale.paymentMethod 
                  : (sale.payments && sale.payments.length > 0 
                      ? (sale.payments.length > 1 ? 'Mixto' : sale.payments[0].method) 
                      : '—')}
              </span>
            </div>
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
          <h4>TÉRMINOS Y CONDICIONES</h4>
          No olvide reconfirmar el horario de los vuelos y servicios entre 24 y 48 horas antes de la salida. Verifique que cuente con todos los documentos necesarios para viajar.<br /><br />
          Samtur agradece que haya elegido nuestros servicios y le desea un excelente viaje.<br /><br />
          <strong>1.</strong> En vuelos nacionales, llegue como mínimo dos horas antes del vuelo para el chequeo y embarque.<br /><br />
          <strong>2.</strong> En vuelos internacionales, llegue como mínimo cuatro horas antes del vuelo para el chequeo y embarque.<br /><br />
          <strong>3.</strong> El checkin o pase de abordar es valor agregado a los servicios prestados, este servicio se brinda dentro del tiempo segun la aereolinea.<br />
          Se habilitará 24 horas antes de la salida del vuelo y se cerrará 4 horas antes del vuelo. Si no se realiza el check-in en este periodo, Samtur no se hace responsable por los gastos o inconvenientes que esto pueda generar.<br /><br />
          <strong>4.</strong> Todo pasajero deberá exhibir el documento de identidad pertinente ante la aerolínea y autoridades que lo requieran.
          <div className="v-company" style={{ marginTop: '12px' }}>
            Samtur Travel Agency | calle 18 # 18 143 mall estación de servicios medrano | Comercial@samturtravel.com
          </div>
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '4px', fontSize: '11px' }}>
            <strong>▲ ATENCIÓN:</strong> Por favor revise detenidamente todos los datos de este voucher (nombres, fechas, horarios y servicios). Cualquier inconsistencia debe ser reportada de inmediato a su asesor.
          </div>
        </div>

        {/* ══ FOOTER ══════════════════════════════════════════════════ */}
        <div className="v-footer">
          <div>
            <div className="v-footer-brand">Sam<span>tur</span></div>
            <div className="v-footer-tagline">Travel</div>
          </div>
          <div className="v-footer-right">
            <div className="v-footer-line">
              <p>
                www.samturtravel.com &nbsp;|&nbsp; info@samturtravel.com<br />
                © {new Date().getFullYear()} Samtur. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});

VoucherPDF.displayName = 'VoucherPDF';
