import { createRequire } from 'node:module';
import { credentials, eventName, emptyEventName } from './e2e-fixtures.mjs';
import Usuario from '../Backend/src/models/Usuarios.js';
import Evento from '../Backend/src/models/ConfiguracionEvento.js';
import Tarifa from '../Backend/src/models/Tarifas.js';
import Venta from '../Backend/src/models/AsistentesVentas.js';
const require = createRequire(new URL('../Backend/package.json', import.meta.url));
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

export default async function setup() {
  if (!/^nexoadmin_e2e_[a-f0-9]{16}$/.test(process.env.NEXO_E2E_DATABASE)) throw new Error('Base de pruebas no válida.');
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${process.env.NEXO_E2E_DATABASE}`);
    await Promise.all([Usuario.init(), Evento.init(), Tarifa.init(), Venta.init()]);
    const admin = await Usuario.create({ nombre: 'Administrador de pruebas', correo: credentials.correo, passwordHash: await bcrypt.hash(credentials.password, 12), rol: 'Admin' });
    const event = await Evento.create({ slug: 'evento-prueba', nombre: eventName, fecha: '2026-12-20', horario: '18:30', zonaHoraria: 'America/El_Salvador', venue: 'Recinto de integración', direccion: 'Dirección de prueba', aforoMaximo: 500, activo: true, marca: { nombre: 'Nexo Test', logoUrl: '' } });
    await Evento.create({ slug: 'evento-vacio', nombre: emptyEventName, fecha: '2026-11-20', horario: '19:00', zonaHoraria: 'America/El_Salvador', venue: 'Recinto vacío', direccion: 'Dirección de prueba', aforoMaximo: 200, activo: true });
    const general = await Tarifa.create({ evento: event._id, nombre: 'Entrada general', categoria: 'General', etapa: 'Preventa', precioCentavos: 1500, activa: true });
    const promo = await Tarifa.create({ evento: event._id, nombre: 'Promo estudiantes', categoria: 'Promo', etapa: 'Preventa', precioCentavos: 1000, activa: true });
    await Venta.create({ evento: event._id, tarifa: general._id, registradoPor: admin._id, nombre: 'Asistente de integración', categoria: 'General', cantidad: 2, precioUnitarioCentavos: 1500, totalCentavos: 3000, metodo: 'Efectivo', estadoPago: 'CANCELADO', ticketCode: 'NX111111111111111111111111', ingresos: [{ fecha: new Date(), portero: admin._id }] });
    await Venta.create({ evento: event._id, tarifa: promo._id, registradoPor: admin._id, nombre: 'Transferencia de prueba', categoria: 'Promo', cantidad: 1, precioUnitarioCentavos: 1000, totalCentavos: 1000, metodo: 'Transferencia', referencia: 'PRUEBA', estadoPago: 'PAGADO', ticketCode: 'NX222222222222222222222222' });
  } finally { await mongoose.disconnect(); }
}
