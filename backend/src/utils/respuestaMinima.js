// Respuestas mínimas (spec 034): una escritura devuelve lo que se pidió, no la ficha entera.
//
// Cada campo de más (documento, fecha de nacimiento, datos bancarios, `empresa_id`) es algo que
// puede quedar en la caché del navegador, en un log o en la pestaña de red de un equipo compartido.

/**
 * De la ficha ya guardada (con los valores normalizados por el servidor), el `id` y solo los
 * campos que la petición mandó. `mapa` dice, por cada campo que puede llegar, qué campos de la
 * ficha devuelve (p. ej. `firstName` → `firstName` y `name`). Lo que no está en el mapa —una
 * contraseña— no vuelve nunca.
 */
function soloLoPedido(ficha, cuerpo, mapa) {
  const salida = { id: ficha.id };
  for (const [pedido, campos] of Object.entries(mapa)) {
    if (cuerpo[pedido] !== undefined) for (const c of campos) salida[c] = ficha[c];
  }
  return salida;
}

module.exports = { soloLoPedido };
