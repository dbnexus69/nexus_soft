-- Imagen propia de encabezado y pie del voucher (a pedido de agencias que ya tienen su propio diseño).
--
-- Mismo patrón que `logo_url`: solo el nombre del archivo en el bucket `logos`, bajo la carpeta de la
-- empresa. Nulas por defecto, ninguna agencia existente cambia. Si la de encabezado está puesta,
-- reemplaza del todo la banda de color + logo + nombre (decisión del usuario, 2026-11-07); la de pie se
-- agrega sobre el texto de `voucher_pie`, que sigue aparte. `empresas` ya tiene RLS (`empresa_propia`).

ALTER TABLE "empresas" ADD COLUMN "voucher_encabezado_imagen" TEXT,
ADD COLUMN "voucher_pie_imagen" TEXT;
