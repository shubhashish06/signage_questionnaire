import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/questionnaire/signage/' : '/',
  server: {
    port: 3003,
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
      '/questionnaire': { target: 'http://localhost:3002', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3002', ws: true }
    }
  },
  build: {
    outDir: 'dist',
    base: '/questionnaire/signage/'
  }
});
