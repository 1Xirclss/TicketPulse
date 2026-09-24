import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, register, logout, forgot, reset, registerRequest, verifyRegistration } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validate, loginSchema, registerSchema, registerVerifySchema, forgotSchema, resetSchema } from '../utils/validation.js';
import { publicUser } from '../utils/security.js';

const router = Router();
const attempts = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Demasiados intentos. Vuelve a intentarlo en 15 minutos.' } });
const recovery = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Demasiadas solicitudes de recuperación. Espera 15 minutos.' } });
router.post('/register', attempts, validate(registerSchema), register);
router.post('/register-request', attempts, validate(registerSchema), registerRequest);
router.post('/register-verify', attempts, validate(registerVerifySchema), verifyRegistration);
router.post('/login', attempts, validate(loginSchema), login);
router.post('/forgot-password', recovery, validate(forgotSchema), forgot);
router.post('/reset-password', attempts, validate(resetSchema), reset);
router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
router.post('/logout', authenticate, logout);
export default router;
