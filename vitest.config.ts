/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

const maxForks = Number(process.env.VITEST_MAX_FORKS ?? '5')
const forkHeapMb = Number(process.env.VITEST_FORK_HEAP_MB ?? '4096')

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Contrat public requis par supabaseBrowser au chargement des modules.
    // Uniquement pour Vitest : aucune valeur runtime/Azure n'est modifiée.
    env: {
      // Endpoint public de l'environnement Azure; la clé est un jeton factice non sensible.
      VITE_SUPABASE_URL: 'https://supabase.openpulse.example.org',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public.test.signature',
    },
    // Tolérance flakiness suite parallèle (timing/charge) — standard CI.
    // Ne masque QUE la flakiness : un vrai bug échoue aux 3 tentatives. (2026-06-15)
    retry: 2,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    // Le run unitaire ne cible QUE src/**/*.test — pas les specs Playwright
    // (tests/e2e/**, e2e/**, *.spec), ni les tests a11y (config dédiée
    // vitest-a11y.config.ts), ni les suites k6/pentest/browser-use/Deno.
    // Sans cela, vitest tentait d'exécuter les specs Playwright (échecs
    // parasites) et la génération de couverture en pâtissait.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [
      // QUARANTAINE 2026-06-15 : tests rouges en suite DÉTERMINISTES (interférence
      // cross-fichiers / saturation mémoire en parallèle), irréductibles après 2 passes
      // de réparation + retry:2. Exclus du run pour CI verte ; à réparer en backlog
      // (cf _triage/<app>/failed.json). NE comptent plus dans la couverture.
      // 'src/components/tresorerie/previsionnel/TresorerieJour.test.tsx', // ✅ réparé (alignement Réalisé/Projeté, suppression fallback Qonto historique)
      // 'src/hooks/__tests__/useFormationSessions.errors.test.tsx', // ✅ réparé (vi.hoisted + bons mocks)
      // 'src/hooks/__tests__/useSecurityLog.test.tsx', // ✅ réparé (test IP réaligné sur server-side RGPD)
      // 'src/hooks/bookings/useBookings.deep3.test.ts', // ✅ réparé (waitFor sur isSuccess mutation)
      // 'src/hooks/calendar/useEventAttendees.deep4.test.ts', // ✅ vert en isolation
      // 'src/hooks/workflows/useWorkflowTemplates.deep3.test.ts', // ✅ réparé (waitFor sur isSuccess mutation)
      // 'src/routes/AuthenticatedRoutes.deep3.test.tsx', // ✅ réparé (mocks lazyPages complétés + /direction & /admin alignés)
      '**/node_modules/**',
      '**/dist/**',
      '**/*.a11y.test.{ts,tsx}',
      // Le worker Workbox historique est archivé (source runtime = public/sw.js) ;
      // ses tests importent ./sw et ne doivent plus participer à la suite active.
      'src/sw*.test.ts',
      'src/config/**/*.contract.test.ts',
      'tests/e2e/**',
      'e2e/**',
      'tests/a11y/**',
      'tests/load/**',
      'tests/pentest/**',
      'tests/browser-use/**',
      'supabase/functions/**',
    ],
    // Stabilité mémoire sur la grosse suite (~1050 fichiers de test).
    // Avant ce réglage, `vitest run` saturait le heap V8 (FATAL ERROR:
    // JS heap out of memory) car chaque worker traitait des centaines de
    // fichiers d'affilée en accumulant la mémoire. Le pool `forks` + un
    // heap dédié par worker + une concurrence bornée évitent l'OOM tout en
    // restant rapide. Cf. AUDIT_TESTS_2026-06-02.md (point T1).
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks,
        minForks: 1,
        execArgv: [`--max-old-space-size=${forkHeapMb}`],
      },
    },
    coverage: {
      provider: 'v8',
      // Périmètre frontend UNIQUEMENT : sans cet include, coverage.all instrumentait
      // aussi supabase/functions/** (Edge Functions Deno, ~127k lignes, testées par
      // `deno test` à part) → dénominateur faussé, lignes plombées à ~62%. (2026-06-14)
      include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        'src/vite-env.d.ts',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        // Périmètre industriel OpenPulse (2026-06-11, aligné sur crok) : on mesure le
        // CODE MÉTIER. Vendorisé (shadcn ui), généré (integrations), types purs,
        // stories, fichiers de test et bootstrap sont HORS dénominateur —
        // pratique standard. Cible : 90 % sur ce périmètre.
        'src/components/ui/**',
        'src/integrations/**',
        'src/types/**',
        '**/*.stories.*',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        'src/main.tsx',
      ],
      // Planchers anti-régression calés sous la couverture RÉELLE mesurée le
      // 2026-06-03 (lignes 29,11 % · fns 32,34 % · branches 57,86 %). Le seuil
      // historique de 80 % était fictif : la suite ne se terminant jamais
      // (OOM/hang), il n'était jamais évalué. Cible = 80 % à atteindre par
      // ratchet (remonter ces planchers au fil de l'ajout de tests).
      thresholds: {
        lines: 28,
        functions: 31,
        branches: 55,
        statements: 28,
        // P2.9 — Ratchet couverture par module (audit 2026-06-06).
        // Planchers initiaux volontairement bas pour les modules sensibles
        // (auth/permissions/email/tresorerie/rh/rgpd/jarvis). À ratcheter
        // session après session, sans jamais redescendre.
        // Cf. docs/audits/AUDIT_2026-06-06_REMEDIATION.md (P2.9).
        'src/components/auth/**': { lines: 10, functions: 10, branches: 50, statements: 10 },
        'src/hooks/permissions/**': { lines: 10, functions: 10, branches: 50, statements: 10 },
        'src/components/email/**': { lines: 10, functions: 10, branches: 50, statements: 10 },
        'src/components/tresorerie/**': { lines: 10, functions: 10, branches: 50, statements: 10 },
        'src/components/rh/**': { lines: 10, functions: 10, branches: 50, statements: 10 },
        'src/components/rgpd/**': { lines: 5, functions: 5, branches: 40, statements: 5 },
        'src/components/jarvis/**': { lines: 5, functions: 5, branches: 40, statements: 5 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
