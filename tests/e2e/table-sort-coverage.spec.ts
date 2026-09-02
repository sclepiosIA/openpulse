import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que le tri de colonnes (header cliquable) fonctionne sur les
 * pages liste sans crash.
 */

const TARGETS = ['/etablissements', '/prospects', '/people', '/taches'];

test.describe('Tri de colonnes', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of TARGETS) {
    test(`${path} : header sortable sans crash`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const headers = page.locator('th[role="button"], th button, [role="columnheader"] button');
      const count = await headers.count();
      if (count === 0) { test.skip(true, `Aucun header triable sur ${path}`); return; }
      const target = headers.first();
      if (await target.isVisible({ timeout: 1000 }).catch(() => false)) {
        await target.click();
        await page.waitForTimeout(500);
        await target.click();
        await page.waitForTimeout(500);
        await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      }
    });
  }
});
