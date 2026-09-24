import { randomUUID } from 'node:crypto';
import { Schema, model } from 'mongoose';

const schema = new Schema({
  ticketId: { type: String, default: randomUUID, unique: true },
  ticketCode: { type: String, unique: true, sparse: true }, numero: Number,
  requestKey: String, requestHash: String, tarifaNombre: String,
  montoCentavos: { type: Number, min: 0, validate: Number.isSafeInteger },
  anuladoPor: { type: Schema.Types.ObjectId, ref: 'Usuario' }, anuladoEn: Date,
  evento: { type: Schema.Types.ObjectId, ref: 'ConfiguracionEvento', required: true, index: true },
  tarifa: { type: Schema.Types.ObjectId, ref: 'Tarifa', required: true },
  registradoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nombre: { type: String, required: true, trim: true },
  categoria: { type: String, required: true, trim: true, maxlength: 50 },
  telefono: String, colegio: String,
  cantidad: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  precioUnitarioCentavos: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  totalCentavos: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  metodo: { type: String, enum: ['Transferencia', 'Efectivo'], required: true },
  estadoPago: { type: String, enum: ['CANCELADO', 'PAGADO', 'PENDIENTE'], required: true },
  bancoOrigen: String, referencia: String,
  anulada: { type: Boolean, default: false }, motivoAnulacion: String,
  ingresado: { type: Boolean, default: false, index: true },
  ingresadoAt: Date,
  pulseraEntregada: { type: Boolean, default: false },
  pulserasEntregadas: { type: Number, default: 0, min: 0 },
  ingresos: [{ _id: false, fecha: { type: Date, required: true }, portero: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true } }]
}, { timestamps: true, collection: 'asistentes_ventas' });
schema.pre('validate', function () {
  if (this.totalCentavos !== this.cantidad * this.precioUnitarioCentavos) this.invalidate('totalCentavos', 'Total inconsistente.');
  if (this.ingresos.length > this.cantidad) this.invalidate('ingresos', 'Ingresos superiores a la cantidad comprada.');
  if (this.metodo === 'Transferencia' && ['CANCELADO', 'PAGADO'].includes(this.estadoPago) && !this.referencia) this.invalidate('referencia', 'La transferencia pagada requiere referencia.');
});
schema.index({ evento: 1, estadoPago: 1, anulada: 1 });
schema.index({ evento: 1, createdAt: -1, _id: -1 });
schema.index({ evento: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } });
export default model('AsistenteVenta', schema);
