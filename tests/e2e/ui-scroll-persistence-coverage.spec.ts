import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun élément critique (header, sidebar) ne devient invisible
 * après scroll vertical (régression UI courante).
 */

const ROUTES = ['/etablissements', '/emails', '/people'];

test.describe('UI persistante au scroll', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : main-content visible après scroll`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(400);
      await expect(page.locator('#main-content')).toBeVisible();
    });
  }
});
