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

  let existing = await Tarifa.findOne({ evento: evento._id, categoria, etapa });
  if (!existing && nombre) {
    existing = await Tarifa.findOne({ evento: evento._id, nombre, etapa });
  }

  if (existing) {
    existing.precioCentavos = precioCentavos;
    existing.activa = activa !== undefined ? activa : true;
    if (nombre) existing.nombre = nombre;
    if (categoria) existing.categoria = categoria;
    await existing.save();
    return res.status(200).json({ tarifa: existing, reactivada: true, actualizada: true });
  }

  try {
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
  } catch (err) {
    if (err.code === 11000) {
      const dup = await Tarifa.findOne({ evento: evento._id, categoria, etapa });
      if (dup) {
        dup.precioCentavos = precioCentavos;
        dup.activa = true;
        await dup.save();
        return res.status(200).json({ tarifa: dup, actualizada: true });
      }
      throw httpError(400, `Ya existe una tarifa para la categoría "${categoria}" en etapa "${etapa}".`);
    }
    throw err;
  }
}

export async function update(req, res) {
  const id = parseId(req.params.id, 'tarifa');
  const data = req.input;

  const tarifa = await Tarifa.findById(id);
  if (!tarifa) throw httpError(404, 'Tarifa no encontrada.');

  await getAccessibleEvent(tarifa.evento.toString(), req.user);

  const targetCategoria = data.categoria !== undefined ? data.categoria : tarifa.categoria;
  const targetEtapa = data.etapa !== undefined ? data.etapa : tarifa.etapa;

  if (targetEtapa !== tarifa.etapa || targetCategoria !== tarifa.categoria) {
    const existingOther = await Tarifa.findOne({
      evento: tarifa.evento,
      categoria: targetCategoria,
      etapa: targetEtapa,
      _id: { $ne: tarifa._id }
    });

    if (existingOther) {
      if (data.precioCentavos !== undefined) existingOther.precioCentavos = data.precioCentavos;
      if (data.activa !== undefined) existingOther.activa = data.activa;
      if (data.nombre !== undefined) existingOther.nombre = data.nombre;
      await existingOther.save();
      return res.json({ tarifa: existingOther, fusionada: true });
    }
  }

  if (data.nombre !== undefined) tarifa.nombre = data.nombre;
  if (data.categoria !== undefined) tarifa.categoria = data.categoria;
  if (data.etapa !== undefined) tarifa.etapa = data.etapa;
  if (data.precioCentavos !== undefined) tarifa.precioCentavos = data.precioCentavos;
  if (data.activa !== undefined) tarifa.activa = data.activa;

  try {
    await tarifa.save();
    res.json({ tarifa });
  } catch (err) {
    if (err.code === 11000) {
      throw httpError(400, `Ya existe una tarifa para "${tarifa.categoria}" en etapa "${tarifa.etapa}". Modifica su precio directamente.`);
    }
    throw err;
  }
}

export async function saveCategoryPrices(req, res) {
  const {
    eventoId,
    categoria,
    precioPreventaCentavos,
    precioPuertaCentavos,
    activaPreventa = true,
    activaPuerta = true
  } = req.input;
  const evento = await getAccessibleEvent(eventoId, req.user);

  let preventa = await Tarifa.findOne({ evento: evento._id, categoria, etapa: 'Preventa' });
  if (preventa) {
    preventa.precioCentavos = precioPreventaCentavos;
    preventa.activa = activaPreventa;
    await preventa.save();
  } else {
    preventa = await Tarifa.create({
      evento: evento._id,
      nombre: categoria,
      categoria,
      etapa: 'Preventa',
      precioCentavos: precioPreventaCentavos,
      moneda: 'USD',
      activa: activaPreventa
    });
  }

  let puerta = await Tarifa.findOne({ evento: evento._id, categoria, etapa: 'Puerta' });
  if (puerta) {
    puerta.precioCentavos = precioPuertaCentavos;
    puerta.activa = activaPuerta;
    await puerta.save();
  } else {
    puerta = await Tarifa.create({
      evento: evento._id,
      nombre: categoria,
      categoria,
      etapa: 'Puerta',
      precioCentavos: precioPuertaCentavos,
      moneda: 'USD',
      activa: activaPuerta
    });
  }

  res.json({ categoria, preventa, puerta });
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
