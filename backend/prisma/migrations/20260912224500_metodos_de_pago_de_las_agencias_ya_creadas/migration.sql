-- Las agencias dadas de alta antes de que `create` sembrara sus métodos de
-- pago se quedaron sin ninguno: el selector salía vacío y el abono se guardaba
-- sin constar por dónde entró el dinero.
--
-- Solo las que no tienen NINGUNO. A la que ya administra los suyos no se le
-- añade nada: la primera versión de esta migración sembraba en todas y le
-- metió a la agencia original un "Tarjeta Débito" con tilde al lado del
-- "Tarjeta Debito" que ya tenía. Dos nombres para el mismo método reparten los
-- cobros entre dos filas y descuadran el informe.
INSERT INTO "metodos_pago" ("nombre", "empresa_id")
SELECT m.nombre, e.id
FROM "empresas" e
CROSS JOIN (VALUES
  ('Efectivo'), ('Transferencia'), ('Tarjeta de Crédito'),
  ('Tarjeta Débito'), ('PSE'), ('Consignación')
) AS m(nombre)
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM "metodos_pago" mp WHERE mp.empresa_id = e.id)
ON CONFLICT ("empresa_id", "nombre") DO NOTHING;
