import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4321',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(root, 'dist'),
    rollupOptions: {
      input: path.resolve(root, 'index.html'),
    },
  },
});
