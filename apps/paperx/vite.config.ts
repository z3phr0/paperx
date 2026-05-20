import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath } from 'node:url';
import manifest from './manifest.json' with { type: 'json' };
import pkg from './package.json' with { type: 'json' };

// package.json.version is the single source of truth. Inject it into:
//   1. the MV3 manifest (overriding any literal there — manifest.json
//      no longer carries a version field of its own)
//   2. a __PAPERX_VERSION__ define so JsonPromptExporter can stamp
//      meta.paperxVersion at runtime without a second hardcoded copy.
const versionedManifest = { ...manifest, version: pkg.version };

export default defineConfig({
  plugins: [react(), crx({ manifest: versionedManifest as any })],
  define: {
    __PAPERX_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5174 },
  },
});
