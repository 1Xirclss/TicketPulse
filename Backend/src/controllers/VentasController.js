import { createHash, randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import Venta from '../models/AsistentesVentas.js';
import Tarifa from '../models/Tarifas.js';
import { eventOperation, recoverEvent } from '../services/ventasAtomic.js';
import { getAccessibleEvent } from '../utils/eventAccess.js';
import { parseId } from '../utils/eventValidation.js';
import { httpError } from '../utils/security.js';
import { saleView, salesQuery } from '../utils/ventasQuery.js';
import { paymentStates, methods, categories, gateStates } from '../utils/ventasValidation.js';

export async function options(req, res) {
  let dynamicCategories = categories;
  try {
    const filter = req.query.evento ? { evento: parseId(req.query.evento) } : {};
    const found = await Tarifa.distinct('categoria', filter);
    dynamicCategories = Array.from(new Set([...categories, ...found])).filter(Boolean);
  } catch {
    // Si no viene evento válido, usa las categorías base
  }
  res.json({
    estadosPago: paymentStates.map(value => ({ value, label: value === 'CANCELADO' ? 'Pagado' : 'Pendiente' })),
    estadosFiltro: [...paymentStates.map(value => ({ value, label: value === 'CANCELADO' ? 'Pagado' : 'Pendiente' })), { value: 'anulada', label: 'Anuladas' }],
    metodos: methods,
    categorias: dynamicCategories,
    puerta: gateStates,
    limiteCantidad: 1000
  });
}
export async function create(req, res) {
  const data = req.input;
  await getAccessibleEvent(data.eventoId, req.user);
  const requestKey = req.get('Idempotency-Key') || randomUUID();
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey)) throw httpError(400, 'Idempotency-Key no válida.');
  const hash = createHash('sha256').update(JSON.stringify({ ...data, usuario: req.user.id })).digest('hex');
  let repeated = false;
  const result = await eventOperation(data.eventoId, async evento => {
    const existing = await Venta.findOne({ evento: evento._id, requestKey }).lean();
    if (existing) {
      if (existing.requestHash !== hash) throw httpError(409, 'La clave de solicitud ya se utilizó con otros datos.');
      repeated = true; return { result: existing };
    }
    if (!evento.activo) throw httpError(409, 'El evento está inactivo.');
    const tarifa = await Tarifa.findOne({ _id: data.tarifaId, evento: evento._id, activa: true }).lean();
    if (!tarifa) throw httpError(400, 'La tarifa no está activa o no pertenece al evento.');
    if (evento.entradasReservadas + data.cantidad > evento.aforoMaximo) throw httpError(409, 'Aforo agotado');
    const total = tarifa.precioCentavos * data.cantidad;
    if (!Number.isSafeInteger(total) || total < 0) throw httpError(400, 'El importe de la tarifa no es válido.');
    const id = new Types.ObjectId();
    const ticketCode = 'NX' + id.toHexString().toUpperCase();
    const venta = new Venta({
      _id: id, ticketId: ticketCode, ticketCode, numero: evento.ventasSecuencia + 1,
      evento: evento._id, tarifa: tarifa._id, tarifaNombre: tarifa.nombre, registradoPor: req.user._id,
      nombre: data.nombreAsistente, telefono: data.telefono, colegio: data.colegio, categoria: tarifa.categoria,
      cantidad: data.cantidad, precioUnitarioCentavos: tarifa.precioCentavos, totalCentavos: total, montoCentavos: total,
      metodo: data.metodoPago, estadoPago: data.estadoPago, referencia: data.comprobanteRef, requestKey, requestHash: hash,
      createdAt: new Date(), updatedAt: new Date(), __v: 0
    });
    await venta.validate();
    return { delta: data.cantidad, sequence: true, operation: { tipo: 'crear', venta: venta.toObject() }, resolve: () => Venta.findById(id).lean() };
  });
  res.status(repeated ? 200 : 201).json({ venta: saleView(result) });
}
export async function list(req, res) {
  const { data, match } = salesQuery(req.query);
  await getAccessibleEvent(data.evento, req.user); await recoverEvent(data.evento);
  const [result] = await Venta.aggregate([
    { $match: match },
    { $facet: { ventas: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (data.page - 1) * data.limit }, { $limit: data.limit }], total: [{ $count: 'value' }] } }
  ]);
  const total = result.total[0]?.value || 0;
  res.json({ ventas: result.ventas.map(saleView), page: data.page, limit: data.limit, total, pages: Math.ceil(total / data.limit) });
}
async function accessibleSale(req) {
  const venta = await Venta.findById(parseId(req.params.id)).lean();
  if (!venta) throw httpError(404, 'La venta no existe.');
  const evento = await getAccessibleEvent(venta.evento.toString(), req.user);
  return { venta, evento };
}
export async function get(req, res) {
  const current = await accessibleSale(req);
  await recoverEvent(current.evento._id);
  const venta = await Venta.findById(current.venta._id).lean();
  res.json({ venta: saleView(venta), evento: current.evento, qrPayload: 'NEXO:' + (venta.ticketCode || venta.ticketId) });
}
export async function update(req, res) {
  const current = await accessibleSale(req);
  const data = req.input;
  const venta = await eventOperation(current.evento._id, async evento => {
    if (req.user.rol !== 'Admin' && !evento.activo) throw httpError(404, 'El evento no está disponible.');
    const previous = await Venta.findById(current.venta._id).lean();
    if (previous.anulada) throw httpError(409, 'La venta está anulada.');
    if ((previous.__v || 0) !== data.version) throw httpError(409, 'La venta cambió. Recarga antes de guardar.');
    if (['CANCELADO', 'PAGADO'].includes(previous.estadoPago) && data.estadoPago === 'PENDIENTE') throw httpError(409, 'Una venta pagada no puede volver a pendiente.');
    const changes = { updatedAt: new Date() };
    if (data.nombreAsistente !== undefined) changes.nombre = data.nombreAsistente;
    if (data.telefono !== undefined) changes.telefono = data.telefono;
    if (data.colegio !== undefined) changes.colegio = data.colegio;
    if (data.estadoPago !== undefined) changes.estadoPago = data.estadoPago;
    if (data.comprobanteRef !== undefined) changes.referencia = data.comprobanteRef;
    await new Venta({ ...previous, ...changes }).validate();
    return { operation: { tipo: 'actualizar', ventaId: previous._id, version: previous.__v || 0, cambios: changes }, resolve: () => Venta.findById(previous._id).lean() };
  });
  res.json({ venta: saleView(venta) });
}
export async function cancel(req, res) {
  const current = await accessibleSale(req);
  const venta = await eventOperation(current.evento._id, async () => {
    const previous = await Venta.findById(current.venta._id).lean();
    if (previous.anulada) return { result: previous };
    if ((previous.__v || 0) !== req.input.version) throw httpError(409, 'La venta cambió. Recarga antes de anular.');
    if (previous.ingresos?.length) throw httpError(409, 'No se puede anular una venta con ingresos registrados.');
    return { delta: -previous.cantidad, operation: { tipo: 'actualizar', ventaId: previous._id, version: previous.__v || 0,
      cambios: { anulada: true, motivoAnulacion: req.input.motivo, anuladoPor: req.user._id, anuladoEn: new Date(), updatedAt: new Date() }
    }, resolve: () => Venta.findById(previous._id).lean() };
  });
  res.json({ venta: saleView(venta) });
}
