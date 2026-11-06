# Spec 039 — Búsqueda de vuelos en vivo (SearchApi) y renombre a Itinerarios

**Estado: diseño, sin implementar.** · **Toca la base compartida:** sí (una migración chica) ·
**Relacionadas:** 004 (vuelos y check-in, el módulo que se renombra)

## Qué y por qué

El usuario quiere poder buscar precios de vuelos reales (Google Flights, vía la API de SearchApi)
desde la plataforma, para armar una cotización con un precio de verdad en vez de escribirlo a mano
o a ojo. Dos piezas, decididas por `/brainstorming` con el usuario:

1. **El módulo de hoy (check-in de tiquetes ya vendidos) se renombra a "Itinerarios".** Solo el
   nombre que se ve (menú, título de la pantalla): la URL sigue siendo `/flights` y el permiso
   sigue siendo `itineraries`, como ya estaba — nada de rutas ni de permisos cambia.
2. **"Vuelos" es un módulo nuevo:** una pantalla propia en el menú para buscar vuelos en vivo.

Los dos quedan separados a propósito: "Itinerarios" es sobre ventas ya cerradas; "Vuelos" es sobre
precios de mercado, antes de vender nada.

## Decisiones (de la conversación con el usuario)

1. **Caso de uso: cotizar rápido.** El resultado de una búsqueda sirve para armar una cotización,
   no es una pantalla de solo consulta.
2. **Proveedor: SearchApi (searchapi.io), no SerpApi** (cambio de proveedor decidido por el
   usuario a mitad del diseño). Mismo motor subyacente (Google Flights) y, por lo que confirma su
   documentación, prácticamente los mismos parámetros de búsqueda que SerpApi
   (`engine=google_flights`, `departure_id`, `arrival_id`, `outbound_date`, `return_date`,
   `booking_token`) — pero su propio endpoint y clave. **Sin confirmar:** la forma exacta de la
   respuesta (si trae `best_flights`/`other_flights` igual que SerpApi); se confirma con una
   llamada real al implementar (T0 en `tasks.md`), no se asume.
3. **La clave la paga DBNEXUS, una sola, global** (`SEARCHAPI_KEY` en el `.env` del backend, nunca
   al frontend) — mismo patrón que `RESEND_API_KEY`. Ninguna agencia trae ni paga la suya.
4. **Tope diario por agencia** para no disparar el costo: un número fijo de búsquedas por agencia
   por día (propuesta: 50; ajustable, es una constante). Al agotarse, 429 con un mensaje claro de
   que se acabaron por hoy.
5. **Caché corta por búsqueda exacta** (origen + destino + fecha(s)): 5–10 minutos. Si dos asesores
   de la misma agencia piden lo mismo en ese rato, no se paga dos veces ni cuenta dos veces contra
   el tope.
6. **Sin permiso de módulo nuevo.** No es un dato de negocio ni lo mutila: es una consulta de solo
   lectura a un servicio externo. El control real es el tope diario. La pantalla "Vuelos" se
   muestra a quien pueda crear cotizaciones (`quotes.create`) — ahí termina.
7. **Elegir un resultado abre una cotización NUEVA**, con la categoría tiquete ya llena (aerolínea,
   precio). Nunca una venta directamente (un precio de búsqueda no es un precio confirmado) ni se
   agrega a un borrador de cotización que ya estuviera a medias — eso exigiría enganchar con el
   estado del asistente desde otra pantalla, que no se pidió y es la opción más simple la que se
   aprobó.
8. **Moneda fija en COP.**
9. **Ida y vuelta, de dos pasos** (revisado el 2026-11-05 — el usuario pidió explícitamente poder
   elegir ida y vuelta; la versión anterior de esta decisión lo había dejado afuera). Confirmado
   con llamadas reales: sin `departureToken`, la búsqueda devuelve los vuelos de IDA, cada uno con
   su propio `departureToken` (en vez de `bookingToken`) y un precio de referencia, no el final;
   volviendo a buscar con ese `departureToken` (mismos demás parámetros), la respuesta pasa a ser
   las VUELTAS para esa ida concreta, ya con el precio real de la combinación completa y su
   `bookingToken`. La pantalla hace ese segundo paso sola: el asesor elige una ida ("Elegir esta
   ida"), ve las vueltas, elige una ("Usar") y ahí se arma la cotización con los dos tramos
   (`legs` + `returnLeg`, `flightMode: round_trip`). Solo ida sigue siendo la opción por defecto y
   la más simple (una sola llamada).
10. **La caché es global, no por agencia.** El precio de un vuelo no es un dato de negocio de
    ninguna agencia — es lo mismo para cualquiera que busque el mismo origen/destino/fecha. Cachear
    por esa clave (sin `empresa_id`) ahorra más que cachear solo dentro de cada agencia, y no hay
    nada que aislar: dos agencias buscando lo mismo deben ver el mismo precio. El tope diario, en
    cambio, sí es por agencia (decisión 4): son dos cosas distintas, una de costo compartido y otra
    de reparto justo del consumo.

## Qué se guarda

Solo lo necesario para el tope y la caché — **no** un historial de cada búsqueda con sus
resultados (no se pidió, y guardar resultados de un proveedor externo que cambian a cada rato no
aporta nada pasado el momento). Una tabla chica, por agencia y por día, con un contador; la caché
puede vivir en memoria del proceso (como `authCache.js`), no en la base.

## Cómo se comprueba

- `POST /flights-search` (o el nombre de ruta elegido en el plan) con origen/destino/fecha
  devuelve resultados limpios: aerolínea, duración, escalas, precio, `bookingToken`.
- Pasar el tope diario de una agencia da 429 con el mensaje; otra agencia en el mismo día no se ve
  afectada (aislamiento, RLS en la tabla del contador).
- La misma búsqueda repetida dentro de la ventana de caché no vuelve a llamar a SearchApi (se
  puede comprobar contando llamadas reales en una prueba, o por el tiempo de respuesta).
- En pantalla: la nueva sección "Vuelos" en el menú; buscar y elegir un resultado abre el
  asistente de cotización con el tiquete prellenado; el módulo de check-in dice "Itinerarios" en
  el menú y en su título, sin que cambie su URL ni su comportamiento.
