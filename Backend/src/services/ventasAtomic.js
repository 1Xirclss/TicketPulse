import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Types } from 'mongoose';
import Evento from '../models/ConfiguracionEvento.js';
import Venta from '../models/AsistentesVentas.js';
import { httpError } from '../utils/security.js';

/** Materializa el comando persistido antes de liberar el turno del evento. */
export async function recoverEvent(eventId) {
  const id = new Types.ObjectId(eventId);
  const evento = await Evento.collection.findOne({ _id: id });
  const op = evento?.operacionVenta;
  if (!op) return;
  if (op.tipo === 'inicializar') {
    const [totals] = await Venta.aggregate([
      { $match: { evento: id } },
      { $group: { _id: null, reservadas: { $sum: { $cond: ['$anulada', 0, '$cantidad'] } }, numero: { $max: '$numero' }, registros: { $sum: 1 } } }
    ]);
    await Evento.collection.updateOne({ _id: id, 'operacionVenta.id': op.id }, {
      $set: { entradasReservadas: totals?.reservadas || 0, ventasSecuencia: Math.max(totals?.numero || 0, totals?.registros || 0), ventasRevision: 0 },
      $unset: { operacionVenta: '' }
    });
    return;
  }
  if (op.tipo === 'crear') {
    // $setOnInsert impide que una recuperación tardía revierta una edición o anulación.
    await Venta.collection.updateOne({ _id: op.venta._id }, { $setOnInsert: op.venta }, { upsert: true });
  } else if (op.tipo === 'actualizar') {
    await Venta.collection.updateOne({ _id: op.ventaId, evento: id, __v: op.version }, { $set: op.cambios, $inc: { __v: 1 } });
    const venta = await Venta.collection.findOne({ _id: op.ventaId }, { projection: { __v: 1 } });
    if (!venta || (venta.__v || 0) <= op.version) throw httpError(503, 'La operación de venta sigue pendiente de recuperación.');
  } else throw httpError(503, 'Operación del evento no reconocida.');
  await Evento.collection.updateOne({ _id: id, 'operacionVenta.id': op.id }, { $unset: { operacionVenta: '' } });
}

async function initializedEvent(eventId) {
  const id = new Types.ObjectId(eventId);
  for (let attempt = 0; attempt < 100; attempt++) {
    const evento = await Evento.collection.findOne({ _id: id });
    if (!evento) throw httpError(404, 'El evento no existe.');
    if (evento.operacionVenta) { await recoverEvent(id); continue; }
    if (Number.isSafeInteger(evento.entradasReservadas)) return evento;
    await Evento.collection.updateOne({ _id: id, operacionVenta: { $exists: false }, entradasReservadas: { $exists: false } }, {
      $set: { operacionVenta: { id: randomUUID(), tipo: 'inicializar', fecha: new Date() } }
    });
    await recoverEvent(id);
  }
  throw httpError(503, 'El evento está ocupado. Reintenta la operación.');
}

/**
 * Reserva aforo y persiste el comando en una sola escritura condicional.
 * Funciona en MongoDB standalone; ningún bloqueo depende del proceso HTTP.
 */
export async function eventOperation(eventId, prepare) {
  const id = new Types.ObjectId(eventId);
  for (let attempt = 0; attempt < 120; attempt++) {
    const evento = await initializedEvent(id);
    const plan = await prepare(evento);
    if (plan.result !== undefined) return plan.result;
    const delta = plan.delta || 0;
    const filter = {
      _id: id, ventasRevision: evento.ventasRevision, operacionVenta: { $exists: false },
      __v: evento.__v ?? 0,
      $expr: { $and: [
        ...(delta > 0 || plan.config ? [{ $lte: [{ $add: ['$entradasReservadas', delta] }, plan.config?.aforoMaximo ?? '$aforoMaximo'] }] : []),
        { $gte: [{ $add: ['$entradasReservadas', delta] }, 0] }
      ] }
    };
    const update = {
      $inc: { ventasRevision: 1, entradasReservadas: delta, ...(plan.sequence ? { ventasSecuencia: 1 } : {}), ...(plan.config ? { __v: 1 } : {}) },
      $set: { ...(plan.config || {}), ...(plan.operation ? { operacionVenta: { ...plan.operation, id: randomUUID(), fecha: new Date() } } : {}), updatedAt: new Date() }
    };
    const changed = await Evento.collection.findOneAndUpdate(filter, update, { returnDocument: 'after' });
    if (!changed) { await delay(5 + Math.floor(Math.random() * 15)); continue; }
    if (plan.operation) await recoverEvent(id);
    return plan.resolve ? await plan.resolve() : changed;
  }
  throw httpError(503, 'El evento recibe muchas operaciones. Reintenta con la misma clave de solicitud.');
}

export async function recoverPendingEvents() {
  const cursor = Evento.collection.find({ operacionVenta: { $exists: true } }, { projection: { _id: 1 } });
  for await (const evento of cursor) {
    try { await recoverEvent(evento._id); }
    catch (error) { console.error('Recuperación de ventas pendiente:', evento._id.toString(), error.name); }
  }
}
