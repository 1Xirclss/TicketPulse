import { randomUUID } from 'node:crypto';
import Evento from '../models/ConfiguracionEvento.js';
import { getAccessibleEvent } from '../utils/eventAccess.js';
import { httpError } from '../utils/security.js';
import { eventOperation } from '../services/ventasAtomic.js';

export async function list(req, res) {
  const eventos = await Evento.find(req.user.rol === 'Admin' ? {} : { activo: true }).select('-cuentaBancaria').sort({ activo: -1, fecha: -1, _id: -1 }).lean();
  res.json({ eventos });
}
export async function get(req, res) {
  res.json({ evento: await getAccessibleEvent(req.params.id, req.user) });
}
export async function create(req, res) {
  const evento = await Evento.create({ ...req.input, slug: randomUUID() });
  res.status(201).json({ evento });
}
export async function update(req, res) {
  await getAccessibleEvent(req.params.id, req.user);
  const { version, ...data } = req.input;
  await eventOperation(req.params.id, async current => {
    if ((current.__v || 0) !== version) throw httpError(409, 'Otro usuario modificó el evento. Recarga sus datos antes de guardar.');
    if (data.aforoMaximo < current.entradasReservadas) throw httpError(409, 'El aforo no puede ser menor que las entradas reservadas o los ingresos registrados.');
    return { config: { ...data, fecha: new Date(data.fecha + 'T00:00:00.000Z') } };
  });
  res.json({ evento: await getAccessibleEvent(req.params.id, req.user) });
}
