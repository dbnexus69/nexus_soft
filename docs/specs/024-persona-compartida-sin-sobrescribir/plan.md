# Plan — Spec 024

1. `backend/src/services/personaCompartida.js::reutilizarPersona(db, documento, datos)` → `{ persona, aviso }`:
   documento nuevo → `persona` null; persona dada de baja → revive con los datos; en uso → rellena huecos y aviso.
   Recibe `prisma` o el `tx` de una `transaccion`.
2. Los cuatro altas lo usan en lugar de su `personas.update`: `clients.service.js::createClient`,
   `users.service.js::createUser`, `commissions.service.js::createAgent`, `responsables.service.js::createResponsable`
   (este último: comprueba primero si ya hay un responsable vivo con ese documento y revive el dado de baja).
   Cada uno devuelve `aviso`; el alta del cliente devuelve los datos guardados, no los del formulario.
3. Los cuatro controladores sacan `aviso` de los datos y lo mandan en `meta.aviso`.
4. Frontend: el interceptor de `api/client.ts` emite `nexus:aviso` con cualquier `meta.aviso`; `ToastProvider` lo
   muestra como aviso informativo. Sin tocar las pantallas. De paso, "responsablee" → "responsable".
5. Prueba: tres casos en `tests/aislamiento-api.js`.
