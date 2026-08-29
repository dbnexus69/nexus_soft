# Design Doc: Refactorización de Modales y Paginación (Enfoque Tabs)

**Fecha:** 2026-08-27
**Módulo:** Ventas (Detalles de Venta) y Modales UI
**Autor:** Agente IA (Antigravity) & Usuario

## 1. Objetivo
Aliviar la sobrecarga de red y de base de datos que se genera al consultar listados grandes con relaciones profundamente anidadas (ej. Ventas con Tiquetes, Pasajeros, Hoteles). Mejorar la experiencia de usuario y el rendimiento del frontend refactorizando las modales masivas (como `ProductDetailsModal.tsx`) para que carguen su contenido bajo demanda.

## 2. Decisiones Arquitectónicas (Opción A Aprobada)

Se aprobó el **Enfoque Vertical (Full-Stack por Módulo)** combinado con el **Layout por Pestañas (Tabs)** para la interfaz.

### 2.1 Backend (Node.js + Prisma)
- **Consultas Ligeras (Listados):** Los endpoints de listado (ej. `getAll` en `sales.controller.js`) dejarán de hacer `include` masivos. Solo seleccionarán los campos base (`id`, `cliente`, `fecha`, `subtotal`, etc.).
- **Nuevos Endpoints Bajo Demanda:** Se creará un endpoint específico `GET /api/sales/:id/details` que acepte parámetros de consulta como `?tab=tiquetes&page=1`.
- **Paginación Integrada:** Las consultas anidadas pesadas usarán `skip` y `take` de Prisma, devolviendo siempre metadatos (`total`, `page`, `totalPages`) para alimentar la UI.

### 2.2 Frontend (React + Vite)
- **Componentización:** Se dividirá `ProductDetailsModal` en múltiples sub-componentes independientes:
  - `<SaleSummaryTab />`
  - `<SaleTicketsTab saleId={id} />`
  - `<SaleLandTravelsTab saleId={id} />`
- **Carga Diferida (Lazy Fetching):** Los componentes de cada pestaña serán los encargados de realizar el llamado a la API (`fetch` o librerías como `SWR`) **solo cuando se monten**. Si el usuario nunca hace clic en la pestaña "Hoteles", esa data nunca cruza la red.
- **Controles de Paginación:** Dentro de las pestañas con múltiples registros (ej. un grupo de 50 tiquetes), se implementarán botones simples de "Siguiente/Anterior" basados en los metadatos devueltos por el backend.

## 3. Plan de Implementación (Próximos Pasos)
1. Modificar el controlador de ventas en el backend para recortar el peso del `getAll`.
2. Crear el endpoint paginado para los detalles en el backend.
3. Crear los subcomponentes UI para cada pestaña en el frontend.
4. Refactorizar `ProductDetailsModal.tsx` para usar las nuevas pestañas y conectar la lógica de carga bajo demanda.
