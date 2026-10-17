# Spec 018 — Crédito y cobro: asesor, último abono y contacto

**Estado:** implementada (2026-10-17), confirmada en pantalla por el usuario · **Rama:** `feat-bayrol` · **No toca la
base** (solo lectura de columnas existentes) · **Relacionadas:** `002` (números visibles por agencia)

> Escrita después de implementar: el cambio se trató como acotado y se diseñó en el chat; la auditoría del
> 2026-10-17 la pasa a spec, como pide la regla del `CLAUDE.md`.

## Qué se quiere (confirmado con el usuario)

En el desplegable de cada cliente de "Crédito y cobro":

1. **Asesor que atendió cada venta** ("Atendió: Ana Gómez"; "Sin asesor" si no tiene). Oculto con alcance `own`
   (todas son del mismo asesor).
2. **Número de venta de la agencia** ("Venta #12"), no el id global — también en el título de la ventana de cobro.
   Mostraba el id, que deja contar las ventas de otras agencias (regla de números visibles).
3. **Último abono** de cada venta: fecha y monto, o "Sin abonos".
4. **Contactar al cliente:** teléfono (`tel:`), WhatsApp (`wa.me`, en otra pestaña) y correo (`mailto:`), en una
   barra al abrir el desplegable (la fila es un botón: un enlace no puede ir dentro).

Fuera de alcance: filtro por asesor en la cartera (toca listado y totales; spec propia si se pide).

## Diseño

- `ventasCartera.js` `getClientCredits`: la consulta de créditos une `ventas` (`numero`, `usuario_id`),
  `usuarios`/`personas` del asesor y un `LATERAL` con el último `pagos_venta` por `fecha_pago`. Devuelve `numero`,
  `advisor: { id, name } | null` y `lastPayment: { date, amount } | null`. La cartera y los créditos del cliente
  devuelven `client.phone`. Mismos parámetros posicionales; la RLS filtra las tablas unidas.
- `ClientCreditRow.tsx`: barra de contacto, asesor, último abono y `#numero`. WhatsApp: un móvil colombiano de 10
  dígitos (3xx) sin "+" recibe el 57 (suposición marcada con `ponytail:` en el código).

## Cómo se comprueba

- `pnpm test:ventas-filtros`: el crédito trae `numero` de la agencia, el asesor, el último abono (no el primero) y el
  teléfono del cliente.
- `tsc`, `check:prisma`. En pantalla: confirmado por el usuario.
