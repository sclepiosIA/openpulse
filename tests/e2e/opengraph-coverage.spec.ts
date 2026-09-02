import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie la présence des Open Graph tags sur les pages principales.
 */

const ROUTES = ['/', '/etablissements', '/emails'];

test.describe('Open Graph tags', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} expose og:title + og:description`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      const ogTitle = await page.locator('meta[property="og:title"]').count();
      const ogDesc = await page.locator('meta[property="og:description"]').count();
      expect(ogTitle, `og:title manquant sur ${path}`).toBeGreaterThan(0);
      expect(ogDesc, `og:description manquant sur ${path}`).toBeGreaterThan(0);
    });
  }
});
