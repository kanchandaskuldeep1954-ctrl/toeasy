import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    // Optimize for production
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts'],
          'univer-vendor': [
            '@univerjs/core',
            '@univerjs/design',
            '@univerjs/engine-formula',
            '@univerjs/engine-render',
            '@univerjs/sheets',
            '@univerjs/sheets-ui',
            '@univerjs/ui',
          ],
        }
      }
    }
  }
});
