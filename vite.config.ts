import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Capacitor's WebView serves dist/ from its own root, so the default build needs
  // root-relative paths ('/'). GitHub Pages serves this repo under /japplan/, so only
  // the dedicated 'gh-pages' mode (npm run build:pages) switches the base path.
  base: mode === 'gh-pages' ? '/japplan/' : '/',
  build: {
    // Bundled into the Android APK, not fetched over the network at runtime, so a large
    // vendor chunk (maplibre-gl, ~1055 kB) doesn't cost users download time the way it
    // would on the web. Limit set with modest headroom above that, not Vite's web-oriented
    // 500 kB default — still low enough to catch an actual regression elsewhere.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          maplibre: ['maplibre-gl'],
          'map-tiles': ['pmtiles', '@protomaps/basemaps'],
        },
      },
    },
  },
}))
