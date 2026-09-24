import { Types } from 'mongoose';
import { listSchema } from './ventasValidation.js';
import { httpError } from './security.js';
export function salesQuery(query) {
  const result = listSchema.safeParse(query);
  if (!result.success) throw httpError(400, 'Filtros o paginaci?n no válidos.');
  const data = result.data;
  const match = { evento: new Types.ObjectId(data.evento) };
  if (data.estado === 'anulada') match.anulada = true;
  else {
    match.anulada = false;
    if (data.estado === 'CANCELADO') match.estadoPago = { $in: ['CANCELADO', 'PAGADO'] };
    else if (data.estado) match.estadoPago = data.estado;
  }
  if (data.metodo) match.metodo = data.metodo;
  if (data.categoria) match.categoria = data.categoria;
  if (data.q) {
    const escaped = data.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = ['nombre', 'telefono', 'colegio', 'ticketCode', 'ticketId'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } }));
  }
  if (data.puerta) match.$expr = data.puerta === 'Ingresado'
    ? { $gte: [{ $size: { $ifNull: ['$ingresos', []] } }, '$cantidad'] }
    : { $lt: [{ $size: { $ifNull: ['$ingresos', []] } }, '$cantidad'] };
  return { data, match };
}
export function saleView(venta) {
  const entered = venta.ingresos?.length || 0;
  return {
    id: venta._id.toString(), eventoId: venta.evento.toString(), tarifaId: venta.tarifa.toString(),
    ticketCode: venta.ticketCode || venta.ticketId, numero: venta.numero ?? null,
    nombreAsistente: venta.nombre, telefono: venta.telefono || '', colegio: venta.colegio || '',
    categoria: venta.categoria, tarifaNombre: venta.tarifaNombre || '', cantidad: venta.cantidad,
    precioCentavos: venta.precioUnitarioCentavos, montoCentavos: venta.montoCentavos ?? venta.totalCentavos,
    metodoPago: venta.metodo, estadoPago: venta.estadoPago === 'PAGADO' ? 'CANCELADO' : venta.estadoPago,
    comprobanteRef: venta.referencia || '', anulada: venta.anulada, motivoAnulacion: venta.motivoAnulacion || '',
    ingresados: entered, puerta: entered >= venta.cantidad ? 'Ingresado' : 'Pendiente',
    version: venta.__v || 0, createdAt: venta.createdAt, updatedAt: venta.updatedAt
  };
}
