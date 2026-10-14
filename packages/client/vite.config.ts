import { defineConfig } from 'vite';

/**
 * COOP/COEP: SharedArrayBuffer (sim worker ↔ render snapshot) için zorunlu (GDD §13.3).
 * Production hosting'te de aynı header'lar verilmelidir.
 */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  // three.js (WebGPU + TSL) tek başına ~900 KB; uyarı eşiği buna göre.
  build: { target: 'es2023', sourcemap: true, chunkSizeWarningLimit: 1200 },
  worker: { format: 'es' },
});
