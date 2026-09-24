import nodemailer from 'nodemailer';
import { config } from '../../config.js';
import { httpError } from './security.js';

export async function sendRecoveryMail(correo, otp) {
  if (!config.SMTP_HOST || !config.SMTP_FROM) throw httpError(503, 'El servicio de correo no está configurado.');
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465,
    requireTLS: config.NODE_ENV === 'production', connectionTimeout: 10000, socketTimeout: 15000,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {})
  });
  await transport.sendMail({ from: config.SMTP_FROM, to: correo, subject: 'NexoAdmin · Recupera tu acceso', text: `Tu código de recuperación es ${otp}. Vence en 10 minutos. Si no lo solicitaste, ignora este correo.` });
}
