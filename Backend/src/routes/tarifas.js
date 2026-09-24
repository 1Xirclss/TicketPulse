import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { validate } from '../utils/validation.js';
import { createTarifaSchema, updateTarifaSchema, renameCategorySchema, saveCategoryPricesSchema } from '../utils/ventasValidation.js';
import * as controller from '../controllers/TarifasController.js';

const router = Router();

// Todas las rutas requieren sesión autenticada
router.use(authenticate);

// Consulta disponible para Admin y Taquilla
router.get('/', authorize('Admin', 'Taquilla'), controller.list);

// Operaciones de gestión exclusivas para Administradores
router.post('/', authorize('Admin'), validate(createTarifaSchema), controller.create);
router.put('/categorias/precios', authorize('Admin'), validate(saveCategoryPricesSchema), controller.saveCategoryPrices);
router.put('/categorias/renombrar', authorize('Admin'), validate(renameCategorySchema), controller.renameCategory);
router.put('/:id', authorize('Admin'), validate(updateTarifaSchema), controller.update);
router.delete('/:id', authorize('Admin'), controller.toggleOrDelete);

export default router;
