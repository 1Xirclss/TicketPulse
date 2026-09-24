import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  FRONTEND_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  ADMIN_ORGANIZATION_KEY: z.string().min(24),
  STAFF_ORGANIZATION_KEY: z.string().min(24),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(), SMTP_PASS: z.string().optional(), SMTP_FROM: z.string().optional()
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Configuración incompleta: ${parsed.error.issues.map(i => i.path.join('.')).join(', ')}`);
export const config = parsed.data;
if (config.NODE_ENV === 'production') {
  if (!config.FRONTEND_URL.startsWith('https://') && !config.FRONTEND_URL.includes('localhost')) {
    console.warn('⚠️ Producción: Se recomienda que FRONTEND_URL use HTTPS.');
  }
  if (!config.SMTP_HOST || !config.SMTP_FROM) {
    console.warn('⚠️ Producción: SMTP no configurado aún. Los correos de verificación se registrarán en logs hasta que configures SMTP en Render.');
  }
}
