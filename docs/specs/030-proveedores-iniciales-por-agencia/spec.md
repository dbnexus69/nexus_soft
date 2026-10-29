# Spec 030 — Proveedores iniciales por agencia

**Estado: implementada.**

## Qué y por qué

El usuario pidió "alimentar" el módulo de Proveedores con las aerolíneas y cadenas
hoteleras principales (de Colombia y las internacionales con presencia en el país),
para que una agencia no tenga que escribirlas a mano una por una.

## Decisión de diseño: por agencia, no global

Se consideró (y se descartó) hacer `proveedores` una tabla global como `aerolineas`/
`aeropuertos`. Razones para descartarla:

1. **El contacto no es un hecho objetivo.** `email_contacto`, `telefono` y
   `observaciones` son la relación comercial de ESA agencia con el proveedor (su
   ejecutivo de cuenta, sus condiciones) — no algo igual para todas, a diferencia del
   código IATA de un aeropuerto. Una tabla global significaría que la Agencia A edita
   el contacto y se lo cambia a la Agencia B.
2. **Cada agencia agrega proveedores propios** (un operador local, un transportista)
   que no son de las "principales". Una tabla global los mostraría a todas las
   agencias, filtrando a quién le compra cada una.

En su lugar: cada agencia recibe su PROPIA copia de la lista (mismos nombres,
filas distintas), editable o borrable sin afectar a ninguna otra — el mismo patrón
que ya usan los métodos de pago (`METODOS_DE_PAGO_INICIALES`).

## Qué se siembra

21 aerolíneas (las mismas del catálogo global de spec de aeropuertos/aerolíneas) y
14 cadenas hoteleras (colombianas: Decameron, GHL, Dann Carlton, Estelar, OxoHotel,
Faranda, Movich; internacionales con presencia en Colombia: Marriott, Hilton, Hyatt,
Meliá, Accor, Wyndham, Radisson), con `tipo` tomado de los valores fijos que ya
acepta el formulario de Proveedores (`Aerolinea`, `Hotel`).

## Cómo se comprueba

- `POST /companies` (alta de una agencia) crea también sus proveedores iniciales,
  en la misma transacción que crea sus métodos de pago.
- Una agencia que ya existe los recibe al correr `pnpm db:seed:proveedores`
  (idempotente: si ya tiene un proveedor con ese nombre, no lo repite).
- `check:prisma` en verde.
