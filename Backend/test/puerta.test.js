import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const databaseName = 'nexoadmin_test_gate_' + randomBytes(8).toString('hex');
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/' + databaseName,
  FRONTEND_URL: 'http://localhost:5180',
  JWT_SECRET: randomBytes(48).toString('hex'),
  ADMIN_ORGANIZATION_KEY: randomBytes(32).toString('hex'),
  STAFF_ORGANIZATION_KEY: randomBytes(32).toString('hex')
});

let app, db, Evento, Venta, Tarifa, admin, staff, gate, gateUserId;
const eventConfig = {
  nombre: 'Evento Puerta Test',
  fecha: '2026-12-25',
  horario: '20:00',
  zonaHoraria: 'America/El_Salvador',
  venue: 'Estadio Cuscatlán',
  direccion: 'San Salvador',
  aforoMaximo: 100,
  activo: true,
  marca: { nombre: '', logoUrl: '' }
};

function token(user) {
  return 'nexo_session=' + jwt.sign(
    { version: 0 },
    process.env.JWT_SECRET,
    { subject: user.id, issuer: 'nexoadmin', audience: 'nexoadmin-web', expiresIn: 3600 }
  );
}

const post = (path, body, cookie = gate) =>
  request(app).post(path).set('Origin', process.env.FRONTEND_URL).set('Cookie', cookie).send(body);

const get = (path, cookie = gate) =>
  request(app).get(path).set('Cookie', cookie);

const put = (path, body, cookie = gate) =>
  request(app).put(path).set('Origin', process.env.FRONTEND_URL).set('Cookie', cookie).send(body);

before(async () => {
  ({ default: app } = await import('../app.js'));
  db = await (await import('../database.js')).connectDatabase();
  const { default: Usuario } = await import('../src/models/Usuarios.js');
  ({ default: Evento } = await import('../src/models/ConfiguracionEvento.js'));
  ({ default: Venta } = await import('../src/models/AsistentesVentas.js'));
  ({ default: Tarifa } = await import('../src/models/Tarifas.js'));

  await Promise.all([Usuario.init(), Evento.init(), Venta.init(), Tarifa.init()]);

  for (const rol of ['Admin', 'Taquilla', 'Portero']) {
    const user = await Usuario.create({
      nombre: `Usuario ${rol}`,
      correo: `${rol.toLowerCase()}@puerta.test`,
      rol,
      passwordHash: 'dummy-hash'
    });
    const c = token(user);
    if (rol === 'Admin') admin = c;
    else if (rol === 'Taquilla') staff = c;
    else {
      gate = c;
      gateUserId = user._id;
    }
  }
});

after(async () => {
  if (db) {
    assert.match(db.name, /^nexoadmin_test_gate_[a-f0-9]{16}$/);
    await db.dropDatabase();
    await db.close();
  }
});

async function createSale(overrides = {}) {
  const evento = overrides.eventoDoc || await Evento.create({ ...eventConfig, slug: randomUUID() });
  const ticketCode = overrides.ticketCode || 'NX' + randomBytes(12).toString('hex').toUpperCase();
  const cantidad = overrides.cantidad || 1;
  const precioUnitarioCentavos = overrides.precioUnitarioCentavos || 1000;
  const totalCentavos = overrides.totalCentavos || (cantidad * precioUnitarioCentavos);

  const venta = await Venta.create({
    evento: evento._id,
    tarifa: overrides.tarifa || new (await import('mongoose')).Types.ObjectId(),
    registradoPor: gateUserId,
    tarifaNombre: 'General',
    categoria: 'General',
    precioUnitarioCentavos,
    totalCentavos,
    montoCentavos: totalCentavos,
    numero: Math.floor(Math.random() * 9000) + 1000,
    nombre: 'Juan Pérez',
    telefono: '7890-1234',
    colegio: 'Colegio Centroamérica',
    cantidad,
    metodo: 'Efectivo',
    estadoPago: 'CANCELADO',
    ticketCode,
    idempotencyKey: randomUUID(),
    ingresos: [],
    pulseraEntregada: false,
    pulserasEntregadas: 0,
    anulada: false,
    ...overrides
  });
  return { evento, venta, ticketCode };
}

test('Portero valida entrada por primera vez con éxito (200 OK y entrega pulsera)', async () => {
  const { evento, ticketCode } = await createSale();
  const res = await post('/api/puerta/validar', { ticketCode, eventoId: evento.id });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'PERMITIDO');
  assert.equal(res.body.asistente.ingresado, true);
  assert.equal(res.body.asistente.ingresados, 1);
  assert.equal(res.body.asistente.pulseraEntregada, true);
  assert.equal(res.body.asistente.nombre, 'Juan Pérez');

  const updated = await Venta.findOne({ ticketCode });
  assert.equal(updated.ingresado, true);
  assert.equal(updated.ingresos.length, 1);
  assert.equal(updated.pulseraEntregada, true);
});

test('Sanitización limpia prefijos NEXO: y URLs completas', async () => {
  const { evento, ticketCode } = await createSale();
  const resPrefixed = await post('/api/puerta/validar', {
    ticketCode: `NEXO:${ticketCode}`,
    eventoId: evento.id
  });
  assert.equal(resPrefixed.status, 200);

  const { ticketCode: ticketCode2 } = await createSale({ eventoDoc: evento });
  const resUrl = await post('/api/puerta/validar', {
    ticketCode: `https://nexoadmin.local/check?code=${ticketCode2}`,
    eventoId: evento.id
  });
  assert.equal(resUrl.status, 200);
});

test('Reintento de ingreso devuelve 409 Conflict con hora exacta del primer ingreso', async () => {
  const { evento, ticketCode } = await createSale();
  const first = await post('/api/puerta/validar', { ticketCode, eventoId: evento.id });
  assert.equal(first.status, 200);

  const second = await post('/api/puerta/validar', { ticketCode, eventoId: evento.id });
  assert.equal(second.status, 409);
  assert.equal(second.body.status, 'DENEGADO');
  assert.match(second.body.message, /ya utilizado/i);
  assert.ok(second.body.horaFormateada);
});

test('Concurrencia: 10 escaneos simultáneos sobre 1 boleto permiten exactamente 1 y 9 rechazos (409)', async () => {
  const { evento, ticketCode } = await createSale();
  const attempts = await Promise.all(
    Array.from({ length: 10 }, () => post('/api/puerta/validar', { ticketCode, eventoId: evento.id }))
  );

  const ok = attempts.filter(r => r.status === 200);
  const conflict = attempts.filter(r => r.status === 409);

  assert.equal(ok.length, 1);
  assert.equal(conflict.length, 9);

  const venta = await Venta.findOne({ ticketCode });
  assert.equal(venta.ingresos.length, 1);
});

test('Boleto grupal (cantidad: 2) admite 2 ingresos y bloquea el 3ro', async () => {
  const { evento, ticketCode } = await createSale({ cantidad: 2, montoCentavos: 2000 });

  const r1 = await post('/api/puerta/validar', { ticketCode, eventoId: evento.id });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.asistente.ingresados, 1);
  assert.equal(r1.body.asistente.restantes, 1);
  assert.equal(r1.body.asistente.ingresado, false);

  const r2 = await post('/api/puerta/validar', { ticketCode, eventoId: evento.id });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.asistente.ingresados, 2);
  assert.equal(r2.body.asistente.restantes, 0);
  assert.equal(r2.body.asistente.ingresado, true);

  const r3 = await post('/api/puerta/validar', { ticketCode, eventoId: evento.id });
  assert.equal(r3.status, 409);
});

test('Rechaza boletos anulados y pendientes de pago con 400', async () => {
  const { evento, ticketCode: codeAnulada } = await createSale({ anulada: true });
  const rAnulada = await post('/api/puerta/validar', { ticketCode: codeAnulada, eventoId: evento.id });
  assert.equal(rAnulada.status, 400);
  assert.match(rAnulada.body.message, /anulado/i);

  const { ticketCode: codePendiente } = await createSale({ eventoDoc: evento, estadoPago: 'PENDIENTE' });
  const rPendiente = await post('/api/puerta/validar', { ticketCode: codePendiente, eventoId: evento.id });
  assert.equal(rPendiente.status, 400);
  assert.match(rPendiente.body.message, /pendiente de pago/i);
});

test('Rechaza boletos inexistentes con 404', async () => {
  const { evento } = await createSale();
  const res = await post('/api/puerta/validar', { ticketCode: 'NXNOEXISTE999', eventoId: evento.id });
  assert.equal(res.status, 404);
});

test('Resumen de puerta calcula aforo, ingresados y pulseras en tiempo real', async () => {
  const evento = await Evento.create({ ...eventConfig, slug: randomUUID(), aforoMaximo: 100 });
  await createSale({ eventoDoc: evento, cantidad: 5 });
  const { ticketCode } = await createSale({ eventoDoc: evento, cantidad: 2 });

  // Validamos 1 entrada de ticketCode
  await post('/api/puerta/validar', { ticketCode, eventoId: evento.id });

  const res = await get(`/api/puerta/resumen?evento=${evento.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.totalAforo, 100);
  assert.equal(res.body.entradasVendidas, 7);
  assert.equal(res.body.ingresadosEnPuerta, 1);
  assert.equal(res.body.pendientesPorIngresar, 6);
  assert.equal(res.body.pulserasEntregadas, 1);
  assert.equal(res.body.porcentajeIngreso, 1);
});

test('Búsqueda manual encuentra asistentes por nombre, teléfono, colegio y ticketCode', async () => {
  const { evento, ticketCode } = await createSale({
    nombre: 'Mariana Montes',
    telefono: '7654-3210',
    colegio: 'Liceo Salvadoreño'
  });

  const resNombre = await get(`/api/puerta/buscar?evento=${evento.id}&q=Mariana`);
  assert.equal(resNombre.status, 200);
  assert.equal(resNombre.body.resultados.length, 1);
  assert.equal(resNombre.body.resultados[0].ticketCode, ticketCode);

  const resColegio = await get(`/api/puerta/buscar?evento=${evento.id}&q=Liceo`);
  assert.equal(resColegio.status, 200);
  assert.equal(resColegio.body.resultados.length, 1);

  const resPhone = await get(`/api/puerta/buscar?evento=${evento.id}&q=7654`);
  assert.equal(resPhone.status, 200);
  assert.equal(resPhone.body.resultados.length, 1);
});

test('Marcar y desmarcar pulsera manualmente actualiza el registro', async () => {
  const { venta } = await createSale();
  const resMarcar = await put(`/api/puerta/marcar-pulsera/${venta.id}`, { pulseraEntregada: true });
  assert.equal(resMarcar.status, 200);
  assert.equal(resMarcar.body.pulseraEntregada, true);

  const resDesmarcar = await put(`/api/puerta/marcar-pulsera/${venta.id}`, { pulseraEntregada: false });
  assert.equal(resDesmarcar.status, 200);
  assert.equal(resDesmarcar.body.pulseraEntregada, false);
});
