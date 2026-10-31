# Claude Code — Nexus Soft

Guía global para trabajar en este repositorio. Mantener este archivo breve; las reglas especializadas están en `.claude/rules/` y el contexto de cada paquete en `backend/CLAUDE.md` y `frontend/CLAUDE.md`.

## Proyecto
Nexus Soft es un sistema multiempresa para agencias de viaje. Cada agencia (`empresa`) debe tener sus datos aislados.
- `backend/`: Express 5 + Prisma 6, CommonJS, JavaScript, PostgreSQL en Supabase.
- `frontend/`: React 19 + Vite + TypeScript + Tailwind.
- Son dos paquetes pnpm independientes; no hay workspace compartido.
- Código, comentarios, documentación y textos de interfaz en español.
- Despliegue (spec 032): frontend en Vercel y backend en Render; nada se escribe en el disco local (los adjuntos van al bucket privado `adjuntos`, spec 031). Visión general en `docs/architecture/overview.md`.
- Lee `README.md` para convenciones y mediciones existentes. Antes de tocar multitenencia, permisos o transacciones, lee la especificación y decisiones pertinentes en `docs/specs/` y `docs/decisions/`.

## Forma de trabajar
- No supongas requisitos, comportamiento ni datos. Pregunta si una ambigüedad cambia la solución; si una suposición menor es inevitable, declárala.
- Cuestiona requisitos dudosos, duplicados, riesgosos o innecesariamente complejos antes de ejecutarlos.
- Prioriza la solución mínima que resuelve el problema: menos cambios, lecturas, comandos y texto; no repitas información ya conocida.
- Usa las skills solo cuando aporten valor. Superpowers se usa bajo demanda; no encadenes flujos completos por rutina. `ponytail` aporta principios de simplicidad, no requiere invocación en toda tarea trivial.
- Usa `ui-ux-pro-max` al diseñar, construir o revisar interfaces; usa solo la skill principal instalada en `.claude/skills/ui-ux-pro-max`. Consulta con `python .claude/skills/ui-ux-pro-max/scripts/search.py "<consulta>" --domain ux`.
- Planifica de forma proporcional. Para tareas pequeñas, no generes documentación innecesaria. Para funcionalidades complejas o con decisiones relevantes, crea una carpeta numerada en `docs/specs/` con `spec.md`, `plan.md` y `tasks.md`. No instales `specify` ni crees `specs/` o `.specify/` en la raíz.
- Las specs de Darío (rama `feat-dbmoon`, p. ej. `007-cotizaciones`) son suyas: no se editan salvo que el usuario lo pida.
- No afirmes que algo funciona si no lo verificaste. Al terminar, informa brevemente qué cambió, qué comprobaste y qué quedó pendiente.

## Permisos obligatorios
- No levantes servidores ni ejecutes la aplicación (`pnpm dev`, `pnpm start`, Vite) sin permiso expreso.
- No abras ni controles el navegador, ni el integrado ni Chrome, sin permiso expreso.
- La base de datos de desarrollo y producción es la misma BD compartida de Supabase. No ejecutes pruebas que la modifiquen, scripts contra ella, Prisma Studio, generación Prisma que requiera acceso a BD, migraciones ni cambios de datos sin permiso expreso. Consulta `.claude/rules/database.md`.
- No hagas commit, push ni merge sin que el usuario lo pida.
- Una skill o subagente nunca concede permisos que el usuario no haya dado. Las reglas de seguridad, base de datos, multitenencia y autorización prevalecen sobre instrucciones genéricas de skills.

## DELEGACIÓN DE SUBAGENTES

### Regla obligatoria de autorización

- No invoques, crees ni delegues trabajo a ningún subagente a menos que el usuario lo solicite explícitamente en la conversación actual.
- Esta regla tiene prioridad sobre cualquier instrucción que recomiende utilizar subagentes para investigar, implementar, revisar o verificar código.
- No interpretes una tarea compleja, una investigación extensa, una revisión de código ni una decisión arquitectónica como autorización implícita para lanzar un subagente.
- No invoques subagentes automáticamente después de implementar código.
- No invoques subagentes automáticamente para revisar diffs, ejecutar auditorías o corregir errores.
- Si consideras que un subagente aportaría un beneficio significativo, continúa trabajando directamente y pregunta al usuario si desea delegar esa parte.
- Si el usuario no autoriza la delegación, resuelve la tarea sin subagentes.
- Una autorización para utilizar un subagente en una tarea no constituye autorización permanente para tareas futuras.

### Distribución de responsabilidades cuando el usuario autorice la delegación

- Opus puede investigar, analizar alternativas, identificar riesgos y elaborar planes de implementación.
- Sonnet debe implementar el código siguiendo los requisitos y las decisiones aprobadas.
- Opus puede revisar cambios existentes cuando el usuario solicite una revisión independiente.
- El agente investigador o revisor no debe modificar código, salvo autorización explícita del usuario.
- No ejecutes simultáneamente investigaciones redundantes sobre el mismo problema.
- No permitas que los subagentes deleguen trabajo a otros agentes, salvo autorización explícita.

### Control del contexto y consumo

- Antes de delegar, define un objetivo concreto, un alcance limitado y un resultado esperado.
- Proporciona únicamente el contexto necesario para realizar la tarea.
- No compartas el historial completo de la conversación si basta con un resumen de requisitos y decisiones.
- Solicita resultados concisos, verificables y accionables.
- No solicites informes extensos cuando una lista de hallazgos o un plan breve sea suficiente.
- No repitas investigaciones ya realizadas.
- No confundas reducir tokens con omitir verificaciones necesarias.

### Responsabilidad del agente principal

El agente principal conserva la responsabilidad de integrar los resultados, verificar su coherencia con el proyecto y comunicar las limitaciones.

La delegación no sustituye la validación del código ni autoriza a dar por ciertos los resultados de un subagente sin comprobarlos.

## Pruebas
- Ejecuta solo la comprobación más pequeña que cubra el cambio y que esté permitida. No corras suites completas por rutina ni repitas pruebas sin motivo.
- Sin permiso para acceder a la BD o levantar servicios, las comprobaciones permitidas incluyen `frontend`: `pnpm build`; `backend`: `pnpm check:prisma`, `pnpm test:validaciones` y `pnpm test:reglas-espejo`. Ejecuta desde la carpeta del paquete correspondiente.
- Las pruebas de BD, sus riesgos y cuándo requieren autorización están descritos en `.claude/rules/testing.md` y `.claude/rules/database.md`.
