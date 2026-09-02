import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune URL ne contient de fragment "undefined" ou "null"
 * (signal d'un router ou template cassé).
 */

const ROUTES = ['/etablissements', '/prospects', '/people', '/emails'];

test.describe('URLs sans undefined/null', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : liens internes propres`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const bad = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
          .filter(h => /\/(undefined|null|NaN)(\/|$|\?)/.test(h));
      });
      expect(bad, `URLs corrompues sur ${path}: ${bad.join(', ')}`).toHaveLength(0);
    });
  }
});
