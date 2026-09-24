import { z } from 'zod';

export const correo = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const password = z.string().min(12, 'Usa al menos 12 caracteres.').max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'La contraseña supera 72 bytes.');
export const loginSchema = z.object({ correo, password: z.string().min(1).max(200), recordar: z.boolean().default(false) });
export const registerSchema = z.object({ nombre: z.string().trim().min(2).max(100), correo, password, confirmarPassword: z.string(), rol: z.enum(['Admin', 'Taquilla', 'Portero']), claveOrganizacion: z.string().min(1).max(200) }).refine(data => data.password === data.confirmarPassword, { path: ['confirmarPassword'], message: 'Las contraseñas no coinciden.' });
export const forgotSchema = z.object({ correo });
export const resetSchema = z.object({ correo, otp: z.string().regex(/^\d{6}$/), password, confirmarPassword: z.string() }).refine(data => data.password === data.confirmarPassword, { path: ['confirmarPassword'], message: 'Las contraseñas no coinciden.' });
export const registerVerifySchema = z.object({
  correo,
  otp: z.string().trim().regex(/^\d{6}$/, 'El código debe tener 6 dígitos.')
});
export const validate = schema => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ message: result.error.issues[0].message });
  req.input = result.data;
  next();
};
