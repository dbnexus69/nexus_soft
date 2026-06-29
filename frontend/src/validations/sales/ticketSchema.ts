import { z } from "zod";

export const passengerSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  docType: z.string().optional(),
  docNumber: z.string().optional(),
  birthDate: z.string().optional(),
  esTitular: z.boolean().optional(),
  asiento: z.string().optional(),
  nroReserva: z.string().optional(),
  nroTiquete: z.string().optional()
}).refine(data => data.name.trim().length > 0, {
  message: "Nombre invÃ¡lido",
  path: ["name"]
});

export const flightLegSchema = z.object({
  origin: z.string().min(1, "Origen es requerido"),
  destination: z.string().min(1, "Destino es requerido"),
  flightNumber: z.string().min(3, "MÃ­nimo 3 caracteres").max(6, "MÃ¡ximo 6 caracteres"),
  date: z.string().min(1, "Fecha de salida requerida"),
  arrivalDate: z.string().min(1, "Fecha de llegada requerida"),
  seat: z.string().optional()
}).refine(data => !data.seat || (data.seat.length >= 2 && data.seat.length <= 5), {
  message: "Silla invÃ¡lida (2-5 caracteres)",
  path: ["seat"]
});

export const ticketSchema = z.object({
  airline: z.string().min(1, "AerolÃ­nea requerida"),
  supplier: z.string().min(1, "Proveedor requerido"),
  reservationNumber: z.string().length(6, "Debe tener 6 caracteres").regex(/^[A-Z0-9]+$/, "AlfanumÃ©rico mayÃºsculas"),
  flightMode: z.enum(["one_way", "round_trip"]),
  hasStops: z.boolean().optional(),
  returnHasStops: z.boolean().optional(),
  
  passengers: z.array(passengerSchema).min(1, "Debe haber al menos un pasajero"),
  
  legs: z.array(flightLegSchema).min(1, "Debe haber al menos un trayecto"),
  outboundStops: z.array(flightLegSchema).optional(),
  
  returnLeg: flightLegSchema.optional(),
  returnStops: z.array(flightLegSchema).optional(),
  supplierCost: z.number().min(0, "Obligatorio"),
  ta: z.number().min(0, "Obligatorio"),
  supplierPaymentMethod: z.string().min(1, "Obligatorio"),
}).superRefine((data, ctx) => {
  // Validar titularidad y tiquete
  const titular = data.passengers.find(p => p.esTitular) || data.passengers[0];
  if (!titular.nroTiquete || titular.nroTiquete.trim().length < 8 || titular.nroTiquete.trim().length > 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Nro de tiquete del titular invÃ¡lido (8-16 caracteres)",
      path: ["passengers", "titular", "nroTiquete"]
    });
  }

  if (data.hasStops && (!data.outboundStops || data.outboundStops.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Escalas de ida requeridas",
      path: ["outboundStops"]
    });
  }

  if (data.flightMode === "round_trip") {
    if (!data.returnLeg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vuelo de vuelta requerido",
        path: ["returnLeg"]
      });
    }
    if (data.returnHasStops && (!data.returnStops || data.returnStops.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escalas de vuelta requeridas",
        path: ["returnStops"]
      });
    }
  }
});

