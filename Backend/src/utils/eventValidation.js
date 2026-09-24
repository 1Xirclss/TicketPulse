import { z } from 'zod';
import { httpError } from './security.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador no válido.');
const text = max => z.string().trim().min(1, 'Este campo es obligatorio.').max(max);
const optionalText = max => z.string().trim().max(max).default('');
const timezone = text(80).refine(value => {
  try { new Intl.DateTimeFormat('es', { timeZone: value }); return true; } catch { return false; }
}, 'Zona horaria no válida.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha YYYY-MM-DD.').refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'La fecha no existe.');
export const eventSchema = z.object({
  nombre: text(120), fecha: date, horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horario no válido.'),
  zonaHoraria: timezone, venue: text(120), direccion: text(250),
  aforoMaximo: z.number().int().min(1).max(1000000), activo: z.boolean(),
  marca: z.object({ nombre: optionalText(80), logoUrl: z.union([z.literal(''), z.url().refine(url => url.startsWith('https://'), 'El logo debe usar HTTPS.')]).default('') }).strict()
}).strict();
export const eventUpdateSchema = eventSchema.extend({ version: z.number().int().min(0) });
export function parseId(value) {
  const str = value && typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : value;
  const parsed = objectId.safeParse(str);
  if (!parsed.success) throw httpError(400, 'Identificador de evento o tarifa no válido.');
  return parsed.data;
}
