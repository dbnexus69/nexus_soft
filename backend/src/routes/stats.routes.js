const { Router } = require('express');
const router = Router();
const statsController = require('../controllers/stats.controller');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validateQuery } = require('../middleware/validate');
const { dateRangeSchema } = require('../schemas/common.schema');

router.use(auth);

// TODAS llevan `authorize`. Sin él no hay `req.permissionScope`, y el servicio
// devuelve datos globales: un asesor con `view: 'own'` veía el rendimiento de
// los demás asesores. `auth` solo comprueba que el token es válido.
router.get('/dashboard', authorize('dashboard', 'view'), validateQuery(dateRangeSchema), statsController.dashboard);

// Lo que requiere acción hoy. Sustantivo, en singular porque es un resumen
// —no una colección—, así que no se pagina.
router.get('/attention', authorize('dashboard', 'view'), statsController.attention);

router.get('/asesor-performance', authorize('dashboard', 'view'), statsController.asesorPerformance);
router.get('/top-clients', authorize('dashboard', 'view'), statsController.topClients);
router.get('/category-distribution', authorize('dashboard', 'view'), statsController.categoryDistribution);

// Se retiró GET /sales-history: el controlador era un placeholder que devolvía
// `{ message: 'stats salesHistory placeholder' }` y no tenía consumidores.

module.exports = router;
