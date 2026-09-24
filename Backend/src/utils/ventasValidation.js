import { z } from 'zod';
import { objectId } from './eventValidation.js';
export const paymentStates = ['CANCELADO', 'PENDIENTE'];
export const methods = ['Efectivo', 'Transferencia'];
export const categories = ['Promo', 'General'];
export const gateStates = ['Ingresado', 'Pendiente'];
const name = z.string().trim().min(2).max(120);
const phone = z.string().trim().max(30).regex(/^[+\d\s()\-]*$/, 'Teléfono no válido.').default('');
const school = z.string().trim().max(150).default('');
const reference = z.string().trim().max(120).default('');
export const saleSchema = z.object({
  eventoId: objectId, tarifaId: objectId, nombreAsistente: name, telefono: phone, colegio: school,
  cantidad: z.number().int().min(1).max(1000), metodoPago: z.enum(methods), estadoPago: z.enum(paymentStates), comprobanteRef: reference
}).strict().refine(data => data.metodoPago !== 'Transferencia' || data.estadoPago !== 'CANCELADO' || !!data.comprobanteRef, { message: 'La transferencia pagada requiere referencia.', path: ['comprobanteRef'] });
export const editSaleSchema = z.object({
  version: z.number().int().min(0), nombreAsistente: name.optional(), telefono: phone.optional(), colegio: school.optional(),
  estadoPago: z.enum(paymentStates).optional(), comprobanteRef: reference.optional()
}).strict();
export const cancelSaleSchema = z.object({ version: z.number().int().min(0), motivo: z.string().trim().min(3).max(250) }).strict();
export const listSchema = z.object({
  evento: objectId, q: z.string().trim().max(100).default(''),
  estado: z.enum(['CANCELADO', 'PENDIENTE', 'anulada']).optional(),
  metodo: z.enum(methods).optional(), categoria: z.string().trim().max(50).optional(), puerta: z.enum(gateStates).optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

export const createTarifaSchema = z.object({
  eventoId: objectId,
  nombre: z.string().trim().min(1, 'El nombre de la tarifa es obligatorio.').max(100),
  categoria: z.string().trim().min(1, 'La categoría es obligatoria.').max(50),
  etapa: z.enum(['Preventa', 'Puerta']),
  precioCentavos: z.number().int().min(0, 'El precio no puede ser negativo.'),
  activa: z.boolean().default(true)
}).strict();

export const updateTarifaSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  categoria: z.string().trim().min(1).max(50).optional(),
  etapa: z.enum(['Preventa', 'Puerta']).optional(),
  precioCentavos: z.number().int().min(0).optional(),
  activa: z.boolean().optional()
}).strict();

export const renameCategorySchema = z.object({
  eventoId: objectId,
  categoriaAnterior: z.string().trim().min(1).max(50),
  categoriaNueva: z.string().trim().min(1).max(50)
}).strict();

