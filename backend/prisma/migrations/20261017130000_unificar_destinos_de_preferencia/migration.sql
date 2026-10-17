-- Unifica las escrituras de un mismo destino de preferencia dentro de cada agencia
-- (spec 017): "Pereira", "pEreira" o "Pereira" con un carácter invisible de copiar y
-- pegar eran destinos distintos en el filtro. Cada destino toma la escritura limpia de
-- su fila más antigua en la agencia —la misma regla que aplica ya `escribirDestinos`—;
-- si un cliente queda con el mismo destino dos veces, se queda la última aparición
-- (la de mayor `orden`) y el orden se renumera 1..n. `destino_reciente` se recalcula.
-- Solo datos; no cambia el esquema. Corre como `postgres`, que no filtra por RLS.

BEGIN;

CREATE TEMP TABLE destinos_unificados ON COMMIT DROP AS
WITH limpios AS (
  SELECT d.*,
         btrim(regexp_replace(
           regexp_replace(normalize(d.destino, NFC), '[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]', '', 'g'),
           '\s+', ' ', 'g')) AS limpio
  FROM cliente_destinos d
),
canonicos AS (
  SELECT DISTINCT ON (empresa_id, lower(limpio)) empresa_id, lower(limpio) AS clave, limpio AS canonico
  FROM limpios
  ORDER BY empresa_id, lower(limpio), creado_at, id
),
unificados AS (
  SELECT l.id, l.empresa_id, l.cliente_id, l.orden, l.creado_at, c.canonico
  FROM limpios l
  JOIN canonicos c ON c.empresa_id = l.empresa_id AND c.clave = lower(l.limpio)
),
sin_repetidos AS (
  SELECT DISTINCT ON (cliente_id, canonico) *
  FROM unificados
  ORDER BY cliente_id, canonico, orden DESC
)
SELECT id, empresa_id, cliente_id, canonico AS destino, creado_at,
       row_number() OVER (PARTITION BY cliente_id ORDER BY orden)::int AS orden
FROM sin_repetidos;

-- Se reescribe entera: renumerar en el sitio chocaría con el único (cliente_id, orden).
DELETE FROM cliente_destinos;
INSERT INTO cliente_destinos (id, empresa_id, cliente_id, destino, orden, creado_at)
SELECT id, empresa_id, cliente_id, destino, orden, creado_at FROM destinos_unificados;

UPDATE clientes c
SET destino_reciente = r.destino
FROM (
  SELECT DISTINCT ON (cliente_id) cliente_id, destino
  FROM cliente_destinos
  ORDER BY cliente_id, orden DESC
) r
WHERE r.cliente_id = c.id AND c.destino_reciente IS DISTINCT FROM r.destino;

COMMIT;
