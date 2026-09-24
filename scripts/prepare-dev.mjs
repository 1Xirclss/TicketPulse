import mongoose from '../Backend/node_modules/mongoose/index.js';

await mongoose.connect('mongodb://localhost:27017/gestion_eventos_db_codex');
const db = mongoose.connection.db;

await db.collection('configuracion_evento').updateOne(
  { slug: 'evento-inicial' },
  { $set: { activo: true, aforoMaximo: 100 } }
);

await db.collection('tarifas').updateMany(
  { nombre: 'General', etapa: 'Preventa' },
  { $set: { activa: true, precioCentavos: 1500 } }
);

await db.collection('tarifas').updateMany(
  { nombre: 'Promo', etapa: 'Preventa' },
  { $set: { activa: true, precioCentavos: 1000 } }
);

console.log('Evento activado y tarifas configuradas exitosamente.');
await mongoose.disconnect();
