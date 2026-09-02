import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun élément n'a un z-index aberrant (> 9999) qui casserait
 * la pile UI (dialogs, toasts, sidebar).
 */

const ROUTES = ['/', '/emails', '/etablissements'];

test.describe('z-index sain', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : z-index < 10000`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const max = await page.evaluate(() => {
        let max = 0;
        document.querySelectorAll('*').forEach(el => {
          const z = parseInt(getComputedStyle(el).zIndex || '0', 10);
          if (!Number.isNaN(z) && z > max) max = z;
        });
        return max;
      });
      expect(max, `z-index aberrant sur ${path} : ${max}`).toBeLessThan(10000);
    });
  }
});
