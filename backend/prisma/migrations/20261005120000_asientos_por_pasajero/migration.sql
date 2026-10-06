-- Un asiento por pasajero y por tramo (spec 012).
--
-- `[{ "tramo": <orden del tramo en su tiquete>, "asiento": "12A" }, …]`. Nullable: las ventas anteriores no lo tienen y
-- siguen mostrando el asiento de su tramo (`tramos_vuelo.asiento`). `pasajeros_detalle.asiento` (uno solo) se deja por
-- los datos viejos; el código ya no lo escribe.
ALTER TABLE "pasajeros_detalle" ADD COLUMN "asientos" JSONB;
