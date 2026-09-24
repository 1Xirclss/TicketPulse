import { Schema, model } from 'mongoose';

const schema = new Schema({
  slug: { type: String, required: true, unique: true },
  nombre: { type: String, required: true, trim: true },
  fecha: { type: Date, required: true }, horario: { type: String, required: true },
  zonaHoraria: { type: String, default: 'America/El_Salvador' },
  venue: { type: String, required: true }, direccion: { type: String, required: true },
  aforoMaximo: { type: Number, required: true, min: 1, validate: Number.isInteger },
  activo: { type: Boolean, default: false },
  entradasReservadas: { type: Number, min: 0 },
  ventasSecuencia: { type: Number, default: 0 },
  ventasRevision: { type: Number, default: 0 },
  operacionVenta: { type: Schema.Types.Mixed, select: false },
  marca: { nombre: String, logoUrl: String }
}, { timestamps: true, collection: 'configuracion_evento' });
export default model('ConfiguracionEvento', schema);
