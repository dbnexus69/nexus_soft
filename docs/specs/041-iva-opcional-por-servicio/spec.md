# Spec 041 — IVA opcional por servicio

**Estado: implementada, sin aplicar la migración.** · **Toca la base compartida:** sí (migración chica, aditiva) ·
**Relacionadas:** 005 (IVA sobre la TA), 007 (cotizaciones reutilizan la validación de venta)

## Qué y por qué

Hasta ahora el IVA (19% sobre la TA) se aplicaba siempre, a toda línea de una venta o cotización, sin
excepción (spec 005). El usuario pidió poder quitarlo puntualmente, servicio por servicio, para los
casos en que un servicio concreto no lleva IVA (exento, o cualquier otra razón de negocio del asesor).

## Decisiones (de la conversación con el usuario, `/brainstorming`)

1. **Quitar el IVA baja el total que paga el cliente** — la TA y el costo de proveedor no cambian; el
   total de esa línea simplemente deja de sumar el 19% de la TA. No es solo un cambio de cómo se
   reporta: es menos plata.
2. **Por servicio, no por venta/cotización entera.** Cada línea tiene su propio interruptor — una venta
   puede tener unos servicios con IVA y otros sin, mezclados.
3. **Mismo permiso que crear la venta/cotización** — no hay un permiso nuevo ni restricción de rol; quien
   arma el borrador decide, caso por caso, igual que decide la TA o el costo de proveedor.
4. **Por defecto, con IVA** (el comportamiento de siempre) — una línea nueva nace con el interruptor
   encendido; apagarlo es una acción explícita.
5. **No toca la comisión ni la "Ganancia Oficina"**: ya se calculan solo sobre la TA (spec 005, nunca
   sobre TA+IVA), así que apagar el IVA de una línea no les afecta en nada.
6. **Una venta ya guardada no se edita** (spec 002, T8: eso sigue sin existir) — el interruptor solo
   importa mientras se arma el borrador en el asistente. Una cotización sí se edita después de guardada
   (`updateQuote` reemplaza sus líneas), así que ahí el interruptor sigue disponible tras guardarla.

## Qué se guarda

Una columna nueva por línea, en las dos tablas que ya tienen `ta`/`iva`/`costo_proveedor` explícitos:
`detalle_venta.incluye_iva` y `detalle_cotizacion.incluye_iva` (`BOOLEAN NOT NULL DEFAULT true`, aditiva).
`iva` sigue guardando el monto real (0 cuando el interruptor está apagado, igual que si la TA fuera 0);
`incluye_iva` guarda la intención, para que al editar una cotización el interruptor refleje lo que el
asesor eligió, sin tener que adivinarlo de si `iva` dio 0.

## Cómo se comprueba

- Un servicio con el interruptor apagado: su `iva` y su total (TA + costo + IVA) bajan exactamente el
  19% de su TA; el resto de líneas de la misma venta/cotización no cambian.
- La comisión del asesor y la "Ganancia Oficina" de una venta con líneas mixtas (con y sin IVA) dan el
  mismo resultado que si todas tuvieran IVA — siguen calculándose solo sobre la TA.
- El dashboard de IVA (`stats.service.js::getIva`) baja exactamente lo que bajó `ventas.iva_total` — sin
  tocar ese archivo, porque ya suma la cabecera, que ya refleja la mezcla.
- El voucher de una venta con líneas mixtas muestra en "RESUMEN DE PAGO" el monto real de IVA
  (`venta.iva_total`), no la palabra fija "Incluido" de antes.
- Una venta/cotización sin ninguna línea con el interruptor apagado se comporta exactamente igual que
  antes de esta spec (mismo total, mismo IVA) — nada cambia para el caso de siempre.
