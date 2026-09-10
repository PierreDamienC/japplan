import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const { version: appVersion } = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf-8')) as {
  version: string
}

// maplibre-gl 6's worker bundle (maplibre-gl-worker.mjs) imports a sibling
// maplibre-gl-shared.mjs via a relative path hardcoded inside the compiled
// file itself — unlike v5's self-contained CSP worker. Importing the worker
// via Vite's `?url` asset pipeline (see MapView.tsx) copies only that one
// file, hashed, so the worker's own internal import 404s once deployed (it
// happened to work in `vite dev`, which resolves node_modules paths on the
// fly — this went unnoticed until a build was actually served from GitHub
// Pages). Copying both files as a pair into public/ — served at a stable,
// unhashed, adjacent path in both dev and build — keeps that relative
// import intact.
function copyMaplibreWorker(): Plugin {
  return {
    name: 'copy-maplibre-worker',
    buildStart() {
      const src = path.join(rootDir, 'node_modules', 'maplibre-gl', 'dist')
      const dest = path.join(rootDir, 'public', 'maplibre-worker')
      mkdirSync(dest, { recursive: true })
      for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
        copyFileSync(path.join(src, file), path.join(dest, file))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), copyMaplibreWorker()],
  // Capacitor's WebView serves dist/ from its own root, so the default build needs
  // root-relative paths ('/'). GitHub Pages serves this repo under /japplan/, so only
  // the dedicated 'gh-pages' mode (npm run build:pages) switches the base path.
  base: mode === 'gh-pages' ? '/japplan/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
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
