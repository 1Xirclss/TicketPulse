import Evento from '../models/ConfiguracionEvento.js';
import { parseId } from './eventValidation.js';
import { httpError } from './security.js';

export async function getAccessibleEvent(id, user) {
  const evento = await Evento.findById(parseId(id)).select('-cuentaBancaria').lean();
  if (!evento || (user.rol !== 'Admin' && !evento.activo)) throw httpError(404, 'El evento no está disponible.');
  return evento;
}
