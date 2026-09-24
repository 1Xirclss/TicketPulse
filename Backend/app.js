import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import authRoutes from './src/routes/auth.js';
import configuracionRoutes from './src/routes/configuracion.js';
import tarifasRoutes from './src/routes/tarifas.js';
import dashboardRoutes from './src/routes/dashboard.js';
import ventasRoutes from './src/routes/ventas.js';
import puertaRoutes from './src/routes/puerta.js';
import { config } from './config.js';

const app = express();
app.disable('x-powered-by');
if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet());
const allowedOrigin = config.FRONTEND_URL.replace(/\/$/, '');
app.use(cors({ 
  origin: (origin, callback) => {
    if (!origin || origin.replace(/\/$/, '') === allowedOrigin) return callback(null, true);
    callback(null, false);
  }, 
  credentials: true 
}));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const origin = req.get('origin');
  if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin.replace(/\/$/, '') !== allowedOrigin) {
    return res.status(403).json({ message: 'Origen de solicitud no permitido.' });
  }
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60_000, limit: config.NODE_ENV === 'test' ? 5000 : 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Demasiadas solicitudes. Espera un minuto.' } }));
app.get('/api/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'unavailable' }));
app.use('/api/auth', authRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/tarifas', tarifasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/puerta', puertaRoutes);
app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.code === 11000 ? 409 : error.name === 'ValidationError' ? 400 : error.status || 500;
  const message = error.code === 11000 ? 'Ya existe un registro con esos datos únicos.' : status >= 500 ? 'El servicio no está disponible. Intenta de nuevo más tarde.' : error.message;
  if (status >= 500) console.error('Fallo de API:', error.name);
  res.status(status).json({ message });
});
export default app;
