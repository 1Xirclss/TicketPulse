import nodemailer from 'nodemailer';
import { config } from '../../config.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.SMTP_HOST || !config.SMTP_FROM) return null;
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: config.NODE_ENV === 'production',
    connectionTimeout: 10000,
    socketTimeout: 15000,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {})
  });
  return transporter;
}

export async function sendVerificationEmail(correo, otp, nombre = 'Usuario') {
  const mailer = getTransporter();

  // En producción (Render) con SMTP configurado, despacha correo real
  if (mailer && config.SMTP_FROM) {
    try {
      await mailer.sendMail({
        from: config.SMTP_FROM,
        to: correo,
        subject: `TicketPulse · Código de activación: ${otp}`,
        text: `Hola ${nombre},\n\nTu código de verificación para activar tu cuenta en TicketPulse es: ${otp}\n\nEste código vence en 15 minutos.\nSi no solicitaste esta cuenta, puedes ignorar este mensaje.\n\nEquipo TicketPulse`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #ccdbfd; border-radius: 14px; color: #000000;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #2563eb;">TICKETPULSE · ACTIVACIÓN DE CUENTA</span>
              <h2 style="margin: 8px 0 0; font-size: 24px; color: #000000; font-weight: 800;">Verifica tu correo electrónico</h2>
            </div>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">Hola <strong>${nombre}</strong>,</p>
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">Usa el siguiente código de seguridad de 6 dígitos para verificar tu cuenta y acceder a TicketPulse:</p>
            <div style="background: #edf2fb; border: 1px solid #ccdbfd; border-radius: 12px; padding: 22px; text-align: center; margin: 28px 0;">
              <span style="font-family: 'JetBrains Mono', monospace, Courier; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #1d4ed8;">${otp}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.6;">Este código es de un solo uso y vencerá en <strong>15 minutos</strong>. Si tú no realizaste este registro, puedes ignorar este correo de forma segura.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">TicketPulse · Event Operating System</p>
          </div>
        `
      });
      console.info(`[MAIL SENDER] Correo de verificación enviado con éxito a ${correo}`);
      return { sent: true };
    } catch (err) {
      console.error('[MAIL SENDER ERROR] Fallo al enviar correo en Render:', err.message);
      throw new Error('No se pudo enviar el correo de verificación. Revisa la configuración SMTP en Render.');
    }
  }

  // En local (o si aún no se configuró SMTP en Render)
  console.info(`\n======================================================`);
  console.info(`[TICKETPULSE EMAIL SENDER · MODO LOCAL / DEV]`);
  console.info(`Destinatario: ${correo} (${nombre})`);
  console.info(`CÓDIGO DE VERIFICACIÓN: ${otp}`);
  console.info(`======================================================\n`);
  return { sent: false, devCode: otp };
}

export async function sendRecoveryEmail(correo, otp) {
  const mailer = getTransporter();
  if (mailer && config.SMTP_FROM) {
    await mailer.sendMail({
      from: config.SMTP_FROM,
      to: correo,
      subject: `TicketPulse · Recupera tu acceso: ${otp}`,
      text: `Tu código de recuperación es ${otp}. Vence en 10 minutos. Si no lo solicitaste, ignora este correo.`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 28px; background: #ffffff; border: 1px solid #ccdbfd; border-radius: 14px; color: #000000;">
          <h2 style="font-size: 22px; color: #000000; margin-top: 0; font-weight: 800;">Recuperación de Contraseña</h2>
          <p style="font-size: 15px; color: #334155;">Tu código de seguridad para restablecer tu contraseña es:</p>
          <div style="background: #edf2fb; border: 1px solid #ccdbfd; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 34px; font-weight: 900; letter-spacing: 6px; color: #1d4ed8;">${otp}</span>
          </div>
          <p style="font-size: 13px; color: #64748b;">Vence en 10 minutos. Si no lo solicitaste, puedes ignorar este mensaje.</p>
        </div>
      `
    });
    return { sent: true };
  }
  console.info(`\n[TICKETPULSE RECOVERY SENDER · MODO LOCAL] Para ${correo}: ${otp}\n`);
  return { sent: false, devCode: otp };
}
