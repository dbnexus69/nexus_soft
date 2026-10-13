-- El objeto completo de cada línea de cotización (spec 007, replanificado): el mismo
-- `TicketData`/`HotelData`... que ya usa el asistente de venta, no solo su costo y su
-- ganancia. Aditiva: nula en las líneas de antes de este cambio.
ALTER TABLE "detalle_cotizacion" ADD COLUMN "detalle" JSONB;
