import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.ATLAS_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'virtual:atlas-account':
        process.env.ATLAS_PRIVATE_ENTRY ||
        fileURLToPath(new URL('./src/capabilities/GuestExtension.tsx', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4330,
    strictPort: true,
    // v0.18.0: the styled tile pyramid doubled the repo's tile files to
    // ~62k. Vite's watcher tries to watch them all and exhausts the
    // inotify limit (ENOSPC), which broke finalize-build.mjs (its stderr
    // spam overflowed the test's exec buffer). Tiles are static assets
    // served from public/ — nothing in dev ever needs to watch them.
    watch: { ignored: ['**/tiles/**', '**/node_modules/**', '**/dist/**'] },
  },
  preview: { host: '127.0.0.1', port: 4330, strictPort: true },
  build: { chunkSizeWarningLimit: 650 },
});
