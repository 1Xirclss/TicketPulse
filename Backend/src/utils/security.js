import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config.js';

export const digest = value => createHmac('sha256', config.JWT_SECRET).update(value).digest('hex');
export const secretMatches = (provided, expected) => timingSafeEqual(Buffer.from(digest(provided)), Buffer.from(digest(expected)));
export const publicUser = user => ({ id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol });
export function httpError(status, message) { return Object.assign(new Error(message), { status }); }
