import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
process.env.NEXO_E2E_DATABASE ||= `nexoadmin_e2e_${randomBytes(8).toString('hex')}`;
const env = {
  NODE_ENV: 'test', PORT: '5081', FRONTEND_URL: 'http://localhost:5181',
  MONGODB_URI: `mongodb://127.0.0.1:27017/${process.env.NEXO_E2E_DATABASE}`,
  JWT_SECRET: randomBytes(48).toString('hex'), ADMIN_ORGANIZATION_KEY: randomBytes(32).toString('hex'), STAFF_ORGANIZATION_KEY: randomBytes(32).toString('hex'),
  API_PROXY_TARGET: 'http://localhost:5081', VITE_API_URL: '/api'
};
export default defineConfig({
  testDir: './tests', workers: 1,
  globalSetup: './scripts/e2e-setup.mjs', globalTeardown: './scripts/e2e-teardown.mjs',
  use: { baseURL: 'http://localhost:5181', headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: [
    { command: 'npm --prefix Backend start', url: 'http://localhost:5081/api/health', env, reuseExistingServer: false, timeout: 30000 },
    { command: 'npm --prefix FrontEnd-NexoAdmin run dev -- --port 5181', url: 'http://localhost:5181', env, reuseExistingServer: false, timeout: 30000 }
  ], reporter: 'list'
});
