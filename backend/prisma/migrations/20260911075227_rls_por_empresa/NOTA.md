# Corrección a un comentario de esta migración

El comentario de `migration.sql` dice que `FORCE ROW LEVEL SECURITY` evita que
alguien desactive el aislamiento desplegando con el usuario `postgres`. **Es
inexacto**, y se comprobó después de aplicarla:

```
como postgres, sin contexto -> { "u": "postgres", "ventas": 11 }
```

`postgres` tiene `rolbypassrls = true`, y `BYPASSRLS` manda sobre `FORCE`: salta
las políticas igual. Lo que `FORCE` sí aporta es que un dueño de tabla **sin**
`BYPASSRLS` tampoco las saltaría; con el rol actual, es prevención para más
adelante, no la barrera de hoy.

**La protección real contra ese error es de despliegue, no de base de datos:**
`DATABASE_URL` tiene que apuntar a `app_nexus`. Está anotado en `tasks.md` (T2) y
merece una comprobación al arrancar, que queda pendiente.

El archivo `migration.sql` no se edita a propósito: Prisma guarda su suma de
verificación y cambiarlo haría que `migrate status` la diera por modificada.
