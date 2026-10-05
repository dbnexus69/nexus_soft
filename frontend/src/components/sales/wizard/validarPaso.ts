import { documentoDePersonaInvalido } from "../documentosDeLaVenta";
import { ticketSchema } from "../../../validations/sales/ticketSchema";
import type { WizardFormData } from "../wizardData";
import type { SaleProductId } from "../../../types";

/**
 * Las reglas de cada paso del asistente de venta, con los mismos criterios que el servidor (un 422 al final
 * del asistente es tarde). Devuelve los errores por campo; un objeto vacío es que el paso es válido.
 * `avisar` muestra el mensaje largo de un producto concreto (los errores de formulario no caben en un campo).
 */
export function validarPaso(s: number, form: WizardFormData, data: any, avisar: (mensaje: string) => void): Record<string, string> {
  const errs: Record<string, string> = {};
  if (s === 1) {
    if (!form.clientId) errs.clientId = "El cliente es obligatorio";
    if (form.commissionAgentName && !form.commissionAgentId) {
      errs.commissionAgent = "El comisionista ingresado no está registrado";
    } else if (form.commissionAgentId) {
      if (data.commissionAgents && data.commissionAgents.length > 0) {
        const agentExists = data.commissionAgents.some(
          (a: any) => String(a.id) === String(form.commissionAgentId)
        );
        if (!agentExists) {
          errs.commissionAgent = "El comisionista seleccionado ya no existe en el sistema";
        }
      }
    }
  }
  if (s === 2) {
    if (form.selectedProducts.length === 0) {
      errs.products = "Debes seleccionar al menos un producto";
    } else if (form.selectedProducts.includes("ticket")) {
      if (!form.tickets || form.tickets.length === 0) {
        errs.products = "Debes configurar al menos un tiquete";
      } else {
        for (let i = 0; i < form.tickets.length; i++) {
          const ticket = form.tickets[i];
          const parsed = ticketSchema.safeParse(ticket);
          
          if (!parsed.success) {
            const errorMessage = parsed.error.issues[0].message;
            avisar(`El servicio de Tiquetería #${i + 1} tiene campos inválidos: ${errorMessage}`);
            errs.tiqueteriaValidation = "invalid";
            break;
          }
        }
      }
    }

    if (form.selectedProducts.includes("hotel")) {
      if (!form.hotels || form.hotels.length === 0) {
        errs.products = "Debes configurar al menos un hotel";
      } else {
        for (let i = 0; i < form.hotels.length; i++) {
          const hotel = form.hotels[i];
          const isStrictlyValid = (() => {
            if (!hotel) return false;
            if (!hotel.hotelName || hotel.hotelName.trim().length < 2 || hotel.hotelName.trim().length > 50) return false;
            if (!hotel.destination || hotel.destination.trim().length === 0) return false;
            if (!hotel.supplier || hotel.supplier.trim().length === 0) return false;
            if (!hotel.reservationNumber || hotel.reservationNumber.trim().length === 0 || hotel.reservationNumber.trim().length > 20) return false;
            if (!hotel.startDate || !hotel.endDate) return false;
            
            // Validar que fechas no sean del pasado
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            if (new Date(hotel.startDate) < now || new Date(hotel.endDate) < now) return false;

            if (hotel.supplierCost <= 0) return false;
            if (hotel.ta < 0) return false;
            if (!hotel.supplierPaymentMethod) return false;
            return true;
          })();

          if (!isStrictlyValid) {
            avisar(`El servicio de Hotelería #${i + 1} tiene campos requeridos vacíos o inválidos (El nombre de hotel debe tener entre 2 y 50 letras, la reserva máximo 20 caracteres y sin caracteres especiales, las fechas deben ser futuras y los montos obligatorios). Por favor, edítalo.`);
            errs.hoteleriaValidation = "invalid";
            break;
          }
        }
      }
    }

    if (form.selectedProducts.includes("insurance")) {
      if (!form.insurances || form.insurances.length === 0) {
        errs.products = "Debes configurar al menos un seguro de viaje";
      } else {
        for (let i = 0; i < form.insurances.length; i++) {
          const ins = form.insurances[i];
          const isStrictlyValid = (() => {
            if (!ins) return false;
            
            // Validar tipo de seguro
            if (!ins.insuranceType || ins.insuranceType.trim().length < 3 || ins.insuranceType.trim().length > 40) return false;

            // Validar teléfono del cliente: limpiar a números y medir de 7 a 15
            const cleanedPhone = ins.phone ? ins.phone.replace(/\D/g, "") : "";
            if (cleanedPhone.length < 7 || cleanedPhone.length > 15) return false;

            // Validar financieros: obligatorios y mayores de 0
            if (ins.supplierCost <= 0 || ins.ta < 0) return false;
            if (!ins.supplierPaymentMethod) return false;

            return true;
          })();

          if (!isStrictlyValid) {
            avisar(`El servicio de Seguro de Viaje #${i + 1} tiene campos requeridos vacíos o inválidos. El tipo de seguro debe tener entre 3 y 40 caracteres, el teléfono entre 7 y 15 dígitos y los costos financieros obligatorios.`);
            errs.segurosValidation = "invalid";
            break;
          }
        }
      }
    }

    // Cada producto de la lista pasa por sus reglas; el primero con errores se avisa y detiene la revisión.
    const revisar = <T,>(id: string, lista: T[] | undefined, vacio: string, invalido: string, titulo: string, clave: string, reglas: (x: T, errores: string[]) => void) => {
      if (!form.selectedProducts.includes(id as SaleProductId)) return;
      if (!lista || lista.length === 0) { errs.products = vacio; return; }
      for (let i = 0; i < lista.length; i++) {
        const errors: string[] = [];
        if (!lista[i]) errors.push(invalido); else reglas(lista[i], errors);
        if (errors.length > 0) {
          avisar(`${titulo} #${i + 1} tiene errores: ${errors.join(", ")}`);
          errs[clave] = "invalid";
          break;
        }
      }
    };

    revisar("plan", form.plans, "Debes configurar al menos un paquete", "Plan inválido", "El servicio de Paquetes", "planesValidation", (plan, errors) => {
      // Campo común a ambos tipos
      if (!plan.planName || plan.planName.trim().length > 50) errors.push("Nombre del Plan (máx 50 chars)");

      if (plan.packageType === 'supplier') {
        // ── PAQUETE POR PROVEEDOR: solo campos mínimos ──────────────
        if (!plan.supplier || plan.supplier.trim().length === 0) errors.push("Proveedor (requerido)");

        if (!plan.vouchers || plan.vouchers.length === 0) {
          if (!plan.voucher) errors.push("Debe adjuntar el voucher del proveedor");
        }

        if (plan.supplierCost === undefined || plan.supplierCost <= 0) errors.push("Costo Proveedor (> $0)");
        if (plan.ta === undefined || plan.ta < 0) errors.push("Ganancia (>= $0)");
        if (!plan.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");

      } else {
        // ── PAQUETE POR EMPRESA: validación completa ────────────────
        if (!plan.hotelName || plan.hotelName.trim().length < 2 || plan.hotelName.trim().length > 50) errors.push("Nombre del Hotel (2-50 chars)");
        if (!plan.reservationNumber || plan.reservationNumber.trim().length === 0 || plan.reservationNumber.trim().length > 20) errors.push("Número de Reservación (1-20 chars)");
        if (plan.adultsCount === undefined || plan.adultsCount < 0 || plan.adultsCount > 999) errors.push("Adultos (0-999)");
        if (plan.childrenCount === undefined || plan.childrenCount < 0 || plan.childrenCount > 999) errors.push("Menores (0-999)");
        if (!plan.flightNumber || plan.flightNumber.trim().length === 0) {
          errors.push(plan.transportType === 'Terrestre' ? "Placa / Vehículo (requerido)" : "Número de Vuelo (requerido)");
        } else if (plan.transportType !== 'Terrestre') {
          if (plan.flightNumber.length > 8) {
            errors.push("Número de Vuelo (máx 8 caracteres)");
          } else if (!/^[A-Z0-9]+$/.test(plan.flightNumber)) {
            errors.push("Número de Vuelo (debe ser alfanumérico en mayúsculas sin espacios ni caracteres especiales)");
          }
        }
        if (!plan.ticketNumber || plan.ticketNumber.trim().length === 0) {
          errors.push(plan.transportType === 'Terrestre' ? "Puesto / Asiento (requerido)" : "Número de Tiquete (requerido)");
        } else if (plan.transportType !== 'Terrestre') {
          if (plan.ticketNumber.length < 13 || plan.ticketNumber.length > 14) {
            errors.push("Número de Tiquete (mínimo 13 y máximo 14 dígitos)");
          } else if (!/^\d+$/.test(plan.ticketNumber)) {
            errors.push("Número de Tiquete (debe ser estrictamente numérico)");
          }
        }
        if (!plan.confirmationNumber || plan.confirmationNumber.trim().length === 0) {
          errors.push("Confirmación (requerido)");
        } else if (plan.confirmationNumber.length !== 6) {
          errors.push("Confirmación (debe tener exactamente 6 caracteres)");
        } else if (!/^[A-Z0-9]+$/.test(plan.confirmationNumber)) {
          errors.push("Confirmación (debe ser alfanumérico en mayúsculas sin espacios ni caracteres especiales)");
        }
        if (!plan.supplier || plan.supplier.trim().length === 0) errors.push("Proveedor (requerido)");

        if (!plan.flightDepartureDate) errors.push("Fecha Ida (requerido)");
        if (!plan.flightReturnDate) errors.push("Fecha Vuelta (requerido)");
        if (!plan.startDate) errors.push("Ingreso Hotel (requerido)");
        if (!plan.endDate) errors.push("Salida Hotel (requerido)");
        if (!plan.flightDepartureArrivalDate) errors.push("Llegada Ida (requerido)");
        if (!plan.flightReturnArrivalDate) errors.push("Llegada Vuelta (requerido)");

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (plan.flightDepartureDate && new Date(plan.flightDepartureDate) < now) errors.push("Fecha Ida no puede ser anterior a la fecha actual");
        if (plan.flightReturnDate && new Date(plan.flightReturnDate) < now) errors.push("Fecha Vuelta no puede ser anterior a la fecha actual");
        if (plan.startDate && new Date(plan.startDate) < now) errors.push("Ingreso Hotel no puede ser anterior a la fecha actual");
        if (plan.endDate && new Date(plan.endDate) < now) errors.push("Salida Hotel no puede ser anterior a la fecha actual");
        if (plan.flightDepartureArrivalDate && new Date(plan.flightDepartureArrivalDate) < now) errors.push("Llegada Ida no puede ser anterior a la fecha actual");
        if (plan.flightReturnArrivalDate && new Date(plan.flightReturnArrivalDate) < now) errors.push("Llegada Vuelta no puede ser anterior a la fecha actual");

        if (plan.flightDepartureDate && plan.flightDepartureArrivalDate && new Date(plan.flightDepartureArrivalDate) < new Date(plan.flightDepartureDate)) {
          errors.push("Llegada Ida debe ser posterior a la Fecha Ida");
        }
        if (plan.flightReturnDate && plan.flightReturnArrivalDate && new Date(plan.flightReturnArrivalDate) < new Date(plan.flightReturnDate)) {
          errors.push("Llegada Vuelta debe ser posterior a la Fecha Vuelta");
        }
        if (plan.flightDepartureDate && plan.flightReturnDate && new Date(plan.flightReturnDate) < new Date(plan.flightDepartureDate)) {
          errors.push("Fecha Vuelta debe ser posterior a la Fecha Ida");
        }
        if (plan.startDate && plan.endDate && new Date(plan.endDate) < new Date(plan.startDate)) {
          errors.push("Salida Hotel debe ser posterior al Ingreso Hotel");
        }

        if (plan.supplierCost === undefined || plan.supplierCost <= 0) errors.push("Costo Proveedor (> $0)");
        if (plan.ta === undefined || plan.ta < 0) errors.push("Ganancia (>= $0)");
        if (!plan.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
      }

      // Integrantes: requeridos en ambos tipos
      if (plan.guests && plan.guests.length > 0) {
        plan.guests.forEach((g, gIdx) => {
          if (!g.name || g.name.trim().length < 3 || g.name.trim().length > 70) {
            errors.push(`Integrante #${gIdx + 1}: Nombre Completo (3-70 caracteres)`);
          } else if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(g.name)) {
            errors.push(`Integrante #${gIdx + 1}: Nombre Completo solo permite letras y espacios`);
          }
          if (!g.docType || g.docType.trim().length === 0) {
            errors.push(`Integrante #${gIdx + 1}: Tipo de Documento es requerido`);
          }
          if (!g.docNumber || g.docNumber.trim().length < 5 || g.docNumber.trim().length > 20) {
            errors.push(`Integrante #${gIdx + 1}: Número de Documento (5-20 caracteres)`);
          } else if (/[^a-zA-Z0-9]/.test(g.docNumber)) {
            errors.push(`Integrante #${gIdx + 1}: Número de Documento debe ser alfanumérico`);
          }
        });
      } else {
        errors.push("Debes registrar al menos un integrante en el plan");
      }
    });

    revisar("checkin", form.checkIns, "Debes configurar al menos un Check-in", "Check-in inválido", "El servicio de Check-in", "checkinValidation", (check, errors) => {
      if (!check.passengerName || check.passengerName.trim().length === 0) errors.push("Nombre del pasajero (requerido)");
      if (!check.docType || check.docType.trim().length === 0) errors.push("Tipo de Doc (requerido)");
      if (!check.docNumber || check.docNumber.trim().length === 0) errors.push("Nº de Doc (requerido)");
      if (!check.flightOrReservation || check.flightOrReservation.trim().length < 3 || check.flightOrReservation.trim().length > 8) errors.push("Vuelo o Reserva (3-8 chars)");
      if (!check.travelDate) errors.push("Fecha de viaje (requerido)");
      if (check.seat && check.seat.trim().length > 10) errors.push("Silla Preferida (máx 10 chars)");

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (check.travelDate && new Date(check.travelDate) < now) errors.push("Fecha de viaje debe ser futura");
    });

    revisar("migration", form.migrations, "Debes configurar al menos una Documentación Migratoria", "Documento inválido", "El servicio de Documentación Migratoria", "migrationValidation", (mig, errors) => {
      if (!mig.passengerName || mig.passengerName.trim().length === 0) errors.push("Nombre del pasajero (requerido)");
      if (!mig.birthDate) errors.push("Fecha de Nacimiento (requerida)");
      if (!mig.nationality || mig.nationality.trim().length === 0 || mig.nationality.length > 30) errors.push("Nacionalidad (1-30 chars)");
      if (!mig.docType) errors.push("Tipo de Documento (requerido)");
      if (!mig.docNumber || mig.docNumber.trim().length < 5 || mig.docNumber.length > 20) errors.push("Número de Documento (5-20 chars)");
      if (mig.docType === "Pasaporte" && !mig.passportExpiry) errors.push("Vencimiento de Documento (requerido)");
      if (!mig.destinationCountry || mig.destinationCountry.trim().length === 0) errors.push("País de Destino (requerido)");
      if (!mig.requestedDocType || mig.requestedDocType.trim().length === 0) errors.push("Trámite (requerido)");
      
      if (mig.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(mig.email)) errors.push("Correo electrónico inválido");
        if (!mig.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (mig.birthDate && new Date(mig.birthDate) > now) errors.push("Fecha de Nacimiento no puede ser futura");
      if (mig.passportExpiry && new Date(mig.passportExpiry) < now) errors.push("Vencimiento de Documento no puede ser pasado");
    });

    revisar("simcard", form.simCards, "Debes configurar al menos una SIM Card", "SIM Card inválida", "El servicio de SIM Card", "simCardValidation", (sim, errors) => {
      if (!sim.passengerName || sim.passengerName.trim().length === 0) errors.push("Nombre del Titular (requerido)");
      if (!sim.destinationCountry || sim.destinationCountry.trim().length === 0) errors.push("País de Destino (requerido)");
      if (!sim.arrivalDate) errors.push("Fecha de Llegada (requerida)");
      if (!sim.tripDuration || isNaN(Number(sim.tripDuration)) || Number(sim.tripDuration) <= 0) errors.push("Duración del Viaje (mayor a 0)");
      
      if (sim.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sim.email)) errors.push("Correo electrónico inválido");
        if (!sim.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (sim.arrivalDate && new Date(sim.arrivalDate) < now) errors.push("Fecha de Llegada no puede ser pasada");
    });

    revisar("car", form.carRentals, "Debes configurar al menos una Renta de Vehículo", "Renta de Vehículo inválida", "El servicio de Renta de Vehículo", "carRentalValidation", (car, errors) => {
      if (!car.mainDriver || car.mainDriver.trim().length === 0) errors.push("Conductor Principal (requerido)");
      if (!car.pickupDate) errors.push("Recogida (requerida)");
      if (!car.returnDate) errors.push("Devolución (requerida)");
      
      const cleanLicense = car.licenseNumber ? car.licenseNumber.replace(/[\-\s]/g, "") : "";
      if (cleanLicense.length < 5 || cleanLicense.length > 18) {
        errors.push("Número de Licencia (5-18 caracteres)");
      }
      
      if (car.additionalDrivers === undefined || car.additionalDrivers < 0 || car.additionalDrivers > 10) {
        errors.push("Conductores Adicionales (0-10)");
      }

      if (!car.guaranteeCreditCard || car.guaranteeCreditCard.trim().length !== 4) {
        errors.push("Tarjeta de Garantía (exactamente 4 dígitos)");
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (car.pickupDate && new Date(car.pickupDate) < now) errors.push("Recogida no puede ser pasada");
      if (car.returnDate && new Date(car.returnDate) < now) errors.push("Devolución no puede ser pasada");
      if (car.pickupDate && car.returnDate && new Date(car.returnDate) < new Date(car.pickupDate)) errors.push("Devolución debe ser posterior a la Recogida");
    });

    revisar("finca", form.fincas, "Debes configurar al menos una Renta de Finca", "Renta de Finca inválida", "El servicio de Renta de Finca", "fincaValidation", (finca, errors) => {
      if (!finca.fincaName || finca.fincaName.trim().length < 3 || finca.fincaName.trim().length > 30) errors.push("Nombre de la Finca (3-30 caracteres)");
      if (!finca.fincaCity || finca.fincaCity.trim().length < 3 || finca.fincaCity.trim().length > 50) errors.push("Ciudad o Pueblo (3-50 caracteres)");
      if (!finca.fincaAddress || finca.fincaAddress.trim().length < 5 || finca.fincaAddress.trim().length > 30) errors.push("Dirección de la Finca (5-30 caracteres)");
      if (!finca.responsibleName || finca.responsibleName.trim().length === 0) errors.push("Responsable (requerido)");
      if (!finca.checkInDate) errors.push("Check-in (requerido)");
      if (!finca.checkOutDate) errors.push("Check-out (requerido)");
      
      if (finca.adultsCount === undefined || isNaN(Number(finca.adultsCount)) || Number(finca.adultsCount) < 0 || Number(finca.adultsCount) > 999) errors.push("Número de Adultos (0-999)");
      if (finca.childrenCount === undefined || isNaN(Number(finca.childrenCount)) || Number(finca.childrenCount) < 0 || Number(finca.childrenCount) > 999) errors.push("Número de Niños (0-999)");

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (finca.checkInDate && new Date(finca.checkInDate) < now) errors.push("Check-in no puede ser pasado");
      if (finca.checkOutDate && new Date(finca.checkOutDate) < now) errors.push("Check-out no puede ser pasado");
      if (finca.checkInDate && finca.checkOutDate && new Date(finca.checkOutDate) < new Date(finca.checkInDate)) errors.push("Check-out debe ser posterior al Check-in");
      if (!finca.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
    });

    revisar("tour", form.tours, "Debes configurar al menos un Tour", "Tour inválido", "El servicio de Tour", "tourValidation", (tour, errors) => {
      if (!tour.passengerName || tour.passengerName.trim().length === 0) errors.push("Nombre del Pasajero (requerido)");
      if (!tour.pickupPoint || tour.pickupPoint.trim().length === 0 || tour.pickupPoint.length > 30) errors.push("Punto de Recogida (1-30 caracteres)");
      
      if (tour.adultsCount === undefined || isNaN(Number(tour.adultsCount)) || Number(tour.adultsCount) < 0 || Number(tour.adultsCount) > 999) errors.push("Número de Adultos (0-999)");
      if (tour.childrenCount === undefined || isNaN(Number(tour.childrenCount)) || Number(tour.childrenCount) < 0 || Number(tour.childrenCount) > 999) errors.push("Número de Niños (0-999)");

      if (!tour.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
    });

    revisar("convention", form.conventions, "Debes configurar al menos un Centro de Convención", "Convención inválida", "El servicio de Centro de Convenciones", "conventionValidation", (conv, errors) => {
      if (!conv.placeName || conv.placeName.trim().length < 3 || conv.placeName.trim().length > 40) errors.push("Nombre del Lugar (3-40 caracteres)");
      if (!conv.city || conv.city.trim().length < 3 || conv.city.trim().length > 40) errors.push("Ciudad (3-40 caracteres)");
      if (!conv.address || conv.address.trim().length < 5 || conv.address.trim().length > 40) errors.push("Dirección (5-40 caracteres)");
      if (!conv.requiredSpace || conv.requiredSpace.trim().length < 3 || conv.requiredSpace.trim().length > 40) errors.push("Espacio Requerido (3-40 caracteres)");
      if (!conv.eventType || conv.eventType.trim().length < 3 || conv.eventType.trim().length > 40) errors.push("Tipo de Evento (3-40 caracteres)");
      if (!conv.organization || conv.organization.trim().length === 0) errors.push("Organización (requerido)");
      if (!conv.contactName || conv.contactName.trim().length === 0) errors.push("Nombre de Contacto (requerido)");
      if (!conv.startDate) errors.push("Fecha Inicio (requerida)");
      if (!conv.endDate) errors.push("Fecha Fin (requerida)");
      
      if (conv.estimatedAttendance === undefined || isNaN(Number(conv.estimatedAttendance)) || Number(conv.estimatedAttendance) < 0 || Number(conv.estimatedAttendance) > 999) errors.push("Asistencia Estimada (0-999)");

      if (conv.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(conv.email)) errors.push("Correo electrónico inválido");
        if (!conv.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (conv.startDate && new Date(conv.startDate) < now) errors.push("Fecha Inicio no puede ser pasada");
      if (conv.endDate && new Date(conv.endDate) < now) errors.push("Fecha Fin no puede ser pasada");
      if (conv.startDate && conv.endDate && new Date(conv.endDate) < new Date(conv.startDate)) errors.push("Fecha Fin debe ser posterior a la de Inicio");
      if (!conv.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
    });

    revisar("restaurant", form.restaurants, "Debes configurar al menos un Restaurante", "Restaurante inválido", "El servicio de Restaurante", "restaurantValidation", (rest, errors) => {
      if (!rest.reservationName || rest.reservationName.trim().length === 0) errors.push("Nombre de Reserva (requerido)");
      if (!rest.dateTime) errors.push("Fecha y Hora (requerida)");
      if (!rest.phone || rest.phone.trim().length === 0) errors.push("Celular (requerido)");
      
      if (rest.peopleCount === undefined || isNaN(Number(rest.peopleCount)) || Number(rest.peopleCount) < 1 || Number(rest.peopleCount) > 999) errors.push("Nº de Personas (1-999)");

      if (rest.tablePreference && (rest.tablePreference.trim().length < 3 || rest.tablePreference.length > 30)) {
        errors.push("Preferencia de Mesa (3-30 caracteres)");
      }
      if (rest.menuType && (rest.menuType.trim().length < 3 || rest.menuType.length > 30)) {
        errors.push("Tipo de Menú (3-30 caracteres)");
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (rest.dateTime && new Date(rest.dateTime) < now) errors.push("Fecha y Hora no puede ser pasada");

      if (rest.ta === undefined || rest.ta <= 0) {
        errors.push("Ganancia obligatoria (> $0)");
      }
    });

    revisar("visa", form.visas, "Debes configurar al menos una Visa", "Visa inválida", "El servicio de Visa", "visaValidation", (visa, errors) => {
      if (!visa.fullName || visa.fullName.trim().length === 0) errors.push("Nombre Completo (requerido)");
      
      if (!visa.birthDate) {
        errors.push("Fecha de Nacimiento (requerida)");
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (new Date(visa.birthDate) > now) {
          errors.push("Fecha de Nacimiento no puede ser futura");
        }
      }

      if (!visa.nationality || visa.nationality.trim().length < 3 || visa.nationality.trim().length > 30) {
        errors.push("Nacionalidad (3-30 caracteres)");
      } else if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(visa.nationality)) {
        errors.push("Nacionalidad solo permite letras");
      }

      if (!visa.docType) errors.push("Tipo de Documento (requerido)");

      if (!visa.docNumber || visa.docNumber.trim().length < 5 || visa.docNumber.length > 20) {
        errors.push("Número de Documento (5-20 chars)");
      } else if (/[^a-zA-Z0-9]/.test(visa.docNumber)) {
        errors.push("Número de Documento debe ser alfanumérico");
      }

      if (visa.docType === "Pasaporte" && !visa.passportExpiration) {
        errors.push("Vencimiento de Documento (requerido)");
      } else if (visa.passportExpiration) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (new Date(visa.passportExpiration) < now) {
          errors.push("Vencimiento de Documento no puede ser pasado");
        }
      }

      if (!visa.countryApplying || visa.countryApplying.trim().length < 3 || visa.countryApplying.trim().length > 30) {
        errors.push("País al que aplica (3-30 caracteres)");
      } else if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(visa.countryApplying)) {
        errors.push("País al que aplica solo permite letras");
      }

      if (visa.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(visa.email)) errors.push("Correo electrónico inválido");
        if (!visa.email.endsWith(".com")) errors.push("Correo debe terminar en .com");
      }

      if (visa.estimatedTravelDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (new Date(visa.estimatedTravelDate) < now) {
          errors.push("Fecha Estimada de Viaje no puede ser pasada");
        }
      }
    });

    revisar("passport", form.passports, "Debes configurar al menos un Pasaporte", "Pasaporte inválido", "El trámite de Pasaporte", "passportValidation", (passport, errors) => {
      if (!passport.fullName || passport.fullName.trim().length === 0) errors.push("Nombre Completo (requerido)");
      if (!passport.idNumber || passport.idNumber.trim().length === 0) errors.push("Número de Identificación (requerido)");
      
      if (!passport.birthDate) {
        errors.push("Fecha de Nacimiento (requerida)");
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (new Date(passport.birthDate) > now) {
          errors.push("Fecha de Nacimiento no puede ser futura");
        }
      }

      if (!passport.residenceCity || passport.residenceCity.trim().length === 0) {
        errors.push("Ciudad de Residencia (requerida)");
      } else {
        if (passport.residenceCity.length > 85) {
          errors.push("Ciudad de Residencia (máximo 85 caracteres)");
        }
        if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(passport.residenceCity)) {
          errors.push("Ciudad de Residencia no debe tener números ni caracteres especiales");
        }
      }

      if (passport.estimatedTravelDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (new Date(passport.estimatedTravelDate) < now) {
          errors.push("Fecha Estimada de Viaje no puede ser pasada");
        }
      }

      if (!passport.phone || passport.phone.trim().length === 0) {
        errors.push("Teléfono de Contacto (requerido)");
      } else {
        if (passport.phone.length > 15) {
          errors.push("Teléfono de Contacto (máximo 15 caracteres)");
        }
        if (/[a-zA-Z]/.test(passport.phone)) {
          errors.push("Teléfono de Contacto no puede contener letras");
        }
      }
    });

    revisar("pet", form.petServices, "Debes configurar al menos un Transporte de Mascotas", "Transporte de Mascotas inválido", "El Transporte de Mascota", "petValidation", (pet, errors) => {
      if (!pet.ownerName || pet.ownerName.trim().length === 0) {
        errors.push("Nombre del Dueño (requerido)");
      } else if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(pet.ownerName)) {
        errors.push("Nombre del Dueño solo permite letras");
      }

      if (!pet.petName || pet.petName.trim().length === 0) {
        errors.push("Nombre de la Mascota (requerido)");
      } else if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(pet.petName)) {
        errors.push("Nombre de la Mascota solo permite letras");
      }

      if (!pet.breed || pet.breed.trim().length === 0) {
        errors.push("Raza (requerida)");
      } else if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(pet.breed)) {
        errors.push("Raza solo permite letras");
      }

      if (pet.weight === undefined || isNaN(pet.weight) || pet.weight < 0 || pet.weight > 999.9) {
        errors.push("Peso debe ser entre 0 y 999.9 kg");
      }
      if (pet.transportCompany && (pet.transportCompany.length < 3 || pet.transportCompany.length > 40)) {
        errors.push("Nombre de Empresa (3-40 caracteres)");
      }

      if (!pet.travelDate) {
        errors.push("Fecha de Viaje (requerida)");
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (new Date(pet.travelDate) < now) {
          errors.push("Fecha de Viaje no puede ser pasada");
        }
      }

      if (!pet.destinationCountry || pet.destinationCountry.trim().length < 3 || pet.destinationCountry.trim().length > 30) {
        errors.push("País Destino (3-30 caracteres)");
      } else if (/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/.test(pet.destinationCountry)) {
        errors.push("País Destino solo permite letras");
      }

      if (!pet.phone || pet.phone.trim().length === 0) {
        errors.push("Teléfono (requerido)");
      } else {
        if (pet.phone.length > 15) {
          errors.push("Teléfono (máximo 15 caracteres)");
        }
        if (/[a-zA-Z]/.test(pet.phone)) {
          errors.push("Teléfono no puede contener letras");
        }
      }
      if (!pet.supplierPaymentMethod) errors.push("Método de Pago Proveedor (requerido)");
    });

    // El documento de cada persona, con las reglas del servidor: un 422 al final del asistente es tarde.
    if (!errs.products) {
      const malo = documentoDePersonaInvalido(form, (data.config.documentTypes as any[]) || []);
      if (malo) { errs.products = malo; avisar(malo); }
    }
  }
  if (s === 3) {
    if (!form.total || Number(form.total) <= 0) errs.total = "El valor total debe ser mayor a $0";
    
    const hasPayments = form.payments && form.payments.length > 0;
    if (form.status !== "credito" && !form.paymentMethod && !hasPayments) {
      errs.paymentMethod = "La forma de pago es obligatoria";
    }
    
    if (!form.status) {
      errs.status = "El estado de la venta es obligatorio";
    }
    
    // Mismo criterio que el backend: es un crédito si lo pagado no cubre el
    // total, sea cual sea el estado elegido a mano. Comprobarlo aquí evita que
    // el asistente deje avanzar para recibir después un 422.
    const totalPagado = (form.payments || []).reduce((suma, p) => suma + (Number(p.amount) || 0), 0);
    const esCredito = form.status === "credito"
      || form.status === "abonado"
      || form.isCredit === true
      || (Number(form.total) > 0 && totalPagado < Number(form.total) - 0.005);
    if (esCredito) {
      if (!form.creditDueDate) {
        errs.creditDueDate = "La fecha de vencimiento es obligatoria";
      } else {
        const selectedDate = new Date(form.creditDueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          errs.creditDueDate = "La fecha de vencimiento no puede ser anterior a hoy";
        }
      }
    }
  }
  return errs;
}
