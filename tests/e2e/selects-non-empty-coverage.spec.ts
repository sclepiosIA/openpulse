import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les selects natifs et les Radix selects exposent au moins
 * une option par champ visible sur les pages principales.
 */

const ROUTES = ['/prospects', '/taches', '/people'];

test.describe('Selects non vides', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : aucun select sans option`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const empty = await page.evaluate(() => {
        const sels = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];
        return sels.filter(s => s.options.length === 0).length;
      });
      expect(empty, `Selects vides sur ${path}`).toBe(0);
    });
  }
});
