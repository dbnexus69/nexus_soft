const { Router } = require('express');
const path = require('path');
const router = Router();
const { Prisma } = require('@prisma/client');
const auth = require('../middleware/auth');
const { getEffectivePermissions, getActionScope } = require('../middleware/authorize');
const prisma = require('../config/db');
const { error } = require('../utils/apiResponse');

/**
 * Los ficheros subidos, ahora con dueño.
 *
 * Antes esto era `express.static('/uploads')` a secas: los vouchers y los
 * documentos de check-in de cualquier venta los leía cualquiera que tuviera el
 * enlace, sin sesión. Los nombres no se pueden adivinar —llevan un aleatorio de
 * mil millones—, pero el enlace no caduca y viaja por correo. Con dos agencias
 * en el sistema, eso es el documento de otra.
 *
 * **Cómo se comprueba de quién es un fichero sin guardar quién lo subió:** se
 * pregunta a la base si alguna fila que YO pueda ver lo referencia. La política
 * de la empresa ya filtra esas filas, así que si la consulta no encuentra nada,
 * o el fichero no existe o es de otra agencia — y las dos respuestas son la
 * misma, que es lo correcto.
 *
 * Dentro de la agencia manda además el alcance del rol (spec 022): el voucher
 * sigue a ver ventas y el documento de check-in a ver vuelos (`itineraries`).
 * Con 'own', solo los de ventas propias; quien no puede ver la venta por su id
 * tampoco abre sus ficheros. No se usa `authorize`: un fichero puede ser de
 * cualquiera de los dos módulos.
 *
 * Los logos NO pasan por aquí: están en el bucket privado `logos` de Supabase
 * Storage y se entregan con URL firmada (`perfilEmpresa.service.js`, spec 011).
 */
const CARPETA = path.join(__dirname, '../../uploads');

router.get('/:fichero', auth, async (req, res, next) => {
  try {
    const fichero = path.basename(req.params.fichero);
    const ruta = `/uploads/${fichero}`;

    const { permissions } = getEffectivePermissions(req.user);
    const alcance = (modulo) => {
      const ver = getActionScope(permissions, modulo, 'view');
      if (ver === 'all') return Prisma.sql`TRUE`;
      if (ver === 'own') return Prisma.sql`v.usuario_id = ${req.user.id}`;
      return Prisma.sql`FALSE`;
    };
    const patron = '%' + fichero.replace(/[\\%_]/g, '\\$&') + '%';

    const [visible] = await prisma.$queryRaw`
      SELECT 1 AS x FROM detalle_venta d JOIN ventas v ON v.id = d.venta_id
      WHERE d.voucher_url = ${ruta} AND ${alcance('sales')}
      UNION ALL
      SELECT 1 FROM tramos_vuelo t
        JOIN prod_tiqueteria p ON p.id = t.prod_tiqueteria_id
        JOIN detalle_venta d ON d.id = p.detalle_venta_id
        JOIN ventas v ON v.id = d.venta_id
      WHERE t.checkin_docs::text LIKE ${patron} AND ${alcance('itineraries')}
      LIMIT 1`;

    if (!visible) return error(res, 'Archivo no encontrado', 404, 'NOT_FOUND');

    res.sendFile(path.join(CARPETA, fichero), (err) => {
      if (err) next(err);
    });
  } catch (err) { next(err); }
});

module.exports = router;
