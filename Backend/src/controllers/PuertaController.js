import mongoose, { Types } from 'mongoose';
import Venta from '../models/AsistentesVentas.js';
import Evento from '../models/ConfiguracionEvento.js';
import { parseId } from '../utils/eventValidation.js';
import { httpError } from '../utils/security.js';

/** Limpia y extrae el código alfanumérico del ticket a partir de URLs o payloads de QR. */
function sanitizeTicketCode(input) {
  if (!input || typeof input !== 'string') return '';
  let code = input.trim();
  if (code.startsWith('NEXO:')) code = code.slice(5).trim();
  try {
    if (code.startsWith('http://') || code.startsWith('https://')) {
      const url = new URL(code);
      const queryCode = url.searchParams.get('code') || url.searchParams.get('ticket');
      if (queryCode) code = queryCode.trim();
    }
  } catch {
    // Si no es URL válida, conserva el código limpio
  }
  return code.toUpperCase();
}

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Valida un boleto y registra el ingreso de forma atómica e idempotente.
 */
export async function validar(req, res) {
  const { ticketCode, eventoId } = req.body || {};
  if (!ticketCode || typeof ticketCode !== 'string') throw httpError(400, 'Ingresa el código del boleto.');
  const eventId = parseId(eventoId, 'evento');
  const cleanCode = sanitizeTicketCode(ticketCode);
  if (!cleanCode) throw httpError(400, 'Formato de código no válido.');

  const evento = await Evento.findById(eventId).lean();
  if (!evento) throw httpError(404, 'El evento no existe.');
  if (!evento.activo) throw httpError(400, 'El evento está inactivo. No se admiten ingresos.');

  const now = new Date();

  // Operación atómica condicional: sólo ingresa si ingresos < cantidad, pagado y no anulado
  const updated = await Venta.collection.findOneAndUpdate(
    {
      ticketCode: cleanCode,
      evento: new Types.ObjectId(eventId),
      anulada: false,
      estadoPago: { $in: ['CANCELADO', 'PAGADO'] },
      $expr: { $lt: [{ $size: '$ingresos' }, '$cantidad'] }
    },
    {
      $push: { ingresos: { fecha: now, portero: req.user._id } },
      $set: { pulseraEntregada: true, ingresadoAt: now },
      $inc: { pulserasEntregadas: 1 }
    },
    { returnDocument: 'after' }
  );

  if (updated) {
    if (updated.ingresos && updated.ingresos.length >= updated.cantidad) {
      await Venta.collection.updateOne({ _id: updated._id }, { $set: { ingresado: true } });
      updated.ingresado = true;
    }

    return res.status(200).json({
      status: 'PERMITIDO',
      mensaje: 'Acceso permitido.',
      asistente: {
        id: updated._id,
        nombre: updated.nombre,
        telefono: updated.telefono || '',
        colegio: updated.colegio || '',
        categoria: updated.categoria,
        tarifaNombre: updated.tarifaNombre || updated.categoria,
        ticketCode: updated.ticketCode,
        cantidad: updated.cantidad,
        ingresados: updated.ingresos.length,
        restantes: Math.max(0, updated.cantidad - updated.ingresos.length),
        ingresado: updated.ingresos.length >= updated.cantidad,
        pulseraEntregada: updated.pulseraEntregada,
        pulserasEntregadas: updated.pulserasEntregadas || updated.ingresos.length,
        ingresadoAt: now
      }
    });
  }

  // Si no se actualizó, investigamos la causa exacta para informar al portero
  const venta = await Venta.findOne({ ticketCode: cleanCode, evento: eventId }).lean();
  if (!venta) throw httpError(404, 'Boleto no encontrado para este evento.');
  if (venta.anulada) throw httpError(400, 'Boleto anulado. Acceso denegado.');
  if (venta.estadoPago === 'PENDIENTE') throw httpError(400, 'Boleto pendiente de pago. Pasar por taquilla.');

  if (venta.ingresos && venta.ingresos.length >= venta.cantidad) {
    const primerIngreso = venta.ingresos[0]?.fecha || venta.ingresadoAt || new Date();
    const horaStr = new Intl.DateTimeFormat('es-SV', {
      timeZone: evento.zonaHoraria || 'America/El_Salvador',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    }).format(new Date(primerIngreso));

    return res.status(409).json({
      status: 'DENEGADO',
      message: `Boleto ya utilizado a las ${horaStr}.`,
      primerIngreso,
      horaFormateada: horaStr,
      cantidad: venta.cantidad,
      ingresados: venta.ingresos.length,
      asistente: {
        id: venta._id,
        nombre: venta.nombre,
        categoria: venta.categoria,
        ticketCode: venta.ticketCode
      }
    });
  }

  throw httpError(400, 'No se pudo procesar el ingreso.');
}

/**
 * Resumen de aforo e ingresos en tiempo real.
 */
export async function resumen(req, res) {
  const eventId = parseId(req.query.evento, 'evento');
  const evento = await Evento.findById(eventId).lean();
  if (!evento) throw httpError(404, 'El evento no existe.');

  const [stats] = await Venta.aggregate([
    { $match: { evento: new Types.ObjectId(eventId), anulada: false } },
    {
      $group: {
        _id: null,
        entradasVendidas: {
          $sum: { $cond: [{ $in: ['$estadoPago', ['CANCELADO', 'PAGADO']] }, '$cantidad', 0] }
        },
        ingresadosEnPuerta: { $sum: { $size: '$ingresos' } },
        pulserasEntregadas: {
          $sum: {
            $cond: [
              { $gt: ['$pulserasEntregadas', 0] },
              '$pulserasEntregadas',
              { $cond: ['$pulseraEntregada', { $size: '$ingresos' }, 0] }
            ]
          }
        }
      }
    }
  ]);

  const totalAforo = evento.aforoMaximo || 0;
  const entradasVendidas = stats?.entradasVendidas || 0;
  const ingresadosEnPuerta = stats?.ingresadosEnPuerta || 0;
  const pulserasEntregadas = stats?.pulserasEntregadas || 0;
  const pendientesPorIngresar = Math.max(0, entradasVendidas - ingresadosEnPuerta);
  const porcentajeIngreso = totalAforo > 0 ? Math.round((ingresadosEnPuerta / totalAforo) * 100) : 0;
  const porcentajeVendidas = entradasVendidas > 0 ? Math.round((ingresadosEnPuerta / entradasVendidas) * 100) : 0;

  res.json({
    totalAforo,
    entradasVendidas,
    ingresadosEnPuerta,
    pendientesPorIngresar,
    porcentajeIngreso,
    porcentajeVendidas,
    pulserasEntregadas,
    eventoNombre: evento.nombre,
    activo: evento.activo
  });
}

/**
 * Búsqueda manual rápida de asistentes para validación con o sin QR.
 */
export async function buscar(req, res) {
  const eventId = parseId(req.query.evento, 'evento');
  const q = req.query.q?.trim() || '';
  if (!q) return res.json({ resultados: [] });

  const safeRegex = new RegExp(escapeRegex(q), 'i');
  const ventas = await Venta.find({
    evento: eventId,
    anulada: false,
    $or: [
      { nombre: safeRegex },
      { telefono: safeRegex },
      { ticketCode: safeRegex },
      { colegio: safeRegex }
    ]
  }).limit(30).lean();

  const resultados = ventas.map(v => ({
    id: v._id,
    nombre: v.nombre,
    telefono: v.telefono || '',
    colegio: v.colegio || '',
    categoria: v.categoria,
    ticketCode: v.ticketCode,
    cantidad: v.cantidad,
    ingresados: v.ingresos ? v.ingresos.length : 0,
    restantes: Math.max(0, v.cantidad - (v.ingresos ? v.ingresos.length : 0)),
    ingresado: v.ingresado || (v.ingresos && v.ingresos.length >= v.cantidad),
    pulseraEntregada: v.pulseraEntregada || false,
    estadoPago: v.estadoPago,
    pagado: ['CANCELADO', 'PAGADO'].includes(v.estadoPago)
  }));

  res.json({ resultados });
}

/**
 * Permite marcar o desmarcar la entrega de pulsera manualmente.
 */
export async function marcarPulsera(req, res) {
  const id = parseId(req.params.id, 'venta');
  const { pulseraEntregada } = req.body;
  const updated = await Venta.findByIdAndUpdate(
    id,
    { $set: { pulseraEntregada: Boolean(pulseraEntregada) } },
    { returnDocument: 'after' }
  ).lean();

  if (!updated) throw httpError(404, 'Boleto no encontrado.');

  res.json({
    id: updated._id,
    pulseraEntregada: updated.pulseraEntregada,
    pulserasEntregadas: updated.pulserasEntregadas || 0
  });
}
