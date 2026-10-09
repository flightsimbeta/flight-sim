// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/flight-sim/', // ⬅️ repo adınızla aynı olmalı
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] }
      }
    }
  }
});
