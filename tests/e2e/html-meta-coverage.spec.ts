import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que <html lang> est présent et que le favicon répond 200.
 */

test.describe('HTML lang & favicon', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test('html[lang] présent', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang, '<html lang> manquant').toBeTruthy();
  });

  test('favicon répond', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const href = await page.locator('link[rel*="icon"]').first().getAttribute('href');
    expect(href, 'lien favicon manquant').toBeTruthy();
    const resp = await page.request.get(href!);
    expect(resp.status()).toBeLessThan(400);
  });
});
