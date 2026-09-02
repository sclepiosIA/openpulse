import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie le double-clic sur la première ligne d'une liste : doit ouvrir
 * la fiche détail ou ne rien faire (jamais crash).
 */

const ROUTES = ['/etablissements', '/prospects', '/people'];

test.describe('Double-clic sur ligne sans crash', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : dblclick sans crash`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const row = page.locator('tr, [role="row"], a[href*="/etablissements/"], a[href*="/prospects/"], a[href*="/people/"]').first();
      if (!(await row.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, `Pas de ligne sur ${path}`); return;
      }
      await row.dblclick().catch(() => {});
      await page.waitForTimeout(800);
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
