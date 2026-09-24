import Ventas from '../models/AsistentesVentas.js';
import Tarifa from '../models/Tarifas.js';
import { getAccessibleEvent } from '../utils/eventAccess.js';
import { recoverEvent } from '../services/ventasAtomic.js';

const paid = { $in: ['$estadoPago', ['CANCELADO', 'PAGADO']] };
const sumWhen = (condition, field) => ({ $sum: { $cond: [condition, field, 0] } });
const percentage = (value, total) => total > 0 ? Math.round(value / total * 10000) / 100 : 0;

export async function stats(req, res) {
  const evento = await getAccessibleEvent(req.query.evento, req.user);
  await recoverEvent(evento._id);
  const [aggregation, tarifas] = await Promise.all([
    Ventas.aggregate([
      { $match: { evento: evento._id, anulada: false } },
      { $facet: {
        resumen: [{ $group: {
          _id: null, ventas: { $sum: 1 }, entradasReservadas: { $sum: '$cantidad' },
          ventasPagadas: sumWhen(paid, 1), entradasPagadas: sumWhen(paid, '$cantidad'),
          recaudadoCentavos: sumWhen(paid, '$totalCentavos'),
          efectivoCentavos: sumWhen({ $and: [paid, { $eq: ['$metodo', 'Efectivo'] }] }, '$totalCentavos'),
          transferenciaCentavos: sumWhen({ $and: [paid, { $eq: ['$metodo', 'Transferencia'] }] }, '$totalCentavos'),
          pendienteCentavos: sumWhen({ $eq: ['$estadoPago', 'PENDIENTE'] }, '$totalCentavos'),
          ingresados: { $sum: { $size: { $ifNull: ['$ingresos', []] } } },
          ingresadosPagados: sumWhen(paid, { $size: { $ifNull: ['$ingresos', []] } })
        } }],
        recientes: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 6 }, { $project: { ticketId: 1, nombre: 1, categoria: 1, cantidad: 1, metodo: 1, totalCentavos: 1, estadoPago: 1, createdAt: 1 } }]
      } }
    ]),
    Tarifa.find({ evento: evento._id, activa: true }).sort({ etapa: 1, categoria: 1, nombre: 1 }).lean()
  ]);
  const result = aggregation[0];
  const raw = result?.resumen[0];
  const resumen = {
    ventas: raw?.ventas || 0, ventasPagadas: raw?.ventasPagadas || 0,
    entradasReservadas: raw?.entradasReservadas || 0, entradasPagadas: raw?.entradasPagadas || 0,
    recaudadoCentavos: raw?.recaudadoCentavos || 0, efectivoCentavos: raw?.efectivoCentavos || 0,
    transferenciaCentavos: raw?.transferenciaCentavos || 0, pendienteCentavos: raw?.pendienteCentavos || 0,
    ingresados: raw?.ingresados || 0,
    pendientesIngreso: Math.max(0, (raw?.entradasPagadas || 0) - (raw?.ingresadosPagados || 0))
  };
  res.json({ evento, resumen, aforo: {
    capacidad: evento.aforoMaximo,
    disponibles: Math.max(0, evento.aforoMaximo - resumen.entradasReservadas),
    porcentajeReservado: percentage(resumen.entradasReservadas, evento.aforoMaximo),
    porcentajeIngresado: percentage(resumen.ingresados, evento.aforoMaximo)
  }, liquidacion: [
    { metodo: 'Efectivo', centavos: resumen.efectivoCentavos, porcentaje: percentage(resumen.efectivoCentavos, resumen.recaudadoCentavos) },
    { metodo: 'Transferencia', centavos: resumen.transferenciaCentavos, porcentaje: percentage(resumen.transferenciaCentavos, resumen.recaudadoCentavos) }
  ], tarifas, recientes: result?.recientes || [], actualizadoEn: new Date().toISOString() });
}
