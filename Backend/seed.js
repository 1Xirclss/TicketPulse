import bcrypt from 'bcryptjs';
import { connectDatabase } from './database.js';
import Usuarios from './src/models/Usuarios.js';
import Evento from './src/models/ConfiguracionEvento.js';
import Tarifas from './src/models/Tarifas.js';
import Ventas from './src/models/AsistentesVentas.js';

let database;
try {
  database = await connectDatabase();
  await Promise.all([Usuarios.init(), Evento.init(), Tarifas.init(), Ventas.init()]);

  const defaultAccounts = [
    {
      nombre: 'Administrador Oficial',
      correo: process.env.SEED_ADMIN_EMAIL || 'admin@nexoadmin.com',
      password: process.env.SEED_ADMIN_PASSWORD || 'AdminOficial2026!*',
      rol: 'Admin'
    },
    {
      nombre: 'Operador de Puerta',
      correo: process.env.SEED_GATE_EMAIL || 'puerta@nexoadmin.com',
      password: process.env.SEED_GATE_PASSWORD || 'PuertaControl2026!*',
      rol: 'Portero'
    },
    {
      nombre: 'Operador de Ventas y Taquilla',
      correo: process.env.SEED_SALES_EMAIL || 'ventas@nexoadmin.com',
      password: process.env.SEED_SALES_PASSWORD || 'VentasTaquilla2026!*',
      rol: 'Taquilla'
    }
  ];

  for (const acc of defaultAccounts) {
    const passwordHash = await bcrypt.hash(acc.password, 12);
    await Usuarios.findOneAndUpdate(
      { correo: acc.correo.toLowerCase() },
      {
        $set: {
          nombre: acc.nombre,
          rol: acc.rol,
          activo: true,
          passwordHash
        }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  await Evento.findOneAndUpdate(
    { slug: 'evento-inicial' },
    {
      $setOnInsert: {
        nombre: 'Festival TicketPulse 2026',
        fecha: new Date('2026-12-01T18:00:00-06:00'),
        horario: '18:00',
        venue: 'Centro de Convenciones Principal',
        direccion: 'Av. Principal #100, Ciudad',
        aforoMaximo: 1000,
        activo: true,
        marca: { nombre: 'TicketPulse', logoUrl: '' }
      }
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  console.info('Cuentas oficiales (Admin, Portero, Taquilla) y evento inicial listos en MongoDB.');
} catch (error) {
  console.error('Seed no completado:', error);
  process.exitCode = 1;
} finally {
  if (database) await database.close();
}
