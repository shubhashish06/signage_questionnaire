import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/questionnaire/play/' : '/',
  server: {
    port: 3002,
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
      '/questionnaire': { target: 'http://localhost:3002', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    base: '/questionnaire/play/'
  }
});
