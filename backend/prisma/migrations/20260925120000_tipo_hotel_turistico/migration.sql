-- El formulario de hotel ofrece "Hotel Turístico" (`hotel_turistico`) y la base
-- no lo admitía: elegirlo tumbaba el alta de la venta entera con un 500.
--
-- Solo esta línea. `migrate diff` contra la base trae además ~290 líneas que
-- borrarían las claves ajenas compuestas `(id, empresa_id)` y demás piezas que
-- viven solo en SQL crudo (ver CLAUDE.md): no se aplican.
ALTER TYPE "TipoHotel" ADD VALUE 'hotel_turistico';
