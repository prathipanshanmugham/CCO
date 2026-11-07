import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } } },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { three: ['three'], modelviewer: ['@google/model-viewer'], react: ['react', 'react-dom', 'react-router-dom'] } } },
  },
});
