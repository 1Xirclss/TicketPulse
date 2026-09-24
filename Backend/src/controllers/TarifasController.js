import Tarifa from '../models/Tarifas.js';
import Venta from '../models/AsistentesVentas.js';
import { getAccessibleEvent } from '../utils/eventAccess.js';
import { parseId } from '../utils/eventValidation.js';
import { httpError } from '../utils/security.js';

export async function list(req, res) {
  const evento = await getAccessibleEvent(req.query.evento, req.user);
  const filter = { evento: evento._id };
  // Si no se solicita ?all=true o el usuario no es Admin, solo devuelve activas
  if (req.query.all !== 'true' || req.user.rol !== 'Admin') {
    filter.activa = true;
  }
  const tarifas = await Tarifa.find(filter).sort({ etapa: 1, categoria: 1, nombre: 1 }).lean();
  res.json({ tarifas });
}

export async function create(req, res) {
  const { eventoId, nombre, categoria, etapa, precioCentavos, activa = true } = req.input;
  const evento = await getAccessibleEvent(eventoId, req.user);

  const existing = await Tarifa.findOne({ evento: evento._id, nombre, categoria, etapa });
  if (existing) {
    if (existing.activa) {
      throw httpError(400, `Ya existe una tarifa activa "${nombre}" (${categoria} · ${etapa}). Puedes modificar su precio en la tabla.`);
    }
    existing.precioCentavos = precioCentavos;
    existing.activa = true;
    await existing.save();
    return res.status(200).json({ tarifa: existing, reactivada: true });
  }

  const tarifa = await Tarifa.create({
    evento: evento._id,
    nombre,
    categoria,
    etapa,
    precioCentavos,
    moneda: 'USD',
    activa: activa !== undefined ? activa : true
  });

  res.status(201).json({ tarifa });
}

export async function update(req, res) {
  const id = parseId(req.params.id, 'tarifa');
  const data = req.input;

  const tarifa = await Tarifa.findById(id);
  if (!tarifa) throw httpError(404, 'Tarifa no encontrada.');

  await getAccessibleEvent(tarifa.evento.toString(), req.user);

  if (data.nombre !== undefined) tarifa.nombre = data.nombre;
  if (data.categoria !== undefined) tarifa.categoria = data.categoria;
  if (data.etapa !== undefined) tarifa.etapa = data.etapa;
  if (data.precioCentavos !== undefined) tarifa.precioCentavos = data.precioCentavos;
  if (data.activa !== undefined) tarifa.activa = data.activa;

  await tarifa.save();
  res.json({ tarifa });
}

export async function renameCategory(req, res) {
  const { eventoId, categoriaAnterior, categoriaNueva } = req.input;
  const evento = await getAccessibleEvent(eventoId, req.user);

  const resTarifas = await Tarifa.updateMany(
    { evento: evento._id, categoria: categoriaAnterior },
    { $set: { categoria: categoriaNueva } }
  );

  const resVentas = await Venta.updateMany(
    { evento: evento._id, categoria: categoriaAnterior },
    { $set: { categoria: categoriaNueva } }
  );

  res.json({
    categoria: categoriaNueva,
    tarifasActualizadas: resTarifas.modifiedCount,
    ventasActualizadas: resVentas.modifiedCount
  });
}

export async function toggleOrDelete(req, res) {
  const id = parseId(req.params.id, 'tarifa');
  const tarifa = await Tarifa.findById(id);
  if (!tarifa) throw httpError(404, 'Tarifa no encontrada.');

  await getAccessibleEvent(tarifa.evento.toString(), req.user);

  // Si existen ventas con esta tarifa, solo alternamos su estado activo
  const hasSales = await Venta.exists({ tarifa: id });
  if (hasSales) {
    tarifa.activa = !tarifa.activa;
    await tarifa.save();
    return res.json({ tarifa, desactivada: !tarifa.activa, eliminada: false });
  }

  await Tarifa.deleteOne({ _id: id });
  res.json({ id, eliminada: true });
}
