import { defineConfig, devices } from '@playwright/test'
import { localWebServerFor, resolvePlaywrightBaseURL } from './playwright.config.shared'

const baseURL = resolvePlaywrightBaseURL()
const webServer = localWebServerFor(baseURL)

/**
 * Smoke E2E config — action 180.4 (audit Fable 5).
 *
 * Objectif : suite < 15 min, bloquante PR, couvrant les parcours produit
 * critiques (auth, dashboard, CRM, emails, RH, trésorerie, RBAC).
 * La suite complète (163 specs × 5 browsers) reste nightly (playwright.config.ts).
 *
 * Sélection : specs racines (pas les *-coverage) + chromium desktop uniquement.
 */
const SMOKE_SPECS = [
  'auth.spec.ts',
  'calendrier.spec.ts',
  'contrats.spec.ts',
  'crm-pipeline.spec.ts',
  'dashboard-responsive.spec.ts',
  'email-flow.spec.ts',
  'establishment-search.spec.ts',
  'parametres.spec.ts',
  'rbac-matrix.spec.ts',
  'rh-people.spec.ts',
  'support.spec.ts',
  'task-management.spec.ts',
  'tresorerie.spec.ts',
]

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: SMOKE_SPECS,
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  // Hard budget : la suite entière ne doit pas dépasser 15 min (900 000 ms).
  globalTimeout: 15 * 60 * 1000,
  timeout: 60 * 1000,
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report-smoke' }],
        ['junit', { outputFile: 'test-results/smoke-junit.xml' }],
        ['list'],
      ]
    : 'list',
  use: {
    baseURL,
    storageState: 'tests/e2e/.auth/admin.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-smoke',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // A configured remote target must not boot Vite locally.
  ...(webServer ? { webServer } : {}),
})
