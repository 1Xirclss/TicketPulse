import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDatabase() {
  mongoose.set('sanitizeFilter', true);
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}
