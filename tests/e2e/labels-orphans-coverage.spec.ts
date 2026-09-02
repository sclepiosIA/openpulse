import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun label de form n'est orphelin (htmlFor sans input).
 */

const ROUTES = ['/profil', '/parametres'];

test.describe('Labels form sains', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : pas de label orphelin`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const orphans = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label[for]')) as HTMLLabelElement[];
        return labels.filter(l => l.htmlFor && !document.getElementById(l.htmlFor)).map(l => l.htmlFor);
      });
      expect(orphans, `Labels orphelins sur ${path}: ${orphans.join(', ')}`).toHaveLength(0);
    });
  }
});
