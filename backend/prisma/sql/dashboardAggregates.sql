-- Agregados de la cabecera del dashboard: doce cifras en UNA consulta.
--
-- Deliberadamente NO se parte en varias. Medido contra la base real, cuatro de
-- estos agregados en una sola consulta cuestan 408 ms, y las mismas cuatro como
-- consultas de objetos en paralelo, 889 ms. Con doce la diferencia es mayor: lo
-- que cuesta es el viaje a la base, no el cálculo.
--
-- Los filtros son opcionales sin dejar de ser SQL estático, con el patrón
-- `($n IS NULL OR ...)`. TypedSQL necesita una consulta fija para poder
-- analizarla, así que no se pueden concatenar condiciones en tiempo de
-- ejecución.
--
-- @param {DateTime} $1:dateFrom fecha inicial, o null para no filtrar
-- @param {DateTime} $2:dateTo fecha final, o null para no filtrar
-- @param {Int} $3:asesorId id del asesor con ámbito 'own', o null para ver todo
-- @param {Int} $4:currentYear año en curso, para la comparación interanual
SELECT
  COUNT(*)::int AS "totalOperations",

  -- Ingreso reconocido: completo si está pagada, proporcional a lo abonado si
  -- está a medias.
  COALESCE(SUM(
    CASE
      WHEN status = 'pagado' THEN ta_total
      WHEN status = 'abonado' AND monto_total > 0
        THEN ta_total * (COALESCE(monto_pagado_credito, 0) / monto_total)
      ELSE 0
    END
  ), 0)::float AS "totalRevenue",

  COALESCE(SUM(
    CASE WHEN status IN ('credito', 'abonado')
         THEN monto_total - COALESCE(monto_pagado_credito, 0) ELSE 0 END
  ), 0)::float AS "pendingBalance",

  COUNT(CASE WHEN status IN ('credito', 'abonado') THEN 1 END)::int AS "pendingCount",

  COALESCE(SUM(
    CASE
      WHEN status = 'pagado' THEN costo_proveedor_total
      WHEN status = 'abonado' AND monto_total > 0
        THEN costo_proveedor_total * (COALESCE(monto_pagado_credito, 0) / monto_total)
      ELSE 0
    END
  ), 0)::float AS "suppliersTotal",

  COALESCE(SUM(CASE WHEN status = 'pagado'  THEN monto_total ELSE 0 END), 0)::float AS "paids",
  COALESCE(SUM(CASE WHEN status = 'credito' THEN monto_total ELSE 0 END), 0)::float AS "credits",
  COALESCE(SUM(CASE WHEN status = 'abonado' THEN monto_total ELSE 0 END), 0)::float AS "partPaids",

  COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM creado_at) = $4 THEN monto_total ELSE 0 END), 0)::float AS "currentYearSales",
  COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM creado_at) = $4 - 1 THEN monto_total ELSE 0 END), 0)::float AS "prevYearSales",

  -- Parte pendiente de cobro repartida entre coste de proveedor y TA.
  COALESCE(SUM(
    CASE WHEN status IN ('credito', 'abonado') AND monto_total > 0
         THEN costo_proveedor_total * ((monto_total - COALESCE(monto_pagado_credito, 0)) / monto_total)
         ELSE 0 END
  ), 0)::float AS "creditProveedores",

  COALESCE(SUM(
    CASE WHEN status IN ('credito', 'abonado') AND monto_total > 0
         THEN ta_total * ((monto_total - COALESCE(monto_pagado_credito, 0)) / monto_total)
         ELSE 0 END
  ), 0)::float AS "creditTa"

FROM ventas
WHERE deleted_at IS NULL
  AND ($1::timestamptz IS NULL OR creado_at >= $1)
  AND ($2::timestamptz IS NULL OR creado_at <= $2)
  AND ($3::int         IS NULL OR usuario_id = $3)
