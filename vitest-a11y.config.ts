import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  test: {
    // Contrat public requis par supabaseBrowser au chargement des modules.
    // Uniquement pour Vitest : aucune valeur runtime/Azure n'est modifiée.
    env: {
      // Loopback fermé : les tests a11y ne doivent jamais toucher un backend réel.
      VITE_SUPABASE_URL: 'http://127.0.0.1:9',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public.test.signature',
    },
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    include: [
      'tests/a11y/**/*.test.{ts,tsx}',
      'src/**/*.a11y.test.{ts,tsx}',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
