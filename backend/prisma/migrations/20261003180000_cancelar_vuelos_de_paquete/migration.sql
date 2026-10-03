-- Cancelar el vuelo de un paquete (spec 004, T6).
--
-- Un tramo de tiquetería guarda cuándo y por qué se canceló su check-in
-- (`tramos_vuelo.canceled_at`, `reason_canceled`). Un paquete lleva dos vuelos
-- en la misma fila —ida y regreso— y no tenía dónde guardarlo, así que el
-- servidor rechazaba la cancelación y la pantalla escondía el botón. Una columna
-- por sentido, como ya están `checkin_status_ida` y `checkin_status_regreso`.
--
-- Puramente aditiva y con NULL: las filas existentes no cambian, y el código de
-- la otra rama, que no las conoce, sigue funcionando.
ALTER TABLE "prod_planes" ADD COLUMN "canceled_at_ida" TIMESTAMP(3);
ALTER TABLE "prod_planes" ADD COLUMN "reason_canceled_ida" VARCHAR(255);
ALTER TABLE "prod_planes" ADD COLUMN "canceled_at_regreso" TIMESTAMP(3);
ALTER TABLE "prod_planes" ADD COLUMN "reason_canceled_regreso" VARCHAR(255);
