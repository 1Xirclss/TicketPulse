import { Schema, model } from 'mongoose';

const schema = new Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 100 },
  correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  rol: { type: String, enum: ['Admin', 'Taquilla', 'Portero'], required: true },
  activo: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0, select: false },
  otpHash: { type: String, select: false },
  otpExpires: { type: Date, select: false },
  otpAttempts: { type: Number, default: 0, select: false },
  otpRequestedAt: { type: Date, select: false }
}, { timestamps: true, collection: 'usuarios' });
export default model('Usuario', schema);
