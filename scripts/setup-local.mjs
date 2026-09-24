import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../Backend/.env', import.meta.url));
const frontend = fileURLToPath(new URL('../FrontEnd-NexoAdmin/.env', import.meta.url));
if (!existsSync(backend)) {
  writeFileSync(backend, `NODE_ENV=development\nPORT=5080\nMONGODB_URI=mongodb://localhost:27017/gestion_eventos_db_codex\nFRONTEND_URL=http://localhost:5180\nJWT_SECRET=${randomBytes(48).toString('hex')}\nADMIN_ORGANIZATION_KEY=${randomBytes(32).toString('hex')}\nSTAFF_ORGANIZATION_KEY=${randomBytes(32).toString('hex')}\nSMTP_HOST=\nSMTP_PORT=587\nSMTP_USER=\nSMTP_PASS=\nSMTP_FROM=\nSEED_ADMIN_NAME=Administrador local\nSEED_ADMIN_EMAIL=admin@nexoadmin.local\nSEED_ADMIN_PASSWORD=${randomBytes(24).toString('base64url')}\n`, { flag: 'wx' });
  console.info('Backend/.env creado con secretos aleatorios. Consulta SEED_ADMIN_PASSWORD para acceder localmente.');
} else console.info('Backend/.env existente conservado.');
if (!existsSync(frontend)) copyFileSync(fileURLToPath(new URL('../FrontEnd-NexoAdmin/.env.example', import.meta.url)), frontend);
