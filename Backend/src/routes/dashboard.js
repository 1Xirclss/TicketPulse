import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import { stats } from '../controllers/DashboardController.js';
const router = Router();
router.use(authenticate, authorize('Admin', 'Taquilla'));
router.get('/stats', stats);
export default router;
