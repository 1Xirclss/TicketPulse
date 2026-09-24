import { createRequire } from 'node:module';
const require = createRequire(new URL('../Backend/package.json', import.meta.url));
const mongoose = require('mongoose');
export default async function teardown() {
  if (!/^nexoadmin_e2e_[a-f0-9]{16}$/.test(process.env.NEXO_E2E_DATABASE)) throw new Error('No se puede eliminar una base ajena a las pruebas.');
  try {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${process.env.NEXO_E2E_DATABASE}`);
    await mongoose.connection.dropDatabase();
  } finally { await mongoose.disconnect(); }
}
