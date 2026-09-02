import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { applyIndexHtmlBranding } from './scripts/openpulseHtmlBranding'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Build stability: avoid heavy post-processing in CI/publish pipeline
  // and keep the build as deterministic/fast as possible.
  server: {
    host: '::',
    port: 8080,
    watch: {
      // Browser-use archives can contain thousands of text artifacts. Ignore
      // only this archive tree so Vite does not exhaust file watchers; test
      // discovery remains controlled by each test runner's include patterns.
      ignored: ['**/tests/browser-use/archive/**'],
    },
  },
  build: {
    // Computing gzip/brotli sizes for every chunk is expensive on large apps
    // and can cause timeouts in constrained CI/publish environments.
    reportCompressedSize: false,
    target: 'es2022',
    // Source maps désactivées en prod : générer des sourcemaps cachés pour
    // ~8000 modules provoque un OOM (SIGABRT) sur le runner de publication.
    sourcemap: false,
    cssCodeSplit: true, // Split CSS per chunk to reduce unused CSS
    cssMinify: 'lightningcss', // Use lightningcss for better CSS optimization
    // Disable modulepreload polyfill and eager preloading of lazy chunks
    // This prevents loading unused JS/CSS on pages that don't need them (e.g. login)
    modulePreload: { polyfill: false },
    // Minification only in production (dev builds are for diagnostics and speed)
    minify: mode === 'production' ? 'esbuild' : false,
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      output: {
        // Rollup 4.x (via Vite 6) expose encore cette option sous son nom expérimental.
        experimentalMinChunkSize: 10000,
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/') ||
              id.includes('node_modules/react-router/') ||
              id.includes('node_modules/react-router-dom/')
            ) {
              return 'react-core'
            }
            if (id.includes('@tanstack/react-query')) return 'query-core'
            if (id.includes('@supabase/')) return 'supabase-vendor'
            if (id.includes('@radix-ui/')) return 'radix-vendor'
            if (id.includes('@dnd-kit')) return 'dnd-kit'
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor'
            if (id.includes('framer-motion')) return 'animations'
            if (
              id.includes('pdfjs-dist') ||
              id.includes('react-pdf') ||
              id.includes('jspdf') ||
              id.includes('html2pdf')
            )
              return 'pdf'
            if (id.includes('maplibre-gl')) return 'maps'
            if (id.includes('xlsx') || id.includes('exceljs')) return 'xlsx'
            if (id.includes('mermaid')) return 'mermaid'
            if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment'))
              return 'date-utils'
            if (id.includes('lucide-react')) return 'icons'
          }
          // Audit V5 (2026-06-07) — anti-cycle Rollup : seuls Jarvis et `services/`
          // sont isolés (zéro cross-import vérifié). Les autres hooks restent dans
          // un unique `app-hooks` pour éviter les cycles `app-hooks-X -> app-hooks`.
          if (id.includes('/src/services/')) return 'app-services'
          if (id.includes('/src/hooks/jarvis/')) return 'app-hooks-jarvis'
          if (id.includes('/src/hooks/')) return 'app-hooks'
        },
      },
    },
  },
  plugins: [
    {
      name: 'openpulse-index-html-branding',
      transformIndexHtml: {
        order: 'pre' as const,
        handler(html: string) {
          return applyIndexHtmlBranding(html, loadEnv(mode, process.cwd(), ''))
        },
      },
    },
    react(),
    // NOTE: l'app-shell Service Worker Workbox est désactivé temporairement.
    // Les manifests home-screen restent servis depuis /public, et /sw.js est
    // désormais un kill-switch qui évacue les anciens caches offline cassés.
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tiptap/core': path.resolve(__dirname, './node_modules/@tiptap/core/dist/index.js'),
    },
    // Force single instance resolution to avoid Rollup/PWA resolver conflicts
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', '@tiptap/core', '@tiptap/react'],
  },
  esbuild: {
    // Drop debugger statements in all builds; treat console.debug as pure in prod
    // so the minifier can strip it. Effective when build.minify === 'esbuild'.
    drop: ['debugger'],
    pure: mode === 'production' ? ['console.debug'] : [],
    legalComments: 'none',
  },
  optimizeDeps: {
    include: ['@tiptap/core', '@tiptap/react', '@tiptap/starter-kit'],
  },
}))
