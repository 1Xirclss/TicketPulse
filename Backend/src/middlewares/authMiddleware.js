import jwt from 'jsonwebtoken';
import Usuarios from '../models/Usuarios.js';
import { config } from '../../config.js';
import { httpError } from '../utils/security.js';

export async function authenticate(req, res, next) {
  let token;
  const raw = req.cookies?.nexo_session || req.headers?.authorization?.replace(/^Bearer\s+/i, '');
  if (!raw) throw httpError(401, 'Inicia sesión para continuar.');
  try { token = jwt.verify(raw, config.JWT_SECRET, { algorithms: ['HS256'], issuer: 'nexoadmin', audience: 'nexoadmin-web' }); }
  catch { throw httpError(401, 'Inicia sesión para continuar.'); }
  const user = await Usuarios.findById(token.sub).select('+sessionVersion');
  if (!user?.activo || user.sessionVersion !== token.version) throw httpError(401, 'La sesión ha vencido.');
  req.user = user;
  next();
}
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol)) throw httpError(403, 'No tienes permisos para esta operación.');
  next();
};
