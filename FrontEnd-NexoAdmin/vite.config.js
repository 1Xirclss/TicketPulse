import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5180, strictPort: true, proxy: { '/api': { target: process.env.API_PROXY_TARGET || loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:5080', changeOrigin: true } } },
  build: { chunkSizeWarningLimit: 1100 }
}));
