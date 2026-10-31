---
paths:
  - "frontend/**"
---

# Convenciones del frontend

- Stack: React 19, Vite, TypeScript y Tailwind. El paquete es independiente de `backend/`.
- La interfaz, comentarios y documentación van en español. Los mensajes de `console.error`/`console.warn` van en inglés.
- Usa `/api/v1` para las llamadas al backend.
- Los permisos que muestra y aplica la interfaz deben mantenerse sincronizados con el backend. El frontend no sustituye la autorización del servidor.
- Los tipos de permisos están en `frontend/src/types/index.tsx`. Si se añade una acción con alcance (`all`/`own`/`none`), revisa `SCOPED_ACTIONS` y la normalización; no conviertas silenciosamente `own` en `true`/`all`.
- Los totales se calculan en el servidor. No sumes en el navegador los elementos de una lista paginada para obtener el total real.
- Las respuestas de escritura pueden ser parciales por diseño. Para ediciones, combina la respuesta mínima con la fila actual (`{ ...row, ...reply }`) o recarga la lista cuando corresponda; no fuerces al backend a devolver campos sensibles o no solicitados.
- Para diseño, construcción o revisión de interfaces usa solo la skill principal `ui-ux-pro-max`, ya instalada en `.claude/skills/ui-ux-pro-max`, y consulta `python .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --domain ux`.
- Para comprobar tipos/build, ejecuta `pnpm build` desde `frontend/`, solo si está permitido. No levantes Vite ni abras el navegador sin permiso expreso.
- Consulta `frontend/CLAUDE.md` para las reglas de dominio y detalles específicos de la aplicación frontend.
