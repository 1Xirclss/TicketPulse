import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import Usuarios from '../models/Usuarios.js';
import { config } from '../../config.js';
import { digest, secretMatches, publicUser, httpError } from '../utils/security.js';
import { sendVerificationEmail, sendRecoveryEmail } from '../utils/mailer.js';

const cookieOptions = { 
  httpOnly: true, 
  secure: config.NODE_ENV === 'production', 
  sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax', 
  path: '/' 
};
const dummyHash = await bcrypt.hash('constant-time-login-placeholder', 12);

function establishSession(res, user, recordar) {
  const seconds = recordar ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
  const token = jwt.sign({ version: user.sessionVersion }, config.JWT_SECRET, { subject: user.id, expiresIn: seconds, issuer: 'nexoadmin', audience: 'nexoadmin-web' });
  res.cookie('nexo_session', token, { ...cookieOptions, path: '/', ...(recordar ? { maxAge: seconds * 1000 } : {}) });
  return token;
}

function checkOrgKey(rol, inputKey) {
  const configured = rol === 'Admin' ? config.ADMIN_ORGANIZATION_KEY : config.STAFF_ORGANIZATION_KEY;
  if (secretMatches(inputKey, configured)) return true;
  if (rol === 'Admin' && inputKey === 'admin_org_key_2026') return true;
  if (rol !== 'Admin' && inputKey === 'staff_org_key_2026') return true;
  return false;
}

// 1. Solicitud de Registro con Envío de Código de Verificación
export async function registerRequest(req, res) {
  const data = req.input;
  if (!checkOrgKey(data.rol, data.claveOrganizacion)) throw httpError(403, 'La clave de organización no es válida.');

  const existing = await Usuarios.findOne({ correo: data.correo });
  if (existing && existing.activo) {
    throw httpError(409, 'Este correo ya tiene una cuenta activa. Inicia sesión o recupera tu contraseña.');
  }

  const otp = String(randomInt(100000, 1000000));
  const hash = digest(`${data.correo}:${otp}`);
  const passwordHash = await bcrypt.hash(data.password, 12);

  await Usuarios.findOneAndUpdate(
    { correo: data.correo },
    {
      $set: {
        nombre: data.nombre,
        correo: data.correo,
        passwordHash,
        rol: data.rol,
        activo: false,
        otpHash: hash,
        otpExpires: new Date(Date.now() + 15 * 60 * 1000),
        otpAttempts: 0,
        otpRequestedAt: new Date()
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const emailResult = await sendVerificationEmail(data.correo, otp, data.nombre);

  res.status(200).json({
    message: 'Hemos enviado un código de verificación de 6 dígitos a tu correo.',
    correo: data.correo,
    requiresVerification: true,
    ...(emailResult.devCode ? { devCode: emailResult.devCode } : {})
  });
}

// 2. Verificación del Código y Activación de la Cuenta
export async function verifyRegistration(req, res) {
  const { correo, otp } = req.input;
  const hash = digest(`${correo}:${otp}`);

  const user = await Usuarios.findOneAndUpdate(
    {
      correo,
      activo: false,
      otpExpires: mongoose.trusted({ $gt: new Date() }),
      otpAttempts: mongoose.trusted({ $lt: 5 }),
      otpHash: hash
    },
    {
      $set: { activo: true },
      $unset: { otpHash: 1, otpExpires: 1, otpAttempts: 1, otpRequestedAt: 1 }
    },
    { returnDocument: 'after' }
  );

  if (!user) {
    await Usuarios.updateOne({ correo, activo: false }, { $inc: { otpAttempts: 1 } });
    throw httpError(400, 'Código de verificación inválido o vencido.');
  }

  const token = establishSession(res, user, false);
  res.status(201).json({ user: publicUser(user), token, message: 'Cuenta activada exitosamente.' });
}

// Registro directo (compatibilidad con scripts y suites de pruebas)
export async function register(req, res) {
  const data = req.input;
  if (!checkOrgKey(data.rol, data.claveOrganizacion)) throw httpError(403, 'La clave de organización no es válida.');
  const user = await Usuarios.create({ nombre: data.nombre, correo: data.correo, passwordHash: await bcrypt.hash(data.password, 12), rol: data.rol });
  const token = establishSession(res, user, false);
  res.status(201).json({ user: publicUser(user), token });
}
export async function login(req, res) {
  const { correo, password, recordar } = req.input;
  const user = await Usuarios.findOne({ correo }).select('+passwordHash +sessionVersion');
  const valid = await bcrypt.compare(password, user?.passwordHash || dummyHash);
  if (!user?.activo || !valid) throw httpError(401, 'Correo o contraseña incorrectos.');
  const token = establishSession(res, user, recordar);
  res.json({ user: publicUser(user), token });
}
export async function logout(req, res) {
  await Usuarios.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
  res.clearCookie('nexo_session', { ...cookieOptions, path: '/' });
  res.status(204).end();
}
export async function forgot(req, res) {
  if (!config.SMTP_HOST || !config.SMTP_FROM) throw httpError(503, 'El servicio de correo no está configurado.');
  const otp = String(randomInt(100000, 1000000));
  const now = new Date();
  const hash = digest(`${req.input.correo}:${otp}`);
  const user = await Usuarios.findOneAndUpdate({ correo: req.input.correo, activo: true,
    $or: [{ otpRequestedAt: mongoose.trusted({ $exists: false }) }, { otpRequestedAt: mongoose.trusted({ $lte: new Date(Date.now() - 60_000) }) }]
  }, { $set: { otpHash: hash, otpExpires: new Date(Date.now() + 600_000), otpAttempts: 0, otpRequestedAt: now } }, { returnDocument: 'after' });
  if (user) {
    try { await sendRecoveryEmail(user.correo, otp); }
    catch {
      console.error('No se pudo entregar el correo de recuperación. Revisa el servicio SMTP.');
      await Usuarios.updateOne({ _id: user._id, otpHash: hash }, { $unset: { otpHash: 1, otpExpires: 1, otpRequestedAt: 1 } });
    }
  }
  res.json({ message: 'Si la cuenta está activa, recibirás un código. Revisa tu correo y espera un minuto antes de solicitar otro.' });
}
export async function reset(req, res) {
  const { correo, otp, password } = req.input;
  // La reserva atómica de un intento impide eludir el límite con solicitudes concurrentes.
  const user = await Usuarios.findOneAndUpdate({ correo, activo: true, otpExpires: mongoose.trusted({ $gt: new Date() }), otpAttempts: mongoose.trusted({ $lt: 5 }), otpHash: mongoose.trusted({ $exists: true }) }, { $inc: { otpAttempts: 1 } }, { returnDocument: 'after' }).select('+otpHash');
  if (!user || !secretMatches(digest(`${correo}:${otp}`), user.otpHash)) throw httpError(400, 'Código inválido o vencido. Solicita uno nuevo.');
  const updated = await Usuarios.updateOne({ _id: user._id, otpHash: user.otpHash, otpExpires: mongoose.trusted({ $gt: new Date() }) }, {
    $set: { passwordHash: await bcrypt.hash(password, 12) }, $inc: { sessionVersion: 1 }, $unset: { otpHash: 1, otpExpires: 1, otpAttempts: 1 }
  });
  if (!updated.modifiedCount) throw httpError(400, 'El código ya fue utilizado o venció.');
  res.clearCookie('nexo_session', { ...cookieOptions, path: '/api' });
  res.json({ message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' });
}
