import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(process.env.PORT ? Number(process.env.PORT) : 5000),
  MONGODB_URI: z.string().default(process.env.MONGODB_URI || 'mongodb://localhost:27017/gestion_eventos_db_codex'),
  FRONTEND_URL: z.string().default(process.env.FRONTEND_URL || 'http://localhost:5180'),
  JWT_SECRET: z.string().min(16).default(process.env.JWT_SECRET || 'ticketpulse_secure_jwt_session_secret_key_prod_2026'),
  ADMIN_ORGANIZATION_KEY: z.string().min(8).default(process.env.ADMIN_ORGANIZATION_KEY || 'admin_org_key_2026'),
  STAFF_ORGANIZATION_KEY: z.string().min(8).default(process.env.STAFF_ORGANIZATION_KEY || 'staff_org_key_2026'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('')
});

const parsed = schema.safeParse(process.env);

export const config = parsed.success ? parsed.data : {
  NODE_ENV: process.env.NODE_ENV || 'production',
  PORT: Number(process.env.PORT) || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/gestion_eventos_db_codex',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5180',
  JWT_SECRET: process.env.JWT_SECRET || 'ticketpulse_secure_jwt_session_secret_key_prod_2026',
  ADMIN_ORGANIZATION_KEY: process.env.ADMIN_ORGANIZATION_KEY || 'admin_org_key_2026',
  STAFF_ORGANIZATION_KEY: process.env.STAFF_ORGANIZATION_KEY || 'staff_org_key_2026',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || ''
};

if (config.NODE_ENV === 'production') {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ [AVISO RENDER]: La variable MONGODB_URI no está configurada en el panel de Render. Asegúrate de agregar la cadena de conexión de MongoDB Atlas en la pestaña Environment.');
  }
  if (!process.env.FRONTEND_URL) {
    console.warn('⚠️ [AVISO RENDER]: La variable FRONTEND_URL no está configurada. Recuerda colocar la URL de tu frontend de Vercel.');
  }
}
