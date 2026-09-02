// @ts-check
/**
 * StrykerJS — mutation testing (audit Fable 5 · action 90.2).
 *
 * 5 modules pilotes définis. Sélection via variable d'environnement :
 *   STRYKER_MODULE=lib|hooks-email|hooks-tresorerie|components-email|utils
 *
 * Défaut : `lib` (comportement historique préservé).
 *
 * Objectif audit : identifier les tests à score de mutation nul sur ces 5
 * modules pour retirer ~30 % du corpus deep2-deep5 sans baisse de score.
 */

const MODULES = {
  lib: {
    label: 'src/lib',
    mutate: [
      'src/lib/**/*.ts',
      '!src/lib/**/*.test.ts',
      '!src/lib/**/*.d.ts',
      '!src/lib/**/__tests__/**',
    ],
  },
  'hooks-email': {
    label: 'hooks email',
    mutate: [
      'src/hooks/email/**/*.ts',
      '!src/hooks/email/**/*.test.ts',
      '!src/hooks/email/**/__tests__/**',
    ],
  },
  'hooks-tresorerie': {
    label: 'hooks trésorerie',
    mutate: [
      'src/hooks/tresorerie/**/*.ts',
      '!src/hooks/tresorerie/**/*.test.ts',
      '!src/hooks/tresorerie/**/__tests__/**',
    ],
  },
  'components-email': {
    label: 'composants email',
    mutate: [
      'src/components/email/**/*.{ts,tsx}',
      '!src/components/email/**/*.test.{ts,tsx}',
      '!src/components/email/**/*.deep*.test.{ts,tsx}',
      '!src/components/email/**/__tests__/**',
    ],
  },
  utils: {
    label: 'utils',
    mutate: [
      'src/utils/**/*.ts',
      '!src/utils/**/*.test.ts',
      '!src/utils/**/__tests__/**',
    ],
  },
  // Extension C6 (PLAN_TESTS_2026-07) — modules critiques métier/sécurité.
  'hooks-pulse': {
    label: 'hooks pulse',
    mutate: [
      'src/hooks/pulse/**/*.ts',
      '!src/hooks/pulse/**/*.test.ts',
    ],
  },
  'lib-pulse': {
    label: 'src/lib/pulse',
    mutate: [
      'src/lib/pulse/**/*.ts',
      '!src/lib/pulse/**/*.test.ts',
    ],
  },
  'components-facturation': {
    label: 'composants facturation',
    mutate: [
      'src/components/facturation/**/*.{ts,tsx}',
      '!src/components/facturation/**/*.test.{ts,tsx}',
      '!src/components/facturation/**/*.deep*.test.{ts,tsx}',
    ],
  },
  'offline-outbox': {
    label: 'offline outbox',
    mutate: ['src/lib/offlineOutbox.ts'],
  },
  'auth-provider': {
    label: 'AuthProvider',
    mutate: ['src/components/AuthProvider.tsx'],
  },
};

const selected = process.env.STRYKER_MODULE || 'lib';
const cfg = MODULES[selected];
if (!cfg) {
  console.error(
    `[stryker] STRYKER_MODULE="${selected}" inconnu. Valeurs valides : ${Object.keys(MODULES).join(', ')}`,
  );
  process.exit(1);
}

console.log(`[stryker] Cible : ${cfg.label} (STRYKER_MODULE=${selected})`);

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  reporters: ['html', 'clear-text', 'progress', 'json'],
  mutate: cfg.mutate,
  ignorePatterns: ['dist', 'coverage', 'node_modules', 'supabase/functions', 'reports'],
  coverageAnalysis: 'perTest',
  thresholds: { high: 80, low: 50, break: null },
  htmlReporter: { fileName: `reports/mutation/${selected}.html` },
  jsonReporter: { fileName: `reports/mutation/${selected}.json` },
  timeoutMS: 60000,
  concurrency: 2,
  tempDirName: `.stryker-tmp-${selected}`,
};
