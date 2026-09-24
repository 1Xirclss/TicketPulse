import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import * as controller from '../controllers/PuertaController.js';

const router = Router();

// Todas las rutas de puerta requieren inicio de sesión con roles operativos
router.use(authenticate, authorize('Admin', 'Portero', 'Taquilla'));

router.post('/validar', controller.validar);
router.get('/resumen', controller.resumen);
router.get('/buscar', controller.buscar);
router.put('/marcar-pulsera/:id', controller.marcarPulsera);

export default router;
