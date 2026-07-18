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

function ServiceCell({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '' || value === '—') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return (
    <div className="v-service-cell">
      <div className="v-service-cell-label">{label}</div>
      <div className="v-service-cell-value">{value}</div>
    </div>
  );
}

function ServiceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="v-service-card">
      <div className="v-service-header">{title}</div>
      {children}
    </div>
  );
}

function FlightBlock({ ticket, idx, airportMap }: { ticket: TicketData; idx: number; airportMap?: Record<string, AirportInfo> }) {
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
    <div className="v-flight-card">
      {legsToRender.map((leg, li) => {
        const originInfo = airportMap?.[leg.origin] || { city: '', name: '' };
        const destInfo = airportMap?.[leg.destination] || { city: '', name: '' };
        
        return (
          <div key={`leg-${idx}-${li}`} style={{ marginBottom: li < legsToRender.length - 1 ? '32px' : '0' }}>
            <div className="v-route">
              <div className="v-route-point">
                <div className="v-route-city">{leg.origin}</div>
                <div className="v-route-airport">{originInfo.city || '—'}</div>
              </div>
              <div className="v-route-divider">
                <div className="v-route-line"></div>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>{leg.flightNumber || 'FLIGHT'}</div>
              </div>
              <div className="v-route-point">
                <div className="v-route-city">{leg.destination}</div>
                <div className="v-route-airport">{destInfo.city || '—'}</div>
              </div>
            </div>

            <div className="v-flight-details-grid">
              <div className="v-fd-item">
                <div className="v-fd-label">Salida</div>
                <div className="v-fd-value">{leg.date ? formatDate(leg.date) : '—'}</div>
                <div className="v-fd-value-small">{formatTimeAMPM((leg as any).time)}</div>
              </div>
              <div className="v-fd-item">
                <div className="v-fd-label">Llegada</div>
                <div className="v-fd-value">{(leg as any).arrivalDate ? formatDate((leg as any).arrivalDate) : (leg.date ? formatDate(leg.date) : '—')}</div>
                <div className="v-fd-value-small">{formatTimeAMPM((leg as any).arrivalTime)}</div>
              </div>
              <div className="v-fd-item">
                <div className="v-fd-label">Operador</div>
                <div className="v-fd-value">{leg.airline || (ticket as any).airlineName || ticket.airline || '—'}</div>
              </div>
              <div className="v-fd-item">
                <div className="v-fd-label">Reserva / PNR</div>
                <div className="v-fd-value">{ticket.reservationNumber || '—'}</div>
              </div>
            </div>
          </div>
        );
      })}

      {ticket.passengers && ticket.passengers.length > 0 && (
        <table className="v-pax-table">
          <thead>
            <tr>
              <th>PASAJERO</th>
              <th>DOCUMENTO</th>
              <th>TIQUETE</th>
              <th>ASIENTO</th>
            </tr>
          </thead>
          <tbody>
            {ticket.passengers.map((p, i) => (
              <tr key={i}>
                <td>{p.name} {p.esTitular && <span style={{ color: '#2563eb', fontSize: '9px', marginLeft: '4px' }}>(TITULAR)</span>}</td>
                <td>{p.docNumber || '—'}</td>
                <td>{p.nroTiquete || '—'}</td>
                <td>{p.asiento || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export const VoucherPDF = forwardRef<HTMLDivElement, VoucherPDFProps>(({ sale, airportMap }, ref) => {
  if (!sale) {
    return <div className="itea-voucher"><div ref={ref} /></div>;
  }

  const currentDate = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const tickets       = sale.ticketData      || [];
  const hotels        = sale.hotelData       || [];
  const insurances    = sale.insuranceData   || [];
  const plans         = sale.planData        || [];
  const carRentals    = sale.carRentalData   || [];
  const tours         = sale.tourData        || [];
  const visas         = sale.visaData        || [];
  const fincas        = sale.fincaData       || [];
  const simCards      = sale.simCardData     || [];
  const migrations    = sale.migrationData   || [];
  const conventions   = sale.conventionData  || [];
  const restaurants   = sale.restaurantData  || [];
  const passports     = sale.passportData    || [];
  const petServices   = sale.petServiceData  || [];
  const checkIns      = sale.checkInData     || [];

  const paymentMethodStr = sale.paymentMethod 
    ? sale.paymentMethod 
    : (sale.payments && sale.payments.length > 0 
        ? (sale.payments.length > 1 ? 'Mixto' : sale.payments[0].method) 
        : '—');

  return (
    <div className="itea-voucher">
      <div className="v-page" ref={ref}>
        
        {/* ══ HERO HEADER ══ */}
        <div className="v-hero">
          <div className="v-hero-top">
            <img className="v-logo-img" src="/db_nexus_logo.png" alt="DB Nexus" crossOrigin="anonymous" />
            <div className="v-hero-title">
              <h1>DB NEXUS BOARDING</h1>
              <p>CONFIRMACIÓN DE SERVICIOS</p>
            </div>
          </div>
        </div>

        {/* ══ OVERLAPPING STATS BAR ══ */}
        <div className="v-stats-bar">
          <div className="v-stat-item">
            <span className="v-stat-label">Pasajero Principal</span>
            <span className="v-stat-val">{sale.clientName}</span>
          </div>
          <div className="v-stat-item">
            <span className="v-stat-label">Fecha Emisión</span>
            <span className="v-stat-val">{currentDate}</span>
          </div>
          <div className="v-stat-item">
            <span className="v-stat-label">Orden Nexus</span>
            <span className="v-stat-val highlight">#{sale.id}
              {sale.status === 'credito' ? (
                <span className="v-badge-status bg-credito">CRÉDITO</span>
              ) : (
                <span className={`v-badge-status bg-${sale.status}`}>{sale.status?.toUpperCase()}</span>
              )}
            </span>
          </div>
        </div>

        {/* ══ VUELOS ══ */}
        {tickets.length > 0 && (
          <>
            <div className="v-section-title">ITINERARIO DE VUELO</div>
            {tickets.map((ticket, i) => <FlightBlock key={`ticket-${i}`} ticket={ticket} idx={i} airportMap={airportMap} />)}
          </>
        )}

        {/* ══ HOTELES ══ */}
        {hotels.length > 0 && (
          <>
            <div className="v-section-title">ALOJAMIENTO</div>
            <ServiceCard title="Detalles de Hotel">
              {hotels.map((hotel, i) => (
                <div className="v-service-grid" key={`hotel-${i}`}>
                  <ServiceCell label="Hotel" value={hotel.hotelName} />
                  <ServiceCell label="Destino" value={hotel.destination} />
                  <ServiceCell label="Tipo" value={hotel.hotelType} />
                  <ServiceCell label="Check-In" value={hotel.startDate ? formatDateTime(hotel.startDate) : null} />
                  <ServiceCell label="Check-Out" value={hotel.endDate ? formatDateTime(hotel.endDate) : null} />
                  <ServiceCell label="N° Reserva" value={hotel.reservationNumber || 'Pendiente'} />
                  <ServiceCell label="Huéspedes" value={(hotel.guests || []).map((g: any) => g.name).join(', ')} />
                  <ServiceCell label="Observaciones" value={hotel.observations} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ TOURS ══ */}
        {tours.length > 0 && (
          <>
            <div className="v-section-title">ACTIVIDADES & TOURS</div>
            <ServiceCard title="Detalles del Tour">
              {tours.map((tour, i) => (
                <div className="v-service-grid" key={`tour-${i}`}>
                  <ServiceCell label="Tour / Actividad" value={tour.selectedTour} />
                  <ServiceCell label="Pasajeros" value={tour.passengerName} />
                  <ServiceCell label="Adultos" value={tour.adultsCount?.toString()} />
                  <ServiceCell label="Niños" value={tour.childrenCount?.toString()} />
                  <ServiceCell label="Punto de Recogida" value={tour.pickupPoint} />
                  <ServiceCell label="Idioma Guía" value={tour.guideLanguage} />
                  <ServiceCell label="Transporte" value={tour.needsTransport ? 'Incluido' : 'No requiere'} />
                  <ServiceCell label="Observaciones" value={tour.observations} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ PAQUETES ══ */}
        {plans.length > 0 && (
          <>
            <div className="v-section-title">PAQUETES COMPLETOS</div>
            {plans.map((plan, i) => (
            <ServiceCard title={`Detalles del Paquete ${i + 1}`} key={`plan-${i}`}>
              {plan.packageType === "supplier" ? (
                <div className="v-service-grid">
                  <ServiceCell label="Nombre del Plan" value={plan.planName || plan.packageName} />
                  <ServiceCell label="Proveedor / Operador" value={plan.supplier} />
                  <ServiceCell label="Tipo de Paquete" value="Por Proveedor" />
                  <ServiceCell label="Lista de Pasajeros" value={(plan.guests || []).map((g: any) => g.name).join(', ')} />
                  <ServiceCell label="Observaciones" value={plan.observations} />
                </div>
              ) : (
                <div className="v-service-grid">
                  <ServiceCell label="Nombre del Plan" value={plan.planName || plan.packageName} />
                  <ServiceCell label="Hotel Incluido" value={plan.hotelName} />
                  <ServiceCell label="Proveedor" value={plan.supplier} />
                  <ServiceCell label="Check-In (Hotel)" value={plan.startDate ? formatDateTime(plan.startDate) : null} />
                  <ServiceCell label="Check-Out (Hotel)" value={plan.endDate ? formatDateTime(plan.endDate) : null} />
                  <ServiceCell label="Pasajeros (Resumen)" value={`${plan.adultsCount ?? 0} adulto(s) / ${plan.childrenCount ?? 0} niño(s)`} />
                  
                  <ServiceCell label={(plan as any).transportType === 'Terrestre' ? "Empresa de Transporte" : "Aerolínea"} value={(plan as any).airlineName || plan.airline} />
                  <ServiceCell label={(plan as any).transportType === 'Terrestre' ? "Placa / Vehículo" : "N° Vuelo"} value={plan.flightNumber} />
                  <ServiceCell label="Localizador / Reserva" value={plan.reservationNumber} />
                  
                  <ServiceCell label={(plan as any).transportType === 'Terrestre' ? "Tiquete / Puesto" : "N° Tiquete"} value={plan.ticketNumber} />
                  <ServiceCell label="N° Confirmación" value={plan.confirmationNumber} />
                  
                  <ServiceCell label={(plan as any).transportType === 'Terrestre' ? "Fecha Salida (Ida)" : "Salida Vuelo (Ida)"} value={plan.flightDepartureDate ? formatDateTime(plan.flightDepartureDate) : null} />
                  <ServiceCell label={(plan as any).transportType === 'Terrestre' ? "Llegada Destino (Ida)" : "Llegada Vuelo Ida"} value={plan.flightDepartureArrivalDate ? formatDateTime(plan.flightDepartureArrivalDate) : null} />
                  
                  <ServiceCell label={(plan as any).transportType === 'Terrestre' ? "Fecha Salida (Regreso)" : "Salida Vuelo (Regreso)"} value={plan.flightReturnDate ? formatDateTime(plan.flightReturnDate) : null} />
                  <ServiceCell label={(plan as any).transportType === 'Terrestre' ? "Llegada Origen (Regreso)" : "Llegada Vuelo Regreso"} value={plan.flightReturnArrivalDate ? formatDateTime(plan.flightReturnArrivalDate) : null} />
                  
                  <ServiceCell label="Lista de Pasajeros" value={(plan.guests || []).map((g: any) => g.name).join(', ')} />
                  <ServiceCell label="Observaciones" value={plan.observations} />
                </div>
              )}
            </ServiceCard>
            ))}
          </>
        )}

        {/* ══ SEGUROS ══ */}
        {insurances.length > 0 && (
          <>
            <div className="v-section-title">SEGURO MÉDICO / ASISTENCIA</div>
            <ServiceCard title="Póliza Activa">
              {insurances.map((ins, i) => (
                <div className="v-service-grid" key={`ins-${i}`}>
                  <ServiceCell label="Tipo de Seguro" value={ins.insuranceType} />
                  <ServiceCell label="Teléfono" value={ins.phone} />
                  <ServiceCell label="Proveedor" value={ins.supplier} />
                  <ServiceCell label="Asegurados" value={(ins.members || []).map((m: any) => m.name).join(', ')} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ AUTOS ══ */}
        {carRentals.length > 0 && (
          <>
            <div className="v-section-title">RENTA DE VEHÍCULOS</div>
            <ServiceCard title="Reserva de Auto">
              {carRentals.map((car, i) => (
                <div className="v-service-grid" key={`car-${i}`}>
                  <ServiceCell label="Conductor Principal" value={car.mainDriver} />
                  <ServiceCell label="N° Licencia" value={car.licenseNumber} />
                  <ServiceCell label="Categoría" value={car.vehicleCategory} />
                  <ServiceCell label="Recogida" value={car.pickupDate ? formatDate(car.pickupDate) : null} />
                  <ServiceCell label="Devolución" value={car.returnDate ? formatDate(car.returnDate) : null} />
                  <ServiceCell label="Lugar de Recogida" value={car.pickupLocation} />
                  <ServiceCell label="Tipo de Seguro" value={car.insuranceType === 'all_risk' ? 'Todo Riesgo' : (car.insuranceType ? 'Básico' : null)} />
                  <ServiceCell label="Conductores Adicionales" value={car.additionalDrivers?.toString()} />
                  <ServiceCell label="Tarjeta Garantía" value={car.guaranteeCreditCard} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ VISAS ══ */}
        {visas.length > 0 && (
          <>
            <div className="v-section-title">TRÁMITE DE VISAS</div>
            <ServiceCard title="Detalles de Visa">
              {visas.map((visa, i) => (
                <div className="v-service-grid" key={`visa-${i}`}>
                  <ServiceCell label="Solicitante" value={visa.fullName} />
                  <ServiceCell label="Nacionalidad" value={visa.nationality} />
                  <ServiceCell label="N° Pasaporte" value={visa.docNumber} />
                  <ServiceCell label="País al que Aplica" value={visa.countryApplying} />
                  <ServiceCell label="Tipo de Visa" value={visa.visaType} />
                  <ServiceCell label="Viaje Estimado" value={visa.estimatedTravelDate ? formatDate(visa.estimatedTravelDate) : null} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ FINCAS ══ */}
        {fincas.length > 0 && (
          <>
            <div className="v-section-title">ALOJAMIENTO (FINCAS)</div>
            <ServiceCard title="Reserva de Finca">
              {fincas.map((finca, i) => (
                <div className="v-service-grid" key={`finca-${i}`}>
                  <ServiceCell label="Finca" value={finca.fincaName} />
                  <ServiceCell label="Ciudad/Destino" value={finca.fincaCity} />
                  <ServiceCell label="Responsable" value={finca.responsibleName} />
                  <ServiceCell label="Documento" value={finca.docNumber} />
                  <ServiceCell label="Check-In" value={finca.checkInDate ? formatDate(finca.checkInDate) : null} />
                  <ServiceCell label="Check-Out" value={finca.checkOutDate ? formatDate(finca.checkOutDate) : null} />
                  <ServiceCell label="Adultos" value={finca.adultsCount?.toString()} />
                  <ServiceCell label="Niños" value={finca.childrenCount?.toString()} />
                  <ServiceCell label="Mascotas" value={finca.hasPets ? `Sí - ${finca.petType || ''}` : 'No'} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ MIGRACIÓN ══ */}
        {migrations.length > 0 && (
          <>
            <div className="v-section-title">TRÁMITES MIGRATORIOS</div>
            <ServiceCard title="Migración">
              {migrations.map((mig, i) => (
                <div className="v-service-grid" key={`mig-${i}`}>
                  <ServiceCell label="Pasajero" value={mig.passengerName} />
                  <ServiceCell label="Nacionalidad" value={mig.nationality} />
                  <ServiceCell label="Trámite / Doc" value={mig.requestedDocType} />
                  <ServiceCell label="N° Pasaporte" value={mig.docNumber} />
                  <ServiceCell label="Vencimiento" value={mig.passportExpiry ? formatDate(mig.passportExpiry) : null} />
                  <ServiceCell label="País Destino" value={mig.destinationCountry} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ SIM CARDS ══ */}
        {simCards.length > 0 && (
          <>
            <div className="v-section-title">SIM CARDS / CONECTIVIDAD</div>
            <ServiceCard title="Planes de Datos">
              {simCards.map((sim, i) => (
                <div className="v-service-grid" key={`sim-${i}`}>
                  <ServiceCell label="Pasajero" value={sim.passengerName} />
                  <ServiceCell label="País Destino" value={sim.destinationCountry} />
                  <ServiceCell label="Llegada" value={sim.arrivalDate ? formatDate(sim.arrivalDate) : null} />
                  <ServiceCell label="Plan de Datos" value={sim.dataPlan} />
                  <ServiceCell label="Tipo SIM" value={sim.simType} />
                  <ServiceCell label="Método de Entrega" value={sim.deliveryMethod} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ CONVENCIONES ══ */}
        {conventions.length > 0 && (
          <>
            <div className="v-section-title">EVENTOS & CONVENCIONES</div>
            <ServiceCard title="Participación en Evento">
              {conventions.map((conv, i) => (
                <div className="v-service-grid" key={`conv-${i}`}>
                  <ServiceCell label="Organización / Evento" value={conv.organization} />
                  <ServiceCell label="Contacto" value={conv.contactName} />
                  <ServiceCell label="Tipo de Evento" value={conv.eventType} />
                  <ServiceCell label="Inicio" value={conv.startDate ? formatDate(conv.startDate) : null} />
                  <ServiceCell label="Fin" value={conv.endDate ? formatDate(conv.endDate) : null} />
                  <ServiceCell label="Asistentes" value={conv.estimatedAttendance?.toString()} />
                  <ServiceCell label="Espacio Requerido" value={conv.requiredSpace} />
                  <ServiceCell label="Catering" value={conv.hasCatering ? `Sí - ${conv.cateringNotes || ''}` : 'No'} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ PASAPORTES ══ */}
        {passports.length > 0 && (
          <>
            <div className="v-section-title">TRÁMITE DE PASAPORTES</div>
            <ServiceCard title="Detalles">
              {passports.map((pass, i) => (
                <div className="v-service-grid" key={`pass-${i}`}>
                  <ServiceCell label="Titular" value={pass.fullName} />
                  <ServiceCell label="N° Identificación" value={pass.idNumber} />
                  <ServiceCell label="Ciudad de Residencia" value={pass.residenceCity} />
                  <ServiceCell label="Tipo de Trámite" value={pass.processType} />
                  <ServiceCell label="Viaje Estimado" value={pass.estimatedTravelDate ? formatDate(pass.estimatedTravelDate) : null} />
                  <ServiceCell label="Teléfono" value={pass.phone} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ MASCOTAS ══ */}
        {petServices.length > 0 && (
          <>
            <div className="v-section-title">TRANSPORTE DE MASCOTAS</div>
            <ServiceCard title="Detalles del Servicio">
              {petServices.map((pet, i) => (
                <div className="v-service-grid" key={`pet-${i}`}>
                  <ServiceCell label="Dueño" value={pet.ownerName} />
                  <ServiceCell label="Mascota" value={pet.petName} />
                  <ServiceCell label="Especie / Raza" value={`${pet.species || ''} / ${pet.breed || ''}`} />
                  <ServiceCell label="Peso / Tamaño" value={`${pet.weight ?? ''} kg - ${pet.size || ''}`} />
                  <ServiceCell label="Tipo de Viaje" value={pet.travelType} />
                  <ServiceCell label="Ruta / Destino" value={pet.destinationCountry} />
                  <ServiceCell label="Fecha" value={pet.travelDate ? formatDate(pet.travelDate) : null} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ CHECK-IN ══ */}
        {checkIns.length > 0 && (
          <>
            <div className="v-section-title">ASISTENCIA CHECK-IN</div>
            <ServiceCard title="Vuelos a Chequear">
              {checkIns.map((ci, i) => (
                <div className="v-service-grid" key={`ci-${i}`}>
                  <ServiceCell label="Pasajero" value={ci.passengerName} />
                  <ServiceCell label="Documento" value={ci.docType && ci.docNumber ? `${ci.docType}: ${ci.docNumber}` : ci.docNumber} />
                  <ServiceCell label="Vuelo / Reserva" value={ci.flightOrReservation} />
                  <ServiceCell label="Fecha de Viaje" value={ci.travelDate ? formatDate(ci.travelDate) : null} />
                  <ServiceCell label="Silla" value={ci.seat} />
                  <ServiceCell label="Equipaje" value={ci.baggage} />
                  <ServiceCell label="Necesidades Esp." value={ci.specialNeeds} />
                  <ServiceCell label="Silla de Ruedas" value={ci.needsWheelchair ? "Sí, requerida" : null} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}
        
        {/* ══ RESTAURANTES ══ */}
        {restaurants.length > 0 && (
          <>
            <div className="v-section-title">RESERVAS DE RESTAURANTES</div>
            <ServiceCard title="Detalles de la Reserva">
              {restaurants.map((rest, i) => (
                <div className="v-service-grid" key={`rest-${i}`}>
                  <ServiceCell label="Reserva a Nombre" value={rest.reservationName} />
                  <ServiceCell label="Fecha y Hora" value={rest.dateTime ? formatDateTime(rest.dateTime) : null} />
                  <ServiceCell label="N° Personas" value={rest.peopleCount?.toString()} />
                  <ServiceCell label="Mesa Preferida" value={rest.tablePreference} />
                  <ServiceCell label="Tipo de Menú" value={rest.menuType} />
                  <ServiceCell label="Restricciones" value={Array.isArray(rest.dietaryRestrictions) ? rest.dietaryRestrictions.join(', ') : rest.dietaryRestrictions} />
                  <ServiceCell label="Ocasión Especial" value={rest.specialOccasion} />
                </div>
              ))}
            </ServiceCard>
          </>
        )}

        {/* ══ PAYMENT ══ */}
        <div className="v-payment-box">
          <div className="v-payment-details">
            <div className="v-payment-item">
              <label>Método de Pago</label>
              <span>{paymentMethodStr}</span>
            </div>
            <div className="v-payment-item">
              <label>Emisor</label>
              <span>DB Nexus Platform</span>
            </div>
          </div>
          <div className="v-payment-total">
            <label>Valor Total</label>
            <span>{formatCurrency(sale.total)}</span>
          </div>
        </div>

        {/* ══ LEGAL TERMS (Improved) ══ */}
        <div className="v-legal">
          <h4 className="v-terms-title">Condiciones de Servicio & Políticas Legales</h4>
          DB Nexus Platform actúa estrictamente como intermediario tecnológico entre el cliente y los prestadores finales de servicios (aerolíneas, hoteles, operadores terrestres).<br /><br />
          <ul className="v-legal-list">
            <li><strong>Presentación:</strong> Es obligatorio presentarse con 2 horas de anticipación para vuelos nacionales y 4 horas para vuelos internacionales.</li>
            <li><strong>Documentación:</strong> El pasajero es el único responsable de portar documentos de identidad vigentes, visas, permisos de menores y certificaciones sanitarias exigidas por su destino.</li>
            <li><strong>Check-in:</strong> DB Nexus podrá brindar asistencia con el pase de abordar sujeto a la disponibilidad y tiempos de la aerolínea (típicamente 24 horas antes del vuelo). DB Nexus no asume responsabilidad si el pasajero no realiza este trámite a tiempo.</li>
            <li><strong>Responsabilidad Limitada:</strong> Todo cambio, demora, cancelación o penalidad está sujeta única y exclusivamente a las políticas comerciales de la aerolínea o proveedor final.</li>
          </ul>
          <div className="v-company">
            <strong>DB Nexus Platform</strong> | Soluciones Integrales<br />
            soporte@dbnexus.com | dbnexus.com
          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div className="v-footer">
          <div className="v-footer-brand">DB<span>NEXUS</span></div>
          <div className="v-footer-right">
            © {new Date().getFullYear()} DB Nexus. Todos los derechos reservados.<br />
            Documento Generado Electrónicamente
          </div>
        </div>

      </div>
    </div>
  );
});

VoucherPDF.displayName = 'VoucherPDF';
