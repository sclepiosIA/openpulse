import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'un H1 unique existe sur les pages principales (SEO + a11y).
 */

const ROUTES = ['/', '/etablissements', '/prospects', '/emails', '/people', '/tresorerie', '/taches'];

test.describe('H1 unique par page', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} a un H1 unique ou aucun`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);
      const count = await page.locator('h1').count();
      expect(count, `Plusieurs H1 sur ${path} (${count})`).toBeLessThanOrEqual(1);
    });
  }
});
