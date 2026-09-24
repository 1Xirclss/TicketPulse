import { Schema, model } from 'mongoose';

const schema = new Schema({
  evento: { type: Schema.Types.ObjectId, ref: 'ConfiguracionEvento', required: true },
  nombre: { type: String, required: true },
  categoria: { type: String, required: true, trim: true, maxlength: 50 },
  etapa: { type: String, enum: ['Preventa', 'Puerta'], required: true },
  precioCentavos: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  moneda: { type: String, enum: ['USD'], default: 'USD' },
  activa: { type: Boolean, default: true }
}, { timestamps: true, collection: 'tarifas' });
schema.index({ evento: 1, nombre: 1, categoria: 1, etapa: 1 }, { unique: true });
export default model('Tarifa', schema);
