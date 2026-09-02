import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture responsive : vérifie qu'il n'y a pas de scroll horizontal
 * indésirable sur mobile (375px) pour les pages principales.
 */

const ROUTES = ['/', '/etablissements', '/prospects', '/emails', '/taches', '/people', '/tresorerie'];

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Pas de scroll horizontal sur mobile', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} sans overflow horizontal`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
      });
      // Tolérance 5px (barres de scroll, arrondis)
      expect(overflow, `Overflow horizontal de ${overflow}px sur ${path}`).toBeLessThanOrEqual(5);
    });
  }
});
