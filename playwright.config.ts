import { defineConfig, devices } from '@playwright/test'
import {
  isLocalPlaywrightTarget,
  localWebServerFor,
  resolvePlaywrightBaseURL,
} from './playwright.config.shared'

const baseURL = resolvePlaywrightBaseURL()
const webServer = localWebServerFor(baseURL)

/**
 * Budgets de temps selon la cible.
 *
 * En local, Vite sert le bundle et Supabase répond en quelques dizaines de ms :
 * les défauts Playwright (30 s par test, 5 s par assertion) suffisent.
 *
 * Contre le live Azure, le shell applicatif monte vers 3 s mais les listes ne
 * sont hydratées qu'autour de 11 s (mesuré sur /etablissements, 252 lignes).
 * Le défaut de 5 s sur `expect` produisait alors des rouges qui ne disaient
 * rien de la qualité du code — seulement de la latence du backend distant.
 * Ces budgets élargis ne masquent aucune assertion fausse : un test qui
 * échoue sur le fond échoue toujours, simplement plus tard.
 */
const isRemoteTarget = !isLocalPlaywrightTarget(baseURL)
const TEST_TIMEOUT = isRemoteTarget ? 90_000 : 30_000
const EXPECT_TIMEOUT = isRemoteTarget ? 20_000 : 5_000

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: TEST_TIMEOUT,
  expect: { timeout: EXPECT_TIMEOUT },
  /* Global setup : connecte un compte admin une fois et sauvegarde storageState */
  globalSetup: './tests/e2e/global-setup.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
      ]
    : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,
    /* Session admin pré-loggée par global-setup.ts (skippable via E2E_SKIP_SETUP=1) */
    storageState: 'tests/e2e/.auth/admin.json',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // A configured remote target must not boot Vite locally.
  ...(webServer ? { webServer } : {}),
})
