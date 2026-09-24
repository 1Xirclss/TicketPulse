import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const databaseName = `nexoadmin_test_${randomBytes(8).toString('hex')}`;
Object.assign(process.env, { NODE_ENV: 'test', MONGODB_URI: `mongodb://127.0.0.1:27017/${databaseName}`, FRONTEND_URL: 'http://localhost:5180', JWT_SECRET: randomBytes(48).toString('hex'), ADMIN_ORGANIZATION_KEY: randomBytes(32).toString('hex'), STAFF_ORGANIZATION_KEY: randomBytes(32).toString('hex') });
let app, database, Usuario, Evento, Tarifa, Venta, admin, taquilla, portero, eventId, tarifaId, adminId;
const payload = { nombre: 'Evento de integración', fecha: '2026-12-20', horario: '18:30', zonaHoraria: 'America/El_Salvador', venue: 'Recinto de prueba', direccion: 'Dirección de prueba', aforoMaximo: 100, activo: true, marca: { nombre: 'Organización', logoUrl: '' } };
const cookie = user => `nexo_session=${jwt.sign({ version: 0 }, process.env.JWT_SECRET, { subject: user.id, issuer: 'nexoadmin', audience: 'nexoadmin-web', expiresIn: 3600 })}`;
const write = (method, path, body, session = admin) => request(app)[method](path).set('Origin', process.env.FRONTEND_URL).set('Cookie', session).send(body);
const get = (path, session = admin) => request(app).get(path).set('Cookie', session);
before(async () => {
  ({ default: app } = await import('../app.js'));
  database = await (await import('../database.js')).connectDatabase();
  ({ default: Usuario } = await import('../src/models/Usuarios.js'));
  ({ default: Evento } = await import('../src/models/ConfiguracionEvento.js'));
  ({ default: Tarifa } = await import('../src/models/Tarifas.js'));
  ({ default: Venta } = await import('../src/models/AsistentesVentas.js'));
  await Promise.all([Usuario.init(), Evento.init(), Tarifa.init(), Venta.init()]);
  for (const rol of ['Admin', 'Taquilla', 'Portero']) {
    const user = await Usuario.create({ nombre: rol, correo: `${rol.toLowerCase()}@test.local`, passwordHash: 'test-only-not-used-for-login', rol });
    if (rol === 'Admin') { admin = cookie(user); adminId = user._id; }
    if (rol === 'Taquilla') taquilla = cookie(user);
    if (rol === 'Portero') portero = cookie(user);
  }
});
after(async () => { if (database) { assert.match(database.name, /^nexoadmin_test_[a-f0-9]{16}$/); await database.dropDatabase(); await database.close(); } });

test('rutas requieren autenticación y prohíben edición al personal', async () => {
  assert.equal((await request(app).get('/api/configuracion')).status, 401);
  assert.equal((await write('post', '/api/configuracion', payload, taquilla)).status, 403);
  assert.equal((await write('post', '/api/configuracion', payload, portero)).status, 403);
  assert.equal((await get('/api/dashboard/stats', portero)).status, 403);
});
test('valida fecha, horario, aforo y rechaza configuración bancaria', async () => {
  for (const invalid of [{ fecha: '2026-02-30' }, { horario: '25:30' }, { aforoMaximo: 0 }, { aforoMaximo: 1.5 }, { zonaHoraria: 'no-existe' }, { cuentaBancaria: { numero: '123' } }, { marca: { nombre: '', logoUrl: 'javascript:alert(1)' } }]) {
    assert.equal((await write('post', '/api/configuracion', { ...payload, ...invalid })).status, 400);
  }
});
test('Admin crea evento y la API devuelve estado vacío calculado', async () => {
  const result = await write('post', '/api/configuracion', payload);
  assert.equal(result.status, 201); eventId = result.body.evento._id;
  const response = await get(`/api/dashboard/stats?evento=${eventId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.resumen.recaudadoCentavos, 0);
  assert.equal(response.body.resumen.ingresados, 0);
  assert.equal(response.body.aforo.disponibles, 100);
  assert.equal(response.body.liquidacion[0].porcentaje, 0);
  assert.deepEqual(response.body.tarifas, []);
  assert.deepEqual(response.body.recientes, []);
});
test('tarifas: consulta activas y gestión autorizada solo para admin', async () => {
  const tariff = await Tarifa.create({ evento: eventId, nombre: 'Entrada externa', categoria: 'General', etapa: 'Preventa', precioCentavos: 1500, activa: true }); tarifaId = tariff._id;
  await Tarifa.create({ evento: eventId, nombre: 'Entrada inactiva', categoria: 'Promo', etapa: 'Puerta', precioCentavos: 2000, activa: false });
  const response = await get(`/api/tarifas?evento=${eventId}`, taquilla);
  assert.equal(response.status, 200); assert.equal(response.body.tarifas.length, 1);
  assert.equal(response.body.tarifas[0].precioCentavos, 1500);

  // Taquilla no tiene permisos de modificación (403)
  assert.equal((await write('post', '/api/tarifas', { eventoId: eventId, nombre: 'VIP', categoria: 'VIP', etapa: 'Preventa', precioCentavos: 3000 }, taquilla)).status, 403);
  assert.equal((await write('put', `/api/tarifas/${tarifaId}`, { precioCentavos: 1800 }, taquilla)).status, 403);
  assert.equal((await write('delete', `/api/tarifas/${tarifaId}`, {}, taquilla)).status, 403);

  // Admin sí puede crear tarifas con categorías personalizadas y renombrarlas
  const resCrear = await write('post', '/api/tarifas', { eventoId: eventId, nombre: 'VIP Oro', categoria: 'VIP', etapa: 'Preventa', precioCentavos: 3500 }, admin);
  assert.equal(resCrear.status, 201);
  assert.equal(resCrear.body.tarifa.categoria, 'VIP');

  // Guardar a la vez Preventa y Puerta para una categoría
  const resCatPrecios = await write('put', '/api/tarifas/categorias/precios', {
    eventoId: eventId,
    categoria: 'VIP',
    precioPreventaCentavos: 3500,
    precioPuertaCentavos: 4500,
    activaPreventa: true,
    activaPuerta: true
  }, admin);
  assert.equal(resCatPrecios.status, 200);
  assert.equal(resCatPrecios.body.preventa.precioCentavos, 3500);
  assert.equal(resCatPrecios.body.puerta.precioCentavos, 4500);

  const resRenombrar = await write('put', '/api/tarifas/categorias/renombrar', { eventoId: eventId, categoriaAnterior: 'VIP', categoriaNueva: 'Platino' }, admin);
  assert.equal(resRenombrar.status, 200);
  assert.equal(resRenombrar.body.categoria, 'Platino');

  // Limpiar las tarifas creadas para no afectar el conteo de pruebas posteriores
  await Tarifa.deleteOne({ _id: resCrear.body.tarifa._id });
  await Tarifa.deleteOne({ _id: resCatPrecios.body.preventa._id });
  await Tarifa.deleteOne({ _id: resCatPrecios.body.puerta._id });
});
test('agregaciones separan pagados, pendientes y anulados y aíslan cada evento', async () => {
  const sale = { evento: eventId, tarifa: tarifaId, registradoPor: adminId, nombre: 'Asistente de prueba', categoria: 'General', cantidad: 2, precioUnitarioCentavos: 1500, totalCentavos: 3000, metodo: 'Efectivo', estadoPago: 'CANCELADO', ingresos: [{ fecha: new Date(), portero: adminId }] };
  await Venta.create(sale);
  await Venta.create({ ...sale, nombre: 'Transferencia', cantidad: 1, totalCentavos: 1500, metodo: 'Transferencia', referencia: 'PRUEBA-001', estadoPago: 'PAGADO', ingresos: [] });
  await Venta.create({ ...sale, nombre: 'Pendiente', cantidad: 3, totalCentavos: 4500, estadoPago: 'PENDIENTE', ingresos: [] });
  await Venta.create({ ...sale, nombre: 'Anulada', anulada: true });
  const other = await Evento.create({ ...payload, slug: 'otro', activo: false });
  await Venta.create({ ...sale, evento: other._id });
  const { body } = await get(`/api/dashboard/stats?evento=${eventId}`, taquilla);
  assert.equal(body.resumen.recaudadoCentavos, 4500);
  assert.equal(body.resumen.efectivoCentavos, 3000);
  assert.equal(body.resumen.transferenciaCentavos, 1500);
  assert.equal(body.resumen.pendienteCentavos, 4500);
  assert.equal(body.resumen.ventasPagadas, 2);
  assert.equal(body.resumen.entradasReservadas, 6);
  assert.equal(body.resumen.entradasPagadas, 3);
  assert.equal(body.resumen.ingresados, 1);
  assert.equal(body.resumen.pendientesIngreso, 2);
  assert.equal(body.aforo.disponibles, 94);
  assert.equal(body.aforo.porcentajeIngresado, 1);
  assert.equal(body.recientes.length, 3);
  assert.equal(body.liquidacion[0].porcentaje, 66.67);
  assert.equal(body.tarifas.length, 1);
  assert.equal((await get(`/api/dashboard/stats?evento=${other.id}`, taquilla)).status, 404);
  assert.equal((await get('/api/configuracion', taquilla)).body.eventos.length, 1);
});
test('edición valida aforo, controla versiones y persiste cambios', async () => {
  assert.equal((await write('put', `/api/configuracion/${eventId}`, { ...payload, aforoMaximo: 5, version: 0 })).status, 409);
  const result = await write('put', `/api/configuracion/${eventId}`, { ...payload, nombre: 'Evento actualizado', aforoMaximo: 150, version: 0 });
  assert.equal(result.status, 200); assert.equal(result.body.evento.__v, 1);
  assert.equal((await write('put', `/api/configuracion/${eventId}`, { ...payload, version: 0 })).status, 409);
  assert.equal((await get(`/api/configuracion/${eventId}`)).body.evento.nombre, 'Evento actualizado');
});
test('datos bancarios antiguos tampoco se exponen en respuestas', async () => {
  await Evento.collection.updateOne({ _id: (await Evento.findById(eventId))._id }, { $set: { cuentaBancaria: { numero: 'legacy-private' } } });
  assert.equal((await get(`/api/configuracion/${eventId}`)).body.evento.cuentaBancaria, undefined);
  assert.equal((await get('/api/configuracion')).body.eventos.find(item => item._id === eventId).cuentaBancaria, undefined);
  assert.equal((await get(`/api/dashboard/stats?evento=${eventId}`)).body.evento.cuentaBancaria, undefined);
});
test('IDs inválidos o inexistentes y eventos inactivos se manejan sin error interno', async () => {
  assert.equal((await get('/api/configuracion/no-valido')).status, 400);
  assert.equal((await get('/api/dashboard/stats')).status, 400);
  assert.equal((await get('/api/tarifas?evento[$ne]=x')).status, 400);
  assert.equal((await get('/api/configuracion/aaaaaaaaaaaaaaaaaaaaaaaa')).status, 404);
  const result = await write('put', `/api/configuracion/${eventId}`, { ...payload, activo: false, version: 1 });
  assert.equal(result.status, 200);
  assert.equal((await get(`/api/configuracion/${eventId}`, portero)).status, 404);
  assert.equal((await get(`/api/dashboard/stats?evento=${eventId}`, taquilla)).status, 404);
});
