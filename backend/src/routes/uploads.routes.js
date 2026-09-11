const { Router } = require('express');
const path = require('path');
const router = Router();
const auth = require('../middleware/auth');
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
 * Los logos NO pasan por aquí: van en `/uploads/logos`, se sirven sin sesión, y
 * el motivo está en `middleware/uploadLogo.js`.
 */
const CARPETA = path.join(__dirname, '../../uploads');

router.get('/:fichero', auth, async (req, res, next) => {
  try {
    const fichero = path.basename(req.params.fichero);
    const ruta = `/uploads/${fichero}`;

    const [visible] = await prisma.$queryRaw`
      SELECT 1 AS x FROM detalle_venta WHERE voucher_url = ${ruta}
      UNION ALL
      SELECT 1 FROM tramos_vuelo WHERE checkin_docs::text LIKE ${'%' + fichero + '%'}
      LIMIT 1`;

    if (!visible) return error(res, 'Archivo no encontrado', 404, 'NOT_FOUND');

    res.sendFile(path.join(CARPETA, fichero), (err) => {
      if (err) next(err);
    });
  } catch (err) { next(err); }
});

module.exports = router;
