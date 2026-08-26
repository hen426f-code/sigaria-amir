import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  strictPort: true,
  allowedHosts: true,
  headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  },
  build: {
    target: 'es2020',
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 4096,
  rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: [],
    include: ['three'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
