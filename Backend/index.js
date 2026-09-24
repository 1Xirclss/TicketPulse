import app from './app.js';
import { connectDatabase } from './database.js';
import { config } from './config.js';
import { recoverPendingEvents } from './src/services/ventasAtomic.js';

try {
  const database = await connectDatabase();
  await recoverPendingEvents();
  let recovering = false;
  const recoveryTimer = setInterval(async () => {
    if (recovering) return;
    recovering = true;
    try { await recoverPendingEvents(); } catch (error) { console.error('Recuperación pendiente:', error.name); } finally { recovering = false; }
  }, 10000);
  recoveryTimer.unref();
  const server = app.listen(config.PORT, '0.0.0.0', () => console.info(`API disponible en puerto ${config.PORT}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    clearInterval(recoveryTimer);
    server.close(async () => { await database.close(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
} catch (error) {
  console.error('No se pudo iniciar la API:', error.name);
  process.exit(1);
}
