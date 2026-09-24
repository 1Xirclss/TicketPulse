import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { SMTPServer } from 'smtp-server';
import request from 'supertest';

const databaseName = `nexoadmin_test_${randomBytes(8).toString('hex')}`;
Object.assign(process.env, {
  NODE_ENV: 'test', MONGODB_URI: `mongodb://127.0.0.1:27017/${databaseName}`,
  FRONTEND_URL: 'http://localhost:5180', JWT_SECRET: randomBytes(48).toString('hex'),
  ADMIN_ORGANIZATION_KEY: randomBytes(32).toString('hex'), STAFF_ORGANIZATION_KEY: randomBytes(32).toString('hex'),
  SMTP_HOST: '127.0.0.1', SMTP_FROM: 'test@nexoadmin.local', SMTP_USER: '', SMTP_PASS: ''
});
let database, app, Usuarios, digest, lastMail = '';
const smtp = new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS'], onData(stream, session, callback) {
  lastMail = ''; stream.on('data', chunk => { lastMail += chunk; }); stream.on('end', callback);
} });
const payload = { nombre: 'Equipo de prueba', correo: 'equipo@example.com', password: 'Password de prueba 2026', confirmarPassword: 'Password de prueba 2026', rol: 'Admin', claveOrganizacion: process.env.ADMIN_ORGANIZATION_KEY };
const post = (path, body) => request(app).post(`/api/auth/${path}`).set('Origin', process.env.FRONTEND_URL).send(body);
before(async () => {
  await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
  process.env.SMTP_PORT = String(smtp.server.address().port);
  ({ default: app } = await import('../app.js'));
  ({ default: Usuarios } = await import('../src/models/Usuarios.js'));
  ({ digest } = await import('../src/utils/security.js'));
  database = await (await import('../database.js')).connectDatabase();
  await Usuarios.init();
});
after(async () => {
  if (database) {
    assert.match(database.name, /^nexoadmin_test_[a-f0-9]{16}$/);
    await database.dropDatabase(); await database.close();
  }
  await new Promise(resolve => smtp.close(resolve));
});
test('rechaza orígenes ajenos y sesiones ausentes', async () => {
  assert.equal((await request(app).post('/api/auth/login').set('Origin', 'https://otro.example').send({})).status, 403);
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
});
test('valida contraseña, confirmación y autorización de roles', async () => {
  assert.equal((await post('register', { ...payload, password: 'corta' })).status, 400);
  assert.equal((await post('register', { ...payload, claveOrganizacion: 'invalida' })).status, 403);
  assert.equal((await post('register', { ...payload, rol: 'Taquilla' })).status, 403);
  assert.equal((await post('register', { ...payload, confirmarPassword: 'otra' })).status, 400);
});
let firstCookie;
test('registra en MongoDB, oculta secretos y bloquea duplicados', async () => {
  const response = await post('register', payload);
  assert.equal(response.status, 201);
  assert.equal(response.body.user.rol, 'Admin');
  assert.equal(response.body.user.passwordHash, undefined);
  firstCookie = response.headers['set-cookie'][0];
  assert.match(firstCookie, /HttpOnly/); assert.match(firstCookie, /SameSite=Lax/);
  assert.doesNotMatch(firstCookie, /Max-Age/);
  const stored = await Usuarios.findOne({ correo: payload.correo }).select('+passwordHash');
  assert.notEqual(stored.passwordHash, payload.password);
  assert.equal((await post('register', payload)).status, 409);
});
test('login incorrecto falla; recordar crea cookie persistente; logout revoca', async () => {
  assert.equal((await post('login', { correo: payload.correo, password: 'incorrecta' })).status, 401);
  const response = await post('login', { correo: payload.correo, password: payload.password, recordar: true });
  assert.equal(response.status, 200);
  assert.match(response.headers['set-cookie'][0], /Max-Age=2592000/);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', firstCookie)).body.user.nombre, payload.nombre);
  assert.equal((await request(app).post('/api/auth/logout').set('Origin', process.env.FRONTEND_URL).set('Cookie', firstCookie)).status, 204);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', firstCookie)).status, 401);
});
test('OTP enviado por SMTP, un solo uso y revocación de sesiones al restablecer', async () => {
  const session = await post('login', { correo: payload.correo, password: payload.password });
  assert.equal((await post('forgot-password', { correo: payload.correo })).status, 200);
  const otp = lastMail.match(/\b\d{6}\b/)?.[0];
  assert.ok(otp, 'El correo debe contener un OTP de seis dígitos.');
  const user = await Usuarios.findOne({ correo: payload.correo }).select('+otpHash');
  assert.notEqual(user.otpHash, otp);
  const newPassword = 'Nueva contraseña segura 2026';
  const body = { correo: payload.correo, otp, password: newPassword, confirmarPassword: newPassword };
  const results = await Promise.all([post('reset-password', body), post('reset-password', body)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', session.headers['set-cookie'][0])).status, 401);
  assert.equal((await post('login', { correo: payload.correo, password: payload.password })).status, 401);
  assert.equal((await post('login', { correo: payload.correo, password: newPassword })).status, 200);
});
test('OTP vencido y límite de cinco intentos se aplican en la BD', async () => {
  const body = { correo: payload.correo, otp: '123456', password: payload.password, confirmarPassword: payload.password };
  await Usuarios.updateOne({ correo: payload.correo }, { $set: { otpHash: digest(`${payload.correo}:123456`), otpExpires: new Date(Date.now() - 1000), otpAttempts: 0 } });
  assert.equal((await post('reset-password', body)).status, 400);
  await Usuarios.updateOne({ correo: payload.correo }, { $set: { otpExpires: new Date(Date.now() + 60_000), otpAttempts: 5 } });
  assert.equal((await post('reset-password', body)).status, 400);
});
test('recuperación de cuenta inexistente conserva mensaje genérico', async () => {
  const response = await post('forgot-password', { correo: 'desconocido@example.com' });
  assert.equal(response.status, 200);
  assert.match(response.body.message, /Si la cuenta/);
});
test('venta rechaza importes inconsistentes e ingresos mayores a la cantidad', async () => {
  const { default: Venta } = await import('../src/models/AsistentesVentas.js');
  const id = (await Usuarios.findOne())._id;
  const venta = new Venta({ evento: id, tarifa: id, registradoPor: id, nombre: 'Prueba', categoria: 'General', cantidad: 1, precioUnitarioCentavos: 1000, totalCentavos: 1, metodo: 'Transferencia', estadoPago: 'CANCELADO', ingresos: [{ fecha: new Date(), portero: id }, { fecha: new Date(), portero: id }] });
  await assert.rejects(venta.validate(), error => !!error.errors.totalCentavos && !!error.errors.ingresos && !!error.errors.referencia);
});
