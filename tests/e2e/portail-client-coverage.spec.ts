import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture du portail client (espace client) : routes admin de gestion
 * et redirection auth pour les routes /client publiques.
 */

test.describe('Portail client', () => {
  test('admin accède à la gestion du portail client', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/parametres/portail-client').catch(() => {});
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });

  test('route /client redirige ou affiche login client sans crash', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const resp = await page.goto('/client', { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (resp && resp.status() >= 500) {
      throw new Error(`HTTP ${resp.status()} sur /client`);
    }
    // Soit page de login client, soit redirect — pas de crash blanc.
    const html = await page.content();
    expect(html.length).toBeGreaterThan(500);
    await context.close();
  });
});
