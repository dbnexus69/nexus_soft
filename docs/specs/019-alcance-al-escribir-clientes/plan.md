# Plan — Spec 019

| Paso | Dónde | Qué |
|---|---|---|
| 1 | `backend/src/services/clients.service.js` | `soloLosSuyos` y `comprobarQueEsSuyo` (404 leer / 403 escribir) en `getClientById`, `updateClient`, `toggleClientStatus`, `uploadAvatar` |
| 2 | `backend/src/controllers/clients.controller.js` | Pasar el alcance (`permissionScope`, `viewScope`, `user`) |
| 3 | `backend/tests/aislamiento-api.js` | Los casos de la spec |
