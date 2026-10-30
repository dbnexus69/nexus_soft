# Spec 029 — Límite de usuarios por plan

**Estado:** completada (2026-10-24), migración aplicada y `test:limite-usuarios` en verde · **Rama:** `feat-dbmoon` · **Toca la base compartida:** sí (tres columnas
nuevas en `empresas`, aditivas) · **Relacionadas:** ninguna — primer trabajo de licenciamiento del sistema

## Por qué

El sistema se va a cobrar por licencia: cada agencia paga según cuántos usuarios tiene. Hoy no hay ningún tope —
cualquier agencia crea tantos usuarios como quiera — así que no hay forma de hacer cumplir lo que se cobra.

## Qué se quiere (confirmado con el usuario, brainstorming 2026-10-24)

1. **Precios de referencia** (cobrados por fuera del sistema, no automatizados aquí): Plan Base $300.000 (4
   usuarios incluidos); cada usuario adicional hasta el 6° cuesta $50.000; de 7 usuarios en adelante hay que
   pasar a Plan Deluxe, $800.000, **usuarios ilimitados**.
2. **El servidor frena el alta, no un candado manual.** La idea original del usuario (bloquear "Crear usuario"
   con una clave y que el equipo lo haga a mano por cada agencia) se descartó: no escala y el cliente deja de
   poder gestionar su propio personal. En su lugar, el admin de la agencia sigue creando usuarios él mismo; el
   servidor rechaza el alta automáticamente al llegar al tope de su plan.
3. **Sin facturación ni pagos dentro del sistema.** Cobrar, acordar el upgrade y decírselo al cliente sigue
   siendo un proceso humano, por fuera. El sistema solo necesita saber el límite vigente de cada agencia y
   aplicarlo.
4. **El admin cuenta como uno de los usuarios del plan.** 4 usuarios incluidos significa el admin + 3 más, no el
   admin aparte.
5. **El límite cuenta usuarios activos.** Dar de baja a un usuario libera su cupo; se puede crear otro en su
   lugar sin pagar de más. No hace falta que alguien del equipo "libere" nada a mano.
6. **El plan se guarda como texto/número libre, sin un catálogo fijo de planes.** El superadmin escribe el
   límite, el nombre del plan y el precio en la ficha de la agencia, los tres editables por separado (sirve
   también para un acuerdo especial con un cliente que no encaje en las cuatro combinaciones de arriba). El
   servidor solo usa el número del límite para decidir; el nombre y el precio son para que el panel los muestre,
   nunca para calcular nada.
7. **Agencias existentes: sin límite** hasta que el superadmin le asigne uno a mano — nadie queda bloqueado el
   día que esto se active.
8. **Agencias nuevas: plan base por defecto** (límite 4, "Plan Base", $300.000) desde que se crean.
9. **La agencia de DBNEXUS (donde vive el superadmin) no es una agencia cliente** y queda fuera de esto — no se
   le pone límite.

## Fuera de alcance

- Facturación, cobro o estado de pago dentro del sistema.
- Un catálogo de planes con su propia tabla — ver "Riesgos" por qué no, por ahora.
- Que el plan Deluxe tenga su propio tope (es ilimitado).
- Avisar en pantalla cuántos usuarios lleva la agencia contra su límite antes de llegar al tope (el usuario pidió
  empezar solo con el mensaje de error al chocar con el límite).
- Cambiar el límite de una agencia desde la propia agencia — solo el superadmin, desde `/companies`.

## Diseño

### Datos

- Tres columnas nuevas en `empresas`, todas opcionales:
  - `limite_usuarios` (entero, nula = sin límite/Deluxe) — la única que usa el servidor.
  - `nombre_plan` (texto, nula) — solo para mostrar en el panel.
  - `precio_plan` (entero, en pesos, nula) — solo para mostrar en el panel.
- Migración puramente aditiva. Ninguna fila existente cambia (decisión 7): las agencias de hoy quedan con los
  tres campos nulos.

### Servidor

- `services/users.service.js::createUser`: antes de crear, si `empresa.limite_usuarios` no es nulo, cuenta los
  usuarios de esa agencia con `status: 'active'` y `deleted_at: null`; si ya llegó al límite, 422 ("Llegaste al
  límite de usuarios de tu plan. Escribinos para subir de plan.") y no crea nada.
- `services/companies.service.js::create`: una agencia nueva nace con `limite_usuarios: 4`, `nombre_plan: 'Plan
  Base'`, `precio_plan: 300000` (decisión 8), salvo que el superadmin los pise explícitamente al crearla.
- `services/companies.service.js::update` (`PATCH /companies/:id`, ya existe): los tres campos se agregan al
  mapa de columnas editables, igual que `nombre`/`estado`/etc. — sin endpoint nuevo.

### Pantalla

- `pages/Companies.tsx` (superadmin, edición de una agencia): sección nueva "Plan" con tres campos — "Límite de
  usuarios" (número, vacío = sin límite), "Nombre del plan" (texto) y "Precio" (número) — igual de simples que el
  resto del formulario de edición, sin un selector de combinaciones fijas (decisión 6).
- Pantalla de usuarios de la agencia (`Users.tsx` o donde esté el botón "Crear usuario"): sin cambio de diseño;
  el 422 del servidor se pinta donde ya se pintan los demás errores de alta.

## Cómo se comprueba

- Prueba por la API (agencia desechable): crear usuarios hasta el límite (4) → el 5° da 422; subir el límite a 5
  desde `/companies` → el 5° ahora entra; dar de baja uno → vuelve a quedar 1 cupo libre; agencia con límite nulo
  → sin tope; una agencia nueva nace con límite 4.
- `check:prisma`, `tsc`.
- En pantalla: el superadmin edita el plan de una agencia; un admin de esa agencia choca con el 422 al llegar al
  tope y ve el mensaje.

## Riesgos

- **No hay un catálogo de planes.** Si en el futuro hace falta más que un número (por ejemplo, un plan que
  limite algo más que usuarios), esto habría que rehacerlo con una tabla propia. Se eligió así porque hoy no hay
  nada más que limitar y el cobro es externo — agregar una tabla sin que nada la use todavía sería trabajo sin
  beneficio actual (YAGNI). Si aparece un segundo límite, es la señal de pasar a un catálogo.
- **Texto libre en `nombre_plan`/`precio_plan`:** nada impide que quede desprolijo (dos agencias con el mismo
  plan escrito distinto). Aceptado por el usuario a cambio de no atarse a cuatro combinaciones fijas.
- **Agencias existentes sin límite indefinidamente** si nadie vuelve a revisarlas — es a propósito (decisión 7),
  pero depende de que el equipo las vaya pasando a un plan real.
