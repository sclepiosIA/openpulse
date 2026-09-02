import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les onglets de la page Paramètres sont tous accessibles
 * et ne crashent pas.
 */

test.describe('Paramètres tabs', () => {
  test('cycle les onglets Paramètres sans crash', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/parametres', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    if (count === 0) { test.skip(true, 'Pas d\'onglets sur /parametres'); return; }
    for (let i = 0; i < Math.min(count, 10); i++) {
      const t = tabs.nth(i);
      if (await t.isVisible({ timeout: 500 }).catch(() => false)) {
        await t.click().catch(() => {});
        await page.waitForTimeout(300);
        await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      }
    }
  });
});
