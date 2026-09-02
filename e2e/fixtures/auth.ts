/**
 * Fixture Playwright : restaure la session Supabase pré-mintée avant navigation.
 *
 * Variables d'environnement injectées par le sandbox la plateforme initiale :
 *   - E2E_BROWSER_SUPABASE_STORAGE_KEY  (clé localStorage `sb-<project>-auth-token`)
 *   - E2E_BROWSER_SUPABASE_SESSION_JSON (session complète)
 *   - E2E_BROWSER_SUPABASE_COOKIES_JSON (cookies @supabase/ssr, optionnel)
 *
 * Usage :
 *   import { test, expect } from './fixtures/auth';
 *   test('dashboard', async ({ authedPage }) => { ... });
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test'

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080'

export async function restoreSupabaseSession(context: BrowserContext, page: Page) {
  const storageKey = process.env.E2E_BROWSER_SUPABASE_STORAGE_KEY
  const sessionJson = process.env.E2E_BROWSER_SUPABASE_SESSION_JSON
  const cookiesJson = process.env.E2E_BROWSER_SUPABASE_COOKIES_JSON

  if (cookiesJson) {
    try {
      const cookies = JSON.parse(cookiesJson).map((c: any) => ({ ...c, url: BASE_URL }))
      await context.addCookies(cookies)
    } catch (e) {
      console.warn('[auth fixture] cookies parse failed', e)
    }
  }

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

  if (storageKey && sessionJson) {
    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
      storageKey,
      sessionJson,
    ] as const)
  }
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ context, page }, use) => {
    await restoreSupabaseSession(context, page)
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` est la fixture Playwright, pas un hook React
    await use(page)
  },
})

export { expect }
